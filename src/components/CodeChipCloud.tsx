import { useMemo } from "react";
import { codeChips } from "../data/scenes";

interface ChipPlacement {
  text: string;
  left: number;
  top: number;
  delay: number;
  duration: number;
  scale: number;
  base: number;
}

/** Layer 17 — faint code chips half-hidden in the fog. Atmosphere, not claims. */
export default function CodeChipCloud({
  count = 16,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  const chips = useMemo<ChipPlacement[]>(() => {
    // Deterministic pseudo-random so SSR/hydration & re-renders are stable.
    const rng = mulberry32(0x5eed);
    return Array.from({ length: count }, (_, i) => ({
      text: codeChips[i % codeChips.length],
      left: 4 + rng() * 92,
      top: 6 + rng() * 86,
      delay: -rng() * 12,
      duration: 9 + rng() * 10,
      scale: 0.72 + rng() * 0.7,
      base: 0.08 + rng() * 0.14,
    }));
  }, [count]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {chips.map((c, i) => (
        <span
          key={i}
          className="anim-flicker absolute font-mono uppercase tracking-[0.2em] text-accent-blue/40"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            fontSize: `${10 * c.scale}px`,
            // @ts-expect-error custom prop
            "--chip-base": c.base,
            opacity: c.base,
            animation: `chip-float ${c.duration}s ease-in-out ${c.delay}s infinite`,
            filter: "blur(0.3px)",
          }}
        >
          {c.text}
        </span>
      ))}
    </div>
  );
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
