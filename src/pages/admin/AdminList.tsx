import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Star, Shield, UserCog, Trash2, ChevronDown, Loader2, Pencil,
  LayoutDashboard, Eye, BarChart3, TrendingUp, Megaphone, Activity,
  Package, ListOrdered, BookOpen, Tag, Gift, MessageSquare,
  ShoppingCart, Search, ClipboardList, CalendarClock, ShieldAlert,
  Users, UsersRound, Globe, Code, FileText, FileImage, Bot,
  Settings, Palette, Languages, MousePointer2, User,
  Monitor, Smartphone, Tablet, LogOut, Wifi, Ban, ShieldOff,
  Headphones, Inbox, AlertTriangle, Brain, ArrowUpDown, Warehouse,
  BellRing,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  role: string;
  permissions: string[];
  user_metadata: Record<string, any>;
}

interface BlockedDevice {
  id: string;
  block_type: string;
  block_value: string;
  reason: string | null;
  blocked_at: string;
}

const SUPER_ADMIN_EMAILS = ["dev.anwarul@gmail.com", "amdadulislammilon9@gmail.com"];
const HIDDEN_ADMIN_EMAILS = ["dev.anwarul@gmail.com"];

const menuStructure = [
  {
    key: "dashboard",
    label: "ড্যাশবোর্ড",
    icon: LayoutDashboard,
    children: [
      { key: "overview", label: "ওভারভিউ", icon: Eye },
      { key: "sales-report", label: "বিক্রি রিপোর্ট", icon: BarChart3 },
      { key: "top-products", label: "শীর্ষ পণ্য", icon: TrendingUp },
      
      
      
    ],
  },
  {
    key: "support",
    label: "কাস্টমার সাপোর্ট",
    icon: Headphones,
    children: [
      
      { key: "support-reports", label: "অভিযোগ", icon: AlertTriangle },
    ],
  },
  {
    key: "products",
    label: "পণ্য",
    icon: Package,
    children: [
      { key: "product-list", label: "পণ্য তালিকা", icon: ListOrdered },
      { key: "inventory", label: "ইনভেন্টরি", icon: Warehouse },
      { key: "categories", label: "ক্যাটাগরি", icon: BookOpen },
      { key: "product-tags", label: "প্রোডাক্ট ট্যাগ", icon: Tag },
      { key: "offers", label: "অফার", icon: Gift },
      { key: "reviews", label: "রিভিউ", icon: MessageSquare },
    ],
  },
  {
    key: "orders",
    label: "ওয়েব অর্ডার",
    icon: ShoppingCart,
    children: [
      { key: "orders-create", label: "নতুন তৈরি", icon: Plus },
      { key: "orders-search", label: "সার্চ", icon: Search },
      { key: "orders-web", label: "ওয়েব অর্ডার", icon: ClipboardList },
      { key: "orders-pre", label: "প্রি-অর্ডার", icon: CalendarClock },
      { key: "orders-list", label: "অর্ডার তালিকা", icon: ClipboardList },
      { key: "orders-reports", label: "রিপোর্ট", icon: ShieldAlert },
      { key: "orders-deleted", label: "মুছে ফেলা", icon: Trash2 },
    ],
  },
  {
    key: "users",
    label: "ইউজার",
    icon: Users,
    children: [
      { key: "users-admins", label: "অ্যাডমিন", icon: UserCog },
      { key: "users-customers", label: "কাস্টমার", icon: UsersRound },
    ],
  },
  {
    key: "website",
    label: "ওয়েবসাইট",
    icon: Globe,
    children: [
      { key: "website-api", label: "API", icon: Code },
      { key: "website-pages", label: "পেজ", icon: FileText },
      { key: "website-media", label: "মিডিয়া", icon: FileImage },
      { key: "settings-import-export", label: "ইমপোর্ট/এক্সপোর্ট", icon: ArrowUpDown },
      { key: "website-ai", label: "AI", icon: Bot },
      
      
      
    ],
  },
  {
    key: "courier",
    label: "কুরিয়ার",
    icon: ShoppingCart,
    children: [
      { key: "courier-handle", label: "কুরিয়ার হ্যান্ডেল", icon: ClipboardList },
    ],
  },
  {
    key: "settings",
    label: "সেটিংস",
    icon: Settings,
    children: [
      { key: "settings-theme", label: "থিম", icon: Palette },
      { key: "settings-language", label: "ভাষা", icon: Languages },
      { key: "settings-cursor", label: "কার্সর ইফেক্ট", icon: MousePointer2 },
      { key: "settings-menu", label: "মেনু কন্ট্রোল", icon: Settings },
      
    ],
  },
  {
    key: "notifications",
    label: "নোটিফিকেশন",
    icon: BellRing,
    children: [
      { key: "notifications-orders", label: "অর্ডার স্ট্যাটাস", icon: ShoppingCart },
      { key: "notifications-sms", label: "SMS লগ", icon: Smartphone },
      { key: "notifications-push", label: "পুশ ব্রডকাস্ট", icon: BellRing },
    ],
  },
];

export default function AdminList() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editIdCard, setEditIdCard] = useState("");
  const [editJoinDate, setEditJoinDate] = useState("");
  const [editRole, setEditRole] = useState("moderator");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newIdCard, setNewIdCard] = useState("");
  const [newJoinDate, setNewJoinDate] = useState("");
  const [newRole, setNewRole] = useState("moderator");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [blockValue, setBlockValue] = useState("");
  const [blockType, setBlockType] = useState<"device" | "ip">("ip");
  const [blockReason, setBlockReason] = useState("");

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admin-list"],
    queryFn: async () => {
      const res = await supabase.functions.invoke("manage-admin", {
        body: { action: "list" },
      });
      if (res.error) throw res.error;
      const raw = res.data;
      const result = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(result)) return result as AdminUser[];
      return [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const { data: res } = await supabase.functions.invoke("admin-otp", {
        body: { action: "list_sessions" },
      });
      return res?.sessions || [];
    },
  });

  const { data: blockedDevices = [] } = useQuery({
    queryKey: ["blocked-devices"],
    queryFn: async () => {
      const { data: res } = await supabase.functions.invoke("admin-otp", {
        body: { action: "list_blocked" },
      });
      return (res?.blocked || []) as BlockedDevice[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("manage-admin", {
        body: { action: "create", email: newEmail, password: newPassword, name: newName, photo_url: newPhotoUrl, id_card: newIdCard, join_date: newJoinDate, role: newRole, permissions: selectedPermissions },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("নতুন অ্যাডমিন তৈরি হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewPhotoUrl(""); setNewIdCard(""); setNewJoinDate(""); setNewRole("moderator"); setSelectedPermissions([]);
    },
    onError: (e: any) => toast.error(e.message || "ত্রুটি হয়েছে"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await supabase.functions.invoke("manage-admin", {
        body: { action: "delete", user_id: userId },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("অ্যাডমিন মুছে ফেলা হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
    },
    onError: (e: any) => toast.error(e.message || "ত্রুটি হয়েছে"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingAdmin) return;
      const res = await supabase.functions.invoke("manage-admin", {
        body: {
          action: "update",
          user_id: editingAdmin.id,
          name: editName,
          photo_url: editPhotoUrl,
          id_card: editIdCard,
          join_date: editJoinDate,
          role: editRole,
          permissions: editPermissions,
        },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast.success("অ্যাডমিন আপডেট হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      setEditOpen(false);
      setEditingAdmin(null);
    },
    onError: (e: any) => toast.error(e.message || "ত্রুটি হয়েছে"),
  });

  const deactivateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-otp", {
        body: { action: "deactivate_session", session_id: sessionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("সেশন নিষ্ক্রিয় করা হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    },
    onError: (e: any) => toast.error(e.message || "ত্রুটি হয়েছে"),
  });

  const openEditDialog = (admin: AdminUser) => {
    setEditingAdmin(admin);
    setEditName(admin.user_metadata?.full_name || "");
    setEditPhotoUrl(admin.user_metadata?.avatar_url || "");
    setEditIdCard(admin.user_metadata?.id_card || "");
    setEditJoinDate(admin.user_metadata?.join_date || "");
    setEditRole(admin.role);
    setEditPermissions(admin.permissions || []);
    setEditOpen(true);
  };

  const blockMutation = useMutation({
    mutationFn: async ({ type, value, reason }: { type: string; value: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-otp", {
        body: { action: "block_device", block_type: type, block_value: value, reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("ব্লক করা হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["blocked-devices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
      setBlockValue(""); setBlockReason("");
    },
    onError: (e: any) => toast.error(e.message || "ত্রুটি হয়েছে"),
  });

  const unblockMutation = useMutation({
    mutationFn: async ({ type, value }: { type: string; value: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-otp", {
        body: { action: "unblock_device", block_type: type, block_value: value },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("আনব্লক করা হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["blocked-devices"] });
    },
    onError: (e: any) => toast.error(e.message || "ত্রুটি হয়েছে"),
  });

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleMenuGroup = (menu: typeof menuStructure[0]) => {
    const childKeys = menu.children.map((c) => c.key);
    const allSelected = childKeys.every((k) => selectedPermissions.includes(k));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !childKeys.includes(p)));
    } else {
      setSelectedPermissions((prev) => [...new Set([...prev, ...childKeys])]);
    }
  };

  const toggleEditPermission = (key: string) => {
    setEditPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleEditMenuGroup = (menu: typeof menuStructure[0]) => {
    const childKeys = menu.children.map((c) => c.key);
    const allSelected = childKeys.every((k) => editPermissions.includes(k));
    if (allSelected) {
      setEditPermissions((prev) => prev.filter((p) => !childKeys.includes(p)));
    } else {
      setEditPermissions((prev) => [...new Set([...prev, ...childKeys])]);
    }
  };

  const getRoleBadge = (role: string, email: string) => {
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email as string);
    if (isSuperAdmin) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-0 gap-1">
          <Star className="w-3 h-3 fill-white" /> Super Admin
        </Badge>
      );
    }
    if (role === "admin") {
      return <Badge variant="destructive" className="gap-1"><Shield className="w-3 h-3" /> Admin</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><UserCog className="w-3 h-3" /> Moderator</Badge>;
  };

  const sortedAdmins = [...admins].sort((a, b) => {
    if (SUPER_ADMIN_EMAILS.includes(a.email as string)) return -1;
    if (SUPER_ADMIN_EMAILS.includes(b.email as string)) return 1;
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (b.role === "admin" && a.role !== "admin") return 1;
    return 0;
  });

  // Quick block from session row
  const handleBlockFromSession = (session: any, type: "device" | "ip") => {
    const value = type === "device" ? session.device_fingerprint : session.ip_address;
    if (!value) { toast.error("মান পাওয়া যায়নি"); return; }
    if (confirm(`${type === "device" ? "ডিভাইস" : "IP"} ব্লক করবেন: ${value}?`)) {
      blockMutation.mutate({ type, value, reason: `Blocked from session panel` });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              {t("নতুন অ্যাডমিন", "New Admin")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("নতুন অ্যাডমিন তৈরি করুন", "Create New Admin")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("নাম", "Name")}</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Admin Name" />
                </div>
                <div className="space-y-2">
                  <Label>{t("ছবি URL", "Photo URL")}</Label>
                  <Input value={newPhotoUrl} onChange={(e) => setNewPhotoUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("আইডি কার্ড নম্বর", "ID Card Number")}</Label>
                  <Input value={newIdCard} onChange={(e) => setNewIdCard(e.target.value)} placeholder="e.g. AB-001" />
                </div>
                <div className="space-y-2">
                  <Label>{t("যোগদানের তারিখ", "Join Date")}</Label>
                  <Input type="date" value={newJoinDate} onChange={(e) => setNewJoinDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("রোল", "Role")}</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">{t("মেনু পারমিশন", "Menu Permissions")}</Label>
                <div className="border rounded-lg divide-y">
                  {menuStructure.map((menu) => {
                    const childKeys = menu.children.map((c) => c.key);
                    const allSelected = childKeys.every((k) => selectedPermissions.includes(k));
                    const someSelected = childKeys.some((k) => selectedPermissions.includes(k));
                    const MenuIcon = menu.icon;

                    return (
                      <Collapsible key={menu.key}>
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                          <Checkbox
                            checked={allSelected}
                            // @ts-ignore
                            indeterminate={someSelected && !allSelected}
                            onCheckedChange={() => toggleMenuGroup(menu)}
                          />
                          <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-sm font-medium">
                            <MenuIcon className="w-4 h-4 text-muted-foreground" />
                            {menu.label}
                            <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <div className="pl-10 pr-3 pb-2 space-y-1.5">
                            {menu.children.map((child) => {
                              const ChildIcon = child.icon;
                              return (
                                <label key={child.key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-primary text-sm">
                                  <Checkbox
                                    checked={selectedPermissions.includes(child.key)}
                                    onCheckedChange={() => togglePermission(child.key)}
                                  />
                                  <ChildIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                  {child.label}
                                </label>
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newEmail || !newPassword || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {t("অ্যাডমিন তৈরি করুন", "Create Admin")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Admin Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>{t("ছবি", "Photo")}</TableHead>
                <TableHead>{t("নাম / ইমেইল", "Name / Email")}</TableHead>
                <TableHead>{t("রোল", "Role")}</TableHead>
                <TableHead>{t("পারমিশন", "Permissions")}</TableHead>
                <TableHead>{t("যোগদান", "Joined")}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAdmins.map((admin, i) => {
                const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(admin.email as string);
                return (
                  <TableRow key={admin.id} className={isSuperAdmin ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                          {admin.user_metadata?.avatar_url ? (
                            <img src={admin.user_metadata.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        {isSuperAdmin && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500 absolute -top-1 -right-1" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {admin.user_metadata?.full_name || admin.email?.split("@")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">{admin.email}</p>
                        {admin.user_metadata?.id_card && (
                          <p className="text-[10px] text-primary font-mono">ID: {admin.user_metadata.id_card}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 font-mono">{admin.id?.slice(0, 8) || "N/A"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(admin.role, admin.email)}</TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <span className="text-xs text-amber-600 font-medium">{t("সকল অ্যাক্সেস", "Full Access")}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {admin.permissions?.length || 0} {t("মেনু", "menus")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {admin.user_metadata?.join_date
                        ? format(new Date(admin.user_metadata.join_date), "dd MMM yyyy")
                        : format(new Date(admin.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => openEditDialog(admin)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedAdmins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("কোনো অ্যাডমিন পাওয়া যায়নি", "No admins found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Admin Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("অ্যাডমিন সম্পাদনা", "Edit Admin")}</DialogTitle>
          </DialogHeader>
          {editingAdmin && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("নাম", "Name")}</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Admin Name" />
                </div>
                <div className="space-y-2">
                  <Label>{t("ছবি URL", "Photo URL")}</Label>
                  <Input value={editPhotoUrl} onChange={(e) => setEditPhotoUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("আইডি কার্ড নম্বর", "ID Card Number")}</Label>
                  <Input value={editIdCard} onChange={(e) => setEditIdCard(e.target.value)} placeholder="e.g. AB-001" />
                </div>
                <div className="space-y-2">
                  <Label>{t("যোগদানের তারিখ", "Join Date")}</Label>
                  <Input type="date" value={editJoinDate} onChange={(e) => setEditJoinDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingAdmin.email} disabled className="bg-muted" />
              </div>

              {!SUPER_ADMIN_EMAILS.includes(editingAdmin.email as string) && (
                <div className="space-y-2">
                  <Label>{t("রোল", "Role")}</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!SUPER_ADMIN_EMAILS.includes(editingAdmin.email as string) && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">{t("মেনু পারমিশন", "Menu Permissions")}</Label>
                  <div className="border rounded-lg divide-y">
                    {menuStructure.map((menu) => {
                      const childKeys = menu.children.map((c) => c.key);
                      const allSelected = childKeys.every((k) => editPermissions.includes(k));
                      const someSelected = childKeys.some((k) => editPermissions.includes(k));
                      const MenuIcon = menu.icon;

                      return (
                        <Collapsible key={menu.key}>
                          <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                            <Checkbox
                              checked={allSelected}
                              // @ts-ignore
                              indeterminate={someSelected && !allSelected}
                              onCheckedChange={() => toggleEditMenuGroup(menu)}
                            />
                            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-sm font-medium">
                              <MenuIcon className="w-4 h-4 text-muted-foreground" />
                              {menu.label}
                              <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent>
                            <div className="pl-10 pr-3 pb-2 space-y-1.5">
                              {menu.children.map((child) => {
                                const ChildIcon = child.icon;
                                return (
                                  <label key={child.key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-primary text-sm">
                                    <Checkbox
                                      checked={editPermissions.includes(child.key)}
                                      onCheckedChange={() => toggleEditPermission(child.key)}
                                    />
                                    <ChildIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                    {child.label}
                                  </label>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {t("সেভ করুন", "Save")}
                </Button>

                {!SUPER_ADMIN_EMAILS.includes(editingAdmin.email as string) && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm("এই অ্যাডমিন মুছে ফেলবেন? এটি ফেরত আনা যাবে না।")) {
                        deleteMutation.mutate(editingAdmin.id);
                        setEditOpen(false);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {t("মুছুন", "Delete")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            {t("অ্যাক্টিভ সেশন", "Active Sessions")}
            {sessions.length > 0 && (
              <Badge variant="secondary" className="ml-1">{sessions.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("কোনো অ্যাক্টিভ সেশন নেই", "No active sessions")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("এডমিন", "Admin")}</TableHead>
                  <TableHead>{t("ডিভাইস", "Device")}</TableHead>
                  <TableHead>{t("আইপি", "IP")}</TableHead>
                  <TableHead>{t("সর্বশেষ অ্যাক্টিভ", "Last Active")}</TableHead>
                  <TableHead className="w-32">{t("অ্যাকশন", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session: any) => {
                  const admin = admins.find((a) => a.id === session.user_id);
                  const DeviceIcon = session.device_type === "Phone" ? Smartphone
                    : session.device_type === "Tablet" ? Tablet : Monitor;

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {admin?.user_metadata?.full_name || admin?.email?.split("@")[0] || session.user_id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <DeviceIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">{session.device_name || session.device_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{session.ip_address || "N/A"}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(session.last_active_at), "dd MMM, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            title={t("সেশন বন্ধ করুন", "End session")}
                            onClick={() => {
                              if (confirm("এই সেশন নিষ্ক্রিয় করবেন?")) {
                                deactivateSessionMutation.mutate(session.id);
                              }
                            }}
                            disabled={deactivateSessionMutation.isPending}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            title={t("ডিভাইস ব্লক", "Block device")}
                            onClick={() => handleBlockFromSession(session, "device")}
                            disabled={blockMutation.isPending}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                          {session.ip_address && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              title={t("IP ব্লক", "Block IP")}
                              onClick={() => handleBlockFromSession(session, "ip")}
                              disabled={blockMutation.isPending}
                            >
                              <ShieldOff className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Blocked Devices / IPs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Ban className="w-5 h-5" />
            {t("ব্লক করা ডিভাইস/আইপি", "Blocked Devices/IPs")}
            {blockedDevices.length > 0 && (
              <Badge variant="destructive" className="ml-1">{blockedDevices.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual block form */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("ধরন", "Type")}</Label>
              <Select value={blockType} onValueChange={(v) => setBlockType(v as "device" | "ip")}>
                <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">IP</SelectItem>
                  <SelectItem value="device">ডিভাইস</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <Label className="text-xs">{t("মান", "Value")}</Label>
              <Input
                value={blockValue}
                onChange={(e) => setBlockValue(e.target.value)}
                placeholder={blockType === "ip" ? "192.168.1.1" : "device_fingerprint"}
                className="h-9"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <Label className="text-xs">{t("কারণ", "Reason")}</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="ঐচ্ছিক"
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              variant="destructive"
              disabled={!blockValue.trim() || blockMutation.isPending}
              onClick={() => blockMutation.mutate({ type: blockType, value: blockValue.trim(), reason: blockReason.trim() || undefined })}
              className="h-9"
            >
              {blockMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {t("ব্লক করুন", "Block")}
            </Button>
          </div>

          {blockedDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("কোনো ব্লক নেই", "No blocks")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ধরন", "Type")}</TableHead>
                  <TableHead>{t("মান", "Value")}</TableHead>
                  <TableHead>{t("কারণ", "Reason")}</TableHead>
                  <TableHead>{t("তারিখ", "Date")}</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedDevices.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={item.block_type === "ip" ? "destructive" : "secondary"}>
                        {item.block_type === "ip" ? "IP" : "ডিভাইস"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{item.block_value}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.reason || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.blocked_at), "dd MMM, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary"
                        onClick={() => {
                          if (confirm("আনব্লক করবেন?")) {
                            unblockMutation.mutate({ type: item.block_type, value: item.block_value });
                          }
                        }}
                        disabled={unblockMutation.isPending}
                      >
                        আনব্লক
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
