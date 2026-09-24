/**
 * Session Header Bootstrap
 * ────────────────────────
 * Auto-inject `x-session-token` and `x-visitor-fingerprint` into every
 * Supabase REST/Realtime request so the new RLS policies that rely on
 * `current_visitor_profile_id()` and `current_visitor_fingerprint()` work.
 *
 * The session token is stored in `visitor_profiles.session_token` and
 * cached locally in `localStorage["ab_visitor_session"]` (already used
 * elsewhere in the app for auth).
 *
 * This patches the global `fetch` once at module load time.
 */

const SESSION_KEY = "customer-session-token";
const FINGERPRINT_KEY = "ab_visitor_fingerprint";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_HOST = SUPABASE_URL.replace(/^https?:\/\//, "");

function readSessionToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    // Stored either as plain string or JSON {token: ...}
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return parsed?.token || parsed?.session_token || null;
    }
    return raw;
  } catch {
    return null;
  }
}

function readFingerprint(): string | null {
  try {
    return localStorage.getItem(FINGERPRINT_KEY);
  } catch {
    return null;
  }
}

let installed = false;
export function installSessionHeaders() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;
      // Edge Functions have their own CORS allow-list. These custom RLS
      // headers are only needed for direct database/realtime requests, and
      // adding them to function calls can make browser preflight fail.
      const isSupabaseRequest = SUPABASE_HOST && url.includes(SUPABASE_HOST);
      const isFunctionRequest = SUPABASE_URL && url.startsWith(`${SUPABASE_URL}/functions/v1/`);
      if (isSupabaseRequest && !isFunctionRequest) {
        const token = readSessionToken();
        const fp = readFingerprint();
        if (token || fp) {
          const headers = new Headers(init.headers || {});
          // Also merge headers from Request when input is a Request
          if (input instanceof Request) {
            input.headers.forEach((v, k) => {
              if (!headers.has(k)) headers.set(k, v);
            });
          }
          if (token) headers.set("x-session-token", token);
          if (fp) headers.set("x-visitor-fingerprint", fp);
          init = { ...init, headers };
        }
      }
    } catch {
      // never block requests if header injection fails
    }
    return originalFetch(input, init);
  };
}

/** Manually set the session token (call after login / signup). */
export function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Manually set the visitor fingerprint (call after fingerprint is computed). */
export function setVisitorFingerprint(fp: string | null) {
  try {
    if (fp) localStorage.setItem(FINGERPRINT_KEY, fp);
    else localStorage.removeItem(FINGERPRINT_KEY);
  } catch {
    // ignore
  }
}
