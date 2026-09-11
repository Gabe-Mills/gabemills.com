import { useEffect, useRef, useState } from "react";

/** Tracks prefers-reduced-motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

/**
 * Smooth pointer parallax. Returns a ref to attach to a container; writes
 * normalized pointer offset (-1..1) to CSS vars --px / --py on that element,
 * lerped for a cinematic camera feel. Disabled for touch / reduced motion.
 */
export function usePointerParallax(strength = 1) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2 * strength;
      ty = (e.clientY / window.innerHeight - 0.5) * 2 * strength;
    };
    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.setProperty("--px", cx.toFixed(4));
      el.style.setProperty("--py", cy.toFixed(4));
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [strength]);
  return ref;
}

/** True when viewport is below `px` (default 768). */
export function useIsMobile(px = 768): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, [px]);
  return mobile;
}
