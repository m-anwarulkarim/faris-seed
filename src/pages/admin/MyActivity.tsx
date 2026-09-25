import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2, CheckCircle, Truck, XCircle, Clock, Package,
  ShieldCheck, Shield, User as UserIcon, RotateCcw, Ban,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";

const SUPER_ADMIN_EMAILS = ["dev.anwarul@gmail.com", "amdadulislammilon9@gmail.com"];

export default function MyActivity() {
  const { t } = useLanguage();

  // Current user info
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["my-activity-user"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const userId = session.user.id;
      const email = session.user.email || "";
      const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email as string);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "moderator"])
        .maybeSingle();

      // Get admin metadata from app_settings
      const { data: metaData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", `admin_meta_${userId}`)
        .maybeSingle();

      let meta: any = {};
      if (metaData?.value) {
        try { meta = JSON.parse(metaData.value); } catch {}
      }

      return {
        id: userId,
        email,
        role: roleData?.role || "unknown",
        isSuperAdmin,
        name: meta.name || email.split("@")[0],
        photo: meta.photo || null,
        joining_date: meta.joining_date || null,
      };
    },
  });

  // Orders handled by this admin (last 30 days) — either created or status changed by them
  const { data: myOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["my-activity-orders", currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, created_at, updated_at, total_amount, created_by_admin_id, last_status_changed_by")
        .eq("is_deleted", false)
        .gte("updated_at", subDays(new Date(), 30).toISOString())
        .or(`created_by_admin_id.eq.${currentUser!.id},last_status_changed_by.eq.${currentUser!.id}`)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Last 30 days stats for this admin
  const { data: allTimeStats } = useQuery({
    queryKey: ["my-activity-30d", currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();

      // Orders created by this admin (30d)
      const { count: createdCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false)
        .eq("created_by_admin_id", currentUser!.id)
        .gte("created_at", since);

      // Orders where this admin last changed the status (30d)
      const { data: changedData, error } = await supabase
        .from("orders")
        .select("id, status, total_amount")
        .eq("is_deleted", false)
        .eq("last_status_changed_by", currentUser!.id)
        .gte("updated_at", since);
      if (error) throw error;

      const changed = changedData || [];
      const confirmed = changed.filter(o => ["confirmed", "printed", "entry_done", "shipped", "delivered"].includes(o.status)).length;
      const delivered = changed.filter(o => o.status === "delivered").length;
      const cancelled = changed.filter(o => o.status === "cancelled").length;
      const returned = changed.filter(o => ["return", "rtn_received", "partial_delivered"].includes(o.status)).length;
      const totalProcessed = changed.length;

      return { totalCreated: createdCount || 0, totalProcessed, confirmed, delivered, cancelled, returned };
    },
  });

  // Chart: last 14 days order activity by this admin
  const chartData = (() => {
    if (!myOrders || !currentUser) return [];
    const now = new Date();
    const days = eachDayOfInterval({ start: subDays(now, 13), end: now });
    // Orders where this admin created or last changed status
    const myHandled = myOrders;

    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayOrders = myHandled.filter(o => format(new Date(o.updated_at), "yyyy-MM-dd") === dayStr);
      return {
        label: format(day, "dd MMM"),
        orders: dayOrders.length,
      };
    });
  })();

  const roleLabel = (role: string, isSuperAdmin: boolean) => {
    if (isSuperAdmin) return t("সুপার অ্যাডমিন", "Super Admin");
    if (role === "admin") return t("অ্যাডমিন", "Admin");
    if (role === "moderator") return t("মডারেটর", "Moderator");
    return role;
  };

  const roleIcon = (role: string, isSuperAdmin: boolean) => {
    if (isSuperAdmin) return <ShieldCheck className="w-4 h-4 text-primary" />;
    if (role === "admin") return <Shield className="w-4 h-4 text-blue-500" />;
    return <UserIcon className="w-4 h-4 text-muted-foreground" />;
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentUser) return null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 6) return t("শুভ রাত্রি", "Good Night");
    if (hour < 12) return t("শুভ সকাল", "Good Morning");
    if (hour < 17) return t("শুভ দুপুর", "Good Afternoon");
    if (hour < 20) return t("শুভ সন্ধ্যা", "Good Evening");
    return t("শুভ রাত্রি", "Good Night");
  })();

  return (
    <div className="space-y-4">

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 border-2 border-primary/20">
              <AvatarImage src={currentUser.photo || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {(currentUser.name || "?")[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold truncate">{currentUser.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
              <div className="flex items-center gap-2 mt-1">
                {roleIcon(currentUser.role, currentUser.isSuperAdmin)}
                <Badge variant="secondary" className="text-xs">
                  {roleLabel(currentUser.role, currentUser.isSuperAdmin)}
                </Badge>
                {currentUser.joining_date && (
                  <span className="text-xs text-muted-foreground">
                    {t("যোগদান:", "Joined:")} {currentUser.joining_date}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Package}
          label={t("তৈরিকৃত", "Created")}
          value={String(allTimeStats?.totalCreated || 0)}
        />
        <StatCard
          icon={CheckCircle}
          label={t("প্রক্রিয়াকৃত", "Processed")}
          value={String(allTimeStats?.totalProcessed || 0)}
          color="text-primary"
        />
        <StatCard
          icon={CheckCircle}
          label={t("কনফার্মড", "Confirmed")}
          value={String(allTimeStats?.confirmed || 0)}
          color="text-blue-500"
        />
        <StatCard
          icon={Truck}
          label={t("ডেলিভার্ড", "Delivered")}
          value={String(allTimeStats?.delivered || 0)}
          color="text-green-500"
        />
        <StatCard
          icon={Ban}
          label={t("বাতিল", "Cancelled")}
          value={String(allTimeStats?.cancelled || 0)}
          color="text-destructive"
        />
        <StatCard
          icon={RotateCcw}
          label={t("রিটার্ন", "Return")}
          value={String(allTimeStats?.returned || 0)}
          color="text-orange-500"
        />
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("গত ১৪ দিনের কার্যক্রম", "Activity (Last 14 Days)")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="h-[220px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip
                    formatter={(value: number) => [value, t("অর্ডার", "Orders")]}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent orders created by me */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("আমার সাম্প্রতিক অর্ডার", "My Recent Orders")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {(myOrders || [])
              .slice(0, 10)
              .map(order => (
                <div key={order.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon status={order.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">৳{Number(order.total_amount).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(order.updated_at), "dd MMM yyyy, hh:mm a")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {order.status}
                  </Badge>
                </div>
              ))}
            {(!myOrders || myOrders.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t("কোনো অর্ডার নেই", "No orders")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending": return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
    case "confirmed": return <CheckCircle className="w-3.5 h-3.5 text-blue-500" />;
    case "delivered": return <Truck className="w-3.5 h-3.5 text-green-500" />;
    case "cancelled": return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className={`w-3.5 h-3.5 ${color || ""}`} />
          {label}
        </div>
        <p className={`text-xl font-bold ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
