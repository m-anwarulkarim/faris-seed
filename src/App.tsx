import { useEffect, Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { installGlobalErrorHandlers } from "@/lib/errorLogger";
import { useSessionGuard } from "./hooks/useSessionGuard";
import { useActivityHeartbeat } from "./hooks/useActivityHeartbeat";
import TrackingScripts from "@/components/TrackingScripts";
import TikTokPixel from "@/components/TikTokPixel";

function PageEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/e/page-builder/edit/${id}`} replace />;
}

// Public pages
const PublicHome = lazy(() => import("./pages/public/Home.tsx"));
const PublicAbout = lazy(() => import("./pages/public/About.tsx"));
const PublicContact = lazy(() => import("./pages/public/Contact.tsx"));
const PublicCart = lazy(() => import("./pages/public/Cart.tsx"));
const PublicCheckout = lazy(() => import("./pages/public/Checkout.tsx"));
const PublicThankYou = lazy(() => import("./pages/public/ThankYou.tsx"));
const PublicAuth = lazy(() => import("./pages/public/Auth.tsx"));
const PublicAccount = lazy(() => import("./pages/public/Account.tsx"));
const PublicProduct = lazy(() => import("./pages/public/ProductLanding.tsx"));

// Admin pages

const AdminLayout = lazy(() => import("./components/admin/AdminLayout.tsx").then(m => ({ default: m.AdminLayout })));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.tsx"));
const Overview = lazy(() => import("./pages/admin/Overview.tsx"));
const MyActivity = lazy(() => import("./pages/admin/MyActivity.tsx"));
const ProductList = lazy(() => import("./pages/admin/ProductList.tsx"));
const SearchMonitoring = lazy(() => import("./pages/admin/SearchMonitoring.tsx"));
const ProductForm = lazy(() => import("./pages/admin/ProductForm.tsx"));
const TagList = lazy(() => import("./pages/admin/TagList.tsx"));
const CategoryList = lazy(() => import("./pages/admin/CategoryList.tsx"));
const WebOrders = lazy(() => import("./pages/admin/WebOrders.tsx"));
const OrderList = lazy(() => import("./pages/admin/OrderList.tsx"));
const OrderSearch = lazy(() => import("./pages/admin/OrderSearch.tsx"));
const CustomerList = lazy(() => import("./pages/admin/CustomerList.tsx"));
const ThemeSettings = lazy(() => import("./pages/admin/ThemeSettings.tsx"));
const LanguageSettings = lazy(() => import("./pages/admin/LanguageSettings.tsx"));
const CursorSettings = lazy(() => import("./pages/admin/CursorSettings.tsx"));
const MenuControl = lazy(() => import("./pages/admin/MenuControl.tsx"));
const PagesManagement = lazy(() => import("./pages/admin/PagesManagement.tsx"));
const PageEditor = lazy(() => import("./pages/admin/PageEditor.tsx"));
const MediaManagement = lazy(() => import("./pages/admin/MediaManagement.tsx"));
const PreOrders = lazy(() => import("./pages/admin/PreOrders.tsx"));
const ApiManagement = lazy(() => import("./pages/admin/ApiManagement.tsx"));
const BkashLogs = lazy(() => import("./pages/admin/BkashLogs.tsx"));
const OrderEdit = lazy(() => import("./pages/admin/OrderEdit.tsx"));
const AdminList = lazy(() => import("./pages/admin/AdminList.tsx"));
const DeletedOrders = lazy(() => import("./pages/admin/DeletedOrders.tsx"));
const ImportExport = lazy(() => import("./pages/admin/ImportExport.tsx"));
const InventoryManagement = lazy(() => import("./pages/admin/InventoryManagement.tsx"));
const CouponManagement = lazy(() => import("./pages/admin/CouponManagement.tsx"));
const NotificationCenter = lazy(() => import("./pages/admin/NotificationCenter.tsx"));
const TopProducts = lazy(() => import("./pages/admin/TopProducts.tsx"));
const SalesReport = lazy(() => import("./pages/admin/SalesReport.tsx"));
const FacebookCatalog = lazy(() => import("./pages/admin/FacebookCatalog.tsx"));
const FloatingButtons = lazy(() => import("./pages/admin/FloatingButtons.tsx"));
const ContactPageEditor = lazy(() => import("./pages/admin/ContactPageEditor.tsx"));
const FooterEditor = lazy(() => import("./pages/admin/FooterEditor.tsx"));
const DeliveryTiers = lazy(() => import("./pages/admin/DeliveryTiers.tsx"));
const OrderCooldown = lazy(() => import("./pages/admin/OrderCooldown.tsx"));
const CountdownTimers = lazy(() => import("./pages/admin/CountdownTimers.tsx"));
const HeroBanners = lazy(() => import("./pages/admin/HeroBanners.tsx"));
const LandingPageEditor = lazy(() => import("./pages/admin/LandingPageEditor.tsx"));
const ThankYouOffers = lazy(() => import("./pages/admin/ThankYouOffers.tsx"));
const HomeSectionsManagement = lazy(() => import("./pages/admin/HomeSectionsManagement.tsx"));
const ReviewManagement = lazy(() => import("./pages/admin/ReviewManagement.tsx"));
const ProductQAManagement = lazy(() => import("./pages/admin/ProductQAManagement.tsx"));
const ReviewQASettings = lazy(() => import("./pages/admin/ReviewQASettings.tsx"));
const PushBroadcast = lazy(() => import("./pages/admin/PushBroadcast.tsx"));
const CourierHandle = lazy(() => import("./pages/admin/CourierHandle.tsx"));
const BotActivity = lazy(() => import("./pages/admin/BotActivity.tsx"));
const ConfirmedOrders = lazy(() => import("./pages/admin/ConfirmedOrders.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

if (typeof window !== "undefined") {
  (window as any).__queryClient = queryClient;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );
}

function ActivityHeartbeatWrapper() {
  useActivityHeartbeat();
  return null;
}

function SessionGuardWrapper() {
  useSessionGuard();
  return null;
}

function OAuthCallbackListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && window.location.pathname === "/auth") {
        navigate("/account", { replace: true });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return null;
}

const App = () => {
  useEffect(() => {
    installGlobalErrorHandlers();
    if (!window.location.pathname.startsWith("/admin")) {
      import("@/lib/visitorTracking")
        .then((m) => m.ensureVisitorTracked())
        .catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider manageDocument={false}>
          <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <TrackingScripts />
                <TikTokPixel />
                <ActivityHeartbeatWrapper />
                <SessionGuardWrapper />
                <OAuthCallbackListener />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public site */}
                    <Route path="/" element={<PublicHome />} />
                    <Route path="/about" element={<PublicAbout />} />
                    <Route path="/contact" element={<PublicContact />} />
                    <Route path="/cart" element={<PublicCart />} />
                    <Route path="/checkout" element={<PublicCheckout />} />
                    <Route path="/thank-you" element={<PublicThankYou />} />
                    <Route path="/product/:slug" element={<PublicProduct />} />
                    <Route path="/auth" element={<PublicAuth />} />
                    <Route path="/login" element={<Navigate to="/auth" replace />} />
                    <Route path="/account" element={<PublicAccount />} />

                    {/* Legacy /e and /ecomah redirects to /admin */}
                    <Route path="/ecomah" element={<Navigate to="/admin/login" replace />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/e/*" element={<Navigate to="/admin/my-activity" replace />} />

                    {/* Admin Panel */}
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<Navigate to="/admin/my-activity" replace />} />
                      <Route path="my-activity" element={<MyActivity />} />
                      <Route path="overview" element={<Overview />} />
                      <Route path="sales-report" element={<SalesReport />} />
                      <Route path="top-products" element={<TopProducts />} />
                      <Route path="bot-activity" element={<BotActivity />} />

                      {/* Products */}
                      <Route path="products" element={<ProductList />} />
                      <Route path="products/create" element={<ProductForm />} />
                      <Route path="products/new" element={<ProductForm />} />
                      <Route path="products/edit/:id" element={<ProductForm />} />
                      <Route path="search-monitoring" element={<SearchMonitoring />} />
                      <Route path="inventory" element={<InventoryManagement />} />
                      <Route path="categories" element={<CategoryList />} />
                      <Route path="product-tags" element={<TagList />} />
                      <Route path="offers" element={<CouponManagement />} />
                      <Route path="reviews" element={<ReviewManagement />} />
                      <Route path="qa" element={<ProductQAManagement />} />
                      <Route path="review-qa-settings" element={<ReviewQASettings />} />

                      {/* Orders */}
                      <Route path="orders/create" element={<OrderEdit />} />
                      <Route path="orders/edit/:id" element={<OrderEdit />} />
                      <Route path="orders/search" element={<OrderSearch />} />
                      <Route path="orders/web" element={<WebOrders />} />
                      <Route path="orders/confirmed" element={<ConfirmedOrders />} />
                      <Route path="orders/pre" element={<PreOrders />} />
                      <Route path="orders/list" element={<OrderList />} />
                      <Route path="orders/deleted" element={<DeletedOrders />} />

                      {/* Users */}
                      <Route path="users/admins" element={<AdminList />} />
                      <Route path="users/customers" element={<CustomerList />} />

                      {/* Website */}
                      <Route path="website/api" element={<ApiManagement />} />
                      <Route path="payments/bkash-logs" element={<BkashLogs />} />
                      <Route path="website/pages" element={<PagesManagement />} />
                      <Route path="website/pages/new" element={<Navigate to="/admin/page-builder/new" replace />} />
                      <Route path="website/pages/edit/:id" element={<PageEditRedirect />} />
                      <Route path="website/media" element={<MediaManagement />} />
                      <Route path="website/import-export" element={<ImportExport />} />
                      <Route path="website/facebook-catalog" element={<FacebookCatalog />} />
                      <Route path="website/floating-buttons" element={<FloatingButtons />} />
                      <Route path="website/contact-page" element={<ContactPageEditor />} />
                      <Route path="website/footer" element={<FooterEditor />} />
                      <Route path="settings/delivery-tiers" element={<DeliveryTiers />} />
                      <Route path="settings/order-cooldown" element={<OrderCooldown />} />
                      <Route path="website/countdown-timers" element={<CountdownTimers />} />
                      <Route path="website/hero-banners" element={<HeroBanners />} />
                      <Route path="website/landing-pages" element={<LandingPageEditor />} />
                      <Route path="website/thankyou-offers" element={<ThankYouOffers />} />
                      <Route path="website/home-sections" element={<HomeSectionsManagement />} />

                      {/* Settings */}
                      <Route path="settings/theme" element={<ThemeSettings />} />
                      <Route path="settings/language" element={<LanguageSettings />} />
                      <Route path="settings/cursor" element={<CursorSettings />} />
                      <Route path="settings/menu" element={<MenuControl />} />

                      {/* Notifications */}
                      <Route path="notifications/orders" element={<NotificationCenter />} />
                      <Route path="notifications/sms" element={<NotificationCenter />} />
                      <Route path="notifications/push" element={<PushBroadcast />} />

                      {/* Courier */}
                      <Route path="courier" element={<CourierHandle />} />

                      <Route path="settings/import-export" element={<ImportExport />} />
                    </Route>

                    {/* Page Builder - full screen */}
                    <Route path="/admin/page-builder/new" element={<PageEditor />} />
                    <Route path="/admin/page-builder/edit/:id" element={<PageEditor />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
