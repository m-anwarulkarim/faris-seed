import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

let initialized = false;
const sentEventIds = new Set<string>();

/** Fire a TikTok event on browser pixel + server-side CAPI (deduplicated by event_id). */
export function ttFire(
  event: "Purchase" | "AddToCart" | "InitiateCheckout" | "ViewContent",
  eventId: string,
  customData: { value?: number; currency?: string; content_ids?: string[]; content_type?: string } = {},
  userData: { ph?: string; em?: string } = {}
) {
  if (sentEventIds.has(eventId)) return;
  sentEventIds.add(eventId);
  const w = window as any;
  if (w.ttq) {
    w.ttq.track(event, {
      value: customData.value,
      currency: customData.currency || "BDT",
      contents: customData.content_ids?.map((id) => ({ content_id: id, content_type: customData.content_type || "product" })),
    }, { event_id: eventId });
  }
  supabase.functions.invoke("tiktok-capi", {
    body: {
      event_name: event,
      event_id: eventId,
      event_source_url: typeof window !== "undefined" ? window.location.href : "",
      custom_data: customData,
      user_data: userData,
    },
  }).catch((err) => console.warn("TikTok CAPI failed:", err));
}


export default function TikTokPixel() {
  const location = useLocation();
  const prevPath = useRef<string>("");
  const isAdmin = location.pathname.startsWith("/e");
  const [pixelId, setPixelId] = useState<string | null>(null);

  // Fetch pixel ID from app_settings
  useEffect(() => {
    if (isAdmin) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "tiktok_pixel_id")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setPixelId(data.value);
      });
  }, [isAdmin]);

  // Inject ONCE (skip on admin routes or until pixel ID is loaded)
  useEffect(() => {
    if (initialized || isAdmin || !pixelId) return;
    initialized = true;

    const script = document.createElement("script");
    script.id = "tiktok-pixel-script";
    script.innerHTML = `
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
        ttq.load('${pixelId}');
        ttq.page();
      }(window, document, 'ttq');
    `;
    document.head.appendChild(script);

  }, [isAdmin, pixelId]);


  // Track page changes
  useEffect(() => {
    if (isAdmin || !initialized) return;
    if (prevPath.current === "") {
      prevPath.current = location.pathname;
      return;
    }
    if (prevPath.current !== location.pathname) {
      prevPath.current = location.pathname;
      const w = window as any;
      if (w.ttq) w.ttq.page();
    }
  }, [location.pathname, isAdmin]);

  return null;
}
