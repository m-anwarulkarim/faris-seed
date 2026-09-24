import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BarChart3, ShoppingCart, Users, Package, Loader2,
  Clock, AlertTriangle, Eye, CheckCircle, Truck, XCircle, Wallet, CalendarRange,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import FunnelAnalytics from "@/components/admin/FunnelAnalytics";
import { PhoneVerifiedBadge } from "@/components/PhoneVerifiedBadge";
import { usePhoneVerificationMap } from "@/hooks/usePhoneVerification";

type RangeKey = "today" | "lastday" | "3d" | "7d" | "30d" | "lifetime" | "custom";

export default function Overview() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>("30d");
  const today = format(new Date(), "yyyy-MM-dd");
  const [customFrom, setCustomFrom] = useState<string>(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState<string>(today);
  const [tempFrom, setTempFrom] = useState<string>(customFrom);
  const [tempTo, setTempTo] = useState<string>(customTo);
  const [customOpen, setCustomOpen] = useState(false);

  // Compute date range [fromISO, toISO) — null fromISO means lifetime
  const { fromISO, toISO, fromDateStr, labelSuffix } = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    if (range === "lifetime") {
      return { fromISO: null as string | null, toISO: null as string | null, fromDateStr: null as string | null, labelSuffix: t("সব সময়", "Lifetime") };
    }
    if (range === "today") {
      return { fromISO: todayStart.toISOString(), toISO: null, fromDateStr: format(todayStart, "yyyy-MM-dd"), labelSuffix: t("আজ", "Today") };
    }
    if (range === "lastday") {
      const yStart = subDays(todayStart, 1);
      return { fromISO: yStart.toISOString(), toISO: todayStart.toISOString(), fromDateStr: format(yStart, "yyyy-MM-dd"), labelSuffix: t("গতকাল", "Last Day") };
    }
    if (range === "custom") {
      const fromD = startOfDay(new Date(customFrom));
      const toD = endOfDay(new Date(customTo));
      return {
        fromISO: fromD.toISOString(),
        toISO: toD.toISOString(),
        fromDateStr: customFrom,
        labelSuffix: `${customFrom} → ${customTo}`,
      };
    }
    const days = range === "3d" ? 3 : range === "7d" ? 7 : 30;
    const from = subDays(now, days);
    return { fromISO: from.toISOString(), toISO: null, fromDateStr: format(from, "yyyy-MM-dd"), labelSuffix: `${days} ${t("দিন", "Days")}` };
  }, [range, customFrom, customTo, t]);

  


  // Credit system removed
  

  // Helper: start of "today" in Asia/Dhaka (BDT, UTC+6), returned as UTC ISO
  const bdtTodayStartISO = useMemo(() => {
    const now = new Date();
    // Current time in BDT
    const bdtNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const y = bdtNow.getUTCFullYear();
    const m = bdtNow.getUTCMonth();
    const d = bdtNow.getUTCDate();
    // Midnight BDT = (y-m-d 00:00 BDT) = (y-m-d -6h UTC)
    return new Date(Date.UTC(y, m, d, -6, 0, 0)).toISOString();
  }, []);

  // Customers in selected range (new signups by created_at)
  const { data: customerCount } = useQuery({
    queryKey: ["overview-customers", range, customFrom, customTo],
    queryFn: async () => {
      let q = supabase.from("visitor_profiles").select("*", { count: "exact", head: true });
      if (fromISO) q = q.gte("created_at", fromISO);
      if (toISO) q = q.lt("created_at", toISO);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60 * 1000,
  });

  // Courier entries (entry_done) in selected range — counted by status change date
  const { data: courierEntries } = useQuery({
    queryKey: ["overview-courier-entries", range, customFrom, customTo],
    queryFn: async () => {
      let q = supabase
        .from("order_status_history")
        .select("order_id")
        .eq("status", "entry_done");
      if (fromISO) q = q.gte("changed_at", fromISO);
      if (toISO) q = q.lt("changed_at", toISO);
      const { data, error } = await q;
      if (error) throw error;
      return new Set((data || []).map(r => r.order_id)).size;
    },
    staleTime: 60 * 1000,
  });

  // Courier entries lifetime — sub-line reference
  const { data: lifetimeCourierEntries } = useQuery({
    queryKey: ["overview-courier-entries-lifetime"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false)
        .eq("is_courier_entered", true);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Total customers (lifetime) — sub-line reference
  const { data: lifetimeCustomers } = useQuery({
    queryKey: ["overview-customers-lifetime"],
    queryFn: async () => {
      const { count, error } = await supabase.from("visitor_profiles").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Orders data within selected range
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["overview-orders", range, customFrom, customTo],
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      while (true) {
        let q = supabase
          .from("orders")
          .select("id, total_amount, status, created_at, is_deleted, is_courier_entered")
          .eq("is_deleted", false)
          .neq("traffic_source", "ecomdrive");
        if (fromISO) q = q.gte("created_at", fromISO);
        if (toISO) q = q.lt("created_at", toISO);
        const { data, error } = await q
          .order("created_at", { ascending: false })
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < 1000) break;
        page++;
      }
      return allData;
    },
    staleTime: 3 * 60 * 1000,
  });


  // Net profit: COGS + Ads within selected range
  const { data: profitData } = useQuery({
    queryKey: ["overview-profit", range, customFrom, customTo],
    queryFn: async () => {
      // Get delivered order IDs in range
      let deliveredIds: string[] = [];
      let page = 0;
      while (true) {
        let q = supabase
          .from("orders")
          .select("id")
          .eq("is_deleted", false)
          .eq("status", "delivered")
          .neq("traffic_source", "ecomdrive");
        if (fromISO) q = q.gte("created_at", fromISO);
        if (toISO) q = q.lt("created_at", toISO);
        const { data } = await q.range(page * 1000, (page + 1) * 1000 - 1);
        if (!data || data.length === 0) break;
        deliveredIds = deliveredIds.concat(data.map(d => d.id));
        if (data.length < 1000) break;
        page++;
      }

      // Get COGS from order_items + products
      let totalCogs = 0;
      if (deliveredIds.length > 0) {
        for (let i = 0; i < deliveredIds.length; i += 200) {
          const chunk = deliveredIds.slice(i, i + 200);
          const { data: items } = await supabase
            .from("order_items")
            .select("order_id, quantity, product_id")
            .in("order_id", chunk);
          const productIds = [...new Set((items || []).map(it => it.product_id))];
          const buyingPrices: Record<string, number> = {};
          for (let j = 0; j < productIds.length; j += 200) {
            const pChunk = productIds.slice(j, j + 200);
            const { data: pData } = await supabase
              .from("products")
              .select("id, buying_price")
              .in("id", pChunk);
            (pData || []).forEach(p => { buyingPrices[p.id] = Number(p.buying_price) || 0; });
          }
          (items || []).forEach(it => {
            totalCogs += (buyingPrices[it.product_id] || 0) * it.quantity;
          });
        }
      }

      // Get ads spend in range
      let adsQ = supabase.from("ads_daily_spend").select("spend_bdt, spend_date");
      if (fromDateStr) adsQ = adsQ.gte("spend_date", fromDateStr);
      if (toISO) adsQ = adsQ.lt("spend_date", format(new Date(toISO), "yyyy-MM-dd"));
      const { data: adsData } = await adsQ;
      const totalAds = (adsData || []).reduce((s, a) => s + (Number(a.spend_bdt) || 0), 0);

      return { totalCogs, totalAds };
    },
    staleTime: 3 * 60 * 1000,

  });

  // Chart data (last 14 days) - web orders, confirmed, delivered per day
  const { data: chartRawData } = useQuery({
    queryKey: ["overview-chart-14d"],
    queryFn: async () => {
      const since = subDays(new Date(), 13).toISOString();
      const sinceDate = format(subDays(new Date(), 13), "yyyy-MM-dd");

      // Get all non-ecomdrive orders created in last 14 days
      const allOrderIds: string[] = [];
      let page = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("orders")
          .select("id")
          .eq("is_deleted", false)
          .neq("traffic_source", "ecomdrive")
          .gte("created_at", since)
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (!batch || batch.length === 0) break;
        allOrderIds.push(...batch.map(b => b.id));
        if (batch.length < 1000) break;
        page++;
      }

      // Check which of these orders have been confirmed (no date filter on changed_at)
      const confirmedIdSet = new Set<string>();
      for (let i = 0; i < allOrderIds.length; i += 200) {
        const chunk = allOrderIds.slice(i, i + 200);
        const { data: statusBatch } = await supabase
          .from("order_status_history")
          .select("order_id")
          .eq("status", "confirmed")
          .in("order_id", chunk);
        (statusBatch || []).forEach(s => confirmedIdSet.add(s.order_id));
      }

      // Get confirmed orders' created_at
      const confirmedOrderIds = [...confirmedIdSet];
      let confirmedOrdersData: { id: string; created_at: string }[] = [];
      for (let i = 0; i < confirmedOrderIds.length; i += 200) {
        const chunk = confirmedOrderIds.slice(i, i + 200);
        const { data } = await supabase
          .from("orders")
          .select("id, created_at")
          .in("id", chunk)
          .eq("is_deleted", false)
          .neq("traffic_source", "ecomdrive");
        if (data) confirmedOrdersData = confirmedOrdersData.concat(data);
      }

      // statusData for orderAmounts/buyingCosts — use confirmedOrderIds
      const statusData = confirmedOrderIds.map(id => ({ order_id: id }));

      // Get web orders (all non-ecomdrive, non-deleted) with created_at — paginated
      let webOrdersData: { id: string; created_at: string }[] = [];
      let wPage = 0;
      while (true) {
        const { data: wBatch } = await supabase
          .from("orders")
          .select("id, created_at")
          .eq("is_deleted", false)
          .neq("traffic_source", "ecomdrive")
          .gte("created_at", since)
          .range(wPage * 1000, (wPage + 1) * 1000 - 1);
        if (!wBatch || wBatch.length === 0) break;
        webOrdersData = webOrdersData.concat(wBatch);
        if (wBatch.length < 1000) break;
        wPage++;
      }

      // Get delivered orders — paginated
      let deliveredData: { id: string; created_at: string }[] = [];
      let dPage = 0;
      while (true) {
        const { data: dBatch } = await supabase
          .from("orders")
          .select("id, created_at")
          .eq("is_deleted", false)
          .neq("traffic_source", "ecomdrive")
          .eq("status", "delivered")
          .gte("created_at", since)
          .range(dPage * 1000, (dPage + 1) * 1000 - 1);
        if (!dBatch || dBatch.length === 0) break;
        deliveredData = deliveredData.concat(dBatch);
        if (dBatch.length < 1000) break;
        dPage++;
      }

      // Get order amounts + items for buying_price
      const orderIds = [...new Set((statusData || []).map(s => s.order_id))];
      const orderAmounts: Record<string, number> = {};
      const orderBuyingCosts: Record<string, number> = {};
      if (orderIds.length > 0) {
        for (let i = 0; i < orderIds.length; i += 200) {
          const chunk = orderIds.slice(i, i + 200);
          const { data: ordData } = await supabase
            .from("orders")
            .select("id, total_amount")
            .in("id", chunk)
            .eq("is_deleted", false)
            .neq("traffic_source", "ecomdrive");
          (ordData || []).forEach(o => { orderAmounts[o.id] = Number(o.total_amount) || 0; });

          const { data: itemsData } = await supabase
            .from("order_items")
            .select("order_id, quantity, product_id")
            .in("order_id", chunk);

          const productIds = [...new Set((itemsData || []).map(it => it.product_id))];
          const buyingPrices: Record<string, number> = {};
          if (productIds.length > 0) {
            for (let j = 0; j < productIds.length; j += 200) {
              const pChunk = productIds.slice(j, j + 200);
              const { data: pData } = await supabase
                .from("products")
                .select("id, buying_price")
                .in("id", pChunk);
              (pData || []).forEach(p => { buyingPrices[p.id] = Number(p.buying_price) || 0; });
            }
          }
          (itemsData || []).forEach(it => {
            const cost = (buyingPrices[it.product_id] || 0) * it.quantity;
            orderBuyingCosts[it.order_id] = (orderBuyingCosts[it.order_id] || 0) + cost;
          });
        }
      }

      // Get ads spend
      const { data: adsData } = await supabase
        .from("ads_daily_spend")
        .select("spend_date, spend_bdt")
        .gte("spend_date", sinceDate);

      const adsMap: Record<string, number> = {};
      let adsTotal = 0, adsDaysWithData = 0;
      (adsData || []).forEach(a => {
        const val = Number(a.spend_bdt) || 0;
        adsMap[a.spend_date] = val;
        if (val > 0) { adsTotal += val; adsDaysWithData++; }
      });
      const avgAdsCost = adsDaysWithData > 0 ? Math.round(adsTotal / adsDaysWithData) : 0;

      return {
        statusData: statusData || [],
        confirmedOrdersData,
        webOrdersData,
        deliveredData,
        orderAmounts, orderBuyingCosts, adsMap, avgAdsCost,
      };
    },
    staleTime: 3 * 60 * 1000,
  });

  // 30-day revenue from already-fetched ordersData


  // Recent 10 orders
  const { data: recentOrders } = useQuery({
    queryKey: ["overview-recent-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_id, customer_facing_id, customer_name, phone, total_amount, status, created_at")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  const recentPhones = useMemo(() => (recentOrders || []).map(o => o.phone), [recentOrders]);
  const verifiedPhones = usePhoneVerificationMap(recentPhones);

  // Low stock products
  const { data: lowStockProducts } = useQuery({
    queryKey: ["overview-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock, reserved_stock, product_image")
        .lte("stock", 5)
        .order("stock", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Visitors in selected range
  const { data: todayVisitors } = useQuery({
    queryKey: ["overview-visitors-range", range, customFrom, customTo],
    queryFn: async () => {
      let q = supabase.from("visitors").select("*", { count: "exact", head: true });
      if (fromISO) q = q.gte("created_at", fromISO);
      if (toISO) q = q.lt("created_at", toISO);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });


  const orders = ordersData || [];
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const confirmedStatusOrders = orders.filter(o => !["pending", "cancelled"].includes(o.status)).length;
  const deliveredOrders = orders.filter(o => o.status === "delivered");
  const monthRevenue = deliveredOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const courierEnteredOrders = orders.filter(o => o.is_courier_entered).length;
  const totalDeliveryCharges = courierEnteredOrders * 60;
  const customDays = Math.max(1, Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000) + 1);
  const rangeDays = range === "lifetime" ? Math.max(1, Math.ceil(((Date.now() - new Date(orders[orders.length - 1]?.created_at || Date.now()).getTime()) / 86400000))) : (range === "custom" ? customDays : range === "today" ? 1 : range === "lastday" ? 1 : range === "3d" ? 3 : range === "7d" ? 7 : 30);
  const packagingCostR = deliveredOrders.length * 20;
  const officialCostR = rangeDays * 2500;
  const cogsR = profitData?.totalCogs || 0;
  const adsR = profitData?.totalAds || 0;
  const netProfit = monthRevenue - cogsR - adsR - packagingCostR - officialCostR - totalDeliveryCharges;


  // Chart: last 14 days with all 4 metrics per day
  const DELIVERY_RATE = 0.87;
  const PACKAGING_COST = 20;
  const DAILY_FIXED_COST = 2500;
  const chartData = (() => {
    if (!chartRawData) return [];
    const { confirmedOrdersData = [], webOrdersData = [], deliveredData = [], orderAmounts = {}, orderBuyingCosts = {}, adsMap = {}, avgAdsCost = 0 } = chartRawData;
    const now = new Date();
    const days = eachDayOfInterval({ start: subDays(now, 13), end: now });
    const safeDateStr = (val: string | null | undefined) => {
      if (!val) return "";
      const d = new Date(val);
      return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
    };
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const webOrders = webOrdersData.filter(o => safeDateStr(o.created_at) === dayStr).length;
      // Confirmed: orders created on this day that got confirmed at any point
      const dayConfirmedOrders = confirmedOrdersData.filter(o => safeDateStr(o.created_at) === dayStr);
      const confirmedCount = dayConfirmedOrders.length;
      const confirmedIds = dayConfirmedOrders.map(o => o.id);
      const estDeliveries = Math.round(confirmedCount * DELIVERY_RATE);
      const actualDelivered = deliveredData.filter(d => safeDateStr(d.created_at) === dayStr).length;
      const totalRevenue = confirmedIds.reduce((s, id) => s + (orderAmounts[id] || 0), 0);
      const estRevenue = Math.round(totalRevenue * DELIVERY_RATE);
      const adsCost = adsMap[dayStr] ?? avgAdsCost;
      const buyingCost = Math.round(confirmedIds.reduce((s, id) => s + (orderBuyingCosts[id] || 0), 0) * DELIVERY_RATE);
      const packagingCost = confirmedCount * PACKAGING_COST;
      const totalCost = Math.round(adsCost + buyingCost + packagingCost + DAILY_FIXED_COST);
      const estProfit = estRevenue - totalCost;
      // Stacked layers: everything clamped to webOrders as maximum container
      const safeWeb = Math.max(webOrders, 1);
      const clampedConfirmed = Math.min(confirmedCount, safeWeb);
      const clampedEst = Math.min(estDeliveries, clampedConfirmed);
      const clampedDelivered = Math.min(actualDelivered, clampedEst);
      return {
        label: format(day, "dd MMM"),
        // Raw values for tooltip
        webOrders,
        confirmed: confirmedCount,
        estDeliveries,
        actualDelivered,
        // Stacked differential layers (bottom to top) — total always = webOrders
        layerDelivered: clampedDelivered,
        layerEstGap: Math.max(0, clampedEst - clampedDelivered),
        layerConfirmedGap: Math.max(0, clampedConfirmed - clampedEst),
        layerWebGap: Math.max(0, webOrders - clampedConfirmed),
        estRevenue,
        totalCost,
        estProfit: Math.round(estProfit),
      };
    });
  })();

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-3 h-3 text-yellow-500" />;
      case "confirmed": return <CheckCircle className="w-3 h-3 text-blue-500" />;
      case "delivered": return <Truck className="w-3 h-3 text-green-500" />;
      case "cancelled": return <XCircle className="w-3 h-3 text-destructive" />;
      default: return <Clock className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("পেন্ডিং", "Pending"),
      confirmed: t("কনফার্মড", "Confirmed"),
      printed: t("প্রিন্টেড", "Printed"),
      entry_done: t("এন্ট্রি", "Entry Done"),
      shipped: t("শিপড", "Shipped"),
      delivered: t("ডেলিভার্ড", "Delivered"),
      cancelled: t("বাতিল", "Cancelled"),
      returned: t("রিটার্ন", "Returned"),
    };
    return map[status] || status;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Range Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="today">{t("আজ", "Today")}</TabsTrigger>
            <TabsTrigger value="lastday">{t("গতকাল", "Last Day")}</TabsTrigger>
            <TabsTrigger value="3d">{t("৩ দিন", "3 Days")}</TabsTrigger>
            <TabsTrigger value="7d">{t("৭ দিন", "7 Days")}</TabsTrigger>
            <TabsTrigger value="30d">{t("৩০ দিন", "30 Days")}</TabsTrigger>
            <TabsTrigger value="lifetime">{t("সব সময়", "Lifetime")}</TabsTrigger>
            <TabsTrigger value="custom">{t("কাস্টম", "Custom")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Popover open={customOpen} onOpenChange={(o) => { setCustomOpen(o); if (o) { setTempFrom(customFrom); setTempTo(customTo); } }}>
          <PopoverTrigger asChild>
            <Button
              variant={range === "custom" ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={() => setCustomOpen(true)}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              {range === "custom" ? `${customFrom} → ${customTo}` : t("কাস্টম রেঞ্জ", "Custom Range")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="start">
            <div className="flex items-center gap-2">
              <Input type="date" value={tempFrom} max={today} onChange={(e) => setTempFrom(e.target.value)} className="w-auto h-8 text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={tempTo} max={today} onChange={(e) => setTempTo(e.target.value)} className="w-auto h-8 text-xs" />
            </div>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              disabled={!tempFrom || !tempTo || tempFrom > tempTo}
              onClick={() => {
                setCustomFrom(tempFrom);
                setCustomTo(tempTo);
                setRange("custom");
                setCustomOpen(false);
              }}
            >
              {t("প্রয়োগ করুন", "Apply")}
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={BarChart3}
          label={`${t("মোট আয়", "Total Revenue")} (${labelSuffix})`}
          value={`৳${Math.round(monthRevenue).toLocaleString()}`}
          sub={`${t("নিট লাভ", "Net Profit")}: ৳${Math.round(netProfit).toLocaleString()}`}
          subColor={netProfit >= 0 ? "text-emerald-600" : "text-destructive"}
        />
        <StatCard
          icon={ShoppingCart}
          label={`${t("অর্ডার", "Orders")} (${labelSuffix})`}
          value={orders.length.toLocaleString()}
          sub={`${confirmedStatusOrders} ${t("কনফার্মড", "confirmed")} · ${deliveredOrders.length} ${t("ডেলিভার্ড", "delivered")}`}
        />

        <StatCard
          icon={Users}
          label={`${t("কাস্টমার", "Customers")} (${labelSuffix})`}
          value={(customerCount || 0).toLocaleString()}
          sub={`${t("সর্বমোট", "Lifetime")}: ${(lifetimeCustomers || 0).toLocaleString()}`}
          subColor="text-emerald-600"
        />
        <StatCard
          icon={Eye}
          label={`${t("ভিজিটর", "Visitors")} (${labelSuffix})`}
          value={(todayVisitors || 0).toLocaleString()}
          sub={t("নির্বাচিত সময়সীমা", "Selected range")}
        />
        <StatCard
          icon={Truck}
          label={`${t("কুরিয়ার এন্ট্রি", "Courier Entries")} (${labelSuffix})`}
          value={(courierEntries || 0).toLocaleString()}
          sub={`${t("সর্বমোট", "Lifetime")}: ${(lifetimeCourierEntries || 0).toLocaleString()}`}
          subColor="text-emerald-600"
        />
      </div>

      {/* 14-Day Order Funnel Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("গত ১৪ দিনের অর্ডার ফানেল ও আনুমানিক আয়", "Order Funnel & Est. Revenue (14 Days)")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={11} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm space-y-1.5">
                        <p className="font-semibold text-foreground">{label}</p>
                        <div className="flex justify-between gap-6">
                          <span className="text-muted-foreground">● {t("ওয়েব অর্ডার", "Web Orders")}</span>
                          <span className="font-bold">{d.webOrders}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-accent-foreground">● {t("কনফার্মড", "Confirmed")}</span>
                          <span className="font-bold">{d.confirmed}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-primary/50">● {t("সম্ভাব্য ডেলিভারি", "Est. Delivered")}</span>
                          <span className="font-bold">{d.estDeliveries}</span>
                        </div>
                        <div className="flex justify-between gap-6">
                          <span className="text-primary">● {t("প্রকৃত ডেলিভারি", "Delivered")}</span>
                          <span className="font-bold">{d.actualDelivered}</span>
                        </div>
                        <div className="border-t border-border pt-1.5 mt-1">
                          <div className="flex justify-between gap-6">
                            <span className="text-muted-foreground">{t("আনু. আয়", "Est. Revenue")}</span>
                            <span className="font-bold text-primary">৳{d.estRevenue?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-muted-foreground">{t("মোট খরচ", "Total Cost")}</span>
                            <span className="font-medium text-destructive">-৳{d.totalCost?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-6 pt-1 border-t border-border mt-1">
                            <span className="text-muted-foreground font-medium">{t("আনু. লাভ", "Est. Profit")}</span>
                            <span className={`font-bold ${(d.estProfit || 0) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              ৳{d.estProfit?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                {/* Single stacked bar per day: bottom=delivered → top=unfilled web orders */}
                <Bar dataKey="layerDelivered" stackId="a" fill="hsl(var(--primary))" fillOpacity={0.9} stroke="none" name={t("প্রকৃত ডেলিভারি", "Delivered")} />
                <Bar dataKey="layerEstGap" stackId="a" fill="hsl(var(--primary))" fillOpacity={0.4} stroke="none" name={t("সম্ভাব্য ডেলিভারি", "Est. Delivered")} />
                <Bar dataKey="layerConfirmedGap" stackId="a" fill="hsl(var(--accent))" fillOpacity={0.65} stroke="none" name={t("কনফার্মড", "Confirmed")} />
                <Bar dataKey="layerWebGap" stackId="a" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth={0.5} radius={[4, 4, 0, 0]} fillOpacity={0.8} name={t("ওয়েব অর্ডার", "Web Orders")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 justify-center mt-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-muted border border-border" />{t("ওয়েব অর্ডার", "Web Orders")}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-accent opacity-70" />{t("কনফার্মড", "Confirmed")}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary opacity-45" />{t("সম্ভাব্য ডেলিভারি", "Est. Delivered")}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary opacity-90" />{t("প্রকৃত ডেলিভারি", "Delivered")}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("সাম্প্রতিক অর্ডার", "Recent Orders")}</CardTitle>
            <button onClick={() => navigate("/e/orders/web")} className="text-xs text-primary hover:underline">
              {t("সব দেখুন", "View all")}
            </button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(recentOrders || []).map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/e/orders/edit/${order.order_id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(order.status)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{order.customer_name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">{order.customer_facing_id || order.order_id} · {order.phone} <PhoneVerifiedBadge verified={verifiedPhones.get(order.phone) === true} size={11} /></p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-primary">৳{Number(order.total_amount).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{statusLabel(order.status)}</p>
                  </div>
                </div>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">{t("কোনো অর্ডার নেই", "No orders")}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              {t("স্টক কম", "Low Stock")}
            </CardTitle>
            <button onClick={() => navigate("/e/inventory")} className="text-xs text-primary hover:underline">
              {t("সব দেখুন", "View all")}
            </button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(lowStockProducts || []).map(product => (
                <div
                  key={product.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/e/products/edit/${product.id}`)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {product.product_image ? (
                      <img src={product.product_image} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm font-medium truncate">{product.name}</p>
                  </div>
                  <Badge variant={product.stock <= 0 ? "destructive" : "secondary"} className="flex-shrink-0">
                    {product.stock - product.reserved_stock} {t("টি", "pcs")}
                  </Badge>
                </div>
              ))}
              {(!lowStockProducts || lowStockProducts.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">{t("সব পণ্যে পর্যাপ্ত স্টক আছে", "All products have sufficient stock")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Analytics */}
      <FunnelAnalytics />
    </div>
  );
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return num.toLocaleString();
}

function StatCard({ icon: Icon, label, value, sub, highlight, subColor }: {
  icon: any; label: string; value: string; sub?: string; highlight?: boolean; subColor?: string;
}) {
  return (
    <Card className={highlight ? "border-yellow-500/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <p className={`text-xl font-bold ${highlight ? "text-yellow-600" : ""}`}>{value}</p>
        {sub && <p className={`text-[10px] mt-0.5 ${subColor || "text-muted-foreground"}`}>{sub}</p>}
      </CardContent>
    </Card>
  );
}
