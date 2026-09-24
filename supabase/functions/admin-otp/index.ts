// 🔒 DO_NOT_MODIFY: Admin OTP issuance & verification — full file locked. Modify only with explicit user permission.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OTP_MAX_SEND = 3;
const OTP_MAX_VERIFY = 3;
const LOCKOUT_MINUTES = 15;

async function getAttemptCount(supabase: ReturnType<typeof createClient>, identifier: string): Promise<number> {
  const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_or_email", identifier)
    .gte("attempted_at", cutoff);
  return count || 0;
}

async function recordAttempt(supabase: ReturnType<typeof createClient>, identifier: string) {
  await supabase.from("login_attempts").insert({ ip_or_email: identifier });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Validate Bangladesh mobile number — strict 11-digit 01[3-9]XXXXXXXX format
function normalizeBdPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  if (!/^01[3-9]\d{8}$/.test(digits)) return null;
  return digits;
}

async function sendSms(supabase: ReturnType<typeof createClient>, phoneInput: string, message: string) {
  const phone = normalizeBdPhone(phoneInput);
  if (!phone) {
    return { success: false, error: "invalid_phone" };
  }

  const { data: apiKeySetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "ecomah_api_key")
    .maybeSingle();

  const ecomahKey = apiKeySetting?.value;
  if (!ecomahKey) return null;

  const res = await fetch("https://api.ecomah.com/sms-api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ecomahKey,
    },
    body: JSON.stringify({ action: "send_sms", number: phone, message }),
  });

  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function isBlocked(supabase: ReturnType<typeof createClient>, deviceFp?: string, ip?: string): Promise<{ blocked: boolean; reason?: string }> {
  const conditions: string[] = [];
  if (deviceFp) conditions.push(`and(block_type.eq.device,block_value.eq.${deviceFp})`);
  if (ip) conditions.push(`and(block_type.eq.ip,block_value.eq.${ip})`);
  if (conditions.length === 0) return { blocked: false };

  const { data } = await supabase
    .from("blocked_devices")
    .select("block_type, block_value, reason")
    .or(conditions.join(","));

  if (data && data.length > 0) {
    return { blocked: true, reason: data[0].reason || "Blocked by admin" };
  }
  return { blocked: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { action, phone, otp_code, device_fingerprint, device_name, device_type, ip_address, user_agent, user_id, session_id, block_type, block_value, reason } = await req.json();

    // ─── Check if device is trusted (skip OTP) ───
    if (action === "check_device") {
      if (!phone || !device_fingerprint) return json({ error: "Phone and device fingerprint required" }, 400);

      // Check blocked
      const blockCheck = await isBlocked(supabase, device_fingerprint);
      if (blockCheck.blocked) return json({ trusted: false, authorized: false, blocked: true, reason: blockCheck.reason });

      const { data: mapping } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", `admin_phone_${phone}`)
        .maybeSingle();

      if (!mapping) return json({ trusted: false, authorized: false });

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      const adminUserIds = roles?.map((r: any) => r.user_id) || [];

      if (adminUserIds.length === 0) return json({ trusted: false, authorized: true });

      const { data: session } = await supabase
        .from("admin_sessions")
        .select("*")
        .eq("device_fingerprint", device_fingerprint)
        .eq("is_active", true)
        .in("user_id", adminUserIds)
        .maybeSingle();

      return json({ trusted: !!session, authorized: true, session_user_id: session?.user_id || null });
    }

    // ─── Generate & Send OTP (max 3 sends) ───
    if (action === "generate") {
      if (!phone) return json({ error: "Phone number required" }, 400);

      const genKey = `admin_otp_gen_${phone}`;
      const attempts = await getAttemptCount(supabase, genKey);
      const remaining = Math.max(0, OTP_MAX_SEND - attempts);

      if (attempts >= OTP_MAX_SEND) {
        return json({ error: `Too many attempts. Try again after ${LOCKOUT_MINUTES} minutes.`, remaining: 0, locked: true }, 429);
      }

      const { data: mapping } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", `admin_phone_${phone}`)
        .maybeSingle();

      if (!mapping) {
        await recordAttempt(supabase, genKey);
        return json({ error: "Unauthorized phone number", remaining: remaining - 1 }, 403);
      }

      await recordAttempt(supabase, genKey);

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabase.from("admin_otps").delete().eq("phone", phone);

      const { error: insertError } = await supabase
        .from("admin_otps")
        .insert({ phone, otp_code: otp, expires_at: expiresAt });
      if (insertError) throw insertError;

      const message = `Your admin login OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;
      const smsResult = await sendSms(supabase, phone, message);

      if (!smsResult) return json({ error: "SMS API not configured" }, 500);

      // Log OTP SMS
      await supabase.from("sms_logs").insert({
        phone, message, reason: "otp", status: "sent", result: smsResult,
      }).then(({ error: logErr }) => { if (logErr) console.error("OTP SMS log error:", logErr); });

      return json({ success: true, remaining: remaining - 1, sms_result: smsResult });
    }

    // ─── Verify OTP (max 3 tries) ───
    if (action === "verify") {
      if (!phone || !otp_code) return json({ error: "Phone and OTP required" }, 400);

      const verifyKey = `admin_otp_verify_${phone}`;
      const attempts = await getAttemptCount(supabase, verifyKey);
      const remaining = Math.max(0, OTP_MAX_VERIFY - attempts);

      if (attempts >= OTP_MAX_VERIFY) {
        return json({ error: `Too many failed attempts. Try again after ${LOCKOUT_MINUTES} minutes.`, valid: false, remaining: 0, locked: true }, 429);
      }

      const { data: otpRecord } = await supabase
        .from("admin_otps")
        .select("*")
        .eq("phone", phone)
        .eq("otp_code", otp_code)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!otpRecord) {
        await recordAttempt(supabase, verifyKey);
        const newRemaining = remaining - 1;
        return json({ 
          error: "Invalid or expired OTP", 
          valid: false, 
          remaining: newRemaining,
          last_attempt: newRemaining === 0,
        }, 400);
      }

      await supabase.from("admin_otps").update({ verified: true }).eq("id", otpRecord.id);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      const adminUserIds = roles?.map((r: any) => r.user_id) || [];

      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const allUsers = usersData?.users || [];

      const adminEmails = allUsers
        .filter((u: any) => adminUserIds.includes(u.id))
        .map((u: any) => u.email)
        .filter(Boolean);

      return json({ valid: true, emails: adminEmails });
    }

    // ─── Register trusted device & send login notification ───
    if (action === "register_device") {
      if (!user_id || !device_fingerprint) {
        return json({ error: "user_id and device_fingerprint required" }, 400);
      }

      // Check blocked before registering
      const blockCheck = await isBlocked(supabase, device_fingerprint, ip_address);
      if (blockCheck.blocked) return json({ error: "Device or IP is blocked", blocked: true }, 403);

      await supabase.from("admin_sessions").upsert(
        {
          user_id,
          device_fingerprint,
          device_name: device_name || "Unknown Device",
          device_type: device_type || "unknown",
          ip_address: ip_address || null,
          user_agent: user_agent || null,
          is_active: true,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_fingerprint" }
      );

      const SUPER_ADMIN_PHONE = "01708356800";
      
      const { data: userData } = await supabase.auth.admin.getUserById(user_id);
      const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email?.split("@")[0] || "Unknown";

      const now = new Date();
      const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      const dateStr = bdTime.toISOString().replace("T", " ").slice(0, 16);

      const notifyMsg = `[Admin Login] ${userName} ${device_type || "unknown"} ডিভাইসে লগইন করেছে। IP: ${ip_address || "N/A"}, সময়: ${dateStr} BST`;
      const loginSmsResult = await sendSms(supabase, SUPER_ADMIN_PHONE, notifyMsg);

      // Log login notification SMS
      await supabase.from("sms_logs").insert({
        phone: SUPER_ADMIN_PHONE, message: notifyMsg, reason: "otp", status: "sent", result: loginSmsResult,
      }).then(({ error: logErr }) => { if (logErr) console.error("Login SMS log error:", logErr); });

      return json({ success: true });
    }

    // ─── Trusted login: return admin emails without OTP ───
    if (action === "trusted_login") {
      if (!phone || !device_fingerprint) return json({ error: "Phone and device required" }, 400);

      // Check blocked
      const blockCheck = await isBlocked(supabase, device_fingerprint);
      if (blockCheck.blocked) return json({ error: "Device is blocked", emails: [], blocked: true }, 403);

      const { data: mapping } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", `admin_phone_${phone}`)
        .maybeSingle();
      if (!mapping) return json({ error: "Unauthorized phone number" }, 403);

      const { data: roles } = await supabase.from("user_roles").select("user_id");
      const adminUserIds = roles?.map((r: any) => r.user_id) || [];

      const { data: session } = await supabase
        .from("admin_sessions")
        .select("*")
        .eq("device_fingerprint", device_fingerprint)
        .eq("is_active", true)
        .in("user_id", adminUserIds)
        .maybeSingle();

      if (!session) return json({ error: "Device not trusted", emails: [] }, 403);

      const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const allUsers = usersData?.users || [];
      const adminEmails = allUsers
        .filter((u: any) => adminUserIds.includes(u.id))
        .map((u: any) => u.email)
        .filter(Boolean);

      return json({ emails: adminEmails });
    }

    // ─── Deactivate session (remote logout) ───
    if (action === "deactivate_session") {
      if (!session_id) return json({ error: "session_id required" }, 400);

      await supabase.from("admin_sessions")
        .update({ is_active: false })
        .eq("id", session_id);

      return json({ success: true });
    }

    // ─── List active sessions ───
    if (action === "list_sessions") {
      const { data: sessions } = await supabase
        .from("admin_sessions")
        .select("*")
        .eq("is_active", true)
        .order("last_active_at", { ascending: false });

      return json({ sessions: sessions || [] });
    }

    // ─── Block device or IP ───
    if (action === "block_device") {
      if (!block_type || !block_value) return json({ error: "block_type and block_value required" }, 400);
      if (!["device", "ip"].includes(block_type)) return json({ error: "block_type must be 'device' or 'ip'" }, 400);

      const { error } = await supabase.from("blocked_devices").upsert(
        { block_type, block_value, reason: reason || null, blocked_at: new Date().toISOString() },
        { onConflict: "block_type,block_value" }
      );
      if (error) throw error;

      // If blocking a device fingerprint, also deactivate its sessions
      if (block_type === "device") {
        await supabase.from("admin_sessions").update({ is_active: false }).eq("device_fingerprint", block_value);
      }
      // If blocking an IP, deactivate sessions from that IP
      if (block_type === "ip") {
        await supabase.from("admin_sessions").update({ is_active: false }).eq("ip_address", block_value);
      }

      return json({ success: true });
    }

    // ─── Unblock device or IP ───
    if (action === "unblock_device") {
      if (!block_type || !block_value) return json({ error: "block_type and block_value required" }, 400);

      await supabase.from("blocked_devices")
        .delete()
        .eq("block_type", block_type)
        .eq("block_value", block_value);

      return json({ success: true });
    }

    // ─── List blocked devices/IPs ───
    if (action === "list_blocked") {
      const { data } = await supabase
        .from("blocked_devices")
        .select("*")
        .order("blocked_at", { ascending: false });

      return json({ blocked: data || [] });
    }

    // ─── Check device trust by user_id (for email-based login) ───
    if (action === "check_device_by_user") {
      if (!user_id || !device_fingerprint) return json({ error: "user_id and device_fingerprint required" }, 400);

      const blockCheck = await isBlocked(supabase, device_fingerprint);
      if (blockCheck.blocked) return json({ trusted: false, blocked: true, reason: blockCheck.reason });

      const { data: session } = await supabase
        .from("admin_sessions")
        .select("*")
        .eq("user_id", user_id)
        .eq("device_fingerprint", device_fingerprint)
        .eq("is_active", true)
        .maybeSingle();

      if (session) return json({ trusted: true });

      // Not trusted - find admin phone from app_settings
      const { data: phoneMappings } = await supabase
        .from("app_settings")
        .select("key")
        .like("key", "admin_phone_%");

      if (!phoneMappings || phoneMappings.length === 0) {
        return json({ trusted: false, error: "No admin phone configured", otp_sent: false });
      }

      const adminPhone = phoneMappings[0].key.replace("admin_phone_", "");

      // Rate limit check
      const genKey = `admin_otp_gen_${adminPhone}`;
      const attempts = await getAttemptCount(supabase, genKey);
      const remaining = Math.max(0, OTP_MAX_SEND - attempts);

      if (attempts >= OTP_MAX_SEND) {
        return json({ trusted: false, otp_sent: false, locked: true, remaining: 0, error: `Too many attempts. Try again after ${LOCKOUT_MINUTES} minutes.` });
      }

      await recordAttempt(supabase, genKey);

      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      await supabase.from("admin_otps").delete().eq("phone", adminPhone);
      await supabase.from("admin_otps").insert({ phone: adminPhone, otp_code: otp, expires_at: expiresAt });

      const message = `Your admin login OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;
      const smsResult = await sendSms(supabase, adminPhone, message);

      // Log OTP SMS
      if (smsResult) {
        await supabase.from("sms_logs").insert({
          phone: adminPhone, message, reason: "otp", status: "sent", result: smsResult,
        }).then(({ error: logErr }) => { if (logErr) console.error("OTP SMS log error:", logErr); });
      }

      const phoneHint = adminPhone.slice(0, 3) + "***" + adminPhone.slice(-3);

      return json({
        trusted: false,
        otp_sent: !!smsResult,
        phone_hint: phoneHint,
        remaining: remaining - 1,
      });
    }

    // ─── Verify OTP by user_id (for email-based login) ───
    if (action === "verify_by_user") {
      if (!user_id || !otp_code) return json({ error: "user_id and otp_code required" }, 400);

      // Find admin phone
      const { data: phoneMappings } = await supabase
        .from("app_settings")
        .select("key")
        .like("key", "admin_phone_%");

      const adminPhone = phoneMappings?.[0]?.key?.replace("admin_phone_", "");
      if (!adminPhone) return json({ error: "No admin phone found", valid: false }, 400);

      const verifyKey = `admin_otp_verify_${adminPhone}`;
      const attempts = await getAttemptCount(supabase, verifyKey);
      const remaining = Math.max(0, OTP_MAX_VERIFY - attempts);

      if (attempts >= OTP_MAX_VERIFY) {
        return json({ error: `Too many failed attempts. Try again after ${LOCKOUT_MINUTES} minutes.`, valid: false, remaining: 0, locked: true }, 429);
      }

      const { data: otpRecord } = await supabase
        .from("admin_otps")
        .select("*")
        .eq("phone", adminPhone)
        .eq("otp_code", otp_code)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!otpRecord) {
        await recordAttempt(supabase, verifyKey);
        const newRemaining = remaining - 1;
        return json({
          error: "Invalid or expired OTP",
          valid: false,
          remaining: newRemaining,
          last_attempt: newRemaining === 0,
        }, 400);
      }

      await supabase.from("admin_otps").update({ verified: true }).eq("id", otpRecord.id);

      return json({ valid: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
