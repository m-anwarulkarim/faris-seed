import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEADFAST_LOGIN_URL = "https://steadfast.com.bd/login";
const STEADFAST_CHECK_URL = "https://steadfast.com.bd/user/frauds/check";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory session cache (persists across warm invocations)
let cachedSession: { cookies: string; expiry: number } | null = null;

type SessionFailureReason = "not_configured" | "blocked" | "login_failed";
type SessionResult =
  | { ok: true; cookies: string; source: "memory" | "database" | "database_stale" | "fresh_login" }
  | { ok: false; reason: SessionFailureReason; message: string; status?: number };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildUserAgentHeaders(extra: Record<string, string> = {}) {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ...extra,
  };
}

function getSetCookies(response: Response): string[] {
  const cookies = response.headers.getSetCookie?.() || [];
  return cookies.map((cookie: string) => cookie.split(";")[0]).filter(Boolean);
}

function mergeCookies(...cookieSources: Array<string | string[] | null | undefined>) {
  const cookieMap: Record<string, string> = {};

  for (const source of cookieSources) {
    const entries = Array.isArray(source)
      ? source
      : typeof source === "string"
        ? source.split(/;\s*/g)
        : [];

    for (const entry of entries) {
      const trimmed = entry?.trim();
      if (!trimmed) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!key?.trim()) continue;
      cookieMap[key.trim()] = rest.join("=");
    }
  }

  return Object.entries(cookieMap)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function isCloudflareChallenge(html: string) {
  return /just a moment|cloudflare|challenge-platform|cf-browser-verification/i.test(html);
}

function extractCsrfToken(html: string) {
  return html.match(/name="_token"\s+value="([^"]+)"/)?.[1]
    || html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/)?.[1]
    || null;
}

function cacheSession(cookies: string, expiry: number) {
  cachedSession = { cookies, expiry };
}

function invalidateSession() {
  cachedSession = null;
}

async function readSettingsMap(supabase: any, keys: string[]) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", keys);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(row.key, row.value);
  }
  return map;
}

async function upsertSetting(supabase: any, key: string, value: string) {
  return supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

async function persistSession(supabase: any, cookies: string, expiry: number) {
  const expiryIso = new Date(expiry).toISOString();
  const [sessionResult, expiryResult] = await Promise.all([
    upsertSetting(supabase, "steadfast_fraud_session", cookies),
    upsertSetting(supabase, "steadfast_fraud_session_expires_at", expiryIso),
  ]);

  if (sessionResult.error || expiryResult.error) {
    throw sessionResult.error || expiryResult.error;
  }
}

async function clearPersistedSession(supabase: any) {
  await supabase
    .from("app_settings")
    .delete()
    .in("key", ["steadfast_fraud_session", "steadfast_fraud_session_expires_at"]);
}

async function getStoredCredentials(supabase: any) {
  const settings = await readSettingsMap(supabase, ["steadfast_fraud_email", "steadfast_fraud_password"]);
  const email = settings.get("steadfast_fraud_email") || "";
  const password = settings.get("steadfast_fraud_password") || "";

  console.log("Credentials lookup:", { emailFound: !!email, passFound: !!password });

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

async function getPersistedSession(supabase: any): Promise<SessionResult | null> {
  const settings = await readSettingsMap(supabase, ["steadfast_fraud_session", "steadfast_fraud_session_expires_at"]);
  const cookies = settings.get("steadfast_fraud_session") || "";
  const expiryIso = settings.get("steadfast_fraud_session_expires_at") || "";

  if (!cookies) return null;

  const expiry = expiryIso ? new Date(expiryIso).getTime() : Number.NaN;
  if (Number.isFinite(expiry) && expiry > Date.now()) {
    console.log("Using persisted session, expires in", Math.round((expiry - Date.now()) / 1000), "seconds");
    cacheSession(cookies, expiry);
    return { ok: true, cookies, source: "database" };
  }

  console.log("Persisted session marked expired; trying stale cookies before forcing a new login");
  return { ok: true, cookies, source: "database_stale" };
}

async function loginWithCredentials(supabase: any, email: string, password: string): Promise<SessionResult> {
  try {
    console.log("Fetching Steadfast login page...");
    const loginPageRes = await fetch(STEADFAST_LOGIN_URL, {
      method: "GET",
      redirect: "manual",
      headers: buildUserAgentHeaders({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }),
    });

    const loginHtml = await loginPageRes.text();
    console.log("Login page status:", loginPageRes.status, "HTML length:", loginHtml.length);

    if (loginPageRes.status === 403 || isCloudflareChallenge(loginHtml)) {
      console.error("Steadfast login blocked by challenge page");
      return {
        ok: false,
        reason: "blocked",
        status: loginPageRes.status,
        message: "Steadfast সাময়িকভাবে নিরাপত্তা চেক দেখাচ্ছে, তাই এখন অটো লগইন করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
      };
    }

    const csrfToken = extractCsrfToken(loginHtml);
    if (!csrfToken) {
      console.error("Could not find CSRF token. HTML snippet:", loginHtml.substring(0, 500));
      return {
        ok: false,
        reason: "login_failed",
        status: loginPageRes.status,
        message: "Steadfast লগইন পেজ থেকে প্রয়োজনীয় টোকেন পাওয়া যায়নি। পরে আবার চেষ্টা করুন।",
      };
    }

    const loginPageCookies = getSetCookies(loginPageRes);
    console.log("Login page cookies:", loginPageCookies.length > 0 ? "found" : "none");

    const formBody = new URLSearchParams({
      _token: csrfToken,
      email,
      password,
    });

    const loginRes = await fetch(STEADFAST_LOGIN_URL, {
      method: "POST",
      redirect: "manual",
      headers: buildUserAgentHeaders({
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": mergeCookies(loginPageCookies),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": STEADFAST_LOGIN_URL,
        "Origin": "https://steadfast.com.bd",
      }),
      body: formBody.toString(),
    });

    const loginBody = await loginRes.text();
    console.log("Login POST status:", loginRes.status, "body length:", loginBody.length);

    if (loginRes.status === 403 || isCloudflareChallenge(loginBody)) {
      console.error("Steadfast login POST blocked by challenge page");
      return {
        ok: false,
        reason: "blocked",
        status: loginRes.status,
        message: "Steadfast সাময়িকভাবে নিরাপত্তা চেক দেখাচ্ছে, তাই এখন অটো লগইন করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
      };
    }

    if (
      loginBody.includes("These credentials do not match")
      || loginBody.includes("invalid")
      || loginBody.includes('action="/login"')
    ) {
      console.error("Invalid Steadfast credentials detected");
      return {
        ok: false,
        reason: "login_failed",
        status: loginRes.status,
        message: "ইমেইল বা পাসওয়ার্ড ভুল। Steadfast-এ লগইন করা যায়নি।",
      };
    }

    if (![200, 301, 302].includes(loginRes.status)) {
      console.error("Unexpected login status:", loginRes.status);
      return {
        ok: false,
        reason: "login_failed",
        status: loginRes.status,
        message: "Steadfast লগইন ব্যর্থ হয়েছে। পরে আবার চেষ্টা করুন।",
      };
    }

    const postLoginCookies = getSetCookies(loginRes);
    console.log("Post-login cookies count:", postLoginCookies.length);

    const sessionCookies = mergeCookies(loginPageCookies, postLoginCookies);
    if (!sessionCookies) {
      return {
        ok: false,
        reason: "login_failed",
        status: loginRes.status,
        message: "Steadfast সেশন তৈরি করা যায়নি। পরে আবার চেষ্টা করুন।",
      };
    }

    const expiry = Date.now() + SESSION_TTL_MS;
    cacheSession(sessionCookies, expiry);
    await persistSession(supabase, sessionCookies, expiry);

    console.log("Session cached successfully");
    return { ok: true, cookies: sessionCookies, source: "fresh_login" };
  } catch (err) {
    console.error("Login error:", err);
    return {
      ok: false,
      reason: "login_failed",
      message: "Steadfast সার্ভারে কানেক্ট করা যায়নি। পরে আবার চেষ্টা করুন।",
    };
  }
}

async function getSession(supabase: any): Promise<SessionResult> {
  if (cachedSession && Date.now() < cachedSession.expiry) {
    console.log("Using cached session, expires in", Math.round((cachedSession.expiry - Date.now()) / 1000), "seconds");
    return { ok: true, cookies: cachedSession.cookies, source: "memory" };
  }

  const credentials = await getStoredCredentials(supabase);
  if (!credentials) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Steadfast credentials configured নেই। আগে ইমেইল ও পাসওয়ার্ড সেভ করুন।",
    };
  }

  const persistedSession = await getPersistedSession(supabase);
  if (persistedSession?.ok) {
    return persistedSession;
  }

  return loginWithCredentials(supabase, credentials.email, credentials.password);
}

async function getFreshSessionFromStoredCredentials(supabase: any): Promise<SessionResult> {
  const credentials = await getStoredCredentials(supabase);
  if (!credentials) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Steadfast credentials configured নেই। আগে ইমেইল ও পাসওয়ার্ড সেভ করুন।",
    };
  }

  invalidateSession();
  await clearPersistedSession(supabase);
  return loginWithCredentials(supabase, credentials.email, credentials.password);
}

async function checkFraud(cookies: string, phone: string): Promise<any> {
  const cleanPhone = phone.replace(/[\s\-\+]/g, "").replace(/^88/, "");
  console.log("Checking fraud for phone:", cleanPhone);

  const res = await fetch(`${STEADFAST_CHECK_URL}/${cleanPhone}`, {
    method: "GET",
    headers: buildUserAgentHeaders({
      "Cookie": cookies,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `${STEADFAST_CHECK_URL}`,
    }),
  });

  const text = await res.text();
  console.log("Fraud check response status:", res.status, "length:", text.length);

  if (res.status === 302 || res.status === 301 || res.status === 401) {
    console.log("Redirected/unauthorized - session expired");
    return { expired: true };
  }

  if (res.status === 403 || isCloudflareChallenge(text)) {
    console.log("Fraud check blocked by challenge page");
    return {
      blocked: true,
      status: res.status,
      error: "Steadfast এই মুহূর্তে নিরাপত্তা চেক দেখাচ্ছে, তাই ফ্রড ডেটা আনা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
    };
  }

  if (text.includes('name="_token"') && text.includes('action="/login"')) {
    console.log("Got login page back - session expired");
    return { expired: true };
  }

  console.log("Response preview:", text.substring(0, 300));

  try {
    const json = JSON.parse(text);
    console.log("Parsed as JSON:", JSON.stringify(json));
    return json;
  } catch {
    console.log("Response is HTML, parsing...");
    return parseHtmlResponse(text, cleanPhone);
  }
}

function parseHtmlResponse(html: string, phone: string): any {
  const successMatch = html.match(/Success\s*[:\s]*(\d+)/i);
  const cancellationMatch = html.match(/Cancellation\s*[:\s]*(\d+)/i);

  if (successMatch || cancellationMatch) {
    const success = parseInt(successMatch?.[1] || "0");
    const cancel = parseInt(cancellationMatch?.[1] || "0");
    const total = success + cancel;
    const ratio = total > 0 ? Math.round((success / total) * 100) : 0;

    console.log("Parsed from Success/Cancellation pattern:", { phone, success, cancel, total, ratio });

    return {
      total_parcel: total,
      success_parcel: success,
      cancel_parcel: cancel,
      success_ratio: ratio,
    };
  }

  const tdMatches = html.match(/<td[^>]*>\s*(\d+)\s*<\/td>/gi);
  if (tdMatches && tdMatches.length >= 2) {
    const numbers = tdMatches.map((match) => parseInt(match.replace(/<[^>]*>/g, "").trim()));
    const success = numbers[0] || 0;
    const cancel = numbers[1] || 0;
    const total = success + cancel;
    const ratio = total > 0 ? Math.round((success / total) * 100) : 0;

    console.log("Parsed from table:", { phone, success, cancel, total, ratio });

    return {
      total_parcel: total,
      success_parcel: success,
      cancel_parcel: cancel,
      success_ratio: ratio,
    };
  }

  const deliveredMatch = html.match(/(?:delivered|ডেলিভার্ড?)\s*(?::|=|<[^>]*>)\s*(\d+)/i);
  const cancelledMatch = html.match(/(?:cancelled?|return|ক্যান্সেল|রিটার্ন)\s*(?::|=|<[^>]*>)\s*(\d+)/i);

  if (deliveredMatch || cancelledMatch) {
    const delivered = parseInt(deliveredMatch?.[1] || "0");
    const cancelled = parseInt(cancelledMatch?.[1] || "0");
    const total = delivered + cancelled;
    const ratio = total > 0 ? Math.round((delivered / total) * 100) : 0;

    console.log("Parsed from delivered/cancelled:", { phone, delivered, cancelled, total, ratio });

    return {
      total_parcel: total,
      success_parcel: delivered,
      cancel_parcel: cancelled,
      success_ratio: ratio,
    };
  }

  if (html.includes("no fraud history") || html.includes("ফ্রড হিস্ট্রি নেই")) {
    console.log("No fraud history found for this number");
    const percentMatch = html.match(/(\d+\.?\d*)%/);
    return {
      total_parcel: 0,
      success_parcel: 0,
      cancel_parcel: 0,
      success_ratio: percentMatch ? parseFloat(percentMatch[1]) : 0,
      message: "No fraud history",
    };
  }

  console.error("Could not parse HTML. Length:", html.length, "Preview:", html.substring(0, 500));
  return {
    error: "Steadfast response parse করা যায়নি",
    raw_length: html.length,
    phone,
  };
}

function normalizeFraudPayload(result: Record<string, any>) {
  const delivered = Number(result.total_delivered ?? result.success_parcel ?? result.success ?? 0);
  const cancelled = Number(result.total_cancelled ?? result.cancel_parcel ?? result.cancel ?? 0);
  const total = Number(result.total_parcel ?? result.total ?? result.total_parcels ?? (delivered + cancelled));
  const ratioValue = Number(result.success_ratio);
  const successRatio = Number.isFinite(ratioValue)
    ? ratioValue
    : total > 0
      ? Math.round((delivered / total) * 100)
      : 0;

  return {
    ...result,
    total_parcel: total,
    success_parcel: delivered,
    cancel_parcel: cancelled,
    success_ratio: successRatio,
  };
}

// ─── EcomDrive API Fallback for Steadfast Fraud Data ───
const ECOMDRIVE_BASE_URL = "https://my.ecomdrivebd.com/api/external";

async function tryEcomDriveFraudCheck(phone: string): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const apiKey = Deno.env.get("ECOMDRIVE_API_KEY");
  const businessId = Deno.env.get("ECOMDRIVE_BUSINESS_ID");

  if (!apiKey || !businessId) {
    console.log("EcomDrive API not configured, skipping fallback");
    return { ok: false, error: "EcomDrive not configured" };
  }

  const cleanPhone = phone.replace(/[\s\-\+]/g, "").replace(/^88/, "");
  console.log("Trying EcomDrive fraud check for:", cleanPhone);

  // Try multiple possible endpoints
  const endpoints = [
    `${ECOMDRIVE_BASE_URL}/fraud-check?businessId=${businessId}&phone=${cleanPhone}`,
    `${ECOMDRIVE_BASE_URL}/orders/fraud-check?businessId=${businessId}&phone=${cleanPhone}`,
    `${ECOMDRIVE_BASE_URL}/courier/fraud?businessId=${businessId}&phone=${cleanPhone}`,
    `${ECOMDRIVE_BASE_URL}/check-fraud?businessId=${businessId}&phone=${cleanPhone}`,
  ];

  for (const url of endpoints) {
    try {
      console.log("Trying EcomDrive endpoint:", url);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
          "Accept": "application/json",
        },
      });

      console.log("EcomDrive response status:", res.status);

      if (res.status === 404 || res.status === 405) {
        continue; // Try next endpoint
      }

      const text = await res.text();
      console.log("EcomDrive response preview:", text.substring(0, 300));

      if (!res.ok) continue;

      try {
        const json = JSON.parse(text);

        // Check if the response has useful fraud data
        if (json.success === false && json.message?.includes("not found")) continue;

        // Try to extract Steadfast-specific data from the response
        const steadfastData = extractSteadfastFromEcomDrive(json);
        if (steadfastData) {
          console.log("✅ EcomDrive fraud data found:", JSON.stringify(steadfastData));
          return { ok: true, data: steadfastData };
        }

        // If the response itself looks like fraud data
        if (typeof json.total_parcel === "number" || typeof json.success_parcel === "number" || typeof json.total_delivered === "number") {
          console.log("✅ EcomDrive returned direct fraud data");
          return { ok: true, data: normalizeFraudPayload(json) };
        }

        console.log("EcomDrive response doesn't contain fraud data, trying next endpoint");
      } catch {
        continue;
      }
    } catch (err) {
      console.log("EcomDrive endpoint error:", err instanceof Error ? err.message : String(err));
      continue;
    }
  }

  // Also try POST method
  try {
    const postUrl = `${ECOMDRIVE_BASE_URL}/fraud-check`;
    console.log("Trying EcomDrive POST:", postUrl);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ businessId, phone: cleanPhone }),
    });

    console.log("EcomDrive POST status:", res.status);
    if (res.ok) {
      const text = await res.text();
      console.log("EcomDrive POST response:", text.substring(0, 300));
      try {
        const json = JSON.parse(text);
        const steadfastData = extractSteadfastFromEcomDrive(json);
        if (steadfastData) {
          console.log("✅ EcomDrive POST fraud data found");
          return { ok: true, data: steadfastData };
        }
        if (typeof json.total_parcel === "number" || typeof json.success_parcel === "number") {
          return { ok: true, data: normalizeFraudPayload(json) };
        }
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.log("EcomDrive POST error:", err instanceof Error ? err.message : String(err));
  }

  console.log("❌ No EcomDrive fraud endpoint found");
  return { ok: false, error: "No fraud endpoint found in EcomDrive API" };
}

function extractSteadfastFromEcomDrive(json: any): any | null {
  // EcomDrive might return data in various formats
  // Case 1: { steadfast: { success: N, cancel: N } }
  if (json.steadfast) {
    const sf = json.steadfast;
    return normalizeFraudPayload({
      total_parcel: sf.total_parcel ?? sf.total ?? ((sf.success ?? 0) + (sf.cancel ?? 0)),
      success_parcel: sf.success_parcel ?? sf.success ?? sf.delivered ?? sf.total_delivered ?? 0,
      cancel_parcel: sf.cancel_parcel ?? sf.cancel ?? sf.cancelled ?? sf.total_cancelled ?? 0,
      success_ratio: sf.success_ratio ?? sf.ratio ?? 0,
      source: "ecomdrive",
    });
  }

  // Case 2: { data: { steadfast: {...} } }
  if (json.data?.steadfast) {
    return extractSteadfastFromEcomDrive(json.data);
  }

  // Case 3: { couriers: { steadfast: {...} } }
  if (json.couriers?.steadfast) {
    return extractSteadfastFromEcomDrive({ steadfast: json.couriers.steadfast });
  }

  // Case 4: { fraud_data: { steadfast: {...} } }
  if (json.fraud_data?.steadfast) {
    return extractSteadfastFromEcomDrive({ steadfast: json.fraud_data.steadfast });
  }

  // Case 5: Direct data with source field
  if (json.source === "steadfast" && (typeof json.total_parcel === "number" || typeof json.success === "number")) {
    return normalizeFraudPayload({ ...json, source: "ecomdrive" });
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { action, email, password, phone } = await req.json();

    if (action === "update_credentials") {
      if (!email || !password) {
        return jsonResponse({ error: "Email and password required" }, 400);
      }

      console.log("Validating Steadfast login before saving...");
      const session = await loginWithCredentials(supabase, email, password);

      if (!session.ok) {
        return jsonResponse({
          success: false,
          error: session.message,
          login_failed: session.reason === "login_failed",
          not_configured: false,
          access_blocked: session.reason === "blocked",
        });
      }

      console.log("Login validated! Saving credentials...");
      const [emailResult, passwordResult] = await Promise.all([
        upsertSetting(supabase, "steadfast_fraud_email", email),
        upsertSetting(supabase, "steadfast_fraud_password", password),
      ]);

      if (emailResult.error || passwordResult.error) {
        console.error("Save error:", emailResult.error?.message, passwordResult.error?.message);
        throw emailResult.error || passwordResult.error;
      }

      console.log("Credentials saved successfully after login validation");
      return jsonResponse({ success: true, message: "লগইন সফল, ক্রেডেনশিয়াল সেভ হয়েছে" });
    }

    if (action === "delete_credentials") {
      await supabase
        .from("app_settings")
        .delete()
        .in("key", [
          "steadfast_fraud_email",
          "steadfast_fraud_password",
          "steadfast_fraud_session",
          "steadfast_fraud_session_expires_at",
        ]);

      invalidateSession();
      console.log("Credentials deleted");
      return jsonResponse({ success: true });
    }

    // 🔒 DO_NOT_MODIFY — Steadfast fraud check with Cloudflare fallback
    if (action === "check" || action === "force_check") {
      if (!phone) {
        return jsonResponse({ error: "Phone number required" }, 400);
      }

      const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

      // Helper: get cached data for fallback
      async function getCachedFraudData() {
        const { data: cached } = await supabase
          .from("fraud_data")
          .select("steadfast_data, updated_at")
          .eq("phone", phone)
          .maybeSingle();
        return cached;
      }

      // Check cache first (skip if force_check)
      if (action === "check") {
        const cached = await getCachedFraudData();
        if (cached?.steadfast_data) {
          const age = Date.now() - new Date(cached.updated_at).getTime();
          const stale = age > CACHE_TTL_MS;
          console.log("Returning cached steadfast data, stale:", stale);
          return jsonResponse({ success: true, data: cached.steadfast_data, cached: true, stale });
        }
      }

      // Helper: try EcomDrive fallback and cache result
      async function tryEcomDriveAndCache(): Promise<Response | null> {
        const ecomResult = await tryEcomDriveFraudCheck(phone);
        if (ecomResult.ok) {
          // Save to fraud_data cache
          await supabase
            .from("fraud_data")
            .upsert({
              phone,
              steadfast_data: ecomResult.data,
              updated_at: new Date().toISOString(),
            }, { onConflict: "phone" });
          return jsonResponse({ success: true, data: ecomResult.data, cached: false, stale: false, source: "ecomdrive" });
        }
        return null;
      }
      // Fetch from Steadfast
      let session = await getSession(supabase);
      if (!session.ok) {
        // Cloudflare blocked or login failed — try EcomDrive fallback first
        if (session.reason === "blocked" || session.reason === "login_failed") {
          const ecomResponse = await tryEcomDriveAndCache();
          if (ecomResponse) return ecomResponse;

          // EcomDrive also failed — try stale cache
          const cached = await getCachedFraudData();
          if (cached?.steadfast_data) {
            console.log("Login blocked, EcomDrive failed, returning stale cached data");
            return jsonResponse({
              success: true,
              data: cached.steadfast_data,
              cached: true,
              stale: true,
              cloudflare_blocked: session.reason === "blocked",
            });
          }
        }
        return jsonResponse({
          success: false,
          error: session.message,
          not_configured: session.reason === "not_configured",
          login_failed: session.reason === "login_failed",
          access_blocked: session.reason === "blocked",
        });
      }

      let result = await checkFraud(session.cookies, phone);

      if (result?.expired) {
        console.log("Session expired, retrying with fresh login...");
        session = await getFreshSessionFromStoredCredentials(supabase);

        if (!session.ok) {
          // Cloudflare blocked fresh login — try EcomDrive fallback
          if (session.reason === "blocked") {
            const ecomResponse = await tryEcomDriveAndCache();
            if (ecomResponse) return ecomResponse;

            const cached = await getCachedFraudData();
            if (cached?.steadfast_data) {
              console.log("Fresh login blocked, EcomDrive failed, returning stale cached data");
              return jsonResponse({
                success: true,
                data: cached.steadfast_data,
                cached: true,
                stale: true,
                cloudflare_blocked: true,
              });
            }
          }
          return jsonResponse({
            success: false,
            error: session.message,
            not_configured: session.reason === "not_configured",
            login_failed: session.reason === "login_failed",
            access_blocked: session.reason === "blocked",
          });
        }

        result = await checkFraud(session.cookies, phone);
        if (result?.expired) {
          // Session keeps expiring — try EcomDrive fallback
          const ecomResponse = await tryEcomDriveAndCache();
          if (ecomResponse) return ecomResponse;

          const cached = await getCachedFraudData();
          if (cached?.steadfast_data) {
            console.log("Session keeps expiring, EcomDrive failed, returning stale cached data");
            return jsonResponse({
              success: true,
              data: cached.steadfast_data,
              cached: true,
              stale: true,
            });
          }
          return jsonResponse({
            success: false,
            error: "Steadfast session বারবার এক্সপায়ার হচ্ছে। একটু পরে আবার চেষ্টা করুন।",
          });
        }
      }

      if (result?.blocked) {
        // Fraud check itself blocked by Cloudflare — try EcomDrive fallback
        const ecomResponse = await tryEcomDriveAndCache();
        if (ecomResponse) return ecomResponse;

        const cached = await getCachedFraudData();
        if (cached?.steadfast_data) {
          console.log("Fraud check blocked, EcomDrive failed, returning stale cached data");
          return jsonResponse({
            success: true,
            data: cached.steadfast_data,
            cached: true,
            stale: true,
            cloudflare_blocked: true,
          });
        }
        return jsonResponse({
          success: false,
          error: result.error,
          access_blocked: true,
          status: result.status,
        });
      }

      if (result?.error) {
        return jsonResponse({
          success: false,
          error: result.error,
          raw_length: result.raw_length,
        });
      }

      const normalizedResult = normalizeFraudPayload(result);
      console.log("Final result:", JSON.stringify(normalizedResult));

      // Save to cache if valid
      const isValid = normalizedResult && typeof normalizedResult.total_parcel === "number";
      if (isValid) {
        await supabase
          .from("fraud_data")
          .upsert({
            phone,
            steadfast_data: normalizedResult,
            updated_at: new Date().toISOString(),
          }, { onConflict: "phone" });
      }

      return jsonResponse({ success: true, data: normalizedResult, cached: false, stale: false });
    }
    // 🔒 END DO_NOT_MODIFY

    if (action === "status") {
      const settings = await readSettingsMap(supabase, ["steadfast_fraud_email", "steadfast_fraud_password", "steadfast_fraud_session_expires_at"]);
      const savedEmail = settings.get("steadfast_fraud_email") || null;
      const savedPassword = settings.get("steadfast_fraud_password") || null;
      const sessionExpiry = settings.get("steadfast_fraud_session_expires_at") || null;

      return jsonResponse({
        configured: !!savedEmail && !!savedPassword,
        email: savedEmail,
        session_active: !!sessionExpiry && new Date(sessionExpiry).getTime() > Date.now(),
      });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Edge function error:", msg);
    return jsonResponse({ error: msg }, 500);
  }
});