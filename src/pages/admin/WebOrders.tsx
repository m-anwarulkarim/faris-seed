import { useState, useMemo, useEffect, Fragment } from "react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Search, Loader2, Package, Clock, PhoneOff, ThumbsUp,
  PhoneCall, Pause, CalendarClock, CheckCircle2, XCircle,
  Pencil, StickyNote, Tag, AlertTriangle, RotateCcw,
  ArrowRightCircle, Repeat, Copy, ChevronLeft, ChevronRight, Shield, Trash2,
} from "lucide-react";
import { SourceBadge } from "@/components/admin/SourceBadge";
import { CreatedByBadge } from "@/components/admin/CreatedByBadge";
import { PhoneVerifiedBadge } from "@/components/PhoneVerifiedBadge";
import { usePhoneVerificationMap } from "@/hooks/usePhoneVerification";

import { FraudResultCard } from "@/components/admin/FraudCheckerDialog";
import { OrderIpBlockPanel } from "@/components/admin/OrderIpBlockPanel";
import { PaymentBadge } from "@/components/admin/PaymentBadge";


const PAGE_SIZE = 50;
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { bn } from "date-fns/locale";
import { DateRangeFilter, DateRangeValue, getDateRangeISO } from "@/components/admin/DateRangeFilter";

const WEB_STATUS_OPTIONS = [
  { value: "pending", label: "Pending", labelBn: "পেন্ডিং", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  { value: "no_response", label: "No Response", labelBn: "নো রেসপন্স", color: "bg-orange-100 text-orange-800 border-orange-200", icon: PhoneOff },
  { value: "good_but_no_response", label: "Good But No Response", labelBn: "গুড বাট নো রেসপন্স", color: "bg-amber-100 text-amber-800 border-amber-200", icon: ThumbsUp },
  { value: "busy", label: "Busy", labelBn: "বিজি", color: "bg-slate-100 text-slate-800 border-slate-200", icon: PhoneCall },
  { value: "hold", label: "Hold", labelBn: "হোল্ড", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Pause },
  { value: "pre", label: "Pre", labelBn: "প্রি", color: "bg-violet-100 text-violet-800 border-violet-200", icon: CalendarClock },
  { value: "cancelled", label: "Cancel", labelBn: "বাতিল", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  { value: "confirmed", label: "Confirmed", labelBn: "কনফার্মড", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
];

// Same as OPTIONS — used for dropdown status changes (includes confirmed)
const WEB_STATUS_WITH_CONFIRM = WEB_STATUS_OPTIONS;

const WEB_STATUS_VALUES = WEB_STATUS_OPTIONS.map((s) => s.value);
const WEB_ORDER_SOURCE_FILTER = "traffic_source.is.null,traffic_source.neq.ecomdrive";

export default function WebOrders() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("filter") || "pending");
  const [paymentFilter, setPaymentFilter] = useState<string>(() => searchParams.get("pay") || "all");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => (searchParams.get("range") as DateRangeValue) || "lifetime");

  // Sync filter state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "pending") params.set("filter", statusFilter);
    if (dateRange !== "lifetime") params.set("range", dateRange);
    if (paymentFilter !== "all") params.set("pay", paymentFilter);
    setSearchParams(params, { replace: true });
  }, [statusFilter, dateRange, paymentFilter]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [preDateDialog, setPreDateDialog] = useState<{ orderId: string; oldStatus: string } | null>(null);
  const [preDateValue, setPreDateValue] = useState("");
  const [fraudLoading, setFraudLoading] = useState(false);
  const [fraudData, setFraudData] = useState<any>(null);
  const minaLockedIds = new Set<string>();

  // Inline (per-row) fraud check state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [rowFraudResults, setRowFraudResults] = useState<Record<string, any>>({});
  const [rowFraudLoading, setRowFraudLoading] = useState<Set<string>>(new Set());
  const [bulkFraudRunning, setBulkFraudRunning] = useState(false);
  const [bulkStatusRunning, setBulkStatusRunning] = useState(false);

  const runBulkStatusChange = async (newStatus: string) => {
    if (!newStatus || selectedRowIds.size === 0) return;
    const ids = Array.from(selectedRowIds);
    const ok = window.confirm(
      t(
        `${ids.length}টি অর্ডারের স্ট্যাটাস "${newStatus}" এ পরিবর্তন করবেন?`,
        `Change status of ${ids.length} order(s) to "${newStatus}"?`
      )
    );
    if (!ok) return;
    setBulkStatusRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const oldStatusById = new Map<string, string>();
      (orders || []).forEach((o: any) => { if (ids.includes(o.id)) oldStatusById.set(o.id, o.status); });
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, last_status_changed_by: session?.user?.id || null } as any)
        .in("id", ids);
      if (error) throw error;
      // Fire notifications in background
      ids.forEach((id) => {
        supabase.functions.invoke("order-status-notify", {
          body: { order_id: id, new_status: newStatus, old_status: oldStatusById.get(id) },
        }).catch(console.error);
      });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
      setSelectedRowIds(new Set());
      toast.success(t(`${ids.length}টি অর্ডার আপডেট হয়েছে`, `${ids.length} orders updated`));
    } catch (e: any) {
      toast.error(e?.message || t("আপডেট ব্যর্থ", "Update failed"));
    } finally {
      setBulkStatusRunning(false);
    }
  };

  // Reset fraud panel when dialog target changes
  useEffect(() => {
    setFraudData(null);
    setFraudLoading(false);
  }, [selectedOrder?.id]);

  const runFraudCheck = async (phone: string) => {
    if (!phone) return;
    setFraudLoading(true);
    setFraudData(null);
    try {
      const { data, error } = await supabase.functions.invoke("fraud-checker", {
        body: { action: "check", phone },
      });
      if (error) throw error;
      setFraudData(data?.data || data);
    } catch (e: any) {
      toast.error(e?.message || t("চেক ব্যর্থ", "Check failed"));
    } finally {
      setFraudLoading(false);
    }
  };

  const runRowFraudCheck = async (orderId: string, phone: string) => {
    if (!phone) return;
    setRowFraudLoading((s) => new Set(s).add(orderId));
    try {
      const { data, error } = await supabase.functions.invoke("fraud-checker", {
        body: { action: "check", phone },
      });
      if (error) throw error;
      setRowFraudResults((r) => ({ ...r, [orderId]: data?.data || data }));
    } catch (e: any) {
      toast.error(e?.message || t("চেক ব্যর্থ", "Check failed"));
    } finally {
      setRowFraudLoading((s) => {
        const n = new Set(s);
        n.delete(orderId);
        return n;
      });
    }
  };

  const runBulkFraudCheck = async (rows: any[]) => {
    const targets = rows.filter((o) => selectedRowIds.has(o.id) && o.phone);
    if (!targets.length) {
      toast.error(t("কোনো অর্ডার সিলেক্ট করা হয়নি", "No orders selected"));
      return;
    }
    setBulkFraudRunning(true);
    try {
      // Parallel — cache hits return instantly; API misses run concurrently
      await Promise.all(targets.map((o) => runRowFraudCheck(o.id, o.phone)));
      toast.success(t(`${targets.length} টি চেক সম্পন্ন`, `Checked ${targets.length} orders`));
    } finally {
      setBulkFraudRunning(false);
    }
  };

  useEffect(() => { setPage(0); }, [search, statusFilter, dateRange, paymentFilter]);

  const normalizedSearch = search.trim();

  const getStatusInfo = (status: string) =>
    WEB_STATUS_WITH_CONFIRM.find((s) => s.value === status) || WEB_STATUS_OPTIONS[0];

  // Server-side paginated data query
  const { data: ordersResult, isLoading } = useQuery({
    queryKey: ["web-orders", search, statusFilter, dateRange, paymentFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*), visitors(traffic_source, admin_notes)", { count: "exact" })
        .eq("is_deleted", false)
        .or(WEB_ORDER_SOURCE_FILTER)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter && statusFilter !== "all" && statusFilter !== "incomplete") {
        query = query.eq("status", statusFilter);
      } else {
        query = query.in("status", WEB_STATUS_VALUES);
      }

      if (paymentFilter === "cod") {
        query = query.or("payment_method.is.null,payment_method.eq.cod");
      } else if (paymentFilter === "bkash_paid") {
        query = query.eq("payment_method", "bkash").eq("payment_status", "paid");
      } else if (paymentFilter === "bkash_pending") {
        query = query.eq("payment_method", "bkash").eq("payment_status", "pending");
      } else if (paymentFilter === "bkash_failed") {
        query = query.eq("payment_method", "bkash").in("payment_status", ["failed", "refunded"]);
      }

      if (normalizedSearch)
        query = query.or(
          `order_id.ilike.%${normalizedSearch}%,customer_facing_id.ilike.%${normalizedSearch}%,customer_name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%`
        );
      const since = normalizedSearch ? null : getDateRangeISO(dateRange);
      if (since) query = query.gte("created_at", since);
      const { data, error, count } = await query;
      if (error) throw error;
      return { orders: data || [], totalCount: count || 0 };
    },
  });

  const orders = ordersResult?.orders || [];
  const totalCount = ordersResult?.totalCount || 0;
  const verifiedPhones = usePhoneVerificationMap(useMemo(() => orders.map((o) => o.phone), [orders]));

  // Per-status counts - paginated fetch in 1000-row chunks (Supabase max)
  const { data: statusCounts } = useQuery({
    queryKey: ["web-orders-counts", search, dateRange],
    queryFn: async () => {
      const since = normalizedSearch ? null : getDateRangeISO(dateRange);
      let allStatuses: string[] = [];
      let from = 0;
      const chunkSize = 1000;

      while (true) {
        let query = supabase
          .from("orders")
          .select("status")
          .eq("is_deleted", false)
          .or(WEB_ORDER_SOURCE_FILTER)
          .in("status", WEB_STATUS_VALUES)
          .range(from, from + chunkSize - 1);

        if (normalizedSearch) query = query.or(`order_id.ilike.%${normalizedSearch}%,customer_facing_id.ilike.%${normalizedSearch}%,customer_name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%`);
        if (since) query = query.gte("created_at", since);

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        allStatuses = allStatuses.concat(data.map(d => d.status));
        if (data.length < chunkSize) break;
        from += chunkSize;
      }

      const counts: Record<string, number> = {};
      let totalAll = 0;
      allStatuses.forEach(s => {
        counts[s] = (counts[s] || 0) + 1;
        totalAll++;
      });
      counts["all"] = totalAll;
      return counts;
    },
  });

  // Fetch order items for all visible orders
  const orderIds = useMemo(() => orders.map((o: any) => o.id), [orders]);
  const { data: allOrderItems } = useQuery({
    queryKey: ["all-order-items", orderIds],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(product_image)")
        .in("order_id", orderIds);
      if (error) throw error;
      return (data || []).map((i: any) => {
        const snap = i.product_image as string | null;
        const isBroken = !snap || /bij-bd\.com/i.test(snap);
        return { ...i, product_image: (isBroken ? i.products?.product_image : snap) || i.products?.product_image || null };
      });
    },
  });

  const itemsByOrder = useMemo(() => {
    const map: Record<string, typeof allOrderItems> = {};
    allOrderItems?.forEach((item) => {
      if (!map[item.order_id]) map[item.order_id] = [];
      map[item.order_id]!.push(item);
    });
    return map;
  }, [allOrderItems]);

  // Batch status history for tooltip
  const { data: statusHistoryMap } = useQuery({
    queryKey: ["web-order-status-history", orderIds],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("*")
        .in("order_id", orderIds)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      const map: Record<string, any[]> = {};
      (data || []).forEach((h: any) => {
        if (!map[h.order_id]) map[h.order_id] = [];
        map[h.order_id].push(h);
      });
      return map;
    },
  });

  // Detail dialog items — fallback fetch for selectedOrder in case it's not in current page
  const { data: selectedOrderItemsFetched } = useQuery({
    queryKey: ["web-order-items-detail", selectedOrder?.id],
    enabled: !!selectedOrder?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(product_image)")
        .eq("order_id", selectedOrder.id);
      if (error) throw error;
      return (data || []).map((i: any) => {
        const snap = i.product_image as string | null;
        const isBroken = !snap || /bij-bd\.com/i.test(snap);
        return { ...i, product_image: (isBroken ? i.products?.product_image : snap) || i.products?.product_image || null };
      });
    },
  });
  const selectedOrderItems = selectedOrder
    ? (itemsByOrder[selectedOrder.id]?.length ? itemsByOrder[selectedOrder.id] : (selectedOrderItemsFetched || []))
    : [];


  const statusMutation = useMutation({
    mutationFn: async ({ id, status, oldStatus }: { id: string; status: string; oldStatus?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("orders").update({ status, last_status_changed_by: session?.user?.id || null } as any).eq("id", id);
      if (error) throw error;
      // Fire notification in background
      supabase.functions.invoke("order-status-notify", {
        body: { order_id: id, new_status: status, old_status: oldStatus },
      }).catch(console.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
      toast.success(t("স্ট্যাটাস আপডেট হয়েছে", "Status updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").update({ is_deleted: true } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      queryClient.invalidateQueries({ queryKey: ["web-orders-counts"] });
      queryClient.invalidateQueries({ queryKey: ["deleted-orders"] });
      toast.success(t("অর্ডার ডিলিট হয়েছে", "Order deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmDelete = (id: string, label: string) => {
    if (window.confirm(t(`অর্ডার ${label} ডিলিট করবেন? (ডিলিটেড অর্ডার থেকে রিস্টোর করা যাবে)`, `Delete order ${label}? (Can be restored from Deleted Orders)`))) {
      deleteMutation.mutate(id);
    }
  };


  // Incomplete orders query
  const { data: incompleteOrders, isLoading: incompleteLoading } = useQuery({
    queryKey: ["incomplete-orders", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("incomplete_orders")
        .select("*")
        .order("updated_at", { ascending: false });
      const since = getDateRangeISO(dateRange);
      if (since) query = query.gte("created_at", since);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Incomplete phones set for tag
  const incompletePhones = useMemo(() => {
    const set = new Set<string>();
    incompleteOrders?.forEach((inc: any) => set.add(inc.phone));
    return set;
  }, [incompleteOrders]);

  // Confirmed order counts by phone for "Repeat Order" tag
  const allPhones = useMemo(() => {
    const set = new Set<string>();
    orders?.forEach((o) => set.add(o.phone));
    return Array.from(set);
  }, [orders]);

  const { data: confirmedCountsByPhone } = useQuery({
    queryKey: ["confirmed-counts-by-phone", allPhones],
    enabled: allPhones.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("phone")
        .in("phone", allPhones)
        .eq("status", "confirmed")
        .eq("is_deleted", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((o) => { counts[o.phone] = (counts[o.phone] || 0) + 1; });
      return counts;
    },
  });

  // Double order: same visitor_id with multiple non-confirmed pending orders
  const allVisitorIds = useMemo(() => {
    const set = new Set<string>();
    orders?.forEach((o) => { if (o.visitor_id) set.add(o.visitor_id); });
    return Array.from(set);
  }, [orders]);

  const { data: doubleOrderVisitorIds } = useQuery({
    queryKey: ["double-order-visitors", allVisitorIds],
    enabled: allVisitorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("visitor_id")
        .in("visitor_id", allVisitorIds)
        .neq("status", "confirmed")
        .eq("is_deleted", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((o) => { if (o.visitor_id) counts[o.visitor_id] = (counts[o.visitor_id] || 0) + 1; });
      const doubles = new Set<string>();
      Object.entries(counts).forEach(([vid, c]) => { if (c > 1) doubles.add(vid); });
      return doubles;
    },
  });

  // Convert incomplete order to real order
  const convertMutation = useMutation({
    mutationFn: async (inc: any) => {
      const cart = Array.isArray(inc.cart_snapshot) ? inc.cart_snapshot : [];
      const totalAmount = cart.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);

      // Create order via RPC
      const { data: orderData, error: orderErr } = await supabase.rpc("place_order", {
        p_customer_name: inc.customer_name || "Unknown",
        p_phone: inc.phone,
        p_address: inc.address || "",
        p_total_amount: totalAmount,
      });
      if (orderErr) throw orderErr;
      const newOrder = (orderData as any)?.[0];
      if (!newOrder) throw new Error("Order creation failed");

      if (cart.length > 0) {
        const items = cart.map((item: any) => ({
          order_id: newOrder.id,
          product_id: item.id || "00000000-0000-0000-0000-000000000000",
          product_name: item.name || "Unknown",
          product_image: item.image || null,
          quantity: item.quantity || 1,
          unit_price: item.price || 0,
        }));
        const { error: itemErr } = await supabase.from("order_items").insert(items);
        if (itemErr) throw itemErr;
      }

      // Delete incomplete order
      const { error: delErr } = await supabase.from("incomplete_orders").delete().eq("id", inc.id);
      if (delErr) throw delErr;

      return newOrder;
    },
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ["incomplete-orders"] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      toast.success(t("অর্ডারে রূপান্তর হয়েছে", "Converted to order"));
      navigate(`/admin/orders/edit/${newOrder.order_id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">

      {/* Status filter badges */}
      <div className="flex flex-wrap gap-2">
        {/* Pending */}
        {(() => {
          const s = WEB_STATUS_OPTIONS[0];
          const Icon = s.icon;
          const count = statusCounts?.[s.value] || 0;
          return (
            <Badge
              key={s.value}
              className={`cursor-pointer gap-1 ${statusFilter === s.value ? s.color + " ring-2 ring-offset-1 ring-primary/30" : "bg-muted text-muted-foreground"}`}
              onClick={() => setStatusFilter(s.value)}
            >
              <Icon className="w-3 h-3" />
              {t(s.labelBn, s.label)} ({count})
            </Badge>
          );
        })()}
        {/* Incomplete - between Pending and No Response */}
        <Badge
          className={`cursor-pointer gap-1 ${statusFilter === "incomplete" ? "bg-red-100 text-red-800 border-red-200 ring-2 ring-offset-1 ring-primary/30" : "bg-muted text-muted-foreground"}`}
          onClick={() => setStatusFilter("incomplete")}
        >
          <AlertTriangle className="w-3 h-3" />
          {t("ইনকমপ্লিট", "Incomplete")} ({incompleteOrders?.length || 0})
        </Badge>
        {/* Rest of statuses (skip index 0 which is pending) */}
        {WEB_STATUS_OPTIONS.slice(1).map((s) => {
          const Icon = s.icon;
          const count = statusCounts?.[s.value] || 0;
          return (
            <Badge
              key={s.value}
              className={`cursor-pointer gap-1 ${statusFilter === s.value ? s.color + " ring-2 ring-offset-1 ring-primary/30" : "bg-muted text-muted-foreground"}`}
              onClick={() => setStatusFilter(s.value)}
            >
              <Icon className="w-3 h-3" />
              {t(s.labelBn, s.label)} ({count})
            </Badge>
          );
        })}
        {/* All - at the end */}
        <Badge
          className={`cursor-pointer ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          onClick={() => setStatusFilter("all")}
        >
          {t("সব", "All")} ({(statusCounts?.["all"] || 0) + (incompleteOrders?.length || 0)})
        </Badge>
      </div>

      {statusFilter !== "incomplete" && (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("অর্ডার আইডি, নাম বা ফোন...", "Order ID, name or phone...")}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("সব পেমেন্ট", "All Payments")}</SelectItem>
                <SelectItem value="cod">COD</SelectItem>
                <SelectItem value="bkash_paid">bKash ✓ {t("পরিশোধিত", "Paid")}</SelectItem>
                <SelectItem value="bkash_pending">bKash ⏳ {t("অপেক্ষমাণ", "Pending")}</SelectItem>
                <SelectItem value="bkash_failed">bKash ✗ {t("ব্যর্থ/ফেরত", "Failed/Refunded")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              disabled={bulkFraudRunning || selectedRowIds.size === 0}
              onClick={() => runBulkFraudCheck(orders || [])}
            >
              {bulkFraudRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              {t("ফ্রড চেকার", "Fraud Checker")}
              {selectedRowIds.size > 0 && (
                <span className="ml-1 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{selectedRowIds.size}</span>
              )}
            </Button>
            <Select
              value=""
              disabled={selectedRowIds.size === 0 || bulkStatusRunning}
              onValueChange={(newStatus) => runBulkStatusChange(newStatus)}
            >
              <SelectTrigger className="h-9 w-[210px]">
                {bulkStatusRunning ? (
                  <span className="flex items-center gap-2 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("আপডেট হচ্ছে...", "Updating...")}</span>
                ) : (
                  <SelectValue placeholder={t(`বাল্ক স্ট্যাটাস (${selectedRowIds.size})`, `Bulk Status (${selectedRowIds.size})`)} />
                )}
              </SelectTrigger>
              <SelectContent>
                {WEB_STATUS_WITH_CONFIRM.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {t(s.labelBn, s.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !orders?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <p>{t("কোনো অর্ডার পাওয়া যায়নি", "No orders found")}</p>
            </div>
          ) : (
            <>
            <div className="max-h-[calc(100vh-260px)] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 px-2">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={(orders?.length ?? 0) > 0 && orders!.every((o) => selectedRowIds.has(o.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRowIds(new Set(orders!.map((o) => o.id)));
                          } else {
                            setSelectedRowIds(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>{t("অর্ডার", "Order")}</TableHead>
                    <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                    <TableHead>{t("নাম্বার", "Number")}</TableHead>
                    <TableHead>{t("পণ্য", "Products")}</TableHead>
                    <TableHead>{t("সোর্স", "Source")}</TableHead>
                    <TableHead>{t("স্ট্যাটাস", "Status")}</TableHead>
                    <TableHead className="text-right">{t("মোট", "Total")}</TableHead>
                    <TableHead>{t("ট্যাগ", "Tag")}</TableHead>
                    <TableHead className="text-center">{t("অ্যাকশন", "Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const rawItems = (order as any).order_items && (order as any).order_items.length > 0 ? (order as any).order_items : (itemsByOrder[order.id] || []);
                    const items = rawItems.map((i: any) => {
                      const snap = i.product_image as string | null;
                      const isBroken = !snap || /bij-bd\.com/i.test(snap);
                      return { ...i, product_image: (isBroken ? i.products?.product_image : snap) || snap || null };
                    });
                    const timeAgo = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });

                    return (
                      <Fragment key={order.id}>
                      <TableRow>
                        <TableCell className="w-8 px-2">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={selectedRowIds.has(order.id)}
                            onChange={(e) => {
                              setSelectedRowIds((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(order.id);
                                else n.delete(order.id);
                                return n;
                              });
                            }}
                          />
                        </TableCell>
                        {/* Order ID + time ago */}
                        <TableCell className="min-w-[100px]">
                          <button
                            className="font-bold text-primary hover:underline cursor-pointer text-left"
                            onClick={() => setSelectedOrder(order)}
                          >
                            {order.customer_facing_id || order.order_id || (order.id ? `#${order.id.slice(0, 8).toUpperCase()}` : "—")}
                          </button>
                          {minaLockedIds.has(order.order_id) && (
                            <Badge className="ml-1 bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 animate-pulse">
                              🤖 মিনা
                            </Badge>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo}</p>
                        </TableCell>

                        {/* Customer name + address */}
                        <TableCell className="min-w-[140px] max-w-[200px]">
                          <p className="font-medium text-sm">{order.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{order.address}</p>
                          <CreatedByBadge adminId={(order as any).created_by_admin_id} statusChangedBy={(order as any).last_status_changed_by} />
                        </TableCell>

                        {/* Phone + alt phone */}
                        <TableCell className="min-w-[110px]">
                          <p className="text-sm flex items-center gap-1">{order.phone} <PhoneVerifiedBadge verified={verifiedPhones.get(order.phone) === true} /></p>
                          {order.alt_phone && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{order.alt_phone}</p>
                          )}
                        </TableCell>

                        {/* Product images + note */}
                        <TableCell className="min-w-[60px]">
                          <div className="flex items-center gap-1.5">
                            {items.length > 0 ? (
                              <>
                                {items.slice(0, 3).map((item) => (
                                  <TooltipProvider key={item.id}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOrder(order)}
                                          className="w-8 h-8 flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                          {item.product_image ? (
                                            <img
                                              src={item.product_image}
                                              alt={item.product_name}
                                              className="w-8 h-8 rounded border border-border object-cover"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 rounded border border-border bg-muted flex items-center justify-center">
                                              <Package className="w-3 h-3 text-muted-foreground" />
                                            </div>
                                          )}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs max-w-[200px]">
                                        {item.product_name} × {item.quantity}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ))}
                                {items.length > 3 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrder(order)}
                                    className="text-[11px] text-muted-foreground font-medium whitespace-nowrap hover:text-foreground"
                                  >
                                    & More {items.length - 3}
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                          {order.note && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 max-w-[180px] cursor-help">
                                    {order.note}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[300px] text-xs whitespace-pre-wrap">
                                  {order.note}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>

                        {/* Source */}
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <SourceBadge source={(order as any).visitors?.traffic_source || (order as any).traffic_source} createdByAdminId={(order as any).created_by_admin_id} />
                            <PaymentBadge method={(order as any).payment_method} status={(order as any).payment_status} amount={(order as any).paid_amount} compact />
                          </div>
                        </TableCell>

                        {/* Status (inline dropdown) + history tooltip */}
                        <TableCell className="min-w-[150px]">
                          {(() => {
                            const history = statusHistoryMap?.[order.id];
                            const changeCount = history ? history.length - 1 : 0;
                            const trigger = (
                              <SelectTrigger className={`h-8 px-2 text-xs font-semibold border ${si.color} gap-1 w-auto min-w-[120px]`}>
                                <SelectValue />
                                {changeCount > 0 && (
                                  <span className="ml-0.5 bg-black/10 text-[10px] px-1 rounded-full">{changeCount}×</span>
                                )}
                              </SelectTrigger>
                            );
                            return (
                              <Select
                                value={order.status}
                                onValueChange={(val) => {
                                  if (val === order.status) return;
                                  if (val === "pre") {
                                    setPreDateDialog({ orderId: order.id, oldStatus: order.status });
                                    setPreDateValue("");
                                    return;
                                  }
                                  statusMutation.mutate({ id: order.id, status: val, oldStatus: order.status });
                                }}
                              >
                                {history && history.length > 0 ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-[260px] p-2">
                                        <p className="text-[10px] font-semibold text-muted-foreground mb-1">{t("স্ট্যাটাস হিস্ট্রি", "Status History")} ({history.length})</p>
                                        <div className="space-y-1">
                                          {history.map((h: any, i: number) => {
                                            const si2 = getStatusInfo(h.status);
                                            return (
                                              <div key={h.id || i} className="flex items-center justify-between gap-3 text-[11px]">
                                                <span className="font-medium">{t(si2.labelBn, si2.label)}</span>
                                                <span className="text-muted-foreground whitespace-nowrap">
                                                  {format(new Date(h.changed_at), "dd/MM hh:mm a")}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {history[history.length - 1]?.changed_by_name && (
                                          <p className="text-[10px] text-muted-foreground mt-1 pt-1 border-t">
                                            {history[history.length - 1].changed_by_name}
                                          </p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : trigger}
                                <SelectContent>
                                  {WEB_STATUS_WITH_CONFIRM.map((s) => {
                                    const SIcon = s.icon;
                                    return (
                                      <SelectItem key={s.value} value={s.value}>
                                        <div className="flex items-center gap-2">
                                          <SIcon className="w-3.5 h-3.5" />
                                          {t(s.labelBn, s.label)}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            );
                          })()}

                          {(order as any).visitors?.admin_notes && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 line-clamp-1 max-w-[140px] cursor-help italic">
                                    📌 {(order as any).visitors.admin_notes}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[300px] text-xs whitespace-pre-wrap">
                                  <p className="font-semibold text-amber-600 mb-1">{t("ইন্টারনাল নোট", "Internal Note")}</p>
                                  {(order as any).visitors.admin_notes}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>

                        {/* Total */}
                        <TableCell className="text-right font-semibold whitespace-nowrap">
                          ৳{order.total_amount}
                        </TableCell>

                        {/* Tags */}
                        <TableCell className="min-w-[100px]">
                          <div className="flex flex-wrap gap-1">
                            {incompletePhones.has(order.phone) && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {t("ইনকমপ্লিট", "Incomplete")}
                              </Badge>
                            )}
                            {confirmedCountsByPhone && (confirmedCountsByPhone[order.phone] || 0) > 0 && (
                              <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-emerald-100 text-emerald-800 border-emerald-200">
                                <Repeat className="w-2.5 h-2.5" />
                                {t("রিপিট", "Repeat")} ({confirmedCountsByPhone[order.phone]})
                              </Badge>
                            )}
                            {order.visitor_id && doubleOrderVisitorIds?.has(order.visitor_id) && (
                              <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-orange-100 text-orange-800 border-orange-200">
                                <Copy className="w-2.5 h-2.5" />
                                {t("ডাবল", "Double")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Edit + Delete */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/orders/edit/${order.order_id}`)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deleteMutation.isPending}
                              onClick={() => confirmDelete(order.id, order.customer_facing_id || order.order_id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {(rowFraudLoading.has(order.id) || rowFraudResults[order.id]) && (
                        <TableRow key={order.id + "-fraud"} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={10} className="p-3">
                            {rowFraudLoading.has(order.id) ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t("ফ্রড চেক হচ্ছে...", "Checking fraud...")}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-destructive" />
                                    {t("ফ্রড রিপোর্ট", "Fraud Report")} — {order.phone}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => runRowFraudCheck(order.id, order.phone)}
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" /> {t("রিফ্রেশ", "Refresh")}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => setRowFraudResults((r) => { const n = { ...r }; delete n[order.id]; return n; })}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                                <FraudResultCard data={rowFraudResults[order.id]} compact />
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
                  </span>
                  <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
          )}
        </CardContent>
      </Card>
      )}
      {statusFilter === "incomplete" && (
        <Card>
          <CardContent className="p-0">
            {incompleteLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !incompleteOrders?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mb-3 opacity-40" />
                <p>{t("কোনো ইনকমপ্লিট অর্ডার নেই", "No incomplete orders")}</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-260px)] overflow-auto">
                <Table>
                  <TableHeader>
                   <TableRow>
                      <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                      <TableHead>{t("নাম্বার", "Phone")}</TableHead>
                      <TableHead>{t("কারণ", "Reason")}</TableHead>
                      <TableHead className="text-center">{t("চেষ্টা", "Attempts")}</TableHead>
                      <TableHead>{t("কার্ট", "Cart")}</TableHead>
                      <TableHead>{t("সময়", "Time")}</TableHead>
                      <TableHead className="text-center">{t("অ্যাকশন", "Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incompleteOrders.map((inc: any) => {
                      const cart = Array.isArray(inc.cart_snapshot) ? inc.cart_snapshot : [];
                      const timeAgo = formatDistanceToNow(new Date(inc.updated_at), { addSuffix: true, locale: bn });
                      return (
                        <TableRow key={inc.id}>
                          <TableCell className="min-w-[120px]">
                            <p className="font-medium text-sm">{inc.customer_name || "—"}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{inc.address || ""}</p>
                          </TableCell>
                          <TableCell className="text-sm">{inc.phone}</TableCell>
                          <TableCell className="min-w-[160px]">
                            <p className="text-xs text-destructive font-medium">{inc.reason}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={inc.attempt_count > 1 ? "destructive" : "secondary"} className="text-xs">
                              <RotateCcw className="w-3 h-3 mr-1" />
                              {inc.attempt_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[60px]">
                            <div className="flex items-center gap-1">
                              {cart.slice(0, 2).map((item: any, idx: number) => (
                                item.image ? (
                                  <img key={idx} src={item.image} alt={item.name} className="w-7 h-7 rounded border border-border object-cover" />
                                ) : (
                                  <div key={idx} className="w-7 h-7 rounded border border-border bg-muted flex items-center justify-center">
                                    <Package className="w-3 h-3 text-muted-foreground" />
                                  </div>
                                )
                              ))}
                              {cart.length > 2 && <span className="text-[11px] text-muted-foreground">+{cart.length - 2}</span>}
                              {cart.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</TableCell>
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    disabled={convertMutation.isPending}
                                    onClick={() => convertMutation.mutate(inc)}
                                  >
                                    <ArrowRightCircle className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {t("অর্ডারে কনভার্ট করুন", "Convert to Order")}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order detail / edit dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("অর্ডার", "Order")}: <span className="text-primary">{selectedOrder?.order_id}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("কাস্টমার", "Customer")}</p>
                  <p className="font-semibold">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("ফোন", "Phone")}</p>
                  <p className="font-semibold">{selectedOrder.phone}</p>
                </div>
                {selectedOrder.alt_phone && (
                  <div>
                    <p className="text-muted-foreground">{t("বিকল্প নম্বর", "Alt. Number")}</p>
                    <p className="font-semibold">{selectedOrder.alt_phone}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-muted-foreground">{t("ঠিকানা", "Address")}</p>
                  <p className="font-semibold">{selectedOrder.address}</p>
                </div>
                {selectedOrder.note && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">{t("নোট", "Note")}</p>
                    <p className="font-semibold">{selectedOrder.note}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">{t("স্ট্যাটাস", "Status")}</p>
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(val) => {
                      if (val === "pre") {
                        setPreDateDialog({ orderId: selectedOrder.id, oldStatus: selectedOrder.status });
                        setPreDateValue("");
                        return;
                      }
                      statusMutation.mutate({ id: selectedOrder.id, status: val, oldStatus: selectedOrder.status });
                      setSelectedOrder({ ...selectedOrder, status: val });
                    }}
                  >
                    <SelectTrigger className={`w-full h-9 text-xs font-semibold border ${getStatusInfo(selectedOrder.status).color}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEB_STATUS_WITH_CONFIRM.map((s) => {
                        const SIcon = s.icon;
                        return (
                          <SelectItem key={s.value} value={s.value}>
                            <div className="flex items-center gap-2">
                              <SIcon className="w-3.5 h-3.5" />
                              {t(s.labelBn, s.label)}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("মোট", "Total")}</p>
                  <p className="font-bold text-primary text-lg">৳{selectedOrder.total_amount}</p>
                </div>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-primary" />
                    {t("ফ্রড চেকার", "Fraud Checker")}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={fraudLoading || !selectedOrder.phone}
                    onClick={() => runFraudCheck(selectedOrder.phone)}
                  >
                    {fraudLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    {fraudLoading ? t("চেক হচ্ছে...", "Checking...") : t("চেক করুন", "Check")}
                  </Button>
                </div>
                {fraudData && <FraudResultCard data={fraudData} />}
                {!fraudData && !fraudLoading && (
                  <p className="text-xs text-muted-foreground">
                    {t("ফোন নম্বর দিয়ে কুরিয়ার সাকসেস রেশিও চেক করুন।", "Check courier success ratio for the customer's phone.")}
                  </p>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <p className="font-semibold mb-2">{t("পণ্যসমূহ", "Products")}</p>
                <div className="space-y-2">
                  {selectedOrderItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                      {item.product_image ? (
                        <img src={item.product_image} alt={item.product_name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">৳{item.unit_price} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-primary">৳{item.unit_price * item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>

              <OrderIpBlockPanel visitorId={selectedOrder.visitor_id} />



            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pre-date picker dialog */}
      <Dialog open={!!preDateDialog} onOpenChange={() => setPreDateDialog(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-violet-600" />
              {t("প্রি ডেট সিলেক্ট করুন", "Select Pre Date")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="date"
              value={preDateValue}
              onChange={(e) => setPreDateValue(e.target.value)}
              className="w-full"
              min={new Date().toISOString().split("T")[0]}
            />
            <Button
              className="w-full"
              disabled={!preDateValue}
              onClick={async () => {
                if (!preDateDialog || !preDateValue) return;
                // Save pre_date and update status to "pre"
                const { error } = await supabase.from("orders").update({ pre_date: preDateValue } as any).eq("id", preDateDialog.orderId);
                if (error) { toast.error(error.message); return; }
                statusMutation.mutate({ id: preDateDialog.orderId, status: "pre", oldStatus: preDateDialog.oldStatus });
                if (selectedOrder?.id === preDateDialog.orderId) {
                  setSelectedOrder({ ...selectedOrder, status: "pre", pre_date: preDateValue });
                }
                setPreDateDialog(null);
                setPreDateValue("");
              }}
            >
              <CalendarClock className="w-4 h-4 mr-2" />
              {t("প্রি সেট করুন", "Set Pre")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
