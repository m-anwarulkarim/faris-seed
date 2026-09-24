import { useEffect, useRef, useCallback } from "react";
import { useCursor, CursorIcon, CursorEffect } from "@/contexts/CursorContext";

const EMOJI_MAP: Record<string, string> = {
  "emoji-leaf": "🌱",
  "emoji-star": "⭐",
  "emoji-fire": "🔥",
};

export function CustomCursor() {
  const { cursorIcon, cursorEffect } = useCursor();
  const iconRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<HTMLDivElement[]>([]);
  const pos = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number>();

  const isCustomIcon = cursorIcon !== "default";
  const hasEffect = cursorEffect !== "none";
  const needsCustom = isCustomIcon || hasEffect;

  const handleMove = useCallback((e: MouseEvent) => {
    pos.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    if (!needsCustom) {
      document.body.style.cursor = "";
      return;
    }

    // For CSS cursors (crosshair, pointer, cell) we use native cursor + overlay effect
    const cssIcons: Record<string, string> = {
      crosshair: "crosshair",
      pointer: "pointer",
      cell: "cell",
      dot: "none",
    };

    if (cursorIcon in cssIcons) {
      document.body.style.cursor = cssIcons[cursorIcon];
    } else if (cursorIcon.startsWith("emoji-")) {
      document.body.style.cursor = "none";
    } else {
      document.body.style.cursor = "";
    }

    // Hide native cursor if we have a custom icon that needs rendering
    if (cursorIcon === "dot" || cursorIcon.startsWith("emoji-")) {
      document.body.style.cursor = "none";
    }

    window.addEventListener("mousemove", handleMove);

    const animate = () => {
      const { x, y } = pos.current;

      if (iconRef.current) {
        iconRef.current.style.left = `${x}px`;
        iconRef.current.style.top = `${y}px`;
      }
      if (effectRef.current) {
        effectRef.current.style.left = `${x}px`;
        effectRef.current.style.top = `${y}px`;
      }
      if (cursorEffect === "trail") {
        trailRefs.current.forEach((el, i) => {
          setTimeout(() => {
            if (el) {
              el.style.left = `${x}px`;
              el.style.top = `${y}px`;
            }
          }, (i + 1) * 40);
        });
      }

      animFrame.current = requestAnimationFrame(animate);
    };
    animFrame.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.body.style.cursor = "";
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [cursorIcon, cursorEffect, needsCustom, handleMove]);

  if (!needsCustom) return null;

  const renderIcon = () => {
    if (cursorIcon === "dot") {
      return (
        <div
          ref={iconRef}
          className="pointer-events-none fixed z-[10000] -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary"
        />
      );
    }
    if (cursorIcon.startsWith("emoji-")) {
      return (
        <div
          ref={iconRef}
          className="pointer-events-none fixed z-[10000] -translate-x-1/2 -translate-y-1/2 text-2xl select-none"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
        >
          {EMOJI_MAP[cursorIcon] || "🌱"}
        </div>
      );
    }
    return null; // CSS cursor handles it
  };

  const renderEffect = () => {
    if (cursorEffect === "glow") {
      return (
        <div
          ref={effectRef}
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, hsl(var(--primary) / 0.1) 60%, transparent 100%)",
            boxShadow: "0 0 24px 10px hsl(var(--primary) / 0.25)",
          }}
        />
      );
    }
    if (cursorEffect === "ring") {
      return (
        <div
          ref={effectRef}
          className="pointer-events-none fixed z-[9998] -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-primary/50"
          style={{ transition: "left 0.15s ease-out, top 0.15s ease-out" }}
        />
      );
    }
    if (cursorEffect === "trail") {
      return (
        <>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              ref={(el) => { if (el) trailRefs.current[i] = el; }}
              className="pointer-events-none fixed z-[9998] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40"
              style={{
                width: `${8 - i}px`,
                height: `${8 - i}px`,
                opacity: 1 - i * 0.18,
                transition: `left ${0.1 + i * 0.06}s ease-out, top ${0.1 + i * 0.06}s ease-out`,
              }}
            />
          ))}
        </>
      );
    }
    if (cursorEffect === "spotlight") {
      return (
        <div
          ref={effectRef}
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)",
          }}
        />
      );
    }
    return null;
  };

  return (
    <>
      {renderIcon()}
      {renderEffect()}
    </>
  );
}
