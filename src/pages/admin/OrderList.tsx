import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Search, Loader2, Package, Eye, Printer, Truck, Pencil, AlertTriangle, Repeat, Copy, ChevronLeft, ChevronRight, ClipboardCheck, PackageCheck, PackageMinus, RotateCcw, Undo2, XCircle, HelpCircle, Navigation, ExternalLink, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreatedByBadge } from "@/components/admin/CreatedByBadge";
import { SourceBadge } from "@/components/admin/SourceBadge";
import { format, formatDistanceToNow } from "date-fns";
import { DateRangeFilter, DateRangeValue, getDateRangeISO } from "@/components/admin/DateRangeFilter";
import { OrderExportButton } from "@/components/admin/OrderExportButton";


const PAGE_SIZE = 50;
import { bn } from "date-fns/locale";

// Filter tab definitions for Order List UI
const STATUS_OPTIONS = [
  { value: "confirmed", labelBn: "কনফার্মড", labelEn: "Confirmed", icon: Package, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "printed", labelBn: "প্রিন্টেড", labelEn: "Printed", icon: Printer, color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { value: "entry_done", labelBn: "এন্ট্রি ডান", labelEn: "Entry Done", icon: ClipboardCheck, color: "bg-teal-100 text-teal-800 border-teal-200" },
  { value: "shipped", labelBn: "শিপড", labelEn: "Shipped", icon: Truck, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "pending_return", labelBn: "পেন্ডিং রিটার্ন", labelEn: "Pending Return", icon: RotateCcw, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "missing", labelBn: "মিসিং", labelEn: "Missing", icon: HelpCircle, color: "bg-gray-100 text-gray-800 border-gray-200" },
  { value: "partial", labelBn: "পার্শিয়াল", labelEn: "Partial", icon: PackageMinus, color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "cancelled", labelBn: "বাতিল", labelEn: "Cancel", icon: XCircle, color: "bg-red-100 text-red-800 border-red-200" },
  { value: "return", labelBn: "রিটার্ন", labelEn: "Return", icon: Undo2, color: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "delivered", labelBn: "ডেলিভারড", labelEn: "Delivered", icon: PackageCheck, color: "bg-green-100 text-green-800 border-green-200" },
];

// 🔒 DO_NOT_MODIFY_START — Order List filter group mapping
const FILTER_GROUPS: Record<string, string[]> = {
  confirmed: ["confirmed"],
  printed: ["printed"],
  entry_done: ["entry_done"],
  shipped: ["shipped", "on_the_way", "hold"],
  delivered: ["delivered", "delivered_approval_pending"],
  partial: ["partial", "partial_delivered", "partial_delivered_approval_pending"],
  pending_return: ["pending_return", "cancelled_approval_pending"],
  return: ["return", "rtn_received"],
  cancelled: ["cancelled"],
  missing: ["missing", "unknown_approval_pending"],
};
// 🔒 DO_NOT_MODIFY_END

// All DB status values for "all" tab query
const ALL_STATUS_VALUES = Object.values(FILTER_GROUPS).flat();

// Display labels for granular statuses shown on badges
const GRANULAR_STATUS_LABELS: Record<string, { labelBn: string; labelEn: string; color: string }> = {
  confirmed: { labelBn: "কনফার্মড", labelEn: "Confirmed", color: "bg-blue-100 text-blue-800 border-blue-200" },
  printed: { labelBn: "প্রিন্টেড", labelEn: "Printed", color: "bg-teal-100 text-teal-800 border-teal-200" },
  entry_done: { labelBn: "এন্ট্রি ডান", labelEn: "Entry Done", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  in_review: { labelBn: "ইন রিভিউ", labelEn: "In Review", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  pending: { labelBn: "পেন্ডিং", labelEn: "Pending", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  shipped: { labelBn: "শিপড", labelEn: "Shipped", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  on_the_way: { labelBn: "অন দ্য ওয়ে", labelEn: "On The Way", color: "bg-purple-100 text-purple-800 border-purple-200" },
  hold: { labelBn: "হোল্ড ইন কুরিয়ার", labelEn: "Hold in Courier", color: "bg-orange-100 text-orange-800 border-orange-200" },
  delivered: { labelBn: "ডেলিভারড", labelEn: "Delivered", color: "bg-green-100 text-green-800 border-green-200" },
  delivered_approval_pending: { labelBn: "DAP", labelEn: "DAP", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  partial: { labelBn: "পার্শিয়াল", labelEn: "Partial", color: "bg-amber-100 text-amber-800 border-amber-200" },
  partial_delivered: { labelBn: "পার্শিয়াল ডেলিভারড", labelEn: "P-Delivered", color: "bg-amber-100 text-amber-800 border-amber-200" },
  partial_delivered_approval_pending: { labelBn: "P-DAP", labelEn: "P-DAP", color: "bg-amber-100 text-amber-800 border-amber-200" },
  pending_return: { labelBn: "পেন্ডিং রিটার্ন", labelEn: "Pending Return", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  cancelled_approval_pending: { labelBn: "C-AP", labelEn: "C-AP", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  return: { labelBn: "রিটার্ন", labelEn: "Return", color: "bg-orange-100 text-orange-800 border-orange-200" },
  rtn_received: { labelBn: "RTN রিসিভড", labelEn: "RTN Received", color: "bg-lime-100 text-lime-800 border-lime-200" },
  cancelled: { labelBn: "বাতিল", labelEn: "Cancel", color: "bg-red-100 text-red-800 border-red-200" },
  missing: { labelBn: "মিসিং", labelEn: "Missing", color: "bg-gray-100 text-gray-800 border-gray-200" },
  unknown_approval_pending: { labelBn: "U-AP", labelEn: "U-AP", color: "bg-gray-100 text-gray-800 border-gray-200" },
};

export default function OrderList() {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get("filter") || "confirmed");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => (searchParams.get("range") as DateRangeValue) || "lifetime");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Sub-filter for confirmed/printed/entry_done tabs: "all" | "printed" | "not_printed" | "entered" | "not_entered"
  const [subFilter, setSubFilter] = useState<string>("all");

  // Sync filter state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "confirmed") params.set("filter", statusFilter);
    if (dateRange !== "lifetime") params.set("range", dateRange);
    setSearchParams(params, { replace: true });
  }, [statusFilter, dateRange]);
  const minaLockedIds = new Set<string>();
  const [courierPopup, setCourierPopup] = useState<{ orderId: string; consignmentId: string | null } | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryProgress, setEntryProgress] = useState<{ total: number; done: number; failed: number; current: string; results: { id: string; orderId: string; success: boolean; error?: string }[] }>({ total: 0, done: 0, failed: 0, current: "", results: [] });

  // Cross-check confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "ask_entry_after_print" | "ask_print_before_entry" | "ask_tab_after_print" | "ask_tab_after_entry";
    pendingIds: string[];
    targetTab?: string;
    courier?: "steadfast" | "pathao";
  } | null>(null);

  useEffect(() => { setPage(0); }, [search, statusFilter, dateRange, customFrom, customTo, subFilter]);
  useEffect(() => { setSubFilter("all"); }, [statusFilter]);

  const getGranularStatus = (status: string) => GRANULAR_STATUS_LABELS[status] || { labelBn: status, labelEn: status, color: "bg-muted text-muted-foreground" };

  // Server-side paginated data query
  const { data: ordersResult, isLoading } = useQuery({
    queryKey: ["order-list-data", search, statusFilter, page, dateRange, customFrom, customTo, subFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(id, product_name, product_image, quantity, products(product_image)), visitors(traffic_source), connected_sites(site_name, site_slug)", { count: "exact" })
        .eq("is_deleted", false)
        .or("notify_after.is.null,notify_after.lte." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter === "all") {
        query = query.in("status", ALL_STATUS_VALUES);
      } else if (statusFilter === "entry_done") {
        // Only orders currently at entry_done stage (not yet shipped/delivered/returned)
        query = query.eq("status", "entry_done");

      } else if (statusFilter === "confirmed") {
        query = query.in("status", FILTER_GROUPS.confirmed).eq("is_courier_entered", false);
      } else {
        const groupValues = FILTER_GROUPS[statusFilter] || [statusFilter];
        query = query.in("status", groupValues);
      }

      const dateISO = getDateRangeISO(dateRange, customFrom, customTo);
      if (dateISO) query = query.gte("created_at", dateISO);
      if (dateRange === "custom" && customTo) {
        const toEnd = new Date(customTo);
        toEnd.setHours(23, 59, 59, 999);
        query = query.lte("created_at", toEnd.toISOString());
      }

      // Sub-filters for print/entry status
      if (subFilter === "printed") query = query.eq("is_printed", true);
      else if (subFilter === "not_printed") query = query.eq("is_printed", false);
      else if (subFilter === "entered") query = query.eq("is_courier_entered", true);
      else if (subFilter === "not_entered") query = query.eq("is_courier_entered", false);

      if (search) query = query.or(`order_id.ilike.%${search}%,customer_facing_id.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { orders: data || [], totalCount: count || 0 };
    },
  });

  const orders = ordersResult?.orders || [];
  const totalCount = ordersResult?.totalCount || 0;

  // Per-status counts using database RPC for accuracy with 41k+ orders
  const { data: statusCounts } = useQuery({
    queryKey: ["order-list-counts-rpc-v2", search, dateRange, customFrom, customTo],
    refetchOnMount: "always",
    queryFn: async () => {
      const dateISO = getDateRangeISO(dateRange, customFrom, customTo);
      const { data, error } = await supabase.rpc("get_order_status_counts", {
        p_statuses: ALL_STATUS_VALUES,
        p_date_from: dateISO || null,
        p_search: search || null,
      });
      if (error) throw error;

      const nowISO = new Date().toISOString();
      const applyCountFilters = (query: any) => {
        query = query
          .eq("is_deleted", false)
          .or("notify_after.is.null,notify_after.lte." + nowISO);
        if (dateISO) query = query.gte("created_at", dateISO);
        if (dateRange === "custom" && customTo) {
          const toEnd = new Date(customTo);
          toEnd.setHours(23, 59, 59, 999);
          query = query.lte("created_at", toEnd.toISOString());
        }
        if (search) query = query.or(`order_id.ilike.%${search}%,customer_facing_id.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
        return query;
      };

      const [entryDoneResult, confirmedResult] = await Promise.all([
        applyCountFilters(
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "entry_done")
        ),

        applyCountFilters(
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "confirmed")
            .eq("is_courier_entered", false)
        ),
      ]);
      if (entryDoneResult.error) throw entryDoneResult.error;
      if (confirmedResult.error) throw confirmedResult.error;

      // Raw counts per DB status
      const rawCounts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        rawCounts[row.status] = Number(row.cnt);
      });
      // Aggregate into filter group counts
      const counts: Record<string, number> = {};
      let totalAll = 0;
      for (const opt of STATUS_OPTIONS) {
        const groupValues = FILTER_GROUPS[opt.value] || [opt.value];
        const sum = groupValues.reduce((acc, v) => acc + (rawCounts[v] || 0), 0);
        counts[opt.value] = sum;
        totalAll += sum;
      }
      counts.entry_done = entryDoneResult.count || 0;
      counts.confirmed = confirmedResult.count || 0;
      totalAll = STATUS_OPTIONS.reduce((acc, opt) => acc + (counts[opt.value] || 0), 0);
      counts["all"] = totalAll;
      return counts;
    },
  });

  const { data: orderItems } = useQuery({
    queryKey: ["order-items", selectedOrder?.id],
    enabled: !!selectedOrder,
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("*, products(product_image)").eq("order_id", selectedOrder.id);
      if (error) throw error;
      return (data || []).map((i: any) => {
        const snap = i.product_image as string | null;
        const isBroken = !snap || /bij-bd\.com/i.test(snap);
        return { ...i, product_image: (isBroken ? i.products?.product_image : snap) || i.products?.product_image || null };
      });
    },
  });

  // Incomplete phones for tag
  const allOrderPhones = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o: any) => set.add(o.phone));
    return Array.from(set);
  }, [orders]);

  const { data: incompletePhonesList } = useQuery({
    queryKey: ["incomplete-phones-for-tags", allOrderPhones],
    enabled: allOrderPhones.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomplete_orders")
        .select("phone")
        .in("phone", allOrderPhones);
      if (error) throw error;
      return new Set(data?.map((d) => d.phone));
    },
  });

  // Repeat order count
  const { data: repeatCounts } = useQuery({
    queryKey: ["repeat-counts-for-tags", allOrderPhones],
    enabled: allOrderPhones.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("phone")
        .in("phone", allOrderPhones)
        .eq("status", "confirmed")
        .eq("is_deleted", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((o) => { counts[o.phone] = (counts[o.phone] || 0) + 1; });
      return counts;
    },
  });

  // Double order: same visitor_id with multiple orders
  const allVisitorIds = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o: any) => { if (o.visitor_id) set.add(o.visitor_id); });
    return Array.from(set);
  }, [orders]);

  const { data: doubleVisitorIds } = useQuery({
    queryKey: ["double-visitor-tags", allVisitorIds],
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

  // Batch fetch status history for all visible orders
  const allOrderIds = useMemo(() => orders.map((o: any) => o.id), [orders]);
  const { data: statusHistoryMap } = useQuery({
    queryKey: ["order-status-history-batch", allOrderIds],
    enabled: allOrderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("*")
        .in("order_id", allOrderIds)
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

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-list-data"] });
      queryClient.invalidateQueries({ queryKey: ["order-list-counts"] });
      toast.success(t("স্ট্যাটাস আপডেট হয়েছে", "Status updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("orders")
        .update({ is_deleted: true } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      queryClient.invalidateQueries({ queryKey: ["order-list-data"] });
      queryClient.invalidateQueries({ queryKey: ["order-list-counts"] });
      queryClient.invalidateQueries({ queryKey: ["deleted-orders"] });
      toast.success(t(`${ids.length}টি অর্ডার ডিলিট হয়েছে`, `${ids.length} order(s) deleted`));
      setSelectedIds(new Set());
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmDelete = (ids: string[]) => {
    if (!ids.length) return;
    if (window.confirm(t(`${ids.length}টি অর্ডার ডিলিট করবেন? (ডিলিটেড অর্ডার থেকে রিস্টোর করা যাবে)`, `Delete ${ids.length} order(s)? (Can be restored from Deleted Orders)`))) {
      deleteMutation.mutate(ids);
    }
  };

  const refreshOrderList = () => {
    queryClient.invalidateQueries({ queryKey: ["order-list-data"] });
    queryClient.invalidateQueries({ queryKey: ["order-list-counts-rpc-v2"] });
    queryClient.invalidateQueries({ queryKey: ["order-status-history-batch"] });
  };

  const clearPendingSelection = () => {
    setConfirmAction(null);
    setSelectedIds(new Set());
    refreshOrderList();
  };

  const moveOrdersToStatus = async (ids: string[], status: "printed" | "entry_done", targetTab: "printed" | "entry_done") => {
    if (!ids.length) {
      clearPendingSelection();
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const adminId = sess?.session?.user?.id || null;
    let adminName: string | null = null;
    if (adminId) {
      try {
        const { data: ad } = await supabase.functions.invoke("manage-admin", { body: { action: "lookup", user_id: adminId } });
        adminName = ad?.name || sess?.session?.user?.email || null;
      } catch {
        adminName = sess?.session?.user?.email || null;
      }
    }

    const { error } = await supabase
      .from("orders")
      .update({ status, last_status_changed_by: adminId } as any)
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }

    await supabase.from("order_status_history").insert(
      ids.map((oid) => ({ order_id: oid, status, changed_by: adminId, changed_by_name: adminName } as any))
    );
    setStatusFilter(targetTab);
    clearPendingSelection();
    toast.success(status === "printed" ? t("প্রিন্টেড ট্যাবে নেওয়া হয়েছে", "Moved to Printed tab") : t("এন্ট্রি ডান ট্যাবে নেওয়া হয়েছে", "Moved to Entry Done tab"));
  };

  const printMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // 1. Fetch full order data with items for invoice
      const { data: printOrders, error: oErr } = await supabase
        .from("orders")
        .select("*, order_items(id, product_name, product_image, products(short_description, tag), quantity, unit_price)")
        .in("id", ids);
      if (oErr) throw oErr;
      if (!printOrders?.length) throw new Error("No orders found");

      // 2. Build data for printInvoices
      const { printInvoices } = await import("@/lib/invoiceGenerator");
      const invoiceOrders = printOrders.map((o: any) => ({
        id: o.id,
        order_id: o.order_id,
        customer_facing_id: o.customer_facing_id,
        customer_name: o.customer_name,
        phone: o.phone,
        alt_phone: o.alt_phone,
        address: o.address,
        note: o.note,
        print_note: o.print_note || false,
        total_amount: o.total_amount,
        discount: o.discount,
        advance: o.advance,
        delivery_charge: o.delivery_charge,
        created_at: o.created_at,
      }));
      const itemsByOrder: Record<string, any[]> = {};
      printOrders.forEach((o: any) => {
        const seen = new Set<string>();
        itemsByOrder[o.id] = (o.order_items || [])
          .filter((item: any) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
          .map((item: any) => ({
            product_name: item.product_name,
            product_image: item.product_image,
            short_description: item.products?.short_description || null,
            tag: item.products?.tag || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }));
      });

      // 3. Print invoices
      const printed = await printInvoices(invoiceOrders, itemsByOrder);
      if (!printed) throw new Error("Print window blocked");

      // 4. Ask user to confirm print was successful, then mark
      return ids;
    },
    onSuccess: (ids) => {
      toast(t("প্রিন্ট সফল হয়েছে?", "Was the print successful?"), {
        duration: Infinity,
        action: {
          label: t("হ্যাঁ, মার্ক করুন", "Yes, mark printed"),
          onClick: async () => {
            const { data: sess } = await supabase.auth.getSession();
            const adminId = sess?.session?.user?.id || null;
            const { error } = await supabase.from("orders").update({ is_printed: true, last_status_changed_by: adminId } as any).in("id", ids);
            if (error) { toast.error(error.message); return; }
            toast.success(t("প্রিন্টেড মার্ক হয়েছে", "Marked as printed"));
            // Ask: entry too?
            setConfirmAction({ type: "ask_entry_after_print", pendingIds: ids });
          },
        },
        cancel: {
          label: t("না", "No"),
          onClick: () => { setSelectedIds(new Set()); },
        },
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runCourierEntry = async (overrideIds?: string[], courier: "steadfast" | "pathao" = "steadfast") => {
    const ids = overrideIds || Array.from(selectedIds);
    const selectedOrders = orders.filter((o: any) => ids.includes(o.id));
    if (!selectedOrders.length) return;

    setEntryProgress({
      total: selectedOrders.length,
      done: 0,
      failed: 0,
      current: selectedOrders[0]?.order_id || "",
      results: [],
    });
    setEntryDialogOpen(true);

    const results: { id: string; orderId: string; success: boolean; error?: string }[] = [];
    let doneCount = 0;
    let failCount = 0;

    for (const order of selectedOrders) {
      setEntryProgress((prev) => ({ ...prev, current: order.customer_facing_id || order.order_id }));
      try {
        const { data, error } = await supabase.functions.invoke(courier === "pathao" ? "pathao-courier" : "steadfast-courier", {
          body: {
            action: "create_order",
            defer_status_update: false,
            orders: [{
              id: order.id,
              order_id: order.order_id,
              customer_facing_id: order.customer_facing_id,
              customer_name: order.customer_name,
              phone: order.phone,
              alt_phone: order.alt_phone,
              address: order.address,
              total_amount: order.total_amount,
              note: order.note,
            }],
          },
        });

        if (error) {
          let reason = error.message || "Courier entry failed";
          try {
            const ctxBody = (error as any)?.context?.body;
            if (ctxBody) {
              const parsed = typeof ctxBody === "string" ? JSON.parse(ctxBody) : ctxBody;
              if (parsed?.error) reason = parsed.error;
            }
          } catch { /* ignore */ }
          throw new Error(reason);
        }
        if (data?.error || data?.success === false) throw new Error(data.error || "Courier entry failed");

        doneCount++;
        results.push({ id: order.id, orderId: order.customer_facing_id || order.order_id, success: true });
      } catch (err: any) {
        failCount++;
        results.push({ id: order.id, orderId: order.customer_facing_id || order.order_id, success: false, error: err?.message || "অজানা কারণে এন্ট্রি ব্যর্থ" });
      }

      setEntryProgress((prev) => ({
        ...prev,
        done: doneCount,
        failed: failCount,
        results: [...results],
      }));
    }

    setEntryProgress((prev) => ({ ...prev, current: "" }));

    if (doneCount > 0) toast.success(t(`${doneCount}টি অর্ডার এন্ট্রি সফল`, `${doneCount} orders entered successfully`));
    if (failCount > 0) toast.error(t(`${failCount}টি অর্ডার এন্ট্রি ব্যর্থ`, `${failCount} orders failed`));

    // Ask about tab move after entry
    if (doneCount > 0) {
      refreshOrderList();
      setConfirmAction({ type: "ask_tab_after_entry", pendingIds: results.filter(r => r.success).map(r => r.id), targetTab: "entry_done" });
    } else {
      setSelectedIds(new Set());
    }
  };

  const openEntryDialog = (courier: "steadfast" | "pathao" = "steadfast") => {
    const ids = Array.from(selectedIds);
    const selectedOrds = orders.filter((o: any) => ids.includes(o.id));
    const unprintedOrders = selectedOrds.filter((o: any) => !o.is_printed);

    if (unprintedOrders.length > 0) {
      // Ask: print first?
      setConfirmAction({ type: "ask_print_before_entry", pendingIds: ids, courier });
    } else {
      void runCourierEntry(ids, courier);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!orders.length) return;
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o: any) => o.id)));
    }
  };

  const hasSelected = selectedIds.size > 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getRelativeTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: lang === "en" ? undefined : bn,
    });
  };

  return (
    <div className="space-y-4">
      {/* Status filter badges */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => {
          const count = statusCounts?.[s.value] || 0;
          const IconComp = s.icon;
          return (
            <Badge
              key={s.value}
              className={`cursor-pointer ${statusFilter === s.value ? s.color + " ring-2 ring-offset-1 ring-primary/30" : "bg-muted text-muted-foreground"}`}
              onClick={() => setStatusFilter(s.value)}
            >
              <IconComp className="w-3.5 h-3.5 mr-1" /> {t(s.labelBn, s.labelEn)} ({count})
            </Badge>
          );
        })}
        <Badge
          className={`cursor-pointer ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          onClick={() => setStatusFilter("all")}
        >
          {t("সব", "All")} ({statusCounts?.["all"] || 0})
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("অর্ডার আইডি, নাম বা ফোন...", "Order ID, name or phone...")}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
            />
            <OrderExportButton
              statuses={statusFilter === "all" ? ALL_STATUS_VALUES : (FILTER_GROUPS[statusFilter] || [statusFilter])}
              search={search}
              fromISO={getDateRangeISO(dateRange, customFrom, customTo) || undefined}
              toISO={dateRange === "custom" && customTo ? (() => { const d = new Date(customTo); d.setHours(23,59,59,999); return d.toISOString(); })() : undefined}
              filterLabel={statusFilter}
            />

            {/* Sub-filter: Print/Entry status */}
            {(statusFilter === "confirmed" || statusFilter === "printed" || statusFilter === "entry_done") && (
              <div className="flex items-center gap-1">
                {[
                  { value: "all", labelBn: "সব", labelEn: "All" },
                  { value: "printed", labelBn: "প্রিন্টেড", labelEn: "Printed", icon: Printer },
                  { value: "not_printed", labelBn: "আনপ্রিন্ট", labelEn: "Unprinted", icon: Printer },
                  { value: "entered", labelBn: "এন্ট্রি", labelEn: "Entered", icon: Truck },
                  { value: "not_entered", labelBn: "নন-এন্ট্রি", labelEn: "Not Entered", icon: Truck },
                ].map((sf) => (
                  <Badge
                    key={sf.value}
                    className={`cursor-pointer text-[10px] px-1.5 py-0.5 ${subFilter === sf.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    onClick={() => setSubFilter(sf.value)}
                  >
                    {sf.icon && <sf.icon className="w-2.5 h-2.5 mr-0.5" />}
                    {t(sf.labelBn, sf.labelEn)}
                  </Badge>
                ))}
              </div>
            )}

            {hasSelected && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size} {t("টি সিলেক্টেড", " selected")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => printMutation.mutate(Array.from(selectedIds))}
                  disabled={printMutation.isPending}
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t("প্রিন্ট", "Print")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openEntryDialog("steadfast")}
                  disabled={entryDialogOpen}
                >
                  <Truck className="w-3.5 h-3.5" />
                  {t("Steadfast", "Steadfast")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-pink-300 text-pink-700 hover:bg-pink-50"
                  onClick={() => openEntryDialog("pathao")}
                  disabled={entryDialogOpen}
                >
                  <Truck className="w-3.5 h-3.5" />
                  {t("Pathao", "Pathao")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => confirmDelete(Array.from(selectedIds))}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("ডিলিট", "Delete")}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !orders.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <p>{t("কোনো অর্ডার পাওয়া যায়নি", "No orders found")}</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>{t("কনফার্ম", "Confirmed")}</TableHead>
                  <TableHead>{t("অর্ডার", "Order")}</TableHead>
                  <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                  <TableHead>{t("নম্বর", "Number")}</TableHead>
                  <TableHead>{t("পণ্য", "Products")}</TableHead>
                  <TableHead>{t("সোর্স", "Source")}</TableHead>
                  <TableHead className="text-right">{t("মোট", "Total")}</TableHead>
                  <TableHead className="text-center">{t("স্ট্যাটাস", "Status")}</TableHead>
                  <TableHead>{t("ট্যাগ", "Tag")}</TableHead>
                  <TableHead className="text-right">{t("অ্যাকশন", "Action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => {
                  const gs = getGranularStatus(order.status);
                  const isPrinted = order.is_printed;
                  const isCourierEntered = order.is_courier_entered;
                  return (
                    <TableRow key={order.id} data-state={selectedIds.has(order.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={() => toggleSelect(order.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {getRelativeTime(order.updated_at)}
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {order.customer_facing_id || order.order_id}
                        {minaLockedIds.has(order.order_id) && (
                          <Badge className="ml-1.5 bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 animate-pulse">
                            🤖 মিনা
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.customer_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{order.address}</div>
                        <CreatedByBadge adminId={order.created_by_admin_id} statusChangedBy={order.last_status_changed_by} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.phone}</TableCell>
                      <TableCell className="min-w-[60px]">
                        <div className="flex flex-row flex-nowrap items-center gap-1.5">
                          {(() => {
                            const items = order.order_items || [];
                            if (items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <>
                                {items.slice(0, 3).map((item: any) => (
                                  <TooltipProvider key={item.id}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOrder(order)}
                                          className="w-8 h-8 flex-shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                          {(item.product_image || item.products?.product_image) ? (
                                            <img
                                              src={item.product_image || item.products?.product_image}
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
                                    +{items.length - 3}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <SourceBadge source={(order as any).visitors?.traffic_source || order.traffic_source} createdByAdminId={(order as any).created_by_admin_id} />
                          {(order as any).connected_sites?.site_name && (
                            <Badge variant="outline" className="gap-1 text-[10px] font-medium px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200">
                              📦 {(order as any).connected_sites.site_name}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">৳{order.total_amount}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          {(() => {
                            const history = statusHistoryMap?.[order.id];
                            const badge = (
                              <Badge className={`text-[10px] px-1.5 py-0 border ${gs.color} cursor-default`}>
                                {t(gs.labelBn, gs.labelEn)}
                                {history && history.length > 1 && (
                                  <span className="ml-1 opacity-60">+{history.length - 1}</span>
                                )}
                              </Badge>
                            );
                            if (!history || history.length === 0) return badge;
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>{badge}</TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs space-y-1 max-w-[220px]">
                                    {history.map((h: any) => (
                                      <div key={h.id} className="flex items-center justify-between gap-3">
                                        <span className="font-medium">{GRANULAR_STATUS_LABELS[h.status]?.labelEn || h.status}</span>
                                        <span className="text-muted-foreground whitespace-nowrap">{format(new Date(h.changed_at), "hh:mm a")}</span>
                                      </div>
                                    ))}
                                    {history[0]?.changed_by_name && (
                                      <div className="text-muted-foreground border-t pt-1 mt-1">{history[history.length - 1].changed_by_name}</div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                          <div
                            title={isPrinted ? t("প্রিন্টেড", "Printed") : t("প্রিন্ট হয়নি", "Not Printed")}
                            className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                              isPrinted
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                                : "bg-muted/50 text-muted-foreground/30"
                            }`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </div>
                        {isCourierEntered ? (
                            <button
                              type="button"
                              onClick={() => setCourierPopup({ orderId: order.order_id, consignmentId: order.consignment_id })}
                              title={`ID: ${order.consignment_id || '-'} | Tracking: ${order.tracking_code || '-'}`}
                              className="relative flex items-center justify-center w-8 h-7 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60 overflow-hidden group"
                            >
                              {/* Road dashes */}
                              <span className="absolute bottom-[5px] left-0 w-full h-[1.5px] bg-blue-300/60 dark:bg-blue-500/40" />
                              <span className="absolute bottom-[5px] left-0 flex gap-[3px] animate-[truck-road_1s_linear_infinite]">
                                <span className="w-[4px] h-[1.5px] bg-blue-400/80 dark:bg-blue-300/60 rounded-full" />
                                <span className="w-[4px] h-[1.5px] bg-blue-400/80 dark:bg-blue-300/60 rounded-full" />
                                <span className="w-[4px] h-[1.5px] bg-blue-400/80 dark:bg-blue-300/60 rounded-full" />
                                <span className="w-[4px] h-[1.5px] bg-blue-400/80 dark:bg-blue-300/60 rounded-full" />
                                <span className="w-[4px] h-[1.5px] bg-blue-400/80 dark:bg-blue-300/60 rounded-full" />
                              </span>
                              <Truck className="w-3.5 h-3.5 relative z-10 animate-[truck-bounce_0.6s_ease-in-out_infinite]" />
                            </button>
                          ) : (
                            <div
                              title={t("এন্ট্রি হয়নি", "Not Entered")}
                              className="flex items-center justify-center w-7 h-7 rounded-md bg-muted/50 text-muted-foreground/30"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <div className="flex flex-wrap gap-1">
                          {incompletePhonesList?.has(order.phone) && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {t("ইনকমপ্লিট", "Incomplete")}
                            </Badge>
                          )}
                          {repeatCounts && (repeatCounts[order.phone] || 0) > 1 && (
                            <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-emerald-100 text-emerald-800 border-emerald-200">
                              <Repeat className="w-2.5 h-2.5" />
                              {t("রিপিট", "Repeat")} ({repeatCounts[order.phone]})
                            </Badge>
                          )}
                          {order.visitor_id && doubleVisitorIds?.has(order.visitor_id) && (
                            <Badge className="text-[10px] px-1.5 py-0 gap-0.5 bg-orange-100 text-orange-800 border-orange-200">
                              <Copy className="w-2.5 h-2.5" />
                              {t("ডাবল", "Double")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedOrder(order)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/e/orders/edit/${order.order_id}`)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => confirmDelete([order.id])}
                            disabled={deleteMutation.isPending}
                            title={t("ডিলিট", "Delete")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {/* Pagination */}
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
                    {page + 1} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Courier Entry Progress Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={(open) => { if (!open && entryProgress.done + entryProgress.failed >= entryProgress.total) setEntryDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("কুরিয়ার এন্ট্রি", "Courier Entry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {entryProgress.results.map((result) => (
                <div key={result.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono w-16 shrink-0">{result.orderId}</span>
                  <div className="flex-1">
                    <Progress value={100} className={result.success ? "h-2 [&>div]:bg-primary" : "h-2 [&>div]:bg-destructive"} />
                  </div>
                  <span className={result.success ? "shrink-0 text-primary" : "shrink-0 text-destructive"}>
                    {result.success ? "✓" : "✗"}
                  </span>
                </div>
              ))}

              {entryProgress.current && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono w-16 shrink-0">{entryProgress.current}</span>
                  <div className="flex-1">
                    <Progress className="h-2 animate-pulse" />
                  </div>
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">
                  {entryProgress.done + entryProgress.failed < entryProgress.total
                    ? t("এন্ট্রি শুরু হয়েছে...", "Entry started...")
                    : entryProgress.failed > 0
                      ? t("কিছু এন্ট্রি ব্যর্থ", "Some entries failed")
                      : t("সম্পন্ন!", "Complete!")}
                </span>
                <span className="font-medium tabular-nums">{entryProgress.done + entryProgress.failed}/{entryProgress.total}</span>
              </div>
              <Progress value={entryProgress.total > 0 ? ((entryProgress.done + entryProgress.failed) / entryProgress.total) * 100 : 0} className="h-3" />
              <div className="flex gap-3 text-xs">
                {entryProgress.done > 0 && <span className="font-medium text-primary">✓ {entryProgress.done} {t("সফল", "success")}</span>}
                {entryProgress.failed > 0 && <span className="font-medium text-destructive">✗ {entryProgress.failed} {t("ব্যর্থ", "failed")}</span>}
              </div>
            </div>

            {entryProgress.done + entryProgress.failed >= entryProgress.total && entryProgress.total > 0 && (
              <Button className="w-full" onClick={() => setEntryDialogOpen(false)}>
                {t("বন্ধ করুন", "Close")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Courier Tracking Popup */}
      <Dialog open={!!courierPopup} onOpenChange={() => setCourierPopup(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              {t("কুরিয়ার ট্র্যাকিং", "Courier Tracking")}
            </DialogTitle>
          </DialogHeader>
          {courierPopup && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("অর্ডার", "Order")}: <span className="font-semibold text-foreground">{courierPopup.orderId}</span>
              </p>
              {courierPopup.consignmentId ? (
                <a
                  href={`https://steadfast.com.bd/user/consignment/${courierPopup.consignmentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="w-full gap-2" type="button">
                    <Navigation className="w-4 h-4" />
                    {t("কুরিয়ার ট্র্যাক করুন", "Track on Courier")}
                    <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                  </Button>
                </a>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t("কনসাইনমেন্ট আইডি পাওয়া যায়নি", "Consignment ID not found")}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("অর্ডার", "Order")}: <span className="text-primary">{selectedOrder?.customer_facing_id || selectedOrder?.order_id}</span>
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
                  <p className="text-muted-foreground">{t("মোট", "Total")}</p>
                  <p className="font-bold text-primary text-lg">৳{selectedOrder.total_amount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("তারিখ", "Date")}</p>
                  <p className="font-semibold">{format(new Date(selectedOrder.created_at), "dd/MM/yyyy hh:mm a")}</p>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <p className="font-semibold mb-2">{t("পণ্যসমূহ", "Products")}</p>
                <div className="space-y-2">
                  {orderItems?.map((item) => (
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cross-check Confirm Dialogs */}
      <AlertDialog open={confirmAction?.type === "ask_entry_after_print"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("কুরিয়ার এন্ট্রি করবেন?", "Do courier entry too?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("প্রিন্ট সফল হয়েছে। এখন কি এই অর্ডারগুলো কুরিয়ারে এন্ট্রিও করতে চান?", "Print was successful. Do you also want to enter these orders into courier?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmAction({ type: "ask_tab_after_print", pendingIds: confirmAction?.pendingIds || [], targetTab: "printed" });
            }}>
              {t("না", "No")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const ids = confirmAction?.pendingIds || [];
              const c = confirmAction?.courier || "steadfast";
              setConfirmAction(null);
              void runCourierEntry(ids, c);
            }}>
              {t("হ্যাঁ, এন্ট্রি করুন", "Yes, do entry")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction?.type === "ask_print_before_entry"} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("আগে প্রিন্ট করবেন?", "Print first?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("সিলেক্টেড কিছু অর্ডার এখনো প্রিন্ট হয়নি। আগে প্রিন্ট করতে চান?", "Some selected orders are not printed yet. Do you want to print first?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              const ids = confirmAction?.pendingIds || [];
              const c = confirmAction?.courier || "steadfast";
              setConfirmAction(null);
              void runCourierEntry(ids, c);
            }}>
              {t("না, শুধু এন্ট্রি", "No, just entry")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const ids = confirmAction?.pendingIds || [];
              setConfirmAction(null);
              printMutation.mutate(ids);
            }}>
              {t("হ্যাঁ, আগে প্রিন্ট", "Yes, print first")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction?.type === "ask_tab_after_print"} onOpenChange={(open) => { if (!open) clearPendingSelection(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("প্রিন্টেড ট্যাবে যাবেন?", "Move to Printed tab?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("অর্ডারগুলো প্রিন্টেড হিসেবে মার্ক হয়েছে। প্রিন্টেড ট্যাবে যেতে চান?", "Orders are marked as printed. Do you want to switch to the Printed tab?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={clearPendingSelection}>
              {t("না, এখানেই থাকুন", "No, stay here")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { void moveOrdersToStatus(confirmAction?.pendingIds || [], "printed", "printed"); }}>
              {t("হ্যাঁ, যান", "Yes, go")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction?.type === "ask_tab_after_entry"} onOpenChange={(open) => { if (!open) clearPendingSelection(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("এন্ট্রি ডান ট্যাবে যাবেন?", "Move to Entry Done tab?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("অর্ডারগুলো কুরিয়ারে এন্ট্রি হয়েছে। এন্ট্রি ডান ট্যাবে যেতে চান?", "Orders have been entered into courier. Do you want to switch to the Entry Done tab?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={clearPendingSelection}>
              {t("না, এখানেই থাকুন", "No, stay here")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { void moveOrdersToStatus(confirmAction?.pendingIds || [], "entry_done", "entry_done"); }}>
              {t("হ্যাঁ, যান", "Yes, go")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
