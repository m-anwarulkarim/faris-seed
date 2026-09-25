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

const SUPER_ADMIN_EMAILS = ["dev.anwarul@gmail.com", "farisseed@gmail.com"];
const WEB_ORDER_SOURCE_FILTER = "traffic_source.is.null,traffic_source.neq.ecomdrive";

// URL → permission key mapping (must match AdminSidebar)
const urlToPermission: Record<string, string> = {
  "/admin/overview": "overview",
  "/admin/sales-report": "sales-report",
  "/admin/top-products": "top-products",
  
  
  
  "/admin/products": "product-list",
  "/admin/inventory": "inventory",
  "/admin/categories": "categories",
  "/admin/product-tags": "product-tags",
  "/admin/offers": "offers",
  "/admin/reviews": "reviews",
  "/admin/qa": "reviews",
  "/admin/review-qa-settings": "reviews",
  "/admin/orders/create": "orders-create",
  "/admin/orders/search": "orders-search",
  "/admin/orders/web": "orders-web",
  "/admin/orders/pre": "orders-pre",
  "/admin/orders/list": "orders-list",
  "/admin/orders/reports": "orders-reports",
  "/admin/orders/deleted": "orders-deleted",
  "/admin/users/admins": "users-admins",
  "/admin/users/customers": "users-customers",
  "/admin/website/api": "website-api",
  "/admin/website/pages": "website-pages",
  "/admin/website/media": "website-media",
  "/admin/website/import-export": "settings-import-export",
  
  
  
  
  
  "/admin/courier": "courier-handle",
  "/admin/message-monitor": "support-inbox",
  "/admin/settings/theme": "settings-theme",
  "/admin/settings/language": "settings-language",
  "/admin/settings/cursor": "settings-cursor",
  "/admin/settings/menu": "settings-menu",
  "/admin/support/reports": "support-reports",
  "/admin/notifications/orders": "notifications-orders",
  "/admin/notifications/sms": "notifications-sms",
  "/admin/notifications/push": "notifications-push",
};

// Route → page title/subtitle mapping
const routeTitles: Record<string, { bn: string; en: string; subBn?: string; subEn?: string }> = {
  "/admin/overview": { bn: "ওভারভিউ", en: "Overview", subBn: "আপনার ব্যবসার সারসংক্ষেপ", subEn: "Your business summary" },
  "/admin/my-activity": { bn: "আমার অ্যাক্টিভিটি", en: "My Activity" },
  "/admin/sales-report": { bn: "বিক্রি রিপোর্ট", en: "Sales Report" },
  "/admin/top-products": { bn: "টপ প্রোডাক্ট", en: "Top Products" },
  
  
  
  "/admin/products": { bn: "পণ্য তালিকা", en: "Product List", subBn: "সকল পণ্য পরিচালনা করুন", subEn: "Manage all products" },
  "/admin/products/new": { bn: "নতুন পণ্য", en: "New Product" },
  "/admin/inventory": { bn: "ইনভেন্টরি ম্যানেজমেন্ট", en: "Inventory Management" },
  "/admin/categories": { bn: "ক্যাটাগরি", en: "Categories" },
  "/admin/product-tags": { bn: "প্রোডাক্ট ট্যাগ", en: "Product Tags" },
  "/admin/orders/create": { bn: "নতুন অর্ডার", en: "Create Order" },
  "/admin/orders/search": { bn: "অর্ডার সার্চ", en: "Order Search" },
  "/admin/orders/web": { bn: "অর্ডারসমূহ", en: "All Orders" },
  "/admin/courier": { bn: "কুরিয়ার হ্যান্ডেল", en: "Courier Handle" },
  "/admin/orders/pre": { bn: "প্রি-অর্ডার", en: "Pre Orders", subBn: "প্রি-অর্ডার স্ট্যাটাসের সকল অর্ডার", subEn: "All orders with pre status" },
  "/admin/orders/list": { bn: "অর্ডার তালিকা", en: "Order List" },
  "/admin/orders/deleted": { bn: "মুছে ফেলা অর্ডার", en: "Deleted Orders" },
  "/admin/users/admins": { bn: "অ্যাডমিন তালিকা", en: "Admin List" },
  "/admin/users/customers": { bn: "কাস্টমার তালিকা", en: "Customer List" },
  "/admin/website/api": { bn: "API ম্যানেজমেন্ট", en: "API Management" },
  "/admin/website/pages": { bn: "পেজ ব্যবস্থাপনা", en: "Page Management" },
  "/admin/website/media": { bn: "মিডিয়া", en: "Media Management" },
  "/admin/website/import-export": { bn: "ইমপোর্ট / এক্সপোর্ট", en: "Import / Export" },
  
  
  
  "/admin/settings/theme": { bn: "থিম সেটিংস", en: "Theme Settings" },
  "/admin/settings/language": { bn: "ভাষা সেটিংস", en: "Language Settings" },
  "/admin/settings/cursor": { bn: "কার্সর সেটিংস", en: "Cursor Settings" },
  "/admin/settings/menu": { bn: "মেনু কন্ট্রোল", en: "Menu Control" },
  "/admin/support/reports": { bn: "সাপোর্ট রিপোর্ট", en: "Support Reports" },
  "/admin/notifications/orders": { bn: "অর্ডার নোটিফিকেশন", en: "Order Notifications" },
  "/admin/notifications/sms": { bn: "SMS লগ", en: "SMS Logs" },
  "/admin/notifications/push": { bn: "পুশ ব্রডকাস্ট", en: "Push Broadcast", subBn: "ফিল্টার করে কাস্টমারদের পুশ নোটিফিকেশন পাঠান", subEn: "Send push notifications to filtered customers" },
  "/admin/coupons": { bn: "কুপন ম্যানেজমেন্ট", en: "Coupon Management" },
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
    enabled: pathname === "/admin/orders/pre",
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
    enabled: pathname === "/admin/orders/web",
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

  if (pathname === "/admin/orders/pre") return preOrderCount;
  if (pathname === "/admin/orders/web") return webOrderCount;
  return undefined;
}

// Section shortcut definitions
type Shortcut = { icon: React.ElementType; label: string; labelBn: string; to: string };

const sectionShortcuts: Record<string, Shortcut[]> = {
  orders: [
    { icon: Plus, label: "Create", labelBn: "নতুন", to: "/admin/orders/create" },
    { icon: Search, label: "Search", labelBn: "সার্চ", to: "/admin/orders/search" },
    { icon: Globe, label: "Web", labelBn: "ওয়েব", to: "/admin/orders/web" },
    { icon: CalendarClock, label: "Pre", labelBn: "প্রি", to: "/admin/orders/pre" },
    { icon: List, label: "List", labelBn: "লিস্ট", to: "/admin/orders/list" },
  ],
  products: [
    { icon: Plus, label: "New", labelBn: "নতুন", to: "/admin/products/new" },
    { icon: Package, label: "Products", labelBn: "পণ্য", to: "/admin/products" },
    { icon: Layers, label: "Inventory", labelBn: "ইনভেন্টরি", to: "/admin/inventory" },
    { icon: List, label: "Categories", labelBn: "ক্যাটাগরি", to: "/admin/categories" },
    { icon: Tag, label: "Tags", labelBn: "ট্যাগ", to: "/admin/product-tags" },
  ],
  reports: [
    { icon: BarChart3, label: "Sales", labelBn: "বিক্রি", to: "/admin/sales-report" },
    { icon: Package, label: "Top Products", labelBn: "টপ পণ্য", to: "/admin/top-products" },
    
    
  ],
  users: [
    { icon: ShieldCheck, label: "Admins", labelBn: "অ্যাডমিন", to: "/admin/users/admins" },
    { icon: Users, label: "Customers", labelBn: "কাস্টমার", to: "/admin/users/customers" },
  ],
  website: [
    { icon: Settings, label: "API", labelBn: "API", to: "/admin/website/api" },
    { icon: FileText, label: "Pages", labelBn: "পেজ", to: "/admin/website/pages" },
    { icon: Image, label: "Media", labelBn: "মিডিয়া", to: "/admin/website/media" },
    { icon: ArrowDownUp, label: "Import/Export", labelBn: "ইমপোর্ট", to: "/admin/website/import-export" },
    
    
    
  ],
  settings: [
    { icon: Palette, label: "Theme", labelBn: "থিম", to: "/admin/settings/theme" },
    { icon: Languages, label: "Language", labelBn: "ভাষা", to: "/admin/settings/language" },
    { icon: MousePointer2, label: "Cursor", labelBn: "কার্সর", to: "/admin/settings/cursor" },
    { icon: ChevronsLeftRight, label: "Menu Control", labelBn: "মেনু কন্ট্রোল", to: "/admin/settings/menu" },
    
  ],
  support: [
    { icon: MessageCircle, label: "Reports", labelBn: "রিপোর্ট", to: "/admin/support/reports" },
  ],
  notifications: [
    { icon: Bell, label: "Orders", labelBn: "অর্ডার", to: "/admin/notifications/orders" },
    { icon: MessageSquare, label: "SMS", labelBn: "SMS", to: "/admin/notifications/sms" },
    { icon: Bell, label: "Push", labelBn: "পুশ", to: "/admin/notifications/push" },
  ],
  myActivity: [
    { icon: Search, label: "Search", labelBn: "সার্চ", to: "/admin/orders/search" },
    { icon: Plus, label: "Add Order", labelBn: "নতুন অর্ডার", to: "/admin/orders/create" },
    { icon: Globe, label: "All Orders", labelBn: "অর্ডারসমূহ", to: "/admin/orders/web" },
  ],
};

// Map routes to their section
function getShortcutsForPath(pathname: string): Shortcut[] {
  if (pathname === "/admin/courier") return sectionShortcuts.orders;
  if (pathname.startsWith("/admin/orders/")) return sectionShortcuts.orders;
  if (pathname.startsWith("/admin/products") || pathname === "/admin/inventory" || pathname === "/admin/categories" || pathname === "/admin/product-tags") return sectionShortcuts.products;
  if (["/admin/sales-report", "/admin/top-products"].includes(pathname)) return sectionShortcuts.reports;
  if (pathname.startsWith("/admin/users/")) return sectionShortcuts.users;
  if (pathname.startsWith("/admin/website/")) return sectionShortcuts.website;
  if (pathname.startsWith("/admin/settings/")) return sectionShortcuts.settings;
  if (pathname.startsWith("/admin/support/")) return sectionShortcuts.support;
  if (pathname.startsWith("/admin/notifications/")) return sectionShortcuts.notifications;
  if (pathname === "/admin/my-activity") return sectionShortcuts.myActivity;
  if (pathname === "/admin/overview") return sectionShortcuts.myActivity;
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
    if (pathname.startsWith("/admin/orders/edit/")) {
      const orderId = pathname.split("/").pop();
      titleInfo = { bn: `অর্ডার এডিট`, en: `Edit Order`, subBn: `#${orderId}`, subEn: `#${orderId}` };
    } else if (pathname.startsWith("/admin/products/edit/")) {
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
    navigate("/admin/my-activity", { replace: true });
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

    try {
      // 8-second timeout safety guard to prevent infinite spinning loader
      const accessPromise = getCurrentAdminAccess();
      const timeoutPromise = new Promise<import("@/lib/adminAccess").AdminAccessResult>((resolve) =>
        setTimeout(() => resolve({ status: "error", message: "অ্যাডমিন ভেরিফিকেশন টাইমাউট হয়েছে (নেটওয়ার্ক বিলম্ব)।" }), 8000)
      );

      const access = await Promise.race([accessPromise, timeoutPromise]);

      if (access.status === "no-session") {
        setAuthorized(false);
        setChecking(false);
        navigate("/admin/login", { replace: true });
        return;
      }

      if (access.status === "error") {
        console.error("Admin access check failed:", access.message);
        setAuthorized(false);
        setChecking(false);
        setAuthCheckError(access.message || "সেশন আছে, কিন্তু অ্যাডমিন ভেরিফিকেশন সাময়িকভাবে ব্যর্থ হয়েছে।");
        return;
      }

      if (access.status === "unauthorized") {
        await supabase.auth.signOut();
        setAuthorized(false);
        setChecking(false);
        navigate("/admin/login", { replace: true });
        return;
      }

      setIsSuperAdmin(access.isSuperAdmin);
      setUserRole(access.role);
      setUserPermissions(access.permissions);
      setAuthorized(true);
      setChecking(false);
    } catch (err: any) {
      console.error("Unexpected error during checkAdmin:", err);
      setAuthorized(false);
      setChecking(false);
      setAuthCheckError(err?.message || "অ্যাডমিন অ্যাক্সেস ভেরিফিকেশন ব্যর্থ হয়েছে।");
    } finally {
      setChecking(false);
    }
  }, [navigate]);

  const queryClient = useQueryClient();

  useEffect(() => {
    void checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorized(false);
        navigate("/admin/login", { replace: true });
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

    // Check if it's a sub-route of an allowed path (e.g. /admin/orders/edit/123)
    for (const [url, key] of Object.entries(urlToPermission)) {
      if (currentPath.startsWith(url + "/") && userPermissions.includes(key)) {
        return true;
      }
    }

    // Product form routes like /admin/products/new or /admin/products/edit/:id
    if (currentPath.startsWith("/admin/products/")) {
      return userPermissions.includes("product-list");
    }

    // Order edit routes
    if (currentPath.startsWith("/admin/orders/edit/")) {
      return userPermissions.includes("orders-list") || userPermissions.includes("orders-web");
    }

    // If route not in the map, DENY for moderators (security-first approach)
    // Only /admin/my-activity is implicitly allowed (no permKey needed)
    if (!permKey) {
      if (currentPath === "/admin/my-activity") return true;
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
        <div className="max-w-md rounded-2xl border bg-background p-6 text-center shadow-sm space-y-3">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">অ্যাডমিন অ্যাক্সেস ভেরিফিকেশন</h2>
          <p className="text-sm text-muted-foreground">{authCheckError}</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => void checkAdmin()}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              আবার চেষ্টা করুন
            </button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/admin", { replace: true });
              }}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              পুনরায় অ্যাডমিন লগইন
            </button>
          </div>
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
