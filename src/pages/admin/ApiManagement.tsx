import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Key, Webhook, Copy, Check, Eye, EyeOff, RefreshCw, Truck, Shield, Link2, Save,
  Trash2, Database, Loader2, Settings, MessageSquare, CreditCard, ChevronRight, BarChart3, Code2,
  Bell,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SmsApiDialog } from "@/components/admin/SmsApiDialog";
import { FraudCheckerDialog } from "@/components/admin/FraudCheckerDialog";
import { PixelDialog, GtmDialog, TikTokDialog } from "@/components/admin/TrackingDialog";
import { PathaoApiDialog } from "@/components/admin/PathaoApiDialog";
import { BkashApiDialog } from "@/components/admin/BkashApiDialog";



// ─── Courier API Dialog ───
function CourierApiDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [editingKeys, setEditingKeys] = useState(false);
  const [courierNote, setCourierNote] = useState("");
  const [savedCourierNote, setSavedCourierNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const callbackUrl = `https://${projectId}.supabase.co/functions/v1/steadfast-webhook`;

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ["app-settings-courier"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["steadfast_api_key", "steadfast_secret_key", "steadfast_webhook_token", "steadfast_courier_note"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((r) => { map[r.key] = r.value; });
      return map;
    },
  });

  const savedApiKey = savedSettings?.["steadfast_api_key"] || "";
  const savedSecretKey = savedSettings?.["steadfast_secret_key"] || "";
  const webhookToken = savedSettings?.["steadfast_webhook_token"] || "";

  useEffect(() => {
    if (savedSettings) {
      const note = savedSettings["steadfast_courier_note"] || "";
      setCourierNote(note);
      setSavedCourierNote(note);
    }
  }, [savedSettings]);

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await supabase.from("app_settings").upsert(
        { key: "steadfast_courier_note", value: courierNote.trim(), updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      setSavedCourierNote(courierNote.trim());
      queryClient.invalidateQueries({ queryKey: ["app-settings-courier"] });
      toast.success(t("কুরিয়ার নোট সেভ হয়েছে", "Courier note saved"));
    } catch {
      toast.error(t("সেভ ব্যর্থ", "Save failed"));
    } finally {
      setSavingNote(false);
    }
  };

  const maskValue = (val: string) => {
    if (!val) return "";
    if (val.length <= 8) return "••••••••";
    return val.substring(0, 4) + "••••••••" + val.substring(val.length - 4);
  };

  const hasKeys = !!(savedApiKey && savedSecretKey);

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase.from("app_settings").delete().eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings-courier"] });
      queryClient.invalidateQueries({ queryKey: ["courier-status"] });
      toast.success(t("ডিলিট হয়েছে", "Deleted"));
    },
    onError: () => toast.error(t("ডিলিট ব্যর্থ", "Delete failed")),
  });

  const generateToken = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const token = generateToken();
      const { error } = await supabase.functions.invoke("steadfast-courier", {
        body: { action: "update_webhook_token", token },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["app-settings-courier"] });
      toast.success(t("টোকেন তৈরি ও সেভ হয়েছে", "Token generated and saved"));
    } catch {
      toast.error(t("টোকেন তৈরি ব্যর্থ", "Failed to generate token"));
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleSaveKeys = async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      toast.error(t("উভয় কী প্রয়োজন", "Both keys are required"));
      return;
    }
    setSavingKeys(true);
    try {
      const { error } = await supabase.functions.invoke("steadfast-courier", {
        body: { action: "update_keys", api_key: apiKey, secret_key: secretKey },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["app-settings-courier"] });
      queryClient.invalidateQueries({ queryKey: ["courier-status"] });
      toast.success(t("API কী আপডেট হয়েছে", "API keys updated"));
      setApiKey("");
      setSecretKey("");
      setEditingKeys(false);
    } catch {
      toast.error(t("API কী আপডেট ব্যর্থ", "Failed to update API keys"));
    } finally {
      setSavingKeys(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(t("কপি হয়েছে", "Copied"));
    setTimeout(() => setCopied(null), 2000);
  };

  const settingsLabels: Record<string, string> = {
    steadfast_api_key: "API Key",
    steadfast_secret_key: "Secret Key",
    steadfast_webhook_token: "Webhook Token",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {t("Steadfast কুরিয়ার API", "Steadfast Courier API")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <></>
          )}

          {/* Update/Add Keys */}
          {hasKeys && !editingKeys ? (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{t("API কী কনফিগার করা আছে", "API keys configured")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingKeys(true)} className="gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                {t("এডিট", "Edit")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                {hasKeys ? t("API কী এডিট", "Edit API Keys") : t("API কী যোগ করুন", "Add API Keys")}
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder="API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-9"
                  />
                  <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showSecretKey ? "text" : "password"}
                    placeholder="Secret Key"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="pr-9"
                  />
                  <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowSecretKey(!showSecretKey)}>
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveKeys} disabled={savingKeys} size="sm" className="gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {savingKeys ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ করুন", "Save")}
                </Button>
                {hasKeys && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingKeys(false); setApiKey(""); setSecretKey(""); }}>
                    {t("বাতিল", "Cancel")}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Webhook */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Webhook className="w-3.5 h-3.5" />
              {t("ওয়েবহুক সেটআপ", "Webhook Setup")}
            </Label>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Link2 className="w-3 h-3" /> Callback URL</Label>
              <div className="flex gap-2">
                <Input value={callbackUrl} readOnly className="font-mono text-xs bg-muted" />
                <Button size="icon" variant="outline" className="shrink-0" onClick={() => copyToClipboard(callbackUrl, "url")}>
                  {copied === "url" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Shield className="w-3 h-3" /> Auth Token (Bearer)</Label>
              <div className="flex gap-2">
                <Input value={webhookToken || t("টোকেন তৈরি করুন →", "Generate token →")} readOnly className="font-mono text-xs bg-muted" />
                <Button size="icon" variant="outline" className="shrink-0" onClick={() => webhookToken && copyToClipboard(webhookToken, "token")} disabled={!webhookToken}>
                  {copied === "token" ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerateToken} disabled={generatingToken} className="gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingToken ? "animate-spin" : ""}`} />
                  {webhookToken ? t("রিজেনারেট", "Regenerate") : t("তৈরি করুন", "Generate")}
                </Button>
                {webhookToken && (
                  <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                    <Key className="w-3 h-3 mr-1" />{t("সক্রিয়", "Active")}
                  </Badge>
                )}
              </div>
            </div>

          {/* Courier Note */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              📝 {t("কুরিয়ার নোট", "Courier Note")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("কুরিয়ারে এন্ট্রির সময় এই নোটটি অটো যুক্ত হবে", "This note will be auto-attached when entering orders to courier")}</p>
            <Textarea
              placeholder={t("যেমন: ভঙ্গুর পণ্য, সাবধানে হ্যান্ডেল করুন", "e.g: Fragile product, handle with care")}
              value={courierNote}
              onChange={(e) => setCourierNote(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleSaveNote}
              disabled={savingNote || courierNote.trim() === savedCourierNote}
              className="gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingNote ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ করুন", "Save")}
            </Button>
          </div>

            <div className="bg-muted/50 rounded-lg p-3 border">
              <p className="text-xs font-medium text-foreground mb-1">{t("📋 নির্দেশনা", "📋 Instructions")}</p>
              <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                <li>{t("portal.packzy.com এ লগইন করুন", "Login to portal.packzy.com")}</li>
                <li>{t("Settings → Webhook এ যান", "Go to Settings → Webhook")}</li>
                <li>{t("Callback URL ও Bearer Token পেস্ট করুন", "Paste Callback URL & Bearer Token")}</li>
                <li>{t("সেভ করুন — অটো আপডেট চালু!", "Save — auto updates enabled!")}</li>
              </ol>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── API Card Item ───
interface ApiCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  status?: "active" | "inactive";
  onClick: () => void;
}

function ApiCard({ icon: Icon, title, description, status, onClick }: ApiCardProps) {
  const { t } = useLanguage();
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors text-left group"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {status === "active" && (
          <Badge variant="outline" className="border-primary/30 text-primary text-xs">{t("সক্রিয়", "Active")}</Badge>
        )}
        {status === "inactive" && (
          <Badge variant="outline" className="text-muted-foreground text-xs">{t("নিষ্ক্রিয়", "Inactive")}</Badge>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </button>
  );
}

const SMS_STATUS_OPTIONS = [
  { key: "sms_on_pending", msgKey: "sms_msg_pending", labelBn: "পেন্ডিং (অর্ডার তৈরি)", labelEn: "Pending (Order Created)", defaultMsg: "{order_id} অর্ডার সফল হয়েছে, টোটাল {total} টাকা। ধন্যবাদ! - Griha Nova", placeholders: "{order_id}, {total}" },
  { key: "sms_on_no_response", msgKey: "sms_msg_no_response", labelBn: "নো রেসপন্স / বিজি", labelEn: "No Response / Busy", defaultMsg: "আপনাকে কল করে পাওয়া যায়নি, অনুগ্রহ করে 09617443377 নাম্বারে যোগাযোগ করুন", placeholders: "" },
  { key: "sms_on_confirmed", msgKey: "sms_msg_confirmed", labelBn: "কনফার্ম", labelEn: "Confirmed", defaultMsg: "অভিনন্দন! অর্ডারটি কনফার্ম হয়েছে। টোটাল {total} টাকা।", placeholders: "{order_id}, {total}" },
  { key: "sms_on_entry_done", msgKey: "sms_msg_entry_done", labelBn: "কুরিয়ার এন্ট্রি", labelEn: "Courier Entry", defaultMsg: "যেকোনো প্রয়োজনে মেসেজ করুন- grihanova.com/help", placeholders: "{order_id}, {tracking_link}" },
];

function SmsNotificationSettings() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const allKeys = SMS_STATUS_OPTIONS.flatMap(o => [o.key, o.msgKey]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["sms-notification-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key, value").in("key", allKeys);
      const map: Record<string, string> = {};
      SMS_STATUS_OPTIONS.forEach(o => { map[o.key] = "true"; }); // default ON
      data?.forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  const [messages, setMessages] = useState<Record<string, string>>({});
  const [savedMessages, setSavedMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      const msgs: Record<string, string> = {};
      SMS_STATUS_OPTIONS.forEach(o => {
        msgs[o.msgKey] = settings[o.msgKey] || o.defaultMsg;
      });
      setMessages(msgs);
      setSavedMessages(msgs);
    }
  }, [settings]);

  const toggleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      await supabase.from("app_settings").upsert(
        { key, value: value ? "true" : "false", updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sms-notification-settings"] }),
  });

  const saveMsgMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await supabase.from("app_settings").upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    },
    onSuccess: (_, vars) => {
      setSavedMessages(prev => ({ ...prev, [vars.key]: vars.value }));
      queryClient.invalidateQueries({ queryKey: ["sms-notification-settings"] });
      toast.success(t("সংরক্ষিত হয়েছে", "Saved"));
    },
  });

  if (isLoading) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          {t("SMS নোটিফিকেশন সেটিংস", "SMS Notification Settings")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t("কোন স্ট্যাটাসে কাস্টমারের ফোনে SMS পাঠানো হবে এবং কি টেক্সট যাবে তা নির্ধারণ করুন", "Configure which status changes trigger SMS and customize message text")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SMS_STATUS_OPTIONS.map((opt) => {
          const isOn = settings?.[opt.key] !== "false";
          const msg = messages[opt.msgKey] || opt.defaultMsg;
          const isDirty = msg !== savedMessages[opt.msgKey];
          return (
            <div key={opt.key} className="py-3 border-b border-border last:border-0 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{t(opt.labelBn, opt.labelEn)}</p>
                <Switch
                  checked={isOn}
                  onCheckedChange={(checked) => toggleMutation.mutate({ key: opt.key, value: checked })}
                />
              </div>
              {isOn && (
                <div className="space-y-1.5">
                  <Textarea
                    value={msg}
                    onChange={(e) => setMessages(prev => ({ ...prev, [opt.msgKey]: e.target.value }))}
                    className="text-xs min-h-[60px] resize-none"
                    rows={2}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                      <span>{msg.length} {t("অক্ষর", "chars")}</span>
                      {opt.placeholders && (
                        <span className="text-primary/70">{t("ভেরিয়েবল", "Variables")}: {opt.placeholders}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isDirty ? "default" : "outline"}
                      className="h-6 text-[10px] px-2"
                      disabled={saveMsgMutation.isPending || !isDirty}
                      onClick={() => saveMsgMutation.mutate({ key: opt.msgKey, value: msg })}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      {isDirty ? t("সেভ করুন", "Save") : t("সেভড", "Saved")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───
export default function ApiManagement() {
  const { t } = useLanguage();
  const [courierOpen, setCourierOpen] = useState(false);
  const [pathaoOpen, setPathaoOpen] = useState(false);
  const [bkashOpen, setBkashOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [fraudOpen, setFraudOpen] = useState(false);
  const [pixelOpen, setPixelOpen] = useState(false);
  const [gtmOpen, setGtmOpen] = useState(false);
  const [tiktokOpen, setTiktokOpen] = useState(false);
  
  
  

  const { data: courierStatus } = useQuery({
    queryKey: ["courier-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key")
        .in("key", ["steadfast_api_key", "steadfast_secret_key"]);
      if (error) throw error;
      return data?.length >= 2 ? "active" : "inactive";
    },
  });

  const { data: pathaoStatus } = useQuery({
    queryKey: ["pathao-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key")
        .in("key", ["pathao_client_id", "pathao_client_secret", "pathao_username", "pathao_password", "pathao_store_id"]);
      if (error) throw error;
      return (data?.length || 0) >= 5 ? "active" : "inactive";
    },
  });

  const { data: bkashStatus } = useQuery({
    queryKey: ["bkash-status"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bkash_settings")
        .select("enabled, app_key")
        .eq("id", 1)
        .maybeSingle();
      return data?.enabled && data?.app_key ? "active" : "inactive";
    },
  });

  const { data: smsStatus } = useQuery({
    queryKey: ["sms-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key")
        .in("key", ["ecomah_api_key", "sms_api_key"]);
      if (error) throw error;
      return data?.length >= 1 ? "active" : "inactive";
    },
  });

  const { data: fraudStatus } = useQuery({
    queryKey: ["fraud-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key")
        .in("key", ["ecomah_api_key", "fraud_checker_api_key"]);
      if (error) throw error;
      return data?.length >= 1 ? "active" : "inactive";
    },
  });

  const { data: pixelStatus } = useQuery({
    queryKey: ["pixel-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key")
        .in("key", ["meta_pixel_id"]);
      if (error) throw error;
      return data && data.length > 0 ? "active" : "inactive";
    },
  });

  const { data: gtmStatus } = useQuery({
    queryKey: ["gtm-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key")
        .eq("key", "gtm_id");
      if (error) throw error;
      return data && data.length > 0 ? "active" : "inactive";
    },
  });

  const { data: tiktokStatus } = useQuery({
    queryKey: ["tiktok-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key")
        .in("key", ["tiktok_pixel_id", "tiktok_access_token"]);
      if (error) throw error;
      return data && data.length >= 1 ? "active" : "inactive";
    },
  });





  return (
    <div className="space-y-4">

      <div className="space-y-3">
        <ApiCard
          icon={Truck}
          title={t("কুরিয়ার API (Steadfast)", "Courier API (Steadfast)")}
          description={t("কুরিয়ার এন্ট্রি, ওয়েবহুক ও ডেলিভারি ট্র্যাকিং", "Courier entry, webhook & delivery tracking")}
          status={courierStatus as "active" | "inactive" | undefined}
          onClick={() => setCourierOpen(true)}
        />
        <ApiCard
          icon={Truck}
          title={t("কুরিয়ার API (Pathao)", "Courier API (Pathao)")}
          description={t("Pathao Merchant — সব সেটিংস ড্যাশবোর্ড থেকে কন্ট্রোল", "Pathao Merchant — fully dashboard controlled")}
          status={pathaoStatus as "active" | "inactive" | undefined}
          onClick={() => setPathaoOpen(true)}
        />
        <ApiCard
          icon={MessageSquare}
          title={t("SMS API", "SMS API")}
          description={t("কাস্টম Base URL ও Endpoint সহ SMS সার্ভিস", "SMS service with custom Base URL & endpoints")}
          status={smsStatus as "active" | "inactive" | undefined}
          onClick={() => setSmsOpen(true)}
        />
        <ApiCard
          icon={CreditCard}
          title={t("bKash পেমেন্ট গেটওয়ে", "bKash Payment Gateway")}
          description={t("Tokenized Checkout — ড্যাশবোর্ড থেকে সব কন্ট্রোল", "Tokenized Checkout — fully dashboard controlled")}
          status={bkashStatus as "active" | "inactive" | undefined}
          onClick={() => setBkashOpen(true)}
        />
        <ApiCard
          icon={Shield}
          title={t("ফ্রড চেকার", "Fraud Checker")}
          description={t("ফেক অর্ডার ও ফ্রড ডিটেকশন", "Fake order & fraud detection")}
          status={fraudStatus as "active" | "inactive" | undefined}
          onClick={() => setFraudOpen(true)}
        />
        <ApiCard
          icon={BarChart3}
          title={t("Meta Pixel ও Conversions API", "Meta Pixel & Conversions API")}
          description={t("ফেসবুক পিক্সেল ও সার্ভার-সাইড ট্র্যাকিং", "Facebook Pixel & server-side tracking")}
          status={pixelStatus as "active" | "inactive" | undefined}
          onClick={() => setPixelOpen(true)}
        />
        <ApiCard
          icon={Code2}
          title={t("Google Tag Manager", "Google Tag Manager")}
          description={t("GTM কন্টেইনার ইন্টিগ্রেশন", "GTM container integration")}
          status={gtmStatus as "active" | "inactive" | undefined}
          onClick={() => setGtmOpen(true)}
        />
        <ApiCard
          icon={BarChart3}
          title={t("TikTok Pixel ও Events API", "TikTok Pixel & Events API")}
          description={t("টিকটক পিক্সেল ও সার্ভার-সাইড ট্র্যাকিং", "TikTok Pixel & server-side tracking")}
          status={tiktokStatus as "active" | "inactive" | undefined}
          onClick={() => setTiktokOpen(true)}
        />


      </div>

      {/* SMS Notification Settings */}
      <SmsNotificationSettings />

      <CourierApiDialog open={courierOpen} onOpenChange={setCourierOpen} />
      <PathaoApiDialog open={pathaoOpen} onOpenChange={setPathaoOpen} />
      <BkashApiDialog open={bkashOpen} onOpenChange={setBkashOpen} />
      <SmsApiDialog open={smsOpen} onOpenChange={setSmsOpen} />
      <FraudCheckerDialog open={fraudOpen} onOpenChange={setFraudOpen} />
      <PixelDialog open={pixelOpen} onOpenChange={setPixelOpen} />
      <GtmDialog open={gtmOpen} onOpenChange={setGtmOpen} />
      <TikTokDialog open={tiktokOpen} onOpenChange={setTiktokOpen} />
      
      
    </div>
  );
}
