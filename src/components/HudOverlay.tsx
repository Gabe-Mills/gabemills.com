interface Props {
  /** active module index 0..2, or -1 for none */
  activeModule?: number;
  /** 0..1 fog depth (1 = dense) */
  fogDepth?: number;
  /** status label shown bottom-left */
  status?: string;
}

const MONO = "font-mono text-[10px] uppercase tracking-[0.25em] text-muted/70";

/** Subtle command-deck HUD framing the whole experience. */
export default function HudOverlay({
  activeModule = -1,
  fogDepth = 1,
  status = "SYS ONLINE",
}: Props) {
  const depthBars = 8;
  const filled = Math.round((1 - fogDepth) * depthBars);

  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-hidden="true">
      {/* Top-left: status */}
      <div className="absolute left-4 top-20 hidden md:block">
        <div className="flex items-center gap-2">
          <span className="anim-status h-1.5 w-1.5 rounded-full bg-accent-green green-status-glow" />
          <span className={MONO}>{status}</span>
        </div>
      </div>

      {/* Top-right: coordinates */}
      <div className="absolute right-4 top-20 hidden text-right md:block">
        <span className={MONO}>X 042.7 · Y 118.3</span>
        <div className={`${MONO} mt-1`}>FOG.MACHINE / v2.5</div>
      </div>

      {/* Bottom-left: fog depth meter */}
      <div className="absolute bottom-6 left-4 hidden md:block">
        <div className={`${MONO} mb-1`}>FOG DEPTH</div>
        <div className="flex gap-1">
          {Array.from({ length: depthBars }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-1 rounded-sm transition-colors duration-500 ${
                i < filled ? "bg-accent-blue" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom-right: module progress dots */}
      <div className="absolute bottom-6 right-4 flex items-center gap-3">
        {[0, 1, 2].map((m) => (
          <div key={m} className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
                activeModule === m
                  ? "bg-accent-green green-status-glow scale-125"
                  : activeModule > m
                    ? "bg-accent-blue/70"
                    : "bg-white/15"
              }`}
            />
            <span className={MONO}>0{m + 1}</span>
          </div>
        ))}
      </div>

      {/* Thin frame rails */}
      <div className="absolute left-3 top-1/2 h-32 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
      <div className="absolute right-3 top-1/2 h-32 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
    </div>
  );
}
