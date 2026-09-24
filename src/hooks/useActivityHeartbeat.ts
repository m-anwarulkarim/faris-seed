import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerSession } from "@/components/CustomerLogin";

const HEARTBEAT_INTERVAL = 5 * 60_000; // 5 minutes (Cloud cost optimization — was 3 min)
const VISIBILITY_DEBOUNCE = 5_000; // Don't send heartbeat more than once per 5s on tab focus

export function useActivityHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef<number>(0);

  const sendHeartbeat = useCallback(async () => {
    const session = getCustomerSession();
    if (!session?.profile_id) return;

    const now = Date.now();
    // Debounce: skip if sent less than 5s ago
    if (now - lastSentRef.current < VISIBILITY_DEBOUNCE) return;
    lastSentRef.current = now;

    await supabase
      .from("visitor_profiles")
      .update({ last_active_at: new Date().toISOString() } as any)
      .eq("id", session.profile_id);
  }, []);

  useEffect(() => {
    // Send immediately on mount
    sendHeartbeat();

    // Then every minute
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Debounced visibility change handler
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [sendHeartbeat]);
}
