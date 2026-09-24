// Watched-user activity alert. Fire-and-forget — never blocks the UI.
// Sends a single SMS via the watched-user-alert edge function when the
// current visitor matches the admin watchlist (rate-limited server-side).
import { supabase } from "@/integrations/supabase/client";

const VISITOR_ID_KEY = "visitor-id";
const IP_CACHE_KEY = "visitor-ip-cache";

function getVisitorId(): string | null {
  try { return localStorage.getItem(VISITOR_ID_KEY); } catch { return null; }
}
function getProfileId(): string | null {
  try {
    const s = localStorage.getItem("customer-session");
    return s ? JSON.parse(s).profileId || null : null;
  } catch { return null; }
}
function getCachedIp(): string | null {
  try { return sessionStorage.getItem(IP_CACHE_KEY); } catch { return null; }
}
function getProfilePhone(): string | null {
  try {
    const s = localStorage.getItem("customer-session");
    return s ? JSON.parse(s).phone || null : null;
  } catch { return null; }
}

export type WatchedAction =
  | "order_placed"
  | "comment"
  | "post"
  | "login"
  | "checkout_start"
  | "page_view";

export interface WatchedAlertPayload {
  action: WatchedAction;
  page_path?: string;
  phone?: string;
  extra?: string;
}

/**
 * Fire-and-forget call. Sends visitor + profile + ip to backend which
 * decides if the user is on the watchlist and if SMS rate-limit allows
 * an alert to go out. Never throws — silently swallows errors.
 */
export function notifyWatchedActivity(payload: WatchedAlertPayload): void {
  try {
    const body = {
      action: payload.action,
      page_path: payload.page_path || (typeof window !== "undefined" ? window.location.pathname : undefined),
      phone: payload.phone || getProfilePhone() || undefined,
      ip_address: getCachedIp() || undefined,
      visitor_id: getVisitorId() || undefined,
      visitor_profile_id: getProfileId() || undefined,
      extra: payload.extra,
    };
    // No await — fire and forget
    supabase.functions.invoke("watched-user-alert", { body }).catch(() => {});
    // Also collect deep forensic fingerprint (server-side filters non-watched users)
    import("./forensicCollector").then(m => m.collectForensicData(payload.action, { extra: payload.extra })).catch(() => {});
  } catch {
    // silent
  }
}
