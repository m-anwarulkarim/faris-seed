import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "অপেক্ষমান", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "কনফার্মড", color: "bg-blue-100 text-blue-800" },
  shipped: { label: "শিপড", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "ডেলিভার্ড", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "বাতিল", color: "bg-red-100 text-red-800" },
  returned: { label: "রিটার্ন", color: "bg-orange-100 text-orange-800" },
};

export function CustomerOrderHistory({ phone }: { phone: string }) {
  const { t } = useLanguage();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["customer-orders", phone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("order_id, customer_facing_id, status, total_amount, created_at, delivery_charge")
        .eq("phone", phone)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!phone,
  });

  if (isLoading) return <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin" /></div>;
  if (!orders?.length) return (
    <p className="text-sm text-muted-foreground text-center py-3">{t("কোনো অর্ডার নেই", "No orders")}</p>
  );

  return (
    <div className="space-y-2 max-h-[200px] overflow-y-auto">
      {orders.map(o => {
        const s = STATUS_MAP[o.status] || { label: o.status, color: "bg-muted" };
        return (
          <div key={o.order_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-sm">
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-mono font-medium">{o.customer_facing_id || o.order_id}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.color}`}>{s.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">৳{Number(o.total_amount)}</span>
              <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("bn-BD")}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
