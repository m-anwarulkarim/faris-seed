import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, ShoppingCart, Package, DollarSign, Truck, BoxIcon, Megaphone, Percent, RefreshCw, Building2, Clock, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, endOfMonth, eachWeekOfInterval, eachMonthOfInterval, differenceInDays } from "date-fns";

const DEFAULT_PACKAGING_COST = 10;
const DELIVERY_RATE = 0.87;
const DEFAULT_DAILY_OFFICE_COST = 2500;
const DHAKA_TIMEZONE = "Asia/Dhaka";
const RETURN_OR_CANCEL_STATUSES = [
  "return",
  "rtn_received",
  "cancelled",
  "order_cancelled",
  "pending_return",
  "cancelled_approval_pending",
] as const;

const dhakaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: DHAKA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type FilterValue = "today" | "yesterday" | "3d" | "7d" | "30d" | "1y" | "lifetime" | "custom";

const FILTER_OPTIONS: { value: FilterValue; bn: string; en: string }[] = [
  { value: "today", bn: "আজ", en: "Today" },
  { value: "yesterday", bn: "গতকাল", en: "Yesterday" },
  { value: "3d", bn: "গত ৩ দিন", en: "Last 3 Days" },
  { value: "7d", bn: "গত ১ সপ্তাহ", en: "Last 7 Days" },
  { value: "30d", bn: "গত ১ মাস", en: "Last 30 Days" },
  { value: "1y", bn: "গত ১ বছর", en: "Last 1 Year" },
  { value: "lifetime", bn: "সারাজীবন", en: "Lifetime" },
  { value: "custom", bn: "কাস্টম", en: "Custom" },
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function makeDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function getUtcDateKey(date: Date) {
  return makeDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function shiftDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return getUtcDateKey(date);
}

function getDhakaDateParts(input: Date | string) {
  const value = input instanceof Date ? input : new Date(input);
  const parts = dhakaDateFormatter.formatToParts(value);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
  };
}

function getDhakaDateKey(input: Date | string) {
  const { year, month, day } = getDhakaDateParts(input);
  return makeDateKey(year, month, day);
}

function getDateRange(filter: FilterValue, customFrom?: string, customTo?: string): {
  fromKey: string | null;
  toKey: string;
  fromDate: Date | null;
  toDate: Date;
  totalDays: number | null;
} {
  const todayKey = getDhakaDateKey(new Date());
  const todayDate = parseDateKey(todayKey);

  switch (filter) {
    case "today":
      return { fromKey: todayKey, toKey: todayKey, fromDate: todayDate, toDate: todayDate, totalDays: 1 };
    case "yesterday": {
      const yesterdayKey = shiftDateKey(todayKey, -1);
      const yesterdayDate = parseDateKey(yesterdayKey);
      return { fromKey: yesterdayKey, toKey: yesterdayKey, fromDate: yesterdayDate, toDate: yesterdayDate, totalDays: 1 };
    }
    case "3d": {
      const fromKey = shiftDateKey(todayKey, -2);
      return { fromKey, toKey: todayKey, fromDate: parseDateKey(fromKey), toDate: todayDate, totalDays: 3 };
    }
    case "7d": {
      const fromKey = shiftDateKey(todayKey, -6);
      return { fromKey, toKey: todayKey, fromDate: parseDateKey(fromKey), toDate: todayDate, totalDays: 7 };
    }
    case "30d": {
      const fromKey = shiftDateKey(todayKey, -29);
      return { fromKey, toKey: todayKey, fromDate: parseDateKey(fromKey), toDate: todayDate, totalDays: 30 };
    }
    case "1y": {
      const fromKey = shiftDateKey(todayKey, -364);
      return { fromKey, toKey: todayKey, fromDate: parseDateKey(fromKey), toDate: todayDate, totalDays: 365 };
    }
    case "custom": {
      const fromKey = customFrom || todayKey;
      const toKey = customTo || todayKey;
      const safeFrom = fromKey <= toKey ? fromKey : toKey;
      const safeTo = fromKey <= toKey ? toKey : fromKey;
      const fromDate = parseDateKey(safeFrom);
      const toDate = parseDateKey(safeTo);
      const totalDays = Math.max(1, differenceInDays(toDate, fromDate) + 1);
      return { fromKey: safeFrom, toKey: safeTo, fromDate, toDate, totalDays };
    }
    case "lifetime":
      return { fromKey: null, toKey: todayKey, fromDate: null, toDate: todayDate, totalDays: null };
  }
}

export default function SalesReport() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("today");
  const [filter, setFilter] = useState<FilterValue>("lifetime");
  const todayKeyInit = getDhakaDateKey(new Date());
  const [customFrom, setCustomFrom] = useState<string>(todayKeyInit);
  const [customTo, setCustomTo] = useState<string>(todayKeyInit);
  const [officeDialog, setOfficeDialog] = useState(false);
  const [officeInput, setOfficeInput] = useState("");
  const [packagingDialog, setPackagingDialog] = useState(false);
  const [packagingInput, setPackagingInput] = useState("");
  const [savingPackaging, setSavingPackaging] = useState(false);
  const [adsDialog, setAdsDialog] = useState(false);
  const [adsDate, setAdsDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [adsAmount, setAdsAmount] = useState("");
  const [savingOffice, setSavingOffice] = useState(false);
  const [savingAds, setSavingAds] = useState(false);

  const { data: officeCostSetting } = useQuery({
    queryKey: ["app-settings-daily-office-cost"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "daily_office_cost")
        .maybeSingle();
      return data?.value ? Number(data.value) : DEFAULT_DAILY_OFFICE_COST;
    },
  });
  const DAILY_OFFICE_COST = officeCostSetting ?? DEFAULT_DAILY_OFFICE_COST;

  const { data: packagingCostSetting } = useQuery({
    queryKey: ["app-settings-packaging-cost"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "packaging_cost")
        .maybeSingle();
      return data?.value ? Number(data.value) : DEFAULT_PACKAGING_COST;
    },
  });
  const PACKAGING_COST = packagingCostSetting ?? DEFAULT_PACKAGING_COST;


  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-report-orders-v6"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("orders")
          .select("id, total_amount, discount, advance, delivery_charge, status, created_at, updated_at, order_items(quantity, unit_price, product_id, products(buying_price))")
          .eq("is_deleted", false)
          .or("traffic_source.is.null,traffic_source.neq.ecomdrive")
          .order("created_at", { ascending: true })
          .range(from, to);

        if (error) throw error;

        const rows = data || [];
        allData = allData.concat(rows);
        hasMore = rows.length === PAGE_SIZE;
        page += 1;
      }

      return allData;
    },
  });

  const { data: adsData, isLoading: adsLoading, refetch: refetchAds } = useQuery({
    queryKey: ["sales-report-ads-db"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads_daily_spend")
        .select("spend_date, spend_usd, spend_bdt")
        .order("spend_date", { ascending: true });

      if (error) {
        return {
          totalBdt: 0,
          totalUsd: 0,
          dailyMap: {} as Record<string, number>,
          usdMap: {} as Record<string, number>,
        };
      }

      const rows = data || [];
      const dailyMap: Record<string, number> = {};
      const usdMap: Record<string, number> = {};

      rows.forEach((row) => {
        dailyMap[row.spend_date] = Number(row.spend_bdt) || 0;
        usdMap[row.spend_date] = Number(row.spend_usd) || 0;
      });

      return { totalBdt: 0, totalUsd: 0, dailyMap, usdMap };
    },
  });

  // Auto-sync today's ads data on page load
  useEffect(() => {
    const syncTodayAds = async () => {
      try {
        await supabase.functions.invoke("sync-ads-daily", {
          body: { mode: "today" },
        });
        // Also sync yesterday in case it was missed
        await supabase.functions.invoke("sync-ads-daily", {
          body: { mode: "yesterday" },
        });
        refetchAds();
      } catch (e) {
        console.error("Auto ads sync error:", e);
      }
    };
    syncTodayAds();
  }, []);

  const {
    fromKey: rangeFromKey,
    toKey: rangeToKey,
    fromDate: rangeFromDate,
    toDate: rangeToDate,
    totalDays: fixedFilterDays,
  } = getDateRange(filter, customFrom, customTo);

  const normalizedOrders = useMemo(() => {
    if (!orders) return [];

    return orders.map((order) => {
      const createdDhakaKey = getDhakaDateKey(order.created_at);
      return {
        ...order,
        createdDhakaKey,
        createdDhakaDate: parseDateKey(createdDhakaKey),
      };
    });
  }, [orders]);

  const allOrders = useMemo(() => {
    return normalizedOrders.filter((order) => {
      if (rangeFromKey && order.createdDhakaKey < rangeFromKey) return false;
      if (order.createdDhakaKey > rangeToKey) return false;
      return true;
    });
  }, [normalizedOrders, rangeFromKey, rangeToKey]);

  const getAdsForRange = (start: Date, end: Date) => {
    const map = adsData?.dailyMap || {};
    let total = 0;
    const cursor = parseDateKey(getUtcDateKey(start));
    const lastDay = parseDateKey(getUtcDateKey(end));

    while (cursor <= lastDay) {
      total += map[getUtcDateKey(cursor)] || 0;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return total;
  };

  const getUsdAdsForRange = (start: Date, end: Date) => {
    const map = adsData?.usdMap || {};
    let total = 0;
    const cursor = parseDateKey(getUtcDateKey(start));
    const lastDay = parseDateKey(getUtcDateKey(end));

    while (cursor <= lastDay) {
      total += map[getUtcDateKey(cursor)] || 0;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return total;
  };

  const totalAdsCost = rangeFromDate
    ? getAdsForRange(rangeFromDate, rangeToDate)
    : Object.values(adsData?.dailyMap || {}).reduce((sum, value) => sum + value, 0);

  const totalAdsUsd = rangeFromDate
    ? getUsdAdsForRange(rangeFromDate, rangeToDate)
    : Object.values(adsData?.usdMap || {}).reduce((sum, value) => sum + value, 0);

  const CONFIRMED_PLUS_STATUSES = ["confirmed", "printed", "entry_done", "shipped", "hold", "on_the_way", "picked", "in_review",
    "delivered_approval_pending", "partial_delivered_approval_pending", "unknown_approval_pending", "cancelled_approval_pending", "pending_return"];
  const deliveredOrders = allOrders.filter((order) => order.status === "delivered");
  const confirmedPlusOrders = allOrders.filter((order) => CONFIRMED_PLUS_STATUSES.includes(order.status));
  const returnOrders = allOrders.filter((order) => RETURN_OR_CANCEL_STATUSES.includes(order.status as typeof RETURN_OR_CANCEL_STATUSES[number]));
  

  // Estimated revenue: delivered actual + confirmed+ × delivery rate
  const deliveredRevenue = deliveredOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
  const confirmedPlusRevenue = confirmedPlusOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
  const totalRevenue = Math.round(deliveredRevenue + confirmedPlusRevenue * DELIVERY_RATE);

  const calcBuyingCost = (orderList: typeof allOrders) => orderList.reduce((sum, order) => {
    const items = (order as any).order_items || [];
    return sum + items.reduce((itemSum: number, item: any) => itemSum + (Number(item.quantity) * Number(item.products?.buying_price ?? 0)), 0);
  }, 0);

  const deliveredBuyingCost = calcBuyingCost(deliveredOrders);
  const confirmedPlusBuyingCost = calcBuyingCost(confirmedPlusOrders);
  const totalBuyingCost = Math.round(deliveredBuyingCost + confirmedPlusBuyingCost * DELIVERY_RATE);

  const returnBuyingCost = calcBuyingCost(returnOrders);

  const deliveryChargeDelivered = deliveredOrders.reduce((sum, order) => sum + (Number(order.delivery_charge) || 0), 0);
  const deliveryChargeReturn = returnOrders.reduce((sum, order) => sum + (Number(order.delivery_charge) || 0), 0);
  const deliveryChargeConfirmedPlus = confirmedPlusOrders.reduce((sum, order) => sum + (Number(order.delivery_charge) || 0), 0);
  const totalDeliveryCharge = Math.round(deliveryChargeDelivered + deliveryChargeReturn + deliveryChargeConfirmedPlus * DELIVERY_RATE);

  
  const estDeliveredFromConfirmed = Math.round(confirmedPlusOrders.length * DELIVERY_RATE);
  const totalPackaging = (deliveredOrders.length + returnOrders.length + estDeliveredFromConfirmed) * PACKAGING_COST;

  const totalDays = fixedFilterDays ?? (
    allOrders.length > 0
      ? Math.max(1, differenceInDays(allOrders[allOrders.length - 1].createdDhakaDate, allOrders[0].createdDhakaDate) + 1)
      : 0
  );

  const totalOfficeCost = totalDays * DAILY_OFFICE_COST;
  const totalCost = totalBuyingCost + totalDeliveryCharge + totalPackaging + totalAdsCost + returnBuyingCost + totalOfficeCost;
  const netProfit = totalRevenue - totalCost;
  const profitPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const calcPeriodProfit = (periodOrders: typeof allOrders, periodDays: number, periodStart: Date, periodEnd: Date) => {
    const delivered = periodOrders.filter((order) => order.status === "delivered");
    const confirmedPlus = periodOrders.filter((order) => CONFIRMED_PLUS_STATUSES.includes(order.status));
    const returned = periodOrders.filter((order) => RETURN_OR_CANCEL_STATUSES.includes(order.status as typeof RETURN_OR_CANCEL_STATUSES[number]));
    
    const revenue = Math.round(
      delivered.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) +
      confirmedPlus.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) * DELIVERY_RATE
    );
    
    const buyingCost = Math.round(
      calcBuyingCost(delivered) + calcBuyingCost(confirmedPlus) * DELIVERY_RATE
    );
    const returnedBuyingCost = calcBuyingCost(returned);
    
    const deliveryCost = Math.round(
      delivered.reduce((sum, order) => sum + (Number(order.delivery_charge) || 0), 0) +
      returned.reduce((sum, order) => sum + (Number(order.delivery_charge) || 0), 0) +
      confirmedPlus.reduce((sum, order) => sum + (Number(order.delivery_charge) || 0), 0) * DELIVERY_RATE
    );
    
    const estDelivered = Math.round(confirmedPlus.length * DELIVERY_RATE);
    const packagingCost = (delivered.length + returned.length + estDelivered) * PACKAGING_COST;
    const officeCost = periodDays * DAILY_OFFICE_COST;
    const adsCost = getAdsForRange(periodStart, periodEnd);

    return revenue - buyingCost - returnedBuyingCost - deliveryCost - packagingCost - officeCost - adsCost;
  };

  // Charts have their own fixed time ranges, independent of top filter
  const chartToday = parseDateKey(getDhakaDateKey(new Date()));

  const weeklyData = useMemo(() => {
    const weeksBack = 8;
    const weeklyStart = parseDateKey(shiftDateKey(getUtcDateKey(chartToday), -(weeksBack * 7 - 1)));
    const weeks = eachWeekOfInterval({ start: weeklyStart, end: chartToday }, { weekStartsOn: 6 });

    return weeks.map((weekStart, index) => {
      const rawWeekEnd = index < weeks.length - 1
        ? parseDateKey(shiftDateKey(getUtcDateKey(weeks[index + 1]), -1))
        : chartToday;

      const periodStart = weekStart < weeklyStart ? weeklyStart : weekStart;
      const periodEnd = rawWeekEnd > chartToday ? chartToday : rawWeekEnd;
      const weekOrders = normalizedOrders.filter((order) => order.createdDhakaDate >= periodStart && order.createdDhakaDate <= periodEnd);
      const weekDelivered = weekOrders.filter((order) => order.status === "delivered");
      const periodDays = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);

      return {
        label: format(periodStart, "dd") + "–" + format(periodEnd, "dd MMM"),
        orders: weekOrders.length,
        revenue: Math.round(weekDelivered.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0)),
        delivered: weekDelivered.length,
        profit: Math.round(calcPeriodProfit(weekOrders, periodDays, periodStart, periodEnd)),
      };
    });
  }, [normalizedOrders, chartToday]);

  const monthlyData = useMemo(() => {
    const monthsBack = 12;
    const monthlyStart = new Date(chartToday);
    monthlyStart.setUTCMonth(monthlyStart.getUTCMonth() - (monthsBack - 1));
    monthlyStart.setUTCDate(1);
    const months = eachMonthOfInterval({ start: monthlyStart, end: chartToday });

    return months.map((monthStart) => {
      const rawMonthEnd = endOfMonth(monthStart);
      const periodStart = monthStart < monthlyStart ? monthlyStart : monthStart;
      const periodEnd = rawMonthEnd > chartToday ? chartToday : rawMonthEnd;
      const monthOrders = normalizedOrders.filter((order) => order.createdDhakaDate >= periodStart && order.createdDhakaDate <= periodEnd);
      const monthDelivered = monthOrders.filter((order) => order.status === "delivered");
      const periodDays = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);

      return {
        label: format(periodStart, "MMM yy"),
        orders: monthOrders.length,
        revenue: Math.round(monthDelivered.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0)),
        delivered: monthDelivered.length,
        profit: Math.round(calcPeriodProfit(monthOrders, periodDays, periodStart, periodEnd)),
      };
    });
  }, [normalizedOrders, chartToday]);

  const buildSingleDayData = (label: string, dayStart: Date) => {
    const dayOrders = normalizedOrders.filter((o) => o.createdDhakaDate.getTime() === dayStart.getTime());
    const dayDelivered = dayOrders.filter((o) => o.status === "delivered");
    return [{
      label,
      orders: dayOrders.length,
      revenue: Math.round(dayDelivered.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)),
      delivered: dayDelivered.length,
      profit: Math.round(calcPeriodProfit(dayOrders, 1, dayStart, dayStart)),
    }];
  };

  const todayData = useMemo(
    () => buildSingleDayData("Today", chartToday),
    [normalizedOrders, chartToday]
  );

  const lastDayData = useMemo(
    () => buildSingleDayData("Yesterday", parseDateKey(shiftDateKey(getUtcDateKey(chartToday), -1))),
    [normalizedOrders, chartToday]
  );

  const threeDayData = useMemo(() => {
    const buckets = 10;
    return Array.from({ length: buckets }, (_, i) => {
      const offset = (buckets - 1 - i) * 3;
      const periodStart = parseDateKey(shiftDateKey(getUtcDateKey(chartToday), -(offset + 2)));
      const periodEnd = parseDateKey(shiftDateKey(getUtcDateKey(chartToday), -offset));
      const bucketEnd = periodEnd > chartToday ? chartToday : periodEnd;
      const bucketOrders = normalizedOrders.filter((o) => o.createdDhakaDate >= periodStart && o.createdDhakaDate <= bucketEnd);
      const bucketDelivered = bucketOrders.filter((o) => o.status === "delivered");
      const periodDays = Math.max(1, differenceInDays(bucketEnd, periodStart) + 1);
      return {
        label: format(periodStart, "dd") + "–" + format(bucketEnd, "dd MMM"),
        orders: bucketOrders.length,
        revenue: Math.round(bucketDelivered.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)),
        delivered: bucketDelivered.length,
        profit: Math.round(calcPeriodProfit(bucketOrders, periodDays, periodStart, bucketEnd)),
      };
    });
  }, [normalizedOrders, chartToday]);

  const chartData = tab === "today" ? todayData : tab === "lastday" ? lastDayData : tab === "3day" ? threeDayData : tab === "weekly" ? weeklyData : monthlyData;


  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentFilter = FILTER_OPTIONS.find((option) => option.value === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">{t("সেলস রিপোর্ট", "Sales Report")}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {filter === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customFrom}
                max={customTo || todayKeyInit}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 text-sm w-[150px]"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayKeyInit}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 text-sm w-[150px]"
              />
            </div>
          )}
          <Select value={filter} onValueChange={(value) => setFilter(value as FilterValue)}>
            <SelectTrigger className="w-[180px] h-9 text-sm gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <SelectValue>{currentFilter ? t(currentFilter.bn, currentFilter.en) : ""}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.bn, option.en)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
             <DollarSign className="w-3.5 h-3.5" />
              {t("সম্ভাব্য আয়", "Est. Revenue")}
            </div>
            <p className="text-xl font-bold text-primary">৳{totalRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">৳{Math.round(deliveredRevenue).toLocaleString()} - ৳{Math.round(deliveredRevenue + confirmedPlusRevenue).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              {t("মোট খরচ", "Total Cost")}
            </div>
            <p className="text-xl font-bold text-destructive">৳{Math.round(totalCost).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={`border ${netProfit >= 0 ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className={`w-3.5 h-3.5 ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`} />
              {t("নেট লাভ/লস", "Net Profit/Loss")}
            </div>
            <p className={`text-xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {netProfit >= 0 ? "+" : ""}৳{Math.round(netProfit).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Percent className="w-3.5 h-3.5" />
              {t("লাভ %", "Profit %")}
            </div>
            <p className={`text-xl font-bold ${profitPercent >= 0 ? "text-green-600" : "text-destructive"}`}>{profitPercent.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <BoxIcon className="w-3.5 h-3.5" />
              {t("ক্রয়মূল্য", "Buying Cost")}
            </div>
            <p className="text-lg font-semibold">৳{totalBuyingCost.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Truck className="w-3.5 h-3.5" />
              {t("ডেলিভারি খরচ", "Delivery Cost")}
            </div>
            <p className="text-lg font-semibold">৳{totalDeliveryCharge.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Package className="w-3.5 h-3.5" />
              {t("প্যাকেজিং", "Packaging")}
              <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => { setPackagingInput(String(PACKAGING_COST)); setPackagingDialog(true); }}>
                <Pencil className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-lg font-semibold">৳{totalPackaging.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{(deliveredOrders.length + returnOrders.length + estDeliveredFromConfirmed)} × ৳{PACKAGING_COST}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Building2 className="w-3.5 h-3.5" />
              {t("অফিস খরচ", "Office Cost")}
              <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => { setOfficeInput(String(DAILY_OFFICE_COST)); setOfficeDialog(true); }}>
                <Pencil className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-lg font-semibold">৳{totalOfficeCost.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{totalDays} {t("দিন", "days")} × ৳{DAILY_OFFICE_COST.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Megaphone className="w-3.5 h-3.5" />
              {t("Ads খরচ", "Ads Cost")}
              <div className="ml-auto flex items-center gap-0.5">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setAdsDate(new Date().toISOString().slice(0,10)); setAdsAmount(""); setAdsDialog(true); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => refetchAds()} disabled={adsLoading}>
                  {adsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            <p className="text-lg font-semibold">৳{Math.round(totalAdsCost).toLocaleString()}</p>
            {totalAdsUsd > 0 && <p className="text-[10px] text-muted-foreground">${totalAdsUsd.toFixed(2)} USD</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ShoppingCart className="w-3.5 h-3.5" />
              {t("মোট অর্ডার", "Total Orders")}
            </div>
            <p className="text-xl font-bold">{allOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Package className="w-3.5 h-3.5" />
              {t("কনফার্মড+", "Confirmed+")}
            </div>
            <p className="text-xl font-bold text-blue-600">{confirmedPlusOrders.length}</p>
            <p className="text-[10px] text-muted-foreground">{t("সম্ভাব্য ডেলিভারি", "Est. Delivery")}: {estDeliveredFromConfirmed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Truck className="w-3.5 h-3.5" />
              {t("ডেলিভার্ড", "Delivered")}
            </div>
            <p className="text-xl font-bold text-green-600">{deliveredOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              {t("রিটার্ন/ক্যান্সেল", "Return/Cancel")}
            </div>
            <p className="text-xl font-bold text-destructive">{returnOrders.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="today">{t("আজ", "Today")}</TabsTrigger>
          <TabsTrigger value="lastday">{t("গতকাল", "Last Day")}</TabsTrigger>
          <TabsTrigger value="3day">{t("৩ দিন", "3 Days")}</TabsTrigger>
          <TabsTrigger value="weekly">{t("সাপ্তাহিক", "Weekly")}</TabsTrigger>
          <TabsTrigger value="monthly">{t("মাসিক", "Monthly")}</TabsTrigger>
        </TabsList>


        <TabsContent value={tab} className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-medium">{t("আয় ও লাভ (৳)", "Revenue & Profit (৳)")}</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" vertical={false} />
                      <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`} width={45} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number, name: string) => [`৳${value.toLocaleString()}`, name === "revenue" ? t("আয়", "Revenue") : t("লাভ", "Profit")]}
                      />
                      <Legend formatter={(value) => value === "revenue" ? t("আয়", "Revenue") : t("লাভ", "Profit")} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="profit" fill="hsl(142, 76%, 36%)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-medium">{t("অর্ডার সংখ্যা", "Order Count")}</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" vertical={false} />
                      <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis fontSize={10} tickLine={false} axisLine={false} width={35} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                        formatter={(value: number, name: string) => [value, name === "orders" ? t("মোট অর্ডার", "Total Orders") : t("ডেলিভার্ড", "Delivered")]}
                      />
                      <Legend formatter={(value) => value === "orders" ? t("অর্ডার", "Orders") : t("ডেলিভার্ড", "Delivered")} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="delivered" fill="hsl(142, 76%, 36%)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={officeDialog} onOpenChange={setOfficeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("দৈনিক অফিস খরচ", "Daily Office Cost")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">{t("প্রতি দিনের অফিস খরচ (৳)", "Per day office cost (৳)")}</Label>
            <Input type="number" value={officeInput} onChange={(e) => setOfficeInput(e.target.value)} placeholder="2500" />
            <p className="text-[11px] text-muted-foreground">{t("এই মান × মোট দিন = অফিস খরচ", "This value × total days = office cost")}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOfficeDialog(false)}>{t("বাতিল", "Cancel")}</Button>
            <Button
              disabled={savingOffice || !officeInput}
              onClick={async () => {
                const val = Number(officeInput);
                if (!Number.isFinite(val) || val < 0) { toast.error(t("সঠিক মান দিন", "Invalid value")); return; }
                setSavingOffice(true);
                try {
                  await supabase.from("app_settings").upsert(
                    { key: "daily_office_cost", value: String(val), updated_at: new Date().toISOString() },
                    { onConflict: "key" }
                  );
                  queryClient.invalidateQueries({ queryKey: ["app-settings-daily-office-cost"] });
                  toast.success(t("সেভ হয়েছে", "Saved"));
                  setOfficeDialog(false);
                } catch (e: any) {
                  toast.error(e?.message || t("সেভ ব্যর্থ", "Save failed"));
                } finally {
                  setSavingOffice(false);
                }
              }}
            >
              {savingOffice ? <Loader2 className="w-4 h-4 animate-spin" /> : t("সেভ করুন", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={packagingDialog} onOpenChange={setPackagingDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("প্যাকেজিং খরচ", "Packaging Cost")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">{t("প্রতি অর্ডারের প্যাকেজিং খরচ (৳)", "Per order packaging cost (৳)")}</Label>
            <Input type="number" value={packagingInput} onChange={(e) => setPackagingInput(e.target.value)} placeholder="10" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPackagingDialog(false)}>{t("বাতিল", "Cancel")}</Button>
            <Button
              disabled={savingPackaging || !packagingInput}
              onClick={async () => {
                const val = Number(packagingInput);
                if (!Number.isFinite(val) || val < 0) { toast.error(t("সঠিক মান দিন", "Invalid value")); return; }
                setSavingPackaging(true);
                try {
                  await supabase.from("app_settings").upsert(
                    { key: "packaging_cost", value: String(val), updated_at: new Date().toISOString() },
                    { onConflict: "key" }
                  );
                  queryClient.invalidateQueries({ queryKey: ["app-settings-packaging-cost"] });
                  toast.success(t("সেভ হয়েছে", "Saved"));
                  setPackagingDialog(false);
                } catch (e: any) {
                  toast.error(e?.message || t("সেভ ব্যর্থ", "Save failed"));
                } finally {
                  setSavingPackaging(false);
                }
              }}
            >
              {savingPackaging ? <Loader2 className="w-4 h-4 animate-spin" /> : t("সেভ করুন", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adsDialog} onOpenChange={setAdsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Ads খরচ যোগ করুন", "Add Ads Spend")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("তারিখ", "Date")}</Label>
              <Input type="date" value={adsDate} onChange={(e) => setAdsDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("খরচ (৳ BDT)", "Spend (৳ BDT)")}</Label>
              <Input type="number" value={adsAmount} onChange={(e) => setAdsAmount(e.target.value)} placeholder="0" />
              <p className="text-[11px] text-muted-foreground mt-1">{t("একই তারিখে আবার দিলে আগের মান পরিবর্তন হবে", "Re-entering same date will overwrite previous value")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdsDialog(false)}>{t("বাতিল", "Cancel")}</Button>
            <Button
              disabled={savingAds || !adsDate || !adsAmount}
              onClick={async () => {
                const bdt = Number(adsAmount);
                if (!Number.isFinite(bdt) || bdt < 0) { toast.error(t("সঠিক মান দিন", "Invalid value")); return; }
                setSavingAds(true);
                try {
                  const { error } = await supabase.from("ads_daily_spend").upsert(
                    { spend_date: adsDate, spend_bdt: bdt, spend_usd: 0, impressions: 0, clicks: 0, purchases: 0, campaigns_data: [] },
                    { onConflict: "spend_date" }
                  );
                  if (error) throw error;
                  await refetchAds();
                  toast.success(t("সেভ হয়েছে", "Saved"));
                  setAdsDialog(false);
                } catch (e: any) {
                  toast.error(e?.message || t("সেভ ব্যর্থ", "Save failed"));
                } finally {
                  setSavingAds(false);
                }
              }}
            >
              {savingAds ? <Loader2 className="w-4 h-4 animate-spin" /> : t("সেভ করুন", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
