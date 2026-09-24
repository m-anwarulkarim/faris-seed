import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, ShoppingCart, CheckCircle, XCircle, Clock, Package, Truck, RotateCcw, Printer } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

const actionConfig: Record<string, { label: string; labelBn: string; icon: React.ElementType; color: string }> = {
  created: { label: "New Order", labelBn: "নতুন অর্ডার", icon: ShoppingCart, color: "bg-blue-500" },
  pending: { label: "Pending", labelBn: "পেন্ডিং", icon: Clock, color: "bg-yellow-500" },
  confirmed: { label: "Confirmed", labelBn: "কনফার্মড", icon: CheckCircle, color: "bg-green-500" },
  cancelled: { label: "Cancelled", labelBn: "ক্যানসেলড", icon: XCircle, color: "bg-red-500" },
  hold: { label: "Hold", labelBn: "হোল্ড", icon: Clock, color: "bg-orange-500" },
  printed: { label: "Printed", labelBn: "প্রিন্টেড", icon: Printer, color: "bg-purple-500" },
  shipped: { label: "Shipped", labelBn: "শিপড", icon: Truck, color: "bg-indigo-500" },
  delivered: { label: "Delivered", labelBn: "ডেলিভারড", icon: Package, color: "bg-emerald-500" },
  delivered_approval_pending: { label: "DAP", labelBn: "DAP", icon: Package, color: "bg-emerald-400" },
  partial: { label: "Partial", labelBn: "পার্শিয়াল", icon: Package, color: "bg-amber-500" },
  partial_delivered: { label: "P-Delivered", labelBn: "পার্শিয়াল ডেলিভারড", icon: Package, color: "bg-amber-500" },
  partial_delivered_approval_pending: { label: "P-DAP", labelBn: "P-DAP", icon: Package, color: "bg-amber-400" },
  return: { label: "Return", labelBn: "রিটার্ন", icon: RotateCcw, color: "bg-rose-500" },
  pending_return: { label: "Pending Return", labelBn: "পেন্ডিং রিটার্ন", icon: RotateCcw, color: "bg-yellow-500" },
  cancelled_approval_pending: { label: "C-AP", labelBn: "C-AP", icon: RotateCcw, color: "bg-yellow-400" },
  entry_done: { label: "Entry Done", labelBn: "এন্ট্রি সম্পন্ন", icon: CheckCircle, color: "bg-teal-500" },
  in_review: { label: "In Review", labelBn: "ইন রিভিউ", icon: Clock, color: "bg-cyan-500" },
  missing: { label: "Missing", labelBn: "মিসিং", icon: Clock, color: "bg-gray-500" },
  unknown_approval_pending: { label: "U-AP", labelBn: "U-AP", icon: Clock, color: "bg-gray-400" },
  pre: { label: "Pre-Order", labelBn: "প্রি-অর্ডার", icon: Clock, color: "bg-amber-500" },
};

export default function OrderNotifications() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Realtime: instant refresh on new order_notifications instead of fast polling
  useEffect(() => {
    const channel = supabase
      .channel("order-notifications-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_notifications" },
        () => queryClient.invalidateQueries({ queryKey: ["order-notifications"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["order-notifications"],
    queryFn: async () => {
      // Cleanup old records first
      await supabase.rpc("cleanup_old_notifications");
      
      const { data, error } = await supabase
        .from("order_notifications")
        .select("*")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Cloud cost: was 15s; Realtime invalidation below gives instant updates
  });

  const getConfig = (action: string) => actionConfig[action] || { label: action, labelBn: action, icon: Bell, color: "bg-muted" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">{t("অর্ডার স্ট্যাটাস", "Order Status")}</h2>
        <Badge variant="secondary" className="text-xs">
          {t("গত ২৪ ঘন্টা", "Last 24h")}
        </Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">{t("লোড হচ্ছে...", "Loading...")}</div>
      ) : !notifications?.length ? (
        <div className="text-center py-8 text-muted-foreground text-sm">{t("কোনো নোটিফিকেশন নেই", "No notifications")}</div>
      ) : (
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-2 pr-3">
            {notifications.map((n) => {
              const config = getConfig(n.action);
              const Icon = config.icon;
              return (
                <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {n.order_number}
                      </Badge>
                      <Badge className={`text-[10px] text-white ${config.color}`}>
                        {t(config.labelBn, config.label)}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1 text-foreground">
                      {n.action === "created"
                        ? t(`${n.customer_name || "কাস্টমার"} নতুন অর্ডার দিয়েছে`, `${n.customer_name || "Customer"} placed a new order`)
                        : t(
                            `অর্ডার ${config.labelBn} করা হয়েছে`,
                            `Order marked as ${config.label}`
                          )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {n.phone} • {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: bn })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
