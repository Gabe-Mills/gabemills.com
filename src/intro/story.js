// Scroll story. The intro section is BEATS.length * BEAT_VH tall with a sticky,
// full-viewport stage inside it. Page scroll -> progress 0..1 -> (beat, local p).
//
// Each beat's range: [wipe-in | content | wipe-out]. The ink-rain wipe is scrubbed by
// scroll at every boundary, and the active scene swaps at full cover. Scenes get
// scene.progress(p) every frame with a smoothed content p in 0..1. They must be pure
// functions of p (scroll back up = rewind). The last beat fades to the site ground,
// which is where the hero below begins.
//
// Debug: ?intro=<beatId>&p=0.5&t=1.2 scrolls to that point and sets window.__shotReady.
import * as THREE from 'three';
import gsap from 'gsap';
import { BEATS, BEAT_VH } from './beats.js';
import * as gb from './core/gbuffer.js';
import { tex, cardPlane } from './core/assets.js';
import { makePanel } from './core/panels.js';

const modules = import.meta.glob('./scenes/*.js');
const WIPE = 0.14;      // share of a beat at each boundary spent in the wipe
const FADE = 0.22;      // share of the last beat spent fading into the site ground
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export class ScrollStory {
  constructor({ engine, section, captionEl, overlay }) {
    Object.assign(this, { engine, section, captionEl, overlay });
    this.n = BEATS.length;
    this.coverIndex = Math.max(0, BEATS.findIndex((b) => !b.caption));
    this.scenes = new Map();
    this.active = -1;
    this.target = 0;     // raw scroll progress
    this.shown = 0;      // smoothed progress (what renders)
    this.captionFor = -1;
    this.pointer = { nx: 0, ny: 0 };
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ctx = {
      THREE, gsap, engine, tex, cardPlane, makePanel, ...gb, overlay,
      reduced: this.reduced,
      flavour: { ...gb.FLAVOURS.ember },
      pointer: this.pointer,
      audio: { sfx() {}, beat() {}, holdLevel() {} },
    };
    section.style.height = `${this.n * BEAT_VH}vh`;
    this.onScroll = this.onScroll.bind(this);
    this.onPointer = (e) => {
      this.pointer.nx = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.ny = -((e.clientY / innerHeight) * 2 - 1);
      this.scenes.get(BEATS[this.active]?.id)?.pointer?.(this.pointer.nx, this.pointer.ny);
    };
    addEventListener('scroll', this.onScroll, { passive: true });
    addEventListener('resize', this.onScroll);
    addEventListener('pointermove', this.onPointer, { passive: true });
    this.offFrame = engine.onFrame((dt) => this.frame(dt));
  }

  // One scene instance per beat (keyed by beat id), so one module can serve several
  // beats with different params (the project beats share scenes/project-*.js).
  async load(beat) {
    if (this.scenes.has(beat.id)) return this.scenes.get(beat.id);
    const mod = await modules[`./scenes/${beat.scene}.js`]();
    const s = mod.create(this.ctx, beat);
    this.scenes.set(beat.id, s);
    return s;
  }

  async init() {
    // build every scene up front (shaders compile once, no hitch on the first wipe)
    for (const b of BEATS) await this.load(b);
    // compile every scene's shaders now, so no beat hitches the first time it is shown
    for (const s of this.scenes.values()) {
      if (s.camera) { s.camera.aspect = this.engine.aspect; s.camera.updateProjectionMatrix(); }
      try { this.engine.renderer.compile(s.scene, s.camera); } catch {}
    }
    this.placeAnchors();
    // a page opened at /#top or /#work: the anchors only exist now, after the browser's own
    // fragment scroll, so do that scroll again
    const hashed = location.hash && this.anchors.find((a) => a && `#${a.id}` === location.hash);
    if (hashed) hashed.scrollIntoView({ behavior: 'instant' });
    const params = new URLSearchParams(location.search);
    const dbg = params.get('intro');
    if (dbg) {
      const i = Math.max(0, BEATS.findIndex((b) => b.id === dbg));
      const p = parseFloat(params.get('p') ?? '0.5');
      // map content p back to raw beat progress (inverse of contentP below)
      const lo = i === 0 ? 0 : WIPE, hi = i === this.n - 1 ? 1 - FADE : 1 - WIPE;
      const local = lo + p * (hi - lo);
      this.jumpTo((i + local) / this.n);
      setTimeout(() => { window.__shotReady = true; }, parseFloat(params.get('t') ?? '1.2') * 1000);
    }
    this.onScroll();
    this.shown = this.target;
    this.apply(this.shown, 0);
  }

  /**
   * Beats with `anchor` get an invisible element at the scroll position where their
   * content starts, so #top (cover) and #work (first project) links land on them.
   */
  placeAnchors() {
    if (!this.anchors) {
      this.anchors = BEATS.map((b, i) => {
        if (!b.anchor) return null;
        const a = document.createElement('div');
        a.id = b.anchor;
        a.className = 'intro-anchor';
        a.dataset.beat = String(i);
        this.section.prepend(a);
        return a;
      });
      addEventListener('resize', () => this.placeAnchors());
    }
    const run = this.section.offsetHeight - innerHeight;
    // land at the beat's `anchorP` (content p, default 0.12), e.g. the cover lands with the name set
    this.anchors.forEach((a, i) => {
      if (!a) return;
      const lo = i === 0 ? 0 : WIPE, hi = i === this.n - 1 ? 1 - FADE : 1 - WIPE;
      const local = lo + (BEATS[i].anchorP ?? 0.12) * (hi - lo);
      a.style.top = `${((i + local) / this.n) * run}px`;
    });
  }

  /** Scroll the window so the intro sits at progress P (0..1). */
  jumpTo(P, smooth = false) {
    const r = this.section.getBoundingClientRect();
    const top = scrollY + r.top;
    const run = this.section.offsetHeight - innerHeight;
    scrollTo({ top: top + P * run, behavior: smooth ? 'smooth' : 'instant' });
  }

  onScroll() {
    const r = this.section.getBoundingClientRect();
    const run = Math.max(1, this.section.offsetHeight - innerHeight);
    this.target = clamp01(-r.top / run);
    // render only while the stage is on screen
    const visible = r.bottom > 0 && r.top < innerHeight;
    if (visible !== this.engine.enabled) {
      this.engine.enabled = visible;
      visible ? this.engine.start() : this.engine.stop();
    }
  }

  frame(dt) {
    // critically-damped follow: scroll feels weighted without a scroll-jacking library
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 7);
    this.shown += (this.target - this.shown) * k;
    if (Math.abs(this.target - this.shown) < 1e-5) this.shown = this.target;
    this.apply(this.shown, dt);
  }

  apply(P, dt) {
    const u = Math.min(P * this.n, this.n - 1e-6);
    const i = Math.floor(u);
    const local = u - i;
    const ink = this.engine.ink.uniforms;

    // wipe: cover in the last WIPE of beat i, uncover in the first WIPE of beat i+1
    let wipe = 0;
    if (i < this.n - 1 && local > 1 - WIPE) wipe = (local - (1 - WIPE)) / WIPE;          // 0..1
    else if (i > 0 && local < WIPE) wipe = 1 + local / WIPE;                              // 1..2
    ink.uWipe.value = wipe >= 2 ? 0 : wipe;
    ink.uWipeColor.value = i % 2;                                                          // alternate ink / ember rain

    // the scene on screen: during the cover half it is still beat i
    if (i !== this.active) this.activate(i);

    const isLast = i === this.n - 1;
    const lo = i === 0 ? 0 : WIPE;
    const hi = isLast ? 1 - FADE : 1 - WIPE;
    const p = clamp01((local - lo) / (hi - lo));
    this.scenes.get(BEATS[i].id)?.progress?.(p, dt);

    ink.uDark.value = isLast ? clamp01((local - (1 - FADE)) / (FADE * 0.85)) : 0;
    // progress chrome: write the two elements that show it, only when it changes. (A CSS
    // var on the section restyled every overlay inside it each frame: the end-of-page lag.)
    const pk = Math.round(P * 1000);
    if (pk !== this.lastP) {
      this.lastP = pk;
      this.railEl ??= this.section.querySelector('.intro-rail i');
      this.hintEl ??= this.section.querySelector('.intro-hint');
      if (this.railEl) this.railEl.style.transform = `scaleY(${(pk / 1000).toFixed(3)})`;
      if (this.hintEl) this.hintEl.style.opacity = String(Math.max(0, 1 - P * 40));
    }
    // the fade to ground is the hand-off: retire the intro's own chrome before the hero arrives
    this.section.classList.toggle('is-done', isLast && local > 1 - FADE);
    // past the narrated intro (cover onward): "Skip intro" no longer means anything
    this.section.classList.toggle('is-past-intro', i >= this.coverIndex);
    this.setCaption(i, p, isLast ? local : null);
  }

  activate(i) {
    const prev = BEATS[this.active];
    if (prev) this.scenes.get(prev.id)?.exit?.();
    this.active = i;
    const s = this.scenes.get(BEATS[i].id);
    this.engine.setScene(s);
    s?.enter?.();
  }

  setCaption(i, p, lastLocal) {
    const on = !!BEATS[i].caption && p > 0.04 && p < 0.9 && (lastLocal == null || lastLocal < 1 - FADE);
    const want = on ? i : -1;
    if (want === this.captionFor) return;
    this.captionFor = want;
    const el = this.captionEl;
    if (want < 0) { el.classList.remove('is-on'); return; }
    el.querySelector('.intro-caption-text').textContent = BEATS[i].caption;
    // number only the narrated beats (the showcase beats carry their own labels)
    const told = BEATS.filter((b) => b.caption);
    const k = told.indexOf(BEATS[i]);
    el.querySelector('.intro-caption-n').textContent = `${String(k + 1).padStart(2, '0')} / ${String(told.length).padStart(2, '0')}`;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
  }

  destroy() {
    removeEventListener('scroll', this.onScroll);
    removeEventListener('resize', this.onScroll);
    removeEventListener('pointermove', this.onPointer);
    this.offFrame();
    for (const s of this.scenes.values()) { s.exit?.(); s.dispose?.(); }
  }
}
