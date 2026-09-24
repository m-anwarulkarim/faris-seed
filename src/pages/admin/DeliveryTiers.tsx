import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Truck, Save, MapPin } from "lucide-react";
import {
  DEFAULT_TIERS,
  DEFAULT_DHAKA,
  DeliveryTier,
  DhakaConfig,
  loadDeliveryTiers,
  saveDeliveryTiers,
  loadDhakaConfig,
  saveDhakaConfig,
  loadTiersEnabled,
  saveTiersEnabled,
} from "@/lib/deliveryTiers";


export default function DeliveryTiers() {
  const [tiers, setTiers] = useState<DeliveryTier[]>(DEFAULT_TIERS);
  const [dhaka, setDhaka] = useState<DhakaConfig>(DEFAULT_DHAKA);
  const [tiersEnabled, setTiersEnabled] = useState<boolean>(true);
  const [togglingTiers, setTogglingTiers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDhaka, setSavingDhaka] = useState(false);

  useEffect(() => {
    Promise.all([loadDeliveryTiers(), loadDhakaConfig(), loadTiersEnabled()])
      .then(([t, d, te]) => { setTiers(t); setDhaka(d); setTiersEnabled(te); })
      .finally(() => setLoading(false));
  }, []);

  const handleToggleTiers = async (next: boolean) => {
    setTogglingTiers(true);
    setTiersEnabled(next);
    try {
      await saveTiersEnabled(next);
      toast.success(next ? "সাবটোটাল টিয়ার চালু" : "সাবটোটাল টিয়ার বন্ধ");
    } catch (e: any) {
      setTiersEnabled(!next);
      toast.error(e?.message || "সেভ ব্যর্থ");
    } finally {
      setTogglingTiers(false);
    }
  };


  const updateTier = (idx: number, field: keyof DeliveryTier, raw: string) => {
    const num = Number(raw);
    setTiers((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, [field]: Number.isFinite(num) && num >= 0 ? num : 0 } : t
      )
    );
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const nextThreshold = last ? last.threshold + 200 : 0;
    setTiers((prev) => [...prev, { threshold: nextThreshold, charge: 0 }]);
  };

  const removeTier = (idx: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (tiers.length === 0) {
      toast.error("কমপক্ষে একটি স্তর প্রয়োজন");
      return;
    }
    setSaving(true);
    try {
      const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold);
      await saveDeliveryTiers(sorted);
      setTiers(sorted);
      toast.success("সাবটোটাল টিয়ার সেভ হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "সেভ করতে সমস্যা হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDhaka = async () => {
    setSavingDhaka(true);
    try {
      await saveDhakaConfig(dhaka);
      toast.success("লোকেশন চার্জ সেভ হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "সেভ করতে সমস্যা হয়েছে");
    } finally {
      setSavingDhaka(false);
    }
  };

  const resetDefaults = () => setTiers(DEFAULT_TIERS);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Truck className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">ডেলিভারি চার্জ সেটিংস</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        চূড়ান্ত নিয়ম: <b>ফ্রি ডেলিভারি &gt; লোকেশন চার্জ &gt; সাবটোটাল টিয়ার</b>।
        অর্থাৎ subtotal-এ free unlock হলে ০৳, না হলে লোকেশন চালু থাকলে ঢাকা ভিতরে/বাইরে যেটা কাস্টমার বেছে নেবে সেটাই চার্জ হবে।
      </p>

      {/* ============ Location-based ============ */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">লোকেশন-ভিত্তিক চার্জ (ঢাকা)</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="font-medium text-sm">লোকেশন চার্জ চালু করুন</div>
            <div className="text-xs text-muted-foreground">
              অফ থাকলে শুধু সাবটোটাল টিয়ার চার্জ ব্যবহার হবে।
            </div>
          </div>
          <Switch
            checked={dhaka.enabled}
            onCheckedChange={(v) => setDhaka((d) => ({ ...d, enabled: v }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">ঢাকার মধ্যে (৳)</Label>
            <Input
              type="number"
              min={0}
              value={dhaka.inside}
              onChange={(e) => setDhaka((d) => ({ ...d, inside: Math.max(0, Number(e.target.value) || 0) }))}
              disabled={!dhaka.enabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ঢাকার বাইরে (৳)</Label>
            <Input
              type="number"
              min={0}
              value={dhaka.outside}
              onChange={(e) => setDhaka((d) => ({ ...d, outside: Math.max(0, Number(e.target.value) || 0) }))}
              disabled={!dhaka.enabled}
            />
          </div>
        </div>

        <Button onClick={handleSaveDhaka} disabled={savingDhaka} className="w-full">
          <Save className="w-4 h-4 mr-1" />
          {savingDhaka ? "সেভ হচ্ছে…" : "লোকেশন সেটিংস সেভ করুন"}
        </Button>
      </Card>

      {/* ============ Subtotal Tiers ============ */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">সাবটোটাল-ভিত্তিক টিয়ার</h2>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="font-medium text-sm">সাবটোটাল টিয়ার চালু করুন</div>
            <div className="text-xs text-muted-foreground">
              অফ থাকলে subtotal-ভিত্তিক চার্জ ও ফ্রি ডেলিভারি threshold প্রযোজ্য হবে না — শুধু লোকেশন চার্জ (অথবা ০৳) ব্যবহার হবে।
            </div>
          </div>
          <Switch
            checked={tiersEnabled}
            disabled={togglingTiers}
            onCheckedChange={handleToggleTiers}
          />
        </div>

        <p className={`text-xs text-muted-foreground ${tiersEnabled ? "" : "opacity-50"}`}>
          কত টাকার অর্ডারে ডেলিভারি চার্জ কত হবে। সর্বশেষ স্তরের charge 0 দিলে সেটাই ফ্রি ডেলিভারি unlock পয়েন্ট।
        </p>


        {loading ? (
          <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-semibold text-muted-foreground">
              <span>অর্ডার সাবটোটাল (৳ থেকে)</span>
              <span>ডেলিভারি চার্জ (৳)</span>
              <span></span>
            </div>

            {tiers.map((tier, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <Input
                  type="number"
                  min={0}
                  value={tier.threshold}
                  onChange={(e) => updateTier(idx, "threshold", e.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  value={tier.charge}
                  onChange={(e) => updateTier(idx, "charge", e.target.value)}
                  placeholder="0 = ফ্রি"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTier(idx)}
                  disabled={tiers.length <= 1}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addTier} className="w-full">
              <Plus className="w-4 h-4 mr-1" /> নতুন স্তর যোগ করুন
            </Button>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="w-4 h-4 mr-1" />
                {saving ? "সেভ হচ্ছে…" : "টিয়ার সেভ করুন"}
              </Button>
              <Button variant="outline" onClick={resetDefaults} disabled={saving}>
                ডিফল্ট
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
