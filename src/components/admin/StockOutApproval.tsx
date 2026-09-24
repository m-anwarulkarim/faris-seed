import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertOctagon, Check, X, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";

type PendingProduct = {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  product_image: string | null;
  alert_sent_at: string | null;
};

/**
 * Stock-Out Approval Card
 * Shows products whose available stock has hit 0 but admin hasn't decided yet
 * whether to display "Stock Out" on the website.
 *
 * GUARANTEES:
 *  - Stock just hit 0 → product NOT marked stock-out (default 'hidden')
 *  - Admin clicks "না" → stock_out_display stays 'hidden' → product stays available
 *  - Admin clicks "হ্যাঁ" → stock_out_display becomes 'visible' → website shows Stock Out
 */
export default function StockOutApproval() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: ["stock-out-pending"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_stock_out_pending_products");
      if (error) throw error;
      return (data || []) as PendingProduct[];
    },
    refetchInterval: 60_000,
  });

  const decide = useMutation({
    mutationFn: async ({ productId, decision, customText }: { productId: string; decision: "visible" | "hidden" | "custom"; customText?: string }) => {
      // 'visible' → website shows "Stock Out"
      // 'hidden'  → admin dismissed; keep selling
      // 'custom'  → website shows admin's custom text
      const payload: Record<string, any> = { stock_out_display: decision };
      if (decision === "custom") payload.stock_out_custom_text = customText || null;
      else payload.stock_out_custom_text = null;
      const { error } = await supabase
        .from("products")
        .update(payload as any)
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(
        vars.decision === "visible"
          ? t("Stock Out দেখানো হবে", "Will show Stock Out")
          : t("Stock Out দেখানো হবে না", "Will NOT show Stock Out"),
      );
      queryClient.invalidateQueries({ queryKey: ["stock-out-pending"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Update failed");
    },
  });

  if (isLoading || !pending || pending.length === 0) return null;

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-destructive" />
          <h3 className="font-bold text-base">
            {t("Stock-Out Approval বাকি", "Stock-Out Approval Pending")}
            <Badge variant="destructive" className="ml-2">{pending.length}</Badge>
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "এই পণ্যগুলোর স্টক শেষ। Website-এ Stock Out দেখাবেন কি না?",
            "These products are out of stock. Show 'Stock Out' on website?",
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {pending.map((p) => {
          const busy = decide.isPending && decide.variables?.productId === p.product_id;
          return (
            <div
              key={p.product_id}
              className="flex items-center gap-3 p-2 rounded-lg bg-background border"
            >
              {p.product_image ? (
                <img
                  src={p.product_image}
                  alt={p.product_name}
                  className="w-10 h-10 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.product_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("বিক্রয়যোগ্য", "Available")}: <span className="font-semibold">{p.available_stock}</span>
                  {p.product_sku && <span className="ml-2 opacity-70">SKU: {p.product_sku}</span>}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => decide.mutate({ productId: p.product_id, decision: "visible" })}
                  className="h-8"
                >
                  {busy && decide.variables?.decision === "visible" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  {t("হ্যাঁ", "Yes")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    const txt = window.prompt(t("কাস্টম টেক্সট লিখুন (যেমন: প্রি-অর্ডার চলছে, শীঘ্রই আসছে)", "Custom text (e.g. Pre-order, Coming soon)"), "");
                    if (txt && txt.trim()) decide.mutate({ productId: p.product_id, decision: "custom", customText: txt.trim() });
                  }}
                  className="h-8"
                >
                  {t("কাস্টম", "Custom")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => decide.mutate({ productId: p.product_id, decision: "hidden" })}
                  className="h-8"
                >
                  {busy && decide.variables?.decision === "hidden" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5 mr-1" />
                  )}
                  {t("না", "No")}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
