import { lazy as reactLazy, ComponentType, LazyExoticComponent } from "react";

type Factory = () => Promise<any>;

const RELOAD_KEY = "__lazy_retry_reload_at__";

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    const url = new URL(window.location.href);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    /* ignore */
  }
}

/**
 * React.lazy with:
 *  - retry on a failed/stale chunk fetch (one silent retry, then a cache-busting reload)
 *  - a guard so a module resolving without a `default` export never crashes the router
 *    with "Cannot read properties of undefined (reading 'default')".
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: Factory
): LazyExoticComponent<T> {
  return reactLazy(async () => {
    let mod: any;
    try {
      mod = await factory();
    } catch {
      // Chunk fetch failed (stale deploy / flaky network) — retry once.
      try {
        await new Promise((r) => setTimeout(r, 400));
        mod = await factory();
      } catch {
        reloadOnce();
        return { default: (() => null) as unknown as T };
      }
    }

    if (mod && typeof mod === "object" && "default" in mod && mod.default) {
      return mod as { default: T };
    }

    // Module resolved but has no usable default export (interop/stale chunk).
    const named = mod && typeof mod === "object"
      ? Object.values(mod).find((v) => typeof v === "function")
      : undefined;
    if (named) return { default: named as T };

    reloadOnce();
    return { default: (() => null) as unknown as T };
  });
}
