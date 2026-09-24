/**
 * 🔒 DO_NOT_MODIFY — LOCK #1 of 5
 * 🔒 DO_NOT_MODIFY — LOCK #2 of 5
 * 🔒 DO_NOT_MODIFY — LOCK #3 of 5
 * 🔒 DO_NOT_MODIFY — LOCK #4 of 5
 * 🔒 DO_NOT_MODIFY — LOCK #5 of 5
 *
 * Owner directive (2026-05-04):
 * "নমস্কার" word must NEVER appear anywhere — incoming customer messages,
 * outgoing Mina AI replies, admin manual replies, FB Messenger inbound/outbound,
 * web chat — সব জায়গায় auto-replace হয়ে "আসসালামু আলাইকুম" হবে।
 * Mirror of src/lib/namaskarReplace.ts — keep in sync. Five-fold locked.
 */

const REPLACEMENT = "আসসালামু আলাইকুম";

const BANGLA_PATTERNS: RegExp[] = [
  /নমস্কার/g,
  /নমস্তে/g,
  /প্রণাম/g,
];

const LATIN_PATTERNS: RegExp[] = [
  /\bnamaskaa?r\b/gi,
  /\bnamaste\b/gi,
  /\bnomoshkar\b/gi,
  /\bnomoskar\b/gi,
  /\bnomoshkaar\b/gi,
  /\bpr[ao]nam\b/gi,
];

export function replaceNamaskar(input: string): string {
  if (!input || typeof input !== "string") return input;
  let out = input;
  for (const p of BANGLA_PATTERNS) out = out.replace(p, REPLACEMENT);
  for (const p of LATIN_PATTERNS) out = out.replace(p, REPLACEMENT);
  return out;
}

export function replaceNamaskarDeep<T = unknown>(value: T): T {
  if (typeof value === "string") return replaceNamaskar(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => replaceNamaskarDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = replaceNamaskarDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}
