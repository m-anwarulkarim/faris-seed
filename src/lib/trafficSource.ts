/**
 * Traffic source detection from UTM params and referrer.
 * Stores in sessionStorage so it persists across page navigations
 * but resets each session (new tab = new source detection).
 */

const SOURCE_KEY = "traffic-source";
const UTM_SOURCE_KEY = "utm-source";
const UTM_MEDIUM_KEY = "utm-medium";
const UTM_CAMPAIGN_KEY = "utm-campaign";
const REFERRER_KEY = "traffic-referrer";

export interface TrafficSourceData {
  traffic_source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_url: string | null;
}

const SOURCE_RULES: { pattern: RegExp; label: string }[] = [
  { pattern: /^app$|android_app|ios_app|mobile_app|twa/i, label: "app" },
  { pattern: /facebook\.com|fb\.com|fbclid/i, label: "facebook" },
  { pattern: /instagram\.com/i, label: "instagram" },
  { pattern: /google\./i, label: "google" },
  { pattern: /youtube\.com|youtu\.be/i, label: "youtube" },
  { pattern: /tiktok\.com/i, label: "tiktok" },
  { pattern: /twitter\.com|x\.com|t\.co/i, label: "twitter" },
  { pattern: /linkedin\.com/i, label: "linkedin" },
  { pattern: /pinterest\.com/i, label: "pinterest" },
  { pattern: /bing\.com/i, label: "bing" },
  { pattern: /yahoo\.com/i, label: "yahoo" },
  { pattern: /whatsapp\.com|wa\.me/i, label: "whatsapp" },
  { pattern: /t\.me|telegram\.org/i, label: "telegram" },
  { pattern: /reddit\.com/i, label: "reddit" },
];

const APP_SOURCE_PERSIST_KEY = "is-app-user";

function detectSourceFromReferrer(referrer: string): string {
  for (const rule of SOURCE_RULES) {
    if (rule.pattern.test(referrer)) return rule.label;
  }
  // If there's a referrer but doesn't match known sources
  if (referrer) return "referral";
  return "direct";
}

function detectSourceFromUtm(utmSource: string): string {
  const lower = utmSource.toLowerCase();
  for (const rule of SOURCE_RULES) {
    if (rule.pattern.test(lower)) return rule.label;
  }
  return lower || "direct";
}

/**
 * Detect and cache traffic source on first page load of session.
 * Call this early (e.g., in visitor tracking).
 */
export function detectTrafficSource(): TrafficSourceData {
  // If already detected this session, return cached
  const cached = sessionStorage.getItem(SOURCE_KEY);
  if (cached) {
    return {
      traffic_source: cached,
      utm_source: sessionStorage.getItem(UTM_SOURCE_KEY),
      utm_medium: sessionStorage.getItem(UTM_MEDIUM_KEY),
      utm_campaign: sessionStorage.getItem(UTM_CAMPAIGN_KEY),
      referrer_url: sessionStorage.getItem(REFERRER_KEY),
    };
  }

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source") || "";
  const utmMedium = params.get("utm_medium") || "";
  const utmCampaign = params.get("utm_campaign") || "";
  const fbclid = params.get("fbclid");
  const gclid = params.get("gclid");
  const referrer = document.referrer || "";

  // Detect installed-app launches: TWA / standalone PWA always counts as "app"
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true ||
    document.referrer.startsWith("android-app://");

  let source = "direct";

  // Once tagged as app user (via ?utm_source=app or standalone launch), stick with it
  const wasAppUser = localStorage.getItem(APP_SOURCE_PERSIST_KEY) === "1";

  if (utmSource.toLowerCase() === "app" || isStandalone || wasAppUser) {
    source = "app";
    try { localStorage.setItem(APP_SOURCE_PERSIST_KEY, "1"); } catch {}
  } else if (utmSource) {
    source = detectSourceFromUtm(utmSource);
  } else if (fbclid) {
    source = "facebook";
  } else if (gclid) {
    source = "google";
  } else if (referrer) {
    // Don't count own domain as referral
    try {
      const refHost = new URL(referrer).hostname;
      if (refHost !== window.location.hostname) {
        source = detectSourceFromReferrer(referrer);
      }
    } catch {
      source = detectSourceFromReferrer(referrer);
    }
  }

  // Cache in session
  sessionStorage.setItem(SOURCE_KEY, source);
  if (utmSource) sessionStorage.setItem(UTM_SOURCE_KEY, utmSource);
  if (utmMedium) sessionStorage.setItem(UTM_MEDIUM_KEY, utmMedium);
  if (utmCampaign) sessionStorage.setItem(UTM_CAMPAIGN_KEY, utmCampaign);
  if (referrer) sessionStorage.setItem(REFERRER_KEY, referrer);

  return {
    traffic_source: source,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    referrer_url: referrer || null,
  };
}

/** Get the current session's traffic source label (already detected). */
export function getTrafficSource(): string {
  return sessionStorage.getItem(SOURCE_KEY) || "direct";
}
