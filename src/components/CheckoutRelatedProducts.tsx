import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Sparkles, Timer } from "lucide-react";
import { toast } from "sonner";
import { productAlt } from "@/lib/seoAlt";

const COUNTDOWN_KEY = "checkout_offers_deadline_v1";
const COUNTDOWN_MS = 15 * 60 * 1000;

function useCheckoutCountdown(enabled: boolean) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let deadline = Number(localStorage.getItem(COUNTDOWN_KEY) || 0);
    if (!deadline || deadline < Date.now()) {
      deadline = Date.now() + COUNTDOWN_MS;
      localStorage.setItem(COUNTDOWN_KEY, String(deadline));
    }
    const tick = () => {
      const left = deadline - Date.now();
      if (left <= 0) {
        setRemaining(0);
        localStorage.removeItem(COUNTDOWN_KEY);
      } else {
        setRemaining(left);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [enabled]);
  const totalSec = Math.ceil(remaining / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return { active: remaining > 0, mm, ss };
}


type RP = {
  id: string;
  name: string;
  slug: string | null;
  product_image: string | null;
  regular_price: number;
  offer_price: number | null;
  category: string | null;
  stock: number;
  short_description: string | null;
  variant_label: string | null;
  variants: string[] | null;
};

export default function CheckoutRelatedProducts() {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const [products, setProducts] = useState<RP[]>([]);
  const [discountMap, setDiscountMap] = useState<Record<string, { type: "flat" | "percent"; value: number }>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cartIds = items.map((i) => i.id.split("::")[0]);

      // 1) Check if any cart product has admin-curated related offer products
      let curatedIds: string[] = [];
      const mergedDiscounts: Record<string, { type: "flat" | "percent"; value: number }> = {};
      if (cartIds.length > 0) {
        const { data: cartProducts } = await supabase
          .from("products")
          .select("id, related_offer_product_ids, related_offer_discounts")
          .in("id", cartIds);
        const seen = new Set<string>();
        (cartProducts || []).forEach((cp: any) => {
          const ids: string[] = Array.isArray(cp.related_offer_product_ids) ? cp.related_offer_product_ids : [];
          const discs = cp.related_offer_discounts && typeof cp.related_offer_discounts === "object" ? cp.related_offer_discounts : {};
          ids.forEach((id) => {
            if (!cartIds.includes(id) && !seen.has(id)) {
              seen.add(id);
              curatedIds.push(id);
            }
            // First non-empty discount wins (earlier cart items have priority)
            if (discs[id] && !mergedDiscounts[id] && Number(discs[id].value) > 0) {
              mergedDiscounts[id] = { type: discs[id].type === "percent" ? "percent" : "flat", value: Number(discs[id].value) };
            }
          });
        });
      }

      const SELECT = "id, name, slug, product_image, regular_price, offer_price, category, stock, short_description, variant_label, variants";

      if (curatedIds.length > 0) {
        const { data: curated } = await supabase
          .from("products")
          .select(SELECT)
          .in("id", curatedIds)
          .eq("is_hidden", false)
          .gt("stock", 0);
        if (curated && curated.length > 0) {
          // Preserve admin-chosen order
          const ordered = curatedIds
            .map((id) => curated.find((p) => p.id === id))
            .filter(Boolean) as RP[];
          if (!cancelled) {
            setProducts(ordered.slice(0, 3));
            setDiscountMap(mergedDiscounts);
          }
          return;
        }
      }

      // Fallback: auto offer products (same-category first)
      const categories = Array.from(
        new Set(
          items
            .map((i) => (i as any).category)
            .filter((c): c is string => !!c)
        )
      );

      let query = supabase
        .from("products")
        .select(SELECT)
        .eq("is_hidden", false)
        .eq("stock_out_display", "hidden")
        .gt("stock", 0)
        .not("offer_price", "is", null)
        .order("position", { ascending: true })
        .limit(12);

      if (categories.length) {
        query = query.in("category", categories);
      }

      let { data } = await query;

      if (!data || data.length < 3) {
        const { data: fallback } = await supabase
          .from("products")
          .select(SELECT)
          .eq("is_hidden", false)
          .eq("stock_out_display", "hidden")
          .gt("stock", 0)
          .not("offer_price", "is", null)
          .order("position", { ascending: true })
          .limit(12);
        data = fallback || [];
      }

      const filtered = (data || [])
        .filter((p) => !cartIds.includes(p.id))
        .slice(0, 3);

      if (!cancelled) setProducts(filtered);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxPct = useMemo(() => {
    let max = 0;
    for (const p of products) {
      const hasOffer = p.offer_price && p.offer_price < p.regular_price;
      const basePrice = hasOffer ? p.offer_price! : p.regular_price;
      const extra = discountMap[p.id];
      const price = extra && extra.value > 0
        ? Math.max(1, extra.type === "percent"
            ? Math.round(basePrice * (1 - extra.value / 100))
            : basePrice - extra.value)
        : basePrice;
      if (p.regular_price > 0) {
        const pct = Math.round(((p.regular_price - price) / p.regular_price) * 100);
        if (pct > max) max = pct;
      }
    }
    return Math.min(50, max);
  }, [products, discountMap]);

  const { active: timerActive, mm, ss } = useCheckoutCountdown(products.length > 0);

  if (products.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="space-y-2">
        <h2 className="font-display font-bold text-foreground flex items-start gap-2 leading-snug">
          <Sparkles className="w-4 h-4 text-amber-500 mt-1 flex-shrink-0" />
          <span>
            {maxPct > 0 ? "সর্বোচ্চ 50% এক্সট্রা ডিসকাউন্ট রয়েছে এই প্রোডাক্টগুলোতে" : "এই অফারগুলোও দেখুন"}
          </span>
        </h2>
        {timerActive && (
          <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-300/60 dark:border-amber-800/60">
            <Timer className="w-3.5 h-3.5" />
            <span className="tabular-nums">{mm}:{ss.toString().padStart(2, "0")}</span>
            <span className="font-normal opacity-80">— অফার শেষ হবে</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {products.map((p) => {
          const hasOffer = p.offer_price && p.offer_price < p.regular_price;
          const basePrice = hasOffer ? p.offer_price! : p.regular_price;
          const extra = discountMap[p.id];
          const price = extra && extra.value > 0
            ? Math.max(1, extra.type === "percent"
                ? Math.round(basePrice * (1 - extra.value / 100))
                : basePrice - extra.value)
            : basePrice;
          const hasExtra = price < basePrice;
          const discount = Math.round(((p.regular_price - price) / p.regular_price) * 100);
          return (
            <div
              key={p.id}
              className="relative rounded-xl border border-border bg-background p-2 flex sm:flex-col gap-2"
            >
              {discount > 0 && (
                <span className="absolute top-1.5 left-1.5 z-10 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  −{discount}%
                </span>
              )}
              {hasExtra && (
                <span className="absolute top-1.5 right-1.5 z-10 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                  EXTRA
                </span>
              )}
              <img
                src={p.product_image || "/placeholder.svg"}
                alt={productAlt(p.name)}
                className="w-20 h-20 sm:w-full sm:h-28 object-cover rounded-lg flex-shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0 flex flex-col">
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                  {p.name}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-primary">৳{price}</span>
                  {(hasOffer || hasExtra) && (
                    <span className="text-[11px] text-muted-foreground line-through">
                      ৳{p.regular_price}
                    </span>
                  )}
                </div>
                {(() => {
                  const cartItem = items.find((i) => i.id === p.id || i.id.startsWith(`${p.id}::`));
                  const qty = cartItem?.quantity || 0;
                  if (qty === 0) {
                    return (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-8 text-xs"
                        onClick={() => {
                          const firstVariant = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants[0] : null;
                          addItem({
                            id: firstVariant ? `${p.id}::${firstVariant}` : p.id,
                            name: firstVariant ? `${p.name} (${firstVariant})` : p.name,
                            price: Number(price),
                            oldPrice: (hasOffer || hasExtra) ? Number(p.regular_price) : undefined,
                            image: p.product_image || "/placeholder.svg",
                            shortDescription: null,
                          });
                          toast.success("কার্টে যোগ হয়েছে");
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> যোগ করুন
                      </Button>
                    );
                  }
                  return (
                    <div className="mt-2 flex items-center justify-between gap-1 h-8 rounded-md border border-border bg-background overflow-hidden">
                      <button
                        type="button"
                        onClick={() => cartItem && (qty <= 1 ? removeItem(cartItem.id) : updateQuantity(cartItem.id, qty - 1))}
                        className="px-2 h-full hover:bg-muted active:scale-95 transition"
                        aria-label="কমান"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-semibold tabular-nums">{qty}</span>
                      <button
                        type="button"
                        onClick={() => cartItem && updateQuantity(cartItem.id, qty + 1)}
                        className="px-2 h-full hover:bg-muted active:scale-95 transition"
                        aria-label="বাড়ান"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
