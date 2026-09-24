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

export type ContactMethod = {
  icon: string; // lucide icon name
  title: string;
  description: string;
  action: string;
  href: string;
  enabled: boolean;
};

export type ContactPageConfig = {
  badge: string;
  heading: string;
  headingHighlight: string;
  subtitle: string;
  methods: ContactMethod[];
};

const DEFAULT_CONFIG: ContactPageConfig = {
  badge: "যোগাযোগ মাধ্যম",
  heading: "আমাদের সাথে",
  headingHighlight: "সহজে যোগাযোগ",
  subtitle:
    "অর্ডার, ডেলিভারি, পণ্য সম্পর্কিত তথ্য বা যেকোনো সহায়তার জন্য নিচের যেকোনো মাধ্যমে যোগাযোগ করতে পারেন। আমরা দ্রুত এবং আন্তরিকভাবে সাড়া দেওয়ার চেষ্টা করি।",
  methods: [
    { icon: "MessageCircle", title: "WhatsApp এ যোগাযোগ", description: "যেকোনো অভিযোগ, পরামর্শ বা গ্যারান্টি সুবিধার জন্য আমাদের হোয়াটসঅ্যাপে মেসেজ দিন; ২৪ ঘণ্টার মধ্যেই আমরা সমাধান নিশ্চিত করা হবে।", action: "WhatsApp", href: "https://wa.me/8801708356800?text=Assalamu%20Alaikum", enabled: true },
    { icon: "Phone", title: "ফোনে সরাসরি কথা বলুন", description: "জরুরি প্রয়োজন হলে সরাসরি কল করুন। সময়: সকাল ৯টা থেকে রাত ১১টা।", action: "09617443377", href: "tel:09617443377", enabled: true },
    { icon: "Facebook", title: "Facebook Page", description: "আমাদের অফিসিয়াল Facebook Page-এ ইনবক্স করে পণ্য, অফার এবং আপডেট সম্পর্কে জানতে পারেন।", action: "facebook.com/grihanova", href: "https://www.facebook.com/grihanova", enabled: true },
    { icon: "MessagesSquare", title: "Messenger এ চ্যাট করুন", description: "Messenger এর মাধ্যমে সহজে যোগাযোগ করুন এবং আপনার প্রশ্নের দ্রুত উত্তর পান।", action: "Messenger Chat", href: "https://m.me/grihanova", enabled: true },
    { icon: "Mail", title: "Email করুন", description: "বিস্তারিত তথ্য, ব্যবসায়িক যোগাযোগ বা বিশেষ প্রয়োজনে আমাদের ইমেইল করতে পারেন।", action: "hello@grihanova.com", href: "mailto:hello@grihanova.com", enabled: true },
    { icon: "MapPin", title: "আমাদের ঠিকানা", description: "প্রয়োজনে আমাদের লোকেশন দেখে সরাসরি যোগাযোগ বা অফিস সংক্রান্ত তথ্য জানতে পারেন।", action: "Debiganj, Panchagarh, Bangladesh", href: "https://maps.google.com/?q=Debiganj,Panchagarh", enabled: true },
  ],
};

const ICON_OPTIONS = ["MessageCircle", "Phone", "Facebook", "MessagesSquare", "Mail", "MapPin", "Globe", "Send", "Link"];

const ContactPageEditor = () => {
  const [cfg, setCfg] = useState<ContactPageConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "contact_page_config")
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (parsed && Array.isArray(parsed.methods)) setCfg({ ...DEFAULT_CONFIG, ...parsed });
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const updateMethod = (i: number, patch: Partial<ContactMethod>) =>
    setCfg((p) => ({ ...p, methods: p.methods.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }));

  const removeMethod = (i: number) => setCfg((p) => ({ ...p, methods: p.methods.filter((_, idx) => idx !== i) }));
  const moveMethod = (i: number, dir: -1 | 1) =>
    setCfg((p) => {
      const arr = [...p.methods];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return p;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...p, methods: arr };
    });
  const addMethod = () =>
    setCfg((p) => ({
      ...p,
      methods: [...p.methods, { icon: "MessageCircle", title: "নতুন মাধ্যম", description: "", action: "", href: "", enabled: true }],
    }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "contact_page_config", value: JSON.stringify(cfg) }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("সেভ ব্যর্থ: " + error.message);
    else toast.success("Contact পেজ সেভ হয়েছে");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Contact পেজ এডিটর</h1>
        <p className="text-sm text-muted-foreground mt-1">/contact পেজের হেডার ও যোগাযোগ কার্ডগুলো এখান থেকে কন্ট্রোল করুন।</p>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">হেডার সেকশন</h2>
        <div>
          <Label className="text-xs">ব্যাজ টেক্সট</Label>
          <Input value={cfg.badge} onChange={(e) => setCfg({ ...cfg, badge: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">হেডিং (সাধারণ অংশ)</Label>
            <Input value={cfg.heading} onChange={(e) => setCfg({ ...cfg, heading: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">হেডিং (হাইলাইট অংশ)</Label>
            <Input value={cfg.headingHighlight} onChange={(e) => setCfg({ ...cfg, headingHighlight: e.target.value })} />
          </div>
        </div>
        <div>
          <Label className="text-xs">সাবটাইটেল</Label>
          <Textarea rows={3} value={cfg.subtitle} onChange={(e) => setCfg({ ...cfg, subtitle: e.target.value })} />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">যোগাযোগ কার্ড ({cfg.methods.length})</h2>
        <Button size="sm" variant="outline" onClick={addMethod}>
          <Plus className="w-4 h-4 mr-1" /> যোগ করুন
        </Button>
      </div>

      {cfg.methods.map((m, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
              <Switch checked={m.enabled} onCheckedChange={(v) => updateMethod(i, { enabled: v })} />
              <span className="text-xs text-muted-foreground">{m.enabled ? "দেখানো হচ্ছে" : "লুকানো"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => moveMethod(i, -1)}><ArrowUp className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => moveMethod(i, 1)}><ArrowDown className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => removeMethod(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">আইকন</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={m.icon}
                onChange={(e) => updateMethod(i, { icon: e.target.value })}
              >
                {ICON_OPTIONS.map((ic) => (
                  <option key={ic} value={ic}>{ic}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">শিরোনাম</Label>
              <Input value={m.title} onChange={(e) => updateMethod(i, { title: e.target.value })} />
            </div>
          </div>

          <div>
            <Label className="text-xs">বিবরণ</Label>
            <Textarea rows={2} value={m.description} onChange={(e) => updateMethod(i, { description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">অ্যাকশন লেবেল</Label>
              <Input value={m.action} onChange={(e) => updateMethod(i, { action: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">লিঙ্ক (href)</Label>
              <Input
                value={m.href}
                onChange={(e) => updateMethod(i, { href: e.target.value })}
                placeholder="https:// , tel: , mailto: , https://wa.me/ ..."
              />
            </div>
          </div>
        </Card>
      ))}

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        সেভ করুন
      </Button>
    </div>
  );
};

export default ContactPageEditor;
export { DEFAULT_CONFIG };
