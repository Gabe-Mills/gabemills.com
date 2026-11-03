import { useEffect, useRef, type ReactNode } from "react";
import "./build.css";
import { BuildEngine } from "./engine";

/**
 * One swarm, no named leads: every cursor builds (Gabe's call). Cursor colours are the
 * page's metallic greens and silvers, so the crew reads as part of the wash.
 */
const COLORS = ["#A8F0C8", "#5ED39A", "#D9E4DF", "#3DBE80", "#BFD8CB", "#7FE0A8", "#E8F5EE", "#2FA36B"];

/** Wraps the page: mounts the overlay canvas and runs the build engine over every [data-build]. */
export default function BuildRoot({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!root.current || !canvas.current) return;
    const engine = new BuildEngine(canvas.current, COLORS);
    engine.scan(root.current);
    // rescan once fonts and late content (videos, data) have settled
    const again = () => engine.scan(root.current!);
    document.fonts?.ready.then(again);
    const t = setTimeout(again, 1200);
    (window as unknown as { __build: BuildEngine }).__build = engine;
    // looping motion graphics (sheens, scans, pings, marquees) pause in sections that are
    // off screen: the sheen repaints its text every frame, and nobody sees a hidden loop
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.toggleAttribute("data-off", !e.isIntersecting)),
      { rootMargin: "120px 0px" },
    );
    root.current.querySelectorAll("section").forEach((s) => io.observe(s));
    return () => { clearTimeout(t); io.disconnect(); engine.destroy(); };
  }, []);

  return (
    <div ref={root} className="bp">
      {children}
      <canvas ref={canvas} className="bp-overlay" aria-hidden="true" />
    </div>
  );
}
