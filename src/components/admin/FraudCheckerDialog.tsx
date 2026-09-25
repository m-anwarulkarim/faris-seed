import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Check, Eye, EyeOff, Save, Loader2, Settings, Shield,
  Trash2, Search, Truck,
} from "lucide-react";

/* ──────────────────────────── Main Dialog ──────────────────────────── */

export function FraudCheckerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);

  // Test
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const { data: savedApiKey, isLoading } = useQuery({
    queryKey: ["app-settings-fraud"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["ecomah_api_key", "fraud_checker_api_key"]);
      if (error) throw error;
      return data?.find(d => d.key === "ecomah_api_key")?.value
        || data?.find(d => d.key === "fraud_checker_api_key")?.value
        || "";
    },
  });

  const hasKey = !!savedApiKey;

  const maskValue = (val: string) => {
    if (!val) return "";
    if (val.length <= 8) return "••••••••";
    return val.substring(0, 4) + "••••" + val.substring(val.length - 4);
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) { toast.error(t("API Key প্রয়োজন", "API Key is required")); return; }
    setSavingKey(true);
    try {
      const val = apiKey.trim();
      const { error: err1 } = await supabase
        .from("app_settings")
        .upsert({ key: "ecomah_api_key", value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (err1) {
        await supabase.rpc("save_app_setting", { p_key: "ecomah_api_key", p_value: val });
      }
      const { error: err2 } = await supabase
        .from("app_settings")
        .upsert({ key: "fraud_checker_api_key", value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (err2) {
        await supabase.rpc("save_app_setting", { p_key: "fraud_checker_api_key", p_value: val });
      }

      queryClient.invalidateQueries({ queryKey: ["app-settings-fraud"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings-sms"] });
      queryClient.invalidateQueries({ queryKey: ["fraud-status"] });
      queryClient.invalidateQueries({ queryKey: ["sms-status"] });
      toast.success(t("E-COMAH API কনফিগার হয়েছে", "E-COMAH API configured"));
      setApiKey(""); setEditingKey(false);
    } catch (err: any) {
      toast.error(t("সেভ ব্যর্থ: ", "Save failed: ") + (err?.message || ""));
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async () => {
    try {
      await supabase.from("app_settings").delete().in("key", ["ecomah_api_key", "fraud_checker_api_key"]);
      await supabase.rpc("delete_app_setting", { p_key: "ecomah_api_key" });
      await supabase.rpc("delete_app_setting", { p_key: "fraud_checker_api_key" });

      queryClient.invalidateQueries({ queryKey: ["app-settings-fraud"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings-sms"] });
      queryClient.invalidateQueries({ queryKey: ["fraud-status"] });
      queryClient.invalidateQueries({ queryKey: ["sms-status"] });
      toast.success(t("API Key ডিলিট হয়েছে", "API Key deleted"));
      setTestResult(null);
    } catch { toast.error(t("ডিলিট ব্যর্থ", "Delete failed")); }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) { toast.error(t("ফোন নম্বর দিন", "Enter phone number")); return; }
    setTesting(true); setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("fraud-checker", { body: { action: "check", phone: testPhone } });
      if (!error) setTestResult(data?.data);
    } catch {}

    toast.success(t("চেক সম্পন্ন", "Check complete"));
    setTesting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {t("ফ্রড চেকার (E-COMAH)", "Fraud Checker (E-COMAH)")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* E-COMAH API Key Section */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              E-COMAH Fraud Checker
            </Label>

            {hasKey && !editingKey ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <div>
                    <span className="text-sm font-medium text-foreground block">{t("কনফিগার করা আছে", "Configured")}</span>
                    <span className="text-xs text-muted-foreground">Key: {maskValue(savedApiKey || "")}</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setEditingKey(true)} className="gap-1.5">
                    <Settings className="w-3.5 h-3.5" />{t("এডিট", "Edit")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeleteKey} className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Input type={showApiKey ? "text" : "password"} placeholder="E-COMAH API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="pr-9" />
                  <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("একই API Key দিয়ে SMS এবং Fraud Check দুটোই কাজ করবে", "Same API Key works for both SMS and Fraud Check")}
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleSaveKey} disabled={savingKey} size="sm" className="gap-1.5">
                    <Save className="w-3.5 h-3.5" />{savingKey ? t("সেভ হচ্ছে...", "Saving...") : t("সেভ", "Save")}
                  </Button>
                  {hasKey && <Button variant="ghost" size="sm" onClick={() => { setEditingKey(false); setApiKey(""); }}>{t("বাতিল", "Cancel")}</Button>}
                </div>
              </div>
            )}
          </div>

          {/* Test Section */}
          {hasKey && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                {t("ফোন নম্বর চেক করুন", "Check Phone Number")}
              </Label>
              <div className="flex gap-2">
                <Input placeholder={t("ফোন নম্বর (017XXXXXXXX)", "Phone (017XXXXXXXX)")} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                <Button onClick={handleTest} disabled={testing} size="sm" className="gap-1.5 shrink-0">
                  <Search className="w-3.5 h-3.5" />
                  {testing ? t("চেক হচ্ছে...", "Checking...") : t("চেক", "Check")}
                </Button>
              </div>
              {testResult && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">E-COMAH Fraud Checker</p>
                  <FraudResultCard data={testResult} />
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="bg-muted/50 rounded-lg p-3 border">
            <p className="text-xs font-medium text-foreground mb-1">{t("📋 তথ্য", "📋 Info")}</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>{t("E-COMAH থেকে API Key সংগ্রহ করুন", "Get API Key from E-COMAH")}</li>
              <li>{t("একই Key দিয়ে SMS ও Fraud Check দুটোই চলবে", "Same key powers both SMS and Fraud Check")}</li>
              <li>{t("অর্ডার এডিটরে কাস্টমার প্রোফাইলে অটোমেটিক ফ্রড ডেটা দেখা যাবে", "Fraud data auto-shows in order editor customer profile")}</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────── Steadfast Result Card ──────────────────────── */

export function SteadfastResultCard({ data, compact, highlighted }: { data: any; compact?: boolean; highlighted?: boolean }) {
  const { t } = useLanguage();

  if (!data || data.error) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 border text-xs text-muted-foreground">
        {data?.error || t("ডেটা পাওয়া যায়নি", "No data found")}
      </div>
    );
  }

  const success = data.total_delivered ?? data.success_parcel ?? data.success ?? 0;
  const cancel = data.total_cancelled ?? data.cancel_parcel ?? data.cancel ?? 0;
  const total = data.total_parcel ?? data.total ?? data.total_parcels ?? (success + cancel);
  const ratio = data.success_ratio ?? (total > 0 ? Math.round((success / total) * 100) : 0);
  const noHistory = total === 0 && !!data.message;

  const getRiskColor = (r: number) => r >= 70 ? "text-green-600" : r >= 40 ? "text-amber-600" : "text-destructive";
  const getRiskBg = (r: number) => r >= 70 ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : r >= 40 ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
  const getRiskBadge = (r: number) => {
    if (noHistory) return { label: t("ইতিহাস নেই", "No history"), className: "border-border text-muted-foreground bg-muted/50" };
    if (r >= 70) return { label: t("নিরাপদ", "Safe"), className: "border-green-300 text-green-700 bg-green-50" };
    if (r >= 40) return { label: t("সতর্কতা", "Caution"), className: "border-amber-300 text-amber-700 bg-amber-50" };
    return { label: t("ঝুঁকিপূর্ণ", "Risky"), className: "border-red-300 text-red-700 bg-red-50" };
  };

  const risk = getRiskBadge(ratio);

  if (compact) {
    const wrapperClass = highlighted ? `rounded-lg p-3 border ${getRiskBg(ratio)}` : "";
    return (
      <div className={`space-y-2 ${wrapperClass}`}>
        <div className="flex items-center justify-between">
          <span className={`${highlighted ? "text-xs font-semibold text-foreground" : "text-[10px] text-muted-foreground uppercase tracking-wider"} flex items-center gap-1`}>
            <Truck className={highlighted ? "w-3.5 h-3.5" : "w-3 h-3"} /> Steadfast
          </span>
          <Badge variant="outline" className={`text-[10px] ${risk.className}`}>{risk.label}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-background/70 rounded p-1.5 text-center">
            <p className={`${highlighted ? "text-base" : "text-sm"} font-bold text-foreground`}>{total}</p>
            <p className="text-[9px] text-muted-foreground">{t("মোট", "Total")}</p>
          </div>
          <div className="bg-background/70 rounded p-1.5 text-center">
            <p className={`${highlighted ? "text-base" : "text-sm"} font-bold text-green-600`}>{success}</p>
            <p className="text-[9px] text-muted-foreground">{t("ডেলিভারি", "Delivered")}</p>
          </div>
          <div className="bg-background/70 rounded p-1.5 text-center">
            <p className={`${highlighted ? "text-base" : "text-sm"} font-bold text-destructive`}>{cancel}</p>
            <p className="text-[9px] text-muted-foreground">{t("বাতিল", "Cancel")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${ratio >= 70 ? "bg-green-500" : ratio >= 40 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${ratio}%` }} />
          </div>
          <span className={`text-xs font-bold ${getRiskColor(ratio)}`}>{ratio}%</span>
        </div>
        {data.message && (
          <p className="text-[10px] text-muted-foreground">{data.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-lg p-4 border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Steadfast Direct
        </span>
        <Badge variant="outline" className={`text-xs ${risk.className}`}>{risk.label} ({ratio}%)</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-lg font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">{t("মোট পার্সেল", "Total Parcels")}</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-green-600">{success}</p>
          <p className="text-[10px] text-muted-foreground">{t("সাকসেস", "Success")}</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-destructive">{cancel}</p>
          <p className="text-[10px] text-muted-foreground">{t("ক্যান্সেল", "Cancel")}</p>
        </div>
      </div>
      {data.message && (
        <p className="text-xs text-muted-foreground">{data.message}</p>
      )}
    </div>
  );
}

/* ──────────────────────── FraudResultCard (E-COMAH) ──────────────────────── */

export function FraudResultCard({ data, compact }: { data: any; compact?: boolean }) {
  const { t } = useLanguage();

  if (!data || data.error) {
    return (
      <div className="bg-muted/50 rounded-lg p-3 border text-xs text-muted-foreground">
        {data?.error || t("ডেটা পাওয়া যায়নি", "No data found")}
      </div>
    );
  }

  // Support E-COMAH format: { total_orders, total_received, success_rate, courier_breakdown[] }
   // Support multiple API response formats: E-COMAH new (courier_breakdown), E-COMAH old (apis), FraudShield (courierData)
   const courierDataObj = data.courierData || {};
   const summary = courierDataObj.summary;
   const apisObj = data.apis || {};

   // Build unified courier list from whichever format is present
   const courierBreakdown = data.courier_breakdown || [];
   const courierArray = courierDataObj.couriers || [];
   const apisEntries = Object.entries(apisObj)
     .map(([, info]: [string, any]) => info)
     .filter((info: any) => info && typeof info === "object" && info.courier_name && info.status !== "notfound" && (info.total_parcels > 0));

   const extractedCouriers = courierBreakdown.length > 0
     ? courierBreakdown.map((c: any) => ({ name: c.courier || c.name, total: c.orders || c.total || 0, delivered: c.received || c.delivered || 0, cancelled: (c.orders || 0) - (c.received || 0) }))
     : apisEntries.length > 0
     ? apisEntries.map((c: any) => ({ name: c.courier_name || c.name, total: c.total_parcels || 0, delivered: c.total_delivered_parcels || 0, cancelled: c.total_cancelled_parcels || 0 }))
     : courierArray.length > 0
     ? courierArray.map((c: any) => ({ name: c.name || c.courier, total: c.total_parcel || c.total || 0, delivered: c.success_parcel || c.delivered || 0, cancelled: c.cancelled_parcel || c.cancelled || 0 }))
     : Object.entries(courierDataObj)
         .filter(([key]) => key !== "summary")
         .map(([, info]: [string, any]) => info)
         .filter((info: any) => info && typeof info === "object" && (info.name || info.courier))
         .map((c: any) => ({ name: c.name || c.courier, total: c.total_parcel || c.total || 0, delivered: c.success_parcel || c.delivered || 0, cancelled: c.cancelled_parcel || c.cancelled || 0 }));

   // Prefer courier-level totals (more accurate), then top-level fields
   const breakdownTotal = extractedCouriers.reduce((s: number, c: any) => s + (c.total || 0), 0);
   const breakdownDelivered = extractedCouriers.reduce((s: number, c: any) => s + (c.delivered || 0), 0);

   const totalParcels = (breakdownTotal > 0 ? breakdownTotal : null) ?? data.total_orders ?? data.total_parcels ?? summary?.total_parcels ?? 0;
   const totalDelivered = (breakdownTotal > 0 ? breakdownDelivered : null) ?? data.total_received ?? data.total_delivered ?? summary?.successful_deliveries ?? 0;
   const totalCancel = totalParcels - totalDelivered;
   const successRate = totalParcels > 0
     ? Math.round((totalDelivered / totalParcels) * 100 * 100) / 100
     : (data.success_rate ?? 0);

   const riskScore = data.fraudRiskScore;

  const getRiskColor = (rate: number) => {
    if (rate >= 70) return "text-green-600";
    if (rate >= 40) return "text-amber-600";
    return "text-destructive";
  };

  const getRiskBadge = (rate: number) => {
    if (riskScore) {
      const level = riskScore.level?.toLowerCase();
      if (level === "low") return { label: t("নিরাপদ", "Safe"), className: "border-green-300 text-green-700 bg-green-50" };
      if (level === "medium") return { label: t("সতর্কতা", "Caution"), className: "border-amber-300 text-amber-700 bg-amber-50" };
      return { label: t("ঝুঁকিপূর্ণ", "Risky"), className: "border-red-300 text-red-700 bg-red-50" };
    }
    if (rate >= 70) return { label: t("নিরাপদ", "Safe"), className: "border-green-300 text-green-700 bg-green-50" };
    if (rate >= 40) return { label: t("সতর্কতা", "Caution"), className: "border-amber-300 text-amber-700 bg-amber-50" };
    return { label: t("ঝুঁকিপূর্ণ", "Risky"), className: "border-red-300 text-red-700 bg-red-50" };
  };

  const risk = getRiskBadge(successRate);

  const sortedCouriers = [...extractedCouriers].filter((c: any) => (c.total || 0) > 0).sort((a: any, b: any) => {
    const aIs = a.name?.toLowerCase().includes("steadfast") ? 0 : 1;
    const bIs = b.name?.toLowerCase().includes("steadfast") ? 0 : 1;
    return aIs - bIs;
  });

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3" />
            E-COMAH
          </span>
          <div className="flex items-center gap-1.5">
            {riskScore && <span className="text-[10px] font-bold text-muted-foreground">Score: {riskScore.score}</span>}
            <Badge variant="outline" className={`text-[10px] ${risk.className}`}>{risk.label}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-muted/50 rounded p-1.5 text-center">
            <p className="text-sm font-bold text-foreground">{totalParcels}</p>
            <p className="text-[9px] text-muted-foreground">{t("মোট", "Total")}</p>
          </div>
          <div className="bg-muted/50 rounded p-1.5 text-center">
            <p className="text-sm font-bold text-green-600">{totalDelivered}</p>
            <p className="text-[9px] text-muted-foreground">{t("ডেলিভারি", "Delivered")}</p>
          </div>
          <div className="bg-muted/50 rounded p-1.5 text-center">
            <p className="text-sm font-bold text-destructive">{totalCancel}</p>
            <p className="text-[9px] text-muted-foreground">{t("বাতিল", "Cancel")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${successRate >= 70 ? "bg-green-500" : successRate >= 40 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${Math.round(successRate)}%` }} />
          </div>
          <span className={`text-[10px] font-bold ${getRiskColor(successRate)}`}>{Math.round(successRate)}%</span>
        </div>
        {sortedCouriers.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {sortedCouriers.map((c: any) => {
              const courierRate = c.total > 0 ? Math.round((c.delivered / c.total) * 100) : 0;
              const barColor = courierRate >= 70 ? "bg-green-500" : courierRate >= 40 ? "bg-amber-500" : "bg-destructive";
              const isSteadfast = c.name?.toLowerCase().includes("steadfast");
              return (
                <div key={c.name} className={`relative ${isSteadfast ? "h-7 ring-1 ring-primary/30" : "h-5"} bg-muted rounded overflow-hidden`}>
                  <div className={`absolute inset-y-0 left-0 ${barColor} transition-all`} style={{ width: `${courierRate}%` }} />
                  <div className="absolute inset-0 flex items-center justify-between px-2">
                    <span className={`${isSteadfast ? "text-xs font-bold" : "text-[10px] font-semibold"} text-foreground drop-shadow-sm flex items-center gap-1`}>
                      {isSteadfast && <Truck className="w-3 h-3" />}{c.name}
                    </span>
                    <span className={`${isSteadfast ? "text-xs" : "text-[10px]"} font-bold text-foreground drop-shadow-sm`}>
                      {c.delivered}/{c.total} ({courierRate}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-lg p-4 border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> E-COMAH Fraud Checker
        </span>
        <div className="flex items-center gap-1.5">
          {riskScore && <span className="text-xs font-medium text-muted-foreground">Score: {riskScore.score} ({riskScore.level})</span>}
          <Badge variant="outline" className={`text-xs ${risk.className}`}>{risk.label} ({Math.round(successRate)}%)</Badge>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-lg font-bold">{totalParcels}</p>
          <p className="text-[10px] text-muted-foreground">{t("মোট অর্ডার", "Total Orders")}</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-green-600">{totalDelivered}</p>
          <p className="text-[10px] text-muted-foreground">{t("রিসিভড", "Received")}</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-destructive">{totalCancel}</p>
          <p className="text-[10px] text-muted-foreground">{t("ক্যান্সেলড", "Cancelled")}</p>
        </div>
      </div>
      {sortedCouriers.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("কুরিয়ার ব্রেকডাউন", "Courier Breakdown")}</p>
          {sortedCouriers.map((c: any) => (
            <div key={c.name} className="flex items-center justify-between text-xs py-0.5">
              <span className="text-muted-foreground">{c.name}</span>
              <span>
                <span className="text-green-600 font-medium">{c.delivered}</span>
                {" / "}
                <span className="font-medium">{c.total}</span>
                <span className="text-muted-foreground ml-1">
                  ({c.total > 0 ? Math.round((c.delivered / c.total) * 100) : 0}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
