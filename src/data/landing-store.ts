import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  getLandingContent,
  type Benefit,
  type Faq,
  type LandingContent,
  type Product,
  type Review,
} from "./products";

/** Every editable block of a product landing page, in default order. */
export const SECTION_KEYS = [
  "hero",
  "benefits",
  "details",
  "order",
  "reviews",
  "faq",
  "cta",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "হিরো (ছবি, হেডলাইন, দাম)",
  benefits: "সুবিধা কার্ড",
  details: "বিস্তারিত ও ব্যবহারবিধি",
  order: "অর্ডার ফর্ম",
  reviews: "কাস্টমার রিভিউ",
  faq: "সাধারণ প্রশ্নোত্তর",
  cta: "শেষের কল-টু-অ্যাকশন",
};

export interface SectionConfig {
  key: SectionKey;
  enabled: boolean;
}

export const defaultSections: SectionConfig[] = SECTION_KEYS.map((key) => ({
  key,
  enabled: true,
}));

/** Landing content plus the section layout. */
export interface LandingPage extends LandingContent {
  sections: SectionConfig[];
}

/** Raw DB row shape. */
export interface LandingRow {
  slug: string;
  headline: string | null;
  subheadline: string | null;
  pack_size: string | null;
  germination: string | null;
  highlights: string[] | null;
  benefits: Benefit[] | null;
  description: string[] | null;
  usage_steps: string[] | null;
  reviews: Review[] | null;
  faqs: Faq[] | null;
  sections: SectionConfig[] | null;
}

function normalizeSections(value: SectionConfig[] | null | undefined): SectionConfig[] {
  const list = Array.isArray(value) ? value.filter((s) => SECTION_KEYS.includes(s?.key)) : [];
  const missing = defaultSections.filter((d) => !list.some((s) => s.key === d.key));
  return [...list, ...missing];
}

/** Merges a saved row over the built-in defaults — empty fields fall back. */
export function mergeLanding(product: Product, row?: LandingRow | null): LandingPage {
  const base = getLandingContent(product);
  const pick = <T,>(value: T[] | null | undefined, fallback: T[]) =>
    Array.isArray(value) && value.length > 0 ? value : fallback;

  return {
    headline: row?.headline?.trim() || base.headline,
    subheadline: row?.subheadline?.trim() || base.subheadline,
    packSize: row?.pack_size?.trim() || base.packSize,
    germination: row?.germination?.trim() || base.germination,
    highlights: pick(row?.highlights, base.highlights),
    benefits: pick(row?.benefits, base.benefits),
    description: pick(row?.description, base.description),
    usage: pick(row?.usage_steps, base.usage),
    reviews: pick(row?.reviews, base.reviews),
    faqs: pick(row?.faqs, base.faqs),
    sections: normalizeSections(row?.sections),
  };
}

export async function fetchLandingRow(slug: string): Promise<LandingRow | null> {
  const { data } = await supabase
    .from("product_landing_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as unknown as LandingRow | null) ?? null;
}

export async function saveLandingRow(row: LandingRow) {
  const { error } = await supabase
    .from("product_landing_pages")
    .upsert(row as never, { onConflict: "slug" });
  if (error) throw error;
}

/** Public page hook — renders defaults instantly, then swaps in saved content. */
export function useLandingPage(product: Product | undefined): LandingPage | undefined {
  const [row, setRow] = useState<LandingRow | null>(null);

  useEffect(() => {
    let active = true;
    if (!product) return;
    fetchLandingRow(product.slug)
      .then((r) => {
        if (active) setRow(r);
      })
      .catch(() => {
        /* offline / not configured — defaults stay */
      });
    return () => {
      active = false;
    };
  }, [product?.slug]);

  if (!product) return undefined;
  return mergeLanding(product, row);
}
