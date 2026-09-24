// 🔒 DO_NOT_MODIFY_START — Facebook Pixel & Meta CAPI tracking (full file locked)
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ttFire } from "@/components/TikTokPixel";

// Prevent duplicate script injection across re-renders
let pixelInitialized = false;
let gtmInitialized = false;
let lastPageViewPath = "";

// Global short-window dedup so the same event can never be sent twice
const recentEvents = new Map<string, number>();
export function isDuplicateEvent(key: string, windowMs = 10000) {
  const now = Date.now();
  for (const [k, t] of recentEvents) if (now - t > 60000) recentEvents.delete(k);
  const last = recentEvents.get(key);
  if (last && now - last < windowMs) return true;
  recentEvents.set(key, now);
  return false;
}

// Active Pixel ID (from app_settings) — used with trackSingle so events reach exactly
// ONE pixel instance, even if GTM also initialises the same Pixel ID.
let activePixelId: string | null = null;
const browserEventIds = new Set<string>();
const capiEventIds = new Set<string>();
let eventSequence = 0;

function createEventId(prefix: string) {
  eventSequence += 1;
  return `${prefix}_${Date.now()}_${eventSequence}`;
}
export function getActivePixelId() {
  return activePixelId;
}

export function fbqTrackSingle(eventName: string, customData: Record<string, unknown> = {}, eventId?: string) {
  const w = window as any;
  const opts = eventId ? { eventID: eventId } : undefined;
  if (!activePixelId || !w.fbq) return false;
  if (eventId && browserEventIds.has(eventId)) return true;
  // fbq queues trackSingle while the network library is loading. Never fall back
  // to generic `track`: it broadcasts to every Pixel instance (including any
  // instance installed through GTM) and is the source of duplicate events.
  if (opts) w.fbq("trackSingle", activePixelId, eventName, customData, opts);
  else w.fbq("trackSingle", activePixelId, eventName, customData);
  if (eventId) browserEventIds.add(eventId);
  return true;
}

function fireFbqTrack(eventName: string, customData: Record<string, unknown> = {}, eventId?: string, attempt = 0) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (eventId && browserEventIds.has(eventId)) return;
  // Wait for both the dashboard-controlled Pixel ID and fbq. Sending before the
  // ID is loaded would require generic `track`, which can fan out to GTM Pixels.
  if (w.fbq && activePixelId) {
    try {
      fbqTrackSingle(eventName, customData, eventId);
    } catch (e) {
      console.warn("fbq track failed", eventName, e);
    }
    return;
  }
  // Pixel ID loads async from settings; keep retrying so first-click/cart/order events do not drop.
  if (attempt < 300) {
    setTimeout(() => fireFbqTrack(eventName, customData, eventId, attempt + 1), 100);
  }
}




/** Push a GTM dataLayer event (GA4 tags in GTM listen for these). Safe no-op if GTM not loaded. */
export function dlPush(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as any;
  // If a visitor entered a landing page through SPA navigation, a previously
  // loaded GTM container cannot be unloaded. Do not feed it commerce events,
  // because a Meta tag inside that container would create a second event.
  if (window.location.pathname.startsWith("/lp/") && (w.google_tag_manager || document.getElementById("gtm-script"))) return;
  // Guard against the same dataLayer event being pushed twice (GTM tags would double-count)
  if (isDuplicateEvent(`dl:${event}:${JSON.stringify(payload)}`, 5000)) return;
  w.dataLayer = w.dataLayer || [];
  // Clear previous ecommerce object to avoid data bleed between events
  if (payload.ecommerce !== undefined) w.dataLayer.push({ ecommerce: null });
  w.dataLayer.push({ event, ...payload });
}

export default function TrackingScripts() {
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [gtmId, setGtmId] = useState<string | null>(null);
  const location = useLocation();
  const prevPathRef = useRef<string>("");
  const isAdmin = location.pathname.startsWith("/e");
  // Landing pages use the app-owned Meta Pixel directly. Loading GTM there can
  // duplicate commerce events when the container also has a Meta Pixel tag.
  const isLandingPage = location.pathname.startsWith("/lp/");

  // Fetch dashboard-controlled tracking IDs with retry. A transient settings
  // request must not disable browser events for the rest of the page session.
  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    let retryTimer: number | undefined;
    const load = async (attempt = 0) => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["meta_pixel_id", "gtm_id"]);
      if (cancelled) return;
      if (error) {
        if (attempt < 5) retryTimer = window.setTimeout(() => void load(attempt + 1), 500 * (attempt + 1));
        return;
      }
      data?.forEach((r) => {
        if (r.key === "meta_pixel_id" && r.value) { activePixelId = r.value; setPixelId(r.value); }
        if (r.key === "gtm_id" && r.value) setGtmId(r.value);
      });
    };
    void load();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [isAdmin]);

  // Meta Pixel — inject ONCE
  useEffect(() => {
    if (!pixelId || pixelInitialized || isAdmin) return;
    pixelInitialized = true;

    const w = window as any;
    if (!w.fbq) {
      const fbq: any = function (...args: any[]) {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
        else fbq.queue.push(args);
      };
      w.fbq = fbq;
      w._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
    }

    const queuedInit = Array.isArray(w.fbq.queue)
      && w.fbq.queue.some((args: unknown[]) => args?.[0] === "init" && String(args?.[1]) === pixelId);
    let initializedAlready = queuedInit;
    try {
      const state = w.fbq.getState?.();
      initializedAlready = initializedAlready || !!state?.pixels?.some((p: { id?: string }) => String(p.id) === pixelId);
    } catch {}
    if (!initializedAlready) w.fbq("init", pixelId);

    if (!document.getElementById("meta-pixel-script")) {
      const script = document.createElement("script");
      script.id = "meta-pixel-script";
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }

    const noscript = document.createElement("noscript");
    noscript.id = "meta-pixel-noscript";
    noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
    document.body.appendChild(noscript);
  }, [pixelId, isAdmin]);


  // Track PageView on mount + every route change (with retry until fbq ready)
  useEffect(() => {
    if (!pixelId || isAdmin) return;
    prevPathRef.current = location.pathname;
    // Module-level path survives component remounts, preventing a remount on the
    // same URL from being misread as a new navigation and double-counted.
    if (lastPageViewPath === location.pathname) return;
    const isInitialPageView = lastPageViewPath === "";
    lastPageViewPath = location.pathname;
    fireFbqTrack('PageView', {}, createEventId('pv'));
    if (!isInitialPageView) {
      dlPush('page_view', { page_path: location.pathname, page_location: window.location.href });
    }
  }, [location.pathname, pixelId, isAdmin]);

  // GTM — inject ONCE
  useEffect(() => {
    if (!gtmId || gtmInitialized || isAdmin || isLandingPage) return;
    gtmInitialized = true;

    const script = document.createElement("script");
    script.id = "gtm-script";
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
    `;
    document.head.appendChild(script);
  }, [gtmId, isAdmin, isLandingPage]);

  return null;
}

/**
 * Helper: Fire a Meta Pixel Purchase event with deduplication.
 * Call this from OrderConfirmed page ONCE.
 * 
 * Usage:
 *   import { trackPurchase } from "@/components/TrackingScripts";
 *   trackPurchase(orderId, totalAmount, "BDT");
 */
export function trackPurchase(orderId: string, value: number, currency = "BDT", phone?: string, customerName?: string) {
  const eventId = `purchase_${orderId}`;
  if (isDuplicateEvent(`meta:${eventId}`, 3600000)) return;

  
  // 1. Browser-side Pixel (if available)
  fireFbqTrack('Purchase', {
    value,
    currency,
    content_type: 'product',
  }, eventId);

  // 2. GTM dataLayer (GA4 purchase)
  dlPush('purchase', {
    ecommerce: {
      transaction_id: orderId,
      value,
      currency,
    },
  });

  // 3. Server-side Conversions API (deduplicated by same event_id)
  const userData: Record<string, string> = {};
  if (phone) userData.ph = phone;
  if (customerName) userData.fn = customerName;

  if (!capiEventIds.has(eventId)) {
    capiEventIds.add(eventId);
    supabase.functions.invoke("meta-capi", {
    body: {
      event_name: "Purchase",
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: { value, currency, content_type: "product" },
      user_data: userData,
    },
    }).catch((err) => console.warn("CAPI Purchase event failed:", err));
  }
  ttFire("Purchase", eventId, { value, currency, content_type: "product" }, userData);
}

/**
 * Helper: Fire AddToCart event with deduplication + server-side CAPI.
 */
export function trackAddToCart(productId: string, value: number, currency = "BDT") {
  const eventId = createEventId(`atc_${productId}`);



  // 1. Browser-side Pixel
  fireFbqTrack('AddToCart', {
    value,
    currency,
    content_ids: [productId],
    content_type: 'product',
  }, eventId);

  // 2. GTM dataLayer (GA4 add_to_cart)
  dlPush('add_to_cart', {
    ecommerce: {
      currency,
      value,
      items: [{ item_id: productId, quantity: 1, price: value }],
    },
  });

  // 3. Server-side CAPI
  if (!capiEventIds.has(eventId)) {
    capiEventIds.add(eventId);
    supabase.functions.invoke("meta-capi", {
    body: {
      event_name: "AddToCart",
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: { value, currency, content_ids: [productId], content_type: "product" },
    },
    }).catch((err) => console.warn("CAPI AddToCart event failed:", err));
  }
  ttFire("AddToCart", eventId, { value, currency, content_ids: [productId], content_type: "product" });
}

/**
 * Helper: Fire InitiateCheckout event with deduplication + server-side CAPI.
 * Call once when customer lands on the checkout page.
 */
export function trackInitiateCheckout(value: number, numItems: number, currency = "BDT") {
  const eventId = createEventId("ic");



  // 1. Browser-side Pixel
  fireFbqTrack('InitiateCheckout', {
    value,
    currency,
    num_items: numItems,
    content_type: 'product',
  }, eventId);

  // 2. GTM dataLayer (GA4 begin_checkout)
  dlPush('begin_checkout', {
    ecommerce: {
      currency,
      value,
      items: Array.from({ length: numItems }, (_, i) => ({ item_id: `item_${i}`, quantity: 1 })),
    },
  });

  // 3. Server-side CAPI
  if (!capiEventIds.has(eventId)) {
    capiEventIds.add(eventId);
    supabase.functions.invoke("meta-capi", {
    body: {
      event_name: "InitiateCheckout",
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: { value, currency, num_items: numItems, content_type: "product" },
    },
    }).catch((err) => console.warn("CAPI InitiateCheckout event failed:", err));
  }
  ttFire("InitiateCheckout", eventId, { value, currency, content_type: "product" });
}
// 🔒 DO_NOT_MODIFY_END
