import { useEffect, useRef } from "react";

/**
 * Scroll-scrubbed pinned stage, shared by GitHub and Stack.
 *
 * Markup: <section ref class="sc-scrub"><div class="sc-stage"><div class="sc-stage-inner">…
 * The section is sized to 100vh + content overflow + `scrub` × 100vh of scroll; the stage
 * sticks while the section passes. Everything is a pure function of scroll position, so
 * it plays backwards when scrolling up.
 *
 * Writes, as CSS vars:
 *   on the section: --p (0..1 progress through the pin), --enter (0..1 while the section
 *                   rises into view, for the ink-rain wipe), --vh
 *   on each [data-scrub] element: --t (0..1). With data-from / data-to it follows that
 *     slice of --p (negative values play while the section rises in), gated by the element actually being on screen. When the content is
 *     much taller than the viewport (phones), the content scrolls inside the stage and
 *     --t follows each element's position on screen instead.
 * data-positional is set on the section in that phone mode, for CSS that needs to know.
 * Reduced motion: no pin, every var is 1, nothing moves.
 */

type Updater = () => void;
const updaters = new Set<Updater>();
let raf = 0;
const tick = () => {
  raf = 0;
  updaters.forEach((u) => u());
};
const onScroll = () => {
  if (!raf) raf = requestAnimationFrame(tick);
};
function subscribe(u: Updater) {
  if (updaters.size === 0) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }
  updaters.add(u);
  return () => {
    updaters.delete(u);
    if (updaters.size === 0) {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }
  };
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const r3 = (n: number) => String(Math.round(n * 1000) / 1000);

interface Item {
  el: HTMLElement;
  top: number;
  from: number;
  to: number;
  last: string;
}

export function useScrub<T extends HTMLElement>(scrub = 1) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const sec = ref.current;
    const inner = sec?.querySelector<HTMLElement>(".sc-stage-inner");
    if (!sec || !inner) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    let items: Item[] = [];
    let vh = 0;
    let overflow = 0;
    let positional = false;
    let lastP = "";
    let lastE = "";

    const topWithin = (el: HTMLElement) => {
      let y = 0;
      let n: HTMLElement | null = el;
      while (n && n !== inner) {
        y += n.offsetTop;
        n = n.offsetParent as HTMLElement | null;
      }
      return y;
    };

    const collect = () =>
      Array.from(sec.querySelectorAll<HTMLElement>("[data-scrub]")).map((el) => ({
        el,
        top: topWithin(el),
        from: Number(el.dataset.from ?? 0),
        to: Number(el.dataset.to ?? 1),
        last: "",
      }));

    const setStatic = () => {
      sec.style.height = "";
      delete sec.dataset.positional;
      inner.style.transform = "";
      sec.style.setProperty("--p", "1");
      sec.style.setProperty("--enter", "1");
      sec.dataset.rained = "";
      collect().forEach((it) => it.el.style.setProperty("--t", "1"));
      items = [];
    };

    const update = () => {
      if (mq.matches || !vh) return;
      const rect = sec.getBoundingClientRect();
      const dist = Math.max(1, rect.height - vh);
      const p = clamp01(-rect.top / dist);
      const enter = clamp01(1 - rect.top / vh);
      const ty = -overflow * p;
      // virtual progress: runs -0.35..0 while the section rises into view, then follows p,
      // so a data-from below 0 starts playing before the pin
      const pv = rect.top > 0 ? (enter - 1) * 0.35 : p;
      // where the stage's top edge is on screen right now
      const stageTop = rect.top > 0 ? rect.top : Math.min(0, rect.bottom - vh);

      const ps = r3(p);
      if (ps !== lastP) {
        lastP = ps;
        sec.style.setProperty("--p", ps);
        inner.style.transform = overflow ? `translate3d(0, ${ty.toFixed(1)}px, 0)` : "";
      }
      const es = r3(enter);
      if (es !== lastE) {
        lastE = es;
        sec.style.setProperty("--enter", es);
        if (enter >= 1) sec.dataset.rained = "";
        else delete sec.dataset.rained;
      }

      for (const it of items) {
        const onScreen = stageTop + it.top + ty;
        // positional mode: play as the element rises through the lower part of the screen;
        // phase mode: only a gate, so nothing finishes while it is still below the fold
        // (the last elements never rise far, so their ramp is shortened to finish at p = 1)
        const pos = positional
          ? clamp01((vh * 0.92 - onScreen) / Math.max(40, Math.min(vh * 0.38, vh * 0.92 - (it.top - overflow))))
          : clamp01((vh * 0.98 - onScreen) / (vh * 0.12));
        const phase = clamp01((pv - it.from) / Math.max(0.001, it.to - it.from));
        const t = positional ? pos : Math.min(phase, pos);
        const ts = r3(t);
        if (ts !== it.last) {
          it.last = ts;
          it.el.style.setProperty("--t", ts);
        }
      }
    };

    const measure = () => {
      if (mq.matches) {
        setStatic();
        return;
      }
      vh = window.innerHeight;
      sec.style.setProperty("--vh", `${vh}px`);
      overflow = Math.max(0, inner.offsetHeight - vh);
      positional = overflow > vh * 0.6;
      if (positional) sec.dataset.positional = "";
      else delete sec.dataset.positional;
      sec.style.height = `${Math.round(vh + overflow + vh * scrub)}px`;
      items = collect();
      lastP = lastE = "";
      update();
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(inner);
    const unsub = subscribe(update);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      unsub();
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", measure);
    };
  }, [scrub]);

  return ref;
}
