/**
 * Build engine, v6 "simplify" (Gabe, 17 Nov 2026: love the live build, but the page is too
 * cluttered). The live build now happens in ONE place: the hero, on page load.
 *
 * HERO (data-mode="load"): a small named crew of four cursors (the AI tools Gabe builds with)
 * builds the hero in ~4.5 s. Each cursor has one job and flies in for it: one drags the
 * portrait in, one types the name, one types the line under it, one drops the links. The
 * rulers slide in while they work, each piece gets its selection box and size chip while it
 * is being built, a small build log (desktop) narrates who did what, and when the last piece
 * lands the page is "published": a light sweeps the ruler, the log ticks to Published, and all
 * of the chrome slides away. It plays once per page load.
 *
 * EVERYTHING ELSE (scroll mode) is quiet: no cursors, no chrome. An element simply rises and
 * fades in (~0.8 s) when it reaches the viewport, and stays.
 *
 * Mark any element with data-build="<kind>":
 *   text   load: a text box is dragged out, then typed in.   scroll: the words rise in
 *   media  load: a placeholder is pulled out, then uploaded. scroll: fades in
 *   box    load: grabbed and carried in from the side.      scroll: rises 24 px and fades in
 *   fade   fades up, no chrome
 * Options:
 *   data-mode="load"   hero: built by the crew on page load
 *   data-delay="0.1"   load: start time in seconds. scroll: small stagger (seconds × 2)
 *   data-span="1.4"    load: build duration in seconds
 *   data-dur="0.8"     scroll: reveal duration in seconds
 *   data-from="left"   load box: where it is carried in from (left | right | below)
 *   data-label="..."   size chip text instead of W × H
 *   data-log="..."     what the build log says this step did ("dropped in the portrait")
 *
 * Per element the engine writes --e (overall 0..1) and --m (the kind's own motion), quantized
 * and only when they change. One fixed overlay canvas draws the chrome and the crew; its loop
 * stops when nothing is moving.
 */

export type Kind = "text" | "media" | "box" | "fade";

interface Item {
  el: HTMLElement;
  kind: Kind;
  load: boolean;
  delay: number;
  span: number;
  dur: number;
  label: string | null;
  log: string;
  crew: number;          // index of the cursor that builds it (load items), else -1
  e: number;
  m: number;
  state: "idle" | "waiting" | "building" | "done";
  startAt: number;       // scroll: when the reveal starts (seconds on the engine clock)
  shownE: number;
  shownM: number;
  r: { x: number; y: number; w: number; h: number; vis: boolean };
}

export interface CrewMember { name: string; color: string }

interface Cursor extends CrewMember {
  x: number; y: number; vx: number; vy: number;
  tx: number; ty: number; press: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const TRIGGER = 0.9;           // scroll: reveal when the top passes 90% of the viewport
const QUIET_DUR: Record<Kind, number> = { text: 0.9, box: 0.8, media: 0.9, fade: 0.7 };
const RULER = 18;
const CHROME = "#5BE3A0";
const CHROME_SOFT = "rgba(91,227,160,0.30)";
const MARQUEE_FILL = "rgba(91,227,160,0.08)";
const PLACEHOLDER = "rgba(28,52,42,0.94)";
const INK = "#EEF5F0";
const MONO = "JetBrains Mono, ui-monospace, monospace";
const PUBLISH_HOLD = 1.5;      // seconds the "published" moment stays before the chrome leaves

// phase boundaries (in e) per kind, load builds
const TEXT_BOX = 0.16, TEXT_END = 0.88;
const BOX_GRAB = 0.12, BOX_DROP = 0.74;
const MEDIA_PULL = 0.42, MEDIA_FILL = 0.74;

export class BuildEngine {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private items: Item[] = [];
  private crew: Cursor[] = [];
  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private w = 0;
  private h = 0;
  private raf = 0;
  private t0 = performance.now();
  private last = performance.now();
  private calm = 0;
  private started = false;
  private chromeA = 0;           // rulers + log slide in/out together
  private publishedAt = -1;      // engine time the hero finished, -1 while building
  private root: ParentNode = document;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private onScroll = () => this.wake();
  private onResize = () => { this.size(); this.wake(); };

  constructor(canvas: HTMLCanvasElement, crew: CrewMember[]) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d")!;
    this.crew = crew.map((c, i) => ({ ...c, ...this.offstage(i), vx: 0, vy: 0, tx: 0, ty: 0, press: 0 }));
    this.size();
    addEventListener("scroll", this.onScroll, { passive: true });
    addEventListener("resize", this.onResize);
  }

  /** where a crew member waits off screen (bottom right, fanned out) */
  private offstage(i: number) {
    return { x: innerWidth + 40 + i * 30, y: innerHeight * (0.55 + i * 0.1) };
  }

  /** Find every [data-build] element under root. Call after mount and when content changes. */
  scan(root: ParentNode = this.root) {
    this.root = root;
    const prev = new Map(this.items.map((it) => [it.el, it]));
    this.items = Array.from(root.querySelectorAll<HTMLElement>("[data-build]")).map((el) => {
      const old = prev.get(el);
      if (old) return old; // a rescan never restarts a build
      const kind = (el.dataset.build as Kind) || "fade";
      const load = el.dataset.mode === "load";
      if (!load) {
        el.toggleAttribute("data-quiet", true);
      } else if (kind === "box") {
        // the fixed start offset the crew carries it in from
        const from = el.dataset.from || "left";
        el.style.setProperty("--dx", `${from === "left" ? -150 : from === "right" ? 150 : 0}px`);
        el.style.setProperty("--dy", `${from === "below" ? 120 : 50}px`);
        el.style.setProperty("--dr", `${from === "left" ? -3 : from === "right" ? 3 : 1.5}deg`);
      }
      const label = el.dataset.label || null;
      return {
        el, kind, load,
        delay: parseFloat(el.dataset.delay || "0"),
        span: parseFloat(el.dataset.span || "1.2"),
        dur: parseFloat(el.dataset.dur || "") || QUIET_DUR[kind],
        label,
        log: el.dataset.log || (kind === "text" ? `typed ${label ?? "text"}` : kind === "media" ? `uploaded ${label ?? "media"}` : `placed ${label ?? "a block"}`),
        crew: -1,
        e: 0, m: 0, state: "idle", startAt: 0, shownE: -1, shownM: -1,
        r: { x: 0, y: 0, w: 0, h: 0, vis: false },
      } as Item;
    });
    // the crew: one cursor per hero step, in start order
    this.items
      .filter((it) => it.load && it.kind !== "fade")
      .sort((a, b) => a.delay - b.delay)
      .forEach((it, i) => { it.crew = i % this.crew.length; });

    if (this.reduced) {
      for (const it of this.items) { it.el.style.setProperty("--e", "1"); it.el.style.setProperty("--m", "1"); it.state = "done"; }
      this.publishedAt = 0;
      return;
    }
    // the load clock starts once; a rescan (fonts, late content) must not restart the hero
    if (!this.started) { this.started = true; this.t0 = performance.now(); }
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
      if (this.calm > 0.6) { this.raf = 0; this.g.clearRect(0, 0, this.w, this.h); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** The kind's own motion variable from overall progress. */
  private motion(it: Item) {
    if (!it.load) return it.e;
    if (it.kind === "text") return seg(it.e, TEXT_BOX, TEXT_END);
    if (it.kind === "box") return easeOut(seg(it.e, BOX_GRAB, BOX_DROP));
    if (it.kind === "media") return seg(it.e, MEDIA_PULL + 0.12, MEDIA_FILL);
    return it.e;
  }

  /** One frame. Returns true while anything is still moving. */
  private frame(now: number, dt: number): boolean {
    const vh = this.h;
    const t = (now - this.t0) / 1000;
    const atBottom = document.documentElement.scrollHeight - vh - scrollY < 4;
    let busy = false;

    // ---- schedule ----
    for (const it of this.items) {
      if (it.state === "done") continue;
      const b = it.el.getBoundingClientRect();
      it.r.x = b.left; it.r.y = b.top; it.r.w = b.width; it.r.h = b.height;
      it.r.vis = b.bottom > -60 && b.top < vh + 60 && b.width > 0;
      if (it.load) {
        if (t >= it.delay) { it.state = "building"; it.e = clamp01((t - it.delay) / it.span); }
      } else if (it.state === "idle") {
        if (b.bottom < 0) { it.e = 1; }                                   // scrolled past: just show it
        // reveal when it crosses the trigger line, or when the page can't scroll any further
        // and it is on screen (the footer never reaches the line)
        else if (b.width > 0 && (b.top < vh * TRIGGER || (atBottom && b.top < vh))) { it.state = "waiting"; it.startAt = t + Math.min(it.delay * 2, 0.6); }
      } else {
        if (t >= it.startAt) { it.state = "building"; it.e = clamp01(it.e + dt / it.dur); }
      }
      if (it.e >= 1) { it.e = 1; it.state = "done"; }
      if (it.state !== "done") busy = true;
    }

    // ---- write ----
    for (const it of this.items) {
      it.m = this.motion(it);
      const qe = Math.round(it.e * 60) / 60, qm = Math.round(it.m * 100) / 100;
      if (qe !== it.shownE) { it.shownE = qe; it.el.style.setProperty("--e", String(qe)); }
      if (qm !== it.shownM) { it.shownM = qm; it.el.style.setProperty("--m", String(qm)); }
    }

    // ---- the hero's published moment ----
    const hero = this.items.filter((it) => it.load);
    const heroDone = hero.length > 0 && hero.every((it) => it.state === "done");
    if (heroDone && this.publishedAt < 0) this.publishedAt = t;
    const sincePub = this.publishedAt < 0 ? -1 : t - this.publishedAt;
    const wantChrome = hero.length > 0 && (!heroDone || sincePub < PUBLISH_HOLD) && scrollY < vh * 0.6;
    this.chromeA += ((wantChrome ? 1 : 0) - this.chromeA) * Math.min(1, dt * (wantChrome ? 6 : 3.5));
    if (Math.abs(this.chromeA - (wantChrome ? 1 : 0)) > 0.01) busy = true;
    if (sincePub >= 0 && sincePub < PUBLISH_HOLD + 0.2) busy = true;

    // ---- draw ----
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    const active = hero.filter((it) => it.state === "building" && it.r.vis && it.kind !== "fade");
    if (this.chromeA > 0.01) this.drawRulers(active, sincePub);
    for (const it of active) this.drawItem(it);
    if (this.chromeA > 0.01 && this.w >= 900) this.drawLog(hero, t, sincePub);
    const moving = this.moveCrew(hero, t, dt);
    return busy || moving;
  }

  /** Rulers slide in from the edges while the crew works; a light runs along them on publish. */
  private drawRulers(active: Item[], sincePub: number) {
    const g = this.g, W = this.w, H = this.h, R = RULER;
    const a = easeInOut(this.chromeA);
    g.save();
    g.translate(-R * (1 - a), -R * (1 - a));
    g.globalAlpha = a;
    g.fillStyle = "rgba(4,10,7,0.9)";
    g.fillRect(0, 0, W + R, R);
    g.fillRect(0, 0, R, H + R);
    g.strokeStyle = "rgba(220,245,230,0.16)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = R; x < W; x += 10) { const big = x % 100 < 10; g.moveTo(x + 0.5, big ? 6 : 12); g.lineTo(x + 0.5, R); }
    for (let y = R; y < H; y += 10) { const big = y % 100 < 10; g.moveTo(big ? 6 : 12, y + 0.5); g.lineTo(R, y + 0.5); }
    g.stroke();
    g.fillStyle = "rgba(220,245,230,0.42)";
    g.font = `9px ${MONO}`;
    for (let x = 100; x < W; x += 100) g.fillText(String(x), x + 3, 9);
    // the extent of what is being built, marked on both rulers
    g.fillStyle = CHROME_SOFT;
    for (const it of active) {
      g.fillRect(Math.max(R, it.r.x), 0, it.r.w, R);
      g.fillRect(0, Math.max(R, it.r.y), R, it.r.h);
    }
    g.strokeStyle = "rgba(91,227,160,0.35)";
    g.beginPath(); g.moveTo(R, R + 0.5); g.lineTo(W, R + 0.5); g.moveTo(R + 0.5, R); g.lineTo(R + 0.5, H); g.stroke();
    // publish: a light runs along the top ruler, left to right
    if (sincePub >= 0 && sincePub < 0.9) {
      const p = easeOut(sincePub / 0.9), x = R + (W - R) * p;
      const grad = g.createLinearGradient(x - 260, 0, x, 0);
      grad.addColorStop(0, "rgba(168,240,200,0)");
      grad.addColorStop(1, "rgba(220,255,236,0.95)");
      g.fillStyle = grad;
      g.fillRect(Math.max(R, x - 260), R - 2, Math.min(260, x - R), 3);
    }
    g.restore();
  }

  /** A small build log, top left (desktop): who is doing what, then Published. */
  private drawLog(hero: Item[], t: number, sincePub: number) {
    const g = this.g;
    const steps = hero.filter((it) => it.crew >= 0 && t >= it.delay - 0.05).sort((a, b) => a.delay - b.delay);
    const x = RULER + 22, y0 = RULER + 64, lh = 18;
    const a = easeInOut(this.chromeA);
    g.save();
    g.globalAlpha = a;
    g.translate(-12 * (1 - a), 0);
    g.font = `500 11px ${MONO}`;
    g.textBaseline = "middle";
    // header
    const pub = sincePub >= 0;
    g.fillStyle = pub ? CHROME : "rgba(220,245,230,0.55)";
    const head = pub ? "✓ PUBLISHED · GABEMILLS.COM" : `BUILDING · GABEMILLS.COM${".".repeat(1 + (Math.floor(t * 3) % 3))}`;
    g.fillText(head, x, y0);
    steps.forEach((it, i) => {
      const c = this.crew[it.crew];
      const y = y0 + (i + 1) * lh + 4;
      const appear = clamp01((t - it.delay + 0.05) / 0.25);
      g.globalAlpha = a * appear * (pub ? 0.7 : 1);
      // crew colour swatch
      g.fillStyle = c.color;
      g.fillRect(x, y - 4, 8, 8);
      g.fillStyle = it.state === "done" ? "rgba(220,245,230,0.62)" : INK;
      const tail = it.state === "done" ? "" : "…";
      g.fillText(`${c.name} ${it.log}${tail}`, x + 16, y);
      if (it.state === "done") { g.fillStyle = CHROME; g.fillText("✓", x + 16 + g.measureText(`${c.name} ${it.log} `).width, y); }
    });
    g.restore();
  }

  /** The tool chrome for one hero piece, by kind and phase. */
  private drawItem(it: Item) {
    const g = this.g, { x, y, w, h } = it.r, e = it.e;
    const a = Math.min(1, e * 8, (1 - e) * 5) * this.chromeA;
    if (a <= 0.01) return;
    g.globalAlpha = a;
    g.lineWidth = 1;
    // dashed guides out to the rulers
    g.strokeStyle = CHROME_SOFT;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(x + 0.5, RULER); g.lineTo(x + 0.5, y);
    g.moveTo(RULER, y + 0.5); g.lineTo(x, y + 0.5);
    g.stroke();
    // the text box / landing marquee being dragged out
    const marquee = it.kind === "text" ? seg(e, 0, TEXT_BOX) : it.kind === "box" ? seg(e, 0, BOX_GRAB) : 1;
    if (marquee < 1 || (it.kind === "text" && e < TEXT_BOX + 0.04) || (it.kind === "box" && e < BOX_GRAB + 0.06)) {
      const d = easeOut(marquee);
      const o = it.kind === "box" ? this.offset(it) : { x: 0, y: 0 };
      g.fillStyle = MARQUEE_FILL;
      g.fillRect(x - o.x, y - o.y, w * d, h * d);
      g.strokeStyle = CHROME;
      g.strokeRect(x - o.x + 0.5, y - o.y + 0.5, w * d, h * d);
    }
    g.setLineDash([]);

    if (it.kind === "media") {
      const d = easeOut(seg(e, 0, MEDIA_PULL)), fill = seg(e, MEDIA_PULL, MEDIA_FILL);
      g.globalAlpha = a * (1 - seg(e, MEDIA_FILL - 0.08, MEDIA_FILL + 0.06));
      g.fillStyle = PLACEHOLDER;
      g.fillRect(x, y, w * d, h * d);
      if (fill > 0) {
        g.fillStyle = "rgba(4,10,7,0.8)"; g.fillRect(x + 14, y + h - 22, w - 28, 6);
        g.fillStyle = CHROME; g.fillRect(x + 14, y + h - 22, (w - 28) * fill, 6);
        g.font = `10px ${MONO}`; g.fillText(`uploading ${Math.round(fill * 100)}%`, x + 14, y + h - 30);
      }
      g.globalAlpha = a;
    }

    // drop ripple
    const ripT = it.kind === "box" ? seg(e, BOX_DROP - 0.01, BOX_DROP + 0.14) : 0;
    if (ripT > 0 && ripT < 1) {
      g.strokeStyle = CHROME;
      g.globalAlpha = a * (1 - ripT);
      for (const k of [1, 0.6]) { g.beginPath(); g.arc(x + w / 2, y, 6 + ripT * 40 * k, 0, Math.PI * 2); g.stroke(); }
      g.globalAlpha = a;
    }

    // selection box, handles and the size chip
    const showSel = it.kind === "text" ? e > TEXT_BOX : it.kind === "box" ? e > BOX_DROP - 0.02 : true;
    if (showSel) {
      g.strokeStyle = CHROME;
      g.strokeRect(x + 0.5, y + 0.5, w, h);
      g.fillStyle = INK;
      for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        g.fillRect(hx - 3, hy - 3, 6, 6);
        g.strokeRect(hx - 2.5, hy - 2.5, 6, 6);
      }
      const label = it.label ?? `${Math.round(w)} × ${Math.round(h)}`;
      g.font = `10px ${MONO}`;
      const tw = g.measureText(label).width + 10;
      const cx = Math.min(this.w - tw - 8, Math.max(RULER + 4, x + w / 2 - tw / 2)), cy = Math.min(this.h - 20, y + h + 6);
      g.fillStyle = CHROME;
      g.fillRect(cx, cy, tw, 15);
      g.fillStyle = "#04130B";
      g.textBaseline = "alphabetic";
      g.fillText(label, cx + 5, cy + 11);
    }
    // typing caret
    if (it.kind === "text" && e > TEXT_BOX && e < TEXT_END) {
      const cxp = x + w * it.m;
      g.strokeStyle = INK;
      g.beginPath(); g.moveTo(cxp, y - 2); g.lineTo(cxp, y + h + 2);
      g.moveTo(cxp - 3, y - 2); g.lineTo(cxp + 3, y - 2); g.moveTo(cxp - 3, y + h + 2); g.lineTo(cxp + 3, y + h + 2); g.stroke();
    }
    g.globalAlpha = 1;
  }

  /** A box's current carry offset in px (matches the CSS: (1 - --m) × --dx/--dy). */
  private offset(it: Item) {
    const dx = parseFloat(it.el.style.getPropertyValue("--dx")) || 0;
    const dy = parseFloat(it.el.style.getPropertyValue("--dy")) || 0;
    return { x: (1 - it.m) * dx, y: (1 - it.m) * dy };
  }

  /**
   * The crew: each cursor does its own step. Before its step it glides in and hovers by the
   * spot; during it, it drags out the box / carries the piece / rides the caret; after, it
   * moves on to its next step or leaves the screen.
   */
  private moveCrew(hero: Item[], t: number, dt: number): boolean {
    const steps = hero.filter((it) => it.crew >= 0).sort((a, b) => a.delay - b.delay);
    let moving = false;
    this.crew.forEach((c, ci) => {
      const mine = steps.filter((it) => it.crew === ci);
      const now = mine.find((it) => it.state === "building");
      const next = mine.find((it) => it.state === "idle" && it.delay - t < 0.9);
      const wob = Math.sin(t * 1.9 + ci * 2.1) * 2, wob2 = Math.cos(t * 1.6 + ci) * 2;
      let press = 0;
      if (now && now.r.vis) {
        const { x, y, w, h } = now.r, e = now.e;
        if (now.kind === "text") {
          if (e < TEXT_BOX) { const d = easeOut(seg(e, 0, TEXT_BOX)); c.tx = x + w * d; c.ty = y + h * d; press = 1; }
          else if (e < TEXT_END) { c.tx = x + w * now.m + 6; c.ty = y + h * 0.62 + wob2; press = Math.sin(t * 10 + ci) > 0.3 ? 1 : 0; }
          else { c.tx = x + w + 18 + wob; c.ty = y + h * 0.5 + wob2; }
        } else if (now.kind === "box") {
          const o = this.offset(now);
          if (e < BOX_GRAB) { const d = easeOut(seg(e, 0, BOX_GRAB)); c.tx = x - o.x + w * d; c.ty = y - o.y + h * d; press = 1; }
          else if (e < BOX_DROP + 0.03) { c.tx = x + w * 0.5; c.ty = y + Math.min(26, h * 0.3); press = e < BOX_DROP ? 1 : 0; }
          else { c.tx = x + w * 0.5 + 24 + wob; c.ty = y - 18 + wob2; }
        } else {
          const d = easeOut(seg(e, 0, MEDIA_PULL));
          if (e < MEDIA_PULL) { c.tx = x + w * d; c.ty = y + h * d; press = 1; }
          else { c.tx = x + 14 + (w - 28) * seg(e, MEDIA_PULL, MEDIA_FILL); c.ty = y + h - 34 + wob2; }
        }
      } else if (next) {
        const b = next.el.getBoundingClientRect();
        // hover just outside the top left corner, ready
        c.tx = b.left - 14 + wob; c.ty = b.top - 14 + wob2;
      } else {
        const off = this.offstage(ci);
        c.tx = off.x + 60; c.ty = c.y;
      }
      c.press += (press - c.press) * Math.min(1, dt * 14);
      // critically damped spring: glides to the job, no overshoot
      const k = 10;
      c.vx += ((c.tx - c.x) * k * k - 2 * k * c.vx) * dt;
      c.vy += ((c.ty - c.y) * k * k - 2 * k * c.vy) * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (Math.abs(c.vx) + Math.abs(c.vy) > 4) moving = true;
      if (c.x < this.w + 10 && c.y < this.h + 10) this.drawCursor(c);
    });
    return moving;
  }

  /** A multiplayer cursor: the arrow plus a name tag in the crew member's colour. */
  private drawCursor(c: Cursor) {
    const g = this.g;
    const s = 1 - c.press * 0.14;
    g.save();
    g.translate(c.x, c.y);
    g.scale(s, s);
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(0, 16); g.lineTo(4.3, 11.8); g.lineTo(7.4, 18.2);
    g.lineTo(10, 17); g.lineTo(7, 10.8); g.lineTo(11.8, 10.8); g.closePath();
    g.fillStyle = c.color; g.fill();
    g.strokeStyle = "#04130B"; g.lineWidth = 1.2; g.stroke();
    // name tag
    g.font = `600 11px ${MONO}`;
    g.textBaseline = "middle";
    const tw = g.measureText(c.name).width + 12;
    g.fillStyle = c.color;
    g.beginPath();
    if (g.roundRect) g.roundRect(12, 16, tw, 18, 4); else g.rect(12, 16, tw, 18);
    g.fill();
    g.fillStyle = "#04130B";
    g.fillText(c.name, 18, 25.5);
    g.restore();
  }
}
