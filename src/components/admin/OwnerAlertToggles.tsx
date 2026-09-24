import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Bell, ShoppingCart, Star, MessageSquare, AlertTriangle, Users, Crown, Package, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES: Array<{ key: string; bn: string; en: string; Icon: any }> = [
  { key: "new_order", bn: "নতুন অর্ডার (10 এ 1 ব্যাচ)", en: "New orders (batched per 10)", Icon: ShoppingCart },
  { key: "new_review", bn: "নতুন রিভিউ", en: "New product review", Icon: Star },
  { key: "stock_out", bn: "স্টক-আউট অ্যালার্ট", en: "Stock-out alert", Icon: Package },
  { key: "watched_user", bn: "Watched user activity", en: "Watched user activity", Icon: ShieldAlert },
];

export function OwnerAlertToggles() {
  const { t } = useLanguage();
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const keys = CATEGORIES.map(c => `owner_alert_${c.key}`);
      const { data } = await supabase.from("app_settings").select("key,value").in("key", keys);
      const m: Record<string, boolean> = {};
      for (const c of CATEGORIES) {
        const row = data?.find((r: any) => r.key === `owner_alert_${c.key}`);
        const v = row?.value?.toString().toLowerCase();
        m[c.key] = !(v && ["false", "0", "off", "no"].includes(v));
      }
      setValues(m);
    })();
  }, []);

  const toggle = async (key: string, next: boolean) => {
    setBusy(key);
    setValues(v => ({ ...v, [key]: next }));
    const { error } = await supabase.from("app_settings").upsert(
      { key: `owner_alert_${key}`, value: next ? "true" : "false", updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setBusy(null);
    if (error) {
      setValues(v => ({ ...v, [key]: !next }));
      toast.error(t("সেভ ব্যর্থ হয়েছে", "Failed to save"));
    } else {
      toast.success(next ? t("চালু করা হয়েছে", "Enabled") : t("বন্ধ করা হয়েছে", "Disabled"));
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("Owner Alert SMS কন্ট্রোল", "Owner Alert SMS Controls")}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t("01708356800 নম্বরে কোন কোন SMS আসবে তা এখানে চালু/বন্ধ করুন।", "Choose which alert SMS get sent to 01708356800.")}
      </p>
      <div className="divide-y divide-border">
        {CATEGORIES.map(({ key, bn, en, Icon }) => (
          <div key={key} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate">{t(bn, en)}</span>
            </div>
            <Switch
              checked={!!values[key]}
              disabled={busy === key}
              onCheckedChange={(v) => toggle(key, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
