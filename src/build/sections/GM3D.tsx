import { useEffect, useRef, useState } from "react";
import type { GMScene } from "./gm3d/scene";

/**
 * The finale's 3D GM (Gabe, 3 Nov 2026: "the mouses should just go off the screen and
 * disappear and we have a 3D GM"). One WebGL canvas for this component only; three.js and the
 * scene load lazily as the finale nears. It rises out of the dark as it scrolls in (its own
 * scroll position: how far it has come into the upper three quarters of the viewport,
 * one-shot), then idles with a slow turn and a float, leans toward the pointer, and runs a light
 * sweep across the metal when hovered.
 * Renders only while on screen; DPR capped at 1.75 (1.25 on touch); reduced motion gets one
 * static settled frame; no WebGL falls back to the logo image (build.css gives it the green).
 * Everything is disposed on unmount.
 */
/** a quick probe so a machine without WebGL gets the image without loading three at all */
function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch { return false; }
}

export default function GM3D({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gm: GMScene | null = null;
    let dead = false;
    let onScreen = false;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const cleanups: (() => void)[] = [];

    const boot = async () => {
      if (!hasWebGL()) { setFallback(true); return; }
      let mod: typeof import("./gm3d/scene");
      try { mod = await import("./gm3d/scene"); } catch { if (!dead) setFallback(true); return; }
      if (dead) return;
      try {
        gm = new mod.GMScene(el, { dpr: Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.75), staticFrame: reduce });
      } catch {
        setFallback(true);
        return;
      }
      const g = gm;
      await g.ready(() => !dead);
      if (dead) return;
      if (import.meta.env.DEV) (window as unknown as { __gm3d?: GMScene }).__gm3d = g;
      const ro = new ResizeObserver(([e]) => g.resize(e.contentRect.width, e.contentRect.height));
      ro.observe(el);
      cleanups.push(() => ro.disconnect());

      // the rise: how much of the stage has entered the top 75% of the viewport (only rises)
      const thresholds = Array.from({ length: 41 }, (_, i) => i / 40);
      const riseIO = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting || e.intersectionRatio > 0) g.setRise(e.intersectionRatio); },
        { rootMargin: "0px 0px -25% 0px", threshold: thresholds },
      );
      riseIO.observe(el);
      cleanups.push(() => riseIO.disconnect());

      if (reduce) { g.setRise(1); g.renderOnce(); return; }

      // render only while on screen
      const visIO = new IntersectionObserver(([e]) => {
        onScreen = e.isIntersecting;
        if (onScreen) g.start(); else g.stop();
      });
      visIO.observe(el);
      cleanups.push(() => visIO.disconnect());

      // lean toward the pointer (window-relative, so no layout reads)
      const onMove = (ev: PointerEvent) => {
        if (!onScreen || ev.pointerType === "touch") return;
        g.setPointer((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1));
      };
      addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => removeEventListener("pointermove", onMove));
      // hover (or tap) the mark: a light sweep across the metal
      const onEnter = () => g.sweep();
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerdown", onEnter);
      cleanups.push(() => { el.removeEventListener("pointerenter", onEnter); el.removeEventListener("pointerdown", onEnter); });
    };

    // boot (three, the WebGL context, the PMREM reflections, shader compile) in the first idle
    // moment after load, while the visitor is still at the top: booting as the finale neared
    // landed mid-scroll and cost a ~120 ms hitch in Stack. It renders nothing until on screen.
    // Approaching it is the fallback trigger if someone gets there before the page went idle.
    let booted = false;
    const bootOnce = () => { if (!booted && !dead) { booted = true; near.disconnect(); void boot(); } };
    const idleBoot = "requestIdleCallback" in window
      ? requestIdleCallback(bootOnce, { timeout: 5000 })
      : setTimeout(bootOnce, 3000) as unknown as number;
    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) bootOnce(); }, { rootMargin: "1400px 0px" });
    near.observe(el);
    cleanups.push(() => ("cancelIdleCallback" in window ? cancelIdleCallback(idleBoot) : clearTimeout(idleBoot)));

    return () => {
      dead = true;
      near.disconnect();
      cleanups.forEach((f) => f());
      gm?.dispose();
      gm = null;
    };
  }, []);

  return (
    <div ref={host} className={`gm3d ${className}`} aria-hidden="true">
      {fallback && <img className="gm3d__img" src="/logo-gm.webp" alt="" width={510} height={300} />}
    </div>
  );
}
