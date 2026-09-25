// 🔒 DO_NOT_MODIFY: Customer authentication: OTP, session tokens, password verify — full file locked. Modify only with explicit user permission.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token, x-visitor-fingerprint, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

const OTP_MAX_SEND_PER_DAY = 5;
const OTP_COOLDOWN_SECONDS = 300; // 5 minutes between sends
const OTP_MAX_VERIFY = 3;
const PWD_MAX_ATTEMPTS = 5;
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

async function sha256Hash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function bcryptHash(password: string): Promise<string> {
  const { hashSync } = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  return hashSync(password);
}

async function bcryptCompare(password: string, hash: string): Promise<boolean> {
  const { compareSync } = await import("https://deno.land/x/bcrypt@v0.4.1/mod.ts");
  return compareSync(password, hash);
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function issueSessionToken(supabase: ReturnType<typeof createClient>, profileId: string): Promise<string> {
  const token = generateSessionToken();
  await supabase
    .from("visitor_profiles")
    .update({ session_token: token, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  return token;
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

async function sendOtpSms(supabase: ReturnType<typeof createClient>, phoneInput: string, rateLimitKey: string): Promise<{ success: boolean; error?: string; remaining?: number; locked?: boolean; cooldown?: number }> {
  const phone = normalizeBdPhone(phoneInput);
  if (!phone) {
    return { success: false, error: "অবৈধ ফোন নম্বর। সঠিক BD নম্বর দিন (01XXXXXXXXX)।" };
  }
  // 5-minute cooldown between OTP sends
  const { data: lastOtp } = await supabase
    .from("admin_otps")
    .select("created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOtp) {
    const elapsed = (Date.now() - new Date(lastOtp.created_at).getTime()) / 1000;
    if (elapsed < OTP_COOLDOWN_SECONDS) {
      const wait = Math.ceil(OTP_COOLDOWN_SECONDS - elapsed);
      const mins = Math.floor(wait / 60);
      const secs = wait % 60;
      const timeStr = mins > 0 ? `${mins} মিনিট ${secs} সেকেন্ড` : `${secs} সেকেন্ড`;
      return { success: false, error: `${timeStr} পর আবার চেষ্টা করুন।`, cooldown: wait };
    }
  }

  // Daily limit: max 5 OTP sends per phone per day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: dailyCount } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .eq("phone", phone)
    .eq("reason", "otp")
    .gte("created_at", todayStart.toISOString());

  const dailySent = dailyCount || 0;
  const remaining = Math.max(0, OTP_MAX_SEND_PER_DAY - dailySent);

  if (dailySent >= OTP_MAX_SEND_PER_DAY) {
    return { success: false, error: `আজকের জন্য OTP সীমা শেষ। আগামীকাল আবার চেষ্টা করুন।`, remaining: 0, locked: true };
  }

  const otp = String(Math.floor(1000 + Math.random() * 9000));

  // Delete all previous OTPs for this phone (new OTP invalidates old ones)
  await supabase.from("admin_otps").delete().eq("phone", phone);

  // Insert new OTP without expiry (set far-future expires_at for schema compatibility)
  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const { error: insertErr } = await supabase
    .from("admin_otps")
    .insert({ phone, otp_code: otp, expires_at: farFuture });
  if (insertErr) throw insertErr;

  const { data: apiKeySetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "ecomah_api_key")
    .maybeSingle();

  const ecomahKey = apiKeySetting?.value;
  if (!ecomahKey) {
    return { success: false, error: "SMS API not configured" };
  }

  const message = `Your Faris Seed OTP is: ${otp}`;

  const res = await fetch("https://api.ecomah.com/sms-api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ecomahKey,
    },
    body: JSON.stringify({ action: "send_sms", number: phone, message }),
  });

  const text = await res.text();
  let smsResult: any;
  try { smsResult = JSON.parse(text); } catch { smsResult = { raw: text }; }

  const isSuccess = res.ok && smsResult?.success === true;

  // Log OTP SMS
  await supabase.from("sms_logs").insert({
    phone, message, reason: "otp", status: isSuccess ? "sent" : "failed", result: smsResult,
  }).then(({ error: logErr }) => { if (logErr) console.error("Customer OTP SMS log error:", logErr); });

  if (!isSuccess) {
    console.error("SMS send failed:", smsResult);
    return { success: false, error: "SMS পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।" };
  }

  return { success: true, remaining: remaining - 1 };
}

async function verifyOtp(supabase: ReturnType<typeof createClient>, phone: string, otp_code: string): Promise<{ valid: boolean; error?: string; remaining?: number; locked?: boolean; last_attempt?: boolean }> {
  const verifyKey = `cust_otp_verify_${phone}`;
  const attempts = await getAttemptCount(supabase, verifyKey);
  const remaining = Math.max(0, OTP_MAX_VERIFY - attempts);

  if (attempts >= OTP_MAX_VERIFY) {
    return { valid: false, error: `অনেকবার ভুল হয়েছে। ${LOCKOUT_MINUTES} মিনিট পর আবার চেষ্টা করুন অথবা কাস্টমার সাপোর্টে যোগাযোগ করুন।`, remaining: 0, locked: true };
  }

  // Find matching unverified OTP (no expiry check — OTP never expires, only invalidated by new OTP)
  const { data: otpRecord } = await supabase
    .from("admin_otps")
    .select("*")
    .eq("phone", phone)
    .eq("otp_code", otp_code)
    .eq("verified", false)
    .maybeSingle();

  if (!otpRecord) {
    // Check if OTP was already verified (double-submit case)
    const { data: alreadyVerified } = await supabase
      .from("admin_otps")
      .select("id, verified")
      .eq("phone", phone)
      .eq("otp_code", otp_code)
      .eq("verified", true)
      .maybeSingle();

    if (alreadyVerified) {
      // OTP was correct but already used — treat as success (idempotent)
      return { valid: true };
    }

    await recordAttempt(supabase, verifyKey);
    const newRemaining = remaining - 1;
    return { 
      valid: false, 
      error: "OTP ভুল হয়েছে", 
      remaining: newRemaining,
      last_attempt: newRemaining === 0,
    };
  }

  await supabase.from("admin_otps").update({ verified: true }).eq("id", otpRecord.id);
  return { valid: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // CRITICAL: Always return HTTP 200 with structured JSON.
  // supabase.functions.invoke() treats non-2xx as a network/Functions error
  // and nullifies `data`, which surfaces to users as the misleading
  // "সার্ভারের সাথে সংযোগে সমস্যা" toast even when the real cause is
  // a logical error like cooldown / wrong OTP / SMS provider failure.
  // The original `status` is echoed back in the body as `_status` for debugging.
  const json = (data: any, status = 200) =>
    new Response(
      JSON.stringify(status === 200 ? data : { ...data, _status: status }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );

  try {
    const body = await req.json();
    const { action } = body;

    // ─── Check if phone has password ───
    if (action === "check_phone") {
      const { phone } = body;
      if (!phone) return json({ error: "Phone required" }, 400);

      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("id, password_hash, name")
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!profile) {
        return json({ exists: false, has_password: false });
      }

      return json({
        exists: true,
        has_password: !!profile.password_hash,
        name: profile.name,
      });
    }

    // ─── Send OTP (max 3 sends) ───
    if (action === "send_otp") {
      const { phone } = body;
      if (!phone) return json({ error: "Phone required" }, 400);

      const result = await sendOtpSms(supabase, phone, `cust_otp_${phone}`);
      if (!result.success) {
        return json({ error: result.error, remaining: result.remaining, locked: result.locked }, result.locked ? 429 : 500);
      }
      return json({ success: true, remaining: result.remaining });
    }

    // ─── Verify OTP & Login (max 3 tries) ───
    if (action === "verify_otp") {
      const { phone, otp_code } = body;
      if (!phone || !otp_code) return json({ error: "Phone and OTP required" }, 400);

      const otpResult = await verifyOtp(supabase, phone, otp_code);
      if (!otpResult.valid) {
        return json({ 
          error: otpResult.error, 
          valid: false, 
          remaining: otpResult.remaining, 
          locked: otpResult.locked,
          last_attempt: otpResult.last_attempt,
        }, otpResult.locked ? 429 : 400);
      }

      await supabase.from("visitor_profiles").update({
        phone_verified: true,
        updated_at: new Date().toISOString(),
      }).eq("phone", phone.trim());

      let { data: profile } = await supabase
        .from("visitor_profiles")
        .select("*")
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (profile?.shadow_moderated) {
        return json({ error: "এই অ্যাকাউন্টটি নীতিমালা লঙ্ঘনের কারণে বন্ধ করা হয়েছে", valid: false, banned: true }, 403);
      }

      if (!profile) {
        const visitorId = body.visitor_id;
        if (visitorId) {
          const { data: newProfile, error: createErr } = await supabase
            .from("visitor_profiles")
            .insert({ phone, visitor_id: visitorId })
            .select()
            .single();
          if (!createErr) profile = newProfile;
        }
      }

      const sessionToken = profile ? await issueSessionToken(supabase, profile.id) : null;
      return json({ valid: true, profile, session_token: sessionToken });
    }

    // ─── Password Login ───
    if (action === "password_login") {
      const { phone, password } = body;
      if (!phone || !password) return json({ error: "Phone and password required" }, 400);

      const loginKey = `cust_pwd_${phone}`;
      const attempts = await getAttemptCount(supabase, loginKey);
      const remaining = Math.max(0, PWD_MAX_ATTEMPTS - attempts);

      if (attempts >= PWD_MAX_ATTEMPTS) {
        return json({ error: `অনেকবার ভুল হয়েছে। ${LOCKOUT_MINUTES} মিনিট পর আবার চেষ্টা করুন।`, valid: false, remaining: 0, locked: true }, 429);
      }

      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("*")
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (profile?.shadow_moderated) {
        return json({ error: "এই অ্যাকাউন্টটি নীতিমালা লঙ্ঘনের কারণে বন্ধ করা হয়েছে", valid: false, banned: true }, 403);
      }

      if (!profile || !profile.password_hash) {
        await recordAttempt(supabase, loginKey);
        return json({ error: "Invalid credentials", valid: false, remaining: remaining - 1 }, 401);
      }

      let passwordValid = false;
      const storedHash = profile.password_hash;

      try {
        if (storedHash.startsWith("$2")) {
          passwordValid = await bcryptCompare(password, storedHash);
        } else {
          const sha256 = await sha256Hash(password);
          if (sha256 === storedHash) {
            passwordValid = true;
            try {
              const newHash = await bcryptHash(password);
              await supabase
                .from("visitor_profiles")
                .update({ password_hash: newHash, updated_at: new Date().toISOString() })
                .eq("id", profile.id);
            } catch (migErr) {
              console.error("bcrypt migration failed:", migErr);
            }
          }
        }
      } catch (bcryptErr) {
        console.error("bcrypt compare error:", bcryptErr);
        const sha256 = await sha256Hash(password);
        if (sha256 === storedHash) {
          passwordValid = true;
        }
      }

      if (!passwordValid) {
        await recordAttempt(supabase, loginKey);
        return json({ error: "Wrong password", valid: false, remaining: remaining - 1 }, 401);
      }

      await supabase.from("visitor_profiles").update({
        phone_verified: true,
        updated_at: new Date().toISOString(),
      }).eq("id", profile.id);

      const { password_hash: _, session_token: _st, ...safeProfile } = profile;
      const sessionToken = await issueSessionToken(supabase, profile.id);
      return json({ valid: true, profile: safeProfile, session_token: sessionToken });
    }

    // ─── Set Password ───
    if (action === "set_password") {
      const { phone, password, profile_id } = body;
      if (!phone || !password || !profile_id) {
        return json({ error: "Phone, password, and profile_id required" }, 400);
      }
      if (password.length < 6) {
        return json({ error: "Password must be at least 6 characters" }, 400);
      }

      const hash = await bcryptHash(password);
      const { error } = await supabase
        .from("visitor_profiles")
        .update({ password_hash: hash, updated_at: new Date().toISOString() })
        .eq("id", profile_id)
        .eq("phone", phone);

      if (error) throw error;
      const sessionToken = await issueSessionToken(supabase, profile_id);
      return json({ success: true, session_token: sessionToken });
    }

    // ─── Change Password (requires old password) ───
    if (action === "change_password") {
      const { profile_id, phone, old_password, new_password, session_token } = body;
      if (!profile_id || !phone || !old_password || !new_password) {
        return json({ error: "All fields required" }, 400);
      }
      // Verify session token
      if (session_token) {
        const { data: tokenCheck } = await supabase
          .from("visitor_profiles")
          .select("id")
          .eq("id", profile_id)
          .eq("session_token", session_token)
          .maybeSingle();
        if (!tokenCheck) return json({ error: "Invalid session" }, 401);
      }
      if (new_password.length < 6) {
        return json({ error: "Password must be at least 6 characters" }, 400);
      }

      const loginKey = `cust_chgpwd_${phone}`;
      const attempts = await getAttemptCount(supabase, loginKey);
      if (attempts >= PWD_MAX_ATTEMPTS) {
        return json({ error: `অনেকবার ভুল হয়েছে। ${LOCKOUT_MINUTES} মিনিট পর আবার চেষ্টা করুন।`, locked: true }, 429);
      }

      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("id, password_hash")
        .eq("id", profile_id)
        .eq("phone", phone)
        .maybeSingle();

      if (!profile || !profile.password_hash) {
        return json({ error: "Profile not found or no password set" }, 404);
      }

      let oldValid = false;
      try {
        if (profile.password_hash.startsWith("$2")) {
          oldValid = await bcryptCompare(old_password, profile.password_hash);
        } else {
          const sha = await sha256Hash(old_password);
          oldValid = sha === profile.password_hash;
        }
      } catch {
        const sha = await sha256Hash(old_password);
        oldValid = sha === profile.password_hash;
      }

      if (!oldValid) {
        await recordAttempt(supabase, loginKey);
        return json({ error: "বর্তমান পাসওয়ার্ড ভুল হয়েছে", valid: false }, 401);
      }

      const hash = await bcryptHash(new_password);
      const { error } = await supabase
        .from("visitor_profiles")
        .update({ password_hash: hash, updated_at: new Date().toISOString() })
        .eq("id", profile_id);

      if (error) throw error;
      return json({ success: true });
    }

    // ─── Verify Password (no session rotation, no DB write) ───
    if (action === "verify_password") {
      const { profile_id, password, session_token } = body;
      if (!profile_id || !password) {
        return json({ error: "profile_id and password required" }, 400);
      }
      if (session_token) {
        const { data: tokenCheck } = await supabase
          .from("visitor_profiles")
          .select("id")
          .eq("id", profile_id)
          .eq("session_token", session_token)
          .maybeSingle();
        if (!tokenCheck) return json({ error: "Invalid session", valid: false }, 401);
      }

      const verifyKey = `cust_verify_${profile_id}`;
      const attempts = await getAttemptCount(supabase, verifyKey);
      if (attempts >= PWD_MAX_ATTEMPTS) {
        return json({ error: `অনেকবার ভুল হয়েছে। ${LOCKOUT_MINUTES} মিনিট পর আবার চেষ্টা করুন।`, valid: false, locked: true }, 429);
      }

      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("id, password_hash")
        .eq("id", profile_id)
        .maybeSingle();

      if (!profile || !profile.password_hash) {
        return json({ error: "Profile or password not set", valid: false }, 404);
      }

      let valid = false;
      try {
        if (profile.password_hash.startsWith("$2")) {
          valid = await bcryptCompare(password, profile.password_hash);
        } else {
          const sha = await sha256Hash(password);
          valid = sha === profile.password_hash;
        }
      } catch {
        const sha = await sha256Hash(password);
        valid = sha === profile.password_hash;
      }

      if (!valid) {
        await recordAttempt(supabase, verifyKey);
        return json({ error: "পাসওয়ার্ড ভুল হয়েছে", valid: false }, 401);
      }

      return json({ valid: true, success: true });
    }

    if (action === "reset_password_send_otp") {
      const { phone } = body;
      if (!phone) return json({ error: "Phone required" }, 400);


      const { data: profile } = await supabase
        .from("visitor_profiles")
        .select("id, password_hash")
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!profile || !profile.password_hash) {
        return json({ error: "No account with password found for this number" }, 404);
      }

      const result = await sendOtpSms(supabase, phone, `cust_reset_otp_${phone}`);
      if (!result.success) {
        return json({ error: result.error, remaining: result.remaining, locked: result.locked }, result.locked ? 429 : 500);
      }
      return json({ success: true, profile_id: profile.id, remaining: result.remaining });
    }

    // ─── Verify OTP & Reset Password ───
    if (action === "reset_password_verify") {
      const { phone, otp_code, new_password } = body;
      if (!phone || !otp_code || !new_password) {
        return json({ error: "Phone, OTP, and new password required" }, 400);
      }
      if (new_password.length < 6) {
        return json({ error: "Password must be at least 6 characters" }, 400);
      }

      const otpResult = await verifyOtp(supabase, phone, otp_code);
      if (!otpResult.valid) {
        return json({ error: otpResult.error, valid: false, remaining: otpResult.remaining, locked: otpResult.locked, last_attempt: otpResult.last_attempt }, otpResult.locked ? 429 : 400);
      }

      const hash = await bcryptHash(new_password);
      const { error } = await supabase
        .from("visitor_profiles")
        .update({ password_hash: hash, phone_verified: true, updated_at: new Date().toISOString() })
        .eq("phone", phone);

      if (error) throw error;
      return json({ valid: true, success: true });
    }

    // ─── Get My Orders ───
    if (action === "get_orders") {
      const { phone, profile_id, session_token } = body;
      
      if (!profile_id && !phone) return json({ error: "Phone or profile_id required" }, 400);

      // Verify session token if profile_id provided with token; otherwise fall back to phone-only public view
      let _verifiedProfileId: string | null = null;
      if (profile_id && session_token) {
        const { data: tokenCheck } = await supabase
          .from("visitor_profiles")
          .select("id")
          .eq("id", profile_id)
          .eq("session_token", session_token)
          .maybeSingle();
        if (!tokenCheck) return json({ error: "Invalid session" }, 401);
        _verifiedProfileId = profile_id;
      }

      let profilePhone = normalizeBdPhone(phone) || (typeof phone === "string" ? phone.trim() : null);
      let _publicProfileId: string | null = null;
      const requestedProfileId = typeof profile_id === "string" ? profile_id : null;

      if (_verifiedProfileId || requestedProfileId) {
        const targetProfileId = _verifiedProfileId || requestedProfileId!;
        const { data: prof } = await supabase
          .from("visitor_profiles")
          .select("id, phone")
          .eq("id", targetProfileId)
          .maybeSingle();
        if (prof?.id) {
          if (_verifiedProfileId) _verifiedProfileId = prof.id;
          else _publicProfileId = prof.id;
          if (!profilePhone) profilePhone = prof.phone || null;
        }
      } else if (profilePhone) {
        const { data: profs } = await supabase
          .from("visitor_profiles")
          .select("id, phone")
          .or(`phone.eq.${profilePhone},alt_phone.eq.${profilePhone}`)
          .order("created_at", { ascending: true })
          .limit(1);
        if (profs?.[0]?.id) _publicProfileId = profs[0].id;
      }

      const effectiveProfileId = _verifiedProfileId || _publicProfileId;
      const confirmedStatuses = ["confirmed", "printed", "entry_done", "shipped", "on_the_way", "delivered", "partial", "partial_delivered", "pending_return", "return", "rtn_received", "missing", "cancelled_approval_pending"];

      let profileOrders: any[] = [];
      if (effectiveProfileId) {
        let profileQuery = supabase
          .from("orders")
          .select("id, order_id, status, total_amount, created_at, updated_at, customer_name, address, delivery_status, pre_date, tracking_code")
          .eq("visitor_profile_id", effectiveProfileId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!_verifiedProfileId) profileQuery = profileQuery.in("status", confirmedStatuses);
        const { data } = await profileQuery;
        profileOrders = data || [];
      }

      // Collect all phones tied to this profile: main + linked
      const phonesToMatch: string[] = [];
      if (profilePhone) phonesToMatch.push(profilePhone);
      if (effectiveProfileId) {
        const { data: linked } = await supabase
          .from("visitor_linked_phones")
          .select("phone")
          .eq("visitor_profile_id", effectiveProfileId);
        for (const l of linked || []) {
          if (l.phone && !phonesToMatch.includes(l.phone)) phonesToMatch.push(l.phone);
        }
      }

      let phoneOrders: any[] = [];
      if (phonesToMatch.length > 0) {
        const { data } = await supabase
          .from("orders")
          .select("id, order_id, status, total_amount, created_at, updated_at, customer_name, address, delivery_status, pre_date, tracking_code")
          .in("phone", phonesToMatch)
          .eq("is_deleted", false)
          .in("status", confirmedStatuses)
          .order("created_at", { ascending: false })
          .limit(50);
        phoneOrders = data || [];
      }

      const seenIds = new Set(profileOrders.map((o: any) => o.id));
      const merged = [...profileOrders];
      for (const o of phoneOrders) {
        if (!seenIds.has(o.id)) {
          merged.push(o);
          seenIds.add(o.id);
        }
      }
      merged.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return json({ orders: merged.slice(0, 50) });
    }

    // ─── Link order to profile ───
    if (action === "link_order_profile") {
      const { order_id, profile_id } = body;
      if (!order_id || !profile_id) return json({ error: "order_id and profile_id required" }, 400);

      const { error } = await supabase
        .from("orders")
        .update({ visitor_profile_id: profile_id })
        .eq("id", order_id)
        .is("visitor_profile_id", null);

      if (error) throw error;
      return json({ success: true });
    }

    // ─── Create account without OTP (disabled) ───
    if (action === "create_account_no_otp") {
      return json({
        error: "নিরাপত্তার জন্য OTP ছাড়া নতুন অ্যাকাউন্ট তৈরি বন্ধ করা হয়েছে। অনুগ্রহ করে ফোন নম্বর দিয়ে OTP verify করে লগইন করুন।",
        otp_required: true,
      }, 403);
    }

    // ─── Get Order Invoice Data ───
    if (action === "get_order_invoice") {
      const { order_id, profile_id, phone, session_token } = body;
      if (!order_id) return json({ error: "order_id required" }, 400);

      // Verify session token if profile_id provided
      if (profile_id && session_token) {
        const { data: tokenCheck } = await supabase
          .from("visitor_profiles")
          .select("id")
          .eq("id", profile_id)
          .eq("session_token", session_token)
          .maybeSingle();
        if (!tokenCheck) return json({ error: "Invalid session" }, 401);
      }
      if (!order_id) return json({ error: "order_id required" }, 400);

      // Fetch order
      const { data: order } = await supabase
        .from("orders")
        .select("id, order_id, customer_name, phone, alt_phone, address, note, total_amount, discount, advance, delivery_charge, created_at, updated_at, visitor_profile_id, status, tracking_code, pre_date")
        .eq("id", order_id)
        .eq("is_deleted", false)
        .maybeSingle();

      if (!order) return json({ error: "Order not found" }, 404);

      // Verify ownership
      const isOwner = (profile_id && order.visitor_profile_id === profile_id) || (phone && order.phone === phone);
      if (!isOwner) return json({ error: "Unauthorized" }, 403);

      // Fetch order items
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, product_image, quantity, unit_price")
        .eq("order_id", order_id);

      // Fetch short_description for each product
      const enrichedItems = [];
      for (const item of (items || [])) {
        enrichedItems.push({
          product_name: item.product_name,
          product_image: item.product_image,
          quantity: item.quantity,
          unit_price: item.unit_price,
          short_description: null,
        });
      }

      return json({ order, items: enrichedItems });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("customer-auth error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Return 200 with structured error so the client gets `data.error`
    // instead of an opaque FunctionsHttpError that nullifies `data`.
    return new Response(
      JSON.stringify({ success: false, valid: false, error: "সার্ভারে সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।", _internal: msg, _status: 500 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
