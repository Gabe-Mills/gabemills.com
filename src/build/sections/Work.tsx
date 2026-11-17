import { useEffect, useRef } from "react";
import { projects, type Project } from "../../data/projects";
import Words from "../Words";
import "./work.css";

/**
 * Videos that enter together (the 3-up row) start one at a time, ~220 ms apart:
 * starting three decoders in the same frame cost a 180 ms hitch while scrolling.
 */
let nextStart = 0;
function startSoon(v: HTMLVideoElement, isWanted: () => boolean) {
  const now = performance.now();
  const at = Math.max(now, nextStart);
  nextStart = at + 220;
  setTimeout(() => { if (isWanted()) v.play().catch(() => {}); }, at - now);
}

/**
 * A muted looping video. On devices with a mouse it plays only while its card is hovered or
 * focused (the poster stands in otherwise: a quieter page); on touch it plays while on screen.
 * Never plays for reduced motion.
 */
export function LoopVideo({ src, poster, label, className }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // React does not reliably reflect `muted` as an attribute
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const hoverable = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const card = v.closest<HTMLElement>(".work-card");
    let onScreen = false, hovered = false;
    const wanted = () => !reduced.matches && (hoverable ? hovered : onScreen);
    const sync = () => { if (wanted()) { if (v.paused) startSoon(v, wanted); } else v.pause(); };
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0.4 });
    io.observe(v);
    const enter = () => { hovered = true; sync(); };
    const leave = () => { hovered = false; sync(); };
    card?.addEventListener("pointerenter", enter);
    card?.addEventListener("pointerleave", leave);
    card?.addEventListener("focusin", enter);
    card?.addEventListener("focusout", leave);
    reduced.addEventListener("change", sync);
    return () => {
      io.disconnect(); reduced.removeEventListener("change", sync); v.pause();
      card?.removeEventListener("pointerenter", enter); card?.removeEventListener("pointerleave", leave);
      card?.removeEventListener("focusin", enter); card?.removeEventListener("focusout", leave);
    };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
    >
      <source src={src.replace(/\.mp4$/, ".webm")} type="video/webm" />
      <source src={src} type="video/mp4" />
    </video>
  );
}

/**
 * One project, v6 "simplify": the whole card is the link. The screen (its loop plays on
 * hover), the kind, the title, one line, the host. No details overlay.
 */
function Card({ p, i }: { p: Project; i: number }) {
  return (
    <a className="work-card" href={p.url} target="_blank" rel="noopener noreferrer"
      aria-label={`${p.title}: ${p.blurb} Visit ${p.host} (opens in a new tab)`}
      data-build="box" data-delay={(i % 2) * 0.08}>
      <span className="work-media" aria-hidden="true">
        <span className="work-screen">
          {p.loop ? (
            <LoopVideo src={p.loop} poster={p.shot} label={p.shotAlt} />
          ) : (
            <img src={p.shot} alt="" loading="lazy" />
          )}
        </span>
        <span className="work-spill" />
      </span>
      <span className="work-card__body" aria-hidden="true">
        <span className="work-kind">{p.tag}</span>
        <span className="bp-display work-card__title">{p.title}</span>
        <span className="work-blurb">{p.blurb}</span>
        <span className="work-visit">{p.host} <span className="work-visit__arrow">↗</span></span>
      </span>
    </a>
  );
}

export default function Work() {
  return (
    <section id="work" className="bp-section work" aria-labelledby="work-title">
      <div className="work-room" aria-hidden="true"><div className="work-beam" /></div>
      <div className="bp-wrap">
        <h2 id="work-title" className="bp-display work-title" aria-label="Selected work.">
          <Words text={"Selected *work.*"} className="work-words" />
        </h2>
        <div className="work-grid">
          {projects.map((p, i) => <Card key={p.id} p={p} i={i} />)}
        </div>
      </div>
    </section>
  );
}
