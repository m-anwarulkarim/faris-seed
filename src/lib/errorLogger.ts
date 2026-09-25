import { supabase } from "@/integrations/supabase/client";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export interface LogErrorOptions {
  message?: string;
  stack?: string;
  errorType?: string;
  severity?: ErrorSeverity;
  context?: Record<string, unknown>;
  sourceUrl?: string;
}

// In-memory dedup to avoid hammering DB on noisy loops
const recentFingerprints = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

function fingerprint(message: string, stack?: string, type?: string): string {
  const stackHead = (stack || "").split("\n").slice(0, 3).join("|");
  const raw = `${type || ""}::${message}::${stackHead}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h << 5) - h + raw.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function shouldIgnore(message: string, stack?: string, sourceUrl?: string): boolean {
  if (!message) return true;
  const msg = message.toLowerCase();
  const stk = (stack || "").toLowerCase();
  const src = (sourceUrl || "").toLowerCase();

  // ─── Browser noise (harmless) ───
  if (msg.includes("resizeobserver loop")) return true;
  if (msg.includes("non-error promise rejection captured")) return true;
  if (msg.startsWith("script error")) return true; // cross-origin script errors with no detail

  // ─── Third-party injected scripts (not our code) ───
  // Samsung Internet autofill bridge
  if (msg.includes("setcontactautofillvaluesfrombridge")) return true;
  if (stk.includes("setcontactautofillvaluesfrombridge")) return true;
  // iOS WebView host bridges (in-app browsers)
  if (msg.includes("messagehandlers")) return true;
  if (msg.includes("window.webkit")) return true;
  // FB / pixel injected (we never write `missing ) after argument list` ourselves)
  if (msg.includes("fbclid") || src.includes("fbclid")) return true;
  // Anonymous / native code stack with no project source
  if (stk.includes("<anonymous>") && !stk.includes("/assets/") && !stk.includes("/src/")) return true;

  return false;
}

/**
 * Detect a "stale chunk" error — happens when a user has an old HTML/JS open
 * after we've redeployed and chunk hashes have changed. The fix is just a reload.
 */
function isStaleChunkError(message: string, stack?: string): boolean {
  const m = (message || "").toLowerCase();
  const s = (stack || "").toLowerCase();
  return (
    m.includes("loading chunk") && m.includes("failed") ||
    m.includes("loading css chunk") ||
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("importing a module script failed") ||
    // React.lazy default-export resolver crashes when the chunk fetch returned undefined
    (m.includes("reading 'default'") && (s.includes("_result") || s.includes("query-") || s.includes("router-"))) ||
    (m.includes("_result.default") && (s.includes("query-") || s.includes("router-")))
  );
}

const STALE_RELOAD_KEY = "__faris_stale_reload_at";
function maybeReloadOnStaleChunk(message: string, stack?: string) {
  if (typeof window === "undefined") return;
  if (!isStaleChunkError(message, stack)) return;
  try {
    const last = Number(sessionStorage.getItem(STALE_RELOAD_KEY) || 0);
    // Only auto-reload at most once per 5 minutes per tab
    if (Date.now() - last < 5 * 60 * 1000) return;
    sessionStorage.setItem(STALE_RELOAD_KEY, String(Date.now()));
    // Cache-bust query so the browser/CDN/SW gets the latest entry
    const url = new URL(window.location.href);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    /* ignore */
  }
}

function getVisitorProfileId(): string | null {
  try {
    const raw = localStorage.getItem("customer_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.visitor_profile_id || parsed?.id || null;
  } catch {
    return null;
  }
}

function getUserRole(): string {
  try {
    if (localStorage.getItem("admin_session")) return "admin";
    if (localStorage.getItem("customer_session")) return "customer";
  } catch {}
  return "guest";
}

export async function logError(
  errorOrMessage: unknown,
  options: LogErrorOptions = {}
): Promise<void> {
  try {
    let message: string;
    let stack: string | undefined;
    let errorType: string | undefined = options.errorType;

    if (errorOrMessage instanceof Error) {
      message = errorOrMessage.message;
      stack = errorOrMessage.stack;
      errorType = errorType || errorOrMessage.name;
    } else if (typeof errorOrMessage === "string") {
      message = errorOrMessage;
    } else {
      message = options.message || String(errorOrMessage || "Unknown error");
    }

    if (shouldIgnore(message, stack, options.sourceUrl)) return;

    // If the error looks like a stale-chunk crash from an old deploy,
    // auto-recover by reloading once. Don't bother logging the noise.
    maybeReloadOnStaleChunk(message, stack);
    if (isStaleChunkError(message, stack)) return;

    const fp = fingerprint(message, stack, errorType);
    const now = Date.now();
    const last = recentFingerprints.get(fp);
    if (last && now - last < DEDUP_WINDOW_MS) return;
    recentFingerprints.set(fp, now);

    // Cleanup map periodically
    if (recentFingerprints.size > 200) {
      for (const [k, t] of recentFingerprints) {
        if (now - t > DEDUP_WINDOW_MS) recentFingerprints.delete(k);
      }
    }

    await supabase.rpc("log_error_event", {
      p_message: message,
      p_stack: stack || null,
      p_error_type: errorType || null,
      p_source_url: options.sourceUrl || (typeof window !== "undefined" ? window.location.href : null),
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      p_visitor_profile_id: getVisitorProfileId(),
      p_user_role: getUserRole(),
      p_severity: options.severity || "error",
      p_context: (options.context as any) || {},
      p_fingerprint: fp,
    });
  } catch {
    // Never throw from the logger
  }
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const err = event.error;
    void logError(err || event.message, {
      severity: "error",
      errorType: "window.error",
      sourceUrl: event.filename || undefined,
      context: { lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    void logError(reason instanceof Error ? reason : String(reason), {
      severity: "error",
      errorType: "unhandledrejection",
    });
  });
}
