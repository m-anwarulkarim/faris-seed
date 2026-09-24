import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type CursorIcon = "default" | "crosshair" | "cell" | "dot";
export type CursorEffect = "none" | "glow" | "ring" | "trail" | "spotlight";

interface CursorContextType {
  cursorIcon: CursorIcon;
  setCursorIcon: (c: CursorIcon) => void;
  cursorEffect: CursorEffect;
  setCursorEffect: (e: CursorEffect) => void;
}

const ICON_KEY = "admin-cursor-icon";
const EFFECT_KEY = "admin-cursor-effect";

const CursorContext = createContext<CursorContextType | undefined>(undefined);

export function CursorProvider({ children }: { children: ReactNode }) {
  const [cursorIcon, setCursorIconState] = useState<CursorIcon>(() => {
    try {
      return (localStorage.getItem(ICON_KEY) as CursorIcon) || "default";
    } catch {
      return "default";
    }
  });

  const [cursorEffect, setCursorEffectState] = useState<CursorEffect>(() => {
    try {
      return (localStorage.getItem(EFFECT_KEY) as CursorEffect) || "none";
    } catch {
      return "none";
    }
  });

  useEffect(() => {
    localStorage.setItem(ICON_KEY, cursorIcon);
  }, [cursorIcon]);

  useEffect(() => {
    localStorage.setItem(EFFECT_KEY, cursorEffect);
  }, [cursorEffect]);

  return (
    <CursorContext.Provider value={{
      cursorIcon, setCursorIcon: setCursorIconState,
      cursorEffect, setCursorEffect: setCursorEffectState,
    }}>
      {children}
    </CursorContext.Provider>
  );
}

export function useCursor(): CursorContextType {
  const ctx = useContext(CursorContext);
  if (!ctx) throw new Error("useCursor must be used within CursorProvider");
  return ctx;
}
