import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  Loader2, PackageCheck, Undo2, Minus, Plus, Check,
} from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  dbId: string;
  orderId: string;
  customerName: string;
};

type ItemAllocation = {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  delivered_qty: number;
  returned_qty: number;
  marked: boolean; // whether user has explicitly marked this item
};

export function PartialDeliveryDialog({ open, onClose, dbId, orderId, customerName }: Props) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ItemAllocation[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: orderItems, isLoading } = useQuery({
    queryKey: ["partial-delivery-items", dbId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, product_id, product_name, product_image, quantity")
        .eq("order_id", dbId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!dbId,
  });

  useEffect(() => {
    if (orderItems) {
      setItems(orderItems.map(item => ({
        ...item,
        delivered_qty: 0,
        returned_qty: 0,
        marked: false,
      })));
    }
  }, [orderItems]);

  const allMarked = items.length > 0 && items.every(i => i.marked && i.delivered_qty + i.returned_qty === i.quantity);

  // For qty=1: toggle between delivered/returned
  const markAsDelivered = (idx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, delivered_qty: item.quantity, returned_qty: 0, marked: true };
    }));
  };

  const markAsReturned = (idx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, delivered_qty: 0, returned_qty: item.quantity, marked: true };
    }));
  };

  // For qty>1: adjust delivered count
  const adjustDelivered = (idx: number, delta: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newDel = Math.max(0, Math.min(item.quantity, item.delivered_qty + delta));
      return {
        ...item,
        delivered_qty: newDel,
        returned_qty: item.quantity - newDel,
        marked: true,
      };
    }));
  };

  const handleConfirm = async () => {
    if (!allMarked) return;
    setSaving(true);
    try {
      // 1. Update each order_item's delivered/returned qty
      for (const item of items) {
        await supabase
          .from("order_items")
          .update({
            delivered_qty: item.delivered_qty,
            returned_qty: item.returned_qty,
          } as any)
          .eq("id", item.id);
      }

      // 2. Deduct stock for delivered items only
      for (const item of items) {
        if (item.delivered_qty > 0) {
          const { data: product } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .single();
          if (product) {
            await supabase
              .from("products")
              .update({ stock: Math.max(0, product.stock - item.delivered_qty) })
              .eq("id", item.product_id);
          }
        }
      }

      // 3. Update order status to partial_delivered
      await supabase
        .from("orders")
        .update({ status: "partial_delivered", delivery_status: "partial_delivered" })
        .eq("id", dbId);

      // 4. Log status history
      const { data: session } = await supabase.auth.getSession();
      const adminId = session?.session?.user?.id || null;
      await supabase.from("order_status_history").insert({
        order_id: dbId,
        status: "partial_delivered",
        changed_by: adminId,
        changed_by_name: session?.session?.user?.email || "Admin",
      });

      toast.success(t("পার্শিয়াল ডেলিভারি সম্পন্ন — স্টক আপডেট হয়েছে", "Partial delivery completed — stock updated"));
      onClose();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["courier-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["courier-all-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["partial-delivery-items"] }),
      ]);
    } catch (err: any) {
      toast.error(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            {t("পার্শিয়াল ডেলিভারি", "Partial Delivery")} — {orderId}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {customerName} — {t("প্রতিটি প্রোডাক্ট ডেলিভারি বা রিটার্ন মার্ক করুন", "Mark each product as delivered or returned")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {items.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                {/* Product info */}
                <div className="flex items-center gap-2">
                  {item.product_image && (
                    <img
                      src={item.product_image}
                      alt={item.product_name}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("মোট", "Total")}: {item.quantity} {t("পিস", "pcs")}
                    </p>
                  </div>
                  {item.marked && (
                    <Badge variant="outline" className="shrink-0 text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                      <Check className="w-3 h-3" />
                      {t("মার্কড", "Marked")}
                    </Badge>
                  )}
                </div>

                {/* Controls */}
                {item.quantity === 1 ? (
                  /* Single qty: simple toggle buttons */
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={item.delivered_qty === 1 ? "default" : "outline"}
                      className={`flex-1 gap-1 text-xs h-8 ${item.delivered_qty === 1 ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                      onClick={() => markAsDelivered(idx)}
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      {t("ডেলিভারি", "Delivered")}
                    </Button>
                    <Button
                      size="sm"
                      variant={item.returned_qty === 1 ? "default" : "outline"}
                      className={`flex-1 gap-1 text-xs h-8 ${item.returned_qty === 1 ? "bg-red-600 hover:bg-red-700" : ""}`}
                      onClick={() => markAsReturned(idx)}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      {t("রিটার্ন", "Return")}
                    </Button>
                  </div>
                ) : (
                  /* Multi qty: +/- controls */
                  <div className="space-y-1.5">
                    {/* Quick toggle row */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={item.delivered_qty === item.quantity ? "default" : "outline"}
                        className={`flex-1 gap-1 text-xs h-7 ${item.delivered_qty === item.quantity ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                        onClick={() => markAsDelivered(idx)}
                      >
                        <PackageCheck className="w-3 h-3" />
                        {t("সব ডেলিভারি", "All Delivered")}
                      </Button>
                      <Button
                        size="sm"
                        variant={item.returned_qty === item.quantity ? "default" : "outline"}
                        className={`flex-1 gap-1 text-xs h-7 ${item.returned_qty === item.quantity ? "bg-red-600 hover:bg-red-700" : ""}`}
                        onClick={() => markAsReturned(idx)}
                      >
                        <Undo2 className="w-3 h-3" />
                        {t("সব রিটার্ন", "All Return")}
                      </Button>
                    </div>

                    {/* Qty adjuster */}
                    <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-700 font-medium">{t("ডেলিভারি", "Delivered")}:</span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() => adjustDelivered(idx, -1)}
                            disabled={item.delivered_qty <= 0}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">{item.delivered_qty}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6"
                            onClick={() => adjustDelivered(idx, 1)}
                            disabled={item.delivered_qty >= item.quantity}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-700 font-medium">{t("রিটার্ন", "Return")}:</span>
                        <span className="text-sm font-bold text-red-700">{item.returned_qty}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Confirm button */}
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!allMarked || saving}
              onClick={handleConfirm}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              {t("পার্শিয়াল ডেলিভারি কনফার্ম করুন", "Confirm Partial Delivery")}
            </Button>

            {!allMarked && items.length > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                {t("সবগুলো প্রোডাক্ট মার্ক করুন", "Mark all products to continue")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
