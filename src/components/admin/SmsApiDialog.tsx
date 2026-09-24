import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Check, Eye, EyeOff, Save, Loader2, Settings, MessageSquare,
  Wallet, Send, Trash2, RefreshCw,
} from "lucide-react";

export function SmsApiDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [editingKeys, setEditingKeys] = useState(false);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [balance, setBalance] = useState<any>(null);

  // Test SMS
  const [testNumber, setTestNumber] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const { data: savedApiKey, isLoading } = useQuery({
    queryKey: ["app-settings-sms"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ecomah_api_key", "sms_api_key"]);
      if (error) throw error;
      return data?.find(r => r.key === "ecomah_api_key")?.value
        || data?.find(r => r.key === "sms_api_key")?.value
        || "";
    },
  });

  const hasKeys = !!savedApiKey;

  const startEditing = () => {
    setEditingKeys(true);
    setApiKey(savedApiKey || "");
  };

  const handleSaveKeys = async () => {
    if (!apiKey.trim()) {
      toast.error(t("API Key প্রয়োজন", "API Key is required"));
      return;
    }
    setSavingKeys(true);
    try {
      const { error } = await supabase.functions.invoke("sms-api", {
        body: { action: "update_keys", api_key: apiKey },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["app-settings-sms"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings-fraud"] });
      queryClient.invalidateQueries({ queryKey: ["sms-status"] });
      queryClient.invalidateQueries({ queryKey: ["fraud-status"] });
      toast.success(t("E-COMAH API কনফিগার হয়েছে", "E-COMAH API configured"));
      setApiKey("");
      setEditingKeys(false);
    } catch {
      toast.error(t("সেভ ব্যর্থ", "Save failed"));
    } finally {
      setSavingKeys(false);
    }
  };

  const handleDeleteKeys = async () => {
    try {
      const { error } = await supabase.functions.invoke("sms-api", {
        body: { action: "delete_keys" },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["app-settings-sms"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings-fraud"] });
      queryClient.invalidateQueries({ queryKey: ["sms-status"] });
      queryClient.invalidateQueries({ queryKey: ["fraud-status"] });
      toast.success(t("API Key ডিলিট হয়েছে", "API key deleted"));
      setBalance(null);
    } catch {
      toast.error(t("ডিলিট ব্যর্থ", "Delete failed"));
    }
  };

  const handleCheckBalance = async () => {
    setCheckingBalance(true);
    setBalance(null);
    try {
      const { data, error } = await supabase.functions.invoke("sms-api", {
        body: { action: "check_balance" },
      });
      if (error) throw error;
      setBalance(data?.balance);
    } catch {
      toast.error(t("ব্যালেন্স চেক ব্যর্থ", "Balance check failed"));
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleSendTest = async () => {
    if (!testNumber.trim() || !testMessage.trim()) {
      toast.error(t("নম্বর ও মেসেজ প্রয়োজন", "Number and message required"));
      return;
    }
    setSendingTest(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sms-api", {
        body: { action: "send_sms", number: testNumber, message: testMessage },
      });
      if (error) throw error;
      setTestResult(data?.result);
      if (data?.success) {
        toast.success(t("SMS পাঠানো হয়েছে!", "SMS sent successfully!"));
      } else {
        toast.error(`Error: ${JSON.stringify(data?.result)}`);
      }
    } catch {
      toast.error(t("SMS পাঠানো ব্যর্থ", "Failed to send SMS"));
    } finally {
      setSendingTest(false);
    }
  };

  const maskValue = (val: string) => {
    if (!val) return "";
    if (val.length <= 8) return "••••••••";
    return val.substring(0, 4) + "••••" + val.substring(val.length - 4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {t("SMS API (E-COMAH)", "SMS API (E-COMAH)")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Configured View */}
          {hasKeys && !editingKeys ? (
            <div className="p-3 rounded-lg border bg-primary/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {t("E-COMAH API কনফিগার করা আছে", "E-COMAH API configured")}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
                    <Settings className="w-3.5 h-3.5" />
                    {t("এডিট", "Edit")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeleteKeys} className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">API Key: {maskValue(savedApiKey || "")}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                {hasKeys ? t("API Key এডিট", "Edit API Key") : t("E-COMAH API Key যোগ করুন", "Add E-COMAH API Key")}
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="E-COMAH API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("একই API Key দিয়ে SMS এবং Fraud Check দুটোই কাজ করবে", "Same API Key works for both SMS and Fraud Check")}
              </p>
              <div className="flex gap-2">
                <Button onClick={handleSaveKeys} disabled={savingKeys} size="sm" className="gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {savingKeys ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ করুন", "Save")}
                </Button>
                {hasKeys && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingKeys(false); setApiKey(""); }}>
                    {t("বাতিল", "Cancel")}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Balance Check */}
          {hasKeys && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                {t("ক্রেডিট ব্যালেন্স", "Credit Balance")}
              </Label>
              <Button variant="outline" size="sm" onClick={handleCheckBalance} disabled={checkingBalance} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${checkingBalance ? "animate-spin" : ""}`} />
                {t("ব্যালেন্স চেক", "Check Balance")}
              </Button>
              {balance && (
                <div className="w-full rounded-lg border bg-card p-4 space-y-3">
                  {balance.success ? (
                    <>
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Check className="w-4 h-4" />
                        {balance.label || t("সংযুক্ত", "Connected")}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {balance.sms && (
                          <div className="rounded-md bg-primary/10 p-3 space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SMS</p>
                            <p className="text-lg font-bold text-primary">{balance.sms.remaining ?? "—"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {t("ব্যবহৃত", "Used")}: {balance.sms.used ?? 0} / {balance.sms.limit ?? 0}
                            </p>
                          </div>
                        )}
                        {balance.fraud && (
                          <div className="rounded-md bg-muted p-3 space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fraud Check</p>
                            <p className="text-lg font-bold text-foreground">{balance.fraud.remaining ?? "—"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {t("ব্যবহৃত", "Used")}: {balance.fraud.used ?? 0} / {balance.fraud.limit ?? 0}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(balance, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Test SMS */}
          {hasKeys && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {t("টেস্ট SMS পাঠান", "Send Test SMS")}
              </Label>
              <div className="space-y-3">
                <Input
                  placeholder={t("মোবাইল নম্বর (01XXXXXXXXX)", "Mobile number (01XXXXXXXXX)")}
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                />
                <Textarea
                  placeholder={t("মেসেজ লিখুন...", "Type your message...")}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleSendTest} disabled={sendingTest} size="sm" className="gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  {sendingTest ? t("পাঠানো হচ্ছে...", "Sending...") : t("টেস্ট SMS পাঠান", "Send Test SMS")}
                </Button>
                {testResult && (
                  <div className="bg-muted/50 rounded-lg p-3 border">
                    <p className="text-xs font-medium text-foreground mb-1">{t("রেসপন্স", "Response")}</p>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(testResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
