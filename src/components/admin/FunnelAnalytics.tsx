import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingDown, Eye, ShoppingCart, CreditCard, Package, MousePointerClick, RotateCcw, CalendarRange } from "lucide-react";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

const FUNNEL_STEPS = [
  { key: "page_view", icon: Eye, labelBn: "পেজ ভিউ", labelEn: "Page Views" },
  { key: "product_view", icon: MousePointerClick, labelBn: "পণ্য দেখা", labelEn: "Product Views" },
  { key: "add_to_cart", icon: ShoppingCart, labelBn: "কার্টে যোগ", labelEn: "Add to Cart" },
  { key: "checkout_start", icon: CreditCard, labelBn: "চেকআউট শুরু", labelEn: "Checkout Start" },
  { key: "order_placed", icon: Package, labelBn: "অর্ডার সম্পন্ন", labelEn: "Order Placed" },
];

type RangeKey = "today" | "3d" | "7d" | "30d" | "custom";
const RANGE_DAYS: Record<string, number> = { "3d": 3, "7d": 7, "30d": 30 };

export default function FunnelAnalytics() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeKey>("today");
  const [resetting, setResetting] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const [customFrom, setCustomFrom] = useState<string>(today);
  const [customTo, setCustomTo] = useState<string>(today);

  const rangeBounds = (): { since: string; until?: string } => {
    if (range === "today") return { since: startOfDay(new Date()).toISOString(), until: endOfDay(new Date()).toISOString() };
    if (range === "custom") {
      const from = customFrom ? startOfDay(new Date(customFrom)).toISOString() : startOfDay(new Date()).toISOString();
      const to = customTo ? endOfDay(new Date(customTo)).toISOString() : endOfDay(new Date()).toISOString();
      return { since: from, until: to };
    }
    return { since: subDays(new Date(), RANGE_DAYS[range]).toISOString() };
  };

  const rangeLabel =
    range === "today" ? t("আজ", "Today")
    : range === "3d" ? t("৩ দিন", "3 Days")
    : range === "7d" ? t("৭ দিন", "7 Days")
    : range === "30d" ? t("৩০ দিন", "30 Days")
    : `${customFrom} → ${customTo}`;


  const handleReset = async () => {
    setResetting(true);
    try {
      const { since, until } = rangeBounds();
      let q = supabase.from("analytics_events").delete().gte("created_at", since);
      if (until) q = q.lte("created_at", until);
      const { error } = await q;
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["funnel-analytics"] });
      await queryClient.invalidateQueries({ queryKey: ["top-viewed-products"] });
      toast({ title: t("রিসেট সম্পন্ন", "Reset complete"), description: t(`${rangeLabel} এর ডাটা মুছে ফেলা হয়েছে`, `${rangeLabel} data cleared`) });
    } catch (e: any) {
      toast({ title: t("ত্রুটি", "Error"), description: e.message || String(e), variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const { data: funnelData, isLoading: funnelLoading } = useQuery({
    queryKey: ["funnel-analytics", range, customFrom, customTo],
    queryFn: async () => {
      const { since, until } = rangeBounds();
      const counts: Record<string, number> = {};
      for (const step of FUNNEL_STEPS) {
        let q = supabase
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", step.key)
          .gte("created_at", since);
        if (until) q = q.lte("created_at", until);
        const { count, error } = await q;
        if (!error) counts[step.key] = count || 0;
      }
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProducts, isLoading: topLoading } = useQuery({
    queryKey: ["top-viewed-products", range, customFrom, customTo],
    queryFn: async () => {
      const { since, until } = rangeBounds();
      let q = supabase
        .from("analytics_events")
        .select("product_id, product_name")
        .eq("event_type", "product_view")
        .gte("created_at", since)
        .not("product_id", "is", null);
      if (until) q = q.lte("created_at", until);
      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, { name: string; count: number }>();
      (data || []).forEach((e) => {
        if (!e.product_id) return;
        const existing = map.get(e.product_id);
        if (existing) {
          existing.count++;
        } else {
          map.set(e.product_id, { name: e.product_name || "Unknown", count: 1 });
        }
      });

      return Array.from(map.entries())
        .map(([id, v]) => ({ id, name: v.name, views: v.count }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  const counts = funnelData || {};
  const maxCount = Math.max(...FUNNEL_STEPS.map((s) => counts[s.key] || 0), 1);

  return (
    <div className="space-y-3">
      <div className="flex justify-end items-center gap-2">
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList className="h-8">
            <TabsTrigger value="today" className="text-xs px-2 py-1">{t("আজ", "Today")}</TabsTrigger>
            <TabsTrigger value="3d" className="text-xs px-2 py-1">{t("৩ দিন", "3D")}</TabsTrigger>
            <TabsTrigger value="7d" className="text-xs px-2 py-1">{t("৭ দিন", "7D")}</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-2 py-1">{t("৩০ দিন", "30D")}</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs px-2 py-1">{t("কাস্টম", "Custom")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" title={t("কাস্টম তারিখ", "Custom dates")}>
              <CalendarRange className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-2" align="end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t("থেকে", "From")}</label>
              <Input type="date" value={customFrom} max={customTo || today} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t("পর্যন্ত", "To")}</label>
              <Input type="date" value={customTo} min={customFrom} max={today} onChange={(e) => setCustomTo(e.target.value)} className="h-8 text-xs" />
            </div>
            <Button size="sm" className="w-full h-8 text-xs" onClick={() => setRange("custom")}>
              {t("প্রয়োগ করুন", "Apply")}
            </Button>
          </PopoverContent>
        </Popover>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={resetting}>
              {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              {t("রিসেট", "Reset")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(`${rangeLabel} এর ফানেল ডাটা রিসেট?`, `Reset funnel data for ${rangeLabel}?`)}</AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  `এই সময়ের সব analytics events (page_view, product_view, add_to_cart, checkout_start, order_placed) মুছে যাবে। এটি undo করা যাবে না।`,
                  `All analytics events in this range will be permanently deleted. This cannot be undone.`
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t("রিসেট করুন", "Reset")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-primary" />
              {t(`কনভার্সন ফানেল (${rangeLabel})`, `Conversion Funnel (${rangeLabel})`)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {FUNNEL_STEPS.map((step, i) => {
                  const count = counts[step.key] || 0;
                  const prevCount = i > 0 ? counts[FUNNEL_STEPS[i - 1].key] || 0 : 0;
                  const dropRate = i > 0 && prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : null;
                  const barWidth = maxCount > 0 ? Math.max((count / maxCount) * 100, 4) : 4;
                  const Icon = step.icon;

                  return (
                    <div key={step.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{t(step.labelBn, step.labelEn)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{count.toLocaleString()}</span>
                          {dropRate !== null && dropRate > 0 && (
                            <span className="text-[10px] text-destructive font-medium">-{dropRate}%</span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${barWidth}%`, opacity: 1 - i * 0.15 }}
                        />
                      </div>
                    </div>
                  );
                })}

                {(counts.page_view || 0) > 0 && (counts.order_placed || 0) >= 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("সামগ্রিক কনভার্সন রেট", "Overall Conversion Rate")}</span>
                      <span className="font-bold text-primary">
                        {((counts.order_placed || 0) / (counts.page_view || 1) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Viewed Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              {t(`সবচেয়ে বেশি দেখা পণ্য (${rangeLabel})`, `Most Viewed Products (${rangeLabel})`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !topProducts?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("এখনো কোনো ডাটা নেই", "No data yet")}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary flex-shrink-0">
                      {p.views} {t("বার", "views")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
