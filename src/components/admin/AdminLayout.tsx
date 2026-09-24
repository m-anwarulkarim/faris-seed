import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, X, ShieldAlert, Plus, Search, List, Globe, CalendarClock, Package, Layers, Tag, BarChart3, Users, ShieldCheck, Settings, Palette, Languages, MousePointer2, MessageSquare, FileText, Image, ArrowDownUp, Brain, BookOpen, Bell, MessageCircle, Share2, DollarSign, ArrowRightLeft, ChevronsLeftRight, Keyboard } from "lucide-react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { CursorProvider } from "@/contexts/CursorContext";
import { CustomCursor } from "./CustomCursor";

import { PushNotificationPrompt } from "./PushNotificationPrompt";
import { NewSupportReportAlert } from "./NewSupportReportAlert";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentAdminAccess } from "@/lib/adminAccess";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useOrdersRealtime } from "@/hooks/useOrdersRealtime";
import { savePageState, restoreScroll } from "@/lib/adminPageState";

const SUPER_ADMIN_EMAILS = ["grihanova26@gmail.com", "dev.anwarul@gmail.com"];
const WEB_ORDER_SOURCE_FILTER = "traffic_source.is.null,traffic_source.neq.ecomdrive";

// URL → permission key mapping (must match AdminSidebar)
const urlToPermission: Record<string, string> = {
  "/e/overview": "overview",
  "/e/sales-report": "sales-report",
  "/e/top-products": "top-products",
  
  
  
  "/e/products": "product-list",
  "/e/inventory": "inventory",
  "/e/categories": "categories",
  "/e/product-tags": "product-tags",
  "/e/offers": "offers",
  "/e/reviews": "reviews",
  "/e/qa": "reviews",
  "/e/review-qa-settings": "reviews",
  "/e/orders/create": "orders-create",
  "/e/orders/search": "orders-search",
  "/e/orders/web": "orders-web",
  "/e/orders/pre": "orders-pre",
  "/e/orders/list": "orders-list",
  "/e/orders/reports": "orders-reports",
  "/e/orders/deleted": "orders-deleted",
  "/e/users/admins": "users-admins",
  "/e/users/customers": "users-customers",
  "/e/website/api": "website-api",
  "/e/website/pages": "website-pages",
  "/e/website/media": "website-media",
  "/e/website/import-export": "settings-import-export",
  
  
  
  
  
  "/e/courier": "courier-handle",
  "/e/message-monitor": "support-inbox",
  "/e/settings/theme": "settings-theme",
  "/e/settings/language": "settings-language",
  "/e/settings/cursor": "settings-cursor",
  "/e/settings/menu": "settings-menu",
  "/e/support/reports": "support-reports",
  "/e/notifications/orders": "notifications-orders",
  "/e/notifications/sms": "notifications-sms",
  "/e/notifications/push": "notifications-push",
};

// Route → page title/subtitle mapping
const routeTitles: Record<string, { bn: string; en: string; subBn?: string; subEn?: string }> = {
  "/e/overview": { bn: "ওভারভিউ", en: "Overview", subBn: "আপনার ব্যবসার সারসংক্ষেপ", subEn: "Your business summary" },
  "/e/my-activity": { bn: "আমার অ্যাক্টিভিটি", en: "My Activity" },
  "/e/sales-report": { bn: "বিক্রি রিপোর্ট", en: "Sales Report" },
  "/e/top-products": { bn: "টপ প্রোডাক্ট", en: "Top Products" },
  
  
  
  "/e/products": { bn: "পণ্য তালিকা", en: "Product List", subBn: "সকল পণ্য পরিচালনা করুন", subEn: "Manage all products" },
  "/e/products/new": { bn: "নতুন পণ্য", en: "New Product" },
  "/e/inventory": { bn: "ইনভেন্টরি ম্যানেজমেন্ট", en: "Inventory Management" },
  "/e/categories": { bn: "ক্যাটাগরি", en: "Categories" },
  "/e/product-tags": { bn: "প্রোডাক্ট ট্যাগ", en: "Product Tags" },
  "/e/orders/create": { bn: "নতুন অর্ডার", en: "Create Order" },
  "/e/orders/search": { bn: "অর্ডার সার্চ", en: "Order Search" },
  "/e/orders/web": { bn: "অর্ডারসমূহ", en: "All Orders" },
  "/e/courier": { bn: "কুরিয়ার হ্যান্ডেল", en: "Courier Handle" },
  "/e/orders/pre": { bn: "প্রি-অর্ডার", en: "Pre Orders", subBn: "প্রি-অর্ডার স্ট্যাটাসের সকল অর্ডার", subEn: "All orders with pre status" },
  "/e/orders/list": { bn: "অর্ডার তালিকা", en: "Order List" },
  "/e/orders/deleted": { bn: "মুছে ফেলা অর্ডার", en: "Deleted Orders" },
  "/e/users/admins": { bn: "অ্যাডমিন তালিকা", en: "Admin List" },
  "/e/users/customers": { bn: "কাস্টমার তালিকা", en: "Customer List" },
  "/e/website/api": { bn: "API ম্যানেজমেন্ট", en: "API Management" },
  "/e/website/pages": { bn: "পেজ ব্যবস্থাপনা", en: "Page Management" },
  "/e/website/media": { bn: "মিডিয়া", en: "Media Management" },
  "/e/website/import-export": { bn: "ইমপোর্ট / এক্সপোর্ট", en: "Import / Export" },
  
  
  
  "/e/settings/theme": { bn: "থিম সেটিংস", en: "Theme Settings" },
  "/e/settings/language": { bn: "ভাষা সেটিংস", en: "Language Settings" },
  "/e/settings/cursor": { bn: "কার্সর সেটিংস", en: "Cursor Settings" },
  "/e/settings/menu": { bn: "মেনু কন্ট্রোল", en: "Menu Control" },
  "/e/support/reports": { bn: "সাপোর্ট রিপোর্ট", en: "Support Reports" },
  "/e/notifications/orders": { bn: "অর্ডার নোটিফিকেশন", en: "Order Notifications" },
  "/e/notifications/sms": { bn: "SMS লগ", en: "SMS Logs" },
  "/e/notifications/push": { bn: "পুশ ব্রডকাস্ট", en: "Push Broadcast", subBn: "ফিল্টার করে কাস্টমারদের পুশ নোটিফিকেশন পাঠান", subEn: "Send push notifications to filtered customers" },
  "/e/coupons": { bn: "কুপন ম্যানেজমেন্ট", en: "Coupon Management" },
};

// My Activity is always accessible — no permission needed

function AiCreditWarningBanner() {
  const [warning, setWarning] = useState<{ type: string; timestamp: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ai_credit_warning")
        .maybeSingle();
      if (!data?.value) return;
      try {
        const parsed = JSON.parse(data.value);
        const warnTime = new Date(parsed.timestamp).getTime();
        if (Date.now() - warnTime < 24 * 60 * 60 * 1000) {
          setWarning(parsed);
        }
      } catch {}
    };
    check();
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    await supabase.from("app_settings").delete().eq("key", "ai_credit_warning");
  };

  if (!warning || dismissed) return null;

  const isCreditExhausted = warning.type === "credit_exhausted";

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
      isCreditExhausted 
        ? "bg-destructive/10 text-destructive border-b border-destructive/20" 
        : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-b border-yellow-500/20"
    }`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        {isCreditExhausted
          ? "⚠️ Mina ক্রেডিট ব্যালেন্স শেষ! কাস্টমার AI চ্যাট কাজ করছে না। অনুগ্রহ করে টপআপ করুন।"
          : "⚠️ AI রেট লিমিট হিট হয়েছে! কিছু কাস্টমার AI চ্যাট ব্যবহার করতে পারছে না।"}
      </span>
      <button onClick={handleDismiss} className="p-1 rounded hover:bg-background/50 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function usePageCounts(pathname: string) {
  // Pre-order count for subtitle
  const { data: preOrderCount } = useQuery({
    queryKey: ["header-pre-order-count"],
    enabled: pathname === "/e/orders/pre",
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pre")
        .eq("is_deleted", false);
      return count || 0;
    },
  });

  // Web order pending count
  const { data: webOrderCount } = useQuery({
    queryKey: ["header-web-order-count"],
    enabled: pathname === "/e/orders/web",
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("is_deleted", false)
        .or(WEB_ORDER_SOURCE_FILTER);
      return count || 0;
    },
  });

  if (pathname === "/e/orders/pre") return preOrderCount;
  if (pathname === "/e/orders/web") return webOrderCount;
  return undefined;
}

// Section shortcut definitions
type Shortcut = { icon: React.ElementType; label: string; labelBn: string; to: string };

const sectionShortcuts: Record<string, Shortcut[]> = {
  orders: [
    { icon: Plus, label: "Create", labelBn: "নতুন", to: "/e/orders/create" },
    { icon: Search, label: "Search", labelBn: "সার্চ", to: "/e/orders/search" },
    { icon: Globe, label: "Web", labelBn: "ওয়েব", to: "/e/orders/web" },
    { icon: CalendarClock, label: "Pre", labelBn: "প্রি", to: "/e/orders/pre" },
    { icon: List, label: "List", labelBn: "লিস্ট", to: "/e/orders/list" },
  ],
  products: [
    { icon: Plus, label: "New", labelBn: "নতুন", to: "/e/products/new" },
    { icon: Package, label: "Products", labelBn: "পণ্য", to: "/e/products" },
    { icon: Layers, label: "Inventory", labelBn: "ইনভেন্টরি", to: "/e/inventory" },
    { icon: List, label: "Categories", labelBn: "ক্যাটাগরি", to: "/e/categories" },
    { icon: Tag, label: "Tags", labelBn: "ট্যাগ", to: "/e/product-tags" },
  ],
  reports: [
    { icon: BarChart3, label: "Sales", labelBn: "বিক্রি", to: "/e/sales-report" },
    { icon: Package, label: "Top Products", labelBn: "টপ পণ্য", to: "/e/top-products" },
    
    
  ],
  users: [
    { icon: ShieldCheck, label: "Admins", labelBn: "অ্যাডমিন", to: "/e/users/admins" },
    { icon: Users, label: "Customers", labelBn: "কাস্টমার", to: "/e/users/customers" },
  ],
  website: [
    { icon: Settings, label: "API", labelBn: "API", to: "/e/website/api" },
    { icon: FileText, label: "Pages", labelBn: "পেজ", to: "/e/website/pages" },
    { icon: Image, label: "Media", labelBn: "মিডিয়া", to: "/e/website/media" },
    { icon: ArrowDownUp, label: "Import/Export", labelBn: "ইমপোর্ট", to: "/e/website/import-export" },
    
    
    
  ],
  settings: [
    { icon: Palette, label: "Theme", labelBn: "থিম", to: "/e/settings/theme" },
    { icon: Languages, label: "Language", labelBn: "ভাষা", to: "/e/settings/language" },
    { icon: MousePointer2, label: "Cursor", labelBn: "কার্সর", to: "/e/settings/cursor" },
    { icon: ChevronsLeftRight, label: "Menu Control", labelBn: "মেনু কন্ট্রোল", to: "/e/settings/menu" },
    
  ],
  support: [
    { icon: MessageCircle, label: "Reports", labelBn: "রিপোর্ট", to: "/e/support/reports" },
  ],
  notifications: [
    { icon: Bell, label: "Orders", labelBn: "অর্ডার", to: "/e/notifications/orders" },
    { icon: MessageSquare, label: "SMS", labelBn: "SMS", to: "/e/notifications/sms" },
    { icon: Bell, label: "Push", labelBn: "পুশ", to: "/e/notifications/push" },
  ],
  myActivity: [
    { icon: Search, label: "Search", labelBn: "সার্চ", to: "/e/orders/search" },
    { icon: Plus, label: "Add Order", labelBn: "নতুন অর্ডার", to: "/e/orders/create" },
    { icon: Globe, label: "All Orders", labelBn: "অর্ডারসমূহ", to: "/e/orders/web" },
  ],
};

// Map routes to their section
function getShortcutsForPath(pathname: string): Shortcut[] {
  if (pathname === "/e/courier") return sectionShortcuts.orders;
  if (pathname.startsWith("/e/orders/")) return sectionShortcuts.orders;
  if (pathname.startsWith("/e/products") || pathname === "/e/inventory" || pathname === "/e/categories" || pathname === "/e/product-tags") return sectionShortcuts.products;
  if (["/e/sales-report", "/e/top-products"].includes(pathname)) return sectionShortcuts.reports;
  if (pathname.startsWith("/e/users/")) return sectionShortcuts.users;
  if (pathname.startsWith("/e/website/")) return sectionShortcuts.website;
  if (pathname.startsWith("/e/settings/")) return sectionShortcuts.settings;
  if (pathname.startsWith("/e/support/")) return sectionShortcuts.support;
  if (pathname.startsWith("/e/notifications/")) return sectionShortcuts.notifications;
  if (pathname === "/e/my-activity") return sectionShortcuts.myActivity;
  if (pathname === "/e/overview") return sectionShortcuts.myActivity;
  return [];
}

function DollarRateWidget() {
  const [rate, setRate] = useState<number | null>(null);
  const [input, setInput] = useState("1");
  const [mode, setMode] = useState<"usd" | "bdt">("usd");

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(d => { if (d?.rates?.BDT) setRate(d.rates.BDT); })
      .catch(() => {});
  }, []);

  if (!rate) return null;

  const num = parseFloat(input) || 0;
  const result = mode === "usd" ? num * rate : num / rate;

  return (
    <div className="flex items-center gap-1.5 text-xs bg-muted/60 rounded-lg px-2.5 py-1.5 border border-border/50">
      <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-muted-foreground font-medium">১$ = ৳{rate.toFixed(1)}</span>
      <div className="w-px h-4 bg-border mx-0.5" />
      <span className="text-muted-foreground">{mode === "usd" ? "$" : "৳"}</span>
      <input
        type="number"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-14 bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
      <button onClick={() => { setMode(m => m === "usd" ? "bdt" : "usd"); setInput("1"); }} className="p-0.5 hover:bg-muted rounded transition-colors">
        <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
      </button>
      <span className="font-semibold text-foreground">{mode === "usd" ? "৳" : "$"}{result.toFixed(2)}</span>
    </div>
  );
}

function AdminHeader() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const count = usePageCounts(pathname);
  const isAdsReport = false;

  // Find matching route title (exact match first, then check for dynamic routes)
  let titleInfo = routeTitles[pathname];
  if (!titleInfo) {
    if (pathname.startsWith("/e/orders/edit/")) {
      const orderId = pathname.split("/").pop();
      titleInfo = { bn: `অর্ডার এডিট`, en: `Edit Order`, subBn: `#${orderId}`, subEn: `#${orderId}` };
    } else if (pathname.startsWith("/e/products/edit/")) {
      titleInfo = { bn: "পণ্য এডিট", en: "Edit Product" };
    }
  }

  const title = titleInfo ? t(titleInfo.bn, titleInfo.en) : t("অ্যাডমিন প্যানেল", "Admin Panel");
  const subtitle = titleInfo?.subBn ? t(titleInfo.subBn, titleInfo.subEn || "") : undefined;
  const shortcuts = getShortcutsForPath(pathname).filter((s) => s.to !== pathname);

  return (
    <header className="h-14 flex items-center gap-4 border-b border-border bg-background px-4 sticky top-0 z-20">
      <SidebarTrigger />
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="font-display text-lg font-semibold text-foreground truncate">{title}</h1>
        {(subtitle || count !== undefined) && (
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            {subtitle}{count !== undefined ? ` (${count})` : ""}
          </p>
        )}
        {/* Portal target for page-specific header actions */}
        <div id="admin-header-actions" className="flex items-center" />
      </div>
      {isAdsReport && (
        <div className="ml-auto hidden md:block">
          <DollarRateWidget />
        </div>
      )}
      {shortcuts.length > 0 && (
        <div className={`${isAdsReport ? "" : "ml-auto"} flex items-center gap-1.5`}>
          {shortcuts.map((s) => (
            <button
              key={s.to}
              onClick={() => navigate(s.to)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <s.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(s.labelBn, s.label)}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function AccessDeniedRedirect() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate("/e/my-activity", { replace: true });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [authCheckError, setAuthCheckError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Activate global keyboard shortcuts
  useKeyboardShortcuts();

  // Instant updates for orders & related tables (sound + toast on new order)
  useOrdersRealtime();

  // Save page state (filters, scroll) on route change & restore scroll on mount
  const prevPathRef = useRef<string>("");
  useEffect(() => {
    const currentFull = location.pathname + location.search;
    // Save previous page state before switching
    if (prevPathRef.current && prevPathRef.current !== currentFull) {
      const prevUrl = new URL(prevPathRef.current, window.location.origin);
      savePageState(prevUrl.pathname, prevUrl.search);
    }
    prevPathRef.current = currentFull;
    // Always start new pages at the top — prevents the "page jump/shake"
    // that happened when restoreScroll snapped to a stale saved scrollY.
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  const checkAdmin = useCallback(async () => {
    setChecking(true);
    setAuthCheckError(null);

    const access = await getCurrentAdminAccess();

    if (access.status === "no-session") {
      setAuthorized(false);
      navigate("/admin", { replace: true });
      return;
    }

    if (access.status === "error") {
      console.error("Admin access check failed:", access.message);
      setAuthorized(false);
      setChecking(false);
      setAuthCheckError("সেশন আছে, কিন্তু অ্যাডমিন ভেরিফিকেশন সাময়িকভাবে ব্যর্থ হয়েছে।");
      return;
    }

    if (access.status === "unauthorized") {
      await supabase.auth.signOut();
      navigate("/admin", { replace: true });
      return;
    }

    setIsSuperAdmin(access.isSuperAdmin);
    setUserRole(access.role);
    setUserPermissions(access.permissions);
    setAuthorized(true);
    setChecking(false);
  }, [navigate]);

  const queryClient = useQueryClient();

  useEffect(() => {
    void checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorized(false);
        navigate("/admin", { replace: true });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void checkAdmin();
      }
    });

    // Realtime: re-check access whenever this admin's permissions or role change
    let permChannel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      permChannel = supabase
        .channel(`admin-access-rt-${user.id}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "admin_permissions", filter: `user_id=eq.${user.id}` },
          () => {
            void checkAdmin();
            queryClient.invalidateQueries({ queryKey: ["current-admin-access"] });
          })
        .on("postgres_changes",
          { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
          () => {
            void checkAdmin();
            queryClient.invalidateQueries({ queryKey: ["current-admin-access"] });
          })
        .subscribe();
    })();

    // Fallback: re-check on tab focus (covers realtime drops)
    const onFocus = () => {
      void checkAdmin();
      queryClient.invalidateQueries({ queryKey: ["current-admin-access"] });
    };
    window.addEventListener("focus", onFocus);

    return () => {
      subscription.unsubscribe();
      if (permChannel) supabase.removeChannel(permChannel);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkAdmin, navigate, queryClient]);


  // Route-level permission check
  const isRouteAllowed = () => {
    if (!authorized) return true; // Still loading
    if (isSuperAdmin || userRole === "admin") return true; // Admins see everything

    const currentPath = location.pathname;
    
    // Check exact match first
    const permKey = urlToPermission[currentPath];
    if (permKey) {
      return userPermissions.includes(permKey);
    }

    // Check if it's a sub-route of an allowed path (e.g. /e/orders/edit/123)
    for (const [url, key] of Object.entries(urlToPermission)) {
      if (currentPath.startsWith(url + "/") && userPermissions.includes(key)) {
        return true;
      }
    }

    // Product form routes like /e/products/new or /e/products/edit/:id
    if (currentPath.startsWith("/e/products/")) {
      return userPermissions.includes("product-list");
    }

    // Order edit routes
    if (currentPath.startsWith("/e/orders/edit/")) {
      return userPermissions.includes("orders-list") || userPermissions.includes("orders-web");
    }

    // If route not in the map, DENY for moderators (security-first approach)
    // Only /e/my-activity is implicitly allowed (no permKey needed)
    if (!permKey) {
      if (currentPath === "/e/my-activity") return true;
      return false;
    }

    return false;
  };

  if (checking && !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authCheckError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">অটো লগআউট bug fix করা হয়েছে</h2>
          <p className="mt-2 text-sm text-muted-foreground">{authCheckError}</p>
          <button
            type="button"
            onClick={() => void checkAdmin()}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      </div>
    );
  }

  const routeAllowed = isRouteAllowed();

  return (
    <ThemeProvider>
      <LanguageProvider>
      <CursorProvider>
      <SidebarProvider>
        <CustomCursor />
        <div className="admin-layout min-h-screen flex w-full bg-muted/30">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader />
            <AiCreditWarningBanner />
            <main className="flex-1 overflow-auto p-4 md:p-6">
              <Suspense fallback={<div className="flex items-center justify-center h-full py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
                {routeAllowed ? <Outlet /> : <AccessDeniedRedirect />}
              </Suspense>
            </main>
            
            <PushNotificationPrompt />
            <NewSupportReportAlert />
          </div>
        </div>
      </SidebarProvider>
      </CursorProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
