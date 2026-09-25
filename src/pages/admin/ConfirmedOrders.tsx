import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search, Loader2, Package, Printer, ClipboardCheck, Truck,
  PackageCheck, PackageMinus, RotateCcw, Undo2, XCircle, HelpCircle,
  Pencil, StickyNote, Tag, Eye, ChevronLeft, ChevronRight, Settings,
} from "lucide-react";
import { SourceBadge } from "@/components/admin/SourceBadge";
import { PaymentBadge } from "@/components/admin/PaymentBadge";
import { CreatedByBadge } from "@/components/admin/CreatedByBadge";
import { PhoneVerifiedBadge } from "@/components/PhoneVerifiedBadge";
import { usePhoneVerificationMap } from "@/hooks/usePhoneVerification";

const PAGE_SIZE = 50;
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { DateRangeFilter, DateRangeValue, getDateRangeISO } from "@/components/admin/DateRangeFilter";

const CONFIRMED_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed", labelBn: "কনফার্মড", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Package },
  { value: "printed", label: "Printed", labelBn: "প্রিন্টেড", color: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: Printer },
  { value: "entry_done", label: "Entry Done", labelBn: "এন্ট্রি ডান", color: "bg-teal-100 text-teal-800 border-teal-200", icon: ClipboardCheck },
  { value: "shipped", label: "Shipped", labelBn: "শিপড", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Truck },
  { value: "delivered", label: "Delivered", labelBn: "ডেলিভারড", color: "bg-green-100 text-green-800 border-green-200", icon: PackageCheck },
  { value: "partial", label: "Partial", labelBn: "পার্শিয়াল", color: "bg-amber-100 text-amber-800 border-amber-200", icon: PackageMinus },
  { value: "pending_return", label: "Pending Return", labelBn: "পেন্ডিং রিটার্ন", color: "bg-orange-100 text-orange-800 border-orange-200", icon: RotateCcw },
  { value: "return", label: "Return", labelBn: "রিটার্ন", color: "bg-rose-100 text-rose-800 border-rose-200", icon: Undo2 },
  { value: "cancelled", label: "Cancel", labelBn: "বাতিল", color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  { value: "missing", label: "Missing", labelBn: "মিসিং", color: "bg-gray-100 text-gray-800 border-gray-200", icon: HelpCircle },
];

const CONFIRMED_STATUS_VALUES = CONFIRMED_STATUS_OPTIONS.map((s) => s.value);
const VISIBLE_STATUSES = CONFIRMED_STATUS_VALUES;


export default function ConfirmedOrders() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const [dateRange, setDateRange] = useState<DateRangeValue>("lifetime");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryProgress, setEntryProgress] = useState<{ total: number; done: number; failed: number; current: string; results: { id: string; orderId: string; success: boolean; error?: string }[] }>({ total: 0, done: 0, failed: 0, current: "", results: [] });

  useEffect(() => { setPage(0); }, [search, statusFilter, dateRange]);

  const normalizedSearch = search.trim();

  const getStatusInfo = (status: string) => {
    return CONFIRMED_STATUS_OPTIONS.find((s) => s.value === status) || CONFIRMED_STATUS_OPTIONS[0];
  };

  const { data: ordersResult, isLoading } = useQuery({
    queryKey: ["confirmed-orders", search, statusFilter, page, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*, products(product_image)), visitors(traffic_source)", { count: "exact" })
        .in("status", VISIBLE_STATUSES)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (normalizedSearch)
        query = query.or(
          `order_id.ilike.%${normalizedSearch}%,customer_facing_id.ilike.%${normalizedSearch}%,customer_name.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%`
        );
      if (statusFilter && statusFilter !== "all")
        query = query.eq("status", statusFilter);
      const since = normalizedSearch ? null : getDateRangeISO(dateRange);
      if (since) query = query.gte("created_at", since);
      const { data, error, count } = await query;
      if (error) throw error;
      return { orders: data || [], totalCount: count || 0 };
    },
  });

  const orders = ordersResult?.orders || [];
  const totalCount = ordersResult?.totalCount || 0;

  const { data: statusCounts } = useQuery({
    queryKey: ["confirmed-orders-counts-rpc-v1", search, dateRange],
    refetchOnMount: "always",
    queryFn: async () => {
      const since = normalizedSearch ? null : getDateRangeISO(dateRange);
      const { data, error } = await supabase.rpc("get_confirmed_order_status_counts", {
        p_statuses: VISIBLE_STATUSES,
        p_date_from: since || null,
        p_search: normalizedSearch || null,
      });
      if (error) throw error;
      const counts: Record<string, number> = {};
      let totalAll = 0;
      (data || []).forEach((row: any) => {
        counts[row.status] = Number(row.cnt);
        totalAll += Number(row.cnt);
      });
      counts.all = totalAll;
      return counts;
    },
  });

  const allPhones = useMemo(() => orders.map((o) => o.phone), [orders]);
  const verifiedPhones = usePhoneVerificationMap(allPhones);

  const orderIds = useMemo(() => orders?.map((o) => o.id) || [], [orders]);
  const { data: allOrderItems } = useQuery({
    queryKey: ["all-confirmed-order-items", orderIds],
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

  const selectedOrderItems = selectedOrder ? itemsByOrder[selectedOrder.id] || [] : [];

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
      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      toast.success(t("স্ট্যাটাস আপডেট হয়েছে", "Status updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePrintReceipts = async (ids: string[]) => {
    const selectedOrders = orders?.filter((o) => ids.includes(o.id)) || [];
    if (!selectedOrders.length) return;

    // Fetch items for selected orders
    const { data: rawItems } = await supabase
      .from("order_items")
      .select("*, products(product_image, tag, short_description)")
      .in("order_id", ids);
    const items = (rawItems || []).map((i: any) => ({
      ...i,
      product_image: i.product_image || i.products?.product_image || null,
      tag: i.products?.tag || null,
      short_description: i.short_description || i.products?.short_description || null,
    }));

    const invoiceItemsMap: Record<string, any[]> = {};
    items?.forEach((item) => {
      if (!invoiceItemsMap[item.order_id]) invoiceItemsMap[item.order_id] = [];
      invoiceItemsMap[item.order_id].push(item);
    });

    const { printInvoices } = await import("@/lib/invoiceGenerator");
    const success = await printInvoices(selectedOrders, invoiceItemsMap);
    if (!success) {
      toast.error(t("প্রিন্ট উইন্ডো ওপেন হয়নি", "Could not open print window"));
      return;
    }

    // Mark as printed in DB
    const { error } = await supabase.from("orders").update({ is_printed: true } as any).in("id", ids);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
      setSelectedIds(new Set());
      toast.success(t("প্রিন্টেড হিসেবে চিহ্নিত হয়েছে", "Marked as printed"));
    }
  };

  const runCourierEntry = async (courier: "steadfast" | "pathao" = "steadfast") => {
    const ids = Array.from(selectedIds);
    const selectedOrders = orders?.filter((o) => ids.includes(o.id)) || [];
    if (!selectedOrders.length) return;

    setEntryProgress({ total: selectedOrders.length, done: 0, failed: 0, current: selectedOrders[0]?.order_id || "", results: [] });
    setEntryDialogOpen(true);

    // Always use single create_order per order (bulk API doesn't save item_description/note)
    const results: { id: string; orderId: string; success: boolean; error?: string }[] = [];
    let doneCount = 0;
    let failCount = 0;

    for (const o of selectedOrders) {
      setEntryProgress((prev) => ({ ...prev, current: o.order_id }));
      try {
        const { data, error } = await supabase.functions.invoke(courier === "pathao" ? "pathao-courier" : "steadfast-courier", {
          body: {
            action: "create_order",
            orders: [{
              id: o.id,
              order_id: o.order_id,
              customer_facing_id: o.customer_facing_id,
              customer_name: o.customer_name,
              phone: o.phone,
              alt_phone: o.alt_phone,
              address: o.address,
              total_amount: o.total_amount,
              note: o.note,
            }],
          },
        });
        if (error) {
          // Try to pull the real reason out of FunctionsHttpError
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
        results.push({ id: o.id, orderId: o.order_id, success: true });
      } catch (err: any) {
        failCount++;
        results.push({ id: o.id, orderId: o.order_id, success: false, error: err?.message || "অজানা কারণে এন্ট্রি ব্যর্থ" });
      }
      setEntryProgress((prev) => ({ ...prev, done: doneCount, failed: failCount, results: [...results] }));
    }

    setEntryProgress((prev) => ({ ...prev, current: "" }));
    queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
    setSelectedIds(new Set());
    if (doneCount > 0) toast.success(t(`${doneCount}টি অর্ডার এন্ট্রি সফল`, `${doneCount} orders entered successfully`));
    if (failCount > 0) toast.error(t(`${failCount}টি অর্ডার এন্ট্রি ব্যর্থ`, `${failCount} orders failed`));
  };

  const openEntryDialog = (courier: "steadfast" | "pathao" = "steadfast") => {
    runCourierEntry(courier);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!orders) return;
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const hasSelected = selectedIds.size > 0;

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
        {CONFIRMED_STATUS_OPTIONS.map((s) => {
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
        <Badge
          className={`cursor-pointer ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          onClick={() => setStatusFilter("all")}
        >
          {t("সব", "All")} ({statusCounts?.all || 0})
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
            <DateRangeFilter value={dateRange} onChange={setDateRange} />

            {hasSelected && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size} {t("টি সিলেক্টেড", " selected")}
                </span>
                <Select
                  onValueChange={async (newStatus) => {
                    const ids = Array.from(selectedIds);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const { error } = await supabase
                        .from("orders")
                        .update({ status: newStatus, last_status_changed_by: session?.user?.id || null } as any)
                        .in("id", ids);
                      if (error) throw error;
                      // Fire notifications for each order in background
                      for (const id of ids) {
                        supabase.functions.invoke("order-status-notify", {
                          body: { order_id: id, new_status: newStatus },
                        }).catch(console.error);
                      }
                      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
                      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
                      setSelectedIds(new Set());
                      toast.success(t(`${ids.length}টি অর্ডারের স্ট্যাটাস আপডেট হয়েছে`, `${ids.length} orders status updated`));
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder={t("স্ট্যাটাস চেঞ্জ", "Change Status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIRMED_STATUS_OPTIONS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <SelectItem key={s.value} value={s.value}>
                          <span className="flex items-center gap-1.5">
                            <Icon className="w-3 h-3" />
                            {t(s.labelBn, s.label)}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => handlePrintReceipts(Array.from(selectedIds))}
                  disabled={false}
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
                
                
              </div>
            )}
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
            <div className="overflow-x-auto">
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
                    <TableHead>{t("নাম্বার", "Number")}</TableHead>
                    <TableHead>{t("পণ্য", "Products")}</TableHead>
                    <TableHead>{t("সোর্স", "Source")}</TableHead>
                    <TableHead className="text-center">{t("প্রিন্ট/এন্ট্রি", "Print/Entry")}</TableHead>
                    <TableHead>{t("স্ট্যাটাস", "Status")}</TableHead>
                    <TableHead className="text-right">{t("মোট", "Total")}</TableHead>
                    <TableHead className="text-center">{t("এডিট", "Edit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((order) => {
                    const rawItems = (order as any).order_items && (order as any).order_items.length > 0 ? (order as any).order_items : (itemsByOrder[order.id] || []);
                    const items = rawItems.map((i: any) => {
                      const snap = i.product_image as string | null;
                      const isBroken = !snap || /bij-bd\.com/i.test(snap);
                      return { ...i, product_image: (isBroken ? i.products?.product_image : snap) || i.products?.product_image || null };
                    });
                    const isPrinted = (order as any).is_printed;
                    const isCourierEntered = (order as any).is_courier_entered;

                    return (
                      <TableRow key={order.id} data-state={selectedIds.has(order.id) ? "selected" : undefined}>
                        {/* Checkbox */}
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>

                        {/* Relative time since confirmed */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap min-w-[90px]">
                          {getRelativeTime(order.updated_at)}
                        </TableCell>

                        {/* Order ID */}
                        <TableCell className="min-w-[100px]">
                          <button
                            className="font-bold text-primary hover:underline cursor-pointer text-left"
                            onClick={() => setSelectedOrder(order)}
                          >
                            {order.customer_facing_id || order.order_id}
                          </button>
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

                        {/* Product images stacked */}
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
                        </TableCell>

                        {/* Source */}
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <SourceBadge source={(order as any).traffic_source || (order as any).visitors?.traffic_source} createdByAdminId={(order as any).created_by_admin_id} />
                            <PaymentBadge method={(order as any).payment_method} status={(order as any).payment_status} amount={(order as any).paid_amount} compact />
                          </div>
                        </TableCell>

                        {/* Print & Courier Entry icons */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                                      isPrinted
                                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                                        : "bg-muted/50 text-muted-foreground/30"
                                    }`}
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {isPrinted ? t("প্রিন্টেড", "Printed") : t("প্রিন্ট হয়নি", "Not Printed")}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                                      isCourierEntered
                                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                                        : "bg-muted/50 text-muted-foreground/30"
                                    }`}
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {isCourierEntered ? t("কুরিয়ার এন্ট্রি হয়েছে", "Courier Entered") : t("এন্ট্রি হয়নি", "Not Entered")}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>

                        {/* Status (click to change) + note */}
                        <TableCell className="min-w-[120px]">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${si.color} hover:ring-2 hover:ring-offset-1 hover:ring-primary/30 transition`}
                                title={t("ক্লিক করে স্ট্যাটাস পরিবর্তন করুন", "Click to change status")}
                              >
                                <StatusIcon className="w-3.5 h-3.5" />
                                {t(si.labelBn, si.label)}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="start">
                              <div className="text-[11px] text-muted-foreground px-2 py-1">{t("নতুন স্ট্যাটাস", "New status")}</div>
                              <div className="flex flex-col">
                                {CONFIRMED_STATUS_OPTIONS.filter(s => s.value !== order.status).map((s) => {
                                  const I = s.icon;
                                  return (
                                    <button
                                      key={s.value}
                                      type="button"
                                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-left"
                                      onClick={() => statusMutation.mutate({ id: order.id, status: s.value, oldStatus: order.status })}
                                    >
                                      <I className="w-3.5 h-3.5" />
                                      {t(s.labelBn, s.label)}
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                          {order.note && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <StickyNote className="w-3.5 h-3.5 text-muted-foreground mt-1 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[250px] text-xs">
                                  {order.note}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>

                        {/* Total */}
                        <TableCell className="text-right font-semibold whitespace-nowrap">
                          ৳{order.total_amount}
                        </TableCell>

                        {/* Edit */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedOrder(order)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/orders/edit/${order.order_id}`)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {orders.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, orders.length)} / {orders.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= orders.length} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
          )}
        </CardContent>
      </Card>

      {/* Order detail / edit dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
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
                  <p className="text-muted-foreground">{t("স্ট্যাটাস", "Status")}</p>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusInfo(selectedOrder.status).color}`}>
                    {(() => { const SI = getStatusInfo(selectedOrder.status).icon; return <SI className="w-3.5 h-3.5" />; })()}
                    {t(getStatusInfo(selectedOrder.status).labelBn, getStatusInfo(selectedOrder.status).label)}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("মোট", "Total")}</p>
                  <p className="font-bold text-primary text-lg">৳{selectedOrder.total_amount}</p>
                </div>
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Courier Entry Progress Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={(open) => { if (!open && entryProgress.done + entryProgress.failed >= entryProgress.total) setEntryDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("কুরিয়ার এন্ট্রি", "Courier Entry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Individual order list */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {entryProgress.results.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono w-16 shrink-0">{r.orderId}</span>
                  <div className="flex-1">
                    <Progress value={100} className={`h-2 ${r.success ? "[&>div]:bg-green-500" : "[&>div]:bg-destructive"}`} />
                  </div>
                  <span className={`shrink-0 ${r.success ? "text-green-600" : "text-destructive"}`}>
                    {r.success ? "✓" : "✗"}
                  </span>
                </div>
              ))}
              {/* Currently processing */}
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

            {/* Total progress bar */}
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">
                  {entryProgress.done + entryProgress.failed < entryProgress.total
                    ? t("এন্ট্রি হচ্ছে...", "Entering...")
                    : entryProgress.failed > 0
                      ? t("কিছু এন্ট্রি ব্যর্থ", "Some entries failed")
                      : t("সম্পন্ন!", "Complete!")}
                </span>
                <span className="font-medium tabular-nums">{entryProgress.done + entryProgress.failed}/{entryProgress.total}</span>
              </div>
              <Progress value={entryProgress.total > 0 ? ((entryProgress.done + entryProgress.failed) / entryProgress.total) * 100 : 0} className="h-3" />
              <div className="flex gap-3 text-xs">
                {entryProgress.done > 0 && <span className="text-green-600 font-medium">✓ {entryProgress.done} {t("সফল", "success")}</span>}
                {entryProgress.failed > 0 && <span className="text-destructive font-medium">✗ {entryProgress.failed} {t("ব্যর্থ", "failed")}</span>}
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
    </div>
  );
}
