// Temporary edge function — sends leaderboard SMS in batches
// Calls ECOMAH API directly (avoids Edge-to-Edge function rate limit)
// Logs to sms_logs for audit & duplicate detection
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient { phone: string; name: string; }

const capSmsLength = (text: string): string => {
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const limit = isUnicode ? 134 : 320;
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + "…";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { recipients, template, batch_label, concurrency, delay_ms } = await req.json() as {
      recipients: Recipient[]; template: string; batch_label?: string;
      concurrency?: number; delay_ms?: number;
    };

    if (!Array.isArray(recipients) || recipients.length === 0 || !template) {
      return new Response(JSON.stringify({ error: "recipients[] and template required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: keyRow } = await sb.from("app_settings").select("value").eq("key", "ecomah_api_key").maybeSingle();
    const ecomahKey = (keyRow as any)?.value;
    if (!ecomahKey) {
      return new Response(JSON.stringify({ error: "ecomah_api_key not configured in app_settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0, failed = 0;
    const failures: { phone: string; name: string; error: string }[] = [];
    const t0 = Date.now();
    const CONCURRENCY = Math.max(1, Math.min(16, concurrency ?? 8));
    const DELAY_MS = Math.max(0, Math.min(5000, delay_ms ?? 0));
    const reasonTag = `leaderboard_invite${batch_label ? ":" + batch_label : ""}`;

    const sendOne = async (r: Recipient) => {
      const msg = capSmsLength(template.replace(/\{\{\s*name\s*\}\}/g, r.name || "প্রিয় গ্রাহক"));
      let ok = false; let errMsg = "";
      try {
        const resp = await fetch("https://api.ecomah.com/sms-api", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ecomahKey },
          body: JSON.stringify({ action: "send_sms", number: r.phone, message: msg }),
        });
        const data: any = await resp.json().catch(() => ({}));
        ok = resp.ok && data?.success === true;
        if (!ok) errMsg = data?.error || data?.message || `http_${resp.status}`;
      } catch (e: any) {
        errMsg = e?.message || "exception";
      }

      // Log to sms_logs (don't await — fire and forget for speed, but in worker)
      sb.from("sms_logs").insert({
        phone: r.phone,
        message: msg,
        reason: reasonTag,
        status: ok ? "sent" : "failed",
        result: ok ? { success: true } : { error: errMsg },
      }).then(() => {});

      if (ok) sent++;
      else { failed++; if (failures.length < 30) failures.push({ phone: r.phone, name: r.name, error: errMsg }); }
    };

    for (let i = 0; i < recipients.length; i += CONCURRENCY) {
      const slice = recipients.slice(i, i + CONCURRENCY);
      await Promise.all(slice.map(sendOne));
      if (DELAY_MS > 0 && i + CONCURRENCY < recipients.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: recipients.length,
      sent, failed,
      failures,
      duration_sec: Math.round((Date.now() - t0) / 1000),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
