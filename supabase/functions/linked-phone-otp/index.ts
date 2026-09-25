// Send OTP for linking a new phone to a profile.
// Reuses admin_otps table. Rate-limit cooldown 60s, daily 5 sends.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
};

const COOLDOWN_SECONDS = 60;
const MAX_PER_DAY = 5;

function normalizeBdPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { session_token, phone } = await req.json();
    if (!session_token) return json({ error: "missing_session" }, 400);

    const norm = normalizeBdPhone(phone);
    if (!norm) return json({ error: "invalid_phone" }, 400);

    // Validate session
    const { data: profile } = await supabase
      .from("visitor_profiles")
      .select("id, phone, alt_phone")
      .eq("session_token", session_token)
      .maybeSingle();
    if (!profile) return json({ error: "invalid_session" }, 401);

    if (profile.phone === norm || profile.alt_phone === norm) {
      return json({ error: "already_your_number" }, 400);
    }

    // Already linked anywhere?
    const { data: linked } = await supabase
      .from("visitor_linked_phones")
      .select("id")
      .eq("phone", norm)
      .maybeSingle();
    if (linked) return json({ error: "phone_already_linked" }, 400);

    // Cooldown
    const { data: lastOtp } = await supabase
      .from("admin_otps")
      .select("created_at")
      .eq("phone", norm)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastOtp) {
      const elapsed = (Date.now() - new Date(lastOtp.created_at).getTime()) / 1000;
      if (elapsed < COOLDOWN_SECONDS) {
        return json({ error: "cooldown", cooldown: Math.ceil(COOLDOWN_SECONDS - elapsed) }, 429);
      }
    }

    // Daily limit
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from("admin_otps")
      .select("*", { count: "exact", head: true })
      .eq("phone", norm)
      .gte("created_at", since);
    if ((count || 0) >= MAX_PER_DAY) {
      return json({ error: "daily_limit" }, 429);
    }

    // Generate & insert OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from("admin_otps").insert({ phone: norm, otp_code: code, verified: false });

    // Send SMS via existing sms-api function
    const message = `আপনার Faris Seed verification কোড: ${code}`;
    try {
      await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/sms-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
        body: JSON.stringify({
          action: "send_sms",
          number: norm,
          message,
          reason: "linked_phone_otp",
          sent_by_admin: "system",
        }),
        },
      );
    } catch (e) {
      console.error("sms-api call failed", e);
    }

    return json({ success: true, remaining: MAX_PER_DAY - (count || 0) - 1 });
  } catch (e) {
    console.error("linked-phone-otp error", e);
    return json({ error: "server_error" }, 500);
  }
});
