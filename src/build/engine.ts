/**
 * Build engine: the page assembles itself as you reach it, as if a crew of AI agents were
 * building it live in a design tool (after reel DfMhyC7Ma31).
 *
 * Builds are ONE-SHOT and TIME-BASED (Gabe, 2 Nov 2026: "the mouses finish that part
 * completely and when done it should all be there"). An element joins the build queue when
 * it scrolls into view; the crew completes it in ~1.5 s, then moves to the next. Once built
 * it stays built. Scroll fast and the crew speeds up; anything scrolled past is completed.
 *
 * Mark any element with data-build="<kind>":
 *   text   a cursor drags out a text box, then the crew types the line in (clip, left to right)
 *   media  the crew pulls a placeholder out by its corner, clicks, an upload bar fills, the
 *          real image/video appears
 *   box    the crew grabs the element and drags it into place from off to the side, drops it
 *          (click ripple), then its selection box and size chip fade
 *   fade   fades up, no chrome
 * Options:
 *   data-delay="0.1"   scroll: orders the queue (later = built later); load: start time in seconds
 *   data-dur="1.6"     scroll: build duration in seconds (default by kind)
 *   data-span="1.4"    load: build duration in seconds
 *   data-mode="load"   build on page load instead of when reached (the hero)
 *   data-from="left"   where a box is dragged in from: left | right | below (default alternates)
 *   data-orbit         when finished and on screen, the swarm circles it
 *   data-label="..."   text for the size chip instead of W × H
 *
 * The engine writes two variables per element, quantized and only when they change
 * (they only ever rise):
 *   --e  overall build progress 0..1
 *   --m  the kind's own motion: typing progress (text), drag-in progress (box), fill (media)
 * Elements read them in CSS (build.css). Box elements also get a fixed --dx/--dy/--dr
 * start offset at scan time. One fixed overlay canvas draws the tool chrome and the swarm.
 * The loop stops when nothing is building and the swarm has left.
 */

export type Kind = "text" | "media" | "box" | "fade";

interface Item {
  el: HTMLElement;
  kind: Kind;
  mode: "scroll" | "load";
  delay: number;
  span: number;
  orbit: boolean;
  label: string | null;
  e: number;
  m: number;
  state: "idle" | "queued" | "building" | "done";
  dur: number;
  order: number;
  shownE: number;
  shownM: number;
  r: { x: number; y: number; w: number; h: number; vis: boolean };
}

interface Cursor {
  x: number; y: number; vx: number; vy: number;
  color: string; seed: number;
  tx: number; ty: number; press: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const TRIGGER = 0.86;      // an element joins the queue when its top passes 86% of the viewport
const CONCURRENT = 2;      // the crew works on at most two elements at a time
const DUR: Record<Kind, number> = { text: 1.5, box: 1.6, media: 1.9, fade: 0.7 };
const CHROME = "#5BE3A0";  // tool chrome in the page's mint green
const CHROME_SOFT = "rgba(91,227,160,0.30)";
const MARQUEE_FILL = "rgba(91,227,160,0.08)";
const PLACEHOLDER = "rgba(28,52,42,0.94)";

// phase boundaries (in e) per kind
const TEXT_BOX = 0.16, TEXT_END = 0.86;           // text: box drawn, then typed
const BOX_GRAB = 0.1, BOX_DROP = 0.72;            // box: marquee, carried in, settle
const MEDIA_PULL = 0.42, MEDIA_FILL = 0.74;       // media: pulled out, uploaded

export class BuildEngine {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private items: Item[] = [];
  private cursors: Cursor[] = [];
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private w = 0;
  private h = 0;
  private raf = 0;
  private t0 = performance.now();
  private last = performance.now();
  private calm = 0;
  private swarmAlpha = 0;
  private started = false;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private onScroll = () => this.wake();
  private onResize = () => { this.size(); this.wake(); };

  constructor(canvas: HTMLCanvasElement, palette: string[]) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d")!;
    const n = matchMedia("(pointer: coarse)").matches ? 14 : 24;
    for (let i = 0; i < n; i++) {
      this.cursors.push({
        x: innerWidth + 40 + Math.random() * 200, y: innerHeight * (0.1 + Math.random() * 0.8),
        vx: 0, vy: 0, color: palette[i % palette.length], seed: Math.random() * 100,
        tx: 0, ty: 0, press: 0,
      });
    }
    this.size();
    addEventListener("scroll", this.onScroll, { passive: true });
    addEventListener("resize", this.onResize);
  }
  /** Find every [data-build] element under root. Call after mount and when content changes. */
  scan(root: ParentNode = document) {
    let boxN = 0;
    const prev = new Map(this.items.map((it) => [it.el, it]));
    this.items = Array.from(root.querySelectorAll<HTMLElement>("[data-build]")).map((el) => {
      const kind = (el.dataset.build as Kind) || "fade";
      if (kind === "box") {
        // a fixed start offset per element: where the crew drags it in from
        const from = el.dataset.from || (boxN % 2 ? "right" : "left");
        const k = 0.6 + ((boxN * 37) % 10) / 25;
        boxN++;
        const dx = from === "left" ? -180 * k : from === "right" ? 180 * k : 0;
        const dy = from === "below" ? 160 * k : 60 * k;
        el.style.setProperty("--dx", `${dx.toFixed(0)}px`);
        el.style.setProperty("--dy", `${dy.toFixed(0)}px`);
        el.style.setProperty("--dr", `${from === "left" ? -3 : from === "right" ? 3 : 1.5}deg`);
      }
      const old = prev.get(el);
      if (old) return old; // a rescan never restarts or rewinds a build
      return {
        el, kind,
        mode: el.dataset.mode === "load" ? "load" : "scroll",
        delay: parseFloat(el.dataset.delay || "0"),
        span: parseFloat(el.dataset.span || "1.4"),
        orbit: el.hasAttribute("data-orbit"),
        label: el.dataset.label || null,
        e: 0, m: 0, state: "idle", order: 0,
        dur: parseFloat(el.dataset.dur || "") || DUR[kind] + (kind === "text" ? Math.min(0.8, (el.textContent || "").length * 0.02) : 0),
        shownE: -1, shownM: -1,
        r: { x: 0, y: 0, w: 0, h: 0, vis: false },
      } as Item;
    });
    if (this.reduced) {
      for (const it of this.items) { it.el.style.setProperty("--e", "1"); it.el.style.setProperty("--m", "1"); }
      return;
    }
    // the load clock starts once; a rescan (fonts, late content) must not restart the hero
    this.started ||= (this.t0 = performance.now(), true);
    this.wake();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    removeEventListener("scroll", this.onScroll);
    removeEventListener("resize", this.onResize);
  }

  private size() {
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private wake() {
    if (this.reduced || this.raf) return;
    this.calm = 0;
    this.last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      const busy = this.frame(now, dt);
      this.calm = busy ? 0 : this.calm + dt;
      if (this.calm > 1.6) { this.raf = 0; this.g.clearRect(0, 0, this.w, this.h); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** The kind's own motion variable from overall progress. */
  private motion(kind: Kind, e: number) {
    if (kind === "text") return seg(e, TEXT_BOX, TEXT_END);
    if (kind === "box") return easeOut(seg(e, BOX_GRAB, BOX_DROP));
    if (kind === "media") return seg(e, MEDIA_PULL + 0.12, MEDIA_FILL);
    return e;
  }

  /** One frame. Returns true while anything is still moving. */
  private frame(now: number, dt: number): boolean {
    const vh = this.h;
    const tSec = (now - this.t0) / 1000;
    const atBottom = document.documentElement.scrollHeight - vh - scrollY < 4;
    // ---- read phase: rects for everything not yet built ----
    for (const it of this.items) {
      if (it.state === "done") continue;
      const b = it.el.getBoundingClientRect();
      it.r.x = b.left; it.r.y = b.top; it.r.w = b.width; it.r.h = b.height;
      it.r.vis = b.bottom > -60 && b.top < vh + 60 && b.width > 0;
    }
    // ---- schedule ----
    const queue: Item[] = [];
    for (const it of this.items) {
      if (it.state === "done") continue;
      if (it.mode === "load") {
        if (tSec >= it.delay) { it.state = "building"; it.e = clamp01((tSec - it.delay) / it.span); }
      } else {
        if (it.r.y + it.r.h < -20) { it.e = 1; }                       // scrolled past: complete it
        else if (it.state === "idle" && it.r.w > 0 && (it.r.y < vh * TRIGGER || (atBottom && it.r.vis))) {
          it.state = "queued";
          it.order = it.r.y + scrollY + it.delay * vh + it.r.x * 0.01;
        }
        if (it.state === "queued" || it.state === "building") queue.push(it);
      }
      if (it.e >= 1) { it.e = 1; it.state = "done"; }
    }
    queue.sort((p, q) => p.order - q.order);
    // fades don't need the crew; everything else is worked CONCURRENT at a time, in order.
    // A long queue (fast scrolling) speeds the crew up so it catches up.
    const speed = 1 + Math.max(0, queue.length - CONCURRENT) * 0.45;
    let slots = CONCURRENT;
    for (const it of queue) {
      if (it.state === "done") continue;
      if (it.kind === "fade" || slots > 0) {
        if (it.kind !== "fade") slots--;
        it.state = "building";
        it.e = Math.min(1, it.e + (dt / it.dur) * speed);
        if (it.e >= 1) it.state = "done";
      }
    }
    // ---- write phase ----
    let building = 0;
    for (const it of this.items) {
      it.m = this.motion(it.kind, it.e);
      const qe = Math.round(it.e * 50) / 50, qm = Math.round(it.m * 100) / 100;
      if (qe !== it.shownE) { it.shownE = qe; it.el.style.setProperty("--e", String(qe)); }
      if (qm !== it.shownM) { it.shownM = qm; it.el.style.setProperty("--m", String(qm)); }
      if (it.state === "building" || it.state === "queued") building++;
    }
    // the finale needs a live rect even when built
    const orbiting: Item[] = [];
    for (const it of this.items) {
      if (!it.orbit || it.state !== "done") continue;
      const b = it.el.getBoundingClientRect();
      it.r.x = b.left; it.r.y = b.top; it.r.w = b.width; it.r.h = b.height;
      if (b.bottom > 0 && b.top < vh) orbiting.push(it);
    }

    // ---- draw ----
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    const active = this.items.filter((it) => it.state === "building" && it.r.vis && it.kind !== "fade");
    if (active.length) this.drawRulers(active);
    for (const it of active) this.drawItem(it);

    const wantSwarm = active.length > 0 || orbiting.length > 0;
    this.swarmAlpha += ((wantSwarm ? 1 : 0) - this.swarmAlpha) * Math.min(1, dt * (wantSwarm ? 5 : 1.2));
    const moving = this.swarm(active, orbiting, tSec, dt);
    return building > 0 || orbiting.length > 0 || this.swarmAlpha > 0.02 || moving;
  }

  private drawRulers(active: Item[]) {
    const g = this.g, W = this.w, H = this.h, R = 18;
    g.fillStyle = "rgba(4,10,7,0.88)";
    g.fillRect(0, 0, W, R);
    g.fillRect(0, 0, R, H);
    g.strokeStyle = "rgba(220,245,230,0.18)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = R; x < W; x += 10) { const big = x % 100 < 10; g.moveTo(x + 0.5, big ? 6 : 12); g.lineTo(x + 0.5, R); }
    const off = scrollY % 10;
    for (let y = R - off; y < H; y += 10) { const big = Math.round(y + scrollY) % 100 < 10; g.moveTo(big ? 6 : 12, y + 0.5); g.lineTo(R, y + 0.5); }
    g.stroke();
    g.fillStyle = "rgba(220,245,230,0.45)";
    g.font = "9px JetBrains Mono, monospace";
    for (let x = 100; x < W; x += 100) g.fillText(String(x), x + 3, 9);
    g.fillStyle = CHROME_SOFT;
    for (const it of active) {
      g.fillRect(Math.max(R, it.r.x), 0, it.r.w, R);
      g.fillRect(0, Math.max(R, it.r.y), R, it.r.h);
    }
  }

  /** The tool chrome for one element, by kind and phase. */
  private drawItem(it: Item) {
    const g = this.g, { x, y, w, h } = it.r, e = it.e;
    const a = Math.min(1, e * 8, (1 - e) * 6);
    g.globalAlpha = a;
    g.lineWidth = 1;
    // guides out to the rulers
    g.strokeStyle = CHROME_SOFT;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(x + 0.5, 18); g.lineTo(x + 0.5, y);
    g.moveTo(18, y + 0.5); g.lineTo(x, y + 0.5);
    g.stroke();
    // text box / landing marquee being dragged out (dashed)
    const marquee = it.kind === "text" ? seg(e, 0, TEXT_BOX) : it.kind === "box" ? seg(e, 0, BOX_GRAB) : 1;
    if (marquee < 1 || (it.kind === "text" && e < TEXT_BOX + 0.04) || (it.kind === "box" && e < BOX_GRAB + 0.06)) {
      const d = easeOut(marquee);
      // for a box the marquee marks where it will land: its rect minus the current drag offset
      const ox = it.kind === "box" ? -this.offset(it).x : 0, oy = it.kind === "box" ? -this.offset(it).y : 0;
      g.fillStyle = MARQUEE_FILL;
      g.fillRect(x + ox, y + oy, w * d, h * d);
      g.strokeStyle = CHROME;
      g.strokeRect(x + ox + 0.5, y + oy + 0.5, w * d, h * d);
    }
    g.setLineDash([]);

    if (it.kind === "media") {
      const d = easeOut(seg(e, 0, MEDIA_PULL));
      const fill = seg(e, MEDIA_PULL, MEDIA_FILL);
      g.globalAlpha = a * (1 - seg(e, MEDIA_FILL - 0.08, MEDIA_FILL + 0.06));
      g.fillStyle = PLACEHOLDER;
      g.fillRect(x, y, w * d, h * d);
      g.strokeStyle = "rgba(220,245,230,0.10)";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * d, y + h * d); g.moveTo(x + w * d, y); g.lineTo(x, y + h * d); g.stroke();
      if (fill > 0) {
        // upload bar along the bottom of the placeholder
        g.fillStyle = "rgba(4,10,7,0.8)";
        g.fillRect(x + 14, y + h - 22, w - 28, 6);
        g.fillStyle = CHROME;
        g.fillRect(x + 14, y + h - 22, (w - 28) * fill, 6);
        g.font = "10px JetBrains Mono, monospace";
        g.fillText(`uploading ${Math.round(fill * 100)}%`, x + 14, y + h - 30);
      }
      g.globalAlpha = a;
    }

    // drop ripple (box) / release click (media), drawn from progress so it rewinds too
    const ripT = it.kind === "box" ? seg(e, BOX_DROP - 0.01, BOX_DROP + 0.12) : it.kind === "media" ? seg(e, MEDIA_PULL, MEDIA_PULL + 0.12) : 0;
    if (ripT > 0 && ripT < 1) {
      const cx = it.kind === "box" ? x + w / 2 : x + w, cy = it.kind === "box" ? y : y + h;
      g.strokeStyle = CHROME;
      g.globalAlpha = a * (1 - ripT);
      for (const k of [1, 0.6]) { g.beginPath(); g.arc(cx, cy, 6 + ripT * 34 * k, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = a;
    }

    // selection box + handles + size chip (once the element is placed/being typed)
    const showSel = it.kind === "text" ? e > TEXT_BOX : it.kind === "box" ? e > BOX_DROP - 0.02 : true;
    if (showSel) {
      g.strokeStyle = CHROME;
      g.strokeRect(x + 0.5, y + 0.5, w, h);
      g.fillStyle = "#EEF5F0";
      for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        g.fillRect(hx - 3, hy - 3, 6, 6);
        g.strokeRect(hx - 2.5, hy - 2.5, 6, 6);
      }
      const label = it.label ?? `${Math.round(w)} × ${Math.round(h)}`;
      g.font = "10px JetBrains Mono, monospace";
      const tw = g.measureText(label).width + 10;
      const cx = x + w / 2 - tw / 2, cy = y + h + 6;
      g.fillStyle = CHROME;
      g.fillRect(cx, cy, tw, 15);
      g.fillStyle = "#04130B";
      g.fillText(label, cx + 5, cy + 11);
    }
    // typing caret
    if (it.kind === "text" && e > TEXT_BOX && e < TEXT_END) {
      const cxp = x + w * it.m;
      g.strokeStyle = "#EEF5F0";
      g.beginPath(); g.moveTo(cxp, y - 2); g.lineTo(cxp, y + h + 2);
      g.moveTo(cxp - 3, y - 2); g.lineTo(cxp + 3, y - 2); g.moveTo(cxp - 3, y + h + 2); g.lineTo(cxp + 3, y + h + 2); g.stroke();
    }
    g.globalAlpha = 1;
  }

  /** A box's current drag offset in px (matches the CSS: (1 - --m) × --dx/--dy). */
  private offset(it: Item) {
    const dx = parseFloat(it.el.style.getPropertyValue("--dx")) || 0;
    const dy = parseFloat(it.el.style.getPropertyValue("--dy")) || 0;
    return { x: (1 - it.m) * dx, y: (1 - it.m) * dy };
  }

  /**
   * The whole crew works: every cursor takes a job on whatever is being built, shared
   * evenly. The job depends on the element's phase: dragging out a box, gripping and
   * carrying, typing, pulling a corner, waiting on an upload. Cursors press (shrink) while
   * they hold something. No idlers: with nothing to build they leave the screen.
   */
  private swarm(active: Item[], orbiting: Item[], t: number, dt: number): boolean {
    const C = this.cursors, crewC = C, n = C.length;
    if (active.length) {
      const per = n / active.length;
      crewC.forEach((c, i) => {
        const idx = Math.min(active.length - 1, Math.floor(i / per));
        const it = active[idx];
        const j = i - Math.ceil(idx * per);                 // position within this crew
        const crew = Math.max(1, Math.ceil((idx + 1) * per) - Math.ceil(idx * per));
        const k = crew > 1 ? Math.max(0, j) / (crew - 1) : 0;
        const { x, y, w, h } = it.r, e = it.e;
        const wob = Math.sin(t * 1.7 + c.seed) * 3, wob2 = Math.cos(t * 1.5 + c.seed * 1.3) * 3;
        let press = 0;
        if (it.kind === "text") {
          if (e < TEXT_BOX) {
            const d = easeOut(seg(e, 0, TEXT_BOX));
            if (j <= 0) { c.tx = x + w * d; c.ty = y + h * d; press = 1; }       // the one drawing the box
            else { c.tx = x + w * d * k + wob * 3; c.ty = y - 26 - k * 10 + wob2; }
          } else {
            // the crew crowds the typing line; a couple lag behind, tidying
            const cx = x + w * it.m;
            const lag = k > 0.7 ? (k - 0.7) * 300 : 0;
            c.tx = cx - lag + wob * 0.4;
            c.ty = y + h * (0.2 + 0.6 * ((c.seed * 0.37) % 1)) + wob2;
            press = e < TEXT_END && Math.sin(t * 9 + c.seed * 5) > 0.2 ? 1 : 0; // key taps
          }
        } else if (it.kind === "box") {
          if (e < BOX_GRAB) {
            const d = easeOut(seg(e, 0, BOX_GRAB));
            const o = this.offset(it);
            if (j <= 0) { c.tx = x - o.x + w * d; c.ty = y - o.y + h * d; press = 1; }
            else { c.tx = x + w * (0.2 + 0.6 * k) + wob * 4; c.ty = y + 6 + wob2; }
          } else if (e < BOX_DROP + 0.03) {
            // gripping the top edge and carrying it in (the rect already includes the motion)
            c.tx = x + w * (0.15 + 0.7 * k) + wob * 0.3;
            c.ty = y + 6 + wob2 * 0.3;
            press = e < BOX_DROP ? 1 : 0;
          } else {
            // let go: step back and inspect, drifting along the outline
            const u = (k + t * 0.06) % 1, perim = 2 * (w + h), d = u * perim;
            if (d < w) { c.tx = x + d; c.ty = y - 14; }
            else if (d < w + h) { c.tx = x + w + 14; c.ty = y + (d - w); }
            else if (d < 2 * w + h) { c.tx = x + w - (d - w - h); c.ty = y + h + 14; }
            else { c.tx = x - 14; c.ty = y + h - (d - 2 * w - h); }
          }
        } else {
          // media: pull the corner out together, then wait on the upload
          const d = easeOut(seg(e, 0, MEDIA_PULL));
          if (e < MEDIA_PULL) {
            const right = x + w * d, bottom = y + h * d;
            if (k < 0.5) { c.tx = right + wob; c.ty = y + h * d * (0.3 + k * 1.4) + wob2; }
            else { c.tx = x + w * d * (0.3 + (k - 0.5) * 1.4) + wob; c.ty = bottom + wob2; }
            press = 1;
          } else {
            const f = seg(e, MEDIA_PULL, MEDIA_FILL);
            c.tx = x + 14 + (w - 28) * clamp01(f + (k - 0.5) * 0.25) + wob;
            c.ty = y + h - 30 - k * 24 + wob2;
          }
        }
        c.press += (press - c.press) * Math.min(1, dt * 14);
      });
    } else if (orbiting.length) {
      const o = orbiting[0].r;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, R = Math.max(o.w, o.h) * 0.62 + 20;
      crewC.forEach((c, i) => {
        const ang = t * 0.55 + (i / n) * Math.PI * 2;
        c.tx = cx + Math.cos(ang) * R; c.ty = cy + Math.sin(ang) * R * 0.8;
        c.press += (0 - c.press) * Math.min(1, dt * 10);
      });
    } else {
      crewC.forEach((c) => { c.tx = this.w + 60; c.ty = c.y; c.press = 0; });
    }

    let moving = false;
    const g = this.g;
    for (const c of C) {
      // critically damped spring: glides to the job, no overshoot, no jitter
      const w = 9;
      c.vx += ((c.tx - c.x) * w * w - 2 * w * c.vx) * dt;
      c.vy += ((c.ty - c.y) * w * w - 2 * w * c.vy) * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (Math.abs(c.vx) + Math.abs(c.vy) > 4) moving = true;
      if (this.swarmAlpha > 0.01 && c.x < this.w + 20) {
        g.globalAlpha = this.swarmAlpha;
        this.drawCursor(c);
      }
    }
    g.globalAlpha = 1;
    return moving;
  }

  private drawCursor(c: Cursor) {
    const g = this.g;
    const s = 1 - c.press * 0.16; // pressed: the cursor shrinks a touch
    g.save();
    g.translate(c.x, c.y);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(0, 15); g.lineTo(4, 11); g.lineTo(7, 17);
    g.lineTo(9.5, 16); g.lineTo(6.5, 10); g.lineTo(11, 10); g.closePath();
    g.fillStyle = c.color; g.fill();
    g.strokeStyle = "#04130B"; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }
}
