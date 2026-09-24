import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Search, ChevronDown, ChevronUp, Truck, PackageCheck, RotateCcw, Clock, Printer, ClipboardCheck, XCircle, ShoppingBag } from "lucide-react";
import { DateRangeFilter, DateRangeValue, getDateRangeISO } from "@/components/admin/DateRangeFilter";

interface ProductStats {
  confirmed: number;
  printed: number;
  entry_done: number;
  shipped: number;
  delivered: number;
  returned: number; // status = 'return'
  cancelled: number;
  pending: number;
  total: number;
}

function ProductStatsRow({ productId, dateRange, customFrom, customTo, t }: {
  productId: string;
  dateRange: DateRangeValue;
  customFrom: string;
  customTo: string;
  t: <T>(bn: T, en: T) => T;
}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["product-order-stats", productId, dateRange, customFrom, customTo],
    queryFn: async () => {
      const fromISO = getDateRangeISO(dateRange, customFrom ? new Date(customFrom).toISOString() : undefined);

      // Paginate to avoid 1000-row limit
      const allItems: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let query = supabase
          .from("order_items")
          .select(`quantity, orders!inner(status, is_deleted, created_at)`)
          .eq("product_id", productId)
          .eq("orders.is_deleted", false)
          .range(from, from + PAGE - 1);

        if (fromISO) query = query.gte("orders.created_at", fromISO);
        if (dateRange === "custom" && customTo) {
          const toDate = new Date(customTo);
          toDate.setHours(23, 59, 59, 999);
          query = query.lte("orders.created_at", toDate.toISOString());
        }
        if (dateRange === "last_month") {
          const now = new Date();
          const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
          lastDay.setHours(23, 59, 59, 999);
          query = query.lte("orders.created_at", lastDay.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        allItems.push(...(data || []));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }

      const data = allItems;

      const s: ProductStats = { confirmed: 0, printed: 0, entry_done: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0, pending: 0, total: 0 };

      for (const item of data) {
        const status = (item as any).orders?.status || "pending";
        const qty = item.quantity;
        s.total += qty;
        if (status === "confirmed") s.confirmed += qty;
        else if (status === "printed") s.printed += qty;
        else if (status === "entry_done") s.entry_done += qty;
        else if (status === "shipped") s.shipped += qty;
        else if (status === "delivered") s.delivered += qty;
        else if (status === "return") s.returned += qty;
        else if (status === "cancelled") s.cancelled += qty;
        else s.pending += qty;
      }

      return s;
    },
  });

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={4} className="py-3">
          <div className="flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (!stats) return null;

  const statItems = [
    { icon: ShoppingBag, label: t("মোট অর্ডার", "Total Orders"), value: stats.total, color: "text-foreground" },
    { icon: Clock, label: t("পেন্ডিং", "Pending"), value: stats.pending, color: "text-yellow-600" },
    { icon: PackageCheck, label: t("কনফার্মড", "Confirmed"), value: stats.confirmed, color: "text-blue-600" },
    { icon: Printer, label: t("প্রিন্টেড", "Printed"), value: stats.printed, color: "text-indigo-600" },
    { icon: ClipboardCheck, label: t("এন্ট্রি ডান", "Entry Done"), value: stats.entry_done, color: "text-purple-600" },
    { icon: Truck, label: t("কুরিয়ারে", "Shipped"), value: stats.shipped, color: "text-orange-600" },
    { icon: PackageCheck, label: t("ডেলিভারি", "Delivered"), value: stats.delivered, color: "text-green-600" },
    { icon: RotateCcw, label: t("রিটার্ন", "Returned"), value: stats.returned, color: "text-red-600" },
    { icon: XCircle, label: t("ক্যানসেল", "Cancelled"), value: stats.cancelled, color: "text-muted-foreground" },
  ];

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell colSpan={4} className="py-3 px-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 pl-2">
          {statItems.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs">
              <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              <span className="text-muted-foreground">{s.label}:</span>
              <span className={`font-semibold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function TopProducts() {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState<DateRangeValue>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories-filter"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("name, display_name").order("position");
      if (error) throw error;
      return data;
    },
  });

  // Fetch product categories mapping
  const { data: productCategoryMap } = useQuery({
    queryKey: ["product-category-map"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, category");
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach(p => { if (p.category) map.set(p.id, p.category); });
      return map;
    },
  });

  const { data: topProducts, isLoading } = useQuery({
    queryKey: ["top-products-50", dateRange, customFrom, customTo],
    queryFn: async () => {
      const fromISO = getDateRangeISO(dateRange, customFrom ? new Date(customFrom).toISOString() : undefined);

      // Paginate to avoid 1000-row limit
      const allItems: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let query = supabase
          .from("order_items")
          .select(`
            product_id, product_name, product_image, quantity, unit_price,
            orders!inner(status, is_deleted, created_at)
          `)
          .eq("orders.is_deleted", false)
          .neq("orders.status", "cancelled")
          .range(from, from + PAGE - 1);

        if (fromISO) query = query.gte("orders.created_at", fromISO);
        if (dateRange === "custom" && customTo) {
          const toDate = new Date(customTo);
          toDate.setHours(23, 59, 59, 999);
          query = query.lte("orders.created_at", toDate.toISOString());
        }
        if (dateRange === "last_month") {
          const now = new Date();
          const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
          lastDay.setHours(23, 59, 59, 999);
          query = query.lte("orders.created_at", lastDay.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        allItems.push(...(data || []));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }

      const map = new Map<string, {
        product_id: string;
        product_name: string;
        product_image: string | null;
        total_sold: number;
      }>();

      for (const item of allItems) {
        const existing = map.get(item.product_id);
        if (existing) {
          existing.total_sold += item.quantity;
        } else {
          map.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product_name,
            product_image: item.product_image,
            total_sold: item.quantity,
          });
        }
      }


      return Array.from(map.values())
        .sort((a, b) => b.total_sold - a.total_sold);
    },
  });

  const filteredProducts = useMemo(() => {
    let list = topProducts || [];

    // Category filter
    if (selectedCategory !== "all" && productCategoryMap) {
      list = list.filter(p => productCategoryMap.get(p.product_id) === selectedCategory);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.product_name.toLowerCase().includes(q));
    }

    return list;
  }, [topProducts, search, selectedCategory, productCategoryMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(f, to) => { setCustomFrom(f); setCustomTo(to); }}
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder={t("ক্যাটাগরি", "Category")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("সকল ক্যাটাগরি", "All Categories")}</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.display_name || c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={t("পণ্য খুঁজুন...", "Search product...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 w-[180px] text-sm"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2" />
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredProducts?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <p>{t("কোনো বিক্রিত পণ্য পাওয়া যায়নি", "No sold products found")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>{t("ছবি", "Image")}</TableHead>
                  <TableHead>{t("পণ্যের নাম", "Product Name")}</TableHead>
                  <TableHead className="text-right">{t("বিক্রিত সংখ্যা", "Qty Sold")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product, index) => {
                  const isExpanded = expandedId === product.product_id;
                  return (
                    <Fragment key={product.product_id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : product.product_id)}>
                        <TableCell className="text-center font-bold text-muted-foreground">
                          {index < 3 ? (
                            <Badge variant={index === 0 ? "default" : "secondary"} className="w-7 h-7 rounded-full flex items-center justify-center p-0">
                              {index + 1}
                            </Badge>
                          ) : (
                            index + 1
                          )}
                        </TableCell>
                        <TableCell>
                          {product.product_image ? (
                            <img src={product.product_image} alt={product.product_name} className="w-10 h-10 rounded-md object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-[250px] truncate">{product.product_name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Badge variant="outline" className="font-semibold">{product.total_sold}</Badge>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <ProductStatsRow
                          productId={product.product_id}
                          dateRange={dateRange}
                          customFrom={customFrom}
                          customTo={customTo}
                          t={t}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
