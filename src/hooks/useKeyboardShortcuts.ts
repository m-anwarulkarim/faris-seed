import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export interface KeyboardShortcutEntry {
  id: string;
  keys: string; // e.g. "ctrl+shift+o"
  label: string; // display label e.g. "Ctrl + Shift + O"
  targetUrl: string;
  targetLabel: string;
}

const STORAGE_KEY = "admin_keyboard_shortcuts";
const NAV_HISTORY_KEY = "admin_nav_zy_enabled";
const MAX_HISTORY = 50;

// Navigation history state (module-level singleton)
let navHistory: string[] = [];
let navIndex = -1;
let isNavJumping = false;

export function getShortcuts(): KeyboardShortcutEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShortcuts(shortcuts: KeyboardShortcutEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
  window.dispatchEvent(new Event("admin-shortcuts-changed"));
}

export function isNavZYEnabled(): boolean {
  return localStorage.getItem(NAV_HISTORY_KEY) !== "false";
}

export function setNavZYEnabled(enabled: boolean) {
  localStorage.setItem(NAV_HISTORY_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event("admin-shortcuts-changed"));
}

export function normalizeKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  const key = e.key.toLowerCase();
  if (!["control", "alt", "shift", "meta"].includes(key)) {
    parts.push(key);
  }
  return parts.join("+");
}

export function formatKeyCombo(combo: string): string {
  return combo
    .split("+")
    .map((k) => {
      if (k === "ctrl") return "Ctrl";
      if (k === "alt") return "Alt";
      if (k === "shift") return "Shift";
      if (k === "arrowup") return "↑";
      if (k === "arrowdown") return "↓";
      if (k === "arrowleft") return "←";
      if (k === "arrowright") return "→";
      if (k === "escape") return "Esc";
      if (k === "enter") return "Enter";
      if (k === "backspace") return "Backspace";
      if (k === "delete") return "Delete";
      if (k === "tab") return "Tab";
      if (k === " ") return "Space";
      return k.toUpperCase();
    })
    .join(" + ");
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const prevPathRef = useRef<string>("");

  // Track navigation history
  useEffect(() => {
    if (!location.pathname.startsWith("/e")) return;

    if (isNavJumping) {
      isNavJumping = false;
      return;
    }

    const currentPath = location.pathname + location.search;
    // Don't add duplicates
    if (navHistory[navIndex] === currentPath) return;

    // Truncate forward history when navigating normally
    navHistory = navHistory.slice(0, navIndex + 1);
    navHistory.push(currentPath);
    if (navHistory.length > MAX_HISTORY) {
      navHistory = navHistory.slice(navHistory.length - MAX_HISTORY);
    }
    navIndex = navHistory.length - 1;
    prevPathRef.current = currentPath;
  }, [location.pathname, location.search]);

  const goBack = useCallback(() => {
    if (navIndex > 0) {
      navIndex--;
      isNavJumping = true;
      navigate(navHistory[navIndex]);
    }
  }, [navigate]);

  const goForward = useCallback(() => {
    if (navIndex < navHistory.length - 1) {
      navIndex++;
      isNavJumping = true;
      navigate(navHistory[navIndex]);
    }
  }, [navigate]);

  useEffect(() => {
    // Only activate on admin routes
    if (!location.pathname.startsWith("/e")) return;

    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      const combo = normalizeKeyCombo(e);
      if (!combo || combo === "ctrl" || combo === "alt" || combo === "shift") return;

      // Ctrl+Z = go back, Ctrl+Y = go forward
      if (isNavZYEnabled()) {
        if (combo === "ctrl+z") {
          e.preventDefault();
          e.stopPropagation();
          goBack();
          return;
        }
        if (combo === "ctrl+y") {
          e.preventDefault();
          e.stopPropagation();
          goForward();
          return;
        }
      }

      const shortcuts = getShortcuts();
      const match = shortcuts.find((s) => s.keys === combo);
      if (match) {
        e.preventDefault();
        e.stopPropagation();
        navigate(match.targetUrl);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, location.pathname, goBack, goForward]);
}

// All navigable admin menu targets (for the dropdown)
export const ADMIN_MENU_TARGETS: { label: string; labelBn: string; url: string; group?: string }[] = [
  // My Activity
  { label: "My Activity", labelBn: "মাই একটিভিটি", url: "/e/my-activity" },
  // Dashboard
  { label: "Overview", labelBn: "ওভারভিউ", url: "/e/overview", group: "Dashboard" },
  { label: "Sales Report", labelBn: "বিক্রি রিপোর্ট", url: "/e/sales-report", group: "Dashboard" },
  { label: "Top Products", labelBn: "শীর্ষ পণ্য", url: "/e/top-products", group: "Dashboard" },
  
  
  
  // Customer Support
  
  { label: "Reports", labelBn: "অভিযোগ", url: "/e/support/reports", group: "Customer Support" },
  { label: "Message Monitor", labelBn: "মেসেজ মনিটর", url: "/e/message-monitor", group: "Customer Support" },
  // Orders
  { label: "Order Search", labelBn: "অর্ডার সার্চ", url: "/e/orders/search" },
  { label: "Create Order", labelBn: "নতুন অর্ডার", url: "/e/orders/create", group: "Orders" },
  { label: "All Orders", labelBn: "অর্ডারসমূহ", url: "/e/orders/web", group: "Orders" },
  { label: "Pre Orders", labelBn: "প্রি-অর্ডার", url: "/e/orders/pre", group: "Orders" },
  { label: "Order List", labelBn: "অর্ডার তালিকা", url: "/e/orders/list", group: "Orders" },
  { label: "Deleted Orders", labelBn: "মুছে ফেলা", url: "/e/orders/deleted", group: "Orders" },
  // Product
  { label: "Product List", labelBn: "পণ্য তালিকা", url: "/e/products", group: "Product" },
  { label: "Inventory", labelBn: "ইনভেন্টরি", url: "/e/inventory", group: "Product" },
  { label: "Categories", labelBn: "ক্যাটাগরি", url: "/e/categories", group: "Product" },
  { label: "Product Tags", labelBn: "প্রোডাক্ট ট্যাগ", url: "/e/product-tags", group: "Product" },
  { label: "Offers", labelBn: "অফার", url: "/e/offers", group: "Product" },
  { label: "Reviews", labelBn: "রিভিউ", url: "/e/reviews", group: "Product" },
  // Courier
  { label: "Courier Handle", labelBn: "কুরিয়ার হ্যান্ডেল", url: "/e/courier" },
  // Users
  { label: "Admins", labelBn: "অ্যাডমিন", url: "/e/users/admins", group: "Users" },
  { label: "Customers", labelBn: "কাস্টমার", url: "/e/users/customers", group: "Users" },
  // Website
  { label: "API", labelBn: "API", url: "/e/website/api", group: "Website" },
  { label: "Pages", labelBn: "পেজ", url: "/e/website/pages", group: "Website" },
  { label: "Media", labelBn: "মিডিয়া", url: "/e/website/media", group: "Website" },
  { label: "Import/Export", labelBn: "ইমপোর্ট/এক্সপোর্ট", url: "/e/website/import-export", group: "Website" },
  { label: "AI", labelBn: "AI", url: "/e/website/ai", group: "Website" },
  
  
  
  // Settings
  { label: "Theme", labelBn: "থিম", url: "/e/settings/theme", group: "Settings" },
  { label: "Language", labelBn: "ভাষা", url: "/e/settings/language", group: "Settings" },
  { label: "Cursor Effect", labelBn: "কার্সর ইফেক্ট", url: "/e/settings/cursor", group: "Settings" },
  { label: "Menu Control", labelBn: "মেনু কন্ট্রোল", url: "/e/settings/menu", group: "Settings" },
  { label: "Keyboard Shortcuts", labelBn: "কীবোর্ড শর্টকাট", url: "/e/settings/shortcuts", group: "Settings" },
  // Notifications
  { label: "Notification Log", labelBn: "নোটিফিকেশন লগ", url: "/e/notifications/orders", group: "Notification" },
  { label: "Push Broadcast", labelBn: "পুশ ব্রডকাস্ট", url: "/e/notifications/push", group: "Notification" },
];
