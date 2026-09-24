import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// This is a PUBLIC key — safe to include in client code
const VAPID_PUBLIC_KEY = "BK3qJDKKSZmCBWJqE6tG3lEp_QQPtqZNZYKW0TnxiQXsunYsr8_tPTOQg039RsmKLk6NofX1MgV4bgPFNqK1IVI";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotification() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      }
    } catch {
      // ignore
    }
  };

  const subscribe = useCallback(async (visitorId?: string | null, visitorProfileId?: string | null, userId?: string | null) => {
    if (!isSupported) return false;
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      // Register SW if not already
      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
        // Wait for activation
        await new Promise<void>((resolve) => {
          if (reg!.active) return resolve();
          const sw = reg!.installing || reg!.waiting;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "activated") resolve();
          });
        });
      }

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const subJson = sub.toJSON();
      const endpoint = sub.endpoint;
      const p256dh = subJson.keys?.p256dh || "";
      const auth = subJson.keys?.auth || "";

      // Save to database (upsert by endpoint)
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            endpoint,
            p256dh,
            auth,
            visitor_id: visitorId || null,
            visitor_profile_id: visitorProfileId || null,
            user_id: userId || null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "endpoint" }
        );

      if (error) throw error;

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      setLoading(false);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          // Remove from DB
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe failed:", err);
    }
  }, []);

  return { permission, isSupported, isSubscribed, loading, subscribe, unsubscribe };
}
