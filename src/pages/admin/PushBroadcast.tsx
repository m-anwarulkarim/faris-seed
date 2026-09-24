import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bell, Send, Users, Filter, Search, Loader2, CheckCircle2,
  AlertCircle, UserCheck, ShoppingCart, MapPin, X, History,
  BookmarkPlus, Bookmark, Trash2, Smartphone, Clock, Eye,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";

interface SubscribedProfile {
  visitor_profile_id: string;
  name: string | null;
  phone: string;
  address: string | null;
  district: string | null;
  subscription_count: number;
  total_orders: number;
  sms_sent_count: number;
  notification_sent_count: number;
  id_type: "profile" | "user" | "visitor" | "unknown";
}

export default function PushBroadcast() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Notification content
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");

  // Template
  const [templateName, setTemplateName] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("compose");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [orderFilter, setOrderFilter] = useState<string>("all");
  const [selectAll, setSelectAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch subscribed profiles with their push subscriptions
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["push-subscribed-profiles"],
    queryFn: async () => {
      // Get ALL push subscriptions
      const { data: subs, error: subError } = await supabase
        .from("push_subscriptions")
        .select("id, visitor_profile_id, visitor_id, user_id, endpoint");

      if (subError) throw subError;
      if (!subs || subs.length === 0) return [];

      // Separate: ones with visitor_profile_id vs without
      const withProfile = subs.filter((s) => s.visitor_profile_id);
      const withoutProfile = subs.filter((s) => !s.visitor_profile_id);

      const profileIds = [...new Set(withProfile.map((s) => s.visitor_profile_id).filter(Boolean))] as string[];

      let profileData: any[] = [];
      if (profileIds.length > 0) {
        const { data, error } = await supabase
          .from("visitor_profiles")
          .select("id, name, phone, address, district")
          .in("id", profileIds);
        if (error) throw error;
        profileData = data || [];
      }

      const subCounts: Record<string, number> = {};
      withProfile.forEach((s) => {
        if (s.visitor_profile_id) {
          subCounts[s.visitor_profile_id] = (subCounts[s.visitor_profile_id] || 0) + 1;
        }
      });

      // Fetch order counts for profiles
      let orderCountMap: Record<string, number> = {};
      if (profileIds.length > 0) {
        const { data: orderCounts } = await supabase
          .from("orders")
          .select("visitor_profile_id")
          .eq("is_deleted", false)
          .in("visitor_profile_id", profileIds);
        orderCounts?.forEach((o) => {
          if (o.visitor_profile_id) {
            orderCountMap[o.visitor_profile_id] = (orderCountMap[o.visitor_profile_id] || 0) + 1;
          }
        });
      }

      // Fetch SMS sent count per phone
      const allPhones = profileData.map((p: any) => p.phone).filter(Boolean);
      let smsCountMap: Record<string, number> = {};
      if (allPhones.length > 0) {
        const { data: smsLogs } = await supabase
          .from("sms_logs")
          .select("phone")
          .in("phone", allPhones);
        smsLogs?.forEach((s) => {
          smsCountMap[s.phone] = (smsCountMap[s.phone] || 0) + 1;
        });
      }

      // Fetch order notification count per phone
      let notifCountMap: Record<string, number> = {};
      if (allPhones.length > 0) {
        const { data: notifs } = await supabase
          .from("order_notifications")
          .select("phone")
          .in("phone", allPhones);
        notifs?.forEach((n) => {
          if (n.phone) {
            notifCountMap[n.phone] = (notifCountMap[n.phone] || 0) + 1;
          }
        });
      }

      const results: SubscribedProfile[] = profileData.map((p) => ({
        visitor_profile_id: p.id,
        name: p.name,
        phone: p.phone,
        address: p.address,
        district: p.district,
        subscription_count: subCounts[p.id] || 0,
        total_orders: orderCountMap[p.id] || 0,
        sms_sent_count: smsCountMap[p.phone] || 0,
        notification_sent_count: notifCountMap[p.phone] || 0,
        id_type: "profile" as const,
      }));

      // Group orphan subscriptions (no visitor_profile_id) by user_id or visitor_id
      const orphanGroups: Record<string, { count: number; key: string; type: string }> = {};
      withoutProfile.forEach((s) => {
        const key = s.user_id || s.visitor_id || s.id;
        const type = s.user_id ? "admin" : s.visitor_id ? "visitor" : "unknown";
        if (!orphanGroups[key]) orphanGroups[key] = { count: 0, key, type };
        orphanGroups[key].count++;
      });

      // Try to resolve visitor names for orphan visitor_id entries
      const orphanVisitorIds = Object.values(orphanGroups)
        .filter((g) => g.type === "visitor")
        .map((g) => g.key);

      let visitorProfileMap: Record<string, { name: string | null; phone: string }> = {};
      if (orphanVisitorIds.length > 0) {
        const { data: vProfiles } = await supabase
          .from("visitor_profiles")
          .select("visitor_id, name, phone")
          .in("visitor_id", orphanVisitorIds);
        vProfiles?.forEach((vp) => {
          if (vp.visitor_id) {
            visitorProfileMap[vp.visitor_id] = { name: vp.name, phone: vp.phone };
          }
        });
      }

      // Try to resolve admin user emails
      const orphanAdminIds = Object.values(orphanGroups)
        .filter((g) => g.type === "admin")
        .map((g) => g.key);

      let adminNameMap: Record<string, string> = {};
      if (orphanAdminIds.length > 0) {
        const { data: sessions } = await supabase
          .from("admin_sessions")
          .select("user_id, device_name")
          .in("user_id", orphanAdminIds);
        sessions?.forEach((s) => {
          if (s.user_id && s.device_name) {
            adminNameMap[s.user_id] = s.device_name;
          }
        });
      }

      Object.values(orphanGroups).forEach((g) => {
        let name = "Unknown Device";
        let phone = "—";

        if (g.type === "admin") {
          name = adminNameMap[g.key] ? `Admin (${adminNameMap[g.key]})` : "Admin Device";
        } else if (g.type === "visitor") {
          const resolved = visitorProfileMap[g.key];
          if (resolved) {
            name = resolved.name || "Visitor";
            phone = resolved.phone || "—";
          } else {
            name = `Visitor (${g.key.substring(0, 8)}...)`;
          }
        }

        results.push({
          visitor_profile_id: g.key,
          name,
          phone,
          address: null,
          district: null,
          subscription_count: g.count,
          total_orders: 0,
          sms_sent_count: phone !== "—" ? (smsCountMap[phone] || 0) : 0,
          notification_sent_count: phone !== "—" ? (notifCountMap[phone] || 0) : 0,
          id_type: g.type === "admin" ? "user" : g.type === "visitor" ? "visitor" : "unknown",
        });
      });

      return results;
    },
    staleTime: 60_000,
  });

  // Fetch broadcast history
  const { data: broadcastLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["push-broadcast-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_broadcast_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["push-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_templates" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateName.trim() || !title.trim() || !body.trim()) {
        throw new Error("টেমপ্লেট নাম, শিরোনাম ও বডি আবশ্যক");
      }
      const { error } = await supabase
        .from("push_templates" as any)
        .insert({ name: templateName.trim(), title: title.trim(), body: body.trim(), url });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("টেমপ্লেট সেভ হয়েছে", "Template saved"));
      setTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["push-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("push_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("টেমপ্লেট ডিলিট হয়েছে", "Template deleted"));
      queryClient.invalidateQueries({ queryKey: ["push-templates"] });
    },
  });

  const districts = [...new Set(profiles.map((p) => p.district).filter(Boolean))] as string[];

  const filteredProfiles = profiles.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !(p.name?.toLowerCase().includes(q) || false) &&
        !p.phone.includes(q) &&
        !(p.address?.toLowerCase().includes(q) || false)
      ) return false;
    }
    if (districtFilter !== "all" && p.district !== districtFilter) return false;
    if (orderFilter === "has-orders" && p.total_orders === 0) return false;
    if (orderFilter === "no-orders" && p.total_orders > 0) return false;
    if (orderFilter === "repeat" && p.total_orders < 2) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAll(false);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(new Set(filteredProfiles.map((p) => p.visitor_profile_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Send mutation with logging
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) throw new Error("Title and body required");

      const targetIds = selectAll && selectedIds.size === filteredProfiles.length
        ? null
        : [...selectedIds];

      let result: { sent: number; failed: number };

      if (!targetIds && filteredProfiles.length === profiles.length) {
        const { data, error } = await supabase.functions.invoke("send-push", {
          body: { title: title.trim(), body: body.trim(), url, send_to_all: true },
        });
        if (error) throw error;
        result = data;
      } else {
        const targetProfiles = targetIds
          ? profiles.filter((p) => targetIds.includes(p.visitor_profile_id))
          : filteredProfiles;
        let totalSent = 0;
        let totalFailed = 0;

        for (let i = 0; i < targetProfiles.length; i += 10) {
          const batch = targetProfiles.slice(i, i + 10);
          const results = await Promise.allSettled(
            batch.map((p) => {
              const pushBody: any = { title: title.trim(), body: body.trim(), url };
              if (p.id_type === "user") {
                pushBody.user_id = p.visitor_profile_id;
              } else if (p.id_type === "visitor") {
                pushBody.visitor_id = p.visitor_profile_id;
              } else {
                pushBody.visitor_profile_id = p.visitor_profile_id;
              }
              return supabase.functions.invoke("send-push", { body: pushBody });
            })
          );
          results.forEach((r) => {
            if (r.status === "fulfilled" && r.value.data) {
              totalSent += r.value.data.sent || 0;
              totalFailed += r.value.data.failed || 0;
            } else {
              totalFailed++;
            }
          });
        }
        result = { sent: totalSent, failed: totalFailed };
      }

      // Log the broadcast
      const { data: userData } = await supabase.auth.getUser();
      const filters: Record<string, string> = {};
      if (districtFilter !== "all") filters.district = districtFilter;
      if (orderFilter !== "all") filters.orderFilter = orderFilter;
      if (searchQuery) filters.search = searchQuery;

      await supabase.from("push_broadcast_logs" as any).insert({
        title: title.trim(),
        body: body.trim(),
        url,
        sent_count: result.sent,
        failed_count: result.failed,
        total_recipients: selectedIds.size,
        sent_by: userData?.user?.id || null,
        sent_by_name: userData?.user?.email?.split("@")[0] || null,
        filters,
      });

      return result;
    },
    onSuccess: (data) => {
      toast.success(
        t(`✅ ${data.sent}টি নোটিফিকেশন পাঠানো হয়েছে`, `✅ ${data.sent} notification(s) sent`)
      );
      if (data.failed > 0) {
        toast.warning(t(`${data.failed}টি ব্যর্থ`, `${data.failed} failed`));
      }
      queryClient.invalidateQueries({ queryKey: ["push-broadcast-logs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const selectedCount = selectedIds.size;
  const canSend = title.trim() && body.trim() && selectedCount > 0;

  const loadTemplate = (tmpl: any) => {
    setTitle(tmpl.title);
    setBody(tmpl.body);
    setUrl(tmpl.url || "/");
    setActiveTab("compose");
    toast.success(t("টেমপ্লেট লোড হয়েছে", "Template loaded"));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="compose" className="gap-1.5">
            <Send className="w-3.5 h-3.5" />
            {t("পাঠান", "Compose")}
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Bookmark className="w-3.5 h-3.5" />
            {t("টেমপ্লেট", "Templates")}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="w-3.5 h-3.5" />
            {t("হিস্ট্রি", "History")}
          </TabsTrigger>
        </TabsList>

        {/* ======= COMPOSE TAB ======= */}
        <TabsContent value="compose" className="space-y-6 mt-4">
          {/* Compose Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  {t("নোটিফিকেশন তৈরি করুন", "Compose Notification")}
                </CardTitle>
                <div className="flex gap-1.5">
                  {/* Preview toggle */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showPreview ? "default" : "outline"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setShowPreview(!showPreview)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("প্রিভিউ দেখুন", "Preview")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Save as template */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled={!title.trim() || !body.trim()}>
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        {t("সেভ", "Save")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>{t("টেমপ্লেট হিসেবে সেভ করুন", "Save as Template")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 pt-2">
                        <Input
                          placeholder={t("টেমপ্লেট নাম", "Template name")}
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                        />
                        <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                          <p className="font-medium">{title || "—"}</p>
                          <p className="text-muted-foreground text-xs">{body || "—"}</p>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => saveTemplateMutation.mutate()}
                          disabled={!templateName.trim() || saveTemplateMutation.isPending}
                        >
                          {saveTemplateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          {t("সেভ করুন", "Save Template")}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder={t("শিরোনাম *", "Title *")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
              <Textarea
                placeholder={t("বিস্তারিত বার্তা *", "Message body *")}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={300}
              />
              <Input
                placeholder={t("লিংক (ঐচ্ছিক)", "Link URL (optional)")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />

              {/* Preview UI */}
              {showPreview && (
                <div className="border rounded-xl p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" />
                    {t("নোটিফিকেশন প্রিভিউ", "Notification Preview")}
                  </p>
                  <div className="bg-background rounded-lg p-3 shadow-sm border flex gap-3 items-start max-w-sm">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">
                          {title || t("শিরোনাম", "Title")}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {t("এখনই", "now")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {body || t("বার্তা এখানে দেখাবে...", "Message will appear here...")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filter Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {t("কাস্টমার ফিল্টার", "Customer Filter")}
                <Badge variant="secondary" className="ml-auto text-xs">
                  {filteredProfiles.length} / {profiles.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("নাম/ফোন/ঠিকানা খুঁজুন", "Search name/phone/address")}
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectAll(false);
                      setSelectedIds(new Set());
                    }}
                  />
                </div>
                <Select value={districtFilter} onValueChange={(v) => {
                  setDistrictFilter(v);
                  setSelectAll(false);
                  setSelectedIds(new Set());
                }}>
                  <SelectTrigger className="w-[150px]">
                    <MapPin className="w-3.5 h-3.5 mr-1" />
                    <SelectValue placeholder={t("জেলা", "District")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("সব জেলা", "All Districts")}</SelectItem>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={orderFilter} onValueChange={(v) => {
                  setOrderFilter(v);
                  setSelectAll(false);
                  setSelectedIds(new Set());
                }}>
                  <SelectTrigger className="w-[160px]">
                    <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("সবাই", "All")}</SelectItem>
                    <SelectItem value="has-orders">{t("অর্ডার আছে", "Has Orders")}</SelectItem>
                    <SelectItem value="no-orders">{t("অর্ডার নেই", "No Orders")}</SelectItem>
                    <SelectItem value="repeat">{t("রিপিট (২+)", "Repeat (2+)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(searchQuery || districtFilter !== "all" || orderFilter !== "all") && (
                <div className="flex flex-wrap gap-1.5">
                  {searchQuery && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      {searchQuery}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                    </Badge>
                  )}
                  {districtFilter !== "all" && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      {districtFilter}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setDistrictFilter("all")} />
                    </Badge>
                  )}
                  {orderFilter !== "all" && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      {orderFilter === "has-orders" ? t("অর্ডার আছে", "Has Orders") :
                       orderFilter === "no-orders" ? t("অর্ডার নেই", "No Orders") :
                       t("রিপিট", "Repeat")}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => setOrderFilter("all")} />
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between border-b pb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={(c) => handleSelectAll(!!c)}
                  />
                  {t("সব সিলেক্ট করুন", "Select All")}
                </label>
                {selectedCount > 0 && (
                  <Badge variant="default" className="text-xs">
                    <UserCheck className="w-3 h-3 mr-1" />
                    {selectedCount} {t("জন নির্বাচিত", "selected")}
                  </Badge>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  {t("কোনো সাবস্ক্রাইবড কাস্টমার পাওয়া যায়নি", "No subscribed customers found")}
                </div>
              ) : (
                <ScrollArea className="max-h-[350px]">
                  <div className="space-y-1">
                    {filteredProfiles.map((p) => (
                      <label
                        key={p.visitor_profile_id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors
                          ${selectedIds.has(p.visitor_profile_id)
                            ? "bg-primary/5 border border-primary/20"
                            : "hover:bg-muted/50 border border-transparent"}`}
                      >
                        <Checkbox
                          checked={selectedIds.has(p.visitor_profile_id)}
                          onCheckedChange={() => toggleSelect(p.visitor_profile_id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {p.name || t("নাম নেই", "No Name")}
                            </span>
                            {p.total_orders >= 2 && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">Repeat</Badge>
                            )}
                            {p.total_orders === 1 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">New</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                            <span>{p.phone}</span>
                            {p.district && (<><span>•</span><span>{p.district}</span></>)}
                            <span>•</span>
                            <span>{p.total_orders} {t("অর্ডার", "orders")}</span>
                            <span>•</span>
                            <span>{p.subscription_count} {t("ডিভাইস", "devices")}</span>
                            <span>•</span>
                            <span className="text-blue-600">📩 {p.sms_sent_count} SMS</span>
                            <span>•</span>
                            <span className="text-green-600">🔔 {p.notification_sent_count} {t("নোটিফিকেশন", "notif")}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Send Button */}
          <div className="flex items-center justify-between sticky bottom-4 bg-background/95 backdrop-blur p-3 rounded-xl border shadow-lg">
            <div className="text-sm text-muted-foreground">
              {selectedCount > 0 ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  {selectedCount} {t("জন কাস্টমারকে পাঠানো হবে", "customer(s) will receive")}
                </span>
              ) : (
                t("কাস্টমার সিলেক্ট করুন", "Select customers first")
              )}
            </div>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend || sendMutation.isPending}
              className="gap-2"
              size="lg"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t("পুশ পাঠান", "Send Push")}
            </Button>
          </div>
        </TabsContent>

        {/* ======= TEMPLATES TAB ======= */}
        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                {t("সেভ করা টেমপ্লেট", "Saved Templates")}
                <Badge variant="secondary" className="ml-auto text-xs">{templates.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>{t("কোনো টেমপ্লেট নেই", "No templates yet")}</p>
                  <p className="text-xs mt-1">
                    {t("নোটিফিকেশন তৈরি করে 'সেভ' বাটনে ক্লিক করুন", "Compose a notification and click 'Save'")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((tmpl: any) => (
                    <div
                      key={tmpl.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{tmpl.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {tmpl.title} — {tmpl.body}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-7 text-xs shrink-0"
                        onClick={() => loadTemplate(tmpl)}
                      >
                        {t("ব্যবহার করুন", "Use")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/70 hover:text-destructive shrink-0"
                        onClick={() => deleteTemplateMutation.mutate(tmpl.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= HISTORY TAB ======= */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                {t("ব্রডকাস্ট হিস্ট্রি", "Broadcast History")}
                <Badge variant="secondary" className="ml-auto text-xs">{broadcastLogs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : broadcastLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>{t("কোনো ব্রডকাস্ট হিস্ট্রি নেই", "No broadcast history yet")}</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2">
                    {broadcastLogs.map((log: any) => {
                      const filters = log.filters || {};
                      const hasFilters = Object.keys(filters).length > 0;
                      return (
                        <div key={log.id} className="p-3 rounded-lg border space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{log.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{log.body}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-1.5 text-xs">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                <span className="text-green-600 font-medium">{log.sent_count}</span>
                                {log.failed_count > 0 && (
                                  <>
                                    <span className="text-muted-foreground">/</span>
                                    <AlertCircle className="w-3 h-3 text-destructive" />
                                    <span className="text-destructive font-medium">{log.failed_count}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(log.created_at), "dd MMM, hh:mm a")}
                            </span>
                            {log.sent_by_name && (
                              <>
                                <span>•</span>
                                <span>{log.sent_by_name}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{log.total_recipients} {t("জনকে", "recipients")}</span>
                            {hasFilters && (
                              <>
                                <span>•</span>
                                {Object.entries(filters).map(([k, v]) => (
                                  <Badge key={k} variant="outline" className="text-[10px] px-1 py-0">
                                    {String(v)}
                                  </Badge>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
