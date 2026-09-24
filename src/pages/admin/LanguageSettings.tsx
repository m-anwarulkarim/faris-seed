import { useLanguage, LangMode } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const languages: {
  value: LangMode;
  label: string;
  labelAlt: string;
  description: string;
  descriptionEn: string;
  example: string;
}[] = [
  {
    value: "bn",
    label: "বাংলা",
    labelAlt: "Bengali",
    description: "সম্পূর্ণ বাংলা ভাষায় অ্যাডমিন প্যানেল",
    descriptionEn: "Full Bengali admin panel interface",
    example: "ড্যাশবোর্ড · পণ্য · অর্ডার · সেটিংস",
  },
  {
    value: "en",
    label: "English",
    labelAlt: "ইংরেজি",
    description: "Full English admin panel interface",
    descriptionEn: "Full English admin panel interface",
    example: "Dashboard · Products · Orders · Settings",
  },
];

export default function LanguageSettings() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {languages.map((l) => {
          const isActive = lang === l.value;
          return (
            <Card
              key={l.value}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg relative overflow-hidden",
                isActive ? "ring-2 ring-primary shadow-md" : "hover:ring-1 hover:ring-border"
              )}
              onClick={() => setLang(l.value)}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center z-10">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
              <CardContent className="p-5 space-y-3">
                <div>
                  <p className="font-bold text-lg text-foreground">{l.label}</p>
                  <p className="text-xs text-muted-foreground">{l.labelAlt}</p>
                </div>
                <p className="text-sm text-muted-foreground">{t(l.description, l.descriptionEn)}</p>
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground font-mono">{l.example}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("বর্তমান ভাষা", "Current Language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("সক্রিয় ভাষা", "Active language")}: <span className="font-semibold text-foreground">{languages.find((l) => l.value === lang)?.label}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "ভাষা পরিবর্তন শুধুমাত্র অ্যাডমিন প্যানেলে কার্যকর হবে এবং আপনার ব্রাউজারে সংরক্ষিত থাকবে।",
              "Language changes apply only to the admin panel and are saved in your browser."
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
