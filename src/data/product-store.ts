import { useEffect, useState } from "react";

import { products as seedProducts, type Product, type ProductTag } from "./products";

/** Admin-managed product record (superset of the public Product shape). */
export interface ProductRecord extends Product {
  stock: number;
  active: boolean;
  images: string[];
  shortDescription: string;
  descriptionHtml: string;
}

export const LOW_STOCK_THRESHOLD = 5;

export interface ProductInput {
  slug: string;
  name: string;
  nameEn: string;
  tagline: string;
  price: number;
  oldPrice?: number | undefined;
  stock: number;
  active: boolean;
  images: string[];
  shortDescription: string;
  descriptionHtml: string;
  tag: ProductTag;
}

function fromSeed(p: Product): ProductRecord {
  return {
    ...p,
    stock: p.inStock ? 24 : 0,
    active: true,
    images: (p.images?.length ? p.images : [p.image]).map((src) =>
      src.replace(/\.jpg$/, ".webp"),
    ),
    shortDescription: p.tagline,
    descriptionHtml: "",
  };
}

/** Server/first-render catalog — the built-in seed products. */
export const seedCatalog: ProductRecord[] = seedProducts.map(fromSeed);

const STORAGE_KEY = "sobuj-bij-products";

function isBrowser() {
  return typeof window !== "undefined";
}

const listeners = new Set<() => void>();

export function subscribeProducts(listener: () => void) {
  listeners.add(listener);
  if (isBrowser()) window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", listener);
  };
}

let snapshot: ProductRecord[] | null = null;

function write(list: ProductRecord[]) {
  snapshot = list;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable — in-memory snapshot still drives the UI */
    }
  }
  listeners.forEach((l) => l());
}

/** Backfill gallery images for stored records saved before multi-image support. */
function withGallery(list: ProductRecord[]): ProductRecord[] {
  return list.map((p) => {
    if (p.images && p.images.length > 1) return p;
    const seed = seedCatalog.find((s) => s.slug === p.slug);
    if (!seed || seed.images.length < 2) return p;
    return { ...p, images: seed.images };
  });
}

/** Full catalog (admin view), newest edits included. */
export function getCatalog(): ProductRecord[] {
  if (snapshot === null) {
    if (!isBrowser()) return seedCatalog;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      snapshot = raw ? withGallery(JSON.parse(raw) as ProductRecord[]) : seedCatalog;
    } catch {
      snapshot = seedCatalog;
    }
  }
  return snapshot;
}

export function getCatalogProduct(slug: string): ProductRecord | undefined {
  return getCatalog().find((p) => p.slug === slug);
}

export function saveProduct(input: ProductInput, originalSlug?: string): ProductRecord {
  const list = getCatalog();
  const existing = originalSlug ? list.find((p) => p.slug === originalSlug) : undefined;
  const record: ProductRecord = {
    slug: input.slug,
    name: input.name,
    nameEn: input.nameEn || input.name,
    tagline: input.tagline || input.shortDescription,
    price: input.price,
    ...(input.oldPrice ? { oldPrice: input.oldPrice } : {}),
    image: (input.images[0] ?? existing?.image ?? seedCatalog[0]!.image).replace(/\.jpg$/, ".webp"),
    inStock: input.stock > 0,
    tag: input.tag,
    stock: input.stock,
    active: input.active,
    images: input.images.length ? input.images : existing?.images ?? [],
    shortDescription: input.shortDescription,
    descriptionHtml: input.descriptionHtml,
  };
  write(
    existing
      ? list.map((p) => (p.slug === originalSlug ? record : p))
      : [record, ...list],
  );
  return record;
}

export function deleteProduct(slug: string) {
  write(getCatalog().filter((p) => p.slug !== slug));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Client-synced catalog; renders the seed list during SSR/first paint. */
export function useCatalog(): ProductRecord[] {
  const [list, setList] = useState<ProductRecord[]>(seedCatalog);
  useEffect(() => {
    setList(getCatalog());
    return subscribeProducts(() => setList(getCatalog()));
  }, []);
  return list;
}

export function useCatalogProduct(slug: string): ProductRecord | undefined {
  return useCatalog().find((p) => p.slug === slug);
}
