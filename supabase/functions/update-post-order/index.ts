import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, order_id, alt_phone, items, visitor_profile_id } = body;

    if (!order_id || !action) {
      return json({ error: "order_id and action required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify order exists and is recent (last 2 hours)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_id, total_amount, delivery_charge, status, created_at, alt_phone, visitor_profile_id, notify_after, note")
      .eq("order_id", order_id)
      .single();

    if (orderErr || !order) {
      return json({ error: "Order not found" }, 404);
    }

    // Post-order funnel actions are always allowed; only block unknown/sensitive actions after 2h
    const ALWAYS_ALLOWED_ACTIONS = ["add_alt_phone", "add_upsell_items", "link_profile", "merge_cart_items"];
    const createdAt = new Date(order.created_at).getTime();
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    if (createdAt < twoHoursAgo && !ALWAYS_ALLOWED_ACTIONS.includes(action)) {
      return json({ error: "Order too old to update", fallback: true }, 200);
    }

    // ─── Add Alt Phone ───
    if (action === "add_alt_phone") {
      if (!alt_phone || typeof alt_phone !== "string" || alt_phone.trim().length < 11) {
        return json({ error: "Valid phone number required" }, 400);
      }
      const { error } = await supabase
        .from("orders")
        .update({ alt_phone: alt_phone.trim() })
        .eq("id", order.id);
      if (error) throw error;
      return json({ success: true });
    }

    // ─── Upsell Items ───
    if (action === "add_upsell_items") {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return json({ error: "Items array required" }, 400);
      }

      const productIds = items.map((i: any) => i.product_id);
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("id, name, regular_price, offer_price, product_image, is_hidden")
        .in("id", productIds);

      if (prodErr || !products) throw prodErr || new Error("Products not found");

      const validProducts = products.filter((p) => !p.is_hidden);
      if (validProducts.length === 0) {
        return json({ error: "No valid products" }, 400);
      }

      const currentTotal = Number(order.total_amount) || 0;
      const currentDelivery = Number(order.delivery_charge) ?? 0;
      const isBonusDiscount = currentTotal >= 600 || currentDelivery === 0;

      const newOrderItems = [];
      let addedTotal = 0;

      for (const item of items) {
        const product = validProducts.find((p) => p.id === item.product_id);
        if (!product) continue;

        const qty = Math.min(Math.max(1, item.quantity || 1), 5);
        let unitPrice = product.offer_price ?? product.regular_price;
        if (isBonusDiscount) {
          unitPrice = Math.round(unitPrice * 0.9);
        }

        newOrderItems.push({
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          product_image: product.product_image,
          quantity: qty,
          unit_price: unitPrice,
        });
        addedTotal += unitPrice * qty;
      }

      if (newOrderItems.length === 0) {
        return json({ error: "No valid items to add" }, 400);
      }

      const { error: insertErr } = await supabase
        .from("order_items")
        .insert(newOrderItems);
      if (insertErr) throw insertErr;

      const newTotal = currentTotal + addedTotal;
      let newDeliveryCharge: number;
      if (newTotal >= 600) newDeliveryCharge = 0;
      else if (newTotal >= 400) newDeliveryCharge = 50;
      else if (newTotal >= 200) newDeliveryCharge = 70;
      else newDeliveryCharge = 120;

      const { error: updateErr } = await supabase
        .from("orders")
        .update({ total_amount: newTotal, delivery_charge: newDeliveryCharge })
        .eq("id", order.id);
      if (updateErr) throw updateErr;

      return json({
        success: true,
        new_total: newTotal,
        new_delivery_charge: newDeliveryCharge,
        items_added: newOrderItems.length,
        bonus_discount: isBonusDiscount,
      });
    }

    // ─── Link Profile to Order ───
    if (action === "link_profile") {
      if (!visitor_profile_id || typeof visitor_profile_id !== "string") {
        return json({ error: "visitor_profile_id required" }, 400);
      }

      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("id, phone_verified")
        .eq("id", visitor_profile_id)
        .maybeSingle();

      if (!profile) {
        return json({ error: "Profile not found" }, 404);
      }

      const { error } = await supabase
        .from("orders")
        .update({ visitor_profile_id: visitor_profile_id })
        .eq("id", order.id);

      if (error) throw error;
      return json({ success: true });
    }

    // ─── Merge Cart Items (Smart Order Update) ───
    if (action === "merge_cart_items") {
      const { cart_items, customer_name, address, note } = body;

      if (!cart_items || !Array.isArray(cart_items) || cart_items.length === 0) {
        return json({ error: "cart_items array required" }, 400);
      }

      // Delete ALL existing order items first (replace, not merge)
      const { error: delErr } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);
      if (delErr) throw delErr;

      // Insert only the new cart items
      const newItems = cart_items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_image: item.product_image || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      const { error: insErr } = await supabase
        .from("order_items")
        .insert(newItems);
      if (insErr) throw insErr;

      // Calculate total from new items
      const newTotalAmount = newItems.reduce((sum: number, i: any) => sum + i.quantity * Number(i.unit_price), 0);

      // Calculate delivery charge server-side
      let newDeliveryCharge: number;
      if (newTotalAmount >= 600) newDeliveryCharge = 0;
      else if (newTotalAmount >= 400) newDeliveryCharge = 50;
      else if (newTotalAmount >= 200) newDeliveryCharge = 70;
      else newDeliveryCharge = 120;

      const updatePayload: Record<string, any> = {
        status: "pending",
        total_amount: newTotalAmount,
        delivery_charge: newDeliveryCharge,
        created_at: new Date().toISOString(),
        notify_after: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        customer_facing_id: order.order_id,
      };

      if (customer_name) updatePayload.customer_name = customer_name;
      if (address) updatePayload.address = address;
      if (note !== undefined) {
        updatePayload.note = note || "";
      }

      const { error: updateErr } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", order.id);
      if (updateErr) throw updateErr;

      return json({
        success: true,
        order_id: order.order_id,
        db_order_id: order.id,
        merged: true,
        new_total: newTotalAmount,
        new_delivery_charge: newDeliveryCharge,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("update-post-order error:", err);
    return json({ error: err.message }, 500);
  }
});
