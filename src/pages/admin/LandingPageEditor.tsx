import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  SECTION_LABELS,
  defaultSections,
  fetchLandingRow,
  mergeLanding,
  saveLandingRow,
  type LandingRow,
  type SectionConfig,
} from "@/data/landing-store";
import { useCatalog } from "@/data/product-store";
import type { Benefit, Faq, Review } from "@/data/products";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Simple editable list of plain strings. */
function StringList({
  label,
  items,
  onChange,
  multiline,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">{label}</Label>
        <Button size="sm" variant="outline" onClick={() => onChange([...items, ""])}>
          <Plus className="mr-1 size-3.5" /> যোগ করুন
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {multiline ? (
            <Textarea
              value={item}
              rows={3}
              onChange={(e) =>
                onChange(items.map((v, idx) => (idx === i ? e.target.value : v)))
              }
            />
          ) : (
            <Input
              value={item}
              onChange={(e) =>
                onChange(items.map((v, idx) => (idx === i ? e.target.value : v)))
              }
            />
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ))}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">কিছু যোগ না করলে ডিফল্ট লেখা দেখাবে।</p>
      ) : null}
    </div>
  );
}

export default function LandingPageEditor() {
  const catalog = useCatalog();
  const [slug, setSlug] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<LandingRow | null>(null);

  const product = useMemo(() => catalog.find((p) => p.slug === slug), [catalog, slug]);

  useEffect(() => {
    if (!slug && catalog.length) setSlug(catalog[0]!.slug);
  }, [catalog, slug]);

  useEffect(() => {
    if (!slug || !product) return;
    setLoading(true);
    fetchLandingRow(slug)
      .then((saved) => {
        const merged = mergeLanding(product, saved);
        setRow({
          slug,
          headline: merged.headline,
          subheadline: merged.subheadline,
          pack_size: merged.packSize,
          germination: merged.germination,
          highlights: merged.highlights,
          benefits: merged.benefits,
          description: merged.description,
          usage_steps: merged.usage,
          reviews: merged.reviews,
          faqs: merged.faqs,
          sections: merged.sections,
        });
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [slug, product]);

  const patch = (p: Partial<LandingRow>) => setRow((r) => (r ? { ...r, ...p } : r));

  const moveSection = (index: number, dir: -1 | 1) => {
    if (!row) return;
    const list = [...(row.sections ?? defaultSections)];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!];
    patch({ sections: list as SectionConfig[] });
  };

  const save = async () => {
    if (!row) return;
    setSaving(true);
    try {
      await saveLandingRow(row);
      toast.success("ল্যান্ডিং পেজ সেভ হয়েছে");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">প্রোডাক্ট ল্যান্ডিং পেজ</h1>
          <p className="text-sm text-muted-foreground">
            প্রতিটি প্রোডাক্টের ডিটেইলস পেজের লেখা, সেকশনের ক্রম ও চালু/বন্ধ এখান থেকে বদলান।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={slug} onValueChange={setSlug}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="প্রোডাক্ট বাছুন" />
            </SelectTrigger>
            <SelectContent>
              {catalog.map((p) => (
                <SelectItem key={p.slug} value={p.slug}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={save} disabled={saving || !row}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
            সেভ
          </Button>
        </div>
      </div>

      {loading || !row ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে…
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            <Card className="flex flex-col gap-4 p-4">
              <h2 className="font-semibold">হেডলাইন</h2>
              <Field label="হেডলাইন">
                <Input
                  value={row.headline ?? ""}
                  onChange={(e) => patch({ headline: e.target.value })}
                />
              </Field>
              <Field label="সাব-হেডলাইন">
                <Textarea
                  rows={3}
                  value={row.subheadline ?? ""}
                  onChange={(e) => patch({ subheadline: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="প্যাক সাইজ">
                  <Input
                    value={row.pack_size ?? ""}
                    onChange={(e) => patch({ pack_size: e.target.value })}
                  />
                </Field>
                <Field label="গজানোর হার">
                  <Input
                    value={row.germination ?? ""}
                    onChange={(e) => patch({ germination: e.target.value })}
                  />
                </Field>
              </div>
              <StringList
                label="হাইলাইট পয়েন্ট"
                items={row.highlights ?? []}
                onChange={(highlights) => patch({ highlights })}
              />
            </Card>

            <Card className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">সুবিধা কার্ড</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      benefits: [
                        ...(row.benefits ?? []),
                        { icon: "sprout", title: "", text: "" } as Benefit,
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 size-3.5" /> যোগ করুন
                </Button>
              </div>
              {(row.benefits ?? []).map((b, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[120px_1fr_1fr_auto]">
                  <Input
                    placeholder="আইকন (sprout/leaf/package/truck/shield/sun)"
                    value={b.icon ?? ""}
                    onChange={(e) =>
                      patch({
                        benefits: (row.benefits ?? []).map((v, idx) =>
                          idx === i ? { ...v, icon: e.target.value as Benefit["icon"] } : v,
                        ),
                      })
                    }
                  />
                  <Input
                    placeholder="টাইটেল"
                    value={b.title}
                    onChange={(e) =>
                      patch({
                        benefits: (row.benefits ?? []).map((v, idx) =>
                          idx === i ? { ...v, title: e.target.value } : v,
                        ),
                      })
                    }
                  />
                  <Input
                    placeholder="বর্ণনা"
                    value={b.text}
                    onChange={(e) =>
                      patch({
                        benefits: (row.benefits ?? []).map((v, idx) =>
                          idx === i ? { ...v, text: e.target.value } : v,
                        ),
                      })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      patch({ benefits: (row.benefits ?? []).filter((_, idx) => idx !== i) })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </Card>

            <Card className="flex flex-col gap-4 p-4">
              <h2 className="font-semibold">বিস্তারিত ও ব্যবহারবিধি</h2>
              <StringList
                label="বর্ণনার প্যারাগ্রাফ"
                multiline
                items={row.description ?? []}
                onChange={(description) => patch({ description })}
              />
              <StringList
                label="ব্যবহারবিধির ধাপ"
                items={row.usage_steps ?? []}
                onChange={(usage_steps) => patch({ usage_steps })}
              />
            </Card>

            <Card className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">রিভিউ</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    patch({
                      reviews: [
                        ...(row.reviews ?? []),
                        { name: "", location: "", rating: 5, text: "" } as Review,
                      ],
                    })
                  }
                >
                  <Plus className="mr-1 size-3.5" /> যোগ করুন
                </Button>
              </div>
              {(row.reviews ?? []).map((r, i) => {
                const upd = (p: Partial<Review>) =>
                  patch({
                    reviews: (row.reviews ?? []).map((v, idx) => (idx === i ? { ...v, ...p } : v)),
                  });
                return (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
                      <Input placeholder="নাম" value={r.name} onChange={(e) => upd({ name: e.target.value })} />
                      <Input
                        placeholder="এলাকা"
                        value={r.location}
                        onChange={(e) => upd({ location: e.target.value })}
                      />
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={r.rating}
                        onChange={(e) => upd({ rating: Number(e.target.value) })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          patch({ reviews: (row.reviews ?? []).filter((_, idx) => idx !== i) })
                        }
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea rows={2} value={r.text} onChange={(e) => upd({ text: e.target.value })} />
                  </div>
                );
              })}
            </Card>

            <Card className="flex flex-col gap-4 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">প্রশ্নোত্তর</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patch({ faqs: [...(row.faqs ?? []), { q: "", a: "" } as Faq] })}
                >
                  <Plus className="mr-1 size-3.5" /> যোগ করুন
                </Button>
              </div>
              {(row.faqs ?? []).map((f, i) => {
                const upd = (p: Partial<Faq>) =>
                  patch({ faqs: (row.faqs ?? []).map((v, idx) => (idx === i ? { ...v, ...p } : v)) });
                return (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex gap-2">
                      <Input placeholder="প্রশ্ন" value={f.q} onChange={(e) => upd({ q: e.target.value })} />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => patch({ faqs: (row.faqs ?? []).filter((_, idx) => idx !== i) })}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <Textarea rows={2} value={f.a} onChange={(e) => upd({ a: e.target.value })} />
                  </div>
                );
              })}
            </Card>
          </div>

          <Card className="flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-4">
            <h2 className="font-semibold">সেকশনের ক্রম ও চালু/বন্ধ</h2>
            {(row.sections ?? defaultSections).map((s, i) => (
              <div key={s.key} className="flex items-center gap-2 rounded-lg border p-2">
                <div className="flex flex-col">
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => moveSection(i, -1)}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-6" onClick={() => moveSection(i, 1)}>
                    <ArrowDown className="size-3.5" />
                  </Button>
                </div>
                <span className="flex-1 text-sm">{SECTION_LABELS[s.key]}</span>
                <Switch
                  checked={s.enabled}
                  onCheckedChange={(enabled) =>
                    patch({
                      sections: (row.sections ?? defaultSections).map((v, idx) =>
                        idx === i ? { ...v, enabled } : v,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              প্রিভিউ দেখতে: /product/{slug}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
