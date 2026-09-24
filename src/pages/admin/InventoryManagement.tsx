import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Search, Package, Loader2, Plus, Minus, ChevronLeft, ChevronRight, AlertTriangle, TruckIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import StockOutApproval from "@/components/admin/StockOutApproval";

const PAGE_SIZE = 50;

type LowStockProduct = {
  product_id: string;
  product_name: string;
  product_sku: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  incoming_stock: number;
  last_30d_sold: number;
  product_image: string | null;
};

export default function InventoryManagement() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [incomingInputs, setIncomingInputs] = useState<Record<string, string>>({});
  const [editingIncoming, setEditingIncoming] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<"reserved" | "available" | "sold" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("position").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Low stock products from DB function
  const { data: lowStockProducts } = useQuery({
    queryKey: ["low-stock-products"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_low_stock_products");
      if (error) throw error;
      return (data || []) as LowStockProduct[];
    },
  });

  const lowStockIds = new Set(lowStockProducts?.map((p) => p.product_id) || []);
  const lowStockMap = new Map(lowStockProducts?.map((p) => [p.product_id, p]) || []);

  const { data: countData } = useQuery({
    queryKey: ["inventory-count", search, selectedCategory, stockFilter],
    queryFn: async () => {
      if (stockFilter === "low") return lowStockProducts?.length || 0;
      let query = supabase.from("products").select("*", { count: "exact", head: true });
      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const totalCount = countData || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const { data: products, isLoading } = useQuery({
    queryKey: ["inventory-products", search, selectedCategory, page, stockFilter],
    queryFn: async () => {
      if (stockFilter === "low") {
        // Return low stock products (already fetched, sales already included)
        return (lowStockProducts || []).map((p) => ({
          id: p.product_id,
          name: p.product_name,
          sku: p.product_sku,
          category: null as string | null,
          stock: p.current_stock,
          reserved_stock: p.reserved_stock,
          incoming_stock: p.incoming_stock,
          product_image: p.product_image,
          position: 0,
          stock_out_display: "hidden" as string,
          _last_30d_sold: p.last_30d_sold,
        }));
      }
      let query = supabase
        .from("products")
        .select("id, name, sku, category, stock, reserved_stock, incoming_stock, product_image, position, stock_out_display, stock_out_custom_text")
        .order("position", { ascending: true })
        .order("name", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      if (selectedCategory !== "all") query = query.eq("category", selectedCategory);

      const { data, error } = await query;
      if (error) throw error;

      const productList = data || [];
      const ids = productList.map((p: any) => p.id);

      // Fetch real 30-day sales for the visible page
      const salesMap = new Map<string, number>();
      if (ids.length > 0) {
        const { data: salesData } = await supabase.rpc("get_products_30d_sales", { p_product_ids: ids });
        (salesData || []).forEach((s: any) => salesMap.set(s.product_id, Number(s.total_sold) || 0));
      }

      return productList.map((p: any) => ({
        ...p,
        _last_30d_sold: salesMap.get(p.id) ?? lowStockMap.get(p.id)?.last_30d_sold ?? 0,
      }));
    },
    enabled: stockFilter !== "low" || !!lowStockProducts,
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("products").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-count"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("আপডেট হয়েছে", "Updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleStockChange = (productId: string, currentStock: number, delta: number) => {
    const inputVal = parseInt(stockInputs[productId] || "1", 10);
    const amount = isNaN(inputVal) || inputVal < 1 ? 1 : inputVal;
    const newStock = Math.max(0, currentStock + delta * amount);
    updateStockMutation.mutate({ id: productId, updates: { stock: newStock } });
    setStockInputs((prev) => ({ ...prev, [productId]: "" }));
  };

  const handleIncomingStockSave = (productId: string) => {
    const val = parseInt(incomingInputs[productId] || "0", 10);
    if (isNaN(val) || val < 0) return;
    updateStockMutation.mutate({ id: productId, updates: { incoming_stock: val } });
    setIncomingInputs((prev) => ({ ...prev, [productId]: "" }));
  };

  const handleSearch = (value: string) => { setSearch(value); setPage(0); };
  const handleCategoryChange = (value: string) => { setSelectedCategory(value); setPage(0); };
  const handleStockFilterChange = (value: string) => { setStockFilter(value); setPage(0); };

  const handleSort = (col: "reserved" | "available" | "sold") => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sortedProducts = useMemo(() => {
    if (!products || !sortCol) return products;
    return [...products].sort((a: any, b: any) => {
      let va = 0, vb = 0;
      if (sortCol === "reserved") { va = a.reserved_stock || 0; vb = b.reserved_stock || 0; }
      else if (sortCol === "available") { va = a.stock - (a.reserved_stock || 0); vb = b.stock - (b.reserved_stock || 0); }
      else if (sortCol === "sold") { va = a._last_30d_sold || 0; vb = b._last_30d_sold || 0; }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [products, sortCol, sortDir]);

  const SortIcon = ({ col }: { col: "reserved" | "available" | "sold" }) => (
    <button onClick={() => handleSort(col)} className="inline-flex ml-1 text-muted-foreground hover:text-foreground transition-colors">
      {sortCol === col ? (sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
    </button>
  );

  const lowStockCount = lowStockProducts?.filter((p) => p.incoming_stock === 0).length || 0;

  return (
    <div className="space-y-4">

      {/* Stock-Out Approval (admin Yes/No gate) — shown at top */}
      <StockOutApproval />

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {lowStockCount} {t("টি পণ্য লো স্টকে আছে (সম্ভাব্য স্টক ছাড়া)", "products are low stock (no incoming stock)")}
          </p>
          <Button variant="outline" size="sm" className="ml-auto text-amber-700 border-amber-300 hover:bg-amber-100"
            onClick={() => handleStockFilterChange("low")}>
            {t("দেখুন", "View")}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("নাম বা SKU দিয়ে সার্চ...", "Search by name or SKU...")}
                className="pl-9"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("ক্যাটাগরি", "Category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("সব ক্যাটাগরি", "All Categories")}</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={handleStockFilterChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("সব পণ্য", "All Products")}</SelectItem>
                <SelectItem value="low">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {t("লো স্টক", "Low Stock")}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !products?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <p>{t("কোনো পণ্য পাওয়া যায়নি", "No products found")}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{t("পণ্যের নাম", "Product Name")}</TableHead>
                    <TableHead>{t("ক্যাটাগরি", "Category")}</TableHead>
                    <TableHead className="text-center">{t("মোট স্টক", "Total Stock")}</TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center">{t("রিজার্ভড", "Reserved")}<SortIcon col="reserved" /></span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center">{t("বিক্রয়যোগ্য", "Available")}<SortIcon col="available" /></span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center">{t("৩০দিনে বিক্রি", "30d Sold")}<SortIcon col="sold" /></span>
                    </TableHead>
                    <TableHead className="text-center">{t("সম্ভাব্য স্টক", "Incoming")}</TableHead>
                    <TableHead className="text-center">{t("স্টক পরিবর্তন", "Update Stock")}</TableHead>
                    <TableHead className="text-center">{t("সাইটে দেখান", "On Website")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sortedProducts || []).map((product: any, idx: number) => {
                    const reserved = product.reserved_stock || 0;
                    const available = product.stock - reserved;
                    const isLow = lowStockIds.has(product.id);
                    const sold30d = product._last_30d_sold || 0;
                    const incoming = product.incoming_stock || 0;
                    return (
                      <TableRow key={product.id} className={isLow && incoming === 0 ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                        <TableCell className="text-muted-foreground text-xs">
                          {page * PAGE_SIZE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.product_image ? (
                              <img src={product.product_image} alt={product.name} className="w-8 h-8 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-medium text-sm truncate max-w-[180px]">{product.name}</span>
                              {isLow && incoming === 0 && (
                                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> {t("লো স্টক", "Low Stock")}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.category ? (
                            <Badge variant="outline" className="text-xs">{product.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold ${product.stock > 0 ? "text-foreground" : "text-destructive"}`}>
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {reserved > 0 ? (
                            <Badge variant="outline" className="text-xs font-bold text-amber-600 border-amber-300 bg-amber-50">
                              {reserved}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">০</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={available > 0 ? "secondary" : "destructive"} className="text-sm font-bold min-w-[40px]">
                            {available}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {sold30d > 0 ? (
                            <span className="text-sm font-semibold">{sold30d}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {editingIncoming === product.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  autoFocus
                                  className="w-16 h-7 text-center text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={incomingInputs[product.id] ?? String(incoming)}
                                  onChange={(e) => setIncomingInputs((prev) => ({ ...prev, [product.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { handleIncomingStockSave(product.id); setEditingIncoming(null); }
                                    if (e.key === "Escape") { setEditingIncoming(null); setIncomingInputs((prev) => ({ ...prev, [product.id]: "" })); }
                                  }}
                                  onBlur={() => { if (incomingInputs[product.id] && incomingInputs[product.id] !== String(incoming)) handleIncomingStockSave(product.id); setEditingIncoming(null); }}
                                />
                              </div>
                            ) : (
                              <div
                                className="cursor-pointer min-w-[40px] py-1 rounded hover:bg-muted/60 transition-colors"
                                onDoubleClick={() => { setEditingIncoming(product.id); setIncomingInputs((prev) => ({ ...prev, [product.id]: String(incoming) })); }}
                                title={t("ডাবল ক্লিক করে এডিট করুন", "Double click to edit")}
                              >
                                {incoming > 0 ? (
                                  <Badge variant="outline" className="text-xs font-bold text-emerald-600 border-emerald-300 bg-emerald-50">
                                    <TruckIcon className="w-3 h-3 mr-1" />{incoming}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleStockChange(product.id, product.stock, -1)}
                              disabled={updateStockMutation.isPending}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              placeholder="1"
                              className="w-16 h-8 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={stockInputs[product.id] || ""}
                              onChange={(e) =>
                                setStockInputs((prev) => ({ ...prev, [product.id]: e.target.value }))
                              }
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => handleStockChange(product.id, product.stock, 1)}
                              disabled={updateStockMutation.isPending}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const display = (product as any).stock_out_display;
                            const customText = (product as any).stock_out_custom_text as string | null;
                            const isOnSite = display !== "visible" && display !== "custom";
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <Switch
                                  checked={isOnSite}
                                  disabled={updateStockMutation.isPending}
                                  onCheckedChange={(checked) => {
                                    updateStockMutation.mutate({
                                      id: product.id,
                                      // ON  → hidden (force in-stock even if 0)
                                      // OFF → visible (website shows Stock Out)
                                      updates: { stock_out_display: (checked ? "hidden" : "visible") as any, stock_out_custom_text: null as any },
                                    });
                                  }}
                                />
                                <span className={`text-[10px] font-medium ${isOnSite ? "text-emerald-600" : display === "custom" ? "text-amber-600" : "text-destructive"}`}>
                                  {isOnSite
                                    ? t("স্টক আছে", "In Stock")
                                    : display === "custom"
                                      ? (customText || t("কাস্টম", "Custom"))
                                      : t("স্টক আউট", "Stock Out")}
                                </span>
                                <button
                                  type="button"
                                  className="text-[10px] text-primary underline"
                                  onClick={() => {
                                    const txt = window.prompt(
                                      t("কাস্টম টেক্সট লিখুন (যেমন: প্রি-অর্ডার, শীঘ্রই আসছে)", "Custom text (e.g. Pre-order, Coming soon)"),
                                      customText || "",
                                    );
                                    if (txt === null) return;
                                    const trimmed = txt.trim();
                                    if (!trimmed) {
                                      updateStockMutation.mutate({
                                        id: product.id,
                                        updates: { stock_out_display: "hidden" as any, stock_out_custom_text: null as any },
                                      });
                                    } else {
                                      updateStockMutation.mutate({
                                        id: product.id,
                                        updates: { stock_out_display: "custom" as any, stock_out_custom_text: trimmed as any },
                                      });
                                    }
                                  }}
                                >
                                  {display === "custom" ? t("Edit", "Edit") : t("+ Custom", "+ Custom")}
                                </button>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {stockFilter !== "low" && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      {page + 1} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
