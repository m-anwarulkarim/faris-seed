// 🔒 DO_NOT_MODIFY: SMS gateway — billing-sensitive, Ecomah Services integration — full file locked. Modify only with explicit user permission.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sanitizeSmsText = (value: unknown) =>
  String(value || "").replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s{2,}/g, " ").trim();

// Carrier safety cap: messages with any non-ASCII (Bengali) char are sent as
// Unicode SMS where each part = 70 chars (67 if concatenated). The local BD
// route silently drops messages longer than ~2 parts even when the gateway
// returns success. Hard-cap Unicode messages at 134 chars (= 2 parts) and
// ASCII at 320 chars (= 2 parts) to guarantee delivery.
const capSmsLength = (text: string): string => {
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const limit = isUnicode ? 134 : 320;
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).trimEnd() + "…";
};

// Validate Bangladesh mobile number — strict 11-digit 01[3-9]XXXXXXXX format
// Strips +88/88 prefix, non-digits, then verifies pattern
const normalizeBdPhone = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return digits;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { action, api_key, number, message, reason: smsReason, sent_by_admin, log_id } = body;

    const writeSmsFailureError = async (messageText: string, context: Record<string, unknown>) => {
      const fingerprint = `sms_${String(context.reason || "manual")}_${String(context.phone || "unknown")}_${String(context.error || "failed")}`.slice(0, 64);
      const { error } = await supabase.from("error_logs").insert({
        message: messageText,
        error_type: "sms_delivery_failed",
        source_url: "edge:sms-api",
        severity: "critical",
        context,
        fingerprint,
      });
      if (error) console.error("Failed to log SMS error:", error);
    };

    const writeSmsLog = async (payload: Record<string, unknown>) => {
      if (typeof log_id === "string" && log_id) {
        const { error } = await supabase.from("sms_logs").update(payload).eq("id", log_id);
        if (error) console.error("Failed to update SMS log:", error);
        return;
      }
      const { error } = await supabase.from("sms_logs").insert(payload);
      if (error) console.error("Failed to log SMS:", error);
    };

    // ─── Save API Key ───
    if (action === "update_keys") {
      if (!api_key) {
        return new Response(JSON.stringify({ error: "API Key required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const now = new Date().toISOString();
      await supabase.from("app_settings").upsert(
        { key: "ecomah_api_key", value: api_key, updated_at: now },
        { onConflict: "key" }
      );
      // Clean up old SMS-specific keys
      for (const k of ["sms_api_key", "sms_sender_id", "sms_base_url", "sms_balance_endpoint", "sms_send_endpoint", "sms_number_param", "sms_message_param"]) {
        await supabase.from("app_settings").delete().eq("key", k);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Delete Keys ───
    if (action === "delete_keys") {
      await supabase.from("app_settings").delete().in("key", [
        "ecomah_api_key", "sms_api_key", "sms_sender_id", "sms_base_url",
        "sms_balance_endpoint", "sms_send_endpoint", "sms_number_param", "sms_message_param",
      ]);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: load E-COMAH API key
    const loadApiKey = async () => {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ecomah_api_key", "sms_api_key"]);
      return settings?.find((s: any) => s.key === "ecomah_api_key")?.value
        || settings?.find((s: any) => s.key === "sms_api_key")?.value
        || null;
    };

    // ─── Check Balance ───
    if (action === "check_balance") {
      const ecomahKey = await loadApiKey();
      if (!ecomahKey) {
        return new Response(JSON.stringify({ error: "API key not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch("https://api.ecomah.com/manage-external-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_balance", api_key: ecomahKey }),
      });
      const text = await res.text();
      let balanceData;
      try { balanceData = JSON.parse(text); } catch { balanceData = { raw: text }; }

      return new Response(JSON.stringify({ success: true, balance: balanceData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Send SMS ───
    if (action === "send_sms") {
      const ecomahKey = await loadApiKey();
      if (!ecomahKey) {
        await writeSmsLog({
          phone: normalizeBdPhone(number) || String(number || "").slice(0, 32),
          message: sanitizeSmsText(String(message || "")).slice(0, 200),
          reason: smsReason || "manual",
          result: { error: "sms_api_not_configured" },
          status: "failed",
          sent_by_admin: sent_by_admin || null,
        });
        await writeSmsFailureError("SMS failed: API not configured", {
          reason: smsReason || "manual",
          phone: normalizeBdPhone(number) || String(number || "").slice(0, 32),
          error: "sms_api_not_configured",
          log_id: log_id || null,
        });
        return new Response(JSON.stringify({ error: "SMS API not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!number || !message) {
        return new Response(JSON.stringify({ error: "Number and message required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── Validate phone number (BD format) ───
      const validPhone = normalizeBdPhone(number);
      if (!validPhone) {
        // Log the rejection so we can audit invalid attempts
        await writeSmsLog({
          phone: String(number).slice(0, 32),
          message: sanitizeSmsText(message).slice(0, 200),
          reason: smsReason || "manual",
          result: { error: "invalid_phone", input: String(number).slice(0, 32) },
          status: "failed",
          sent_by_admin: sent_by_admin || null,
        });
        await writeSmsFailureError("SMS failed: invalid phone", {
          reason: smsReason || "manual",
          phone: String(number).slice(0, 32),
          error: "invalid_phone",
          log_id: log_id || null,
        });
        return new Response(JSON.stringify({
          success: false,
          error: "অবৈধ ফোন নম্বর। সঠিক BD নম্বর দিন (01XXXXXXXXX)।",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const safeMessage = capSmsLength(sanitizeSmsText(message));
      if (!safeMessage) {
        await writeSmsLog({
          phone: normalizeBdPhone(number) || String(number || "").slice(0, 32),
          message: "",
          reason: smsReason || "manual",
          result: { error: "empty_message" },
          status: "failed",
          sent_by_admin: sent_by_admin || null,
        });
        await writeSmsFailureError("SMS failed: empty message", {
          reason: smsReason || "manual",
          phone: normalizeBdPhone(number) || String(number || "").slice(0, 32),
          error: "empty_message",
          log_id: log_id || null,
        });
        return new Response(JSON.stringify({
          success: false,
          error: "মেসেজ খালি।",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (safeMessage.length < sanitizeSmsText(message).length) {
        console.warn(`[sms-api] Message truncated to ${safeMessage.length} chars to fit single carrier route`);
      }

      let res: Response;
      try {
        res = await fetch("https://api.ecomah.com/sms-api", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ecomahKey,
          },
          body: JSON.stringify({ action: "send_sms", number: validPhone, message: safeMessage }),
        });
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        await writeSmsLog({
          phone: validPhone,
          message: safeMessage,
          reason: smsReason || "manual",
          result: { error: "gateway_request_failed", details: errorMessage },
          status: "failed",
          sent_by_admin: sent_by_admin || null,
        });
        await writeSmsFailureError("SMS gateway request failed", {
          reason: smsReason || "manual",
          phone: validPhone,
          error: "gateway_request_failed",
          details: errorMessage,
          log_id: log_id || null,
        });
        return new Response(JSON.stringify({ success: false, error: "SMS gateway request failed" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const text = await res.text();
      let smsResult;
      try { smsResult = JSON.parse(text); } catch { smsResult = { raw: text }; }

      const isSuccess = res.ok && smsResult?.success === true;

      // Log SMS
      await writeSmsLog({
        phone: validPhone,
        message: safeMessage,
        reason: smsReason || "manual",
        result: {
          ...(typeof smsResult === "object" && smsResult !== null ? smsResult : { raw: smsResult }),
          http_status: res.status,
          truncated: safeMessage.length < sanitizeSmsText(message).length,
          original_length: sanitizeSmsText(message).length,
          sent_length: safeMessage.length,
        },
        status: isSuccess ? "sent" : "failed",
        sent_by_admin: sent_by_admin || null,
      });
      if (!isSuccess) {
        await writeSmsFailureError("SMS provider rejected send", {
          reason: smsReason || "manual",
          phone: validPhone,
          error: smsResult?.error || smsResult?.message || smsResult?.msg || `http_${res.status}`,
          http_status: res.status,
          provider_result: smsResult,
          log_id: log_id || null,
        });
      }

      return new Response(JSON.stringify({ success: isSuccess, result: smsResult?.result || smsResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
