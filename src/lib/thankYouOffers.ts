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
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", THANKYOU_OFFERS_KEY)
    .maybeSingle();
  if (!data?.value) return [];
  try {
    const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return normalize(parsed);
  } catch {
    return [];
  }
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
export async function addOfferToOrder(orderId: string, offerId: string, quantity = 1) {
  const { data, error } = await supabase.rpc("add_order_upsell", {
    p_order_id: orderId,
    p_offer_id: offerId,
    p_quantity: quantity,
  });
  if (error) throw error;
  return (data ?? { ok: false, error: "unknown" }) as unknown as AddUpsellResult;
}
