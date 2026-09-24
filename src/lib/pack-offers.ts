/** Bundle (combo) pricing for product landing pages: 1 / 2 / 3 packs. */
export interface PackOffer {
  quantity: number;
  price: number;
  /** What the same amount of packs would cost without the combo discount. */
  regularPrice: number;
  saving: number;
  label: string;
  badge?: string;
}

/** Extra cost per additional pack — 40% of the single-pack price, rounded to 10৳. */
function stepPrice(basePrice: number) {
  return Math.max(10, Math.round((basePrice * 0.4) / 10) * 10);
}

export function getPackOffers(basePrice: number): PackOffer[] {
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
  };
}
