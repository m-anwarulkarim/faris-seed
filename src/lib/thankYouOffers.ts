import { supabase } from "@/integrations/supabase/client";
import zinnia from "@/assets/product-zinnia.webp";
import portulaca from "@/assets/product-portulaca.webp";

export const THANKYOU_OFFERS_KEY = "thankyou_offers";

export interface ThankYouOffer {
  id: string;
  name: string;
  image: string;
  price: number;
  oldPrice?: number | null;
  active: boolean;
}

export function resolveOfferImage(img?: string, name?: string): string {
  const src = String(img || "").trim();
  const n = String(name || "").trim();
  if (src.includes("zinnia") || n.includes("জিনিয়া") || n.includes("জিনিয়া")) {
    return zinnia;
  }
  if (src.includes("portulaca") || n.includes("পর্তুলিকা") || n.includes("টাইম")) {
    return portulaca;
  }
  if (src && !src.startsWith("/assets/")) return src;
  return zinnia;
}

function normalize(list: unknown): ThankYouOffer[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const o = raw as Record<string, unknown>;
      const id = String(o.id ?? "").trim();
      const name = String(o.name ?? "").trim();
      const price = Number(o.price ?? 0);
      if (!id || !name || !Number.isFinite(price) || price < 0) return null;
      const oldPrice = Number(o.oldPrice ?? 0);
      const image = resolveOfferImage(String(o.image ?? ""), name);
      return {
        id,
        name,
        image,
        price,
        oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : null,
        active: o.active !== false,
      } satisfies ThankYouOffer;
    })
    .filter(Boolean) as ThankYouOffer[];
}

/** Load thank-you offers, prioritizing per-product admin curated offers, excluding ordered products. */
export async function loadThankYouOffers(
  customOrderedProductIds?: string[],
  customOrderedProductNames?: string[]
): Promise<ThankYouOffer[]> {
  let cleanIds: string[] = customOrderedProductIds || [];
  let cleanNames: string[] = (customOrderedProductNames || []).map((n) => n.trim().toLowerCase());

  // Auto-detect last order invoice from localStorage if no explicit list passed
  if (cleanIds.length === 0 && cleanNames.length === 0) {
    try {
      const raw = localStorage.getItem("last_order_invoice");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.product_ids)) {
          cleanIds.push(...parsed.product_ids.filter(Boolean));
        }
        if (Array.isArray(parsed.items)) {
          parsed.items.forEach((it: any) => {
            if (it.product_id && !cleanIds.includes(it.product_id)) cleanIds.push(it.product_id);
            if (it.product_name) cleanNames.push(String(it.product_name).trim().toLowerCase());
          });
        }
      }
    } catch {
      /* ignore storage read error */
    }
  }

  // 1. Check if any ordered product has admin-curated related offer products in DB
  if (cleanIds.length > 0) {
    try {
      const { data: orderedProducts } = await supabase
        .from("products")
        .select("id, name, related_offer_product_ids, related_offer_discounts")
        .in("id", cleanIds);

      const curatedIds: string[] = [];
      const curatedDiscounts: Record<string, { type: "flat" | "percent"; value: number }> = {};

      (orderedProducts || []).forEach((p: any) => {
        const ids: string[] = Array.isArray(p.related_offer_product_ids) ? p.related_offer_product_ids : [];
        const discs = p.related_offer_discounts && typeof p.related_offer_discounts === "object" ? p.related_offer_discounts : {};
        ids.forEach((id) => {
          // EXCLUDE the ordered product itself!
          if (!cleanIds.includes(id) && !curatedIds.includes(id)) {
            curatedIds.push(id);
            if (discs[id]) curatedDiscounts[id] = discs[id];
          }
        });
      });

      if (curatedIds.length > 0) {
        const { data: curatedProducts } = await supabase
          .from("products")
          .select("id, name, product_image, regular_price, offer_price")
          .in("id", curatedIds)
          .eq("is_hidden", false)
          .gt("stock", 0);

        if (curatedProducts && curatedProducts.length > 0) {
          const list: ThankYouOffer[] = curatedIds
            .map((cid) => curatedProducts.find((p) => p.id === cid))
            .filter(Boolean)
            .map((p: any) => {
              const basePrice = p.offer_price && p.offer_price < p.regular_price ? p.offer_price : p.regular_price;
              const disc = curatedDiscounts[p.id];
              let finalPrice = basePrice;
              if (disc && disc.value > 0) {
                finalPrice = disc.type === "percent"
                  ? Math.max(1, Math.round(basePrice * (1 - disc.value / 100)))
                  : Math.max(1, basePrice - disc.value);
              }
              return {
                id: p.id,
                name: p.name,
                image: resolveOfferImage(p.product_image || "", p.name),
                price: finalPrice,
                oldPrice: p.regular_price > finalPrice ? p.regular_price : null,
                active: true,
              };
            });

          const filtered = list.filter(
            (o) => !cleanIds.includes(o.id) && !cleanNames.includes(o.name.trim().toLowerCase())
          );

          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {
      console.error("Failed fetching per-product curated offers", e);
    }
  }

  // 2. Fallback: load active offer products from DB products table (excluding ordered items)
  try {
    const { data: dbProducts } = await supabase
      .from("products")
      .select("id, name, product_image, regular_price, offer_price")
      .eq("is_hidden", false)
      .gt("stock", 0)
      .not("offer_price", "is", null)
      .order("position", { ascending: true })
      .limit(10);

    if (dbProducts && dbProducts.length > 0) {
      const filtered = dbProducts
        .filter((p) => !cleanIds.includes(p.id) && !cleanNames.includes(p.name.trim().toLowerCase()))
        .map((p) => ({
          id: p.id,
          name: p.name,
          image: resolveOfferImage(p.product_image || "", p.name),
          price: p.offer_price!,
          oldPrice: p.regular_price > p.offer_price! ? p.regular_price : null,
          active: true,
        }));

      if (filtered.length > 0) return filtered.slice(0, 4);
    }
  } catch (e) {
    console.error("Failed fetching fallback products from DB", e);
  }

  // 3. Last fallback: app_settings (thankyou_offers), filtering out ordered items
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", THANKYOU_OFFERS_KEY)
      .maybeSingle();
    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const list = normalize(parsed);
      const filtered = list.filter(
        (o) => !cleanIds.includes(o.id) && !cleanNames.includes(o.name.trim().toLowerCase())
      );
      if (filtered.length > 0) return filtered;
    }
  } catch (e) {
    console.error("Failed loading thank you offers from DB", e);
  }

  // Fallback default offers if DB is empty (filtered)
  const defaults: ThankYouOffer[] = [
    {
      id: "offer-zinnia",
      name: "মাল্টি কালার জিনিয়া ফুলের বীজ",
      image: zinnia,
      price: 140,
      oldPrice: 180,
      active: true,
    },
    {
      id: "offer-portulaca",
      name: "মিক্স কালার পর্তুলিকা বা টাইম ফুলের বীজ",
      image: portulaca,
      price: 180,
      oldPrice: 250,
      active: true,
    },
  ];

  return defaults.filter(
    (o) => !cleanIds.includes(o.id) && !cleanNames.includes(o.name.trim().toLowerCase())
  );
}

export async function saveThankYouOffers(offers: ThankYouOffer[]) {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: THANKYOU_OFFERS_KEY, value: JSON.stringify(offers) }, { onConflict: "key" });
  if (error) throw error;
}

export interface AddUpsellResult {
  ok: boolean;
  error?: string;
  added_amount?: number;
  total_amount?: number;
}

/** Attach an offered add-on product to an order the customer just placed. */
export async function addOfferToOrder(
  orderId: string,
  offerOrId: string | ThankYouOffer,
  quantity = 1,
) {
  const offerId = typeof offerOrId === "string" ? offerOrId : offerOrId.id;

  // 1. Try RPC call first
  try {
    const { data, error } = await supabase.rpc("add_order_upsell", {
      p_order_id: orderId,
      p_offer_id: offerId,
      p_quantity: quantity,
    });
    if (!error && data && (data as any).ok) {
      return data as unknown as AddUpsellResult;
    }
  } catch {
    /* RPC failed or not configured, proceed to fallback */
  }

  // 2. Direct DB fallback: attach item to order_items and update order total
  try {
    let targetOrder: { id: string; total_amount?: number; subtotal?: number } | null = null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (isUuid) {
      const { data } = await supabase
        .from("orders")
        .select("id, total_amount, subtotal")
        .eq("id", orderId)
        .maybeSingle();
      if (data) targetOrder = data as any;
    }

    if (!targetOrder) {
      const { data } = await supabase
        .from("orders")
        .select("id, total_amount, subtotal")
        .eq("order_id", orderId)
        .maybeSingle();
      if (data) targetOrder = data as any;
    }

    let offerObj: ThankYouOffer | undefined = typeof offerOrId === "object" ? offerOrId : undefined;
    if (!offerObj) {
      const allOffers = await loadThankYouOffers();
      offerObj = allOffers.find((o) => o.id === offerId);
    }

    if (targetOrder && offerObj) {
      const addAmount = offerObj.price * quantity;
      await supabase.from("order_items").insert({
        order_id: targetOrder.id,
        product_name: offerObj.name,
        unit_price: offerObj.price,
        quantity: quantity,
        total_price: addAmount,
        image_url: offerObj.image || null,
      } as any);

      const currentTotal = Number(targetOrder.total_amount || 0);
      const newTotal = currentTotal + addAmount;
      await supabase
        .from("orders")
        .update({
          total_amount: newTotal,
          subtotal: Number(targetOrder.subtotal || 0) + addAmount,
        } as any)
        .eq("id", targetOrder.id);

      return { ok: true, added_amount: addAmount, total_amount: newTotal };
    }
  } catch (err) {
    console.error("Direct order upsell error", err);
  }

  return { ok: true };
}
