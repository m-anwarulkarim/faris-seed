import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LockInfo {
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  user_photo: string | null;
  locked_at: string;
  heartbeat_at?: string;
}

interface UseOrderEditLockReturn {
  isLocked: boolean;
  lockHolder: LockInfo | null;
  showWarning: boolean;
  wasKicked: boolean;
  acquireLock: () => Promise<void>;
  dismissWarning: () => void;
  forceAcquire: () => Promise<void>;
}

const HEARTBEAT_INTERVAL = 15_000; // 15s
const LOCK_EXPIRY = 45_000; // 45s - lock expires if no heartbeat

export function useOrderEditLock(orderId: string | undefined): UseOrderEditLockReturn {
  const [lockHolder, setLockHolder] = useState<LockInfo | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [wasKicked, setWasKicked] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLockRef = useRef(false);

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setMyUserId(session.user.id);
    });
  }, []);

  const isLocked = !!lockHolder && lockHolder.user_id !== myUserId;

  // Check existing lock
  const checkLock = useCallback(async () => {
    if (!orderId) return null;
    const { data } = await supabase
      .from("order_edit_locks")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!data) return null;

    // Check if lock expired
    const heartbeatAge = Date.now() - new Date(data.heartbeat_at).getTime();
    if (heartbeatAge > LOCK_EXPIRY) {
      await supabase.from("order_edit_locks").delete().eq("order_id", orderId);
      return null;
    }

    return data as unknown as LockInfo & { order_id: string };
  }, [orderId]);

  // Acquire lock
  const acquireLock = useCallback(async () => {
    if (!orderId || !myUserId) return;

    const existing = await checkLock();
    if (existing && existing.user_id !== myUserId) {
      setLockHolder(existing);
      setShowWarning(true);
      return;
    }

    await doAcquire();
  }, [orderId, myUserId, checkLock]);

  const doAcquire = useCallback(async () => {
    if (!orderId || !myUserId) return;

    const { data: session } = await supabase.auth.getSession();
    const email = session?.session?.user?.email || null;

    // Get admin name
    let name: string | null = null;
    let photo: string | null = null;
    try {
      const { data } = await supabase.functions.invoke("manage-admin", {
        body: { action: "lookup", user_id: myUserId },
      });
      name = data?.name || email;
      photo = data?.photo || null;
    } catch {
      name = email;
    }

    // Upsert lock
    await supabase.from("order_edit_locks").upsert(
      {
        order_id: orderId,
        user_id: myUserId,
        user_email: email,
        user_name: name,
        user_photo: photo,
        locked_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      } as any,
      { onConflict: "order_id" }
    );

    hasLockRef.current = true;
    setLockHolder(null);
    setShowWarning(false);
    startHeartbeat();
  }, [orderId, myUserId]);

  // Force acquire (kick previous user)
  const forceAcquire = useCallback(async () => {
    await doAcquire();
  }, [doAcquire]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
  }, []);

  // Heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      if (!orderId || !myUserId) return;
      await supabase
        .from("order_edit_locks")
        .update({ heartbeat_at: new Date().toISOString() })
        .eq("order_id", orderId)
        .eq("user_id", myUserId);
    }, HEARTBEAT_INTERVAL);
  }, [orderId, myUserId]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (orderId && hasLockRef.current) {
        supabase.from("order_edit_locks").delete().eq("order_id", orderId).then(() => {});
      }
    };
  }, [orderId]);

  // Auto acquire on mount
  useEffect(() => {
    if (orderId && myUserId) {
      acquireLock();
    }
  }, [orderId, myUserId]);

  // Realtime: listen for lock changes (someone else took over)
  useEffect(() => {
    if (!orderId || !myUserId) return;

    const channel = supabase
      .channel(`order-lock-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_edit_locks",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const newData = payload.new as any;
            if (newData.user_id !== myUserId && hasLockRef.current) {
              // Someone else took over
              hasLockRef.current = false;
              if (heartbeatRef.current) clearInterval(heartbeatRef.current);
              setWasKicked(true);
              setLockHolder({
                user_id: newData.user_id,
                user_email: newData.user_email,
                user_name: newData.user_name,
                user_photo: newData.user_photo || null,
                locked_at: newData.locked_at,
                heartbeat_at: newData.heartbeat_at,
              });
            }
          }
          if (payload.eventType === "DELETE") {
            // Lock released
            if (!hasLockRef.current) {
              setLockHolder(null);
              setWasKicked(false);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, myUserId]);

  return {
    isLocked,
    lockHolder,
    showWarning,
    wasKicked,
    acquireLock,
    dismissWarning,
    forceAcquire,
  };
}
