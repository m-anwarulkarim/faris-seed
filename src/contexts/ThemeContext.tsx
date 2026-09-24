import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "ocean" | "sunset" | "doodle" | "midnight" | "silver" | "rose" | "sky" | "leaf" | "royal-onyx" | "pearl-aurora" | "emerald-noir";

export type TextureOption = "none" | "bamboo" | "tropical" | "golden" | "shadow" | "aurora" | "mesh";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  texture: TextureOption;
  setTexture: (t: TextureOption) => void;
  textureEnabled: boolean;
  setTextureEnabled: (v: boolean) => void;
}

const THEME_KEY = "admin-theme";
const TEXTURE_KEY = "admin-texture";
const TEXTURE_ENABLED_KEY = "admin-texture-enabled";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_CLASSES = ["dark", "theme-ocean", "theme-sunset", "theme-doodle", "theme-midnight", "theme-silver", "theme-rose", "theme-sky", "theme-leaf", "theme-royal-onyx", "theme-pearl-aurora", "theme-emerald-noir"];

const TEXTURE_CLASSES = ["texture-bamboo", "texture-tropical", "texture-golden", "texture-shadow", "texture-aurora", "texture-mesh"];

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);

  const classMap: Record<string, string> = {
    dark: "dark",
    ocean: "theme-ocean",
    sunset: "theme-sunset",
    doodle: "theme-doodle",
    midnight: "theme-midnight",
    silver: "theme-silver",
    rose: "theme-rose",
    sky: "theme-sky",
    leaf: "theme-leaf",
    "royal-onyx": "theme-royal-onyx",
    "pearl-aurora": "theme-pearl-aurora",
    "emerald-noir": "theme-emerald-noir",
  };
  if (classMap[theme]) root.classList.add(classMap[theme]);
}

function applyTexture(enabled: boolean, texture: TextureOption) {
  const root = document.documentElement;
  root.classList.remove(...TEXTURE_CLASSES);
  if (enabled && texture !== "none") {
    root.classList.add(`texture-${texture}`);
  }
}

export function ThemeProvider({ children, manageDocument = true }: { children: ReactNode; manageDocument?: boolean }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as ThemeMode) || "ocean";
    } catch {
      return "ocean";
    }
  });

  const [texture, setTextureState] = useState<TextureOption>(() => {
    try {
      return (localStorage.getItem(TEXTURE_KEY) as TextureOption) || "bamboo";
    } catch {
      return "bamboo";
    }
  });

  const [textureEnabled, setTextureEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem(TEXTURE_ENABLED_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!manageDocument) {
      // Public site keeps the brand palette — strip admin theme classes unless
      // the admin panel (nested provider) is the one in charge.
      const inAdmin = window.location.pathname.startsWith("/e");
      if (!inAdmin) {
        document.documentElement.classList.remove(...THEME_CLASSES, ...TEXTURE_CLASSES);
      }
      return;
    }
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
    return () => {
      document.documentElement.classList.remove(...THEME_CLASSES, ...TEXTURE_CLASSES);
    };
  }, [theme, manageDocument]);

  useEffect(() => {
    if (!manageDocument) return;
    applyTexture(textureEnabled, texture);
    localStorage.setItem(TEXTURE_KEY, texture);
    localStorage.setItem(TEXTURE_ENABLED_KEY, textureEnabled ? "true" : "false");
  }, [textureEnabled, texture, manageDocument]);

  const setTheme = (t: ThemeMode) => setThemeState(t);
  const setTexture = (t: TextureOption) => setTextureState(t);
  const setTextureEnabled = (v: boolean) => setTextureEnabledState(v);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, texture, setTexture, textureEnabled, setTextureEnabled }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for HMR edge cases - return safe defaults
    return {
      theme: "ocean",
      setTheme: () => {},
      texture: "tropical",
      setTexture: () => {},
      textureEnabled: true,
      setTextureEnabled: () => {},
    };
  }
  return ctx;
}
