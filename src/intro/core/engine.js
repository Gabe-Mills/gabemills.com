// One canvas, one WebGL2 context. Scenes render into a G-buffer target; InkPass draws it.
// The loop runs only while the tab is visible (no rAF when hidden).
import * as THREE from 'three';
import { InkPass } from './ink.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.autoClear = true;
    // phones: cap DPR lower, the ink pass is per-pixel work
    this.dpr = Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
    this.renderer.setPixelRatio(this.dpr);
    this.rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.ink = new InkPass();
    this.clear = new THREE.Color(1, 0.5 / 8, 0.5); // paper, neutral palette
    this.active = null;     // { scene, camera, update }
    this.overlay = null;    // optional second scene drawn into the same G-buffer on top (panels)
    this.clock = new THREE.Clock();
    this.time = 0;
    this.listeners = new Set();
    this.frozen = false;
    this.enabled = true;   // the intro turns this off while it is scrolled out of view
    this._raf = 0;
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    this.resize();
  }

  get width() { return window.innerWidth; }
  get height() { return window.innerHeight; }
  get aspect() { return this.width / this.height; }

  resize() {
    const w = this.width, h = this.height;
    this.renderer.setSize(w, h, false);
    this.rt.setSize(Math.floor(w * this.dpr), Math.floor(h * this.dpr));
    this.ink.setSize(w, h, this.dpr);
    for (const s of [this.active, this.overlay]) if (s?.camera?.isPerspectiveCamera) { s.camera.aspect = this.aspect; s.camera.updateProjectionMatrix(); }
    this.active?.resize?.(w, h);
  }

  setScene(s) {
    this.active = s;
    if (s?.camera?.isPerspectiveCamera) { s.camera.aspect = this.aspect; s.camera.updateProjectionMatrix(); }
  }

  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  start() {
    if (this._raf || document.hidden || !this.enabled) return;
    this.clock.getDelta();
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      const raw = this.clock.getDelta();
      this.adapt(raw);
      const dt = Math.min(raw, 1 / 20);
      if (!this.frozen) this.time += dt;
      this.frame(this.frozen ? 0 : dt);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() { cancelAnimationFrame(this._raf); this._raf = 0; }

  /**
   * Adaptive resolution. If frames average over ~19 ms for a second, step the render
   * scale down (2 -> 1.5 -> 1.25 -> 1). The ink pass is per-pixel work, so this is the
   * lever that matters on slower GPUs. It never steps back up, so it can't oscillate.
   */
  adapt(dt) {
    if (dt > 0.25) { this._acc = 0; this._n = 0; return; }   // tab switches, debugger pauses
    this._acc = (this._acc || 0) + dt; this._n = (this._n || 0) + 1;
    if (this._acc < 1) return;
    const avg = this._acc / this._n;
    this._acc = 0; this._n = 0;
    if (avg <= 0.019 || this.dpr <= 1) return;
    this.dpr = this.dpr > 1.5 ? 1.5 : this.dpr > 1.25 ? 1.25 : 1;
    this.renderer.setPixelRatio(this.dpr);
    this.resize();
  }

  frame(dt) {
    for (const fn of this.listeners) fn(dt, this.time);
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.setClearColor(this.clear, 1);
    r.clear();
    if (this.active) {
      this.active.update?.(dt, this.time);
      r.render(this.active.scene, this.active.camera);
    }
    if (this.overlay) {
      r.autoClear = false;
      r.clearDepth();
      r.render(this.overlay.scene, this.overlay.camera);
      r.autoClear = true;
    }
    r.setRenderTarget(null);
    this.ink.render(r, this.rt.texture, this.time);
  }
}
