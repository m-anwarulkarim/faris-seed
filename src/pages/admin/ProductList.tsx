import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, Loader2, ChevronLeft, ChevronRight, GripVertical, EyeOff } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

const PAGE_SIZE = 70;

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  tag: string | null;
  regular_price: number;
  offer_price: number | null;
  stock: number;
  reserved_stock?: number;
  position: number;
  product_image: string | null;
  is_hidden?: boolean;
}

function SortableRow({
  product,
  children,
}: {
  product: ProductRow;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" as const : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-accent" : ""}>
      <TableCell className="w-8 px-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  );
}

export default function ProductList() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get("category") || "all");
  const [selectedTag, setSelectedTag] = useState<string>(searchParams.get("tag") || "all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("visible");
  const [page, setPage] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("position").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: countData } = useQuery({
    queryKey: ["products-count", search, selectedCategory, selectedTag, visibilityFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      if (selectedCategory && selectedCategory !== "all") query = query.eq("category", selectedCategory);
      if (selectedTag && selectedTag !== "all") query = query.ilike("tag", `%${selectedTag}%`);
      if (visibilityFilter === "visible") query = query.eq("is_hidden", false);
      else if (visibilityFilter === "hidden") query = query.eq("is_hidden", true);

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const totalCount = countData || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const {
    data: products,
    isLoading,
  } = useQuery({
    queryKey: ["products", search, selectedCategory, selectedTag, visibilityFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      if (selectedCategory && selectedCategory !== "all") query = query.eq("category", selectedCategory);
      if (selectedTag && selectedTag !== "all") query = query.ilike("tag", `%${selectedTag}%`);
      if (visibilityFilter === "visible") query = query.eq("is_hidden", false);
      else if (visibilityFilter === "hidden") query = query.eq("is_hidden", true);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [editingPositionValue, setEditingPositionValue] = useState("");
  const positionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPositionId && positionInputRef.current) {
      positionInputRef.current.focus();
      positionInputRef.current.select();
    }
  }, [editingPositionId]);

  const positionMutation = useMutation({
    mutationFn: async ({ id, position }: { id: string; position: number }) => {
      const { error } = await supabase.from("products").update({ position }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("পজিশন আপডেট হয়েছে", "Position updated"));
      setEditingPositionId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      const promises = updates.map(({ id, position }) =>
        supabase.from("products").update({ position }).eq("id", id)
      );
      const results = await Promise.all(promises);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("ক্রম আপডেট হয়েছে", "Order updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !products) return;

    const oldIndex = products.findIndex((p) => p.id === active.id);
    const newIndex = products.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(products, oldIndex, newIndex);

    // Assign new positions based on order
    const updates = reordered.map((p, i) => ({
      id: p.id,
      position: (page * PAGE_SIZE) + i + 1,
    }));

    // Optimistic update
    queryClient.setQueryData(
      ["products", search, selectedCategory, selectedTag, page],
      reordered.map((p, i) => ({ ...p, position: (page * PAGE_SIZE) + i + 1 }))
    );

    reorderMutation.mutate(updates);
  };

  const handlePositionSave = (id: string) => {
    const val = parseInt(editingPositionValue);
    if (isNaN(val)) { setEditingPositionId(null); return; }
    positionMutation.mutate({ id, position: val });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = JSON.stringify(q.queryKey).toLowerCase();
          return /product|categor|shop|home|inventory|tag-products|related|flash|ghost|top-|review/.test(k);
        },
      });
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("cached-")) localStorage.removeItem(k);
        });
      } catch {}
      toast.success(t("পণ্য মুছে ফেলা হয়েছে", "Product deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSearchParams = (cat: string, tag: string) => {
    const params = new URLSearchParams();
    if (cat && cat !== "all") params.set("category", cat);
    if (tag && tag !== "all") params.set("tag", tag);
    setSearchParams(params, { replace: true });
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setPage(0);
    updateSearchParams(value, selectedTag);
  };
  const handleTagChange = (value: string) => {
    setSelectedTag(value);
    setPage(0);
    updateSearchParams(selectedCategory, value);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/admin/products/create")}>
            <Plus className="w-4 h-4 mr-2" /> {t("নতুন পণ্য", "New Product")}
          </Button>
        </div>
      </div>

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
            <Select value={selectedTag} onValueChange={handleTagChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("ট্যাগ", "Tag")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("সব ট্যাগ", "All Tags")}</SelectItem>
                {tags?.map((tag) => (
                  <SelectItem key={tag.id} value={tag.name}>{tag.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={visibilityFilter} onValueChange={(v) => { setVisibilityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("সব পণ্য", "All Products")}</SelectItem>
                <SelectItem value="visible">{t("দৃশ্যমান", "Visible")}</SelectItem>
                <SelectItem value="hidden">{t("লুকানো", "Hidden")}</SelectItem>
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>{t("ছবি", "Image")}</TableHead>
                      <TableHead>{t("পণ্যের নাম", "Product Name")}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>{t("ক্যাটাগরি", "Category")}</TableHead>
                      <TableHead>{t("ট্যাগ", "Tag")}</TableHead>
                      <TableHead className="text-right">{t("মূল্য", "Price")}</TableHead>
                      <TableHead className="text-right">{t("স্টক", "Stock")}</TableHead>
                      <TableHead className="text-right">{t("অ্যাকশন", "Action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext items={products.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {products.map((product) => (
                        <SortableRow key={product.id} product={product}>
                          <TableCell
                            className="text-center font-bold text-muted-foreground cursor-pointer select-none"
                            onDoubleClick={() => {
                              setEditingPositionId(product.id);
                              setEditingPositionValue(String(product.position || 0));
                            }}
                            title={t("ডাবল ক্লিক করে পজিশন এডিট করুন", "Double click to edit position")}
                          >
                            {editingPositionId === product.id ? (
                              <Input
                                ref={positionInputRef}
                                type="number"
                                className="w-16 h-7 text-center text-xs p-1"
                                value={editingPositionValue}
                                onChange={(e) => setEditingPositionValue(e.target.value)}
                                onBlur={() => handlePositionSave(product.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handlePositionSave(product.id);
                                  if (e.key === "Escape") setEditingPositionId(null);
                                }}
                              />
                            ) : (
                              product.position || 0
                            )}
                          </TableCell>
                          <TableCell>
                            {product.product_image ? (
                              <img src={product.product_image} alt={product.name} className="w-10 h-10 rounded-md object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            <span className="flex items-center gap-1.5">
                              {(product as any).is_hidden && <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                              {product.name}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                          <TableCell>{product.category && <Badge variant="outline">{product.category}</Badge>}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{product.tag || "—"}</TableCell>
                          <TableCell className="text-right">
                            {product.offer_price ? (
                              <div>
                                <span className="line-through text-muted-foreground text-xs mr-1">৳{product.regular_price}</span>
                                <span className="text-primary font-semibold">৳{product.offer_price}</span>
                              </div>
                            ) : (
                              <span className="font-semibold">৳{product.regular_price}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const available = (product.stock || 0) - (product.reserved_stock || 0);
                              return <Badge variant={available > 0 ? "default" : "destructive"}>{available}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={(e) => {
                                if (e.ctrlKey || e.metaKey || e.button === 1) {
                                  window.open(`/admin/products/edit/${product.id}?${searchParams.toString()}`, '_blank');
                                } else {
                                  navigate(`/admin/products/edit/${product.id}?${searchParams.toString()}`);
                                }
                              }}
                              onAuxClick={(e) => {
                                if (e.button === 1) {
                                  e.preventDefault();
                                  window.open(`/admin/products/edit/${product.id}?${searchParams.toString()}`, '_blank');
                                }
                              }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t("পণ্য মুছে ফেলুন?", "Delete product?")}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      "{product.name}" {t("মুছে ফেলা হবে। এটি ফেরত আনা যাবে না।", "will be deleted. This cannot be undone.")}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(product.id)}>
                                      {t("মুছে ফেলুন", "Delete")}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </SortableRow>
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </DndContext>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    {t("পৃষ্ঠা", "Page")} {page + 1} / {totalPages} ({totalCount} {t("পণ্য", "products")})
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i).map((p) => (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="w-9"
                        onClick={() => setPage(p)}
                      >
                        {p + 1}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => p + 1)}
                    >
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
