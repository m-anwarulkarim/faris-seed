import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Loader2, Eye, Users, Save, BadgeCheck, Ban, ShieldCheck, MessageSquare, RefreshCw, Star, Plus, Eye as EyeIcon, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CustomerExportButton } from "@/components/admin/CustomerExportButton";
import { BulkSmsDialog } from "@/components/admin/BulkSmsDialog";
import { CustomerOrderHistory } from "@/components/admin/CustomerOrderHistory";
import CreditHistoryDialog from "@/components/CreditHistoryDialog";

const resolveProfilePic = (pic: string | null | undefined): string | undefined => {
  if (!pic) return undefined;
  if (pic.startsWith("http")) return pic;
  if (pic.startsWith("/assets/")) return pic; // Vite asset, works in browser
  return undefined;
};

const USER_TYPES_MAP = {
  all: { bn: "সব ধরন", en: "All Types" },
  regular: { bn: "Regular", en: "Regular" },
  vip: { bn: "VIP", en: "VIP" },
};

interface CustomerRow {
  id: string;
  visitor_id: string;
  phone: string;
  name: string | null;
  address: string | null;
  district: string | null;
  thana: string | null;
  user_type: string | null;
  credit_balance: number;
  alt_phone: string | null;
  profile_picture: string | null;
  cover_photo: string | null;
  gender: string | null;
  admin_notes: string | null;
  phone_verified: boolean;
  is_verified: boolean;
  username: string | null;
  access_allowed: boolean;
  orderCount: number;
  orderTotal: number;
}

export default function CustomerList() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [countFilter, setCountFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [banConfirm, setBanConfirm] = useState<{ visitor_id: string; ban: boolean; name: string } | null>(null);
  const [page, setPage] = useState(0);
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false);
  const [creditHistoryOpen, setCreditHistoryOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserData, setCreateUserData] = useState<{ phone: string; password: string; name: string; gender: string }>({ phone: "", password: "", name: "", gender: "" });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const PAGE_SIZE = 50;

  const handleCreateFakeUser = async () => {
    const phone = createUserData.phone.trim();
    const password = createUserData.password.trim();
    if (!/^01[3-9]\d{8}$/.test(phone.replace(/\D/g, ""))) {
      toast.error(t("সঠিক BD নম্বর দিন (01XXXXXXXXX)", "Enter a valid BD number"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("Password কমপক্ষে ৬ অক্ষরের হতে হবে", "Password must be at least 6 characters"));
      return;
    }
    setCreateUserLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-fake-user", {
        body: {
          phone,
          password,
          name: createUserData.name.trim() || null,
          gender: createUserData.gender || null,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(t(`User তৈরি হয়েছে: ${phone}`, `User created: ${phone}`));
      setCreateUserOpen(false);
      setCreateUserData({ phone: "", password: "", name: "", gender: "" });
      setShowCreatePwd(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err: any) {
      toast.error(err?.message || t("তৈরি করা যায়নি", "Failed to create"));
    } finally {
      setCreateUserLoading(false);
    }
  };

  const ORDER_COUNT_FILTERS = [
    { value: "all", label: t("সব", "All") },
    { value: "1+", label: "১+" },
    { value: "5+", label: "৫+" },
    { value: "10+", label: "১০+" },
    { value: "20+", label: "২০+" },
  ];

  const AMOUNT_FILTERS = [
    { value: "all", label: t("সব", "All") },
    { value: "1000+", label: "৳১,০০০+" },
    { value: "5000+", label: "৳৫,০০০+" },
    { value: "10000+", label: "৳১০,০০০+" },
    { value: "50000+", label: "৳৫০,০০০+" },
  ];

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, typeFilter, countFilter, amountFilter, statusFilter]);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", search, typeFilter, countFilter, amountFilter, statusFilter],
    queryFn: async () => {
      let query = supabase.from("visitor_profiles").select("*, visitors(admin_notes, access_allowed)");
      if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      

      const { data: profiles, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      const phones = profiles.map((p: any) => p.phone);
      const { data: orders } = await supabase.from("orders").select("phone, total_amount").in("phone", phones);

      const orderMap: Record<string, { count: number; total: number }> = {};
      (orders || []).forEach((o) => {
        if (!orderMap[o.phone]) orderMap[o.phone] = { count: 0, total: 0 };
        orderMap[o.phone].count++;
        orderMap[o.phone].total += Number(o.total_amount);
      });

      let result: CustomerRow[] = profiles.map((p: any) => ({
        ...p,
        admin_notes: p.visitors?.admin_notes || null,
        access_allowed: p.visitors?.access_allowed !== false,
        orderCount: orderMap[p.phone]?.count || 0,
        orderTotal: orderMap[p.phone]?.total || 0,
      }));

      const countMin = countFilter === "all" ? 0 : parseInt(countFilter);
      if (countMin > 0) result = result.filter((c) => c.orderCount >= countMin);
      const amountMin = amountFilter === "all" ? 0 : parseInt(amountFilter);
      if (amountMin > 0) result = result.filter((c) => c.orderTotal >= amountMin);
      if (statusFilter === "banned") result = result.filter((c) => !c.access_allowed);
      else if (statusFilter === "active") result = result.filter((c) => c.access_allowed);

      return result;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error: profileError } = await (supabase as any)
        .from("visitor_profiles")
        .update({
          name: data.name, address: data.address, district: data.district,
          thana: data.thana, user_type: data.user_type,
          alt_phone: data.alt_phone, gender: data.gender,
        })
        .eq("id", data.id);
      if (profileError) throw profileError;

      const { error: visitorError } = await supabase
        .from("visitors")
        .update({ admin_notes: data.admin_notes })
        .eq("id", data.visitor_id);
      if (visitorError) throw visitorError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      const userTypeChanged =
        selectedCustomer && variables?.user_type !== selectedCustomer.user_type;
      if (userTypeChanged) {
        toast.success(
          t(
            "ব্যবহারকারী আপডেট হয়েছে। তিনি সব ডিভাইস থেকে স্বয়ংক্রিয়ভাবে লগ আউট হবেন।",
            "Customer updated. They will be auto-logged out from all devices."
          )
        );
      } else {
        toast.success(t("কাস্টমার আপডেট হয়েছে", "Customer updated"));
      }
      setSelectedCustomer(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const banMutation = useMutation({
    mutationFn: async ({ visitor_id, ban }: { visitor_id: string; ban: boolean }) => {
      const { error } = await supabase
        .from("visitors")
        .update({ access_allowed: !ban })
        .eq("id", visitor_id);
      if (error) throw error;
    },
    onSuccess: (_, { ban }) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(ban ? t("ইউজার ব্যান করা হয়েছে", "User banned") : t("ব্যান তুলে নেওয়া হয়েছে", "User unbanned"));
      setSelectedCustomer(null);
      setBanConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, verify }: { id: string; verify: boolean }) => {
      const { error } = await supabase
        .from("visitor_profiles")
        .update({ is_verified: verify })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { verify }) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(verify ? t("প্রোফাইল ভেরিফাই করা হয়েছে", "Profile verified") : t("ভেরিফিকেশন তুলে নেওয়া হয়েছে", "Verification removed"));
      setSelectedCustomer((prev) => prev ? { ...prev, is_verified: verify } : prev);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openDetail = (c: CustomerRow) => {
    setSelectedCustomer(c);
    setEditData({
      id: c.id, visitor_id: c.visitor_id, name: c.name || "", address: c.address || "",
      district: c.district || "", thana: c.thana || "", user_type: c.user_type || "regular",
      credit_balance: c.credit_balance, alt_phone: c.alt_phone || "",
      gender: c.gender || "", admin_notes: c.admin_notes || "",
    });
  };

  const bannedCount = customers?.filter((c) => !c.access_allowed).length || 0;
  const activeCount = customers?.filter((c) => c.access_allowed).length || 0;
  const totalCount = customers?.length || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const paginatedCustomers = customers?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {activeCount > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✅ {activeCount} {t("অ্যাক্টিভ", "Active")}</span>
        )}
        {bannedCount > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">🚫 {bannedCount} {t("ব্যান", "Banned")}</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => setCreateUserOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" />
            {t("নতুন ইউজার", "New User")}
          </Button>
          <CustomerExportButton customers={customers || []} />
          <Button variant="outline" size="sm" onClick={() => setBulkSmsOpen(true)} disabled={!customers?.length}>
            <MessageSquare className="w-4 h-4 mr-1.5" />
            {t("বাল্ক SMS", "Bulk SMS")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("নাম বা মোবাইল নম্বর...", "Name or mobile number...")}
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={countFilter} onValueChange={setCountFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder={t("অর্ডার", "Orders")} />
              </SelectTrigger>
              <SelectContent>
                {ORDER_COUNT_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={amountFilter} onValueChange={setAmountFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("অ্যামাউন্ট", "Amount")} />
              </SelectTrigger>
              <SelectContent>
                {AMOUNT_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("স্ট্যাটাস", "Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("সব", "All")}</SelectItem>
                <SelectItem value="active">{t("সক্রিয়", "Active")}</SelectItem>
                <SelectItem value="banned">{t("🚫 ব্যান", "🚫 Banned")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !customers?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mb-3 opacity-40" />
              <p>{t("কোনো কাস্টমার পাওয়া যায়নি", "No customers found")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("নাম", "Name")}</TableHead>
                    <TableHead>{t("মোবাইল", "Mobile")}</TableHead>
                    <TableHead>{t("লোকেশন", "Location")}</TableHead>
                    
                    <TableHead className="text-right">{t("ক্রেডিট", "Credit")}</TableHead>
                    <TableHead className="text-center">{t("অর্ডার", "Orders")}</TableHead>
                    <TableHead className="text-right">{t("মোট অ্যামাউন্ট", "Total Amount")}</TableHead>
                    <TableHead>{t("মন্তব্য", "Notes")}</TableHead>
                    <TableHead className="text-right">{t("অ্যাকশন", "Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.map((c) => (
                    <TableRow key={c.id} className={!c.access_allowed ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 flex-shrink-0">
                            <AvatarImage src={resolveProfilePic(c.profile_picture)} alt={c.name || "—"} />
                            <AvatarFallback className="text-[10px] bg-muted">{(c.name || "—").charAt(0)}</AvatarFallback>
                          </Avatar>
                          {!c.access_allowed && <Ban className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                          <span className="inline-flex items-center gap-1">
                            {c.name || "—"}
                            {c.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" stroke="white" strokeWidth={1.5} />}
                          </span>
                          {c.orderCount >= 2 ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"><RefreshCw className="w-2.5 h-2.5" />Repeat</span>
                          ) : c.orderCount === 1 ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700"><Star className="w-2.5 h-2.5" />New</span>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <span className="flex items-center gap-1.5">
                          {c.phone}
                          {c.phone_verified && (
                            <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[c.thana, c.district].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); openDetail(c); setCreditHistoryOpen(true); }}
                          className="font-semibold text-primary hover:underline cursor-pointer"
                        >
                          ৳{Number(c.credit_balance ?? 0).toFixed(2)}
                        </button>
                      </TableCell>
                      <TableCell className="text-center font-bold">{c.orderCount}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">৳{c.orderTotal}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{c.admin_notes || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openDetail(c)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
              </span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  {t("আগের", "Prev")}
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  {t("পরের", "Next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("কাস্টমার বিস্তারিত", "Customer Details")}</DialogTitle>
            <DialogDescription>{t("তথ্য দেখুন ও এডিট করুন", "View and edit information")}</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("নাম", "Name")}</Label>
                  <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <div>
                  <Label>{t("জেন্ডার", "Gender")}</Label>
                  <Select value={editData.gender} onValueChange={(v) => setEditData({ ...editData, gender: v })}>
                    <SelectTrigger><SelectValue placeholder={t("নির্বাচন করুন", "Select")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("পুরুষ", "Male")}</SelectItem>
                      <SelectItem value="female">{t("মহিলা", "Female")}</SelectItem>
                      <SelectItem value="other">{t("অন্যান্য", "Other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("মোবাইল", "Mobile")}</Label>
                  <Input value={selectedCustomer.phone} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>{t("বিকল্প নম্বর", "Alt. Number")}</Label>
                  <Input value={editData.alt_phone} onChange={(e) => setEditData({ ...editData, alt_phone: e.target.value })} />
                </div>
                <div>
                  <Label>{t("জেলা", "District")}</Label>
                  <Input value={editData.district} onChange={(e) => setEditData({ ...editData, district: e.target.value })} />
                </div>
                <div>
                  <Label>{t("থানা", "Thana")}</Label>
                  <Input value={editData.thana} onChange={(e) => setEditData({ ...editData, thana: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>{t("ঠিকানা", "Address")}</Label>
                  <Input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} />
                </div>

              </div>

              <div className="border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t("মোট অর্ডার", "Total Orders")}</p>
                    <p className="font-bold text-lg flex items-center gap-2">
                      {selectedCustomer.orderCount}
                      {selectedCustomer.orderCount >= 2 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">Repeat</span>
                      ) : selectedCustomer.orderCount === 1 ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">New</span>
                      ) : null}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("মোট অ্যামাউন্ট", "Total Amount")}</p>
                    <p className="font-bold text-lg text-primary">৳{selectedCustomer.orderTotal}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <Label className="mb-2 block">{t("অর্ডার হিস্ট্রি", "Order History")}</Label>
                <CustomerOrderHistory phone={selectedCustomer.phone} />
              </div>

              <div>
                <Label>{t("এডমিন মন্তব্য", "Admin Notes")}</Label>
                <Textarea value={editData.admin_notes} onChange={(e) => setEditData({ ...editData, admin_notes: e.target.value })} rows={3} />
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant={selectedCustomer.is_verified ? "outline" : "default"}
                  onClick={() => verifyMutation.mutate({ id: selectedCustomer.id, verify: !selectedCustomer.is_verified })}
                  disabled={verifyMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <BadgeCheck className="w-4 h-4 mr-2" fill={selectedCustomer.is_verified ? "currentColor" : "none"} />
                  )}
                  {selectedCustomer.is_verified ? t("ভেরিফিকেশন তুলুন", "Unverify") : t("ভেরিফাই করুন", "Verify")}
                </Button>
                <Button
                  variant={selectedCustomer.access_allowed ? "destructive" : "outline"}
                  onClick={() => setBanConfirm({
                    visitor_id: selectedCustomer.visitor_id,
                    ban: selectedCustomer.access_allowed,
                    name: selectedCustomer.name || selectedCustomer.phone,
                  })}
                  className="w-full sm:w-auto"
                >
                  {selectedCustomer.access_allowed ? <Ban className="w-4 h-4 mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                  {selectedCustomer.access_allowed ? t("ব্যান করুন", "Ban User") : t("আনব্যান করুন", "Unban User")}
                </Button>
                <Button onClick={() => updateMutation.mutate(editData)} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {t("সেভ করুন", "Save")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={!!banConfirm} onOpenChange={() => setBanConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {banConfirm?.ban ? <Ban className="w-5 h-5 text-destructive" /> : <ShieldCheck className="w-5 h-5 text-green-600" />}
              {banConfirm?.ban ? t("ব্যান নিশ্চিত করুন", "Confirm Ban") : t("আনব্যান নিশ্চিত করুন", "Confirm Unban")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {banConfirm?.ban
                ? t(
                    `"${banConfirm?.name}" কে ব্যান করলে এই ইউজার আর সাইটে প্রবেশ বা অর্ডার করতে পারবে না। আপনি কি নিশ্চিত?`,
                    `Banning "${banConfirm?.name}" will block site access and ordering. Are you sure?`
                  )
                : t(
                    `"${banConfirm?.name}" এর ব্যান তুলে নিলে সে আবার সাইটে প্রবেশ ও অর্ডার করতে পারবে।`,
                    `Unbanning "${banConfirm?.name}" will restore site access and ordering.`
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("বাতিল", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={banConfirm?.ban ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              disabled={banMutation.isPending}
              onClick={() => {
                if (banConfirm) banMutation.mutate({ visitor_id: banConfirm.visitor_id, ban: banConfirm.ban });
              }}
            >
              {banMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {banConfirm?.ban ? t("ব্যান করুন", "Ban") : t("আনব্যান করুন", "Unban")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedCustomer && (
        <CreditHistoryDialog
          open={creditHistoryOpen}
          onOpenChange={setCreditHistoryOpen}
          profileId={selectedCustomer.id}
          creditBalance={selectedCustomer.credit_balance}
          adminView
        />
      )}

      <BulkSmsDialog
        open={bulkSmsOpen}
        onOpenChange={setBulkSmsOpen}
        phones={customers?.map(c => c.phone) || []}
        filterLabel={`${statusFilter !== "all" ? statusFilter : ""} ${t("কাস্টমার", "customers")}`.trim()}
      />

      {/* Create Fake User Dialog (no OTP, instant create) */}
      <Dialog open={createUserOpen} onOpenChange={(o) => { setCreateUserOpen(o); if (!o) setShowCreatePwd(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {t("নতুন ইউজার তৈরি", "Create New User")}
            </DialogTitle>
            <DialogDescription>
              {t("OTP ছাড়াই ফোন ও পাসওয়ার্ড দিয়ে user তৈরি করুন। এই user দিয়ে সরাসরি login করে post / comment করা যাবে।",
                 "Create a user instantly with phone & password, no OTP. The user can log in and post/comment normally.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">{t("ফোন নম্বর *", "Phone *")}</Label>
              <Input
                placeholder="01XXXXXXXXX"
                value={createUserData.phone}
                onChange={(e) => setCreateUserData({ ...createUserData, phone: e.target.value })}
                inputMode="numeric"
                maxLength={13}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">{t("পাসওয়ার্ড * (কমপক্ষে ৬ অক্ষর)", "Password * (min 6 chars)")}</Label>
              <div className="relative">
                <Input
                  type={showCreatePwd ? "text" : "password"}
                  value={createUserData.password}
                  onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="toggle password"
                >
                  {showCreatePwd ? <EyeOff className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("নাম (optional)", "Name (optional)")}</Label>
              <Input
                placeholder={t("যেমন: রহিম উদ্দিন", "e.g. Rahim")}
                value={createUserData.name}
                onChange={(e) => setCreateUserData({ ...createUserData, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">{t("লিঙ্গ (optional)", "Gender (optional)")}</Label>
              <Select value={createUserData.gender || undefined} onValueChange={(v) => setCreateUserData({ ...createUserData, gender: v })}>
                <SelectTrigger><SelectValue placeholder={t("নির্বাচন করুন", "Select")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("পুরুষ", "Male")}</SelectItem>
                  <SelectItem value="female">{t("মহিলা", "Female")}</SelectItem>
                  <SelectItem value="other">{t("অন্যান্য", "Other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserOpen(false)} disabled={createUserLoading}>
              {t("বাতিল", "Cancel")}
            </Button>
            <Button onClick={handleCreateFakeUser} disabled={createUserLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {createUserLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {t("তৈরি করুন", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
