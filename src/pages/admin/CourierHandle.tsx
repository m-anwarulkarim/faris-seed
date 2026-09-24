import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, Loader2, ClipboardCheck, Truck, PackageCheck, PackageMinus,
  RotateCcw, Undo2, HelpCircle, Clock, Eye, ChevronLeft, ChevronRight,
  Pause, AlertTriangle, Calendar, RefreshCw, List, CalendarRange,
  ChevronDown, FolderOpen, Phone, Send, ExternalLink,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PartialDeliveryDialog } from "@/components/admin/PartialDeliveryDialog";
import { formatDistanceToNow } from "date-fns";
import { PhoneVerifiedBadge } from "@/components/PhoneVerifiedBadge";
import { usePhoneVerificationMap } from "@/hooks/usePhoneVerification";
import { bn } from "date-fns/locale";

const SYNC_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const SYNCABLE_STATUSES = [
  "in_review", "pending",
  "delivered_approval_pending", "partial_delivered_approval_pending",
  "hold", "unknown_approval_pending", "cancelled_approval_pending",
  "entry_done", "on_the_way",
];

const PAGE_SIZE = 50;
const MAX_DAY_FILTER = 30;

const COURIER_STATUS_TABS = [
  {
    value: "in_review",
    label: "এন্ট্রি ডান",
    labelEn: "Entry Done",
    color: "bg-teal-100 text-teal-800 border-teal-200",
    icon: ClipboardCheck,
    tooltip: null,
    dbStatuses: ["in_review", "entry_done"],
  },
  {
    value: "picked",
    label: "শিপড",
    labelEn: "Shipped",
    color: "bg-indigo-100 text-indigo-800 border-indigo-200",
    icon: Truck,
    tooltip: null,
    dbStatuses: ["picked", "pending", "on_the_way"],
  },
  {
    value: "hold",
    label: "Hold in Courier",
    labelEn: "Hold in Courier",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: Pause,
    tooltip: null,
    dbStatuses: ["hold"],
  },
  {
    value: "cancelled_approval_pending",
    label: "Pending Return",
    labelEn: "Pending Return",
    color: "bg-rose-100 text-rose-800 border-rose-200",
    icon: RotateCcw,
    tooltip: null,
    dbStatuses: ["cancelled_approval_pending"],
  },
  {
    value: "unknown_approval_pending",
    label: "U-AP",
    labelEn: "U-AP",
    color: "bg-slate-100 text-slate-800 border-slate-200",
    icon: HelpCircle,
    tooltip: "unknown_approval_pending",
    dbStatuses: ["unknown_approval_pending"],
  },
  {
    value: "delivered_approval_pending",
    label: "DAP",
    labelEn: "DAP",
    color: "bg-lime-100 text-lime-800 border-lime-200",
    icon: Clock,
    tooltip: "delivered_approval_pending",
    dbStatuses: ["delivered_approval_pending"],
    group: "more",
  },
  {
    value: "partial_delivered_approval_pending",
    label: "P-DAP",
    labelEn: "P-DAP",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: AlertTriangle,
    tooltip: "partial_delivered_approval_pending",
    dbStatuses: ["partial_delivered_approval_pending"],
    group: "more",
  },
  {
    value: "partial_delivered",
    label: "Partial Delivered",
    labelEn: "Partial Delivered",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: PackageMinus,
    tooltip: null,
    dbStatuses: ["partial_delivered"],
    group: "more",
  },
  {
    value: "unknown",
    label: "Missing",
    labelEn: "Missing",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: HelpCircle,
    tooltip: null,
    dbStatuses: ["unknown", "missing"],
    group: "more",
  },
  {
    value: "cancelled_orders",
    label: "Cancel",
    labelEn: "Cancel",
    color: "bg-rose-100 text-rose-800 border-rose-200",
    icon: RotateCcw,
    tooltip: "কুরিয়ার ক্যানসেল করা অর্ডার",
    dbStatuses: ["cancelled"],
    group: "more",
  },
  {
    value: "cancelled",
    label: "Returned",
    labelEn: "Returned",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: Undo2,
    tooltip: null,
    dbStatuses: ["return"],
    group: "more",
  },
  {
    value: "rtn_received",
    label: "RTN Received",
    labelEn: "RTN Received",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: PackageCheck,
    tooltip: "কুরিয়ার থেকে রিটার্ন পার্সেল ফেরত পাওয়া হয়েছে",
    dbStatuses: ["rtn_received"],
  },
  {
    value: "delivered",
    label: "ডেলিভারড",
    labelEn: "Delivered",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: PackageCheck,
    tooltip: null,
    dbStatuses: ["delivered"],
  },
  {
    value: "all",
    label: "সব",
    labelEn: "ALL",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: List,
    tooltip: null,
    dbStatuses: [],
  },
] as const;

const GROUPED_TAB_VALUES: string[] = COURIER_STATUS_TABS.filter((t) => (t as { group?: string }).group === "more").map((t) => t.value);
const MAIN_TABS = COURIER_STATUS_TABS.filter((t) => !(t as { group?: string }).group);
const GROUP_TABS = COURIER_STATUS_TABS.filter((t) => (t as { group?: string }).group === "more");
const KNOWN_COURIER_STATUSES = new Set<string>(COURIER_STATUS_TABS.flatMap((tab) => [...tab.dbStatuses]));
const FINAL_STATUSES: string[] = ["delivered", "unknown", "cancelled", "rtn_received", "all"];

type CourierPopupState = {
  orderId: string;
  dbId: string;
  consignmentId: string;
  customerName: string;
  phone: string;
  effectiveStatus: string;
} | null;

type CourierSummaryRow = {
  created_at: string;
  status: string | null;
  delivery_status: string | null;
};

type CourierOrder = {
  id: string;
  order_id: string;
  customer_facing_id?: string | null;
  customer_name: string;
  phone: string;
  address: string;
  total_amount: number;
  delivery_charge: number | null;
  advance: number;
  discount: number;
  status: string;
  delivery_status: string | null;
  consignment_id: string | null;
  tracking_code: string | null;
  created_at: string;
  updated_at: string;
  district: string | null;
  thana: string | null;
  note: string | null;
  courier_note: string | null;
  courier_remarks: string | null;
};

function getDayAge(dateStr: string): number {
  const now = new Date();
  const d = new Date(dateStr);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const orderDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((todayStart.getTime() - orderDay.getTime()) / (1000 * 60 * 60 * 24));
}

function resolveCourierStatus(status?: string | null, deliveryStatus?: string | null) {
  if (deliveryStatus && KNOWN_COURIER_STATUSES.has(deliveryStatus)) return deliveryStatus;
  if (status && KNOWN_COURIER_STATUSES.has(status)) return status;
  return deliveryStatus || status || "pending";
}

function tabMatchesStatus(tab: { dbStatuses: readonly string[] }, status: string) {
  return (tab.dbStatuses as readonly string[]).includes(status);
}

export default function CourierHandle() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t, lang } = useLanguage();

  const requestedTab = searchParams.get("tab") || "in_review";
  const validRequestedTab = COURIER_STATUS_TABS.some((tab) => tab.value === requestedTab) ? requestedTab : "in_review";

  const [activeTab, setActiveTab] = useState(validRequestedTab);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState("");
  const [tempTo, setTempTo] = useState("");
  const [moreGroupOpen, setMoreGroupOpen] = useState(GROUPED_TAB_VALUES.includes(validRequestedTab));
  const [courierPopup, setCourierPopup] = useState<CourierPopupState>(null);
  const [rtnLoading, setRtnLoading] = useState(false);
  const [partialDelivery, setPartialDelivery] = useState<{ dbId: string; orderId: string; customerName: string } | null>(null);
  const [syncQueue, setSyncQueue] = useState<Array<{ id: string; consignment_id: string }>>([]);
  const [syncIndex, setSyncIndex] = useState(0);
  const [fetchingReturns, setFetchingReturns] = useState(false);
  const [returnFetchResult, setReturnFetchResult] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (activeTab !== validRequestedTab) {
      setActiveTab(validRequestedTab);
      setMoreGroupOpen(GROUPED_TAB_VALUES.includes(validRequestedTab));
    }
  }, [activeTab, validRequestedTab]);

  const setActiveTabWithUrl = useCallback((tabValue: string) => {
    setActiveTab(tabValue);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tabValue);
      return next;
    });
    if (GROUPED_TAB_VALUES.includes(tabValue)) {
      setMoreGroupOpen(true);
    }
  }, [setSearchParams]);

  const syncPercent = syncQueue.length > 0 ? Math.round((syncIndex / syncQueue.length) * 100) : 0;

  const startSync = useCallback(async () => {
    if (syncingRef.current) return;

    syncingRef.current = true;
    setIsSyncing(true);
    setSyncQueue([]);
    setSyncIndex(0);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const syncableStatusesClause = SYNCABLE_STATUSES.join(",");
      const { data: eligibleOrders, error } = await supabase
        .from("orders")
        .select("id, consignment_id, status, delivery_status, courier_provider")
        .eq("is_courier_entered", true)
        .eq("is_deleted", false)
        .or(`delivery_status.in.(${syncableStatusesClause}),status.in.(${syncableStatusesClause})`)
        .not("consignment_id", "is", null);

      if (error) throw error;

      const queue = (eligibleOrders || [])
        .filter((order) => !!order.consignment_id)
        .map((order) => ({
          id: order.id,
          consignment_id: order.consignment_id as string,
          courier_provider: (order as any).courier_provider || "steadfast",
        }));

      if (!queue.length) {
        setLastSyncTime(new Date());
        return;
      }

      setSyncQueue(queue);

      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        const fnName = item.courier_provider === "pathao" ? "pathao-courier" : "steadfast-courier";
        await supabase.functions.invoke(fnName, {
          body: {
            action: "check_single_status",
            order_id: item.id,
            consignment_id: item.consignment_id,
          },
        });
        setSyncIndex(i + 1);
      }

      // Also fetch return requests during sync
      try {
        await supabase.functions.invoke("steadfast-courier", {
          body: { action: "fetch_return_requests" },
        });
      } catch (e) {
        console.error("Return fetch during sync failed:", e);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
      ]);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error("Courier sync failed:", error);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
      cooldownRef.current = setTimeout(() => {
        void startSync();
      }, SYNC_COOLDOWN_MS);
    }
  }, [queryClient]);

  // Auto-sync permanently disabled — manual sync only via button
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  const handleManualSync = useCallback(() => {
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    void startSync();
  }, [startSync]);

  const fetchReturnData = useCallback(async () => {
    setFetchingReturns(true);
    setReturnFetchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("steadfast-courier", {
        body: { action: "fetch_return_requests" },
      });
      if (error) throw error;
      const msg = data?.updated > 0
        ? t(`${data.updated}টি অর্ডার C-AP তে আপডেট হয়েছে (মোট: ${data.total || 0})`, `${data.updated} orders moved to C-AP (total: ${data.total || 0})`)
        : data?.total === 0
          ? t("কুরিয়ারে কোনো অ্যাক্টিভ রিটার্ন রিকোয়েস্ট নেই", "No active return requests in courier")
          : t(`কোনো নতুন রিটার্ন নেই (API: ${data?.total || 0})`, `No new returns (API: ${data?.total || 0})`);
      setReturnFetchResult(msg);
      toast.success(msg);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
      ]);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to sync statuses";
      toast.error(errMsg);
      setReturnFetchResult(errMsg);
    } finally {
      setFetchingReturns(false);
    }
  }, [queryClient, t]);

  useEffect(() => {
    setPage(0);
  }, [search, activeTab, selectedDay, customRange]);

  const { data: allCourierOrders } = useQuery({
    queryKey: ["courier-all-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, status, delivery_status")
        .eq("is_courier_entered", true)
        .eq("is_deleted", false);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Cloud cost: was 30s
  });

  const { availableDays, tabCountsForDay, globalTabCounts } = useMemo(() => {
    const dayMap: Record<number, Record<string, number>> = {};
    const globalCounts: Record<string, number> = Object.fromEntries(
      COURIER_STATUS_TABS.map((tab) => [tab.value, 0]),
    );

    for (const order of allCourierOrders || []) {
      const age = getDayAge(order.created_at);
      const effectiveStatus = resolveCourierStatus(order.status, order.delivery_status);
      const tab = COURIER_STATUS_TABS.find((item) => tabMatchesStatus(item, effectiveStatus));
      if (!tab) continue;

      globalCounts[tab.value] = (globalCounts[tab.value] || 0) + 1;
      globalCounts.all = (globalCounts.all || 0) + 1;

      if (age >= 1 && age <= MAX_DAY_FILTER && !FINAL_STATUSES.includes(tab.value)) {
        if (!dayMap[age]) {
          dayMap[age] = Object.fromEntries(COURIER_STATUS_TABS.map((item) => [item.value, 0]));
        }
        dayMap[age][tab.value] = (dayMap[age][tab.value] || 0) + 1;
        dayMap[age].all = (dayMap[age].all || 0) + 1;
      }
    }

    return {
      availableDays: Object.keys(dayMap).map(Number).sort((a, b) => a - b),
      tabCountsForDay: dayMap,
      globalTabCounts: globalCounts,
    };
  }, [allCourierOrders]);

  const tabCounts = useMemo(() => {
    if (selectedDay === null) return globalTabCounts;
    return tabCountsForDay[selectedDay] || {};
  }, [selectedDay, globalTabCounts, tabCountsForDay]);

  const dayFilterDate = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      const from = new Date(customRange.from); from.setHours(0, 0, 0, 0);
      const to = new Date(customRange.to); to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (selectedDay === null) return null;
    const d = new Date();
    d.setDate(d.getDate() - selectedDay);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { from: d.toISOString(), to: end.toISOString() };
  }, [selectedDay, customRange]);

  const activeTabConfig = COURIER_STATUS_TABS.find((tab) => tab.value === activeTab) || COURIER_STATUS_TABS[0];

  const { data: filteredOrders = [], isLoading } = useQuery({
    queryKey: ["courier-orders", activeTab, search, selectedDay, customRange?.from, customRange?.to],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, order_id, customer_facing_id, customer_name, phone, address, total_amount, delivery_charge, advance, discount, status, delivery_status, consignment_id, tracking_code, created_at, updated_at, district, thana, note, courier_note, courier_remarks")
        .eq("is_courier_entered", true)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false });

      if (dayFilterDate) {
        query = query.gte("created_at", dayFilterDate.from).lte("created_at", dayFilterDate.to);
      }

      if (search.trim()) {
        const term = search.trim();
        query = query.or(`order_id.ilike.%${term}%,customer_facing_id.ilike.%${term}%,customer_name.ilike.%${term}%,phone.ilike.%${term}%,consignment_id.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const orders = (data || []) as CourierOrder[];
      if (!activeTabConfig.dbStatuses.length) return orders;

      return orders.filter((order) => tabMatchesStatus(activeTabConfig, resolveCourierStatus(order.status, order.delivery_status)));
    },
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const verifiedPhones = usePhoneVerificationMap(useMemo(() => filteredOrders.map((o) => o.phone), [filteredOrders]));
  const paginatedOrders = useMemo(
    () => filteredOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredOrders, page],
  );

  useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  // Fetch order items for popup
  const { data: popupOrderItems } = useQuery({
    queryKey: ["popup-order-items", courierPopup?.dbId],
    enabled: !!courierPopup?.dbId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_name, quantity, unit_price, product_image, products(product_image)")
        .eq("order_id", courierPopup!.dbId);
      if (error) throw error;
      return (data || []).map((i: any) => ({
        ...i,
        product_image: i.product_image || i.products?.product_image || null,
      }));
    },
  });

  const getStatusBadge = (status: string | null, deliveryStatus: string | null) => {
    const effectiveStatus = resolveCourierStatus(status, deliveryStatus);
    const tab = COURIER_STATUS_TABS.find((item) => tabMatchesStatus(item, effectiveStatus));
    if (!tab) return <Badge variant="outline">{effectiveStatus}</Badge>;

    const Icon = tab.icon;
    const badge = (
      <Badge className={`${tab.color} border text-xs gap-1`}>
        <Icon className="w-3 h-3" />
        {t(tab.label, tab.labelEn)}
      </Badge>
    );

    if (tab.tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>{tab.tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return badge;
  };

  const headerActionsEl = typeof document !== "undefined" ? document.getElementById("admin-header-actions") : null;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {headerActionsEl && createPortal(
          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
            {isSyncing && syncQueue.length > 0 && (
              <span className="text-emerald-600 font-medium">{syncPercent}%</span>
            )}
            {lastSyncTime && !isSyncing && (
              <span className="hidden sm:inline">
                {formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: lang === "bn" ? bn : undefined })}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              disabled={isSyncing}
              onClick={handleManualSync}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {t("চেক করুন", "Check Now")}
            </Button>
          </div>,
          headerActionsEl,
        )}

        {isSyncing && syncQueue.length > 0 && (
          <div className="-mt-4 -mx-4 mb-0">
            <Progress value={syncPercent} className="h-1 rounded-none [&>div]:bg-emerald-500" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-1.5 pb-2">
              {availableDays.map((dayNum) => {
                const isActive = selectedDay === dayNum;
                const dayTotal = tabCountsForDay[dayNum]?.all || 0;
                return (
                  <Button
                    key={dayNum}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-2.5 text-xs shrink-0 ${isActive ? "" : "opacity-70 hover:opacity-100"}`}
                    onClick={() => setSelectedDay(isActive ? null : dayNum)}
                  >
                    {dayNum}D
                    {dayTotal > 0 && (
                      <span className={`ml-1 px-1 rounded-full text-[9px] font-bold ${isActive ? "bg-background/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {dayTotal}
                      </span>
                    )}
                  </Button>
                );
              })}
              <Button
                variant={selectedDay === null && !customRange ? "default" : "outline"}
                size="sm"
                className={`h-7 px-3 text-xs shrink-0 ${selectedDay === null && !customRange ? "" : "opacity-70 hover:opacity-100"}`}
                onClick={() => { setSelectedDay(null); setCustomRange(null); }}
              >
                All
              </Button>
              <Popover open={customOpen} onOpenChange={(o) => {
                setCustomOpen(o);
                if (o) {
                  setTempFrom(customRange?.from || "");
                  setTempTo(customRange?.to || new Date().toISOString().split("T")[0]);
                }
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant={customRange ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-2.5 text-xs shrink-0 gap-1 ${customRange ? "" : "opacity-70 hover:opacity-100"}`}
                  >
                    <CalendarRange className="w-3 h-3" />
                    {customRange ? `${customRange.from} → ${customRange.to}` : t("কাস্টম", "Custom")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 space-y-2" align="start">
                  <div className="flex items-center gap-2">
                    <Input type="date" value={tempFrom} onChange={(e) => setTempFrom(e.target.value)} className="w-auto h-8 text-xs" />
                    <span className="text-xs text-muted-foreground">→</span>
                    <Input type="date" value={tempTo} onChange={(e) => setTempTo(e.target.value)} className="w-auto h-8 text-xs" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      disabled={!tempFrom || !tempTo}
                      onClick={() => {
                        setCustomRange({ from: tempFrom, to: tempTo });
                        setSelectedDay(null);
                        setCustomOpen(false);
                      }}
                    >
                      {t("প্রয়োগ", "Apply")}
                    </Button>
                    {customRange && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => { setCustomRange(null); setCustomOpen(false); }}
                      >
                        {t("ক্লিয়ার", "Clear")}
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {MAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts?.[tab.value] || 0;
            const isActive = activeTab === tab.value;
            const btn = (
              <Button
                key={tab.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={`text-xs gap-1 h-8 ${isActive ? "" : "opacity-70 hover:opacity-100"}`}
                onClick={() => setActiveTabWithUrl(tab.value)}
              >
                <Icon className="w-3.5 h-3.5" />
                {lang === "bn" ? tab.label : tab.labelEn}
                {count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-background/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                )}
              </Button>
            );

            if (tab.tooltip) {
              return (
                <Tooltip key={tab.value}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent>{tab.tooltip}</TooltipContent>
                </Tooltip>
              );
            }

            return btn;
          })}

          {(() => {
            const groupTotal = GROUP_TABS.reduce((sum, tab) => sum + (tabCounts?.[tab.value] || 0), 0);
            const isGroupActive = GROUPED_TAB_VALUES.includes(activeTab);
            return (
              <Button
                variant={isGroupActive ? "default" : "outline"}
                size="sm"
                className={`text-xs gap-1 h-8 ${isGroupActive || moreGroupOpen ? "" : "opacity-70 hover:opacity-100"}`}
                onClick={() => setMoreGroupOpen((prev) => !prev)}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {lang === "bn" ? "আরও" : "More"}
                {groupTotal > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isGroupActive ? "bg-background/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {groupTotal}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${moreGroupOpen ? "rotate-180" : ""}`} />
              </Button>
            );
          })()}
        </div>

        {moreGroupOpen && (
          <div className="flex flex-wrap gap-1.5 pl-2 border-l-2 border-muted">
            {GROUP_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = tabCounts?.[tab.value] || 0;
              const isActive = activeTab === tab.value;
              const btn = (
                <Button
                  key={tab.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`text-xs gap-1 h-8 ${isActive ? "" : "opacity-70 hover:opacity-100"}`}
                  onClick={() => setActiveTabWithUrl(tab.value)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {lang === "bn" ? tab.label : tab.labelEn}
                  {count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-background/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {count}
                    </span>
                  )}
                </Button>
              );

              if (tab.tooltip) {
                return (
                  <Tooltip key={tab.value}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent>{tab.tooltip}</TooltipContent>
                  </Tooltip>
                );
              }

              return btn;
            })}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("অর্ডার/নাম/ফোন/কনসাইনমেন্ট খুঁজুন...", "Search order/name/phone/consignment...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {activeTab === "cancelled_approval_pending" && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              disabled={fetchingReturns}
              onClick={fetchReturnData}
            >
              {fetchingReturns ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {t("রিটার্ন ডেটা আনুন", "Fetch Returns")}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !paginatedOrders.length ? (
          <div className="text-center py-12 text-muted-foreground">
            {t("এই স্ট্যাটাসে কোনো অর্ডার নেই", "No orders in this status")}
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">{t("অর্ডার", "Order")}</TableHead>
                    <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("ঠিকানা", "Address")}</TableHead>
                    <TableHead className="text-right">{t("টাকা", "Amount")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("কনসাইনমেন্ট", "Consignment")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("স্ট্যাটাস", "Status")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("সময়", "Time")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        const effectiveStatus = resolveCourierStatus(order.status, order.delivery_status);
                        if (effectiveStatus === "partial_delivered_approval_pending") {
                          setPartialDelivery({
                            dbId: order.id,
                            orderId: order.order_id,
                            customerName: order.customer_name,
                          });
                          return;
                        }
                        if (order.consignment_id?.trim()) {
                          setCourierPopup({
                            orderId: order.order_id,
                            dbId: order.id,
                            consignmentId: order.consignment_id.trim(),
                            customerName: order.customer_name,
                            phone: order.phone,
                            effectiveStatus,
                          });
                        } else {
                          navigate(`/e/orders/edit/${order.order_id}`);
                        }
                      }}
                    >
                      <TableCell className="font-mono text-xs font-medium">{order.customer_facing_id || order.order_id}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{order.customer_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">{order.phone} <PhoneVerifiedBadge verified={verifiedPhones.get(order.phone) === true} /></div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {order.address}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        ৳{order.total_amount}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs">
                        {order.consignment_id || "-"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {getStatusBadge(order.status, order.delivery_status)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(order.updated_at), {
                          addSuffix: true,
                          locale: lang === "bn" ? bn : undefined,
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/e/orders/edit/${order.order_id}`);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t(`পেজ ${page + 1} / ${totalPages}`, `Page ${page + 1} / ${totalPages}`)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((prev) => prev - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((prev) => prev + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        <Dialog open={!!courierPopup} onOpenChange={(open) => !open && setCourierPopup(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium">
                {courierPopup?.orderId} — {courierPopup?.customerName}
              </DialogTitle>
              <DialogDescription className="text-xs space-y-1">
                <span>Consignment: <span className="font-mono font-medium text-foreground">{courierPopup?.consignmentId}</span></span>
                {courierPopup && (() => {
                  const popupOrder = filteredOrders?.find((o: any) => o.id === courierPopup.dbId);
                  return popupOrder?.courier_remarks ? (
                    <span className="block text-[11px] text-amber-600 dark:text-amber-400">
                      💬 কুরিয়ার রিমার্কস: {popupOrder.courier_remarks}
                    </span>
                  ) : null;
                })()}
              </DialogDescription>
            </DialogHeader>

            {/* Order Items Section - show for cancelled_approval_pending */}
            {courierPopup?.effectiveStatus === "cancelled_approval_pending" && popupOrderItems && popupOrderItems.length > 0 && (
              <div className="border rounded-md p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{t("অর্ডার আইটেম", "Order Items")}</p>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {popupOrderItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name} className="w-8 h-8 rounded border border-border object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded border border-border bg-muted flex items-center justify-center shrink-0">
                          <PackageCheck className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.product_name}</p>
                        <p className="text-[10px] text-muted-foreground">×{item.quantity} · ৳{item.unit_price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {/* Call Customer - show for cancelled_approval_pending */}
              {courierPopup?.effectiveStatus === "cancelled_approval_pending" && courierPopup?.phone && (
                <a href={`tel:${courierPopup.phone}`} className="block">
                  <Button variant="outline" className="w-full gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                    <Phone className="w-4 h-4" />
                    {t("কাস্টমারকে কল করুন", "Call Customer")} ({courierPopup.phone})
                  </Button>
                </a>
              )}

              {/* Courier Link */}
              <Button
                className="w-full gap-2"
                type="button"
                onClick={() => {
                  if (!courierPopup?.consignmentId) return;
                  window.open(`https://steadfast.com.bd/user/consignment/${courierPopup.consignmentId}`, "_blank", "noopener");
                }}
              >
                <ExternalLink className="w-4 h-4" />
                {t("কুরিয়ারে দেখুন", "View on Courier")}
              </Button>

              {/* Pending Return specific actions: Confirm Cancel + Resend */}
              {courierPopup?.effectiveStatus === "cancelled_approval_pending" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="destructive"
                    className="w-full gap-1.5 text-xs"
                    type="button"
                    disabled={rtnLoading}
                    onClick={async () => {
                      if (!courierPopup?.dbId) return;
                      setRtnLoading(true);
                      try {
                        const { error } = await supabase
                          .from("orders")
                          .update({ status: "return", delivery_status: "return" })
                          .eq("id", courierPopup.dbId);
                        if (error) throw error;

                        const { data: session } = await supabase.auth.getSession();
                        const adminId = session?.session?.user?.id || null;
                        await supabase.from("order_status_history").insert({
                          order_id: courierPopup.dbId,
                          status: "return",
                          changed_by: adminId,
                          changed_by_name: session?.session?.user?.email || "Admin",
                        });

                        toast.success(t("ক্যানসেল কনফার্ম — Returned এ সরানো হয়েছে", "Cancel confirmed — moved to Returned"));
                        setCourierPopup(null);
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
                          queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
                        ]);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed");
                      } finally {
                        setRtnLoading(false);
                      }
                    }}
                  >
                    {rtnLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {t("ক্যানসেল কনফার্ম", "Confirm Cancel")}
                  </Button>
                  <Button
                    className="w-full gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    type="button"
                    disabled={rtnLoading}
                    onClick={async () => {
                      if (!courierPopup?.dbId) return;
                      setRtnLoading(true);
                      try {
                        const { error } = await supabase
                          .from("orders")
                          .update({ status: "confirmed", delivery_status: "pending", is_courier_entered: false, consignment_id: null, tracking_code: null })
                          .eq("id", courierPopup.dbId);
                        if (error) throw error;

                        const { data: session } = await supabase.auth.getSession();
                        const adminId = session?.session?.user?.id || null;
                        await supabase.from("order_status_history").insert({
                          order_id: courierPopup.dbId,
                          status: "confirmed",
                          changed_by: adminId,
                          changed_by_name: session?.session?.user?.email || "Admin",
                        });

                        toast.success(t("রিসেন্ড — Confirmed এ ফেরত গেছে, আবার কুরিয়ার এন্ট্রি করুন", "Resend — moved to Confirmed, re-enter to courier"));
                        setCourierPopup(null);
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
                          queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
                        ]);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed");
                      } finally {
                        setRtnLoading(false);
                      }
                    }}
                  >
                    {rtnLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {t("রিসেন্ড করুন", "Resend")}
                  </Button>
                </div>
              )}

              {/* RTN Received for cancelled/return */}
              {(courierPopup?.effectiveStatus === "cancelled" || courierPopup?.effectiveStatus === "return") && (
                <Button
                  className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  type="button"
                  disabled={rtnLoading}
                  onClick={async () => {
                    if (!courierPopup?.dbId) return;
                    setRtnLoading(true);
                    try {
                      const { error } = await supabase
                        .from("orders")
                        .update({ status: "rtn_received", delivery_status: "rtn_received" })
                        .eq("id", courierPopup.dbId);
                      if (error) throw error;

                      const { data: session } = await supabase.auth.getSession();
                      const adminId = session?.session?.user?.id || null;
                      await supabase.from("order_status_history").insert({
                        order_id: courierPopup.dbId,
                        status: "rtn_received",
                        changed_by: adminId,
                        changed_by_name: session?.session?.user?.email || "Admin",
                      });

                      toast.success(t("RTN Received সফল — স্টক ফেরত এসেছে", "RTN Received — stock restored"));
                      setCourierPopup(null);
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
                        queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
                      ]);
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to update status");
                    } finally {
                      setRtnLoading(false);
                    }
                  }}
                >
                  {rtnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
                  {t("RTN Received করুন", "Mark RTN Received")}
                </Button>
              )}

              {/* U-AP actions */}
              {courierPopup?.effectiveStatus === "unknown_approval_pending" && (
                <>
                  <Button
                    className="w-full gap-2 bg-gray-600 hover:bg-gray-700 text-white"
                    type="button"
                    disabled={rtnLoading}
                    onClick={async () => {
                      if (!courierPopup?.dbId) return;
                      setRtnLoading(true);
                      try {
                        const { error } = await supabase
                          .from("orders")
                          .update({ status: "missing", delivery_status: "missing" })
                          .eq("id", courierPopup.dbId);
                        if (error) throw error;

                        const { data: session } = await supabase.auth.getSession();
                        const adminId = session?.session?.user?.id || null;
                        await supabase.from("order_status_history").insert({
                          order_id: courierPopup.dbId,
                          status: "missing",
                          changed_by: adminId,
                          changed_by_name: session?.session?.user?.email || "Admin",
                        });

                        toast.success(t("Missing স্ট্যাটাস আপডেট হয়েছে — স্টক অ্যাডজাস্ট হয়েছে", "Missing status updated — stock adjusted"));
                        setCourierPopup(null);
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
                          queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
                        ]);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to update status");
                      } finally {
                        setRtnLoading(false);
                      }
                    }}
                  >
                    {rtnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HelpCircle className="w-4 h-4" />}
                    {t("Missing করুন", "Mark as Missing")}
                  </Button>
                  <Button
                    className="w-full gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                    type="button"
                    disabled={rtnLoading}
                    onClick={async () => {
                      if (!courierPopup?.dbId) return;
                      setRtnLoading(true);
                      try {
                        const { error } = await supabase
                          .from("orders")
                          .update({ status: "cancelled", delivery_status: "cancelled" })
                          .eq("id", courierPopup.dbId);
                        if (error) throw error;

                        const { data: session } = await supabase.auth.getSession();
                        const adminId = session?.session?.user?.id || null;
                        await supabase.from("order_status_history").insert({
                          order_id: courierPopup.dbId,
                          status: "cancelled",
                          changed_by: adminId,
                          changed_by_name: session?.session?.user?.email || "Admin",
                        });

                        toast.success(t("Cancel স্ট্যাটাস আপডেট হয়েছে — স্টক অ্যাডজাস্ট হয়েছে", "Cancel status updated — stock adjusted"));
                        setCourierPopup(null);
                        await Promise.all([
                          queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
                          queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
                        ]);
                      } catch (err: any) {
                        toast.error(err?.message || "Failed to update status");
                      } finally {
                        setRtnLoading(false);
                      }
                    }}
                  >
                    {rtnLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    {t("Cancel করুন", "Mark as Cancel")}
                  </Button>
                </>
              )}

              {/* View Order */}
              <a
                href={`${window.location.origin}/e/orders/edit/${courierPopup?.orderId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setCourierPopup(null)}
              >
                <Button variant="outline" className="w-full gap-2">
                  <Eye className="w-4 h-4" />
                  {t("অর্ডার দেখুন", "View Order")}
                </Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>

        <PartialDeliveryDialog
          open={!!partialDelivery}
          onClose={() => setPartialDelivery(null)}
          dbId={partialDelivery?.dbId || ""}
          orderId={partialDelivery?.orderId || ""}
          customerName={partialDelivery?.customerName || ""}
        />
      </div>
    </TooltipProvider>
  );
}
