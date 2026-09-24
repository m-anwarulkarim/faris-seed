import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronsLeftRight, GripVertical, ArrowUp, ArrowDown, RotateCcw, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_MENU_ORDER = [
  "my-activity",
  "dashboard",
  "customer-support",
  "order-search",
  "product",
  "all-orders",
  "courier-handle",
  "users",
  "website",
  "settings",
  "notification",
];

const MENU_LABELS: Record<string, { bn: string; en: string }> = {
  "my-activity": { bn: "মাই একটিভিটি", en: "My Activity" },
  "dashboard": { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  "customer-support": { bn: "কাস্টমার সাপোর্ট", en: "Customer Support" },
  "order-search": { bn: "অর্ডার সার্চ", en: "Order Search" },
  "product": { bn: "পণ্য", en: "Product" },
  "all-orders": { bn: "অর্ডারসমূহ", en: "All Orders" },
  "courier-handle": { bn: "কুরিয়ার হ্যান্ডেল", en: "Courier Handle" },
  "users": { bn: "ইউজার", en: "Users" },
  "website": { bn: "ওয়েবসাইট", en: "Website" },
  "settings": { bn: "সেটিংস", en: "Settings" },
  "notification": { bn: "নোটিফিকেশন", en: "Notification" },
};

function getMenuOrder(): string[] {
  try {
    const saved = localStorage.getItem("admin_menu_order");
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      // Merge any new items not in saved order
      const missing = DEFAULT_MENU_ORDER.filter((k) => !parsed.includes(k));
      return [...parsed, ...missing];
    }
  } catch {}
  return [...DEFAULT_MENU_ORDER];
}

export default function MenuControl() {
  const { t } = useLanguage();
  const [autoCollapse, setAutoCollapse] = useState(() => localStorage.getItem("admin_menu_auto_collapse") === "true");
  const [menuOrder, setMenuOrder] = useState<string[]>(getMenuOrder);

  const toggleAutoCollapse = (checked: boolean) => {
    localStorage.setItem("admin_menu_auto_collapse", checked ? "true" : "false");
    setAutoCollapse(checked);
    window.dispatchEvent(new Event("admin-menu-auto-collapse-toggle"));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newOrder = [...menuOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setMenuOrder(newOrder);
    localStorage.setItem("admin_menu_order", JSON.stringify(newOrder));
    window.dispatchEvent(new Event("admin-menu-order-changed"));
  };

  const resetOrder = () => {
    setMenuOrder([...DEFAULT_MENU_ORDER]);
    localStorage.removeItem("admin_menu_order");
    window.dispatchEvent(new Event("admin-menu-order-changed"));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ChevronsLeftRight className="w-4 h-4" />
            {t("মেনু অটো কলাপ্স", "Menu Auto Collapse")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">
                {t("অটো কলাপ্স চালু করুন", "Enable Auto Collapse")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "একটি মেনু খুললে বাকি সব মেনু স্বয়ংক্রিয়ভাবে বন্ধ হয়ে যাবে।",
                  "Opening one menu will automatically collapse all other menus."
                )}
              </p>
            </div>
            <Switch checked={autoCollapse} onCheckedChange={toggleAutoCollapse} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Menu className="w-4 h-4" />
              {t("মেনু সাজানো", "Menu Order")}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={resetOrder} className="h-7 text-xs gap-1">
              <RotateCcw className="w-3 h-3" />
              {t("রিসেট", "Reset")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">
            {t(
              "সাইডবারে মেনুর ক্রম পরিবর্তন করুন। তীর চিহ্ন দিয়ে উপরে-নিচে সাজান।",
              "Change the order of sidebar menus. Use arrows to move items up or down."
            )}
          </p>
          <div className="space-y-1">
            {menuOrder.map((key, index) => {
              const label = MENU_LABELS[key];
              if (!label) return null;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card",
                    "hover:bg-accent/50 transition-colors"
                  )}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground flex-1">
                    {t(label.bn, label.en)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums w-5 text-center">
                    {index + 1}
                  </span>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => moveItem(index, "up")}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={index === menuOrder.length - 1}
                      onClick={() => moveItem(index, "down")}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
