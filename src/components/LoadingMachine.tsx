import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile, useReducedMotion } from "../lib/hooks";

/**
 * Cinematic activation sequence. A dark veil over the live core slowly lifts
 * through six beats — particles, a red ember, emerging silhouettes, a core
 * pulse — until a single [ INITIALIZE ] artifact appears. Activating it wakes
 * the world. The real WebGL core renders behind this the whole time.
 */
export default function LoadingMachine({ onComplete }: { onComplete: () => void }) {
  const [phase] = useState(0);
  const [activating, setActivating] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (reduced || isMobile) {
      onComplete();
      return;
    }
    const timers = [
      setTimeout(() => setVisible(false), 0),
      setTimeout(onComplete, 350),
    ];
    return () => timers.forEach(clearTimeout);
  }, [reduced, isMobile]);

  const activate = () => {
    if (activating) return;
    setActivating(true);
    setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 250);
    }, 850);
  };

  // veil darkness recedes as the world reveals itself
  const veil = isMobile ? [0.78, 0.72, 0.62, 0.5, 0.36, 0.28][phase] : [0.98, 0.95, 0.78, 0.62, 0.5, 0.46][phase];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          role="status"
          aria-label="Initialize the experience"
        >
          {/* darkening veil over the live core */}
          <motion.div
            className="absolute inset-0 bg-[#050302]"
            animate={{ opacity: activating ? 0 : veil }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />

          {/* faint ember glow */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
            style={{ background: "radial-gradient(circle, rgba(255,90,40,0.5), rgba(140,30,15,0.15) 45%, transparent 70%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? (phase >= 3 ? 0.9 : 0.5) : 0, scale: phase >= 3 ? 1.05 : 1 }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
          />

          {/* drifting micro-particles */}
          <Particles show={phase >= 0 && !activating} />

          {/* activation flash */}
          <AnimatePresence>
            {activating && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0] }}
                transition={{ duration: 0.85, ease: "easeOut" }}
                style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,170,90,0.9), rgba(255,90,40,0.2) 40%, transparent 70%)" }}
              />
            )}
          </AnimatePresence>

          {/* INITIALIZE artifact */}
          <AnimatePresence>
            {phase >= 5 && !activating && (
              <motion.button
                type="button"
                onClick={activate}
                initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="group absolute left-1/2 top-1/2 z-10 flex flex-col items-center gap-7 focus-visible:outline-none"
                aria-label="Initialize"
              >
                <span className="initialize-artifact relative flex h-36 w-36 items-center justify-center">
                  <span className="initialize-halo absolute -inset-10 rounded-full" />
                  <span className="initialize-ring initialize-ring-a absolute inset-0 rounded-full" />
                  <span className="initialize-ring initialize-ring-b absolute inset-3 rounded-full" />
                  <span className="initialize-ring initialize-ring-c absolute inset-6 rounded-full" />
                  <span className="initialize-orbit initialize-orbit-a absolute left-1/2 top-1/2 h-3 w-3 rounded-full" />
                  <span className="initialize-orbit initialize-orbit-b absolute left-1/2 top-1/2 h-2 w-2 rounded-full" />
                  <span
                    className="initialize-core absolute inset-[35%] rounded-full bg-[rgba(255,160,82,0.95)] transition-all duration-500 group-hover:inset-[30%]"
                  />
                  <span className="anim-status absolute inset-[46%] rounded-full bg-white/90" />
                </span>
                <span className="font-mono text-[12px] uppercase tracking-[0.55em] text-[#ffcaa0] transition-all duration-500 group-hover:tracking-[0.6em] group-hover:text-white">
                  [ Initialize ]
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Particles({ show }: { show: boolean }) {
  const dots = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37) % 100,
    top: (i * 53) % 100,
    size: 1 + ((i * 7) % 3),
    dur: 7 + ((i * 13) % 9),
    delay: -((i * 11) % 12),
    op: 0.1 + ((i * 17) % 30) / 100,
  }));
  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity: show ? 1 : 0, transition: "opacity 0.6s" }}>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            background: "rgba(255,180,120,0.8)",
            opacity: d.op,
            boxShadow: "0 0 6px rgba(255,140,70,0.6)",
            animation: `dust-float ${d.dur}s ease-in-out ${d.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
