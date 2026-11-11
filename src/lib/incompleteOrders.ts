import { supabase } from "@/integrations/supabase/client";

export interface IncompleteCartItem {
  id?: string;
  name: string;
  image?: string | null;
  price: number;
  quantity: number;
}

export interface IncompleteOrderInput {
  phone: string;
  customerName?: string | null;
  address?: string | null;
  items: IncompleteCartItem[];
  reason?: string;
}

/**
 * Saves or updates an incomplete order in the database.
 * Triggered automatically when a visitor enters a valid 11-digit phone number in the checkout/order form.
 */
export async function saveIncompleteOrder(input: IncompleteOrderInput) {
  const cleanPhone = (input.phone || "").replace(/[\s-]/g, "").trim();
  // Valid Bangladeshi mobile number check
  if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
    return null;
  }

  const visitorId = typeof window !== "undefined" ? localStorage.getItem("visitor-id") : null;
  const reason = input.reason || "অর্ডার ফর্ম পূরণ করে ফেলে রাখা হয়েছে";
  const now = new Date().toISOString();

  try {
    const { data: existing } = await supabase
      .from("incomplete_orders")
      .select("id, attempt_count")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("incomplete_orders")
        .update({
          customer_name: input.customerName?.trim() || null,
          address: input.address?.trim() || null,
          cart_snapshot: input.items as any,
          reason,
          attempt_count: (existing.attempt_count || 1) + 1,
          updated_at: now,
          visitor_id: visitorId,
        })
        .eq("id", existing.id)
        .select()
        .maybeSingle();

      if (error) console.warn("Failed to update incomplete order:", error);
      return data;
    } else {
      const { data, error } = await supabase
        .from("incomplete_orders")
        .insert({
          phone: cleanPhone,
          customer_name: input.customerName?.trim() || null,
          address: input.address?.trim() || null,
          cart_snapshot: input.items as any,
          reason,
          attempt_count: 1,
          visitor_id: visitorId,
          created_at: now,
          updated_at: now,
        })
        .select()
        .maybeSingle();

      if (error) console.warn("Failed to insert incomplete order:", error);
      return data;
    }
  } catch (err) {
    console.warn("saveIncompleteOrder error:", err);
    return null;
  }
}

/**
 * Deletes the incomplete order when the real order is successfully confirmed.
 */
export async function clearIncompleteOrder(phone: string) {
  const cleanPhone = (phone || "").replace(/[\s-]/g, "").trim();
  if (!cleanPhone) return;
  try {
    await supabase.from("incomplete_orders").delete().eq("phone", cleanPhone);
  } catch (err) {
    console.warn("clearIncompleteOrder error:", err);
  }
}
