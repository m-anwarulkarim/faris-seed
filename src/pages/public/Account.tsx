import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Camera,
  ClipboardList,
  Download,
  Loader2,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  Truck,
  UserRound,
  Wallet,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Section } from "@/components/pub/section";
import { Card, CardContent } from "@/components/pub/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bn } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openInvoice } from "@/lib/customerInvoice";

function downloadInvoice(o: OrderRow) {
  openInvoice({
    invoice_no: o.customer_facing_id || o.order_id,
    created_at: o.created_at,
    customer_name: null,
    phone: o.phone,
    address: o.address,
    status: STATUS_LABEL[o.status] ?? o.status,
    delivery_charge: o.delivery_charge,
    discount: o.discount,
    total_amount: Number(o.total_amount),
    items: (o.order_items || []).map((i) => ({
      product_name: i.product_name,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
    })),
  });
}

type TabKey = "overview" | "orders" | "profile" | "address";

interface OrderItemRow {
  id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
}

interface OrderRow {
  id: string;
  order_id: string;
  customer_facing_id: string | null;
  status: string;
  total_amount: number;
  delivery_charge: number | null;
  discount: number | null;
  address: string | null;
  phone: string | null;
  created_at: string;
  tracking_code: string | null;
  consignment_id: string | null;
  courier_provider: string | null;
  payment_method: string | null;
  payment_status: string | null;
  order_items: OrderItemRow[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "পেন্ডিং",
  incomplete: "অসম্পূর্ণ",
  confirmed: "কনফার্ম",
  printed: "প্রসেসিং",
  "entry-done": "কুরিয়ারে দেওয়া হয়েছে",
  entry_done: "কুরিয়ারে দেওয়া হয়েছে",
  shipped: "পাঠানো হয়েছে",
  delivered: "ডেলিভার্ড",
  cancelled: "বাতিল",
  returned: "ফেরত",
  partial: "আংশিক ডেলিভারি",
  hold: "হোল্ড",
  pre: "প্রি-অর্ডার",
};

const STATUS_TONE: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  returned: "bg-slate-100 text-slate-700 border-slate-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  confirmed: "bg-amber-100 text-amber-800 border-amber-200",
};

const TIMELINE: { key: string; label: string }[] = [
  { key: "pending", label: "অর্ডার হয়েছে" },
  { key: "confirmed", label: "কনফার্ম" },
  { key: "shipped", label: "কুরিয়ারে" },
  { key: "delivered", label: "ডেলিভার্ড" },
];

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

function timelineIndex(status: string) {
  if (status === "delivered") return 3;
  if (["shipped", "entry-done", "entry_done", "pending-return", "partial"].includes(status)) return 2;
  if (["confirmed", "printed", "pre", "hold"].includes(status)) return 1;
  return 0;
}

const ORDER_FILTERS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: "all", label: "সব", match: () => true },
  { key: "processing", label: "প্রসেসিং", match: (s) => ["pending", "incomplete", "confirmed", "printed", "hold", "pre"].includes(s) },
  { key: "shipping", label: "শিপিং", match: (s) => ["shipped", "entry-done", "entry_done", "pending-return", "partial"].includes(s) },
  { key: "delivered", label: "ডেলিভার্ড", match: (s) => s === "delivered" },
  { key: "cancelled", label: "বাতিল/ফেরত", match: (s) => ["cancelled", "returned"].includes(s) },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, loading } = useCustomerAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabKey>("overview");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderFilter, setOrderFilter] = useState("all");
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    address: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("customer_profiles")
      .select("full_name, phone, address, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile({
            full_name: data.full_name ?? "",
            phone: data.phone ?? "",
            address: data.address ?? "",
            avatar_url: data.avatar_url ?? "",
          });
        }
      });
  }, [user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_id, customer_facing_id, status, total_amount, delivery_charge, discount, address, phone, created_at, tracking_code, consignment_id, courier_provider, payment_method, payment_status, order_items(id, product_name, product_image, quantity, unit_price)"
      )
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders((data as OrderRow[] | null) ?? []);
    setOrdersLoading(false);
  }, [user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders, profile.phone]);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const active = orders.filter((o) =>
      ["pending", "confirmed", "printed", "shipped", "entry-done", "hold", "pre"].includes(o.status)
    );
    const spent = delivered.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    return { total: orders.length, delivered: delivered.length, active: active.length, spent };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const f = ORDER_FILTERS.find((x) => x.key === orderFilter) ?? ORDER_FILTERS[0];
    return orders.filter((o) => f.match(o.status));
  }, [orders, orderFilter]);

  async function saveProfile(patch?: Partial<typeof profile>) {
    if (!user) return;
    const next = { ...profile, ...patch };
    setSaving(true);
    const { error } = await supabase.from("customer_profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: next.full_name.trim() || null,
      phone: next.phone.trim() || null,
      address: next.address.trim() || null,
      avatar_url: next.avatar_url.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("তথ্য সেভ করা যায়নি।");
      return;
    }
    setProfile(next);
    toast.success("তথ্য সেভ হয়েছে!");
    void loadOrders();
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ছবিটি ৫ এমবি-র কম হতে হবে।");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `avatars/${user.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (error) {
      setUploading(false);
      toast.error("ছবি আপলোড করা যায়নি।");
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setUploading(false);
    await saveProfile({ avatar_url: data.publicUrl });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const initial = (profile.full_name || user.email || "?").trim().charAt(0).toUpperCase();

  const navItems: { key: TabKey; label: string; icon: typeof UserRound }[] = [
    { key: "overview", label: "ওভারভিউ", icon: ClipboardList },
    { key: "orders", label: "আমার অর্ডার", icon: Package },
    { key: "profile", label: "প্রোফাইল", icon: UserRound },
    { key: "address", label: "ঠিকানা", icon: MapPin },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Navbar />
      <main className="flex-1">
        <Section spacing="sm" width="wide">
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* Sidebar */}
            <aside className="space-y-4">
              <Card variant="panel">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="relative">
                    <div className="grid size-14 place-items-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.full_name || "প্রোফাইল ছবি"}
                          className="size-full object-cover"
                        />
                      ) : (
                        initial
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border border-border bg-background shadow-soft"
                      aria-label="প্রোফাইল ছবি বদলান"
                    >
                      {uploading ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Camera className="size-3" />
                      )}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatar}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{profile.full_name || "কাস্টমার"}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </CardContent>
              </Card>

              <Card variant="panel">
                <CardContent className="p-2">
                  <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
                    {navItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:w-full",
                          tab === item.key
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <item.icon className="size-4" /> {item.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 lg:w-full"
                    >
                      <LogOut className="size-4" /> লগআউট
                    </button>
                  </nav>
                </CardContent>
              </Card>
            </aside>

            {/* Content */}
            <div className="space-y-5">
              {!profile.phone && (
                <Card variant="panel" className="border-amber-300 bg-amber-50">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="text-sm text-amber-900">
                      আপনার মোবাইল নম্বর যোগ করুন — তাহলেই আগের সব অর্ডার এখানে দেখা যাবে।
                    </p>
                    <Button size="sm" onClick={() => setTab("profile")}>
                      নম্বর যোগ করুন
                    </Button>
                  </CardContent>
                </Card>
              )}

              {tab === "overview" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      { icon: Package, label: "মোট অর্ডার", value: bn(stats.total) },
                      { icon: Truck, label: "চলমান", value: bn(stats.active) },
                      { icon: PackageCheck, label: "ডেলিভার্ড", value: bn(stats.delivered) },
                      { icon: Wallet, label: "মোট খরচ", value: `৳${bn(Math.round(stats.spent))}` },
                    ].map((s) => (
                      <Card key={s.label} variant="panel">
                        <CardContent className="p-4">
                          <s.icon className="size-5 text-primary" />
                          <p className="mt-2 text-xl font-bold">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card variant="panel">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-lg font-bold">সাম্প্রতিক অর্ডার</h2>
                        <Button variant="ghost" size="sm" onClick={() => setTab("orders")}>
                          সব দেখুন
                        </Button>
                      </div>
                      <Separator className="my-3" />
                      <OrderList
                        orders={orders.slice(0, 3)}
                        loading={ordersLoading}
                        onSelect={setDetail}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}

              {tab === "orders" && (
                <Card variant="panel">
                  <CardContent className="p-4">
                    <h2 className="font-display text-lg font-bold">আমার অর্ডার</h2>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {ORDER_FILTERS.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setOrderFilter(f.key)}
                          className={cn(
                            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            orderFilter === f.key
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <Separator className="my-3" />
                    <OrderList orders={visibleOrders} loading={ordersLoading} onSelect={setDetail} />
                  </CardContent>
                </Card>
              )}

              {tab === "profile" && (
                <Card variant="panel">
                  <CardContent className="p-5">
                    <h2 className="font-display text-lg font-bold">প্রোফাইল তথ্য</h2>
                    <form
                      className="mt-4 space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveProfile();
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="full_name">নাম</Label>
                        <Input
                          id="full_name"
                          value={profile.full_name}
                          onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                          placeholder="আপনার নাম"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">মোবাইল নম্বর</Label>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          placeholder="01XXXXXXXXX"
                        />
                        <p className="text-xs text-muted-foreground">
                          এই নম্বরে করা সব অর্ডার আপনার অ্যাকাউন্টে দেখা যাবে।
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">ইমেইল</Label>
                        <Input id="email" value={user.email ?? ""} disabled />
                      </div>
                      <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                        সেভ করুন
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {tab === "address" && (
                <Card variant="panel">
                  <CardContent className="p-5">
                    <h2 className="font-display text-lg font-bold">ডেলিভারি ঠিকানা</h2>
                    <form
                      className="mt-4 space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveProfile();
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="address">সম্পূর্ণ ঠিকানা</Label>
                        <Textarea
                          id="address"
                          rows={4}
                          value={profile.address}
                          onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                          placeholder="গ্রাম/বাসা, রোড, থানা, জেলা"
                        />
                      </div>
                      <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                        ঠিকানা সেভ করুন
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </Section>
      </main>
      <Footer />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              অর্ডার #{detail?.customer_facing_id || detail?.order_id}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={STATUS_TONE[detail.status]}>
                  {statusLabel(detail.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(detail.created_at)}
                </span>
              </div>

              {/* Tracking timeline */}
              {!["cancelled", "returned"].includes(detail.status) && (
                <div className="flex items-start">
                  {TIMELINE.map((step, i) => {
                    const done = i <= timelineIndex(detail.status);
                    return (
                      <div key={step.key} className="flex flex-1 flex-col items-center text-center">
                        <div className="flex w-full items-center">
                          <span
                            className={cn(
                              "h-0.5 flex-1",
                              i === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-border"
                            )}
                          />
                          <span
                            className={cn(
                              "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                              done
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {bn(i + 1)}
                          </span>
                          <span
                            className={cn(
                              "h-0.5 flex-1",
                              i === TIMELINE.length - 1
                                ? "bg-transparent"
                                : i < timelineIndex(detail.status)
                                  ? "bg-primary"
                                  : "bg-border"
                            )}
                          />
                        </div>
                        <span className="mt-1 text-[10px] text-muted-foreground">{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {(detail.tracking_code || detail.consignment_id) && (
                <div className="rounded-lg bg-muted p-3 text-xs">
                  <p className="font-medium">কুরিয়ার ট্র্যাকিং</p>
                  <p className="text-muted-foreground">
                    {detail.courier_provider ? `${detail.courier_provider} — ` : ""}
                    {detail.tracking_code || detail.consignment_id}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {detail.order_items?.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      {it.product_image && (
                        <img
                          src={it.product_image}
                          alt={it.product_name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {bn(it.quantity)} × ৳{bn(Number(it.unit_price))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-sm">
                {!!detail.delivery_charge && (
                  <Row label="ডেলিভারি চার্জ" value={`৳${bn(Number(detail.delivery_charge))}`} />
                )}
                {!!detail.discount && (
                  <Row label="ডিসকাউন্ট" value={`-৳${bn(Number(detail.discount))}`} />
                )}
                <Row
                  label="সর্বমোট"
                  value={`৳${bn(Number(detail.total_amount))}`}
                  strong
                />
              </div>

              {detail.address && (
                <div className="rounded-lg bg-muted p-3 text-xs">
                  <p className="font-medium">ডেলিভারি ঠিকানা</p>
                  <p className="text-muted-foreground">{detail.address}</p>
                  {detail.phone && <p className="text-muted-foreground">{detail.phone}</p>}
                </div>
              )}

              <Button className="w-full gap-2" onClick={() => downloadInvoice(detail)}>
                <Download className="size-4" /> ইনভয়েস ডাউনলোড করুন
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between", strong && "font-bold")}>
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function OrderList({
  orders,
  loading,
  onSelect,
}: {
  orders: OrderRow[];
  loading: boolean;
  onSelect: (o: OrderRow) => void;
}) {
  if (loading) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!orders.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">কোনো অর্ডার পাওয়া যায়নি।</p>
    );
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            onClick={() => onSelect(o)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
          >
            <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {o.order_items?.[0]?.product_image && (
                <img
                  src={o.order_items[0].product_image as string}
                  alt={o.order_items[0].product_name}
                  loading="lazy"
                  className="size-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {o.order_items?.[0]?.product_name ?? "অর্ডার"}
                {o.order_items && o.order_items.length > 1
                  ? ` + আরও ${bn(o.order_items.length - 1)}টি`
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                #{o.customer_facing_id || o.order_id} · {formatDate(o.created_at)}
              </p>
              <p className="text-sm font-bold text-primary">৳{bn(Number(o.total_amount))}</p>
            </div>
            <Badge variant="outline" className={cn("shrink-0", STATUS_TONE[o.status])}>
              {statusLabel(o.status)}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}
