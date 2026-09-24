// Stock-Out SMS Alert
// Runs on cron. Finds products that just hit 0 stock and have not been alerted yet,
// sends ONE consolidated SMS to the admin number, then marks them so we don't re-alert.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PHONE = "01708356800";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Owner alert toggle
    const { data: enabled } = await supabase.rpc("owner_alert_enabled", { _category: "stock_out" });
    if (enabled === false) {
      return new Response(JSON.stringify({ success: true, alerted: 0, message: "Owner disabled stock_out alerts" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: pending, error } = await supabase.rpc("get_stock_out_pending_products");
    if (error) throw error;

    // Only alert for products that have NOT had an SMS sent yet
    const fresh = (pending || []).filter((p: any) => !p.alert_sent_at);

    if (fresh.length === 0) {
      return new Response(
        JSON.stringify({ success: true, alerted: 0, message: "No new stock-out products" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build short Bengali message (must fit single Unicode SMS = 70 chars).
    // Long product-name lists previously caused multi-part SMS to silently fail
    // at the carrier even though the gateway returned success.
    const names = fresh.map((p: any) => p.product_name).filter(Boolean);
    const total = fresh.length;
    // Reserve room for prefix + count + suffix; show only first 1-2 names.
    const baseSuffix = ` (${total}টি পণ্য)। Admin panel এ approve করুন।`;
    const prefix = "স্টক শেষ: ";
    const budget = 70 - prefix.length - baseSuffix.length;
    let preview = "";
    for (let i = 0; i < names.length; i++) {
      const next = preview ? `${preview}, ${names[i]}` : names[i];
      if (next.length > budget) break;
      preview = next;
    }
    if (!preview) preview = (names[0] || "").slice(0, Math.max(0, budget - 1)) + "…";
    const message = `${prefix}${preview}${baseSuffix}`;

    // Send via existing sms-api function
    const { data: smsResult, error: smsError } = await supabase.functions.invoke("sms-api", {
      body: {
        action: "send_sms",
        number: ADMIN_PHONE,
        message,
        reason: "low_stock_alert",
      },
    });

    if (smsError) {
      return new Response(
        JSON.stringify({ success: false, error: smsError.message, sms_result: smsResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (smsResult?.success !== true) {
      return new Response(
        JSON.stringify({ success: false, error: "SMS send failed", sms_result: smsResult }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark these products as alerted so duplicates aren't sent
    const ids = fresh.map((p: any) => p.product_id);
    await supabase
      .from("products")
      .update({ stock_out_alert_sent_at: new Date().toISOString() })
      .in("id", ids);

    return new Response(
      JSON.stringify({ success: true, alerted: fresh.length, products: names }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
