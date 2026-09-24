import { useState } from "react";
import { useTheme, ThemeMode, TextureOption } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Palette, Sun, Moon, Waves, Sunset, Check, MessageCircle, Leaf, Image } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeSettings() {
  const { theme, setTheme, texture, setTexture, textureEnabled, setTextureEnabled } = useTheme();
  const { t } = useLanguage();
  const [hideAiChat, setHideAiChat] = useState(() => localStorage.getItem("admin_hide_ai_chat") === "true");

  const toggleAiChat = (checked: boolean) => {
    localStorage.setItem("admin_hide_ai_chat", checked ? "true" : "false");
    setHideAiChat(checked);
    window.dispatchEvent(new Event("admin-ai-chat-toggle"));
  };

  const themes: {
    value: ThemeMode;
    label: string;
    labelAlt: string;
    icon: React.ElementType;
    preview: { bg: string; sidebar: string; primary: string; accent: string };
  }[] = [
    { value: "light", label: "Light", labelAlt: "লাইট", icon: Sun, preview: { bg: "bg-white", sidebar: "bg-gray-50", primary: "bg-green-700", accent: "bg-amber-500" } },
    { value: "dark", label: "Dark", labelAlt: "ডার্ক", icon: Moon, preview: { bg: "bg-slate-800", sidebar: "bg-slate-900", primary: "bg-green-600", accent: "bg-amber-500" } },
    { value: "ocean", label: "Ocean Blue", labelAlt: "ওশান ব্লু", icon: Waves, preview: { bg: "bg-blue-50", sidebar: "bg-slate-900", primary: "bg-blue-600", accent: "bg-violet-500" } },
    { value: "sunset", label: "Sunset Rose", labelAlt: "সানসেট রোজ", icon: Sunset, preview: { bg: "bg-rose-50", sidebar: "bg-rose-950", primary: "bg-rose-500", accent: "bg-orange-500" } },
    { value: "doodle", label: "Doodle Warm", labelAlt: "ডুডল ওয়ার্ম", icon: Palette, preview: { bg: "bg-amber-50", sidebar: "bg-amber-950", primary: "bg-amber-500", accent: "bg-orange-500" } },
    { value: "midnight", label: "Midnight", labelAlt: "মিডনাইট", icon: Moon, preview: { bg: "bg-indigo-950", sidebar: "bg-indigo-900", primary: "bg-blue-500", accent: "bg-violet-500" } },
    { value: "silver", label: "Silver", labelAlt: "সিলভার", icon: Sun, preview: { bg: "bg-gray-200", sidebar: "bg-gray-900", primary: "bg-gray-500", accent: "bg-gray-400" } },
    { value: "rose", label: "Rose", labelAlt: "রোজ", icon: Sunset, preview: { bg: "bg-pink-50", sidebar: "bg-pink-950", primary: "bg-pink-500", accent: "bg-orange-400" } },
    { value: "sky", label: "Sky Blue", labelAlt: "স্কাই ব্লু", icon: Waves, preview: { bg: "bg-sky-50", sidebar: "bg-sky-950", primary: "bg-sky-500", accent: "bg-violet-400" } },
    { value: "leaf", label: "Leaf", labelAlt: "লিফ", icon: Leaf, preview: { bg: "bg-green-50", sidebar: "bg-green-950", primary: "bg-green-700", accent: "bg-lime-500" } },
  ];

  const textures: { value: TextureOption; label: string; labelAlt: string; image: string }[] = [
    { value: "bamboo", label: "Bamboo", labelAlt: "বাঁশপাতা", image: "/themes/leaf-bg.webp" },
    { value: "tropical", label: "Tropical", labelAlt: "ট্রপিক্যাল", image: "/themes/texture-tropical.webp" },
    { value: "golden", label: "Golden Leaf", labelAlt: "গোল্ডেন লিফ", image: "/themes/texture-golden.webp" },
    { value: "shadow", label: "Leaf Shadow", labelAlt: "লিফ শ্যাডো", image: "/themes/texture-shadow.webp" },
  ];

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {themes.map((th) => {
          const isActive = theme === th.value;
          const Icon = th.icon;
          return (
            <Card
              key={th.value}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg relative overflow-hidden",
                isActive ? "ring-2 ring-primary shadow-md" : "hover:ring-1 hover:ring-border"
              )}
              onClick={() => setTheme(th.value)}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
              <div className={cn("h-28 p-3 flex gap-1.5", th.preview.bg)}>
                <div className={cn("w-8 rounded-md", th.preview.sidebar)} />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className={cn("h-3 w-full rounded-sm", th.preview.primary, "opacity-80")} />
                  <div className="flex-1 flex gap-1.5">
                    <div className={cn("flex-1 rounded-sm opacity-20", th.preview.primary)} />
                    <div className={cn("w-8 rounded-sm opacity-60", th.preview.accent)} />
                  </div>
                  <div className={cn("h-2 w-2/3 rounded-sm opacity-30", th.preview.primary)} />
                </div>
              </div>
              <CardContent className="p-4 pt-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-semibold text-sm text-foreground">{th.label}</p>
                    <p className="text-xs text-muted-foreground">{th.labelAlt}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Texture Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="w-4 h-4" />
            {t("ব্যাকগ্রাউন্ড টেক্সচার", "Background Texture")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">
                {t("টেক্সচার চালু করুন", "Enable Texture")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("সব থিমে ব্যাকগ্রাউন্ড টেক্সচার দেখাবে", "Shows background texture on all themes")}
              </p>
            </div>
            <Switch checked={textureEnabled} onCheckedChange={(v) => {
              setTextureEnabled(v);
              if (v && texture === "none") setTexture("bamboo");
            }} />
          </div>

          {textureEnabled && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {textures.map((tx) => {
                const isActive = texture === tx.value;
                return (
                  <div
                    key={tx.value}
                    className={cn(
                      "cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:shadow-md",
                      isActive ? "border-primary shadow-md" : "border-border hover:border-muted-foreground/30"
                    )}
                    onClick={() => setTexture(tx.value)}
                  >
                    <div className="relative h-20">
                      <img src={tx.image} alt={tx.label} className="w-full h-full object-cover" />
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-card">
                      <p className="text-xs font-medium text-foreground">{tx.label}</p>
                      <p className="text-[10px] text-muted-foreground">{tx.labelAlt}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("বর্তমান থিম", "Current Theme")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("সক্রিয় থিম", "Active theme")}: <span className="font-semibold text-foreground">{themes.find((th) => th.value === theme)?.label}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "থিম পরিবর্তন শুধুমাত্র অ্যাডমিন প্যানেলে কার্যকর হবে এবং আপনার ব্রাউজারে সংরক্ষিত থাকবে।",
              "Theme changes apply only to the admin panel and are saved in your browser."
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            {t("এআই চ্যাট বাবল", "AI Chat Bubble")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">
                {t("এআই চ্যাট আইকন লুকান", "Hide AI Chat Icon")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t(
                  "শুধুমাত্র আপনার ব্রাউজারে কার্যকর হবে, অন্যদের উপর প্রভাব পড়বে না।",
                  "Only affects your browser, won't impact others."
                )}
              </p>
            </div>
            <Switch checked={hideAiChat} onCheckedChange={toggleAiChat} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
