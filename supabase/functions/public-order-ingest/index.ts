// Public Order Ingest API — accepts orders from connected external sites.
// Auth: headers `x-api-key: pk_...`, `x-secret-key: sk_...`
// Body JSON: { customer_name, phone, address, alt_phone?, district?, thana?, note?, items: [{product_id, quantity}] }
// Pricing is enforced server-side from products table; client-supplied prices are ignored.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-secret-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function calcDelivery(subtotal: number, district?: string | null): number {
  if (subtotal >= 600) return 0;
  const d = (district || "").toLowerCase().trim();
  if (!d) return 120;
  if (d.includes("dhaka") || d.includes("ঢাকা")) return 70;
  return 120;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = req.headers.get("x-api-key") || "";
  const secretKey = req.headers.get("x-secret-key") || "";
  if (!apiKey.startsWith("pk_") || !secretKey.startsWith("sk_")) {
    return json({ error: "missing_keys" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Validate site keys
  const { data: site } = await supabase
    .from("connected_sites")
    .select("id, site_slug, site_name, is_active, secret_key_hash")
    .eq("api_key", apiKey)
    .maybeSingle();

  if (!site || !site.is_active) return json({ error: "invalid_or_inactive_key" }, 403);

  const incomingHash = await sha256Hex(secretKey);
  if (incomingHash !== site.secret_key_hash) return json({ error: "invalid_secret_key" }, 403);

  // Parse + basic validation
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const customer_name = String(body?.customer_name || "").trim();
  const phone = String(body?.phone || "").trim();
  const address = String(body?.address || "").trim();
  const alt_phone = body?.alt_phone ? String(body.alt_phone).trim() : null;
  const district = body?.district ? String(body.district).trim() : null;
  const thana = body?.thana ? String(body.thana).trim() : null;
  const note = body?.note ? String(body.note).trim() : null;
  const trafficSource = body?.traffic_source ? String(body.traffic_source).trim().slice(0, 40) : "direct";
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!customer_name || customer_name.length > 120) return json({ error: "invalid_customer_name" }, 400);
  if (!/^01[0-9]{9}$/.test(phone)) return json({ error: "invalid_phone" }, 400);
  if (!address || address.length > 500) return json({ error: "invalid_address" }, 400);
  if (alt_phone && !/^01[0-9]{9}$/.test(alt_phone)) return json({ error: "invalid_alt_phone" }, 400);
  if (items.length === 0 || items.length > 30) return json({ error: "invalid_items" }, 400);

  // Fetch product prices server-side
  const productIds = items.map((it: any) => String(it.product_id)).filter(Boolean);
  if (productIds.length !== items.length) return json({ error: "invalid_item_product_id" }, 400);

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, product_image, regular_price, offer_price, stock, is_hidden")
    .in("id", productIds);
  if (prodErr) return json({ error: "product_lookup_failed" }, 500);

  const map = new Map((products || []).map((p: any) => [p.id, p]));
  let subtotal = 0;
  const orderItems: any[] = [];
  for (const it of items) {
    const qty = Math.max(1, Math.min(99, parseInt(String(it.quantity || 1), 10) || 1));
    const p: any = map.get(String(it.product_id));
    if (!p || p.is_hidden) return json({ error: "product_unavailable", product_id: it.product_id }, 400);
    const price = Number(p.offer_price || p.regular_price || 0);
    subtotal += price * qty;
    orderItems.push({
      product_id: p.id,
      product_name: p.name,
      product_image: p.product_image || null,
      quantity: qty,
      unit_price: price,
    });
  }

  const deliveryCharge = calcDelivery(subtotal, district);
  const grandTotal = subtotal + deliveryCharge;

  // Place order via existing RPC
  const { data: orderRows, error: orderErr } = await supabase.rpc("place_order", {
    p_customer_name: customer_name,
    p_phone: phone,
    p_address: address,
    p_alt_phone: alt_phone,
    p_note: note,
    p_total_amount: grandTotal,
    p_discount: 0,
    p_delivery_charge: deliveryCharge,
    p_visitor_profile_id: null,
    p_visitor_id: null,
    p_traffic_source: trafficSource,
  });
  if (orderErr || !orderRows || orderRows.length === 0) {
    console.error("place_order failed:", orderErr);
    return json({ error: "order_create_failed", message: orderErr?.message }, 500);
  }
  const order: any = orderRows[0];

  // Insert order items
  const itemsWithOrderId = orderItems.map((oi) => ({ ...oi, order_id: order.id }));
  const { error: itemsErr } = await supabase.from("order_items").insert(itemsWithOrderId);
  if (itemsErr) {
    console.error("order_items insert failed:", itemsErr);
    return json({ error: "items_insert_failed", message: itemsErr.message, order_id: order.id }, 500);
  }

  // Stamp connected_site_id, district, thana
  const updates: any = { connected_site_id: site.id };
  if (district) updates.district = district;
  if (thana) updates.thana = thana;
  await supabase.from("orders").update(updates).eq("id", order.id);

  // Bump counters
  await supabase
    .from("connected_sites")
    .update({ total_orders: (site as any).total_orders + 1 || 1, last_order_at: new Date().toISOString() })
    .eq("id", site.id);

  return json({
    success: true,
    order_id: order.id,
    customer_facing_id: order.customer_facing_id || order.order_id,
    total_amount: grandTotal,
    delivery_charge: deliveryCharge,
    site: site.site_slug,
  });
});
