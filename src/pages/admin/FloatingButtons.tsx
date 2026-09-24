import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Phone, MessagesSquare, Save } from "lucide-react";
import { toast } from "sonner";

export type FloatingBtn = {
  id: "whatsapp" | "messenger" | "call";
  label: string;
  value: string;
  enabled: boolean;
};

const DEFAULTS: FloatingBtn[] = [
  { id: "whatsapp", label: "WhatsApp", value: "8801708356800", enabled: true },
  { id: "messenger", label: "Messenger", value: "grihanova.bd", enabled: true },
  { id: "call", label: "Call", value: "01708356800", enabled: true },
];

const HINT: Record<FloatingBtn["id"], string> = {
  whatsapp: "WhatsApp নম্বর (country code সহ, যেমন 8801708356800)",
  messenger: "Facebook Page username (যেমন grihanova.bd)",
  call: "ফোন নম্বর (যেমন 01708356800)",
};

const ICONS: Record<FloatingBtn["id"], any> = {
  whatsapp: MessagesSquare,
  messenger: MessageCircle,
  call: Phone,
};

const FloatingButtons = () => {
  const [items, setItems] = useState<FloatingBtn[]>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "floating_contact_buttons")
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length) setItems(parsed);
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const update = (i: number, patch: Partial<FloatingBtn>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "floating_contact_buttons", value: JSON.stringify(items) }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("সেভ ব্যর্থ: " + error.message);
    } else {
      toast.success("সেভ হয়েছে");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Floating Buttons</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ওয়েবসাইটের নিচে ডান-পাশে থাকা ভাসমান কন্টাক্ট বাটনগুলো এখান থেকে কন্ট্রোল করুন।
        </p>
      </div>

      {items.map((it, i) => {
        const Icon = ICONS[it.id];
        return (
          <Card key={it.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <div className="font-semibold">{it.label}</div>
                  <div className="text-xs text-muted-foreground capitalize">{it.id}</div>
                </div>
              </div>
              <Switch checked={it.enabled} onCheckedChange={(v) => update(i, { enabled: v })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={it.label} onChange={(e) => update(i, { label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input
                  value={it.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder={HINT[it.id]}
                />
                <p className="text-[11px] text-muted-foreground mt-1">{HINT[it.id]}</p>
              </div>
            </div>
          </Card>
        );
      })}

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        সেভ করুন
      </Button>
    </div>
  );
};

export default FloatingButtons;
