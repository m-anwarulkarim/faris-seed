import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type LangMode = "bn" | "en";

interface LanguageContextType {
  lang: LangMode;
  setLang: (l: LangMode) => void;
  t: <T>(bn: T, en: T) => T;
}

const LANG_KEY = "site-lang";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangMode>(() => {
    try {
      return (localStorage.getItem(LANG_KEY) as LangMode) || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const t = <T,>(bn: T, en: T): T => {
    return lang === "en" ? en : bn;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: setLangState, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
