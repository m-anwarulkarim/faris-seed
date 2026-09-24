import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get webhook token from DB
    const { data: tokenRow } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "steadfast_webhook_token")
      .single();

    const WEBHOOK_TOKEN = tokenRow?.value;

    if (!WEBHOOK_TOKEN) {
      return new Response(JSON.stringify({ error: "Webhook token not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${WEBHOOK_TOKEN}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { invoice, status, consignment_id, tracking_code } = body;

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Missing invoice" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔒 DO_NOT_MODIFY_START — Courier → DB status mapping
    const courierStatusMap: Record<string, string> = {
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
    const resolvedStatus = courierStatusMap[status] || status;

    const updateData: Record<string, any> = {
      delivery_status: resolvedStatus,
      status: resolvedStatus,
    };

    if (consignment_id) updateData.consignment_id = String(consignment_id);
    if (tracking_code) updateData.tracking_code = String(tracking_code);
    // 🔒 DO_NOT_MODIFY_END

    // Courier stores invoice as lowercase (ab...), DB has uppercase (AB...)
    const normalizedInvoice = typeof invoice === "string" ? invoice.toUpperCase() : invoice;
    const { error } = await adminClient
      .from("orders")
      .update(updateData)
      .eq("order_id", normalizedInvoice);

    if (error) {
      console.error("DB update error:", error);
      return new Response(JSON.stringify({ error: "Failed to update order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
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
