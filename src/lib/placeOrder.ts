import { supabase } from "@/integrations/supabase/client";
import { ensureVisitorTracked } from "@/lib/visitorTracking";

export interface PlaceOrderItem {
  productName: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface PlaceOrderInput {
  customerName: string;
  phone: string;
  address: string;
  altPhone?: string | null;
  note?: string | null;
  deliveryCharge: number;
  discount?: number;
  items: PlaceOrderItem[];
}

/**
 * Saves an order into the backend (orders + order_items) so it shows up in the
 * admin dashboard. Uses the same `place_order` RPC as the main checkout flow.
 */
export async function placeOrder(input: PlaceOrderInput) {
  const subtotal = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discount = input.discount ?? 0;
  const grandTotal = subtotal + input.deliveryCharge - discount;

  // Make sure the visitor (and their IP) exists so the admin IP-block panel works.
  let visitorId: string | null = null;
  try {
    visitorId = (await ensureVisitorTracked()).visitorId;
  } catch {
    visitorId = typeof localStorage !== "undefined" ? localStorage.getItem("visitor-id") : null;
  }

  const { data: orderRows, error: orderErr } = await supabase.rpc("place_order", {
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_address: input.address,
    p_alt_phone: input.altPhone || null,
    p_note: input.note || null,
    p_total_amount: grandTotal,
    p_discount: discount,
    p_delivery_charge: input.deliveryCharge,
    p_visitor_profile_id: null,
    p_visitor_id: visitorId,
    p_traffic_source:
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem("traffic-source")) || "direct",
  });

  if (orderErr || !orderRows || orderRows.length === 0) {
    throw orderErr || new Error("Order creation failed");
  }
  const order = orderRows[0] as { id: string; customer_facing_id?: string | null };

  const { error: itemsErr } = await supabase.from("order_items").insert(
    input.items.map((i) => ({
      order_id: order.id,
      product_id: null,
      product_name: i.productName,
      product_image: i.productImage || null,
      quantity: i.quantity,
      unit_price: i.unitPrice,
    })),
  );
  if (itemsErr) throw itemsErr;

  // Keep a local snapshot so the thank-you page can show/download the invoice
  // right away, even for guests who are not logged in.
  try {
    localStorage.setItem(
      "last_order_invoice",
      JSON.stringify({
        order_id: order.id,
        invoice_no: order.customer_facing_id || order.id.slice(0, 8).toUpperCase(),
        created_at: new Date().toISOString(),
        customer_name: input.customerName,
        phone: input.phone,
        address: input.address,
        delivery_charge: input.deliveryCharge,
        discount,
        total_amount: grandTotal,
        items: input.items.map((i) => ({
          product_name: i.productName,
          quantity: i.quantity,
          unit_price: i.unitPrice,
        })),
      }),
    );
  } catch {
    /* storage unavailable */
  }

  return order;
}
