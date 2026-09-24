import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

type Section = {
  id: string;
  title: string;
  slug: string;
  position: number;
  is_active: boolean;
  countdown_end: string | null;
  selection_mode: string;
  tag: string | null;
  product_ids: string[];
  max_items: number;
  view_all_link: string | null;
  accent_color: string | null;
  is_special_offer: boolean;
  discount_type: "percent" | "flat" | null;
  discount_value: number | null;
  lock_orders_after_expiry: boolean;
};

const MODES = [
  { value: "manual", label: "Manual — নিজে প্রোডাক্ট বাছাই" },
  { value: "tag", label: "Tag অনুযায়ী" },
  { value: "auto_new", label: "Auto — New (সর্বশেষ যোগ)" },
  { value: "auto_popular", label: "Auto — Popular (পজিশন অনুযায়ী)" },
  { value: "auto_offer", label: "Auto — Offer (বেশি ডিসকাউন্ট)" },
];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HomeSectionsManagement() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Section | null>(null);

  const { data: sections = [], isLoading } = useQuery<Section[]>({
    queryKey: ["admin-home-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("home_sections" as any)
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["admin-products-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, product_image, tag, category")
        .eq("is_hidden", false)
        .order("name");
      return data || [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (s: Partial<Section> & { id?: string }) => {
      if (s.id) {
        const { error } = await supabase.from("home_sections" as any).update(s).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("home_sections" as any).insert(s);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-home-sections"] });
      qc.invalidateQueries({ queryKey: ["home-sections"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("home_sections" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-home-sections"] });
      qc.invalidateQueries({ queryKey: ["home-sections"] });
    },
  });

  const move = (s: Section, dir: -1 | 1) => {
    const idx = sections.findIndex((x) => x.id === s.id);
    const swap = sections[idx + dir];
    if (!swap) return;
    upsert.mutate({ id: s.id, position: swap.position });
    upsert.mutate({ id: swap.id, position: s.position });
  };

  const newSection = () => {
    const next = (sections[sections.length - 1]?.position || 0) + 1;
    setEditing({
      id: "",
      title: "",
      slug: `section-${Date.now()}`,
      position: next,
      is_active: true,
      countdown_end: null,
      selection_mode: "auto_new",
      tag: null,
      product_ids: [],
      max_items: 10,
      view_all_link: null,
      accent_color: "#10b981",
      is_special_offer: false,
      discount_type: null,
      discount_value: null,
      lock_orders_after_expiry: false,
    });
  };

  return (
    <div className="container max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Home Sections</h1>
          <p className="text-sm text-muted-foreground">
            হোম পেজের সেকশন, কাউন্টডাউন টাইমার ও প্রোডাক্ট কন্ট্রোল
          </p>
        </div>
        <Button onClick={newSection}>
          <Plus className="w-4 h-4 mr-1" /> নতুন সেকশন
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((s, i) => (
            <div
              key={s.id}
              className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(s, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => move(s, 1)}
                  disabled={i === sections.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              <div
                className="w-3 h-12 rounded"
                style={{ background: s.accent_color || "hsl(var(--primary))" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{s.title}</p>
                  {!s.is_active && (
                    <span className="text-[10px] bg-muted px-1.5 rounded">OFF</span>
                  )}
                  {s.is_special_offer && s.discount_value != null && (
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                      🔥 -{s.discount_value}
                      {s.discount_type === "percent" ? "%" : "৳"}
                      {s.lock_orders_after_expiry ? " · LOCK" : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {MODES.find((m) => m.value === s.selection_mode)?.label || s.selection_mode}
                  {" · "}
                  {s.selection_mode === "manual"
                    ? `${s.product_ids?.length || 0} প্রোডাক্ট`
                    : `${s.max_items} টি`}
                  {s.countdown_end &&
                    ` · টাইমার ${new Date(s.countdown_end).toLocaleString("en-GB")}`}
                </p>
              </div>
              <Switch
                checked={s.is_active}
                onCheckedChange={(v) => upsert.mutate({ id: s.id, is_active: v })}
              />
              <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => {
                  if (confirm(`"${s.title}" ডিলিট করবেন?`)) remove.mutate(s.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditDialog
          section={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSave={(data) => upsert.mutate(editing.id ? { ...data, id: editing.id } : data)}
          saving={upsert.isPending}
        />
      )}
    </div>
  );
}

function EditDialog({
  section,
  products,
  onClose,
  onSave,
  saving,
}: {
  section: Section;
  products: any[];
  onClose: () => void;
  onSave: (s: Partial<Section>) => void;
  saving: boolean;
}) {
  const [s, setS] = useState<Section>(section);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 50);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 50);
  }, [products, search]);

  const toggleProduct = (id: string) => {
    setS((prev) => ({
      ...prev,
      product_ids: prev.product_ids.includes(id)
        ? prev.product_ids.filter((x) => x !== id)
        : [...prev.product_ids, id],
    }));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{section.id ? "সেকশন এডিট" : "নতুন সেকশন"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>টাইটেল *</Label>
            <Input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Slug</Label>
              <Input value={s.slug} onChange={(e) => setS({ ...s, slug: e.target.value })} />
            </div>
            <div>
              <Label>সর্বোচ্চ প্রোডাক্ট</Label>
              <Input
                type="number"
                value={s.max_items}
                onChange={(e) => setS({ ...s, max_items: parseInt(e.target.value) || 10 })}
              />
            </div>
          </div>

          <div>
            <Label>প্রোডাক্ট সিলেকশন মোড</Label>
            <Select
              value={s.selection_mode}
              onValueChange={(v) => setS({ ...s, selection_mode: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {s.selection_mode === "tag" && (
            <div>
              <Label>Tag name</Label>
              <Input
                value={s.tag || ""}
                onChange={(e) => setS({ ...s, tag: e.target.value })}
                placeholder="যেমন: flash-deal"
              />
            </div>
          )}

          {s.selection_mode === "manual" && (
            <div className="space-y-2">
              <Label>প্রোডাক্ট বাছাই ({s.product_ids.length} সিলেক্টেড)</Label>
              <Input
                placeholder="প্রোডাক্ট খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="border border-border rounded-lg max-h-60 overflow-y-auto divide-y">
                {filtered.map((p) => {
                  const selected = s.product_ids.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className={`w-full flex items-center gap-2 p-2 text-left text-sm ${selected ? "bg-primary/10" : "hover:bg-muted/50"}`}
                    >
                      <img
                        src={p.product_image || "/placeholder.svg"}
                        alt=""
                        className="w-8 h-8 rounded object-cover"
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                      {selected && <span className="text-primary text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <Label>
              কাউন্টডাউন টাইমার শেষ
              {s.is_special_offer ? (
                <span className="text-destructive ml-1">* (বিশেষ অফারে বাধ্যতামূলক)</span>
              ) : (
                <span className="text-muted-foreground ml-1">(ঐচ্ছিক)</span>
              )}
            </Label>
            <Input
              type="datetime-local"
              value={toLocalInput(s.countdown_end)}
              onChange={(e) =>
                setS({
                  ...s,
                  countdown_end: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
            {s.countdown_end && !s.is_special_offer && (
              <button
                type="button"
                onClick={() => setS({ ...s, countdown_end: null })}
                className="text-xs text-destructive mt-1"
              >
                টাইমার রিমুভ
              </button>
            )}
          </div>

          {/* Special Offer block */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label className="text-sm">🔥 এটি কি বিশেষ অফার?</Label>
                <p className="text-[11px] text-muted-foreground">
                  অন করলে সেকশনের সব প্রোডাক্টে স্বয়ংক্রিয়ভাবে ডিসকাউন্ট প্রাইস দেখাবে।
                </p>
              </div>
              <Switch
                checked={s.is_special_offer}
                onCheckedChange={(v) =>
                  setS({
                    ...s,
                    is_special_offer: v,
                    discount_type: v ? s.discount_type || "percent" : null,
                    discount_value: v ? s.discount_value : null,
                    lock_orders_after_expiry: v ? s.lock_orders_after_expiry : false,
                  })
                }
              />
            </div>

            {s.is_special_offer && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>ডিসকাউন্টের ধরণ *</Label>
                    <Select
                      value={s.discount_type || "percent"}
                      onValueChange={(v) => setS({ ...s, discount_type: v as "percent" | "flat" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">পার্সেন্টেজ (%)</SelectItem>
                        <SelectItem value="flat">ফ্ল্যাট টাকা (৳)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>
                      ডিসকাউন্টের পরিমাণ * {s.discount_type === "percent" ? "(%)" : "(৳)"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={s.discount_type === "percent" ? 100 : undefined}
                      value={s.discount_value ?? ""}
                      onChange={(e) =>
                        setS({
                          ...s,
                          discount_value: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder={s.discount_type === "percent" ? "যেমন: 20" : "যেমন: 50"}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div>
                    <Label className="text-sm">⏰ টাইম শেষ হলে অর্ডার বন্ধ করুন?</Label>
                    <p className="text-[11px] text-muted-foreground">
                      অন করলে অফার শেষে এই প্রোডাক্টগুলোতে অর্ডার নেওয়া বন্ধ হবে।
                    </p>
                  </div>
                  <Switch
                    checked={s.lock_orders_after_expiry}
                    onCheckedChange={(v) => setS({ ...s, lock_orders_after_expiry: v })}
                  />
                </div>
              </>
            )}
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Accent Color</Label>
              <Input
                type="color"
                value={s.accent_color || "#10b981"}
                onChange={(e) => setS({ ...s, accent_color: e.target.value })}
                className="h-10"
              />
            </div>
            <div>
              <Label>View All Link</Label>
              <Input
                value={s.view_all_link || ""}
                onChange={(e) => setS({ ...s, view_all_link: e.target.value || null })}
                placeholder="/products"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={s.is_active}
              onCheckedChange={(v) => setS({ ...s, is_active: v })}
            />
            <Label>সেকশনটি সক্রিয়</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            বাতিল
          </Button>
          <Button
            disabled={saving || !s.title.trim()}
            onClick={() => {
              if (s.is_special_offer) {
                if (!s.countdown_end) {
                  toast.error("বিশেষ অফারে কাউন্টডাউন শেষের সময় বাধ্যতামূলক");
                  return;
                }
                if (!s.discount_type) {
                  toast.error("ডিসকাউন্টের ধরণ বাছাই করুন");
                  return;
                }
                if (!s.discount_value || s.discount_value <= 0) {
                  toast.error("ডিসকাউন্টের পরিমাণ ০ এর বেশি হতে হবে");
                  return;
                }
                if (s.discount_type === "percent" && s.discount_value > 100) {
                  toast.error("পার্সেন্টেজ ১০০ এর বেশি হতে পারবে না");
                  return;
                }
              }
              const { id, ...rest } = s;
              onSave(rest);
            }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} সেভ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
