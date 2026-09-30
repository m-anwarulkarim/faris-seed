/** Bundle (combo) pricing for product landing pages: 1 / 2 / 3 packs. */
export interface PackOffer {
  quantity: number;
  price: number;
  /** What the same amount of packs would cost without the combo discount. */
  regularPrice: number;
  saving: number;
  label: string;
  badge?: string;
  /** Delivery charge for this pack option (0 = free) */
  delivery_charge?: number;
}

/** Shape stored in products.pack_options (JSONB) */
export interface PackOptionRow {
  quantity: number;
  label: string;
  price: number;
  delivery_charge: number;
  badge?: string | null;
}

/** Extra cost per additional pack — 40% of the single-pack price, rounded to 10৳. */
function stepPrice(basePrice: number) {
  return Math.max(10, Math.round((basePrice * 0.4) / 10) * 10);
}

/**
 * Build PackOffers from DB pack_options rows (admin-defined per product).
 * Falls back to auto-calculation if no DB options exist.
 */
export function getPackOffersFromDb(
  basePrice: number,
  packOptions: PackOptionRow[] | null | undefined,
): PackOffer[] {
  if (Array.isArray(packOptions) && packOptions.length > 0) {
    return packOptions
      .sort((a, b) => a.quantity - b.quantity)
      .map((o) => {
        const regularPrice = basePrice * o.quantity;
        return {
          quantity: o.quantity,
          price: o.price,
          regularPrice,
          saving: Math.max(0, regularPrice - o.price),
          label: o.label || `${o.quantity} প্যাক`,
          badge: o.badge || undefined,
          delivery_charge: o.delivery_charge ?? (o.quantity > 1 ? 0 : 70),
        };
      });
  }
  return getPackOffers(basePrice);
}

export function getPackOffers(basePrice: number): PackOffer[] {
  if (basePrice === 180) {
    return [
      { quantity: 1, price: 180, regularPrice: 250, saving: 70, label: "১ প্যাক", delivery_charge: 70 },
      { quantity: 2, price: 350, regularPrice: 500, saving: 150, label: "২ প্যাক", badge: "জনপ্রিয়", delivery_charge: 0 },
      { quantity: 3, price: 440, regularPrice: 750, saving: 310, label: "৩ প্যাক", badge: "বেস্ট ভ্যালু", delivery_charge: 0 },
    ];
  }
  const step = stepPrice(basePrice);
  return [1, 2, 3].map((quantity) => {
    const price = basePrice + (quantity - 1) * step;
    const regularPrice = basePrice * quantity;
    return {
      quantity,
      price,
      regularPrice,
      saving: Math.max(0, regularPrice - price),
      label: `${quantity} প্যাক`,
      delivery_charge: quantity > 1 ? 0 : 70,
      ...(quantity === 2 ? { badge: "জনপ্রিয়" } : {}),
      ...(quantity === 3 ? { badge: "বেস্ট ভ্যালু" } : {}),
    };
  });
}

export function getPackOffer(basePrice: number, quantity: number): PackOffer {
  const offers = getPackOffers(basePrice);
  const match = offers.find((o) => o.quantity === quantity);
  if (match) return match;
  // Beyond 3 packs: keep the per-pack combo rate of the largest offer.
  const largest = offers[offers.length - 1]!;
  const perPack = largest.price / largest.quantity;
  const price = Math.round(perPack * quantity);
  const regularPrice = basePrice * quantity;
  return {
    quantity,
    price,
    regularPrice,
    saving: Math.max(0, regularPrice - price),
    label: `${quantity} প্যাক`,
    delivery_charge: 0,
  };
}
