// Meta Pixel + CAPI helpers for events NOT already in TrackingScripts.tsx.
// (PageView / AddToCart / InitiateCheckout / Purchase live in TrackingScripts.tsx)
import { supabase } from "@/integrations/supabase/client";
import { getActivePixelId, isDuplicateEvent, dlPush as sharedDlPush, fbqTrackSingle } from "@/components/TrackingScripts";
import { ttFire } from "@/components/TikTokPixel";

type UserData = { ph?: string; em?: string; fn?: string; ln?: string };

function fireFbq(event: string, eventId: string, customData: Record<string, unknown>, attempt = 0) {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.fbq && getActivePixelId()) {
    try {
      fbqTrackSingle(event, customData, eventId);
    } catch {}
    return;
  }
  // Pixel ID loads async from settings; keep retrying so early product events do not drop.
  if (attempt < 300) {
    setTimeout(() => fireFbq(event, eventId, customData, attempt + 1), 100);
  }
}

function fireCapi(
  event: string,
  eventId: string,
  customData: Record<string, unknown>,
  userData: UserData = {}
) {
  supabase.functions
    .invoke("meta-capi", {
      body: {
        event_name: event,
        event_id: eventId,
        event_source_url: typeof window !== "undefined" ? window.location.href : "",
        custom_data: customData,
        user_data: userData,
      },
    })
    .catch((err) => console.warn(`CAPI ${event} failed:`, err));
}

const dlPush = sharedDlPush;

function fire(
  event: string,
  eventId: string,
  customData: Record<string, unknown> = {},
  userData: UserData = {}
) {
  if (isDuplicateEvent(`meta:${eventId}`, 30000)) return;
  fireFbq(event, eventId, customData);
  fireCapi(event, eventId, customData, userData);
  if (event === "ViewContent") {
    ttFire("ViewContent", eventId, customData, userData);
  }
}

/** Product details page open */
export function trackViewContent(productId: string, productName?: string, value?: number, currency = "BDT") {
  fire("ViewContent", `vc_${productId}_${Math.floor(Date.now() / 30000)}`, {
    value,
    currency,
    content_ids: [productId],
    content_name: productName,
    content_type: "product",
  });
  dlPush("view_item", {
    ecommerce: {
      currency,
      value,
      items: [{ item_id: productId, item_name: productName, price: value, quantity: 1 }],
    },
  });
}

/** Search bar query (deduped per term per session) */
const _searchSent = new Set<string>();
export function trackSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  const key = q.toLowerCase();
  if (_searchSent.has(key)) return;
  _searchSent.add(key);
  fire("Search", `s_${key}_${Date.now()}`, { search_string: q });
}

/** Wishlist add */
export function trackAddToWishlist(productId: string, value?: number, currency = "BDT") {
  fire("AddToWishlist", `wl_${productId}_${Date.now()}`, {
    value,
    currency,
    content_ids: [productId],
    content_type: "product",
  });
}

/** Payment method selected */
export function trackAddPaymentInfo(method: string, value?: number, currency = "BDT") {
  fire("AddPaymentInfo", `api_${method}_${Date.now()}`, {
    value,
    currency,
    payment_method: method,
  });
}

/** Contact form submit */
export function trackLead(value?: number, currency = "BDT", userData: UserData = {}) {
  fire("Lead", `lead_${Date.now()}`, { value, currency }, userData);
}

/** WhatsApp / Messenger / Call click */
export function trackContact(channel: "whatsapp" | "messenger" | "call" | "email" | "facebook" | string) {
  fire("Contact", `ct_${channel}_${Date.now()}`, { contact_method: channel });
}

/** Account signup */
export function trackCompleteRegistration(method = "phone", userData: UserData = {}) {
  fire("CompleteRegistration", `cr_${Date.now()}`, { registration_method: method, status: true }, userData);
}
