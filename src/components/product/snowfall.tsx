import { useMemo } from "react";

interface Flake {
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  drift: number;
}

/** Light, decorative snowfall — pure CSS animation, zero JS per frame. */
export function Snowfall({ count = 40 }: { count?: number }) {
  const flakes = useMemo<Flake[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 100) / count + Math.random() * 2,
        size: 3 + Math.random() * 5,
        delay: -Math.random() * 20,
        duration: 8 + Math.random() * 10,
        opacity: 0.35 + Math.random() * 0.45,
        drift: Math.random() * 60 - 30,
      })),
    [count],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {flakes.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.duration}s`,
            ["--drift" as never]: `${f.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
