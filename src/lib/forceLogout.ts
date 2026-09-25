import { clearCustomerSession } from "@/components/CustomerLogin";
import { toast } from "sonner";

let inProgress = false;

/**
 * Wipe all customer-side caches and force the user back to login.
 * Triggered when the server invalidates their session (e.g. user_type
 * changed by an admin → pricing/cashback rules differ).
 */
export function forceCustomerLogout(reason: "user_type_changed" | "session_revoked" = "session_revoked") {
  if (inProgress) return;
  inProgress = true;

  try {
    // 1. Clear the auth session itself
    clearCustomerSession();

    // 2. Wipe customer-scoped localStorage keys
    const KEY_PATTERNS = [
      /^customer-/i,
      /^cart/i,
      /^wishlist/i,
      /^post-order/i,
      /^ai-chat/i,
      /^address-parse-cache/i,
      /^fraud-check-cache/i,
      /^visitor-/i,
      /^mina-/i,
      /^profile-/i,
      /^checkout-/i,
    ];
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (KEY_PATTERNS.some((re) => re.test(k))) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      /* ignore */
    }

    // 3. Wipe session storage entirely
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }

    // 4. Best-effort: clear React Query cache via global hook (if exposed)
    try {
      const qc = (window as any).__queryClient;
      if (qc?.clear) qc.clear();
    } catch {
      /* ignore */
    }

    // 5. Notify and redirect
    const message =
      reason === "user_type_changed"
        ? "আপনার অ্যাকাউন্ট আপডেট হয়েছে। অনুগ্রহ করে আবার লগইন করুন।"
        : "আপনার সেশন বাতিল হয়েছে। অনুগ্রহ করে আবার লগইন করুন।";
    try {
      toast.info(message, { duration: 4000 });
    } catch {
      /* ignore */
    }

    setTimeout(() => {
      // Hard reload so all React state is fresh and chunks reload too.
      window.location.replace("/auth");
    }, 1500);
  } catch {
    inProgress = false;
  }
}
