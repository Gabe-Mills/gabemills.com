import { forwardRef } from "react";

interface Props {
  className?: string;
  powered?: boolean;
}

/**
 * The central machine core: concentric rotating rings, a rim-lit glass dome,
 * volumetric internal light, and radial rails. Pure CSS/SVG — no 3D libs.
 */
const MachineCore = forwardRef<HTMLDivElement, Props>(function MachineCore(
  { className = "", powered = true },
  ref
) {
  return (
    <div
      ref={ref}
      className={`relative aspect-square ${className}`}
      data-core
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* volumetric halo */}
      <div
        className="absolute inset-[-12%] rounded-full blur-3xl transition-opacity duration-700"
        data-core-halo
        style={{
          opacity: powered ? 0.95 : 0.25,
          background:
            "radial-gradient(circle, rgba(0,217,255,0.4) 0%, rgba(122,92,255,0.16) 42%, transparent 70%)",
        }}
      />

      {/* outer ring with engraved ticks */}
      <div className="anim-ring-slow absolute inset-0 rounded-full" data-core-ring>
        <div className="absolute inset-0 rounded-full border border-white/12" />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(0,217,255,0.15) 12deg, transparent 24deg)",
            opacity: 0.5,
          }}
        />
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-white/25"
            style={{ transform: `rotate(${i * 15}deg)`, transformOrigin: "50% 50vmin" }}
          />
        ))}
      </div>

      {/* dashed reverse ring */}
      <div className="anim-ring-rev absolute inset-[8%] rounded-full border border-dashed border-accent-blue/35" data-core-ring />

      {/* gauge arc */}
      <svg viewBox="0 0 100 100" className="anim-ring-slow absolute inset-[5%]" data-core-ring>
        <circle cx="50" cy="50" r="47" fill="none" stroke="url(#coreGrad)" strokeWidth="0.7" strokeDasharray="16 5" strokeLinecap="round" opacity="0.7" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <defs>
          <linearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00d9ff" />
            <stop offset="55%" stopColor="#7a5cff" />
            <stop offset="100%" stopColor="#00ff9c" />
          </linearGradient>
        </defs>
      </svg>

      {/* inner ring */}
      <div className="anim-ring-rev absolute inset-[16%] rounded-full border border-white/10" data-core-ring />

      {/* rim-lit glass dome */}
      <div
        className="anim-breathe absolute inset-[30%] rounded-full"
        data-core-center
        style={{
          background:
            "radial-gradient(circle at 38% 30%, rgba(190,235,255,0.65), rgba(0,217,255,0.35) 38%, rgba(122,92,255,0.2) 62%, rgba(8,12,22,0.95) 100%)",
          boxShadow:
            "inset 0 2px 12px rgba(255,255,255,0.4), inset 0 -10px 28px rgba(0,0,0,0.6), 0 0 30px rgba(0,217,255,0.4), 0 0 80px rgba(0,217,255,0.18)",
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      >
        {/* specular highlight */}
        <div
          className="absolute left-[22%] top-[16%] h-[34%] w-[40%] rounded-full blur-md"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.75), transparent 70%)" }}
        />
        {/* inner core spark */}
        <div
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={{ boxShadow: "0 0 16px 5px rgba(0,217,255,0.9), 0 0 40px 10px rgba(0,217,255,0.4)" }}
        />
      </div>

      {/* radial rail spokes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <div
          key={deg}
          className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left"
          style={{
            transform: `rotate(${deg}deg)`,
            background: "linear-gradient(90deg, rgba(0,217,255,0.35) 0%, transparent 70%)",
          }}
        />
      ))}
    </div>
  );
});

export default MachineCore;
