import { useState, useEffect } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotification } from "@/hooks/usePushNotification";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";

const DISMISS_KEY = "push_prompt_dismissed_at";

export function PushNotificationPrompt() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { isSupported, isSubscribed, loading, subscribe } = usePushNotification();
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!isMobile || !isSupported || isSubscribed) return;

    // Don't show if dismissed in the last 24 hours
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 24 * 60 * 60 * 1000) return;

    // Show after a short delay for better UX
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [isMobile, isSupported, isSubscribed]);

  if (!visible || isSubscribed) return null;

  const handleSubscribe = async () => {
    setSubscribing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const success = await subscribe(null, null, user?.id || null);
    setSubscribing(false);
    if (success) {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl border bg-background shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
            <BellRing className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground">
              {t("🔔 পুশ নোটিফিকেশন চালু করুন", "🔔 Enable Push Notifications")}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t(
                "নতুন অর্ডার, সন্দেহজনক মেসেজ, এবং গুরুত্বপূর্ণ আপডেট সরাসরি নোটিফিকেশনে পাবেন — ব্রাউজার বন্ধ থাকলেও।",
                "Get instant alerts for new orders, flagged messages, and important updates — even when the browser is closed."
              )}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleSubscribe}
                disabled={subscribing || loading}
                className="gap-1.5 text-xs h-8"
              >
                <Bell className="w-3.5 h-3.5" />
                {subscribing
                  ? t("চালু হচ্ছে...", "Enabling...")
                  : t("চালু করুন", "Enable")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs h-8 text-muted-foreground"
              >
                {t("পরে", "Later")}
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
