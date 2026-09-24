import { useCursor, CursorIcon, CursorEffect } from "@/contexts/CursorContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MousePointer2, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const iconOptions: {
  value: CursorIcon;
  labelBn: string;
  labelEn: string;
  preview: React.ReactNode;
}[] = [
  {
    value: "default",
    labelBn: "ডিফল্ট",
    labelEn: "Default",
    preview: (
      <div className="flex items-center justify-center h-16">
        <svg width="18" height="26" viewBox="0 0 20 28" fill="none" className="text-foreground">
          <path d="M1 1L1 21L6.5 15.5L12 25L15 23.5L9.5 14H17L1 1Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    ),
  },
  {
    value: "crosshair",
    labelBn: "ক্রসহেয়ার",
    labelEn: "Crosshair",
    preview: (
      <div className="flex items-center justify-center h-16 text-foreground text-3xl font-light">+</div>
    ),
  },
  {
    value: "cell",
    labelBn: "সেল",
    labelEn: "Cell",
    preview: (
      <div className="flex items-center justify-center h-16 text-foreground font-bold text-2xl">⊞</div>
    ),
  },
  {
    value: "dot",
    labelBn: "ডট",
    labelEn: "Dot",
    preview: (
      <div className="flex items-center justify-center h-16">
        <div className="w-3 h-3 rounded-full bg-primary" />
      </div>
    ),
  },
];

const effectOptions: {
  value: CursorEffect;
  labelBn: string;
  labelEn: string;
  descBn: string;
  descEn: string;
  preview: React.ReactNode;
}[] = [
  {
    value: "none",
    labelBn: "কোনো ইফেক্ট নেই",
    labelEn: "No Effect",
    descBn: "কোনো অতিরিক্ত ইফেক্ট থাকবে না",
    descEn: "No additional effect",
    preview: (
      <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">—</div>
    ),
  },
  {
    value: "glow",
    labelBn: "গ্লো",
    labelEn: "Glow",
    descBn: "কার্সরের চারপাশে গ্লো",
    descEn: "Glow around cursor",
    preview: (
      <div className="flex items-center justify-center h-16">
        <div className="w-8 h-8 rounded-full bg-primary/30 shadow-[0_0_20px_8px_hsl(var(--primary)/0.3)]" />
      </div>
    ),
  },
  {
    value: "ring",
    labelBn: "রিং",
    labelEn: "Ring",
    descBn: "কার্সরের চারপাশে রিং",
    descEn: "Ring around cursor",
    preview: (
      <div className="flex items-center justify-center h-16 relative">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <div className="absolute w-10 h-10 rounded-full border-2 border-primary/50" />
      </div>
    ),
  },
  {
    value: "trail",
    labelBn: "ট্রেইল",
    labelEn: "Trail",
    descBn: "মাউস মুভে ট্রেইল",
    descEn: "Trail on mouse move",
    preview: (
      <div className="flex items-center justify-center h-16 gap-1">
        {[1, 0.7, 0.5, 0.3, 0.15].map((o, i) => (
          <div key={i} className="rounded-full bg-primary" style={{ width: `${10 - i * 1.5}px`, height: `${10 - i * 1.5}px`, opacity: o }} />
        ))}
      </div>
    ),
  },
  {
    value: "spotlight",
    labelBn: "স্পটলাইট",
    labelEn: "Spotlight",
    descBn: "কার্সরের চারপাশে সফট লাইট",
    descEn: "Soft light around cursor",
    preview: (
      <div className="flex items-center justify-center h-16">
        <div className="w-16 h-16 rounded-full" style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)" }} />
      </div>
    ),
  },
];

export default function CursorSettings() {
  const { cursorIcon, setCursorIcon, cursorEffect, setCursorEffect } = useCursor();
  const { t } = useLanguage();

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {iconOptions.map((opt) => {
          const isActive = cursorIcon === opt.value;
          return (
            <Card
              key={opt.value}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg relative overflow-hidden",
                isActive ? "ring-2 ring-primary shadow-md" : "hover:ring-1 hover:ring-border"
              )}
              onClick={() => setCursorIcon(opt.value)}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="bg-muted/30 border-b border-border">{opt.preview}</div>
              <CardContent className="p-3 text-center">
                <p className="font-semibold text-xs text-foreground">{t(opt.labelBn, opt.labelEn)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cursor Effect Section */}
      <div className="pt-4 border-t border-border">
        <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> {t("কার্সর ইফেক্ট", "Cursor Effect")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("মাউস মুভ করলে অতিরিক্ত ইফেক্ট যোগ করুন", "Add extra effects when moving the mouse")}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {effectOptions.map((opt) => {
          const isActive = cursorEffect === opt.value;
          return (
            <Card
              key={opt.value}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg relative overflow-hidden",
                isActive ? "ring-2 ring-primary shadow-md" : "hover:ring-1 hover:ring-border"
              )}
              onClick={() => setCursorEffect(opt.value)}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="bg-muted/30 border-b border-border">{opt.preview}</div>
              <CardContent className="p-3 text-center">
                <p className="font-semibold text-xs text-foreground">{t(opt.labelBn, opt.labelEn)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t(opt.descBn, opt.descEn)}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Current State */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("বর্তমান সেটিংস", "Current Settings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("আইকন", "Icon")}: <span className="font-semibold text-foreground">{t(iconOptions.find(o => o.value === cursorIcon)?.labelBn || "", iconOptions.find(o => o.value === cursorIcon)?.labelEn || "")}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {t("ইফেক্ট", "Effect")}: <span className="font-semibold text-foreground">{t(effectOptions.find(o => o.value === cursorEffect)?.labelBn || "", effectOptions.find(o => o.value === cursorEffect)?.labelEn || "")}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {t("আইকন ও ইফেক্ট আলাদাভাবে কম্বাইন করা যাবে।", "Icon and effect can be combined independently.")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
