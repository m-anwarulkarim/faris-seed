// Admin-controllable delivery configuration.
// Two pieces:
//   1. Subtotal tiers       — key: delivery_tiers
//   2. Dhaka location charge — key: dhaka_delivery_charges  { enabled, inside, outside }
// Both cached in localStorage for sync consumers.
import { supabase } from "@/integrations/supabase/client";

export interface DeliveryTier {
  threshold: number;
  charge: number;
}

export interface DhakaConfig {
  enabled: boolean;
  inside: number;
  outside: number;
}

const STORAGE_KEY = "delivery_tiers_cache_v3";
const DHAKA_STORAGE_KEY = "dhaka_delivery_charges_v3";
const TIERS_ENABLED_KEY = "delivery_tiers_enabled_v1";
export const DELIVERY_AREA_KEY = "checkout-delivery-area"; // 'inside' | 'outside'

export function getTiersEnabled(): boolean {
  try {
    const raw = localStorage.getItem(TIERS_ENABLED_KEY);
    if (raw === "false") return false;
    if (raw === "true") return true;
  } catch { /* ignore */ }
  return true; // default ON
}

export async function loadTiersEnabled(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "delivery_tiers_enabled")
      .maybeSingle();
    if (data && data.value !== null && data.value !== undefined) {
      const v = String(parseSettingValue(data.value)).toLowerCase();
      const enabled = !["false", "0", "off", "no"].includes(v);
      const prev = localStorage.getItem(TIERS_ENABLED_KEY);
      const next = enabled ? "true" : "false";
      localStorage.setItem(TIERS_ENABLED_KEY, next);
      if (prev !== next) emitChange();
      return enabled;
    }
  } catch { /* ignore */ }
  return getTiersEnabled();
}

export async function saveTiersEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "delivery_tiers_enabled", value: enabled ? "true" : "false" }, { onConflict: "key" });
  if (error) throw error;
  localStorage.setItem(TIERS_ENABLED_KEY, enabled ? "true" : "false");
  emitChange();
}


// Clear any stale caches from earlier schema versions so old free-delivery
// thresholds (e.g. 600) can't override the current admin settings.
try {
  ["delivery_tiers_cache", "delivery_tiers_cache_v2", "dhaka_delivery_charges_v2"].forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
} catch { /* ignore */ }

export const DELIVERY_CONFIG_EVENT = "delivery-config-updated";
function emitChange() {
  try { window.dispatchEvent(new Event(DELIVERY_CONFIG_EVENT)); } catch { /* ignore */ }
}

export const DEFAULT_TIERS: DeliveryTier[] = [
  { threshold: 0, charge: 120 },
  { threshold: 1000, charge: 100 },
  { threshold: 1500, charge: 80 },
  { threshold: 2000, charge: 0 },
];

export const DEFAULT_DHAKA: DhakaConfig = {
  enabled: false,
  inside: 60,
  outside: 120,
};

function parseSettingValue(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function sanitize(input: unknown): DeliveryTier[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const tiers = input
    .map((t: any) => ({
      threshold: Number(t?.threshold),
      charge: Number(t?.charge),
    }))
    .filter((t) => Number.isFinite(t.threshold) && Number.isFinite(t.charge) && t.threshold >= 0 && t.charge >= 0)
    .sort((a, b) => a.threshold - b.threshold);
  return tiers.length > 0 ? tiers : null;
}

function sanitizeDhaka(input: unknown): DhakaConfig | null {
  if (!input || typeof input !== "object") return null;
  const v = input as any;
  const inside = Number(v.inside);
  const outside = Number(v.outside);
  if (!Number.isFinite(inside) || !Number.isFinite(outside) || inside < 0 || outside < 0) return null;
  return { enabled: !!v.enabled, inside, outside };
}

export function getDeliveryTiers(): DeliveryTier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = sanitize(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_TIERS;
}

export function getDhakaConfig(): DhakaConfig {
  try {
    const raw = localStorage.getItem(DHAKA_STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeDhaka(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_DHAKA;
}

export async function loadDeliveryTiers(): Promise<DeliveryTier[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "delivery_tiers")
      .maybeSingle();
    const tiers = sanitize(parseSettingValue(data?.value));
    if (tiers) {
      const prev = localStorage.getItem(STORAGE_KEY);
      const next = JSON.stringify(tiers);
      localStorage.setItem(STORAGE_KEY, next);
      if (prev !== next) emitChange();
      return tiers;
    }
  } catch { /* ignore */ }
  return getDeliveryTiers();
}

export async function loadDhakaConfig(): Promise<DhakaConfig> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "dhaka_delivery_charges")
      .maybeSingle();
    const cfg = sanitizeDhaka(parseSettingValue(data?.value));
    if (cfg) {
      const prev = localStorage.getItem(DHAKA_STORAGE_KEY);
      const next = JSON.stringify(cfg);
      localStorage.setItem(DHAKA_STORAGE_KEY, next);
      if (prev !== next) emitChange();
      return cfg;
    }
  } catch { /* ignore */ }
  return getDhakaConfig();
}

export async function saveDeliveryTiers(tiers: DeliveryTier[]): Promise<void> {
  const cleaned = sanitize(tiers) ?? DEFAULT_TIERS;
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "delivery_tiers", value: JSON.stringify(cleaned) }, { onConflict: "key" });
  if (error) throw error;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  emitChange();
}

export async function saveDhakaConfig(cfg: DhakaConfig): Promise<void> {
  const cleaned = sanitizeDhaka(cfg) ?? DEFAULT_DHAKA;
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "dhaka_delivery_charges", value: JSON.stringify(cleaned) }, { onConflict: "key" });
  if (error) throw error;
  localStorage.setItem(DHAKA_STORAGE_KEY, JSON.stringify(cleaned));
  emitChange();
}

/** Pure helper: given tiers and a subtotal, return the matching charge. */
export function chargeFromTiers(tiers: DeliveryTier[], subtotal: number): number {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
  let charge = sorted[0]?.charge ?? 120;
  for (const t of sorted) {
    if (subtotal >= t.threshold) charge = t.charge;
  }
  return charge;
}

export function getSavedDeliveryArea(): "inside" | "outside" | null {
  try {
    const v = localStorage.getItem(DELIVERY_AREA_KEY);
    if (v === "inside" || v === "outside") return v;
  } catch { /* ignore */ }
  return null;
}

export function setSavedDeliveryArea(area: "inside" | "outside"): void {
  try {
    localStorage.setItem(DELIVERY_AREA_KEY, area);
    emitChange();
  } catch { /* ignore */ }
}

// ============================================================
// Realtime subscription — keeps client caches in sync with admin edits
// ============================================================
let _deliveryRealtimeStarted = false;
export function subscribeDeliveryConfigRealtime(): () => void {
  if (_deliveryRealtimeStarted) return () => {};
  _deliveryRealtimeStarted = true;
  const channel = supabase
    .channel("app_settings-delivery")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings", filter: "key=eq.delivery_tiers" },
      () => { loadDeliveryTiers().catch(() => {}); }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings", filter: "key=eq.dhaka_delivery_charges" },
      () => { loadDhakaConfig().catch(() => {}); }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_settings", filter: "key=eq.delivery_tiers_enabled" },
      () => { loadTiersEnabled().catch(() => {}); }
    )
    .subscribe();
  // Bootstrap on first subscribe
  loadDhakaConfig().catch(() => {});
  loadTiersEnabled().catch(() => {});

  return () => {
    try { supabase.removeChannel(channel); } catch { /* ignore */ }
    _deliveryRealtimeStarted = false;
  };
}
