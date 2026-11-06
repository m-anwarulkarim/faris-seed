import { supabase } from "@/integrations/supabase/client";

const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";
const MAX_ITEM_DESC = 255;

export interface CreateOrderParams {
  id: string;
  order_id: string;
  customer_facing_id?: string | null;
  customer_name: string;
  phone: string;
  alt_phone?: string | null;
  address: string;
  total_amount: number;
  note?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  courier_note?: string | null;
  total_lot?: number | string | null;
  delivery_type?: number | string | null;
}

// Normalize a Bangladeshi mobile number to 11-digit "01XXXXXXXXX"
export function normalizeBdPhone(raw: any): string {
  if (raw == null) return "";
  let d = String(raw).replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("8801") && d.length === 13) d = d.slice(2);
  else if (d.startsWith("88") && d.length === 13) d = d.slice(2);
  else if (d.startsWith("01") && d.length === 11) { /* ok */ }
  else if (d.startsWith("1") && d.length === 10) d = "0" + d;
  if (!/^01[3-9]\d{8}$/.test(d)) return "";
  return d;
}

// Convert Steadfast's errors object/string into human-readable Bangla
export function formatCourierError(data: any): string {
  if (!data) return "কুরিয়ার থেকে কোনো রেসপন্স পাওয়া যায়নি";
  if (typeof data === "string") {
    if (data.includes("Account is not active")) {
      return "Steadfast অ্যাকাউন্ট এখনো সক্রিয় (Active) নয় — Steadfast প্যানেলে যোগাযোগ করে অ্যাকাউন্ট অ্যাক্টিভ করান";
    }
    return data;
  }
  const errors = data.errors;
  if (errors && typeof errors === "object") {
    const fieldMap: Record<string, string> = {
      recipient_phone: "কাস্টমার ফোন",
      alternative_phone: "অল্টারনেটিভ ফোন",
      recipient_name: "কাস্টমারের নাম",
      recipient_address: "ঠিকানা",
      cod_amount: "COD পরিমাণ",
      invoice: "ইনভয়েস নাম্বার",
      item_description: "পণ্যের বিবরণ",
      note: "নোট",
      total_lot: "টোটাল লট",
      delivery_type: "ডেলিভারি টাইপ",
    };
    const parts: string[] = [];
    for (const [field, msgs] of Object.entries(errors)) {
      const label = fieldMap[field] || field;
      const msg = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
      const friendly = msg
        .replace(/The .* format is invalid\.?/i, "ফরম্যাট সঠিক নয়")
        .replace(/The .* field is required\.?/i, "অবশ্যই দিতে হবে")
        .replace(/The .* must be at least (\d+) characters?\.?/i, "কমপক্ষে $1 অক্ষর হতে হবে")
        .replace(/The .* may not be greater than (\d+) characters?\.?/i, "$1 অক্ষরের বেশি হতে পারবে না")
        .replace(/The .* must be a number\.?/i, "একটি সংখ্যা হতে হবে");
      parts.push(`${label}: ${friendly}`);
    }
    if (parts.length) return parts.join(" • ");
  }
  if (data.message) return String(data.message);
  return "কুরিয়ার এন্ট্রি ব্যর্থ — অজানা কারণ";
}

export function buildItemDescription(items: { product_name: string; quantity: number }[]): string {
  if (!items.length) return "";
  const full = items.map((i) => `${i.product_name}(${i.quantity})`).join(", ");
  if (full.length <= MAX_ITEM_DESC) return full;

  let maxNameLen = Math.max(...items.map((i) => i.product_name.length));
  while (maxNameLen > 3) {
    maxNameLen--;
    const attempt = items
      .map((i) => {
        const name = i.product_name.length > maxNameLen ? i.product_name.substring(0, maxNameLen) : i.product_name;
        return `${name}(${i.quantity})`;
      })
      .join(", ");
    if (attempt.length <= MAX_ITEM_DESC) return attempt;
  }
  const minimal = items.map((i) => `${i.product_name.substring(0, 3)}(${i.quantity})`).join(", ");
  return minimal.length <= MAX_ITEM_DESC ? minimal : minimal.substring(0, MAX_ITEM_DESC);
}

// Fetch Steadfast API keys from app_settings table
export async function getSteadfastKeys(): Promise<{ apiKey: string; secretKey: string; courierNote: string }> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["steadfast_api_key", "steadfast_secret_key", "steadfast_courier_note"]);

  if (error) {
    throw new Error("সেটিংস লোড করতে সমস্যা হয়েছে: " + error.message);
  }

  const map: Record<string, string> = {};
  data?.forEach((r) => { map[r.key] = r.value; });

  const apiKey = map["steadfast_api_key"] || "";
  const secretKey = map["steadfast_secret_key"] || "";
  const courierNote = map["steadfast_courier_note"] || "";

  if (!apiKey || !secretKey) {
    throw new Error("Steadfast API credentials কনফিগার করা নেই — API Management সেটিংসে যান");
  }

  return { apiKey, secretKey, courierNote };
}

async function getAdminInfo(): Promise<{ id: string | null; name: string | null }> {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess?.session?.user;
    if (!user) return { id: null, name: null };
    return {
      id: user.id,
      name: user.user_metadata?.full_name || user.email || null,
    };
  } catch {
    return { id: null, name: null };
  }
}

/**
 * Direct client-side Steadfast order creation.
 * Bypasses Edge Function, interacts directly with Steadfast API (which supports CORS),
 * and updates Supabase database upon success.
 */
export async function createSteadfastOrderDirect(order: CreateOrderParams, deferStatusUpdate = false) {
  const { apiKey, secretKey, courierNote: defaultNote } = await getSteadfastKeys();

  // Fetch db order and items
  const [{ data: dbOrder }, { data: orderItems }] = await Promise.all([
    supabase
      .from("orders")
      .select("customer_facing_id, courier_note, courier_total_lot, courier_delivery_type, total_amount, payment_method, payment_status")
      .eq("id", order.id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", order.id),
  ]);

  const finalNote = order.courier_note ?? dbOrder?.courier_note ?? order.note ?? defaultNote;
  const finalLot = order.total_lot != null ? parseInt(String(order.total_lot), 10)
    : dbOrder?.courier_total_lot != null ? dbOrder.courier_total_lot : 1;
  const finalType = order.delivery_type != null ? parseInt(String(order.delivery_type), 10)
    : dbOrder?.courier_delivery_type != null ? dbOrder.courier_delivery_type : 0;

  const itemDescription = buildItemDescription(
    (orderItems || []).map((i: any) => ({ product_name: i.product_name, quantity: i.quantity }))
  );

  const recipientPhone = normalizeBdPhone(order.phone);
  if (!recipientPhone) {
    throw new Error(`কাস্টমার ফোন নম্বর সঠিক BD ফরম্যাটে নেই (${order.phone || "খালি"}) — অর্ডার এডিট করে ঠিক করুন`);
  }
  const altPhone = normalizeBdPhone(order.alt_phone);

  const invoice = String(order.customer_facing_id || dbOrder?.customer_facing_id || order.order_id || "").toLowerCase();
  const paymentMethod = order.payment_method ?? dbOrder?.payment_method;
  const paymentStatus = order.payment_status ?? dbOrder?.payment_status;
  const totalAmount = order.total_amount ?? dbOrder?.total_amount ?? 0;
  const isBkashPaid = paymentMethod === "bkash" && paymentStatus === "paid";
  const codAmount = isBkashPaid ? 0 : totalAmount;

  const payload: Record<string, any> = {
    invoice,
    recipient_name: order.customer_name,
    recipient_phone: recipientPhone,
    recipient_address: order.address,
    cod_amount: codAmount,
    note: finalNote,
    total_lot: finalLot,
    delivery_type: finalType,
  };
  if (itemDescription) payload.item_description = itemDescription;
  if (altPhone && altPhone !== recipientPhone) payload.alternative_phone = altPhone;

  const res = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      "Secret-Key": secretKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const resText = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = JSON.parse(resText);
  } catch {
    data = resText;
  }

  const gotConsignment = data?.status === 200 && data.consignment?.consignment_id && data.consignment?.tracking_code;

  if (gotConsignment) {
    const adminInfo = await getAdminInfo();
    const updateData: Record<string, unknown> = {
      is_courier_entered: true,
      courier_provider: "steadfast",
      consignment_id: String(data.consignment.consignment_id),
      tracking_code: String(data.consignment.tracking_code),
    };
    if (!deferStatusUpdate) {
      updateData.status = "entry_done";
    }
    if (adminInfo.id) {
      updateData.last_status_changed_by = adminInfo.id;
    }

    const { error: updateErr } = await supabase.from("orders").update(updateData).eq("id", order.id);
    if (updateErr) {
      console.error("Order DB update failed after Steadfast entry:", updateErr);
    }

    if (!deferStatusUpdate) {
      await supabase.from("order_status_history").insert({
        order_id: order.id,
        status: "entry_done",
        changed_by: adminInfo.id,
        changed_by_name: adminInfo.name,
      });
    }

    return { success: true, consignment: data.consignment, data };
  }

  const friendly = formatCourierError(data);
  throw new Error(friendly);
}

/**
 * Dispatches Steadfast order entry.
 * First tries Supabase Edge Function; if 404/unavailable, automatically
 * executes direct client-side entry so operations are never blocked.
 */
export async function dispatchSteadfastEntry(order: CreateOrderParams, deferStatusUpdate = false) {
  try {
    const { data, error } = await supabase.functions.invoke("steadfast-courier", {
      body: {
        action: "create_order",
        defer_status_update: deferStatusUpdate,
        orders: [order],
      },
    });

    if (error) {
      const status = (error as any)?.context?.status;
      const msg = error.message || "";
      // Edge function 404 (not deployed) or network issue -> fallback to direct
      if (status === 404 || msg.includes("Failed to send a request") || msg.includes("non-2xx")) {
        console.warn("Edge function 404/network error, executing direct client-side Steadfast entry...");
        return await createSteadfastOrderDirect(order, deferStatusUpdate);
      }

      let reason = msg;
      try {
        const ctxBody = (error as any)?.context?.body;
        if (ctxBody) {
          const parsed = typeof ctxBody === "string" ? JSON.parse(ctxBody) : ctxBody;
          if (parsed?.error) reason = parsed.error;
        }
      } catch { /* ignore */ }
      throw new Error(reason);
    }

    if (data?.error || data?.success === false) {
      throw new Error(data.error || "Courier entry failed");
    }

    return { success: true, ...data };
  } catch (err: any) {
    const msg = err?.message || "";
    if (msg.includes("non-2xx") || msg.includes("404") || msg.includes("Failed to send")) {
      console.warn("Edge function failed, executing direct client-side Steadfast entry...");
      return await createSteadfastOrderDirect(order, deferStatusUpdate);
    }
    throw err;
  }
}

/**
 * Check single order status from Steadfast
 */
export async function checkSteadfastStatus(orderId: string, consignmentId: string) {
  try {
    const { data, error } = await supabase.functions.invoke("steadfast-courier", {
      body: { action: "check_single_status", order_id: orderId, consignment_id: consignmentId },
    });
    if (!error && data) return data;
  } catch {
    // fallback
  }

  // Direct check
  const { apiKey, secretKey } = await getSteadfastKeys();
  const res = await fetch(`${STEADFAST_BASE_URL}/status_by_cid/${consignmentId}`, {
    headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    await supabase.from("orders").update({ delivery_status: "unknown_approval_pending" }).eq("id", orderId);
    return { delivery_status: "unknown_approval_pending", raw: null, note: "API error, moved to U-AP" };
  }

  const sfData = await res.json();
  const courierStatus = sfData?.delivery_status;

  const statusMap: Record<string, string> = {
    in_review: "entry_done",
    pending: "on_the_way",
    picked: "picked",
    on_the_way: "on_the_way",
    delivered: "delivered",
    delivered_approval_pending: "delivered_approval_pending",
    partial_delivered: "partial_delivered",
    partial_delivered_approval_pending: "partial_delivered_approval_pending",
    cancelled: "return",
    cancelled_approval_pending: "cancelled_approval_pending",
    hold: "hold",
    unknown: "unknown_approval_pending",
    unknown_approval_pending: "unknown_approval_pending",
  };

  const mappedStatus = courierStatus ? statusMap[courierStatus] || courierStatus : null;
  const courierNote = sfData?.note || sfData?.remarks || sfData?.comment || null;

  if (mappedStatus) {
    const updateData: Record<string, any> = { delivery_status: mappedStatus, status: mappedStatus };
    if (courierNote) updateData.courier_remarks = courierNote;
    await supabase.from("orders").update(updateData).eq("id", orderId);
  } else if (courierNote) {
    await supabase.from("orders").update({ courier_remarks: courierNote }).eq("id", orderId);
  }

  return {
    delivery_status: mappedStatus || courierStatus,
    raw: courierStatus,
    courier_note: courierNote,
  };
}

/**
 * Fetch Return Requests from Steadfast API
 */
export async function fetchSteadfastReturnRequests() {
  try {
    const { data, error } = await supabase.functions.invoke("steadfast-courier", {
      body: { action: "fetch_return_requests" },
    });
    if (!error && data) return data;
  } catch {
    // fallback
  }

  const { apiKey, secretKey } = await getSteadfastKeys();
  const allConsignmentIds: string[] = [];
  let currentPage = 1;
  let lastPage = 1;

  while (currentPage <= lastPage) {
    const url = `${STEADFAST_BASE_URL}/get_return_requests?page=${currentPage}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json" },
    });
    if (!res.ok) break;
    const apiData = await res.json();
    if (currentPage === 1 && apiData?.meta) {
      lastPage = apiData.meta.last_page || 1;
    }
    const pageItems = Array.isArray(apiData) ? apiData : (apiData?.data || []);
    for (const item of pageItems) {
      const cid = String(item.consignment_id || item.id || "");
      if (cid && cid !== "undefined" && !allConsignmentIds.includes(cid)) {
        allConsignmentIds.push(cid);
      }
    }
    currentPage++;
    if (currentPage > 10) break;
  }

  if (!allConsignmentIds.length) {
    return { updated: 0, total: 0, pages: lastPage, message: "কোনো নতুন রিটার্ন রিকোয়েস্ট পাওয়া যায়নি" };
  }

  const { data: matchedOrders } = await supabase
    .from("orders")
    .select("id, consignment_id, status")
    .in("consignment_id", allConsignmentIds)
    .not("status", "in", '("return","rtn_received","cancelled_approval_pending")');

  if (!matchedOrders?.length) {
    return { updated: 0, total: allConsignmentIds.length, pages: lastPage, message: "নতুন কোনো অর্ডার আপডেট করার প্রয়োজন নেই" };
  }

  const idsToUpdate = matchedOrders.map((o) => o.id);
  await supabase
    .from("orders")
    .update({ status: "cancelled_approval_pending", delivery_status: "cancelled_approval_pending" })
    .in("id", idsToUpdate);

  const adminInfo = await getAdminInfo();
  await supabase.from("order_status_history").insert(
    idsToUpdate.map((oid) => ({
      order_id: oid,
      status: "cancelled_approval_pending",
      changed_by: adminInfo.id,
      changed_by_name: adminInfo.name,
    }))
  );

  return { updated: idsToUpdate.length, total: allConsignmentIds.length, pages: lastPage };
}

