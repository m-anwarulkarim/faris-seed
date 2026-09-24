// 🔒 DO_NOT_MODIFY START: Visitor tracking & banning logic — critical security system
import { supabase } from "@/integrations/supabase/client";
import { detectTrafficSource } from "@/lib/trafficSource";
import { detectBot } from "@/lib/botDetect";
import { setVisitorFingerprint } from "@/lib/sessionHeaders";

const VISITOR_FINGERPRINT_KEY = "visitor-fingerprint";
const VISITOR_ID_KEY = "visitor-id";
const VISITOR_SESSION_HIT_KEY = "visitor-session-hit";
const BANNED_KEY = "visitor-banned";
const IP_CACHE_KEY = "visitor-ip-cache";

function showBannedScreen() {
  localStorage.setItem(BANNED_KEY, "1");
  const screen = document.createElement("div");
  screen.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fafafa;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
      <div style="max-width:420px;">
        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
        <h1 style="font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 12px;">ওয়েবসাইটে সাময়িক সমস্যা</h1>
        <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 8px;">দুঃখিত, এই মুহূর্তে ওয়েবসাইটটি সঠিকভাবে লোড হচ্ছে না। আমরা সমস্যাটি সমাধানের চেষ্টা করছি।</p>
        <p style="font-size:13px;color:#888;line-height:1.6;margin:0 0 24px;">সমস্যা অব্যাহত থাকলে দয়া করে আমাদের সাথে যোগাযোগ করুন, আমরা আপনাকে সাহায্য করব।</p>
        <a href="tel:09617443377" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#222;color:#fff;border-radius:12px;text-decoration:none;font-size:14px;font-weight:600;">📞 যোগাযোগ করুন — 09617443377</a>
      </div>
    </div>
  `;
  document.body.appendChild(screen);
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

function buildFingerprintSeed(): string {
  const nav = window.navigator;
  const screenInfo = window.screen;
  return [
    nav.userAgent,
    nav.language,
    nav.platform,
    nav.hardwareConcurrency ?? "na",
    nav.maxTouchPoints ?? 0,
    `${screenInfo.width}x${screenInfo.height}x${screenInfo.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");
}

function getOrCreateFingerprint(): string {
  // Build deterministic fingerprint from device characteristics only (no Date.now())
  // This ensures the SAME device always produces the SAME fingerprint,
  // even after localStorage is cleared, incognito, in-app browser, etc.
  const deterministicFp = `fp_${hashString(buildFingerprintSeed())}`;

  const existing = localStorage.getItem(VISITOR_FINGERPRINT_KEY);
  if (existing) {
    // If stored fp differs from deterministic one (legacy with Date.now()),
    // migrate to the stable one so duplicate fps stop accumulating
    if (existing !== deterministicFp) {
      localStorage.setItem(VISITOR_FINGERPRINT_KEY, deterministicFp);
      setVisitorFingerprint(deterministicFp);
      return deterministicFp;
    }
    setVisitorFingerprint(existing);
    return existing;
  }

  localStorage.setItem(VISITOR_FINGERPRINT_KEY, deterministicFp);
  setVisitorFingerprint(deterministicFp);
  return deterministicFp;
}

/**
 * Fetch IP once per session, cache in sessionStorage.
 * Avoids repeated external API calls on SPA navigations.
 */
async function fetchPublicIp(): Promise<string | null> {
  const cached = sessionStorage.getItem(IP_CACHE_KEY);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ip?: string };
    const ip = body.ip?.trim() || null;
    if (ip) sessionStorage.setItem(IP_CACHE_KEY, ip);
    return ip;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Single combined update for existing visitor — merges visit count,
 * IP, user agent, and page load time into ONE DB write.
 */
async function updateExistingVisitor(
  visitor: { id: string; total_visit_count: number | null; ip_addresses: string[] | null; avg_page_load_ms: number | null },
  ip: string | null,
  shouldCountVisit: boolean,
) {
  const nextIps = ip
    ? Array.from(new Set([...(visitor.ip_addresses || []), ip]))
    : visitor.ip_addresses || [];

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    user_agent: navigator.userAgent || undefined,
  };

  if (ip && JSON.stringify(nextIps) !== JSON.stringify(visitor.ip_addresses || [])) {
    payload.ip_addresses = nextIps;
  }

  if (shouldCountVisit) {
    payload.total_visit_count = (visitor.total_visit_count || 0) + 1;
  }

  // Merge page load time measurement into this same update (avoid 2 extra calls)
  const loadTimeMs = measurePageLoadTime();
  if (loadTimeMs !== null) {
    const oldAvg = visitor.avg_page_load_ms || loadTimeMs;
    const visits = (visitor.total_visit_count || 1);
    payload.avg_page_load_ms = Math.round(((oldAvg * (visits - 1)) + loadTimeMs) / visits);
  }

  await supabase.from("visitors").update(payload as any).eq("id", visitor.id);
}

/**
 * Synchronously measure page load time if available.
 * Returns null if not ready or already sent this session.
 */
function measurePageLoadTime(): number | null {
  const SENT_KEY = "visitor-page-load-sent";
  if (sessionStorage.getItem(SENT_KEY) === "1") return null;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav || nav.loadEventEnd <= 0) return null;
    const ms = Math.round(nav.loadEventEnd - nav.startTime);
    if (ms <= 0 || ms > 60000) return null;
    sessionStorage.setItem(SENT_KEY, "1");
    return ms;
  } catch {
    return null;
  }
}

/**
 * Schedule a deferred page load measurement for cases where
 * loadEventEnd isn't available yet during ensureVisitorTracked().
 */
function scheduleDeferredPageLoad(visitorId: string) {
  if (sessionStorage.getItem("visitor-page-load-sent") === "1") return;

  const attempt = () => {
    const ms = measurePageLoadTime();
    if (ms === null) return;
    // Single fire-and-forget update
    supabase
      .from("visitors")
      .select("avg_page_load_ms, total_visit_count")
      .eq("id", visitorId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const oldAvg = data.avg_page_load_ms || ms;
        const visits = data.total_visit_count || 1;
        const newAvg = Math.round(((oldAvg * (visits - 1)) + ms) / visits);
        supabase.from("visitors").update({ avg_page_load_ms: newAvg } as any).eq("id", visitorId).then(() => {});
      });
  };

  if (document.readyState === "complete") {
    setTimeout(attempt, 200);
  } else {
    window.addEventListener("load", () => setTimeout(attempt, 200), { once: true });
  }
}

export async function ensureVisitorTracked(): Promise<{ visitorId: string | null; fingerprint: string | null }> {
  if (typeof window === "undefined") {
    return { visitorId: null, fingerprint: null };
  }

  // Bot detection — log bot visit and skip real visitor tracking
  const botInfo = detectBot();
  if (botInfo.isBot) {
    try {
      await supabase.from("bot_visits").insert({
        bot_name: botInfo.botName,
        bot_category: botInfo.botCategory,
        user_agent: navigator.userAgent || null,
        page_path: window.location.pathname,
        referrer_url: document.referrer || null,
      });
    } catch {
      // silent fail
    }
    return { visitorId: null, fingerprint: null };
  }

  const fingerprint = getOrCreateFingerprint();
  const alreadyCountedThisSession = sessionStorage.getItem(VISITOR_SESSION_HIT_KEY) === "1";

  // Fetch IP in parallel with DB lookup (don't await sequentially)
  const ipPromise = fetchPublicIp();

  // Enforce admin IP/device blocks (blocked_devices table)
  ipPromise.then(async (blockIp) => {
    try {
      const { data: blocked } = await supabase.rpc("is_visitor_blocked", {
        _ip: blockIp,
        _fingerprint: fingerprint,
      } as any);
      if (blocked === true) showBannedScreen();
    } catch {
      // silent fail — never break the site on block check errors
    }
  });

  let visitorId = localStorage.getItem(VISITOR_ID_KEY);


  // Try cached visitor ID first
  if (visitorId) {
    const [ip, { data: existingVisitor }] = await Promise.all([
      ipPromise,
      supabase
        .from("visitors")
        .select("id, total_visit_count, ip_addresses, access_allowed, avg_page_load_ms")
        .eq("id", visitorId)
        .maybeSingle(),
    ]);

    if (existingVisitor) {
      if (existingVisitor.access_allowed === false) {
        showBannedScreen();
        return { visitorId, fingerprint };
      }
      await updateExistingVisitor(existingVisitor, ip, !alreadyCountedThisSession);
      sessionStorage.setItem(VISITOR_SESSION_HIT_KEY, "1");
      // If page load wasn't ready yet, schedule deferred measurement
      scheduleDeferredPageLoad(visitorId);
      return { visitorId, fingerprint };
    }
  }

  // Fallback: lookup by fingerprint
  const ip = await ipPromise;
  const { data: sameFingerprintVisitor } = await supabase
    .from("visitors")
    .select("id, total_visit_count, ip_addresses, access_allowed, avg_page_load_ms")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (sameFingerprintVisitor) {
    visitorId = sameFingerprintVisitor.id;
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
    if (sameFingerprintVisitor.access_allowed === false) {
      showBannedScreen();
      return { visitorId, fingerprint };
    }
    await updateExistingVisitor(sameFingerprintVisitor, ip, !alreadyCountedThisSession);
    sessionStorage.setItem(VISITOR_SESSION_HIT_KEY, "1");
    scheduleDeferredPageLoad(visitorId);
    return { visitorId, fingerprint };
  }

  // New visitor — single insert
  const sourceData = detectTrafficSource();
  const { data: inserted, error: insertError } = await supabase
    .from("visitors")
    .insert({
      fingerprint,
      ip_addresses: ip ? [ip] : [],
      total_visit_count: 1,
      total_active_time_seconds: 0,
      access_allowed: true,
      user_agent: navigator.userAgent || null,
      traffic_source: sourceData.traffic_source,
      utm_source: sourceData.utm_source,
      utm_medium: sourceData.utm_medium,
      utm_campaign: sourceData.utm_campaign,
      referrer_url: sourceData.referrer_url,
    } as any)
    .select("id")
    .single();

  if (insertError) throw insertError;

  visitorId = inserted.id;
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  sessionStorage.setItem(VISITOR_SESSION_HIT_KEY, "1");
  scheduleDeferredPageLoad(visitorId);

  return { visitorId, fingerprint };
}

interface CheckoutProfilePayload {
  name: string;
  phone: string;
  address: string;
  altPhone?: string | null;
}

export async function upsertVisitorProfileFromOrder(payload: CheckoutProfilePayload): Promise<{ id: string; phone: string; name: string | null } | null> {
  const phone = payload.phone.trim();
  if (!phone) return null;

  const { visitorId } = await ensureVisitorTracked();
  if (!visitorId) return null;

  const profilePayload = {
    visitor_id: visitorId,
    phone,
    name: payload.name.trim() || null,
    address: payload.address.trim() || null,
    alt_phone: payload.altPhone?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await supabase
    .from("visitor_profiles")
    .select("id, name, address, alt_phone")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!existing.name && profilePayload.name) updates.name = profilePayload.name;
    if (!existing.address && profilePayload.address) updates.address = profilePayload.address;
    if (!existing.alt_phone && profilePayload.alt_phone) updates.alt_phone = profilePayload.alt_phone;

    const { error } = await supabase.from("visitor_profiles").update(updates as any).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, phone, name: existing.name || payload.name.trim() || null };
  }

  const { data: inserted, error } = await supabase
    .from("visitor_profiles")
    .insert(profilePayload)
    .select("id")
    .single();

  if (error) throw error;
  return { id: inserted.id, phone, name: payload.name.trim() || null };
}
