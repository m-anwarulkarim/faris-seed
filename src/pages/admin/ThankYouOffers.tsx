import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getCatalog } from "@/data/product-store";
import {
  loadThankYouOffers,
  saveThankYouOffers,
  type ThankYouOffer,
} from "@/lib/thankYouOffers";

function newId() {
  return `offer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const ThankYouOffers = () => {
  const [offers, setOffers] = useState<ThankYouOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const catalog = getCatalog();

  useEffect(() => {
    loadThankYouOffers()
      .then(setOffers)
      .finally(() => setLoading(false));
  }, []);

  // Auto-save so admins never lose changes by forgetting the save button
  useEffect(() => {
    if (loading || !dirty) return;
    const t = setTimeout(async () => {
      const invalid = offers.find((o) => !o.name.trim() || !(o.price > 0));
      if (invalid) return;
      try {
        await saveThankYouOffers(offers);
        setDirty(false);
      } catch (e) {
        toast.error("অটো-সেভ ব্যর্থ: " + (e as Error).message);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [offers, dirty, loading]);

  function update(id: string, patch: Partial<ThankYouOffer>) {
    setDirty(true);
    setOffers((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function addBlank() {
    setDirty(true);
    setOffers((list) => [
      ...list,
      { id: newId(), name: "", image: "", price: 0, oldPrice: null, active: true },
    ]);
  }

  function addFromCatalog(slug: string) {
    const p = catalog.find((c) => c.slug === slug);
    if (!p) return;
    setDirty(true);
    setOffers((list) => [
      ...list,
      {
        id: newId(),
        name: p.name,
        image: p.image,
        price: Math.max(1, Math.round(p.price * 0.7)),
        oldPrice: p.price,
        active: true,
      },
    ]);
  }

  async function save() {
    const bad = offers.find((o) => !o.name.trim() || !(o.price > 0));
    if (bad) {
      toast.error("প্রতিটি অফারে নাম ও দাম দিতে হবে");
      return;
    }
    setSaving(true);
    try {
      await saveThankYouOffers(offers);
      setDirty(false);
      toast.success("সেভ হয়েছে");
    } catch (e) {
      toast.error("সেভ ব্যর্থ: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">থ্যাংক-ইউ পেজ অফার</h1>
          <p className="text-sm text-muted-foreground">
            অর্ডার শেষে কাস্টমার এই প্রোডাক্টগুলো কম দামে একই অর্ডারে যোগ করতে পারবে।
          </p>
          <p className="mt-1 text-xs font-semibold text-primary">
            {dirty ? "সেভ হচ্ছে..." : "সব পরিবর্তন সেভ হয়েছে"} · শুধু "দেখাবে" চালু থাকা অফারগুলো পেজে দেখাবে
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addBlank}>
            <Plus className="mr-1 h-4 w-4" /> নতুন অফার
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            সেভ করুন
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <Label className="text-sm">ক্যাটালগ থেকে যোগ করুন</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {catalog.map((p) => (
            <Button key={p.slug} size="sm" variant="secondary" onClick={() => addFromCatalog(p.slug)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {p.name}
            </Button>
          ))}
        </div>
      </Card>

      {offers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          এখনো কোনো অফার যোগ করা হয়নি।
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex items-center gap-3">
                  <img
                    src={o.image || "/placeholder.svg"}
                    alt={o.name || "offer"}
                    className="h-16 w-16 rounded-lg border object-cover"
                  />
                </div>
                <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-xs">প্রোডাক্টের নাম</Label>
                    <Input value={o.name} onChange={(e) => update(o.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">ছবির লিংক</Label>
                    <Input value={o.image} onChange={(e) => update(o.id, { image: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">অফার দাম (৳)</Label>
                    <Input
                      type="number"
                      value={o.price}
                      onChange={(e) => update(o.id, { price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">আগের দাম (৳)</Label>
                    <Input
                      type="number"
                      value={o.oldPrice ?? ""}
                      onChange={(e) =>
                        update(o.id, { oldPrice: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={o.active}
                      onCheckedChange={(v) => update(o.id, { active: v })}
                    />
                    <span className="text-xs text-muted-foreground">দেখাবে</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setDirty(true);
                      setOffers((l) => l.filter((x) => x.id !== o.id));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThankYouOffers;
