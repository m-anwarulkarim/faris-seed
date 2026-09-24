import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Truck, Loader2, Save, PlugZap } from "lucide-react";
import { toast } from "sonner";

const PATHAO_KEYS = [
  "pathao_base_url",
  "pathao_client_id",
  "pathao_client_secret",
  "pathao_username",
  "pathao_password",
  "pathao_store_id",
  "pathao_default_item_weight",
  "pathao_default_note",
] as const;

type PathaoSettings = Record<(typeof PATHAO_KEYS)[number], string>;

const PATHAO_PRODUCTION_URL = "https://api-hermes.pathao.com";
const PATHAO_SANDBOX_URL = "https://courier-api-sandbox.pathao.com";

const EMPTY: PathaoSettings = PATHAO_KEYS.reduce((acc, k) => ({ ...acc, [k]: "" }), {} as PathaoSettings);

export function PathaoApiDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [form, setForm] = useState<PathaoSettings>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: saved, isLoading } = useQuery({
    queryKey: ["app-settings-pathao"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .like("key", "pathao_%");
      if (error) throw error;
      const m: Record<string, string> = {};
      data?.forEach((r) => { m[r.key] = r.value; });
      return m;
    },
  });

  useEffect(() => {
    if (!saved) return;
    const next = { ...EMPTY } as PathaoSettings;
    PATHAO_KEYS.forEach((k) => { (next as any)[k] = saved[k] || ""; });
    if (!next.pathao_base_url) next.pathao_base_url = PATHAO_PRODUCTION_URL;
    if (!next.pathao_default_item_weight) next.pathao_default_item_weight = "0.5";
    setForm(next);
  }, [saved]);

  const update = (k: keyof PathaoSettings, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.pathao_client_id || !form.pathao_client_secret || !form.pathao_username || !form.pathao_password) {
      toast.error(t("Client ID, Secret, Username ও Password আবশ্যক", "Client ID, Secret, Username and Password are required"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("pathao-courier", {
        body: { action: "update_settings", settings: form },
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["app-settings-pathao"] });
      qc.invalidateQueries({ queryKey: ["pathao-status"] });
      toast.success(t("Pathao সেটিংস সেভ হয়েছে", "Pathao settings saved"));
    } catch (e: any) {
      toast.error(e?.message || t("সেভ ব্যর্থ", "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("pathao-courier", {
        body: { action: "test_connection" },
      });
      if (error) throw error;
      const msg = data?.message || (data?.success ? "OK" : "Failed");
      setTestResult(msg + (data?.stores?.length ? ` — ${data.stores.length} store(s) found` : ""));
      data?.success ? toast.success(msg) : toast.error(msg);
    } catch (e: any) {
      const m = e?.message || "Connection failed";
      setTestResult(m);
      toast.error(m);
    } finally {
      setTesting(false);
    }
  };

  const field = (key: keyof PathaoSettings, label: string, opts?: { type?: string; placeholder?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={opts?.type || "text"}
        value={(form as any)[key] || ""}
        onChange={(e) => update(key, e.target.value)}
        placeholder={opts?.placeholder}
        className="h-9 text-sm"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {t("Pathao কুরিয়ার API", "Pathao Courier API")}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Base URL</Label>
              <Input
                value={form.pathao_base_url}
                onChange={(e) => update("pathao_base_url", e.target.value)}
                placeholder={PATHAO_PRODUCTION_URL}
                className="h-9 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => update("pathao_base_url", PATHAO_PRODUCTION_URL)}>
                  Production
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => update("pathao_base_url", PATHAO_SANDBOX_URL)}>
                  Sandbox
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("Live Pathao হলে Production, test credential হলে Sandbox দিন।", "Use Production for live Pathao credentials, Sandbox for test credentials.")}
              </p>
            </div>
            {field("pathao_client_id", "API Key")}
            <div className="space-y-1.5">
              <Label className="text-xs">Secret Key</Label>
              <Input
                type="password"
                value={form.pathao_client_secret}
                onChange={(e) => update("pathao_client_secret", e.target.value)}
                className="h-9 text-sm"
                autoComplete="new-password"
              />
            </div>
            {field("pathao_username", "Username")}
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input
                type="password"
                value={form.pathao_password}
                onChange={(e) => update("pathao_password", e.target.value)}
                className="h-9 text-sm"
                autoComplete="new-password"
              />
            </div>

            {field("pathao_store_id", "Store Id", { type: "number" })}
            <div className="space-y-1.5">
              <Label className="text-xs">Special Instruction</Label>
              <Input
                value={form.pathao_default_note}
                onChange={(e) => update("pathao_default_note", e.target.value)}
                placeholder={t("রাইডার নোট", "Rider note")}
                className="h-9 text-sm"
              />
            </div>


            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t("সেভ করুন", "Save")}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing} className="gap-1.5">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
                {t("কানেকশন টেস্ট", "Test Connection")}
              </Button>
              {testResult && (
                <Badge variant="outline" className="text-[11px] ml-auto max-w-full truncate">{testResult}</Badge>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
