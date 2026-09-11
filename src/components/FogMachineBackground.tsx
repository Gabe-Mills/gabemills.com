import { useIsMobile } from "../lib/hooks";
import CodeChipCloud from "./CodeChipCloud";

interface Props {
  /** simplified mode drops the heaviest layers (used by the loader). */
  simplified?: boolean;
  /** central glow tint, wired to the scroll scene. */
  glowColor?: string;
  className?: string;
}

/**
 * 12-layer cinematic fog/machine/lab background.
 * Layers are depth-sorted and parallax-aware (reads --px / --py CSS vars set
 * by a parent usePointerParallax). Heavy layers drop on mobile / simplified.
 *
 * 1 base gradient · 2 fog volume · 3 glass haze · 4 machine grid ·
 * 5 depth particles · 6 far glow orbs · 7 light streaks · 8 blueprint lines ·
 * 9 vignette · 10 floating 3D panels · 11 scanline/refraction · 12 fg dust
 */
export default function FogMachineBackground({
  simplified = false,
  glowColor = "rgba(0, 217, 255, 0.16)",
  className = "",
}: Props) {
  const isMobile = useIsMobile();
  const heavy = !simplified && !isMobile;

  // parallax helper: depth in px, sign controls direction
  const px = (depth: number) =>
    ({
      transform: `translate3d(calc(var(--px,0) * ${depth}px), calc(var(--py,0) * ${depth}px), 0)`,
    }) as React.CSSProperties;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ perspective: "1600px" }}
    >
      {/* 01 — deep charcoal base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(150% 130% at 50% 28%, hsl(220 40% 7%) 0%, hsl(222 44% 4%) 52%, hsl(224 48% 2%) 100%)",
        }}
      />

      {/* 06 — far background glow orbs (soft mesh, heavily blurred) */}
      <div className="absolute inset-0" style={px(-10)}>
        <div
          className="anim-aurora absolute left-1/2 top-[40%] h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
          style={{
            background: `radial-gradient(circle, ${glowColor} 0%, rgba(122,92,255,0.10) 42%, transparent 70%)`,
            opacity: 0.9,
          }}
        />
        <div
          className="anim-fog-slow absolute left-[12%] top-[24%] h-[46vmin] w-[46vmin] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(circle, rgba(0,255,156,0.10), transparent 68%)" }}
        />
        <div
          className="anim-fog-rev absolute right-[8%] bottom-[14%] h-[52vmin] w-[52vmin] rounded-full blur-[110px]"
          style={{ background: "radial-gradient(circle, rgba(122,92,255,0.12), transparent 68%)" }}
        />
      </div>

      {/* 02 — slow moving fog volume */}
      <div
        className="anim-fog-slow absolute -inset-[25%] blur-[60px]"
        style={{
          background:
            "radial-gradient(42% 55% at 32% 42%, rgba(120,150,200,0.12), transparent 62%), radial-gradient(48% 52% at 70% 60%, rgba(90,110,170,0.10), transparent 62%)",
        }}
      />
      {heavy && (
        <div
          className="anim-fog-rev absolute -inset-[28%] blur-[90px]"
          style={{
            background:
              "radial-gradient(40% 44% at 60% 52%, rgba(150,170,210,0.10), transparent 64%), radial-gradient(42% 46% at 24% 66%, rgba(110,130,190,0.08), transparent 62%)",
          }}
        />
      )}

      {/* 10 — floating 3D glass panels far in depth */}
      {heavy && (
        <div className="absolute inset-0" style={{ ...px(26), transformStyle: "preserve-3d" }}>
          <FloatingPanel className="left-[10%] top-[22%] h-40 w-28" delay={0} />
          <FloatingPanel className="right-[12%] top-[30%] h-48 w-32" delay={-6} flip />
          <FloatingPanel className="left-[16%] bottom-[16%] h-36 w-44" delay={-11} />
          <FloatingPanel className="right-[18%] bottom-[20%] h-28 w-36" delay={-3} flip />
        </div>
      )}

      {/* 04 — subtle machine grid (perspective floor) */}
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          ...px(6),
          backgroundImage:
            "linear-gradient(rgba(150,180,220,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(150,180,220,0.06) 1px, transparent 1px)",
          backgroundSize: "70px 70px",
          transform: "perspective(600px) rotateX(64deg) translateZ(-40px)",
          transformOrigin: "bottom",
          maskImage: "linear-gradient(to top, #000 0%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to top, #000 0%, transparent 80%)",
          opacity: 0.5,
        }}
      />

      {/* 08 — thin technical blueprint lines (subtle, masked) */}
      <div
        className="absolute inset-0"
        style={{
          ...px(4),
          backgroundImage:
            "linear-gradient(rgba(120,160,210,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,210,0.045) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
          maskImage: "radial-gradient(110% 90% at 50% 40%, #000 30%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(110% 90% at 50% 40%, #000 30%, transparent 78%)",
          opacity: 0.55,
        }}
      />

      {/* 07 — mid-layer light streaks */}
      {!simplified && (
        <div className="absolute inset-0 overflow-hidden" style={px(14)}>
          <div
            className="anim-streak absolute left-0 top-[34%] h-px w-[40%]"
            style={{ background: "linear-gradient(90deg, transparent, rgba(0,217,255,0.5), transparent)", filter: "blur(0.5px)" }}
          />
          <div
            className="anim-streak absolute left-0 top-[58%] h-px w-[30%]"
            style={{ background: "linear-gradient(90deg, transparent, rgba(122,92,255,0.45), transparent)", animationDelay: "-5.5s", filter: "blur(0.5px)" }}
          />
        </div>
      )}

      {/* 05 — blurred depth particles */}
      {heavy && <ParticleField px={px} />}

      {/* 11 — scanline / refraction sweep */}
      {!simplified && (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="anim-scan absolute left-0 right-0 h-[40vh]"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(0,217,255,0.06) 46%, rgba(180,220,255,0.12) 50%, rgba(0,217,255,0.06) 54%, transparent)",
            }}
          />
          {/* fine refraction scanlines */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 3px)",
            }}
          />
        </div>
      )}

      {/* 03 — soft glass haze (central focus) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 44%, rgba(180,210,255,0.05), transparent 70%)",
          backdropFilter: heavy ? "blur(2px)" : undefined,
          WebkitBackdropFilter: heavy ? "blur(2px)" : undefined,
        }}
      />

      {/* 17 — floating code chips (atmosphere, behind dust) */}
      {!simplified && <CodeChipCloud count={isMobile ? 7 : 14} />}

      {/* 12 — foreground atmospheric dust + glow */}
      {!simplified && <DustField px={px} dense={heavy} />}

      {/* 09 — soft vignette edges */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(125% 105% at 50% 44%, transparent 44%, rgba(2,4,9,0.5) 78%, rgba(1,2,5,0.92) 100%)",
        }}
      />

      {/* fine noise + unifying overlay */}
      <div className="noise-overlay absolute inset-0 opacity-[0.045] mix-blend-overlay" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(145% 120% at 50% 50%, transparent 56%, rgba(1,2,5,0.4) 100%)" }}
      />
    </div>
  );
}

function FloatingPanel({
  className = "",
  delay = 0,
  flip = false,
}: {
  className?: string;
  delay?: number;
  flip?: boolean;
}) {
  return (
    <div
      className={`anim-panel-drift absolute rounded-2xl border border-white/[0.06] ${className}`}
      style={{
        animationDelay: `${delay}s`,
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.005) 60%, transparent)",
        boxShadow: "0 30px 60px -30px rgba(0,0,0,0.8)",
        transform: flip ? "rotateY(12deg)" : undefined,
        opacity: 0.4,
        filter: "blur(0.5px)",
      }}
    >
      <div className="absolute left-3 top-3 h-1 w-8 rounded bg-white/15" />
      <div className="absolute left-3 top-6 h-1 w-5 rounded bg-white/10" />
      <div className="absolute bottom-3 left-3 h-1.5 w-1.5 rounded-full bg-accent-blue/40" />
    </div>
  );
}

function ParticleField({ px }: { px: (d: number) => React.CSSProperties }) {
  const rng = mulberry32(0xa11ce);
  const particles = Array.from({ length: 26 }, () => {
    const depth = rng();
    return {
      left: rng() * 100,
      top: rng() * 100,
      size: 0.6 + depth * 2.6,
      delay: -rng() * 16,
      dur: 12 + rng() * 16,
      op: 0.06 + depth * 0.28,
      par: 4 + depth * 22,
      blur: depth > 0.6 ? 0 : 1.2,
    };
  });
  return (
    <div className="absolute inset-0">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            ...px(p.par),
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.op,
            filter: `blur(${p.blur}px)`,
            animation: `module-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function DustField({ px, dense }: { px: (d: number) => React.CSSProperties; dense: boolean }) {
  const rng = mulberry32(0xd05705);
  const count = dense ? 22 : 10;
  const dust = Array.from({ length: count }, () => ({
    left: rng() * 100,
    top: rng() * 100,
    size: 1 + rng() * 2.4,
    delay: -rng() * 12,
    dur: 9 + rng() * 10,
    d: 0.12 + rng() * 0.3,
  }));
  return (
    <div className="absolute inset-0" style={px(34)}>
      {dust.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: "rgba(200,225,255,0.9)",
            boxShadow: "0 0 6px rgba(160,200,255,0.6)",
            // @ts-expect-error custom prop
            "--d": p.d,
            opacity: p.d,
            filter: "blur(0.4px)",
            animation: `dust-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
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
