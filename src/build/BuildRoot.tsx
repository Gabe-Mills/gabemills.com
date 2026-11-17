import { useEffect, useRef, type ReactNode } from "react";
import "./build.css";
import { BuildEngine, type CrewMember } from "./engine";

/**
 * The hero crew: four named cursors, the AI tools Gabe builds with. Each takes one step of the
 * hero build. Colours are the page's metallic greens and silvers, so the crew reads as part of it.
 */
const CREW: CrewMember[] = [
  { name: "Claude", color: "#A8F0C8" },
  { name: "Cursor", color: "#D9E4DF" },
  { name: "Codex", color: "#5ED39A" },
  { name: "ChatGPT", color: "#BFD8CB" },
];

/** Wraps the page: mounts the overlay canvas and runs the build engine over every [data-build]. */
export default function BuildRoot({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!root.current || !canvas.current) return;
    const e = new BuildEngine(canvas.current, CREW);
    e.scan(root.current);
    // rescan once fonts and late content have settled
    const again = () => e.scan(root.current!);
    document.fonts?.ready.then(again);
    const t = setTimeout(again, 1200);
    // looping motion (sheens, marquees) pauses in sections that are off screen
    const io = new IntersectionObserver(
      (entries) => entries.forEach((x) => x.target.toggleAttribute("data-off", !x.isIntersecting)),
      { rootMargin: "120px 0px" },
    );
    root.current.querySelectorAll("section").forEach((s) => io.observe(s));
    return () => { clearTimeout(t); io.disconnect(); e.destroy(); };
  }, []);

  return (
    <div ref={root} className="bp">
      {children}
      <canvas ref={canvas} className="bp-overlay" aria-hidden="true" />
    </div>
  );
}
