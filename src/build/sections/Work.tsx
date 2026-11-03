import { useEffect, useId, useRef, useState } from "react";
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
 * A muted looping video that only plays while it is on screen, and never plays for
 * reduced motion (the poster stands in). Shared with the Reel section.
 */
export function LoopVideo({ src, poster, label, className }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true; // React does not reliably reflect `muted` as an attribute
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = false;
    const sync = () => {
      if (onScreen && !reduced.matches) { if (v.paused) startSoon(v, () => onScreen && !reduced.matches); }
      else v.pause();
    };
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0.2 });
    io.observe(v);
    reduced.addEventListener("change", sync);
    return () => { io.disconnect(); reduced.removeEventListener("change", sync); v.pause(); };
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

function Media({ p, delay }: { p: Project; delay: number }) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={-1}
      aria-hidden="true"
      className="work-media"
      data-build="media"
      data-delay={delay}
      data-label={`${p.host} · 1920 × 1200`}
    >
      {/* the screen: the video comes up from dark as it builds, and pushes in slowly with scroll */}
      <span className="work-screen">
        {p.loop ? (
          <LoopVideo src={p.loop} poster={p.shot} label={p.shotAlt} />
        ) : (
          <img src={p.shot} alt={p.shotAlt} loading="lazy" />
        )}
      </span>
      {/* the light it throws on the floor under the card (positioned against the card, so it
          sits below the whole card and brightens on hover; it reads --land from this element) */}
      <span className="work-spill" />
    </a>
  );
}

/** Role, status, the story and the stack: an overlay on hover (desktop), or opened by the toggle. */
function Details({ p, id, open }: { p: Project; id: string; open: boolean }) {
  return (
    <div id={id} className={`work-details${open ? " is-open" : ""}`} role="region" aria-label={`${p.title} details`}>
      <dl className="work-facts">
        <div><dt>Role</dt><dd>{p.role}</dd></div>
        <div><dt>Status</dt><dd>{p.status}</dd></div>
      </dl>
      <p className="work-summary">{p.summary}</p>
      <h4>Why</h4>
      <p>{p.problem}</p>
      <h4>What shipped</h4>
      <p>{p.outcome}</p>
      <ul className="work-stack" aria-label="Stack">
        {p.stack.map((s) => <li key={s}>{s}</li>)}
      </ul>
    </div>
  );
}

/**
 * One project: a card in a dark room. The screen on top, then the kind, a title that rises word
 * by word, one line, and the links. The rest of the facts: an overlay on hover, or the toggle.
 */
function Card({ p, i }: { p: Project; i: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const d = i * 0.04; // orders the crew's queue: card by card, part by part
  return (
    <article className={`work-card${open ? " is-open" : ""}`} aria-labelledby={`${id}-t`}>
      <div className="work-frame">
        <Media p={p} delay={d} />
        <Details p={p} id={`${id}-d`} open={open} />
      </div>
      <div className="work-card__body">
        <p className="work-kind">{p.module} <span aria-hidden="true">/</span> {p.tag}</p>
        <h3 id={`${id}-t`} className="bp-display work-card__title" aria-label={p.title}>
          <Words text={p.title} delay={d + 0.01} className="work-words" />
        </h3>
        <p className="work-blurb">{p.blurb}</p>
        <div className="work-row" data-build="box" data-delay={d + 0.02} data-from={i % 2 ? "right" : "left"} data-label={p.tag}>
          <a className="work-visit" href={p.url} target="_blank" rel="noopener noreferrer">
            Visit <span className="work-visit__host">{p.host}</span> <span aria-hidden="true">↗</span>
          </a>
          <button
            type="button"
            className="work-toggle"
            aria-expanded={open}
            aria-controls={`${id}-d`}
            onClick={() => setOpen((o) => !o)}
          >
            Details<span className="work-toggle__mark" aria-hidden="true" />
            <span className="sr-only"> about {p.title}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Work() {
  return (
    <section id="work" className="bp-section work" aria-labelledby="work-title">
      {/* the room: darkness at the edges, one key light from above (never above the section) */}
      <div className="work-room" aria-hidden="true"><div className="work-beam" /></div>
      <div className="bp-wrap">
        <header className="work-head">
          <p className="bp-kicker work-kicker" data-build="fade">Projects · {String(projects.length).padStart(2, "0")}</p>
          <h2 id="work-title" className="bp-display work-title" aria-label="Selected work.">
            <Words text={"Selected *work.*"} delay={0.02} className="work-words" />
          </h2>
        </header>
        <div className="work-grid">
          {projects.map((p, i) => <Card key={p.id} p={p} i={i} />)}
        </div>
      </div>
    </section>
  );
}
