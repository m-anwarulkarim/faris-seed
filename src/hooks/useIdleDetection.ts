import { useState, useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT = 2 * 60 * 1000; // 2 minutes

/**
 * Returns `true` when the user has been idle (no mouse/keyboard/touch activity) for 2+ minutes.
 * All react-query polling should be paused when idle.
 */
export function useIdleDetection(): boolean {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const resetTimer = useCallback(() => {
    if (idle) setIdle(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT);
  }, [idle]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    // Start timer immediately
    timerRef.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  return idle;
}
