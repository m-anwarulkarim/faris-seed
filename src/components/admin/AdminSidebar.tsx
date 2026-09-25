import { useLocation, useNavigate } from "react-router-dom";
import { getSavedPath } from "@/lib/adminPageState";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard, BarChart3, TrendingUp, Package, Star, Users,
  ShoppingCart, Plus, Search, ClipboardList, FileText, Trash2,
  Globe, Settings, Palette, Languages, Eye, ChevronDown, MousePointer2, Headphones,
  Tag, Gift, MessageSquare, UserCog, UsersRound,
  Code, FileImage, Bot, Megaphone, Activity, Brain, Inbox, AlertTriangle,
  Smartphone, Truck, ShieldAlert, Home, Store, User, Info, LogOut,
  CreditCard, Sprout, Share2, BadgePercent, FilePlus,
  Pencil, ListOrdered, BookOpen, CalendarClock, ArrowUpDown, Warehouse,
  BellRing, ChevronsLeftRight, Keyboard, Flag, Coins, Link2, ShoppingBag, Image as ImageIcon, LayoutGrid, Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { getCurrentAdminAccess } from "@/lib/adminAccess";
import { useIdleDetection } from "@/hooks/useIdleDetection";
import brandLogo from "@/assets/faris-seed-logo.webp";

const SUPER_ADMIN_EMAILS = ["dev.anwarul@gmail.com", "farisseed@gmail.com"];

// Permission key → sidebar URL mapping
const permissionToUrl: Record<string, string> = {
  "overview": "/admin/overview",
  "sales-report": "/admin/sales-report",
  "top-products": "/admin/top-products",
  
  
  
  "product-list": "/admin/products",
  "search-monitoring": "/admin/search-monitoring",
  "categories": "/admin/categories",
  "product-tags": "/admin/product-tags",
  "offers": "/admin/offers",
  "reviews": "/admin/reviews",
  "orders-create": "/admin/orders/create",
  "orders-search": "/admin/orders/search",
  "orders-web": "/admin/orders/web",
  "orders-pre": "/admin/orders/pre",
  "orders-list": "/admin/orders/list",
  "orders-reports": "/admin/orders/reports",
  "orders-deleted": "/admin/orders/deleted",
  "users-admins": "/admin/users/admins",
  "users-customers": "/admin/users/customers",
  
  
  "website-api": "/admin/website/api",
  "website-pages": "/admin/website/pages",
  "website-media": "/admin/website/media",
  "website-ai": "/admin/website/ai",
  
  
  
  
  "website-facebook-catalog": "/admin/website/facebook-catalog",
  "website-floating-buttons": "/admin/website/floating-buttons",
  
  "settings-theme": "/admin/settings/theme",
  "settings-language": "/admin/settings/language",
  "settings-cursor": "/admin/settings/cursor",
  "settings-menu": "/admin/settings/menu",
  "support-reports": "/admin/support/reports",
};

// Reverse: URL → permission key
const urlToPermission: Record<string, string> = {};
Object.entries(permissionToUrl).forEach(([k, v]) => { urlToPermission[v] = k; });

interface SubItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: number;
  badgeVariant?: "default" | "destructive";
  hideFromParent?: boolean;
  permissionKey?: string;
}

interface MenuItem {
  title: string;
  icon: React.ElementType;
  url?: string;
  subItems?: SubItem[];
  menuKey?: string;
}

function HoverSubmenu({ item, currentPath, navigate }: { item: MenuItem; currentPath: string; navigate: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const hasActive = item.subItems?.some((sub) => currentPath === sub.url);

  const enter = () => {
    clearTimeout(timeout.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPopoverStyle({ position: "fixed", top: rect.top, left: rect.right + 4, zIndex: 9999 });
    }
    setOpen(true);
  };
  const leave = () => { timeout.current = setTimeout(() => setOpen(false), 150); };

  return (
    <SidebarGroup className="p-0" ref={triggerRef} onMouseEnter={enter} onMouseLeave={leave}>
      <SidebarMenuButton
        className={cn(
          "w-full font-medium text-sidebar-foreground hover:bg-sidebar-accent",
          hasActive && "bg-sidebar-accent text-primary"
        )}
      >
        <span className="flex items-center gap-2">
          <item.icon className="w-4 h-4" />
        </span>
      </SidebarMenuButton>

      {open && (
        <div
          className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
          style={popoverStyle}
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
            {item.title}
          </div>
          {item.subItems?.map((sub) => (
            <button
              key={sub.url}
              onClick={() => { navigate(getSavedPath(sub.url)); setOpen(false); }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
                currentPath === sub.url && "bg-accent text-accent-foreground font-medium"
              )}
            >
              <sub.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 text-left">{sub.title}</span>
              {sub.badge ? (
                <Badge variant={sub.badgeVariant || "default"} className="h-4 min-w-[16px] px-1 text-[9px] font-bold leading-none">
                  {sub.badge}
                </Badge>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </SidebarGroup>
  );
}

function CollapsibleMenu({ item, currentPath, navigate, openMenus, onToggleMenu }: { 
  item: MenuItem; currentPath: string; navigate: (url: string) => void;
  openMenus: Set<string>; onToggleMenu: (title: string, open: boolean) => void;
}) {
  const hasActiveChild = item.subItems?.some((sub) => currentPath === sub.url) || false;
  // Keep the group open whenever the user is on one of its sub-routes,
  // so clicking a subitem (or auto-collapse) never hides its siblings.
  const isOpen = hasActiveChild || openMenus.has(item.title);
  const totalBadge = item.subItems?.reduce((sum, sub) => sum + (sub.hideFromParent ? 0 : (sub.badge || 0)), 0) || 0;
  const hasDestructiveBadge = item.subItems?.some(sub => (sub.badge || 0) > 0 && sub.badgeVariant === "destructive") || false;

  return (
    <Collapsible open={isOpen} onOpenChange={(open) => onToggleMenu(item.title, open)} className="group/collapsible">
      <SidebarGroup className="p-0">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="w-full justify-between font-medium text-sidebar-foreground hover:bg-sidebar-accent">
            <span className="flex items-center gap-2">
              <item.icon className="w-4 h-4" />
              <span>{item.title}</span>
              {!isOpen && totalBadge > 0 && (
                <Badge variant={hasDestructiveBadge ? "destructive" : "default"} className="h-4 min-w-[16px] px-1 text-[9px] font-bold leading-none">
                  {totalBadge}
                </Badge>
              )}
            </span>
            <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.subItems?.map((sub) => (
              <SidebarMenuSubItem key={sub.url}>
                <SidebarMenuSubButton asChild isActive={currentPath === sub.url}>
                  <button onClick={() => navigate(getSavedPath(sub.url))} className="flex items-center gap-2 w-full">
                    <sub.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 text-left">{sub.title}</span>
                    {sub.badge ? (
                      <Badge variant={sub.badgeVariant || "default"} className="h-4 min-w-[16px] px-1 text-[9px] font-bold leading-none ml-auto">
                        {sub.badge}
                      </Badge>
                    ) : null}
                  </button>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function AdminSidebar() {
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { t } = useLanguage();

  // Track which menus are open
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => new Set());
  const [autoCollapse, setAutoCollapse] = useState(() => localStorage.getItem("admin_menu_auto_collapse") === "true");

  useEffect(() => {
    const handler = () => setAutoCollapse(localStorage.getItem("admin_menu_auto_collapse") === "true");
    window.addEventListener("admin-menu-auto-collapse-toggle", handler);
    return () => window.removeEventListener("admin-menu-auto-collapse-toggle", handler);
  }, []);

  const onToggleMenu = useCallback((title: string, open: boolean) => {
    setOpenMenus(prev => {
      if (open) {
        if (autoCollapse) {
          return new Set([title]);
        }
        return new Set(prev).add(title);
      } else {
        const next = new Set(prev);
        next.delete(title);
        return next;
      }
    });
  }, [autoCollapse]);

  // Fetch current user's role & permissions
  const { data: userAccess } = useQuery({
    queryKey: ["current-admin-access"],
    queryFn: async () => {
      const access = await getCurrentAdminAccess();
      if (access.status !== "authorized") {
        return { role: null, permissions: [] as string[], email: "", isSuperAdmin: false };
      }

      return {
        role: access.role,
        permissions: access.permissions,
        email: access.email,
        isSuperAdmin: access.isSuperAdmin,
      };
    },
  });

  const isAdmin = userAccess?.role === "admin" || userAccess?.isSuperAdmin;
  const userPermissions = userAccess?.permissions || [];

  // Check if a sub-item is allowed
  const hasPermission = (permKey: string) => {
    if (isAdmin) return true; // Admins see everything
    return userPermissions.includes(permKey);
  };

  const isIdle = useIdleDetection();
  const queryClient = useQueryClient();

  // Realtime: invalidate sidebar counts on order changes
  useEffect(() => {
    const channel = supabase
      .channel("sidebar-counts-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" },
        () => queryClient.invalidateQueries({ queryKey: ["sidebar-counts"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: sidebarCounts } = useQuery({
    queryKey: ["sidebar-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sidebar_counts");
      if (error) throw error;
      return data as { pending: number; confirmed: number; deleted: number; pre_today: number; unread_inbox: number; pending_reports: number };
    },
    refetchInterval: isIdle ? false : 90_000,
  });

  const socialPendingCounts = { posts: 0, comments: 0 };
  const socialReportsPending = 0;
  void socialPendingCounts; void socialReportsPending;

  const unreadInboxCountLive = 0;

  const pendingOrderCount = sidebarCounts?.pending || 0;
  const confirmedOrderCount = sidebarCounts?.confirmed || 0;
  const deletedOrderCount = sidebarCounts?.deleted || 0;
  const preOrderCount = sidebarCounts?.pre_today || 0;
  const unreadInboxCount = unreadInboxCountLive;
  const pendingReportCount = sidebarCounts?.pending_reports || 0;
  const pendingQaCount = (sidebarCounts as any)?.pending_qa || 0;

  const allMenuItems: (MenuItem & { permissionKey?: string })[] = [
    {
      menuKey: "my-activity",
      title: t("মাই একটিভিটি", "My Activity"),
      icon: Activity,
      url: "/admin/my-activity",
      // No permissionKey — always visible for all roles
    },
    {
      menuKey: "dashboard",
      title: t("ড্যাশবোর্ড", "Dashboard"),
      icon: LayoutDashboard,
      subItems: [
        { title: t("ওভারভিউ", "Overview"), url: "/admin/overview", icon: Eye, permissionKey: "overview" },
        { title: t("বিক্রি রিপোর্ট", "Sales Report"), url: "/admin/sales-report", icon: BarChart3, permissionKey: "sales-report" },
        { title: t("শীর্ষ পণ্য", "Top Products"), url: "/admin/top-products", icon: TrendingUp, permissionKey: "top-products" },
        
        
        
        
      ],
    },
    {
      menuKey: "order-search",
      title: t("অর্ডার সার্চ", "Order Search"),
      icon: Search,
      url: "/admin/orders/search",
      permissionKey: "orders-search",
    },
    {
      menuKey: "product",
      title: t("পণ্য", "Product"),
      icon: Package,
      subItems: [
        { title: t("পণ্য তালিকা", "Product List"), url: "/admin/products", icon: ListOrdered, permissionKey: "product-list" },
        { title: t("সার্চ মনিটরিং", "Search Monitoring"), url: "/admin/search-monitoring", icon: Search, permissionKey: "search-monitoring" },
        { title: t("ইনভেন্টরি", "Inventory"), url: "/admin/inventory", icon: Warehouse, permissionKey: "inventory" },
        { title: t("ক্যাটাগরি", "Category"), url: "/admin/categories", icon: BookOpen, permissionKey: "categories" },
        { title: t("প্রোডাক্ট ট্যাগ", "Product Tag"), url: "/admin/product-tags", icon: Tag, permissionKey: "product-tags" },
        { title: t("অফার", "Offers"), url: "/admin/offers", icon: Gift, permissionKey: "offers" },
        { title: t("রিভিউ", "Review"), url: "/admin/reviews", icon: MessageSquare, permissionKey: "reviews" },
        { title: t("জিজ্ঞাসা", "Q&A"), url: "/admin/qa", icon: MessageSquare, badge: pendingQaCount || 0, permissionKey: "reviews" },
      ],
    },
    {
      menuKey: "all-orders",
      title: t("অর্ডারসমূহ", "All Orders"),
      icon: ShoppingCart,
      subItems: [
        { title: t("নতুন তৈরি", "Create New"), url: "/admin/orders/create", icon: Plus, permissionKey: "orders-create" },
        { title: t("অর্ডারসমূহ", "All Orders"), url: "/admin/orders/web", icon: ClipboardList, badge: pendingOrderCount || 0, permissionKey: "orders-web" },
        { title: t("প্রি-অর্ডার", "Pre Orders"), url: "/admin/orders/pre", icon: CalendarClock, badge: preOrderCount || 0, permissionKey: "orders-pre" },
        { title: t("অর্ডার তালিকা", "Order List"), url: "/admin/orders/list", icon: ClipboardList, badge: confirmedOrderCount || 0, permissionKey: "orders-list" },
        { title: t("মুছে ফেলা", "Deleted"), url: "/admin/orders/deleted", icon: Trash2, badge: deletedOrderCount || 0, hideFromParent: true, permissionKey: "orders-deleted" },
      ],
    },
    {
      menuKey: "courier-handle",
      title: t("কুরিয়ার হ্যান্ডেল", "Courier Handle"),
      icon: Truck,
      url: "/admin/courier",
      permissionKey: "courier-handle",
    },
    {
      menuKey: "users",
      title: t("ইউজার", "Users"),
      icon: Users,
      subItems: [
        { title: t("অ্যাডমিন", "Admins"), url: "/admin/users/admins", icon: UserCog, permissionKey: "users-admins" },
        { title: t("কাস্টমার", "Customers"), url: "/admin/users/customers", icon: UsersRound, permissionKey: "users-customers" },
        
        
        
      ],
    },
    {
      menuKey: "website",
      title: t("ওয়েবসাইট", "Website"),
      icon: Globe,
      subItems: [
        { title: "API", url: "/admin/website/api", icon: Code, permissionKey: "website-api" },
        { title: t("পেজ", "Page"), url: "/admin/website/pages", icon: FileText, permissionKey: "website-pages" },
        { title: t("ল্যান্ডিং পেজ", "Landing Pages"), url: "/admin/website/landing-pages", icon: FileText, permissionKey: "website-pages" },
        { title: t("থ্যাংক-ইউ অফার", "Thank-You Offers"), url: "/admin/website/thankyou-offers", icon: ShoppingBag, permissionKey: "website-pages" },
        { title: t("মিডিয়া", "Media"), url: "/admin/website/media", icon: FileImage, permissionKey: "website-media" },
        { title: t("ইমপোর্ট/এক্সপোর্ট", "Import/Export"), url: "/admin/website/import-export", icon: ArrowUpDown, permissionKey: "settings-import-export" },
        
        
        
        
        
        { title: "FB Catalog", url: "/admin/website/facebook-catalog", icon: ShoppingBag, permissionKey: "website-facebook-catalog" },
        { title: t("ভাসমান বাটন", "Floating Buttons"), url: "/admin/website/floating-buttons", icon: MessageSquare, permissionKey: "website-floating-buttons" },
        { title: t("Contact পেজ", "Contact Page"), url: "/admin/website/contact-page", icon: MessageSquare, permissionKey: "website-pages" },
        { title: t("Footer", "Footer"), url: "/admin/website/footer", icon: MessageSquare, permissionKey: "website-pages" },
        { title: t("কাউন্টডাউন টাইমার", "Countdown Timers"), url: "/admin/website/countdown-timers", icon: CalendarClock, permissionKey: "website-pages" },
        { title: t("হিরো ব্যানার", "Hero Banners"), url: "/admin/website/hero-banners", icon: ImageIcon, permissionKey: "website-pages" },
        { title: t("হোম সেকশন", "Home Sections"), url: "/admin/website/home-sections", icon: LayoutGrid, permissionKey: "website-pages" },
        
        
      ],
    },
    {
      menuKey: "settings",
      title: t("সেটিংস", "Settings"),
      icon: Settings,
      subItems: [
        { title: t("থিম", "Theme"), url: "/admin/settings/theme", icon: Palette, permissionKey: "settings-theme" },
        { title: t("ভাষা", "Language"), url: "/admin/settings/language", icon: Languages, permissionKey: "settings-language" },
        { title: t("কার্সর ইফেক্ট", "Cursor Effect"), url: "/admin/settings/cursor", icon: MousePointer2, permissionKey: "settings-cursor" },
        { title: t("মেনু কন্ট্রোল", "Menu Control"), url: "/admin/settings/menu", icon: ChevronsLeftRight, permissionKey: "settings-menu" },
        
        { title: t("ডেলিভারি চার্জ", "Delivery Charges"), url: "/admin/settings/delivery-tiers", icon: Truck, permissionKey: "settings-theme" },
        { title: t("অর্ডার কুলডাউন", "Order Cooldown"), url: "/admin/settings/order-cooldown", icon: Clock, permissionKey: "settings-theme" },
        
        
      ],
    },
    {
      menuKey: "notification",
      title: t("নোটিফিকেশন", "Notification"),
      icon: BellRing,
      url: "/admin/notifications/orders",
      permissionKey: "notifications-orders",
    },
  ];

  // Menu order from localStorage
  const [menuOrderVersion, setMenuOrderVersion] = useState(0);
  useEffect(() => {
    const handler = () => setMenuOrderVersion(v => v + 1);
    window.addEventListener("admin-menu-order-changed", handler);
    return () => window.removeEventListener("admin-menu-order-changed", handler);
  }, []);

  const savedOrder: string[] = (() => {
    try {
      const saved = localStorage.getItem("admin_menu_order");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  })();

  // Filter menu items by permissions (admins see all, moderators see only permitted)
  let menuItems = allMenuItems.map((group) => {
    // Top-level item with permissionKey: check permission
    if (!group.subItems && group.permissionKey && !hasPermission(group.permissionKey)) return null;
    if (!group.subItems) return group;
    const filteredSubs = group.subItems.filter((sub) =>
      hasPermission(sub.permissionKey || "")
    );
    if (filteredSubs.length === 0) return null;
    return { ...group, subItems: filteredSubs };
  }).filter(Boolean) as MenuItem[];

  // Sort by saved order if available
  if (savedOrder) {
    menuItems = [...menuItems].sort((a, b) => {
      const ai = savedOrder.indexOf(a.menuKey || "");
      const bi = savedOrder.indexOf(b.menuKey || "");
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  // Initialize open menus with active route's parent on first render
  const initializedRef = useRef(false);
  if (!initializedRef.current && menuItems.length > 0) {
    initializedRef.current = true;
    const activeParent = menuItems.find(m => m.subItems?.some(sub => currentPath === sub.url));
    if (activeParent && !openMenus.has(activeParent.title)) {
      setOpenMenus(new Set([activeParent.title]));
    }
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <button
          type="button"
          onClick={() => window.location.reload()}
          title={t("রিফ্রেশ করুন", "Refresh")}
          className="flex items-center gap-3 w-full text-left rounded-lg hover:bg-sidebar-accent transition-colors p-1 -m-1 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-white flex items-center justify-center shrink-0">
            <img src={brandLogo} alt="Faris Seed" className="w-full h-full object-contain" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="font-display text-sm font-bold text-sidebar-foreground">Faris Seed</h2>
            <p className="text-xs text-muted-foreground">{t("প্রফেশনাল ড্যাশবোর্ড", "Professional Dashboard")}</p>
          </div>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2 overflow-y-auto overscroll-contain">
        {menuItems.map((item) => 
          item.url && !item.subItems ? (
            <SidebarGroup key={item.title} className="p-0">
              <SidebarMenuButton
                className={cn(
                  "w-full font-medium text-sidebar-foreground hover:bg-sidebar-accent",
                  currentPath === item.url && "bg-sidebar-accent text-primary"
                )}
                onClick={() => navigate(getSavedPath(item.url!))}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                </span>
              </SidebarMenuButton>
            </SidebarGroup>
          ) : isCollapsed ? (
            <HoverSubmenu
              key={item.title}
              item={item}
              currentPath={currentPath}
              navigate={navigate}
            />
          ) : (
          <CollapsibleMenu
            key={item.title}
            item={item}
            currentPath={currentPath}
            navigate={navigate}
            openMenus={openMenus}
            onToggleMenu={onToggleMenu}
          />
          )
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarMenuButton
            className="flex-1 justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground hover:bg-sidebar-accent hover:border-primary/40 transition-colors"
            onClick={() => window.open("/", "_blank")}
            tooltip={t("ওয়েবসাইট দেখুন", "Visit Website")}
          >
            <Eye className="w-4 h-4" />
            <span className="group-data-[collapsible=icon]:hidden font-medium">{t("ওয়েবসাইট", "Website")}</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            className="flex-1 justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 hover:border-destructive/60 transition-colors"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/admin");
            }}
            tooltip={t("লগআউট", "Logout")}
          >
            <LogOut className="w-4 h-4" />
            <span className="group-data-[collapsible=icon]:hidden font-medium">{t("লগআউট", "Logout")}</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
