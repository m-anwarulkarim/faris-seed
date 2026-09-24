import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isBot } from "@/lib/botDetect";

const VISITOR_ID_KEY = "visitor-id";

function getVisitorId(): string | null {
  try { return localStorage.getItem(VISITOR_ID_KEY); } catch { return null; }
}

function getProfileId(): string | null {
  try {
    const s = localStorage.getItem("customer-session");
    return s ? JSON.parse(s).profileId || null : null;
  } catch { return null; }
}

export type AnalyticsEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "order_placed";

export async function trackEvent(
  eventType: AnalyticsEventType,
  extra?: {
    productId?: string;
    productName?: string;
    category?: string;
    pagePath?: string;
    metadata?: Record<string, unknown>;
  }
) {
  if (isBot()) return; // Skip analytics for bots
  try {
    await supabase.from("analytics_events").insert([{
      event_type: eventType,
      visitor_id: getVisitorId(),
      visitor_profile_id: getProfileId(),
      product_id: extra?.productId || null,
      product_name: extra?.productName || null,
      category: extra?.category || null,
      page_path: extra?.pagePath || window.location.pathname,
      metadata: (extra?.metadata || {}) as any,
    }]);
  } catch {
    // silent fail
  }
}

/** Track page view once per path */
export function usePageViewTracker() {
  const lastPath = useRef("");
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== lastPath.current && !path.startsWith("/e")) {
      lastPath.current = path;
      trackEvent("page_view", { pagePath: path });
    }
  }, []);
}

/** Track product view */
export function useProductViewTracker(product: { id?: string | null; name?: string | null; category?: string | null } | null | undefined) {
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (product?.id && tracked.current !== product.id) {
      tracked.current = product.id;
      trackEvent("product_view", {
        productId: product.id,
        productName: product.name || undefined,
        category: product.category || undefined,
      });
    }
  }, [product?.id]);
}
