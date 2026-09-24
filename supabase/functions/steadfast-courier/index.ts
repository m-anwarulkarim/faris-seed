import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEADFAST_BASE_URL = "https://portal.packzy.com/api/v1";
const MAX_ITEM_DESC = 255;

function getCourierInvoice(order: any, dbOrder?: any): string {
  return String(order.customer_facing_id || dbOrder?.customer_facing_id || order.order_id || "").toLowerCase();
}

// Normalize a Bangladeshi mobile number to 11-digit "01XXXXXXXXX".
// Returns "" if it cannot be normalized to a valid BD format.
function normalizeBdPhone(raw: any): string {
  if (raw == null) return "";
  let d = String(raw).replace(/\D/g, "");
  if (!d) return "";
  // strip country codes
  if (d.startsWith("8801") && d.length === 13) d = d.slice(2);          // 880XXXXXXXXXXX -> 01XXXXXXXXX
  else if (d.startsWith("88") && d.length === 13) d = d.slice(2);
  else if (d.startsWith("01") && d.length === 11) { /* ok */ }
  else if (d.startsWith("1") && d.length === 10) d = "0" + d;            // 1XXXXXXXXX -> 01XXXXXXXXX
  // final validation: must be 11 digits, start with 01, and 3rd digit be 3-9 (operator)
  if (!/^01[3-9]\d{8}$/.test(d)) return "";
  return d;
}

// Convert Steadfast's `errors` object/string into a single human-readable Bangla line.
function formatCourierError(data: any): string {
  if (!data) return "কুরিয়ার থেকে কোনো রেসপন্স পাওয়া যায়নি";
  // Steadfast usually returns: { status: 400, errors: { field: ["msg", ...] } } or { message: "..." }
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
      // Translate the most common Steadfast messages
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

function buildItemDescription(items: { product_name: string; quantity: number }[]): string {
  if (!items.length) return "";

  // Full format first
  const full = items.map((i) => `${i.product_name}(${i.quantity})`).join(", ");
  if (full.length <= MAX_ITEM_DESC) return full;

  // Progressively trim each product name equally until it fits
  let maxNameLen = Math.max(...items.map((i) => i.product_name.length));

  while (maxNameLen > 3) {
    maxNameLen--;
    const attempt = items
      .map((i) => {
        const name = i.product_name.length > maxNameLen
          ? i.product_name.substring(0, maxNameLen)
          : i.product_name;
        return `${name}(${i.quantity})`;
      })
      .join(", ");
    if (attempt.length <= MAX_ITEM_DESC) return attempt;
  }

  // Last resort: just truncate
  const minimal = items.map((i) => `${i.product_name.substring(0, 3)}(${i.quantity})`).join(", ");
  return minimal.length <= MAX_ITEM_DESC ? minimal : minimal.substring(0, MAX_ITEM_DESC);
}

async function getApiKeys(adminClient: any) {
  // Try DB first, fallback to env
  const { data } = await adminClient
    .from("app_settings")
    .select("key, value")
    .in("key", ["steadfast_api_key", "steadfast_secret_key"]);

  const dbKeys: Record<string, string> = {};
  data?.forEach((r: any) => { dbKeys[r.key] = r.value; });

  return {
    apiKey: dbKeys["steadfast_api_key"] || Deno.env.get("STEADFAST_API_KEY") || "",
    secretKey: dbKeys["steadfast_secret_key"] || Deno.env.get("STEADFAST_SECRET_KEY") || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, orders, defer_status_update = false } = body;

    // sync_statuses can be called by cron (no user auth needed)
    if (action === "sync_statuses") {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { apiKey, secretKey } = await getApiKeys(adminClient);
      if (!apiKey || !secretKey) {
        return new Response(JSON.stringify({ error: "API keys not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sync all active courier statuses — covers cancellation detection too
      const SYNC_STATUSES = [
        "entry_done", "in_review", "shipped", "picked",
        "on_the_way", "hold", "pending",
        "unknown_approval_pending", "delivered_approval_pending",
        "partial_delivered_approval_pending",
      ];
      const batchLimit = body.limit || 100; // Process up to 100 per call
      const { data: entryOrders } = await adminClient
        .from("orders")
        .select("id, order_id, consignment_id, status, delivery_status, courier_provider")
        .in("status", SYNC_STATUSES)
        .eq("is_courier_entered", true)
        .eq("is_deleted", false)
        .not("consignment_id", "is", null)
        .neq("courier_provider", "pathao")
        .order("updated_at", { ascending: true })
        .limit(batchLimit);

      if (!entryOrders || entryOrders.length === 0) {
        return new Response(JSON.stringify({ synced: 0, message: "No in-transit orders to check" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let updated = 0;
      // Process in parallel batches of 5 to avoid timeout
      const BATCH_SIZE = 5;
      for (let i = 0; i < entryOrders.length; i += BATCH_SIZE) {
        const batch = entryOrders.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (order) => {
            const res = await fetch(`${STEADFAST_BASE_URL}/status_by_cid/${order.consignment_id}`, {
              headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json" },
            });
            if (!res.ok) { await res.text(); return null; }
            const data = await res.json();
            const courierStatus = data?.delivery_status;
            if (!courierStatus) return null;

            // 🔒 DO_NOT_MODIFY_START — Courier → DB status mapping (sync)
            const syncStatusMap: Record<string, string> = {
              in_review: "entry_done",
              pending: "on_the_way",
              delivered: "delivered",
              delivered_approval_pending: "delivered_approval_pending",
              partial_delivered: "partial_delivered",
              partial_delivered_approval_pending: "partial_delivered_approval_pending",
              hold: "hold",
              unknown: "unknown_approval_pending",
              unknown_approval_pending: "unknown_approval_pending",
              cancelled_approval_pending: "cancelled_approval_pending",
              cancelled: "return",
            };
            const mappedSyncStatus = syncStatusMap[courierStatus] || courierStatus;
            // 🔒 DO_NOT_MODIFY_END

            // Skip if status hasn't changed
            if (mappedSyncStatus === order.status && mappedSyncStatus === order.delivery_status) return null;

            const updateData: Record<string, any> = {
              delivery_status: mappedSyncStatus,
              status: mappedSyncStatus,
            };
            const courierNote = data?.note || data?.remarks || data?.comment || null;
            if (courierNote) updateData.courier_remarks = courierNote;

            await adminClient.from("orders").update(updateData).eq("id", order.id);
            return "updated";
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value === "updated") updated++;
        }
      }

      return new Response(JSON.stringify({ synced: updated, total: entryOrders.length }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update webhook token
    if (action === "update_webhook_token") {
      await adminClient
        .from("app_settings")
        .upsert({ key: "steadfast_webhook_token", value: body.token }, { onConflict: "key" });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update API keys
    if (action === "update_keys") {
      await adminClient
        .from("app_settings")
        .upsert([
          { key: "steadfast_api_key", value: body.api_key },
          { key: "steadfast_secret_key", value: body.secret_key },
        ], { onConflict: "key" });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API keys (DB > env fallback)
    const { apiKey, secretKey } = await getApiKeys(adminClient);
    if (!apiKey || !secretKey) {
      return new Response(
        JSON.stringify({ error: "Steadfast API credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    if (action === "check_single_status") {
      const { order_id, consignment_id } = body;
      if (!order_id || !consignment_id) {
        return new Response(JSON.stringify({ error: "order_id and consignment_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${STEADFAST_BASE_URL}/status_by_cid/${consignment_id}`, {
        headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json" },
      });

      if (!res.ok) {
        // API couldn't find data — move to U-AP
        await adminClient.from("orders").update({ delivery_status: "unknown_approval_pending" }).eq("id", order_id);
        return new Response(JSON.stringify({ delivery_status: "unknown_approval_pending", raw: null, note: "API error, moved to U-AP" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sfData = await res.json();
      console.log("status_by_cid full response keys:", JSON.stringify(Object.keys(sfData || {})));
      console.log("status_by_cid sample:", JSON.stringify(sfData).substring(0, 600));
      const courierStatus = sfData?.delivery_status;

      // 🔒 DO_NOT_MODIFY_START — Courier → DB status mapping (single check)
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
      // 🔒 DO_NOT_MODIFY_END

      const mappedStatus = courierStatus ? statusMap[courierStatus] || courierStatus : null;

      const courierNote = sfData?.note || sfData?.remarks || sfData?.comment || null;

      if (mappedStatus) {
        const updateData: Record<string, any> = { delivery_status: mappedStatus, status: mappedStatus };
        if (courierNote) updateData.courier_remarks = courierNote;
        await adminClient.from("orders").update(updateData).eq("id", order_id);
      } else if (courierNote) {
        await adminClient.from("orders").update({ courier_remarks: courierNote }).eq("id", order_id);
      }

      return new Response(JSON.stringify({ 
        delivery_status: mappedStatus || courierStatus, 
        raw: courierStatus, 
        courier_note: courierNote,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_balance") {
      const res = await fetch(`${STEADFAST_BASE_URL}/get_balance`, {
        method: "GET",
        headers: {
          "Api-Key": apiKey,
          "Secret-Key": secretKey,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_order") {
      // Get global courier note from DB (lot=1 and type=0 are hardcoded)
      const { data: courierSettings } = await adminClient
        .from("app_settings")
        .select("value")
        .eq("key", "steadfast_courier_note")
        .maybeSingle();
      const defaultNote = courierSettings?.value || "";
      const defaultTotalLot = 1;
      const defaultDeliveryType = 0;

      const order = orders[0];
      // Fetch per-order courier settings and order items from DB
      const [{ data: dbOrder }, { data: orderItems }] = await Promise.all([
        adminClient
          .from("orders")
          .select("customer_facing_id, courier_note, courier_total_lot, courier_delivery_type")
          .eq("id", order.id)
          .single(),
        adminClient
          .from("order_items")
          .select("product_name, quantity")
          .eq("order_id", order.id),
      ]);

      const finalNote = order.courier_note ?? dbOrder?.courier_note ?? defaultNote;
      const finalLot = order.total_lot != null ? parseInt(String(order.total_lot), 10)
        : dbOrder?.courier_total_lot != null ? dbOrder.courier_total_lot : defaultTotalLot;
      const finalType = order.delivery_type != null ? parseInt(String(order.delivery_type), 10)
        : dbOrder?.courier_delivery_type != null ? dbOrder.courier_delivery_type : defaultDeliveryType;

      // Build item_description: "Product (qty), Product (qty), ..."
      const itemDescription = buildItemDescription(
        (orderItems || []).map((i: any) => ({ product_name: i.product_name, quantity: i.quantity }))
      );

      // Sanitize phones — Steadfast strictly requires 11-digit BD format.
      const recipientPhone = normalizeBdPhone(order.phone);
      if (!recipientPhone) {
        const msg = `কাস্টমার ফোন নম্বর সঠিক BD ফরম্যাটে নেই (${order.phone || "খালি"}) — অর্ডার এডিট করে ঠিক করুন`;
        console.error("Entry blocked for", order.order_id, ":", msg);
        return new Response(JSON.stringify({ success: false, error: msg }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const altPhone = normalizeBdPhone(order.alt_phone);

      const payload: Record<string, any> = {
        invoice: getCourierInvoice(order, dbOrder),
        recipient_name: order.customer_name,
        recipient_phone: recipientPhone,
        recipient_address: order.address,
        cod_amount: (order.payment_method === "bkash" && order.payment_status === "paid") ? 0 : order.total_amount,
        note: finalNote,
        total_lot: finalLot,
        delivery_type: finalType,
      };
      if (itemDescription) payload.item_description = itemDescription;
      // Only attach alt phone if it normalized cleanly — invalid alt phone should never block entry.
      if (altPhone && altPhone !== recipientPhone) payload.alternative_phone = altPhone;

      console.log("Single payload:", JSON.stringify(payload, null, 2));

      const res = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Secret-Key": secretKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("Single response:", JSON.stringify(data, null, 2));

      // Only mark entry_done if we got a valid consignment_id AND tracking_code back
      const gotConsignment = data.status === 200 && data.consignment?.consignment_id && data.consignment?.tracking_code;

      if (gotConsignment) {
        const updateData: Record<string, unknown> = {
          is_courier_entered: true,
          consignment_id: String(data.consignment.consignment_id),
          tracking_code: String(data.consignment.tracking_code),
        };
        if (!defer_status_update) updateData.status = "entry_done";
        await adminClient.from("orders").update(updateData).eq("id", order.id);

        return new Response(JSON.stringify({ success: true, ...data }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Application-level failure — return 200 so the client always gets the readable reason.
      const friendly = formatCourierError(data);
      console.error("Entry failed for", order.order_id, ":", friendly, "Raw:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: friendly, raw: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_create") {
      // Get global courier note for bulk (lot=1 and type=0 are hardcoded)
      const { data: courierSettings2 } = await adminClient
        .from("app_settings")
        .select("value")
        .eq("key", "steadfast_courier_note")
        .maybeSingle();
      const defaultNote2 = courierSettings2?.value || "";
      const defaultTotalLot2 = 1;
      const defaultDeliveryType2 = 0;

      // Fetch per-order courier settings AND order items from DB for all orders
      const orderIds = orders.map((o: any) => o.id);
      const [{ data: dbOrders }, { data: allItems }] = await Promise.all([
        adminClient
          .from("orders")
          .select("id, customer_facing_id, courier_note, courier_total_lot, courier_delivery_type")
          .in("id", orderIds),
        adminClient
          .from("order_items")
          .select("order_id, product_name, quantity")
          .in("order_id", orderIds),
      ]);
      const dbMap: Record<string, any> = {};
      dbOrders?.forEach((o: any) => { dbMap[o.id] = o; });
      // Group items by order_id
      const itemsMap: Record<string, any[]> = {};
      allItems?.forEach((i: any) => {
        if (!itemsMap[i.order_id]) itemsMap[i.order_id] = [];
        itemsMap[i.order_id].push(i);
      });

      const bulkData = orders.map((order: any) => {
        const db = dbMap[order.id] || {};
        const items = itemsMap[order.id] || [];
        const itemDescription = buildItemDescription(items.map((i: any) => ({ product_name: i.product_name, quantity: i.quantity })));
        const item: Record<string, any> = {
          invoice: getCourierInvoice(order, db),
          recipient_name: order.customer_name,
          recipient_phone: order.phone,
          recipient_address: order.address,
          cod_amount: (order.payment_method === "bkash" && order.payment_status === "paid") ? 0 : order.total_amount,
          note: order.courier_note ?? db.courier_note ?? defaultNote2,
          total_lot: order.total_lot != null ? parseInt(String(order.total_lot), 10)
            : db.courier_total_lot != null ? db.courier_total_lot : defaultTotalLot2,
          delivery_type: order.delivery_type != null ? parseInt(String(order.delivery_type), 10)
            : db.courier_delivery_type != null ? db.courier_delivery_type : defaultDeliveryType2,
        };
        if (itemDescription) item.item_description = itemDescription;
        if (order.alt_phone) item.alternative_phone = order.alt_phone;
        return item;
      });

      console.log("Bulk payload:", JSON.stringify(bulkData, null, 2));

      const res = await fetch(`${STEADFAST_BASE_URL}/create_order/bulk-order`, {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Secret-Key": secretKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: JSON.stringify(bulkData) }),
      });

      const data = await res.json();
      console.log("Bulk response:", JSON.stringify(data, null, 2));

      // Process individual results — only mark successfully entered orders
      // Steadfast may return either a raw array OR { status, data: [...] }
      const resultsArr: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];

      if (res.ok && resultsArr.length > 0) {
        for (let i = 0; i < resultsArr.length; i++) {
          const result = resultsArr[i];
          const order = orders[i];
          if (!order) continue;

          const cid = result?.consignment?.consignment_id ?? result?.consignment_id;
          const tcode = result?.consignment?.tracking_code ?? result?.tracking_code;
          const ok = (result?.status === 200 || result?.status === "success") && cid && tcode;

          if (ok) {
            await adminClient.from("orders").update({
              is_courier_entered: true,
              status: "entry_done",
              consignment_id: String(cid),
              tracking_code: String(tcode),
            }).eq("id", order.id);
          }
        }
      }

      return new Response(JSON.stringify(data), {
        status: res.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch_return_requests") {
      try {
        // Fetch all pages of return requests from Steadfast API
        const allConsignmentIds: string[] = [];
        let currentPage = 1;
        let lastPage = 1;

        while (currentPage <= lastPage) {
          const url = `${STEADFAST_BASE_URL}/get_return_requests?page=${currentPage}`;
          const res = await fetch(url, {
            method: "GET",
            headers: {
              "Api-Key": apiKey,
              "Secret-Key": secretKey,
              "Content-Type": "application/json",
            },
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("get_return_requests API error:", res.status, errText);
            return new Response(JSON.stringify({ error: "Steadfast API error: " + res.status }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const apiData = await res.json();
          
          if (currentPage === 1) {
            console.log("get_return_requests response keys:", Object.keys(apiData));
            // Log meta for pagination info
            if (apiData?.meta) {
              console.log("Pagination meta:", JSON.stringify(apiData.meta));
              lastPage = apiData.meta.last_page || 1;
            }
            // Log first item structure for debugging
            if (apiData?.data?.length > 0) {
              console.log("First item keys:", Object.keys(apiData.data[0]));
              console.log("First item sample:", JSON.stringify(apiData.data[0]).substring(0, 300));
            } else {
              console.log("data array is empty. Full response:", JSON.stringify(apiData).substring(0, 500));
            }
          }

          const pageItems = Array.isArray(apiData) ? apiData : (apiData?.data || []);
          
          for (const item of pageItems) {
            const cid = String(item.consignment_id || item.id || "");
            if (cid && cid !== "undefined" && !allConsignmentIds.includes(cid)) {
              allConsignmentIds.push(cid);
            }
          }

          currentPage++;
          // Safety: max 10 pages
          if (currentPage > 10) break;
        }

        console.log(`Total return requests across ${lastPage} page(s): ${allConsignmentIds.length} consignment IDs`);

        if (!allConsignmentIds.length) {
          return new Response(JSON.stringify({
            updated: 0, total: 0, pages: lastPage,
            message: "কোনো নতুন রিটার্ন রিকোয়েস্ট পাওয়া যায়নি",
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Find matching orders in our database
        const SKIP_STATUSES = ["cancelled", "delivered", "rtn_received", "cancelled_approval_pending"];
        const { data: matchingOrders } = await adminClient
          .from("orders")
          .select("id, consignment_id, delivery_status, status")
          .eq("is_courier_entered", true)
          .eq("is_deleted", false)
          .in("consignment_id", allConsignmentIds);

        let updated = 0;
        for (const order of (matchingOrders || [])) {
          if (SKIP_STATUSES.includes(order.delivery_status || "") || SKIP_STATUSES.includes(order.status || "")) continue;
          await adminClient.from("orders").update({
            delivery_status: "cancelled_approval_pending",
            status: "cancelled_approval_pending",
          }).eq("id", order.id);
          updated++;
        }

        return new Response(JSON.stringify({
          updated,
          total: allConsignmentIds.length,
          matched: matchingOrders?.length || 0,
          pages: lastPage,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("fetch_return_requests error:", msg);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
