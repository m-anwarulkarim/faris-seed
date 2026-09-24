import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Star, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";

type Who = "anyone" | "login" | "order";
type Settings = {
  review_who: Who;
  qa_who: Who;
  review_approval: boolean;
  qa_approval: boolean;
};

const DEFAULTS: Settings = {
  review_who: "login",
  qa_who: "anyone",
  review_approval: true,
  qa_approval: true,
};

const WHO_OPTIONS: { value: Who; label: string; desc: string }[] = [
  { value: "anyone", label: "যে কেউ", desc: "লগইন ছাড়াই, শুধু নাম দিয়ে" },
  { value: "login", label: "লগইন করা ইউজার", desc: "প্রোফাইল থাকা যেকোনো ইউজার" },
  { value: "order", label: "অর্ডার করেছে এমন", desc: "শুধু কনফার্মড অর্ডার আছে এমন" },
];

const ReviewQASettings = () => {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "review_qa_settings")
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
          setS({ ...DEFAULTS, ...parsed });
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "review_qa_settings", value: JSON.stringify(s) }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error("সেভ ব্যর্থ: " + error.message);
    else toast.success("সেভ হয়েছে");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const WhoPicker = ({
    value,
    onChange,
  }: {
    value: Who;
    onChange: (v: Who) => void;
  }) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {WHO_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-left rounded-lg border-2 p-3 transition ${
            value === opt.value
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40"
          }`}
        >
          <div className="text-sm font-semibold">{opt.label}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Review & Q&A সেটিংস</h1>
        <p className="text-sm text-muted-foreground mt-1">
          কে রিভিউ ও প্রশ্ন দিতে পারবে এবং সেগুলো অটো-প্রকাশ হবে কিনা সেটা এখান থেকে কন্ট্রোল করুন।
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Star className="w-5 h-5 text-yellow-500" />
          ⭐ রিভিউ
        </div>
        <div>
          <Label className="text-xs mb-2 block">কে রিভিউ দিতে পারবে?</Label>
          <WhoPicker value={s.review_who} onChange={(v) => setS({ ...s, review_who: v })} />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <div className="text-sm font-semibold">অ্যাডমিন অ্যাপ্রুভাল লাগবে</div>
            <div className="text-[11px] text-muted-foreground">
              অফ থাকলে রিভিউ সাথে সাথে প্রকাশ হবে
            </div>
          </div>
          <Switch
            checked={s.review_approval}
            onCheckedChange={(v) => setS({ ...s, review_approval: v })}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <MessageCircleQuestion className="w-5 h-5 text-blue-500" />
          💬 প্রশ্ন
        </div>
        <div>
          <Label className="text-xs mb-2 block">কে প্রশ্ন দিতে পারবে?</Label>
          <WhoPicker value={s.qa_who} onChange={(v) => setS({ ...s, qa_who: v })} />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <div className="text-sm font-semibold">অ্যাডমিন অ্যাপ্রুভাল লাগবে</div>
            <div className="text-[11px] text-muted-foreground">
              অফ থাকলে প্রশ্ন সাথে সাথে প্রকাশ হবে
            </div>
          </div>
          <Switch
            checked={s.qa_approval}
            onCheckedChange={(v) => setS({ ...s, qa_approval: v })}
          />
        </div>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        সেভ করুন
      </Button>
    </div>
  );
};

export default ReviewQASettings;
