import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SETTING_KEY = "order_cooldown_minutes";

export default function OrderCooldown() {
  const [minutes, setMinutes] = useState<number>(300);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTING_KEY)
        .maybeSingle();
      const raw = (data as any)?.value;
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(n) && n >= 0) setMinutes(n);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!Number.isFinite(minutes) || minutes < 0) {
      toast.error("সঠিক সময় (০ বা তার বেশি মিনিট) দিন");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: SETTING_KEY, value: minutes as any }, { onConflict: "key" });
      if (error) throw error;
      toast.success("অর্ডার কুলডাউন সেভ হয়েছে");
    } catch (e: any) {
      toast.error(e?.message || "সেভ করতে সমস্যা হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-xl">
      <div className="flex items-center gap-2">
        <Clock className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">অর্ডার কুলডাউন</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        একই ফোন নম্বর থেকে পরপর অর্ডার করার মাঝে কত মিনিট অপেক্ষা করতে হবে — এখান থেকে সেট করুন।
        ডিফল্ট ৩০০ মিনিট (৫ ঘণ্টা)। ০ দিলে কুলডাউন বন্ধ থাকবে।
      </p>

      <Card className="p-4 space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="cooldown">কুলডাউন (মিনিট)</Label>
              <Input
                id="cooldown"
                type="number"
                min={0}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
              <p className="text-xs text-muted-foreground">
                ≈ {(minutes / 60).toFixed(2)} ঘণ্টা
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "সেভ হচ্ছে…" : "সেভ করুন"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
