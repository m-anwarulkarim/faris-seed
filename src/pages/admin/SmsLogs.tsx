import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare, RefreshCw, ShieldCheck, ShoppingCart, CheckCircle,
  Truck, Phone, AlertTriangle, Send, User, BarChart3, Wallet,
  CheckCheck, XCircle, Clock, Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { DateRangeFilter, DateRangeValue, getDateRangeISO } from "@/components/admin/DateRangeFilter";
import { toast } from "sonner";
import { getCurrentAdminAccess } from "@/lib/adminAccess";

const REASON_CONFIG: Record<string, { en: string; bn: string; icon: typeof MessageSquare; color: string }> = {
  manual: { en: "Manual", bn: "ম্যানুয়াল", icon: Send, color: "bg-blue-500" },
  bulk_sms: { en: "Bulk SMS", bn: "বাল্ক SMS", icon: Send, color: "bg-blue-600" },
  order_created: { en: "Order Created", bn: "অর্ডার তৈরি", icon: ShoppingCart, color: "bg-emerald-500" },
  order_confirmed: { en: "Confirmed", bn: "কনফার্ম", icon: CheckCircle, color: "bg-green-600" },
  courier_entry: { en: "Courier Entry", bn: "কুরিয়ার এন্ট্রি", icon: Truck, color: "bg-purple-500" },
  no_response: { en: "No Response", bn: "নো রেসপন্স", icon: Phone, color: "bg-orange-500" },
  low_stock_alert: { en: "Low Stock", bn: "স্টক এলার্ট", icon: AlertTriangle, color: "bg-red-500" },
  otp: { en: "OTP", bn: "ওটিপি", icon: ShieldCheck, color: "bg-indigo-500" },
  status_change: { en: "Status Change", bn: "স্ট্যাটাস চেঞ্জ", icon: RefreshCw, color: "bg-teal-500" },
};

// Check if SMS result indicates a successful delivery
function isResultSuccess(result: any): boolean {
  if (!result) return false;
  const str = typeof result === "string" ? result : JSON.stringify(result);
  const lower = str.toLowerCase();
  return lower.includes("success") || lower.includes("accepted") || lower.includes('"response_code":202') || lower.includes('"error":0') || lower.includes('"error_code":0');
}

// Check if SMS result indicates an actual delivery failure (not provider-side logging error)
function isResultFailed(result: any): boolean {
  if (!result) return false;
  if (isResultSuccess(result)) return false;
  // Check for any non-zero "error" field in the result object
  if (typeof result === "object" && result !== null && "error" in result && result.error !== 0) return true;
  const str = typeof result === "string" ? result : JSON.stringify(result);
  const lower = str.toLowerCase();
  return lower.includes("invalid number") || lower.includes("rejected") || lower.includes("insufficient balance") || lower.includes("number not found") || lower.includes("message is empty") || lower.includes("message empty");
}

// Delivery status icon helper
function DeliveryIcon({ result, status }: { result: any; status: string }) {
  if (status === "failed") return <XCircle className="w-3 h-3 text-red-500" />;
  if (isResultSuccess(result)) return <CheckCheck className="w-3 h-3 text-green-500" />;
  if (isResultFailed(result)) return <XCircle className="w-3 h-3 text-red-500" />;
  if (status === "sent") return <CheckCheck className="w-3 h-3 text-green-500" />;
  return <Clock className="w-3 h-3 text-yellow-500" />;
}

function getDeliveryLabel(result: any, status: string, t: (bn: string, en: string) => string): string {
  if (status === "failed") return t("ব্যর্থ", "Failed");
  if (isResultSuccess(result)) return t("ডেলিভার হয়েছে", "Delivered");
  if (isResultFailed(result)) return t("ব্যর্থ", "Failed");
  if (status === "sent") return t("পাঠানো হয়েছে", "Sent");
  if (!result) return t("অপেক্ষমাণ", "Pending");
  return t("প্রসেসিং", "Processing");
}

export default function SmsLogs() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRangeValue>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReason, setSelectedReason] = useState<string>("all");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCurrentAdminAccess().then(result => {
      if (result.status === "authorized") setIsSuperAdmin(result.isSuperAdmin);
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t("এই SMS লগ ডিলিট করতে চান?", "Delete this SMS log?"))) return;
    setDeletingIds(prev => new Set(prev).add(id));
    const { error } = await supabase.from("sms_logs").delete().eq("id", id);
    setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    if (error) { toast.error(t("ডিলিট ব্যর্থ", "Delete failed")); return; }
    toast.success(t("ডিলিট হয়েছে", "Deleted"));
    queryClient.invalidateQueries({ queryKey: ["sms-logs-dashboard"] });
  }, [t, queryClient]);

  const dateFrom = useMemo(() => getDateRangeISO(dateRange, customFrom, customTo), [dateRange, customFrom, customTo]);

  // SMS Balance - auto refresh every 2 hours (7200000ms), with manual refresh
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sms-api", {
        body: { action: "check_balance" },
      });
      if (error) throw error;
      return data?.balance || null;
    },
    refetchInterval: 7200000, // 2 hours
    staleTime: 3600000, // 1 hour
    retry: 1,
  });

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["sms-logs-dashboard", dateFrom],
    queryFn: async () => {
      let query = supabase
        .from("sms_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Cloud cost: was 30s
  });

  const analytics = useMemo(() => {
    if (!logs?.length) return { byReason: {}, byAdmin: {}, total: 0, sent: 0, failed: 0, delivered: 0 };

    const byReason: Record<string, { total: number; sent: number; failed: number }> = {};
    const byAdmin: Record<string, { total: number; sent: number; failed: number }> = {};
    let total = 0, sent = 0, failed = 0, delivered = 0;
    let unconfirmed = 0;

    for (const log of logs) {
      total++;

      const successResult = isResultSuccess(log.result);
      const failedResult = isResultFailed(log.result);

      // Count based on status + result
      if (log.status === "failed" || failedResult) {
        failed++;
      } else if (successResult) {
        delivered++;
        sent++;
      } else {
        // Has result but not success/failed = unconfirmed (e.g. provider logging error)
        if (log.result && typeof log.result === "object" && Object.keys(log.result as any).length > 0) {
          unconfirmed++;
        }
        sent++;
      }

      const isSent = log.status === "sent" && !failedResult;

      const reason = log.reason || "manual";
      if (!byReason[reason]) byReason[reason] = { total: 0, sent: 0, failed: 0 };
      byReason[reason].total++;
      if (isSent) byReason[reason].sent++; else byReason[reason].failed++;

      const admin = (log as any).sent_by_admin || t("সিস্টেম/অটো", "System/Auto");
      if (!byAdmin[admin]) byAdmin[admin] = { total: 0, sent: 0, failed: 0 };
      byAdmin[admin].total++;
      if (isSent) byAdmin[admin].sent++; else byAdmin[admin].failed++;
    }

    return { byReason, byAdmin, total, sent, failed, delivered, unconfirmed };
  }, [logs, t]);

  const getReasonConfig = useCallback((reason: string) =>
    REASON_CONFIG[reason] || { en: reason, bn: reason, icon: MessageSquare, color: "bg-muted" }, []);

  // Parse balance display
  const balanceDisplay = useMemo(() => {
    if (!balanceData) return null;
    if (balanceData.error) return { text: balanceData.error, isError: true };
    // E-COMAH format: { success, label, sms: { limit, used, remaining }, fraud: { ... } }
    if (balanceData.sms?.remaining !== undefined) {
      return { text: String(balanceData.sms.remaining), isError: false, label: balanceData.label };
    }
    const formatBal = (v: any) => {
      const n = Number(v);
      return isNaN(n) ? String(v) : n.toFixed(0);
    };
    if (typeof balanceData === "object") {
      const bal = balanceData.remaining_balance ?? balanceData.balance ?? balanceData.credit ?? balanceData.data?.remaining_balance ?? balanceData.data?.balance ?? balanceData.data?.credit;
      if (bal !== undefined) return { text: formatBal(bal), isError: false };
      return { text: JSON.stringify(balanceData), isError: false };
    }
    return { text: formatBal(balanceData), isError: false };
  }, [balanceData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">{t("SMS ড্যাশবোর্ড", "SMS Dashboard")}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(f, to) => { setCustomFrom(f); setCustomTo(to); }}
          />
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">{t("লোড হচ্ছে...", "Loading...")}</div>
      ) : (
        <>
          {/* Top Row: Balance + Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {/* Balance Card */}
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-medium text-muted-foreground">{t("ব্যালেন্স", "Balance")}</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => refetchBalance()} disabled={balanceLoading}>
                    <RefreshCw className={`w-3 h-3 ${balanceLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                {balanceLoading && !balanceData ? (
                  <p className="text-sm text-muted-foreground">{t("লোড হচ্ছে...", "Loading...")}</p>
                ) : balanceDisplay ? (
                  <p className={`text-xl font-bold ${balanceDisplay.isError ? "text-red-500 text-xs" : ""}`}>
                    {balanceDisplay.text}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("কনফিগার করা হয়নি", "Not configured")}</p>
                )}
                <p className="text-[9px] text-muted-foreground mt-1">{t("২ ঘণ্টা পর অটো আপডেট", "Auto-updates every 2h")}</p>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{analytics.total}</p>
                <p className="text-[10px] text-muted-foreground">{t("মোট SMS", "Total SMS")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{analytics.delivered}</p>
                <p className="text-[10px] text-muted-foreground">{t("ডেলিভার্ড", "Delivered")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{analytics.failed}</p>
                <p className="text-[10px] text-muted-foreground">{t("ব্যর্থ", "Failed")}</p>
              </CardContent>
            </Card>
            {analytics.unconfirmed > 0 && (
              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{analytics.unconfirmed}</p>
                  <p className="text-[10px] text-muted-foreground">{t("অনিশ্চিত", "Unconfirmed")}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* By Reason Cards */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              {t("খাত অনুযায়ী SMS", "SMS by Category")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.entries(analytics.byReason)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([reason, stats]) => {
                  const config = getReasonConfig(reason);
                  const Icon = config.icon;
                  return (
                    <Card key={reason} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-7 h-7 rounded-md ${config.color} flex items-center justify-center`}>
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-xs font-medium truncate">{t(config.bn, config.en)}</span>
                        </div>
                        <p className="text-xl font-bold">{stats.total}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-green-600">✓ {stats.sent}</span>
                          {stats.failed > 0 && (
                            <span className="text-[10px] text-red-500">✗ {stats.failed}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>

          {/* By Admin */}
          {Object.keys(analytics.byAdmin).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {t("অ্যাডমিন অনুযায়ী SMS", "SMS by Admin")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(analytics.byAdmin)
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([admin, stats]) => (
                    <Card key={admin}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{admin}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-green-600">✓ {stats.sent}</span>
                              {stats.failed > 0 && (
                                <span className="text-[10px] text-red-500">✗ {stats.failed}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-sm font-bold shrink-0">{stats.total}</Badge>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Recent Logs */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="text-sm font-semibold">{t("সাম্প্রতিক SMS লগ", "Recent SMS Logs")}</h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("ফোন বা মেসেজ দিয়ে খুঁজুন...", "Search by phone or message...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              <Button
                size="sm"
                variant={selectedReason === "all" ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => setSelectedReason("all")}
              >
                {t("সব", "All")}
                <Badge variant="secondary" className="ml-1 h-4 min-w-[16px] px-1 text-[9px]">{logs?.length || 0}</Badge>
              </Button>
              {Object.entries(analytics.byReason)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([reason, stats]) => {
                  const config = getReasonConfig(reason);
                  const Icon = config.icon;
                  return (
                    <Button
                      key={reason}
                      size="sm"
                      variant={selectedReason === reason ? "default" : "outline"}
                      className="h-7 text-xs px-2.5 gap-1"
                      onClick={() => setSelectedReason(reason)}
                    >
                      <Icon className="w-3 h-3" />
                      {t(config.bn, config.en)}
                      <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[9px]">{stats.total}</Badge>
                    </Button>
                  );
                })}
            </div>
            {!logs?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">{t("কোনো SMS লগ নেই", "No SMS logs")}</div>
            ) : (() => {
              const q = searchQuery.trim().toLowerCase();
              let filtered = selectedReason !== "all" 
                ? logs.filter(log => (log.reason || "manual") === selectedReason)
                : logs;
              if (q) {
                filtered = filtered.filter(log => 
                  log.phone.toLowerCase().includes(q) || 
                  log.message.toLowerCase().includes(q)
                );
              }
              return filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">{t("কোনো ফলাফল নেই", "No results found")}</div>
              ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2 pr-3">
                  {filtered.map((log) => {
                    const reason = log.reason || "manual";
                    const config = getReasonConfig(reason);
                    const Icon = config.icon;
                    return (
                      <div key={log.id} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] font-mono">{log.phone}</Badge>
                            <Badge className={`text-[10px] text-white ${config.color}`}>
                              <Icon className="w-2.5 h-2.5 mr-0.5" />
                              {t(config.bn, config.en)}
                            </Badge>
                            {/* Delivery status */}
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <DeliveryIcon result={log.result} status={log.status} />
                              {getDeliveryLabel(log.result, log.status, t)}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: bn })}
                          </span>
                          {isSuperAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                              disabled={deletingIds.has(log.id)}
                              onClick={() => handleDelete(log.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {(log as any).sent_by_admin && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            <User className="w-2.5 h-2.5 inline mr-0.5" />
                            {(log as any).sent_by_admin}
                          </p>
                        )}
                        <p className="text-sm mt-1.5 text-foreground line-clamp-2">{log.message}</p>
                        {log.result && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-muted-foreground cursor-pointer">{t("রেসপন্স", "Response")}</summary>
                            <pre className="text-[10px] mt-1 text-muted-foreground whitespace-pre-wrap bg-muted p-2 rounded">
                              {JSON.stringify(log.result, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
