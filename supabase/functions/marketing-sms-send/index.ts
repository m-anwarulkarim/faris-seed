import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  phone: string;
  name?: string | null;
  order_id?: string | null;
  amount?: number | null;
}

const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const renderTemplate = (tpl: string, vars: Record<string, any>) =>
  tpl.replace(VAR_RE, (_, k) => (vars[k] === undefined || vars[k] === null ? "" : String(vars[k])));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { campaign_id, recipients, message_body } = body as {
      campaign_id: string;
      recipients: Recipient[];
      message_body: string;
    };

    if (!campaign_id || !Array.isArray(recipients) || !message_body) {
      return new Response(JSON.stringify({ error: "campaign_id, recipients[], message_body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Mark campaign as running
    await sb.from("marketing_campaigns").update({
      status: "running",
      total_recipients: recipients.length,
    }).eq("id", campaign_id);

    let sent = 0, failed = 0, totalCost = 0;
    const sendsLog: any[] = [];

    // SMS segment calculation helper (GSM-7 vs Unicode)
    const GSM_RE = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\\\[\]~|€]*$/;
    const calcSegments = (text: string) => {
      const isGsm = GSM_RE.test(text);
      const len = text.length;
      if (isGsm) return len <= 160 ? 1 : Math.ceil(len / 153);
      return len <= 70 ? 1 : Math.ceil(len / 67);
    };

    // Fetch SMS rate from app_settings
    const { data: rateRow } = await sb.from("app_settings").select("value").eq("key", "sms_rate_unicode").maybeSingle();
    const ratePerSeg = Number((rateRow as any)?.value) || 0.45;

    for (const r of recipients) {
      const personalized = renderTemplate(message_body, {
        name: r.name || "কাস্টমার",
        phone: r.phone,
        order_id: r.order_id || "",
        amount: r.amount || "",
      });
      const segs = calcSegments(personalized);
      const cost = segs * ratePerSeg;

      try {
        const res = await sb.functions.invoke("sms-api", {
          body: {
            action: "send_sms",
            number: r.phone,
            message: personalized,
            reason: `marketing:${campaign_id.slice(0, 8)}`,
          },
        });
        const ok = !res.error && (res.data as any)?.success;
        if (ok) { sent++; totalCost += cost; } else { failed++; }
        sendsLog.push({
          campaign_id,
          channel: "sms",
          recipient: r.phone,
          recipient_name: r.name || null,
          message_body: personalized,
          segments: segs,
          cost: ok ? cost : 0,
          status: ok ? "sent" : "failed",
          error_message: ok ? null : ((res.data as any)?.error || res.error?.message || "unknown"),
          provider_response: res.data || null,
          sent_at: ok ? new Date().toISOString() : null,
        });
      } catch (e: any) {
        failed++;
        sendsLog.push({
          campaign_id,
          channel: "sms",
          recipient: r.phone,
          recipient_name: r.name || null,
          message_body: personalized,
          segments: segs,
          cost: 0,
          status: "failed",
          error_message: e?.message || "exception",
          provider_response: null,
        });
      }

      // small throttle (50ms) — safety against gateway overload
      await new Promise((r) => setTimeout(r, 50));
    }

    // Bulk insert sends log
    if (sendsLog.length > 0) {
      // chunk inserts in 500
      for (let i = 0; i < sendsLog.length; i += 500) {
        await sb.from("marketing_sends").insert(sendsLog.slice(i, i + 500));
      }
    }

    await sb.from("marketing_campaigns").update({
      status: failed === recipients.length ? "failed" : "sent",
      total_sent: sent,
      total_failed: failed,
      total_cost: totalCost,
      sent_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({ success: true, sent, failed, total: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
