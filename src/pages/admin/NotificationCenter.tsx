import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellRing, Inbox, MessageSquare, BarChart3 } from "lucide-react";
import { usePushNotification } from "@/hooks/usePushNotification";
import { toast } from "sonner";
import OrderNotifications from "./OrderNotifications";
import SmsLogs from "./SmsLogs";
import { OwnerAlertToggles } from "@/components/admin/OwnerAlertToggles";

function PromptStatsCard() {
  const { t } = useLanguage();

  const { data: stats } = useQuery({
    queryKey: ["push-prompt-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_prompt_events" as any)
        .select("action");
      if (error) throw error;
      const items = (data || []) as any[];
      const subscribed = items.filter((e: any) => e.action === "subscribed").length;
      const dismissed = items.filter((e: any) => e.action === "dismissed").length;
      const total = subscribed + dismissed;
      return { subscribed, dismissed, total };
    },
    refetchInterval: 60000, // Cloud cost: was 30s
  });

  if (!stats || stats.total === 0) return null;

  const subRate = stats.total > 0 ? Math.round((stats.subscribed / stats.total) * 100) : 0;
  const dismissRate = stats.total > 0 ? Math.round((stats.dismissed / stats.total) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("প্রম্পট পরিসংখ্যান", "Prompt Analytics")}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-muted/50 rounded-lg p-2.5">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">{t("মোট প্রম্পট", "Total Prompts")}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5">
          <p className="text-lg font-bold text-green-600">{stats.subscribed}</p>
          <p className="text-[10px] text-muted-foreground">{t(`সাবস্ক্রাইব (${subRate}%)`, `Subscribed (${subRate}%)`)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5">
          <p className="text-lg font-bold text-orange-500">{stats.dismissed}</p>
          <p className="text-[10px] text-muted-foreground">{t(`ইগনোর (${dismissRate}%)`, `Dismissed (${dismissRate}%)`)}</p>
        </div>
      </div>
    </div>
  );
}

export default function NotificationCenter() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const defaultTab = location.pathname.includes("/sms") ? "sms" : "orders";
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotification();

  const unreadInboxCount = 0;

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast.success(t("পুশ নোটিফিকেশন বন্ধ করা হয়েছে", "Push notifications disabled"));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const success = await subscribe(null, null, user?.id || null);
      if (success) {
        toast.success(t("পুশ নোটিফিকেশন চালু হয়েছে!", "Push notifications enabled!"));
      } else {
        toast.error(t("নোটিফিকেশন পারমিশন দেওয়া হয়নি", "Notification permission denied"));
      }
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t("নোটিফিকেশন সেন্টার", "Notification Center")}</h1>
        {isSupported && (
          <Button
            variant={isSubscribed ? "secondary" : "default"}
            size="sm"
            onClick={handleTogglePush}
            disabled={loading}
            className="gap-1.5"
          >
            <BellRing className="w-4 h-4" />
            {isSubscribed
              ? t("🔔 পুশ চালু", "🔔 Push On")
              : t("🔕 পুশ চালু করুন", "🔕 Enable Push")}
          </Button>
        )}
      </div>

      <OwnerAlertToggles />

      <PromptStatsCard />

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="orders" className="gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            {t("অর্ডার স্ট্যাটাস", "Order Status")}
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            {t("SMS লগ", "SMS Log")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrderNotifications />
        </TabsContent>
        <TabsContent value="sms">
          <SmsLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
