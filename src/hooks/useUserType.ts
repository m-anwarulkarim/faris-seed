import { getCustomerSession } from "@/components/CustomerLogin";

export type UserType = "regular" | "vip";

export function getUserType(): UserType {
  const session = getCustomerSession();
  if (session?.user_type === "vip") return "vip";
  return "regular";
}

/**
 * Get the display price for a product.
 * Same for everyone — offer_price ?? regular_price.
 */
export function getUserPrice(product: {
  regular_price: number | null;
  offer_price: number | null;
}, _userType?: UserType): { price: number; oldPrice: number | null } {
  const regularPrice = product.regular_price ?? 0;
  const offerPrice = product.offer_price;
  const price = offerPrice ?? regularPrice;
  const oldPrice = offerPrice ? regularPrice : null;
  return { price, oldPrice };
}

/**
 * Cashback comes purely from the product's cash_back value.
 * No user-type variation. Anyone (logged-in or guest) gets the full amount
 * if the product carries a cashback.
 */
export function getUserCashback(cashBack: number, _userType?: UserType): number {
  if (!cashBack || cashBack <= 0) return 0;
  return cashBack;
}

export function getUserTypeLabel(userType: string | null | undefined): string {
  return userType === "vip" ? "VIP" : "রেগুলার";
}
