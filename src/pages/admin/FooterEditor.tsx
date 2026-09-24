import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_FOOTER_CONFIG, type FooterConfig, type FooterColumn, type FooterLink } from "@/lib/footerConfig";

const FooterEditor = () => {
  const [cfg, setCfg] = useState<FooterConfig>(DEFAULT_FOOTER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "footer_config").maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (parsed) setCfg({ ...DEFAULT_FOOTER_CONFIG, ...parsed });
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "footer_config", value: JSON.stringify(cfg) }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("সেভ ব্যর্থ: " + error.message);
    else toast.success("ফুটার সেভ হয়েছে");
  };

  const updateColumn = (key: "quickLinks" | "usefulLinks", patch: Partial<FooterColumn>) =>
    setCfg((p) => ({ ...p, [key]: { ...p[key], ...patch } }));

  const updateLink = (key: "quickLinks" | "usefulLinks", i: number, patch: Partial<FooterLink>) =>
    setCfg((p) => ({
      ...p,
      [key]: { ...p[key], links: p[key].links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) },
    }));

  const addLink = (key: "quickLinks" | "usefulLinks") =>
    setCfg((p) => ({ ...p, [key]: { ...p[key], links: [...p[key].links, { label: "নতুন লিংক", href: "#" }] } }));

  const removeLink = (key: "quickLinks" | "usefulLinks", i: number) =>
    setCfg((p) => ({ ...p, [key]: { ...p[key], links: p[key].links.filter((_, idx) => idx !== i) } }));

  const moveLink = (key: "quickLinks" | "usefulLinks", i: number, dir: -1 | 1) =>
    setCfg((p) => {
      const arr = [...p[key].links];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return p;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...p, [key]: { ...p[key], links: arr } };
    });

  if (loading)
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );

  const renderColumn = (key: "quickLinks" | "usefulLinks") => {
    const col = cfg[key];
    return (
      <Card className="p-4 space-y-3">
        <div>
          <Label className="text-xs">কলাম শিরোনাম</Label>
          <Input value={col.title} onChange={(e) => updateColumn(key, { title: e.target.value })} />
        </div>
        <div className="space-y-2">
          {col.links.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-5" value={l.label} placeholder="লেবেল" onChange={(e) => updateLink(key, i, { label: e.target.value })} />
              <Input className="col-span-5" value={l.href} placeholder="/path বা https://..." onChange={(e) => updateLink(key, i, { href: e.target.value })} />
              <div className="col-span-2 flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => moveLink(key, i, -1)}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => moveLink(key, i, 1)}><ArrowDown className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => removeLink(key, i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => addLink(key)}>
          <Plus className="w-4 h-4 mr-1" /> লিংক যোগ করুন
        </Button>
      </Card>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Footer এডিটর</h1>
        <p className="text-sm text-muted-foreground mt-1">ফুটারের টেক্সট, কন্ট্যাক্ট, সোশ্যাল ও লিংক কন্ট্রোল করুন।</p>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">ব্র্যান্ড ও কন্ট্যাক্ট</h2>
        <div>
          <Label className="text-xs">ব্র্যান্ড ট্যাগলাইন</Label>
          <Textarea rows={2} value={cfg.brandTagline} onChange={(e) => setCfg({ ...cfg, brandTagline: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">ইমেইল</Label>
            <Input value={cfg.contactEmail} onChange={(e) => setCfg({ ...cfg, contactEmail: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">ফোন</Label>
            <Input value={cfg.contactPhone} onChange={(e) => setCfg({ ...cfg, contactPhone: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">ঠিকানা</Label>
            <Input value={cfg.contactAddress} onChange={(e) => setCfg({ ...cfg, contactAddress: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">সোশ্যাল লিংক</h2>
        {cfg.socials.map((s, i) => (
          <div key={s.icon} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-3 text-sm font-medium">{s.icon}</div>
            <Input
              className="col-span-7"
              value={s.href}
              onChange={(e) => setCfg({ ...cfg, socials: cfg.socials.map((x, idx) => (idx === i ? { ...x, href: e.target.value } : x)) })}
            />
            <div className="col-span-2 flex justify-end">
              <Switch
                checked={s.enabled}
                onCheckedChange={(v) => setCfg({ ...cfg, socials: cfg.socials.map((x, idx) => (idx === i ? { ...x, enabled: v } : x)) })}
              />
            </div>
          </div>
        ))}
      </Card>

      <h2 className="font-semibold pt-2">দ্রুত লিংক কলাম</h2>
      {renderColumn("quickLinks")}

      <h2 className="font-semibold pt-2">উপকারী লিংক কলাম</h2>
      {renderColumn("usefulLinks")}

      <Card className="p-4 space-y-3">
        <Label className="text-xs">কপিরাইট টেক্সট (<code>{"{year}"}</code> বর্তমান বছর দিয়ে রিপ্লেস হবে)</Label>
        <Input value={cfg.copyright} onChange={(e) => setCfg({ ...cfg, copyright: e.target.value })} />
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        সেভ করুন
      </Button>
    </div>
  );
};

export default FooterEditor;
