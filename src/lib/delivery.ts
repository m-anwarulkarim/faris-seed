import { getDeliveryTiers, chargeFromTiers, getDhakaConfig, getSavedDeliveryArea, getTiersEnabled } from "./deliveryTiers";

/** Base (unsubsidized) delivery charge — pulled from the lowest-threshold tier. */
export function getFullDeliveryCharge(): number {
  const tiers = [...getDeliveryTiers()].sort((a, b) => a.threshold - b.threshold);
  return tiers[0]?.charge ?? 120;
}

/** @deprecated Use getFullDeliveryCharge() — kept for back-compat only. */
export const FULL_DELIVERY_CHARGE = 120;

export interface DeliveryRule {
  minOrder: number;
  charge: number;
  label: string;
}

export function getUserDeliveryRule(_userType?: string): DeliveryRule | null {
  return null;
}

/**
 * Final delivery charge.
 * Priority:
 *   1. If subtotal tiers are ON and free-delivery threshold is unlocked → 0
 *   2. If Dhaka/location pricing is ON → exact selected location charge
 *      (when customer has not selected yet, default to "outside" so location mode still works)
 *   3. Otherwise → subtotal tier charge if tiers are ON, else 0
 *
 * `area` can be passed explicitly; if omitted, falls back to the customer's saved
 * Dhaka selection from checkout (so Cart/Landing reflect the same number).
 */
export function getDeliveryCharge(
  totalPrice: number,
  _userType?: string,
  area?: "inside" | "outside" | null,
): number {
  const tiersEnabled = getTiersEnabled();
  const dhaka = getDhakaConfig();
  const explicitAreaArg = arguments.length >= 3;
  const savedOrRequestedArea = explicitAreaArg ? area : getSavedDeliveryArea();
  const chosen = dhaka.enabled ? (savedOrRequestedArea ?? "outside") : null;
  const locationCharge =
    dhaka.enabled && chosen ? (chosen === "inside" ? dhaka.inside : dhaka.outside) : null;

  const tierCharge = tiersEnabled ? chargeFromTiers(getDeliveryTiers(), totalPrice) : null;

  // Keep free delivery threshold working when subtotal tiers are enabled.
  if (tierCharge === 0) return 0;

  // Location mode must show the exact Dhaka inside/outside charge.
  if (locationCharge !== null) return locationCharge;

  // If subtotal tiers are OFF, use Dhaka location charge alone (or 0 if disabled).
  if (!tiersEnabled) {
    return 0;
  }

  return tierCharge ?? 0;
}


export function getMinOrderAmount(userType?: string): number {
  const rule = getUserDeliveryRule(userType);
  return rule ? rule.minOrder : 0;
}

export function getDeliveryLabel(charge: number): string {
  if (charge === 0) return "ফ্রি";
  return `৳${charge}`;
}
