export type OrderStatus =
  | "pending"
  | "incomplete"
  | "no-response"
  | "good-but-no-response"
  | "busy"
  | "hold"
  | "pre"
  | "cancelled"
  | "confirmed"
  | "printed"
  | "entry-done"
  | "shipped"
  | "pending-return"
  | "missing"
  | "partial"
  | "delivered"
  | "returned";

export const ORDER_STATUSES: { value: OrderStatus; label: string; className: string }[] = [
  { value: "confirmed", label: "Confirmed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "printed", label: "Printed", className: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "entry-done", label: "Entry Done", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { value: "shipped", label: "Shipped", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "pending-return", label: "Pending Return", className: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "missing", label: "Missing", className: "bg-red-100 text-red-800 border-red-200" },
  { value: "partial", label: "Partial", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "cancelled", label: "Cancel", className: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "returned", label: "Return", className: "bg-slate-100 text-slate-800 border-slate-200" },
  { value: "delivered", label: "Delivered", className: "bg-green-100 text-green-800 border-green-200" },
  { value: "pending", label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "incomplete", label: "Incomplete", className: "bg-slate-100 text-slate-800 border-slate-200" },
  { value: "no-response", label: "No Response", className: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "good-but-no-response", label: "Good But No Response", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "busy", label: "Busy", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "hold", label: "Hold", className: "bg-zinc-100 text-zinc-800 border-zinc-200" },
  { value: "pre", label: "Pre", className: "bg-purple-100 text-purple-800 border-purple-200" },
];

export function statusMeta(status: OrderStatus) {
  return ORDER_STATUSES.find((s) => s.value === status) ?? ORDER_STATUSES[0]!;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  changedAt: string;
  changedBy?: string;
}

export interface Order {
  id: string;
  createdAt: string;
  updatedAt: string;
  productSlug: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  customerName: string;
  phone: string;
  altPhone: string | undefined;
  address: string;
  note: string | undefined;
  deliveryCharge: number;
  paymentMethod: "cod";
  paymentStatus?: "pending" | "paid" | "failed";
  status: OrderStatus;
  source?: string;
  userId?: string | null;
  /** Soft delete — deleted orders live in /admin/orders/deleted and can be restored. */
  isDeleted?: boolean;
  isPrinted?: boolean;
  isCourierEntered?: boolean;
  consignmentId?: string | null;
  trackingCode?: string | null;
  statusHistory?: StatusHistoryEntry[];
}

export interface NewOrderInput {
  productSlug: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  customerName: string;
  phone: string;
  altPhone: string | undefined;
  address: string;
  note: string | undefined;
  deliveryCharge: number;
  userId?: string | null;
}


const STORAGE_KEY = "sobuj-bij-orders";

function isBrowser() {
  return typeof window !== "undefined";
}

const listeners = new Set<() => void>();

export function subscribeOrders(listener: () => void) {
  listeners.add(listener);
  if (isBrowser()) window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", listener);
  };
}

let snapshot: Order[] | null = null;

/** Backfills fields added after a record was first written to localStorage. */
function normalize(o: Order): Order {
  return {
    isDeleted: false,
    isPrinted: false,
    isCourierEntered: false,
    consignmentId: null,
    trackingCode: null,
    paymentStatus: "pending",
    ...o,
    updatedAt: o.updatedAt ?? o.createdAt,
    statusHistory: o.statusHistory ?? [{ status: o.status, changedAt: o.createdAt }],
  };
}

function read(): Order[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as Order[]).map(normalize);
    const seeded = demoOrders();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return [];
  }
}

function write(orders: Order[]) {
  snapshot = orders;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
    }
  }
  listeners.forEach((l) => l());
}

export function getOrders(): Order[] {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

/** Active (non soft-deleted) orders. */
export function getActiveOrders(): Order[] {
  return getOrders().filter((o) => !o.isDeleted);
}

export function getDeletedOrders(): Order[] {
  return getOrders().filter((o) => o.isDeleted);
}

function patch(ids: string[], fn: (o: Order) => Order) {
  write(getOrders().map((o) => (ids.includes(o.id) ? fn(o) : o)));
}

function withStatus(o: Order, status: OrderStatus): Order {
  const now = new Date().toISOString();
  return {
    ...o,
    status,
    updatedAt: now,
    statusHistory: [...(o.statusHistory ?? []), { status, changedAt: now }],
  };
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  patch([id], (o) => withStatus(o, status));
}

export function bulkUpdateOrderStatus(ids: string[], status: OrderStatus) {
  patch(ids, (o) => withStatus(o, status));
}

export function markOrdersPrinted(ids: string[]) {
  patch(ids, (o) => ({ ...o, isPrinted: true, updatedAt: new Date().toISOString() }));
}

export function markOrdersCourierEntered(ids: string[], provider: "steadfast" | "pathao") {
  patch(ids, (o) => ({
    ...o,
    isCourierEntered: true,
    consignmentId: o.consignmentId ?? `${provider === "pathao" ? "PT" : "SF"}-${Math.floor(Math.random() * 900000) + 100000}`,
    trackingCode: o.trackingCode ?? `TRK${Math.floor(Math.random() * 9000000) + 1000000}`,
    updatedAt: new Date().toISOString(),
  }));
}

export function softDeleteOrders(ids: string[]) {
  patch(ids, (o) => ({ ...o, isDeleted: true, updatedAt: new Date().toISOString() }));
}

export function restoreOrders(ids: string[]) {
  patch(ids, (o) => ({ ...o, isDeleted: false, updatedAt: new Date().toISOString() }));
}

export function purgeOrders(ids: string[]) {
  write(getOrders().filter((o) => !ids.includes(o.id)));
}

function daysAgo(days: number, hours = 0) {
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();
}

function demoOrders(): Order[] {
  const base = [
    { customerName: "রফিকুল ইসলাম", phone: "01711223344", address: "বাসা ১২, রোড ৫, মিরপুর ১০, ঢাকা", productSlug: "hybrid-tomato", productName: "হাইব্রিড টমেটো বীজ", unitPrice: 250, quantity: 3, status: "pending" as OrderStatus, createdAt: daysAgo(0, 2), source: "Facebook" },
    { customerName: "সুমাইয়া আক্তার", phone: "01822334455", address: "হোল্ডিং ৭, কলেজ রোড, বগুড়া সদর", productSlug: "green-chili", productName: "কাঁচা মরিচ বীজ", unitPrice: 240, quantity: 2, status: "confirmed" as OrderStatus, createdAt: daysAgo(1), source: "Google" },
    { customerName: "আবদুল করিম", phone: "01933445566", address: "গ্রাম: শালবন, ডাকঘর: কুমিল্লা", productSlug: "bottle-gourd", productName: "লাউ বীজ", unitPrice: 280, quantity: 4, status: "shipped" as OrderStatus, createdAt: daysAgo(2), source: "Direct" },
    { customerName: "নাজমুল হক", phone: "01644556677", address: "৩২/বি, আগ্রাবাদ, চট্টগ্রাম", productSlug: "cucumber", productName: "শসা বীজ", unitPrice: 320, quantity: 2, status: "delivered" as OrderStatus, createdAt: daysAgo(4), source: "Facebook" },
    { customerName: "শাহিনুর বেগম", phone: "01555667788", address: "সোনাডাঙ্গা, খুলনা", productSlug: "brinjal", productName: "বেগুন বীজ", unitPrice: 260, quantity: 1, status: "cancelled" as OrderStatus, createdAt: daysAgo(5), source: "Direct" },
    { customerName: "মেহেদী হাসান", phone: "01399887766", address: "ফুলবাড়ি, রংপুর", productSlug: "papaya", productName: "পেঁপে বীজ", unitPrice: 300, quantity: 5, status: "delivered" as OrderStatus, createdAt: daysAgo(6), source: "Google" },
  ];
  return base.map((o, i) => {
    const deliveryCharge = o.quantity > 1 ? 0 : 50;
    const shipped = ["shipped", "delivered"].includes(o.status);
    return {
      ...o,
      altPhone: undefined,
      note: undefined,
      deliveryCharge,
      id: `ORD-DEMO-${1000 + i}`,
      total: o.unitPrice * o.quantity + deliveryCharge,
      paymentMethod: "cod" as const,
      paymentStatus: "pending" as const,
      updatedAt: o.createdAt,
      isDeleted: false,
      isPrinted: shipped,
      isCourierEntered: shipped,
      consignmentId: shipped ? `SF-${100000 + i}` : null,
      trackingCode: shipped ? `TRK100000${i}` : null,
      statusHistory: [{ status: o.status, changedAt: o.createdAt }],
    };
  });
}


function makeId() {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${n}`;
}

export function createOrder(input: NewOrderInput): Order {
  const now = new Date().toISOString();
  const order: Order = {
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    total: input.unitPrice * input.quantity + input.deliveryCharge,
    paymentMethod: "cod",
    paymentStatus: "pending",
    status: "pending",
    source: "Direct",
    isDeleted: false,
    isPrinted: false,
    isCourierEntered: false,
    consignmentId: null,
    trackingCode: null,
    statusHistory: [{ status: "pending", changedAt: now }],
    ...input,
  };
  write([order, ...getOrders()]);
  return order;
}

