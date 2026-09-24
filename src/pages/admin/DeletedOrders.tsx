import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Loader2, Trash2, Undo2, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

export default function DeletedOrders() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [search]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["deleted-orders", search],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(id, product_name, quantity)")
        .eq("is_deleted", true)
        .order("updated_at", { ascending: false });
      if (search)
        query = query.or(
          `order_id.ilike.%${search}%,customer_facing_id.ilike.%${search}%,customer_name.ilike.%${search}%,phone.ilike.%${search}%`
        );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("orders")
        .update({ is_deleted: false } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-orders"] });
      queryClient.invalidateQueries({ queryKey: ["web-orders"] });
      queryClient.invalidateQueries({ queryKey: ["confirmed-orders"] });
      toast.success(t("অর্ডার রিস্টোর হয়েছে", "Orders restored"));
      setSelected([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete order items first, then orders
      for (const oid of ids) {
        await supabase.from("order_items").delete().eq("order_id", oid);
      }
      const { error } = await supabase.from("orders").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deleted-orders"] });
      toast.success(t("অর্ডার স্থায়ীভাবে মুছে ফেলা হয়েছে", "Orders permanently deleted"));
      setSelected([]);
      setShowDeleteConfirm(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (!orders) return;
    if (selected.length === orders.length) {
      setSelected([]);
    } else {
      setSelected(orders.map((o) => o.id));
    }
  };

  return (
    <div className="space-y-4">

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("অর্ডার আইডি, নাম বা মোবাইল...", "Order ID, name or mobile...")}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {selected.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selected.length} {t("টি সিলেক্টেড", " selected")}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => restoreMutation.mutate(selected)}
                  disabled={restoreMutation.isPending}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  {t("রিস্টোর", "Restore")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={permanentDeleteMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("স্থায়ীভাবে মুছুন", "Permanently Delete")}
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
              <Trash2 className="w-12 h-12 mb-3 opacity-40" />
              <p>{t("কোনো ডিলিটেড অর্ডার নেই", "No deleted orders")}</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.length === orders.length && orders.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>{t("অর্ডার আইডি", "Order ID")}</TableHead>
                    <TableHead>{t("নাম", "Name")}</TableHead>
                    <TableHead>{t("ফোন", "Phone")}</TableHead>
                    <TableHead>{t("আইটেম", "Items")}</TableHead>
                    <TableHead className="text-right">{t("মোট", "Total")}</TableHead>
                    <TableHead>{t("স্ট্যাটাস", "Status")}</TableHead>
                    <TableHead>{t("সময়", "Time")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((o: any) => (
                    <TableRow key={o.id} className={selected.includes(o.id) ? "bg-muted/50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(o.id)}
                          onCheckedChange={() => toggleSelect(o.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold">{o.customer_facing_id || o.order_id}</TableCell>
                      <TableCell className="font-medium">{o.customer_name}</TableCell>
                      <TableCell className="font-mono text-sm">{o.phone}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {o.order_items?.length || 0} {t("টি আইটেম", " items")}
                      </TableCell>
                      <TableCell className="text-right font-semibold">৳{o.total_amount}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">{o.status}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(o.updated_at), { addSuffix: true, locale: bn })}
                      </TableCell>
                    </TableRow>
                  ))}
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("স্থায়ীভাবে মুছে ফেলবেন?", "Permanently delete?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `${selected.length}টি অর্ডার স্থায়ীভাবে মুছে ফেলা হবে। এটি আর ফেরত আনা যাবে না।`,
                `${selected.length} order(s) will be permanently deleted. This cannot be undone.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => permanentDeleteMutation.mutate(selected)}
            >
              {t("হ্যাঁ, মুছে ফেলুন", "Yes, Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
