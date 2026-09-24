import { useEffect, useState } from "react";

export interface CartItem {
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

const STORAGE_KEY = "faris-seed-cart";

function isBrowser() {
  return typeof window !== "undefined";
}

const listeners = new Set<() => void>();

export function subscribeCart(listener: () => void) {
  listeners.add(listener);
  if (isBrowser()) window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", listener);
  };
}

let snapshot: CartItem[] | null = null;

export function getCart(): CartItem[] {
  if (snapshot === null) {
    if (!isBrowser()) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      snapshot = raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      snapshot = [];
    }
  }
  return snapshot;
}

function write(items: CartItem[]) {
  snapshot = items;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable — in-memory snapshot still drives the UI */
    }
  }
  listeners.forEach((l) => l());
}

export function addToCart(item: Omit<CartItem, "quantity">, quantity = 1) {
  const items = getCart();
  const existing = items.find((i) => i.slug === item.slug);
  write(
    existing
      ? items.map((i) =>
          i.slug === item.slug ? { ...i, quantity: Math.min(20, i.quantity + quantity) } : i,
        )
      : [...items, { ...item, quantity }],
  );
}

export function setCartQuantity(slug: string, quantity: number) {
  if (quantity <= 0) {
    removeFromCart(slug);
    return;
  }
  write(getCart().map((i) => (i.slug === slug ? { ...i, quantity: Math.min(20, quantity) } : i)));
}

export function removeFromCart(slug: string) {
  write(getCart().filter((i) => i.slug !== slug));
}

export function clearCart() {
  write([]);
}

/** Delivery is ৳50 for a single packet, free for 2 or more. */
export function cartDeliveryCharge(items: CartItem[]) {
  return cartQuantity(items) > 1 ? 0 : 50;
}

export function cartQuantity(items: CartItem[]) {
  return items.reduce((s, i) => s + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

/** Client-synced cart; empty during SSR/first paint. */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    setItems(getCart());
    return subscribeCart(() => setItems(getCart()));
  }, []);
  return items;
}
