import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search, Loader2, Package, CalendarClock,
  Pencil, Tag,
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { PhoneVerifiedBadge } from "@/components/PhoneVerifiedBadge";
import { usePhoneVerificationMap } from "@/hooks/usePhoneVerification";

export default function PreOrders() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  

  const { data: orders, isLoading } = useQuery({
    queryKey: ["pre-orders", search],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*")
        .eq("status", "pre")
        .eq("is_deleted", false)
        .order("pre_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (search)
        query = query.or(
          `order_id.ilike.%${search}%,customer_facing_id.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const verifiedPhones = usePhoneVerificationMap(useMemo(() => orders?.map((o) => o.phone) || [], [orders]));

  const orderIds = useMemo(() => orders?.map((o) => o.id) || [], [orders]);
  const { data: allOrderItems } = useQuery({
    queryKey: ["pre-order-items", orderIds],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, products(product_image)")
        .in("order_id", orderIds);
      if (error) throw error;
      return (data || []).map((i: any) => ({
        ...i,
        product_image: i.product_image || i.products?.product_image || null,
      }));
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

  // Group orders by pre_date, today first, then upcoming, then past, then no-date
  const groupedOrders = useMemo(() => {
    if (!orders) return [];
    const groups: Record<string, typeof orders> = {};
    const noDateKey = "__no_date__";

    orders.forEach((order) => {
      const key = order.pre_date || noDateKey;
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === noDateKey) return 1;
      if (b === noDateKey) return -1;
      const dateA = parseISO(a);
      const dateB = parseISO(b);
      // Today first
      const todayA = isToday(dateA);
      const todayB = isToday(dateB);
      if (todayA && !todayB) return -1;
      if (!todayA && todayB) return 1;
      // Then upcoming (future), then past
      const pastA = isPast(dateA) && !isToday(dateA);
      const pastB = isPast(dateB) && !isToday(dateB);
      if (!pastA && pastB) return -1;
      if (pastA && !pastB) return 1;
      // Within same category, sort by date ascending
      return dateA.getTime() - dateB.getTime();
    });

    return sortedKeys.map((key) => ({
      key,
      label: key === noDateKey
        ? t("ডেট নেই", "No Date")
        : isToday(parseISO(key))
          ? t("আজ", "Today") + ` — ${format(parseISO(key), "d MMMM")}`
          : isTomorrow(parseISO(key))
            ? t("আগামীকাল", "Tomorrow") + ` — ${format(parseISO(key), "d MMMM")}`
            : format(parseISO(key), "d MMMM"),
      isToday: key !== noDateKey && isToday(parseISO(key)),
      isPast: key !== noDateKey && isPast(parseISO(key)) && !isToday(parseISO(key)),
      isNoDate: key === noDateKey,
      orders: groups[key],
    }));
  }, [orders, t]);

  return (
    <div className="space-y-4">

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t("অর্ডার আইডি, নাম বা ফোন...", "Order ID, name or phone...")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !orders?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mb-3 opacity-40" />
          <p>{t("কোনো প্রি-অর্ডার পাওয়া যায়নি", "No pre-orders found")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedOrders.map((group) => (
            <Card key={group.key} className={group.isToday ? "border-primary/40 shadow-md" : group.isPast ? "opacity-75" : ""}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className={`w-4 h-4 ${group.isToday ? "text-primary" : group.isNoDate ? "text-destructive" : "text-muted-foreground"}`} />
                  <h3 className={`font-semibold text-sm ${group.isToday ? "text-primary" : group.isNoDate ? "text-destructive" : "text-foreground"}`}>
                    {group.label}
                  </h3>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {group.orders.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("অর্ডার", "Order")}</TableHead>
                        <TableHead>{t("কাস্টমার", "Customer")}</TableHead>
                        <TableHead>{t("নাম্বার", "Number")}</TableHead>
                        <TableHead>{t("পণ্য", "Products")}</TableHead>
                        <TableHead className="text-right">{t("মোট", "Total")}</TableHead>
                        <TableHead className="text-center">{t("এডিট", "Edit")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.orders.map((order) => {
                        const items = itemsByOrder[order.id] || [];
                        const timeAgo = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });

                        return (
                          <TableRow key={order.id}>
                            <TableCell className="min-w-[100px]">
                              <button
                                className="font-bold text-primary hover:underline cursor-pointer text-left"
                                onClick={() => navigate(`/e/orders/edit/${order.order_id}`)}
                              >
                                {order.customer_facing_id || order.order_id}
                              </button>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo}</p>
                            </TableCell>

                            <TableCell className="min-w-[140px] max-w-[200px]">
                              <p className="font-medium text-sm">{order.customer_name}</p>
                              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{order.address}</p>
                            </TableCell>

                            <TableCell className="min-w-[110px]">
                              <p className="text-sm flex items-center gap-1">{order.phone} <PhoneVerifiedBadge verified={verifiedPhones.get(order.phone) === true} /></p>
                              {order.alt_phone && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{order.alt_phone}</p>
                              )}
                            </TableCell>

                            <TableCell className="min-w-[60px]">
                              <div className="flex flex-wrap gap-1 max-w-[120px] items-center">
                                {items.length > 0 ? (
                                  <>
                                    {items.slice(0, 3).map((item) => (
                                      <TooltipProvider key={item.id}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
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
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                                            {item.product_name} × {item.quantity}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))}
                                    {items.length > 3 && (
                                      <span className="text-[11px] font-medium text-muted-foreground">+{items.length - 3}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right font-semibold whitespace-nowrap">
                              ৳{order.total_amount}
                            </TableCell>

                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/e/orders/edit/${order.order_id}`)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
