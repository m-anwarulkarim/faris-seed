import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const SANDBOX_DEMO = {
  app_key: "4f6o0cjiki2rfm34kfdadl1eqq",
  app_secret: "2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b",
  username: "sandboxTokenizedUser02",
  password: "sandboxTokenizedUser02@12345",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function BkashApiDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [discountPercent, setDiscountPercent] = useState<string>("2");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any).from("bkash_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setEnabled(!!data.enabled);
        setMode((data.mode as "sandbox" | "live") || "sandbox");
        setAppKey(data.app_key || "");
        setAppSecret(data.app_secret || "");
        setUsername(data.username || "");
        setPassword(data.password || "");
        setDiscountPercent(String(data.discount_percent ?? 2));
      }
    })();
  }, [open]);

  const loadSandboxDemo = () => {
    setMode("sandbox");
    setAppKey(SANDBOX_DEMO.app_key);
    setAppSecret(SANDBOX_DEMO.app_secret);
    setUsername(SANDBOX_DEMO.username);
    setPassword(SANDBOX_DEMO.password);
    toast.success("Sandbox demo credentials লোড হয়েছে");
  };

  const save = async () => {
    setLoading(true);
    const { error } = await (supabase as any)
      .from("bkash_settings")
      .upsert({
        id: 1,
        enabled,
        mode,
        app_key: appKey,
        app_secret: appSecret,
        username,
        password,
        discount_percent: Number(discountPercent) || 0,
        token_cache: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("সেভ হয়েছে");
  };

  const test = async () => {
    setTesting(true);
    // save first so edge fn reads latest
    await save();
    const { data, error } = await supabase.functions.invoke("bkash-pgw/test-connection", { body: {} });
    setTesting(false);
    if (error || !data?.ok) {
      toast.error("সংযোগ ব্যর্থ: " + (data?.error || error?.message || "unknown"));
    } else {
      toast.success("সংযোগ সফল — Token issued");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>bKash Payment Gateway</DialogTitle>
          <DialogDescription>Tokenized Checkout (PGW) credentials</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Enable bKash</p>
              <p className="text-xs text-muted-foreground">কাস্টমার চেকআউটে দেখাবে</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="sandbox" /> Sandbox (Test)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="live" /> Live
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>App Key</Label>
            <Input value={appKey} onChange={(e) => setAppKey(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>App Secret</Label>
            <Input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Discount (%) — চেকআউটে bKash ব্যবহারে ছাড়</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="2"
            />
            <p className="text-xs text-muted-foreground">০ দিলে কোনো ছাড় থাকবে না।</p>
          </div>


          <Button variant="outline" size="sm" onClick={loadSandboxDemo} className="w-full">
            Sandbox Demo Credentials লোড করুন
          </Button>

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Sandbox Test Customer:</p>
            <p>📱 01770618567 | OTP: 123456 | PIN: 12121</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={test} variant="outline" disabled={testing} className="flex-1">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span className="ml-2">Test Connection</span>
            </Button>
            <Button onClick={save} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="ml-2">Save</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
