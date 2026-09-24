// Pathao Merchant API integration — mirrors Steadfast flow.
// Supports: update_keys, update_settings, test_connection, create_order.
// Credentials & default city/zone/area come from app_settings (dashboard editable).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ITEM_DESC = 500;
const DEFAULT_BASE_URL = "https://api-hermes.pathao.com"; // production
const SANDBOX_BASE_URL = "https://courier-api-sandbox.pathao.com";

function normalizeBdPhone(raw: any): string {
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

function getCourierInvoice(order: any, dbOrder?: any): string {
  return String(order.customer_facing_id || dbOrder?.customer_facing_id || order.order_id || "").toLowerCase();
}

function buildItemDescription(items: { product_name: string; quantity: number }[]): string {
  if (!items.length) return "Parcel";
  const full = items.map((i) => `${i.product_name}(${i.quantity})`).join(", ");
  if (full.length <= MAX_ITEM_DESC) return full;
  return full.substring(0, MAX_ITEM_DESC - 3) + "...";
}

function totalQuantity(items: { quantity: number }[]): number {
  return items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || 1;
}

function normalizeRecipientAddress(raw: any, dbOrder?: any): string {
  const primary = String(raw || "").trim();
  if (primary.length >= 10) return primary;
  const fallback = [dbOrder?.thana, dbOrder?.district].filter(Boolean).join(", ").trim();
  return fallback.length > primary.length ? fallback : primary;
}

function formatPathaoError(data: any): string {
  if (!data) return "Pathao থেকে কোনো রেসপন্স পাওয়া যায়নি";
  if (typeof data === "string") return data;
  // Pathao usually returns: { type, message, code, errors: { field: ["..."] } }
  const errs = data.errors;
  if (errs && typeof errs === "object") {
    const parts: string[] = [];
    for (const [field, msgs] of Object.entries(errs)) {
      const msg = Array.isArray(msgs) ? msgs.join(", ") : String(msgs);
      parts.push(`${field}: ${msg}`);
    }
    if (parts.length) return parts.join(" • ");
  }
  return String(data.message || "Pathao এন্ট্রি ব্যর্থ");
}

function withPathaoAuthHint(message: string, baseUrl: string): string {
  if (!/credentials were incorrect|invalid credentials|unauthorized/i.test(message)) return message;
  const mode = baseUrl.includes("sandbox") ? "Sandbox" : "Production";
  const other = baseUrl.includes("sandbox") ? "Production" : "Sandbox";
  return `${message} — এখন ${mode} base URL সেট আছে। ${other} credential হলে base URL বদলান, আর ${mode} হলে Client ID/Secret/Username/Password আবার কপি করুন।`;
}

async function loadSettings(adminClient: any): Promise<Record<string, string>> {
  const { data } = await adminClient
    .from("app_settings")
    .select("key, value")
    .like("key", "pathao_%");
  const map: Record<string, string> = {};
  data?.forEach((r: any) => { map[r.key] = r.value; });
  return map;
}

async function getAccessToken(settings: Record<string, string>, adminClient: any): Promise<{ token: string; baseUrl: string; storeId: string }> {
  const baseUrl = settings["pathao_base_url"] || DEFAULT_BASE_URL;
  const storeId = settings["pathao_store_id"] || "";
  const cachedToken = settings["pathao_access_token"] || "";
  const cachedExpiry = parseInt(settings["pathao_token_expiry"] || "0", 10);

  // Reuse cached token if still valid (>2 min remaining)
  if (cachedToken && cachedExpiry && (cachedExpiry - Date.now()) > 120_000) {
    return { token: cachedToken, baseUrl, storeId };
  }

  const client_id = settings["pathao_client_id"];
  const client_secret = settings["pathao_client_secret"];
  const username = settings["pathao_username"];
  const password = settings["pathao_password"];
  if (!client_id || !client_secret || !username || !password) {
    throw new Error("Pathao credentials সম্পূর্ণ না — Dashboard → API Management থেকে কনফিগার করুন");
  }

  const res = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      client_id, client_secret, username, password,
      grant_type: "password",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(`Pathao টোকেন আনা যায়নি: ${withPathaoAuthHint(formatPathaoError(data) || res.statusText, baseUrl)}`);
  }

  const expiresIn = Number(data.expires_in || 18000) * 1000; // ms
  const newExpiry = Date.now() + expiresIn;
  // Cache token & expiry
  await adminClient.from("app_settings").upsert([
    { key: "pathao_access_token", value: String(data.access_token) },
    { key: "pathao_refresh_token", value: String(data.refresh_token || "") },
    { key: "pathao_token_expiry", value: String(newExpiry) },
  ], { onConflict: "key" });

  return { token: String(data.access_token), baseUrl, storeId };
}

// 🔒 Pathao courier status → DB status mapping
// Pathao returns order_status values like "Delivered", "Returned", "On_Hold" etc.
const PATHAO_STATUS_MAP: Record<string, string> = {
  Pickup_Requested: "entry_done",
  Assigned_for_Pickup: "entry_done",
  Picked: "on_the_way",
  Pickup_Failed: "hold",
  Pickup_Cancelled: "cancelled_approval_pending",
  At_the_Sorting_HUB: "on_the_way",
  In_Transit: "on_the_way",
  Received_at_Last_Mile_Hub: "on_the_way",
  Assigned_for_Delivery: "on_the_way",
  Delivered: "delivered",
  Partial_Delivery: "partial_delivered_approval_pending",
  Returned: "return",
  Return: "return",
  Delivery_Failed: "hold",
  On_Hold: "hold",
  Payment_Invoice: "delivered_approval_pending",
  Exchanged: "delivered",
};

function mapPathaoStatus(raw: any): string | null {
  if (!raw) return null;
  const key = String(raw).trim().replace(/\s+/g, "_").toLowerCase();
  for (const [k, v] of Object.entries(PATHAO_STATUS_MAP)) {
    if (k.toLowerCase() === key) return v;
  }
  return null;
}

async function fetchPathaoOrderInfo(baseUrl: string, accessToken: string, consignmentId: string): Promise<any | null> {
  const res = await fetch(`${baseUrl}/aladdin/api/v1/orders/${consignmentId}/info`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) { await res.text().catch(() => ""); return null; }
  const data = await res.json().catch(() => null);
  return data?.data || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    // sync_statuses / check_single_status can be called without user auth (cron / internal)
    if (action === "sync_statuses" || action === "check_single_status") {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const settings = await loadSettings(adminClient);
      let accessToken: string;
      let baseUrl: string;
      try {
        const tk = await getAccessToken(settings, adminClient);
        accessToken = tk.token;
        baseUrl = tk.baseUrl;
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || "Pathao auth failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "check_single_status") {
        const { order_id, consignment_id } = body;
        if (!order_id || !consignment_id) {
          return new Response(JSON.stringify({ error: "order_id and consignment_id required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const info = await fetchPathaoOrderInfo(baseUrl, accessToken, String(consignment_id));
        const mapped = mapPathaoStatus(info?.order_status);
        if (!info || !mapped) {
          return new Response(JSON.stringify({ updated: false, raw_status: info?.order_status || null }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await adminClient.from("orders").update({
          status: mapped, delivery_status: mapped,
        }).eq("id", order_id);
        return new Response(JSON.stringify({ updated: true, status: mapped, raw_status: info.order_status }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // bulk sync
      const SYNC_STATUSES = [
        "entry_done", "in_review", "shipped", "picked",
        "on_the_way", "hold", "pending",
        "unknown_approval_pending", "delivered_approval_pending",
        "partial_delivered_approval_pending",
      ];
      const batchLimit = body.limit || 100;
      const { data: entryOrders } = await adminClient
        .from("orders")
        .select("id, order_id, consignment_id, status, delivery_status")
        .eq("courier_provider", "pathao")
        .in("status", SYNC_STATUSES)
        .eq("is_courier_entered", true)
        .eq("is_deleted", false)
        .not("consignment_id", "is", null)
        .order("updated_at", { ascending: true })
        .limit(batchLimit);

      if (!entryOrders || entryOrders.length === 0) {
        return new Response(JSON.stringify({ synced: 0, message: "No Pathao orders to sync" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let updated = 0;
      const BATCH_SIZE = 5;
      for (let i = 0; i < entryOrders.length; i += BATCH_SIZE) {
        const batch = entryOrders.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(async (order: any) => {
          const info = await fetchPathaoOrderInfo(baseUrl, accessToken, String(order.consignment_id));
          const mapped = mapPathaoStatus(info?.order_status);
          if (!mapped) return null;
          if (mapped === order.status && mapped === order.delivery_status) return null;
          await adminClient.from("orders").update({
            status: mapped, delivery_status: mapped,
          }).eq("id", order.id);
          return "updated";
        }));
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "update_settings") {
      // Generic key/value upsert for all pathao_* settings sent in payload.settings
      const settings: Record<string, string> = body.settings || {};
      const rows = Object.entries(settings).map(([key, value]) => ({
        key: `pathao_${key.replace(/^pathao_/, "")}`,
        value: String(value ?? ""),
      }));
      // Invalidate cached token if creds changed
      const credKeys = ["pathao_client_id", "pathao_client_secret", "pathao_username", "pathao_password", "pathao_base_url"];
      if (rows.some((r) => credKeys.includes(r.key))) {
        rows.push({ key: "pathao_access_token", value: "" }, { key: "pathao_token_expiry", value: "0" });
      }
      if (rows.length) {
        await adminClient.from("app_settings").upsert(rows, { onConflict: "key" });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_connection") {
      const settings = await loadSettings(adminClient);
      try {
        const { token: t, baseUrl, storeId } = await getAccessToken(settings, adminClient);
        // Try fetching stores to verify
        const res = await fetch(`${baseUrl}/aladdin/api/v1/stores`, {
          headers: { Authorization: `Bearer ${t}`, "Accept": "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify({
          success: res.ok,
          stores: data?.data?.data || [],
          configured_store_id: storeId,
          message: res.ok ? "Pathao কানেকশন সফল" : formatPathaoError(data),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: err?.message || "কানেকশন ব্যর্থ" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "create_order") {
      const settings = await loadSettings(adminClient);
      const { token: accessToken, baseUrl, storeId } = await getAccessToken(settings, adminClient);
      if (!storeId) {
        return new Response(JSON.stringify({ success: false, error: "Pathao store_id সেট করা নেই — API Management → Pathao সেটিংসে যান" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const order = body.orders?.[0];
      if (!order?.id) {
        return new Response(JSON.stringify({ success: false, error: "order missing" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: dbOrder }, { data: orderItems }] = await Promise.all([
        adminClient
          .from("orders")
          .select("customer_facing_id, courier_note, district, thana")
          .eq("id", order.id)
          .single(),
        adminClient
          .from("order_items")
          .select("product_name, quantity")
          .eq("order_id", order.id),
      ]);

      const recipientPhone = normalizeBdPhone(order.phone);
      if (!recipientPhone) {
        return new Response(JSON.stringify({ success: false, error: `কাস্টমার ফোন নম্বর সঠিক BD ফরম্যাটে নেই (${order.phone || "খালি"})` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const items = (orderItems || []).map((i: any) => ({ product_name: i.product_name, quantity: i.quantity }));
      const itemDescription = buildItemDescription(items);
      const itemQty = totalQuantity(items);

      const itemWeight = parseFloat(settings["pathao_default_item_weight"] || "0.5");
      const deliveryType = parseInt(settings["pathao_default_delivery_type"] || "48", 10); // 48=normal, 12=on-demand
      const itemType = parseInt(settings["pathao_default_item_type"] || "2", 10); // 1=document, 2=parcel
      const finalNote = order.courier_note ?? dbOrder?.courier_note ?? settings["pathao_default_note"] ?? "";

      // Optional overrides — only sent if admin explicitly set them.
      // Per Pathao docs, recipient_city/zone/area auto-populate from recipient_address when omitted.
      const cityOverride = settings["pathao_default_city_id"] ? parseInt(settings["pathao_default_city_id"], 10) : null;
      const zoneOverride = settings["pathao_default_zone_id"] ? parseInt(settings["pathao_default_zone_id"], 10) : null;
      const areaOverride = settings["pathao_default_area_id"] ? parseInt(settings["pathao_default_area_id"], 10) : null;

      const recipientAddress = normalizeRecipientAddress(order.address, dbOrder);
      if (recipientAddress.length < 10) {
        return new Response(JSON.stringify({ success: false, error: `Pathao address কমপক্ষে ১০ অক্ষর হতে হবে — এখন আছে: "${recipientAddress || "খালি"}"` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload: Record<string, any> = {
        store_id: parseInt(storeId, 10),
        merchant_order_id: getCourierInvoice(order, dbOrder),
        recipient_name: order.customer_name,
        recipient_phone: recipientPhone,
        recipient_address: recipientAddress,
        delivery_type: deliveryType,
        item_type: itemType,
        special_instruction: finalNote,
        item_quantity: itemQty,
        item_weight: itemWeight,
        item_description: itemDescription,
        amount_to_collect: Math.round(Number(order.total_amount) || 0),
      };
      if (cityOverride && zoneOverride) payload.recipient_city = cityOverride;
      if (zoneOverride) payload.recipient_zone = zoneOverride;
      if (areaOverride) payload.recipient_area = areaOverride;

      console.log("Pathao payload:", JSON.stringify(payload));

      const res = await fetch(`${baseUrl}/aladdin/api/v1/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      console.log("Pathao response:", JSON.stringify(data));

      const consignment = data?.data?.consignment_id || data?.data?.order_id;
      const merchantOrderId = data?.data?.merchant_order_id;

      if (res.ok && consignment) {
        const updateData: Record<string, unknown> = {
          is_courier_entered: true,
          consignment_id: String(consignment),
          tracking_code: String(consignment),
          courier_provider: "pathao",
        };
        if (!body.defer_status_update) updateData.status = "entry_done";
        await adminClient.from("orders").update(updateData).eq("id", order.id);
        return new Response(JSON.stringify({ success: true, consignment_id: consignment, merchant_order_id: merchantOrderId, raw: data }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const friendly = formatPathaoError(data);
      console.error("Pathao entry failed:", friendly, "Raw:", JSON.stringify(data));
      return new Response(JSON.stringify({ success: false, error: friendly, raw: data }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Pathao function error:", err);
    const message = err?.message || "Internal error";
    const isPathaoConfigError = /Pathao টোকেন|credentials|store_id|কনফিগার/i.test(message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: isPathaoConfigError ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
