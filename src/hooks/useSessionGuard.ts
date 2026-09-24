import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getCustomerSession,
  getSessionToken,
  setCustomerSession,
} from "@/components/CustomerLogin";
import { forceCustomerLogout } from "@/lib/forceLogout";

/**
 * Watches the logged-in customer's profile for server-side session
 * invalidation (e.g. admin changed their user_type). On mismatch,
 * forces a clean logout + cache wipe across all tabs.
 *
 * Detection paths:
 *  1. Initial check on mount.
 *  2. Realtime subscription on the profile row → instant detection.
 *  3. Polling every 2 minutes as a safety net (offline → online).
 *  4. Re-check on tab focus.
 */
export function useSessionGuard() {
  const checkingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function check() {
      if (cancelled || checkingRef.current) return;
      checkingRef.current = true;
      try {
        const session = getCustomerSession();
        const localToken = getSessionToken();
        if (!session?.profile_id || !localToken) return;

        const { data, error } = await supabase
          .from("visitor_profiles")
          .select("session_token, user_type")
          .eq("id", session.profile_id)
          .maybeSingle();

        if (error || !data) return; // network / RLS issue → don't punish user
        if (cancelled) return;

        if (!data.session_token || data.session_token !== localToken) {
          forceCustomerLogout("session_revoked");
          return;
        }

        // Sync user_type silently if it drifted (e.g. same token but admin
        // touched an unrelated field — rare safety net).
        if (
          data.user_type &&
          (session.user_type ?? null) !== data.user_type
        ) {
          setCustomerSession({ ...session, user_type: data.user_type });
        }
      } finally {
        checkingRef.current = false;
      }
    }

    function subscribe() {
      const session = getCustomerSession();
      if (!session?.profile_id) return;
      channel = supabase
        .channel(`profile-guard-${session.profile_id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "visitor_profiles",
            filter: `id=eq.${session.profile_id}`,
          },
          () => {
            void check();
          }
        )
        .subscribe();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void check();
    }

    void check();
    subscribe();
    pollTimer = window.setInterval(check, 2 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (pollTimer) window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);
}
