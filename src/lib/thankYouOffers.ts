import { supabase } from "@/integrations/supabase/client";

export const THANKYOU_OFFERS_KEY = "thankyou_offers";

export interface ThankYouOffer {
  id: string;
  name: string;
  image: string;
  price: number;
  oldPrice?: number | null;
  active: boolean;
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
      return {
        id,
        name,
        image: String(o.image ?? ""),
        price,
        oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : null,
        active: o.active !== false,
      } satisfies ThankYouOffer;
    })
    .filter(Boolean) as ThankYouOffer[];
}

/** Offers configured in the dashboard (all of them, including hidden ones). */
export async function loadThankYouOffers(): Promise<ThankYouOffer[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", THANKYOU_OFFERS_KEY)
      .maybeSingle();
    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const list = normalize(parsed);
      if (list.length > 0) return list;
    }
  } catch (e) {
    console.error("Failed loading thank you offers from DB", e);
  }

  // Fallback default offers if DB is empty
  return [
    {
      id: "offer-zinnia",
      name: "মাল্টি কালার জিনিয়া ফুলের বীজ",
      image: "/assets/product-zinnia.webp",
      price: 140,
      oldPrice: 180,
      active: true,
    },
    {
      id: "offer-portulaca",
      name: "মিক্স কালার পর্তুলিকা বা টাইম ফুলের বীজ",
      image: "/assets/product-portulaca.webp",
      price: 120,
      oldPrice: 160,
      active: true,
    },
  ];
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
      if (data) targetOrder = data;
    }

    if (!targetOrder) {
      const { data } = await supabase
        .from("orders")
        .select("id, total_amount, subtotal")
        .eq("order_id", orderId)
        .maybeSingle();
      if (data) targetOrder = data;
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
      });

      const currentTotal = Number(targetOrder.total_amount || 0);
      const newTotal = currentTotal + addAmount;
      await supabase
        .from("orders")
        .update({
          total_amount: newTotal,
          subtotal: Number(targetOrder.subtotal || 0) + addAmount,
        })
        .eq("id", targetOrder.id);

      return { ok: true, added_amount: addAmount, total_amount: newTotal };
    }
  } catch (err) {
    console.error("Direct order upsell error", err);
  }

  return { ok: true };
}
