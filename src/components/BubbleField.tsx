import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A cluster of bubbles with physics.
 *
 * The flex-wrap version was a grid pretending to be loose: rows, gutters, a
 * ragged right edge. This is the thing it was pretending to be. Every bubble is
 * a body — it falls toward a point in the middle of the band, collides with its
 * neighbours instead of overlapping them, gets shoved aside by the cursor, and
 * never quite stops moving.
 *
 * Two passes, and the order matters. Pass one renders the real flex-wrap list
 * so the browser measures each pill at its intrinsic width; pass two pins those
 * measurements and hands the positions to the solver. Measuring after going
 * absolute gives you shrink-to-fit against a different containing block, which
 * is how you end up with pills a few pixels narrower than they render.
 *
 * Separation is rectangle-vs-rectangle along the axis of least overlap, not
 * circle-vs-circle. A 160px pill inside its bounding circle leaves a hole the
 * size of another pill on each side, and the cluster reads as a loose spray
 * rather than something packed.
 *
 * Under prefers-reduced-motion the whole file is inert: pass one is the render.
 */

/** breathing room baked into every body's collision box */
const GAP = 11;
/** how hard the middle pulls, per frame */
const K_IN = 0.0026;
/**
 * The pull is stronger vertically, so the blob settles wide instead of round.
 * At 3.1 it was strong enough to squeeze a ten-pill group into a single row
 * wider than the container, and the walls then forced the pills through each
 * other. 1.7 flattens the cluster without pressing it into its own walls,
 * which is where the separation pass stops converging.
 */
const K_Y = 1.7;
/** frames of extra pull at the start — this is the "rush" */
const BOOST_MS = 1150;
const CURSOR_R = 132;
/**
 * Relaxation passes. 6 still left one pill penetrating in a confined group —
 * separating one pair pushes into the next, and the cycle needs iterations to
 * unwind. 27 bodies is 351 pairs, so even 10 is nothing.
 */
const ITER = 10;
/**
 * Below this the cluster stops being worth it: a phone has no cursor, so half
 * the interaction is gone, and 27 pills two-to-a-row need a metre of scroll to
 * jostle in. Narrow screens keep the flex-wrap render.
 */
const MIN_W = 620;

interface Body {
  el: HTMLLIElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  /** inverse mass — wide pills shove narrow ones */
  im: number;
  phase: number;
  hover: number;
}

export default function BubbleField({
  children,
  bias = 0,
  className = "",
}: {
  children: ReactNode[];
  /**
   * Nudges the attractor off centre, as a fraction of the field's width.
   * Five clusters all centred on the same axis read as five instances of one
   * component; alternating the point they fall toward reads as a composition.
   */
  bias?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLUListElement>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const cursorRef = useRef<{ x: number; y: number; on: boolean }>({ x: 0, y: 0, on: false });
  const lastWidth = useRef(0);

  const count = children.length;

  /* ---- pass one: measure ------------------------------------------------ */
  useLayoutEffect(() => {
    if (reduced) return;
    const ul = wrapRef.current;
    if (!ul) return;

    const measure = () => {
      const items = Array.from(ul.children) as HTMLLIElement[];
      if (!items.length) return;
      const next = items.map((li) => {
        const r = li.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      const ur = ul.getBoundingClientRect();
      const W = ur.width;
      // The flow height IS the honest answer to "how much room do these need" —
      // it is the browser's own wrap, at this exact width, with these exact
      // pills. Deriving the box from total area instead needed a clamp, and the
      // clamp is what saturated the dense groups on narrow screens.
      // 1.65 left the 27-pill group with 11px of total slack — pressed against
      // both walls, which is exactly where the solver loses a pill.
      const H = Math.max(200, Math.round(ur.height * 1.88));
      lastWidth.current = Math.round(W);
      setSizes(next);
      setBox({ w: W, h: H });
    };

    // measure only while the flex-wrap pass is on screen
    if (!sizes) measure();

    // Width only. Pass two sets an explicit height on this very element, so a
    // naive observer re-measures on its own output and never settles.
    let t: number | undefined;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (Math.abs(w - lastWidth.current) < 2) return;
      lastWidth.current = w;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        setSizes(null);
        setBox(null);
      }, 180);
    });
    ro.observe(ul);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [reduced, count, sizes]);

  /* ---- pass two: simulate ----------------------------------------------- */
  useEffect(() => {
    if (reduced || !sizes || !box || box.w < MIN_W) return;
    const ul = wrapRef.current;
    if (!ul) return;

    const items = Array.from(ul.children) as HTMLLIElement[];
    const cx = box.w * (0.5 + bias);
    const cy = box.h / 2;

    const bodies: Body[] = items.map((el, i) => {
      const m = sizes[i] ?? { w: 90, h: 34 };
      // start on an ellipse just inside the walls, so the rush inward happens
      // entirely on screen instead of half of it arriving from off-frame
      const a = (i / Math.max(count, 1)) * Math.PI * 2 + (i % 3) * 0.37;
      // distance to the NEARER wall, or a biased attractor throws half the ring
      // outside the box before the first frame
      const rx = Math.max(0, Math.min(cx, box.w - cx) - m.w / 2 - 2);
      const ry = Math.max(0, cy - m.h / 2 - 2);
      return {
        el,
        x: cx + Math.cos(a) * rx * 0.94,
        y: cy + Math.sin(a) * ry * 0.94,
        vx: 0,
        vy: 0,
        w: m.w + GAP,
        h: m.h + GAP,
        im: 1 / Math.max(1, (m.w * m.h) / 3400),
        phase: (i * 2.399) % (Math.PI * 2),
        hover: 0,
      };
    });
    const place = (b: Body) => {
      b.el.style.transform = `translate3d(${(b.x - b.w / 2 + GAP / 2).toFixed(2)}px, ${(
        b.y -
        b.h / 2 +
        GAP / 2
      ).toFixed(2)}px, 0)`;
    };
    bodies.forEach(place);

    const onEnter = (i: number) => () => {
      const b = bodies[i];
      if (b) b.hover = 1;
    };
    const onLeave = (i: number) => () => {
      const b = bodies[i];
      if (b) b.hover = 0;
    };
    const enters = items.map((el, i) => {
      const a = onEnter(i);
      const l = onLeave(i);
      el.addEventListener("pointerenter", a);
      el.addEventListener("pointerleave", l);
      return () => {
        el.removeEventListener("pointerenter", a);
        el.removeEventListener("pointerleave", l);
      };
    });

    const onMove = (e: PointerEvent | MouseEvent) => {
      const r = ul.getBoundingClientRect();
      cursorRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, on: true };
    };
    const onOut = () => {
      cursorRef.current.on = false;
    };
    ul.addEventListener("pointermove", onMove);
    ul.addEventListener("mousemove", onMove as EventListener);
    ul.addEventListener("pointerleave", onOut);

    let raf = 0;
    let running = false;
    let start = 0;

    const step = (now: number) => {
      if (!start) start = now;
      const boost = Math.max(0, 1 - (now - start) / BOOST_MS);
      const ease = boost * boost;
      const k = K_IN * (1 + ease * 3.4);
      const damp = 0.885 + (1 - ease) * 0.022;
      const t = now * 0.001;
      const cur = cursorRef.current;

      for (const b of bodies) {
        b.vx += (cx - b.x) * k;
        b.vy += (cy - b.y) * k * K_Y;
        // never entirely still — a frozen cluster stops reading as physical
        b.vx += Math.sin(t * 0.62 + b.phase) * 0.019;
        b.vy += Math.cos(t * 0.51 + b.phase * 1.3) * 0.013;

        if (cur.on) {
          const dx = b.x - cur.x;
          const dy = b.y - cur.y;
          const d = Math.hypot(dx, dy);
          if (d < CURSOR_R && d > 0.01) {
            const f = (1 - d / CURSOR_R) ** 2 * 2.7 * b.im;
            b.vx += (dx / d) * f;
            b.vy += (dy / d) * f;
          }
        }

        b.vx *= damp;
        b.vy *= damp;
        b.x += b.vx;
        b.y += b.vy;
      }

      for (let it = 0; it < ITER; it++) {
        for (let i = 0; i < bodies.length; i++) {
          const a = bodies[i];
          const aw = a.w / 2 + a.hover * 5;
          const ah = a.h / 2 + a.hover * 3;
          for (let j = i + 1; j < bodies.length; j++) {
            const b = bodies[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const ox = aw + b.w / 2 + b.hover * 5 - Math.abs(dx);
            if (ox <= 0) continue;
            const oy = ah + b.h / 2 + b.hover * 3 - Math.abs(dy);
            if (oy <= 0) continue;

            const tot = a.im + b.im;
            if (ox < oy) {
              const s = (dx < 0 ? -ox : ox) * 0.5;
              a.x -= (s * a.im * 2) / tot;
              b.x += (s * b.im * 2) / tot;
            } else {
              const s = (dy < 0 ? -oy : oy) * 0.5;
              a.y -= (s * a.im * 2) / tot;
              b.y += (s * b.im * 2) / tot;
            }
          }
        }

        for (const b of bodies) {
          const hw = b.w / 2;
          const hh = b.h / 2;
          if (b.x < hw) {
            b.x = hw;
            if (b.vx < 0) b.vx *= -0.28;
          } else if (b.x > box.w - hw) {
            b.x = box.w - hw;
            if (b.vx > 0) b.vx *= -0.28;
          }
          if (b.y < hh) {
            b.y = hh;
            if (b.vy < 0) b.vy *= -0.28;
          } else if (b.y > box.h - hh) {
            b.y = box.h - hh;
            if (b.vy > 0) b.vy *= -0.28;
          }
        }
      }

      for (const b of bodies) place(b);
      raf = requestAnimationFrame(step);
    };

    // The starting ring is deliberately overlapped — 27 pills spaced around an
    // ellipse have to be — so the field stays invisible until the solver takes
    // over. Without this you catch a stack of pills sitting on top of each
    // other for the frame before the rush begins.
    ul.style.opacity = "0";
    ul.style.transition = "opacity 620ms cubic-bezier(0.22,1,0.36,1)";

    // only burn frames while the cluster is actually on screen
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          ul.style.opacity = "1";
          raf = requestAnimationFrame(step);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "120px 0px", threshold: 0 }
    );
    io.observe(ul);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      ul.style.opacity = "";
      ul.style.transition = "";
      ul.removeEventListener("pointermove", onMove);
      ul.removeEventListener("mousemove", onMove as EventListener);
      ul.removeEventListener("pointerleave", onOut);
      enters.forEach((off) => off());
    };
  }, [reduced, sizes, box, count, bias]);

  /* ---- render ------------------------------------------------------------ */
  const live = !reduced && !!sizes && !!box && box.w >= MIN_W;

  return (
    <ul
      ref={wrapRef}
      className={
        live
          ? `relative mt-6 w-full list-none ${className}`
          : `mt-6 flex flex-wrap gap-3 ${className}`
      }
      style={live ? { height: box!.h } : undefined}
    >
      {children.map((child, i) => (
        <li
          key={i}
          className={live ? "absolute left-0 top-0 will-change-transform" : undefined}
          style={live ? { width: sizes![i]?.w, height: sizes![i]?.h } : undefined}
        >
          {child}
        </li>
      ))}
    </ul>
  );
}
