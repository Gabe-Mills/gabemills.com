import { useEffect, useRef, type MutableRefObject } from "react";

/**
 * Constellation — the site background (DESIGN.md).
 *
 * Layered sheets of connected nodes receding to an off-centre vanishing point,
 * flying past the camera forever. Five things make it feel alive rather than
 * merely animated:
 *
 * 1. ADDITIVE COMPOSITING. Links and nodes draw with "lighter", so overlapping
 *    sheets build up luminance instead of painting over each other. This is the
 *    single biggest difference between "flat strokes on black" and something
 *    that looks lit. Alphas are roughly half what they'd be in normal blending.
 *
 * 2. CURSOR GRAVITY. Nodes lean toward the pointer and brighten, and the
 *    nearest ones wire themselves to it. The pull is scaled by each shell's
 *    depth so near sheets react hard and far ones barely move — which is what
 *    makes the field read as dimensional rather than as a flat canvas effect.
 *
 * 3. SIGNAL PULSES. Bright packets travel along links between nodes. The
 *    network stops being scenery and starts looking like it's transmitting.
 *
 * 4. BOKEH ON THE NEAR PLANE. Sheets sweeping past the camera render their
 *    nodes as soft gradients instead of hard dots, so the foreground goes out
 *    of focus the way a real lens would.
 *
 * 5. RADIAL MOTION STREAKS. Scroll fast and nodes stretch along their vector
 *    out from the vanishing point — the correct direction for forward motion,
 *    which is why it reads as speed instead of as a filter.
 *
 * Structural notes kept from the rebuild: discrete shells (a free point cloud
 * links under once per node and renders as a starfield); fixed world extent per
 * shell so far layers compress and near ones spread, which is the depth cue;
 * that extent DERIVED from viewport width, or phones see almost nothing; and a
 * band-pass depth curve so sheets dissolve as they pass rather than throwing
 * huge hard lines across the frame.
 */
export default function ConstellationField({
  progressRef,
}: {
  progressRef?: MutableRefObject<number>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const FOCAL = 340;
    const NEAR = 74;
    const FAR = 2500;
    const RATE = 0.105;
    const REF_Z = 700;
    const MAX_PULSES = 26;

    type Pt = { x: number; y: number; hot: boolean; sx: number; sy: number };
    type Shell = { z: number; spin: number; rot: number; gen: number; pts: Pt[] };
    type Pulse = { s: number; gen: number; a: number; b: number; t: number; sp: number };
    type Hop = { s: number; gen: number; from: number };
    type Wave = { x: number; y: number; r: number };

    let EXTENT = 840;
    let LINK_W = 330;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let shells: Shell[] = [];
    let pulses: Pulse[] = [];
    let hops: Hop[] = [];
    let waves: Wave[] = [];
    let raf = 0;
    let last = 0;
    let genCounter = 1;

    // pointer, in canvas space, lerped
    let mxT = -9999;
    let myT = -9999;
    let mx = -9999;
    let my = -9999;
    let mActive = false;

    // parallax + scroll velocity
    let tpx = 0, tpy = 0, px = 0, py = 0;
    let lastProg = 0;
    let vel = 0;

    const fillShell = (s: Shell, z: number) => {
      s.z = z;
      s.rot = Math.random() * Math.PI * 2;
      s.spin = (Math.random() - 0.5) * 0.05;
      s.gen = ++genCounter;
      const aspect = h / w;
      for (let i = 0; i < s.pts.length; i++) {
        const p = s.pts[i];
        p.x = (Math.random() * 2 - 1) * EXTENT;
        p.y = (Math.random() * 2 - 1) * EXTENT * aspect;
        p.hot = Math.random() < 0.13;
      }
    };

    const build = () => {
      const area = w * h;
      const shellCount = area > 900000 ? 18 : area > 380000 ? 16 : 14;
      const per = area > 900000 ? 22 : area > 380000 ? 19 : 17;
      shells = new Array(shellCount);
      for (let i = 0; i < shellCount; i++) {
        const pts: Pt[] = new Array(per);
        for (let k = 0; k < per; k++) pts[k] = { x: 0, y: 0, hot: false, sx: 0, sy: 0 };
        const s: Shell = { z: 0, spin: 0, rot: 0, gen: 0, pts };
        fillShell(s, NEAR * Math.pow(FAR / NEAR, i / shellCount));
        shells[i] = s;
      }
      pulses = [];
      hops = [];
      waves = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      EXTENT = (w * REF_Z) / (2 * FOCAL);
      LINK_W = EXTENT * 0.4;
      build();
    };

    const draw = (dt: number, t: number) => {
      const prog = progressRef ? progressRef.current : 0;
      const rawVel = dt > 0 ? Math.abs(prog - lastProg) / dt : 0;
      lastProg = prog;
      vel += (Math.min(rawVel, 2.4) - vel) * 0.14; // smoothed, clamped
      const streak = Math.min(1, vel * 1.9);

      const rate = RATE * (1 + prog * 2.1 + vel * 1.5);

      px += (tpx - px) * 0.045;
      py += (tpy - py) * 0.045;
      if (mActive) {
        mx = mx < -9000 ? mxT : mx + (mxT - mx) * 0.16;
        my = my < -9000 ? myT : my + (myT - my) * 0.16;
      }

      // ---------- ground (normal blending) ----------
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#060404";
      ctx.fillRect(0, 0, w, h);

      const vx = w * 0.655 + px * 30;
      const vy = h * 0.435 + py * 30;

      // the core breathes, slowly — keeps a static screenshot and a live page
      // feeling like the same thing without reading as a pulse effect
      const breath = 0.86 + 0.14 * Math.sin(t * 0.18);
      const bloom = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.max(w, h) * 0.66);
      bloom.addColorStop(0, `rgba(150,54,22,${0.26 * breath})`);
      bloom.addColorStop(0.36, `rgba(102,34,16,${0.1 * breath})`);
      bloom.addColorStop(1, "rgba(32,11,6,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);

      // ---------- field (additive) ----------
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      const PULL_R = Math.min(w, h) * 0.34;
      const WIRE_R = PULL_R * 0.62;
      const WAVE_BAND = Math.min(w, h) * 0.11;

      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].r += Math.max(w, h) * 0.62 * dt;
        if (waves[i].r > Math.max(w, h) * 1.15) waves.splice(i, 1);
      }

      for (let si = shells.length - 1; si >= 0; si--) {
        const s = shells[si];

        s.z -= s.z * rate * dt;
        s.rot += s.spin * dt;
        if (s.z <= NEAR) fillShell(s, FAR);

        const scale = FOCAL / s.z;
        const depth = (s.z - NEAR) / (FAR - NEAR);
        const nearFade = Math.min(1, (s.z - NEAR) / (NEAR * 2.4));
        const fog = Math.pow(1 - depth, 1.55) * nearFade;
        if (fog <= 0.006) continue;

        const cos = Math.cos(s.rot);
        const sin = Math.sin(s.rot);
        const reach = 0.25 + fog * 0.75; // near sheets respond to the cursor most

        for (let i = 0; i < s.pts.length; i++) {
          const p = s.pts[i];
          const rx = p.x * cos - p.y * sin;
          const ry = p.x * sin + p.y * cos;
          let sx = vx + rx * scale;
          let sy = vy + ry * scale;

          if (mActive) {
            const dx = mx - sx;
            const dy = my - sy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < PULL_R && d > 0.001) {
              const fall = 1 - d / PULL_R;
              const pull = fall * fall * 33 * reach;
              sx += (dx / d) * pull;
              sy += (dy / d) * pull;
            }
          }
          // a click sends a ring through the lattice; nodes in the band get shoved
          for (let k = 0; k < waves.length; k++) {
            const wv = waves[k];
            const dx = sx - wv.x;
            const dy = sy - wv.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const off = Math.abs(d - wv.r);
            if (off > WAVE_BAND) continue;
            const f = 1 - off / WAVE_BAND;
            const push = f * f * 38 * reach;
            sx += (dx / d) * push;
            sy += (dy / d) * push;
          }

          p.sx = sx;
          p.sy = sy;
        }

        // ---- links, one batched stroke per sheet ----
        const linkPx = LINK_W * scale;
        const linkPx2 = linkPx * linkPx;
        ctx.lineWidth = Math.max(0.35, 0.28 + fog * 1.0);
        ctx.strokeStyle = `rgba(255,${Math.round(122 + fog * 76)},${Math.round(54 + fog * 64)},${0.03 + fog * 0.26})`;
        ctx.beginPath();
        for (let i = 0; i < s.pts.length; i++) {
          const a = s.pts[i];
          for (let j = i + 1; j < s.pts.length; j++) {
            const b = s.pts[j];
            const dx = a.sx - b.sx;
            const dy = a.sy - b.sy;
            if (dx * dx + dy * dy > linkPx2) continue;
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);

            // Multi-hop: a packet that finished queues a hop from its arrival
            // node, and the next frame's link loop finds that node a neighbour
            // to continue to. Using the loop that already computes adjacency
            // means no adjacency table has to be stored or kept in sync.
            if (hops.length && pulses.length < MAX_PULSES) {
              for (let q = hops.length - 1; q >= 0; q--) {
                const hp = hops[q];
                if (hp.s !== si || hp.gen !== s.gen) continue;
                if (hp.from !== i && hp.from !== j) continue;
                if (Math.random() > 0.45) continue; // don't always take the first neighbour
                const from = hp.from;
                const to = from === i ? j : i;
                pulses.push({ s: si, gen: s.gen, a: from, b: to, t: 0, sp: 0.6 + Math.random() * 0.8 });
                hops.splice(q, 1);
              }
            }

            // fresh packets spawn on real links, on sheets near enough to see
            if (fog > 0.4 && pulses.length < MAX_PULSES && Math.random() < 0.0016) {
              pulses.push({ s: si, gen: s.gen, a: i, b: j, t: 0, sp: 0.5 + Math.random() * 0.75 });
            }
          }
        }
        ctx.stroke();

        // ---- nodes ----
        const r = 0.55 + fog * 2.3;
        const nodeA = 0.08 + fog * 0.6;
        const bokeh = s.z < NEAR * 3.4; // sheet is sweeping past — throw it out of focus

        if (streak > 0.04) {
          // radial motion streaks: the correct blur direction for forward travel
          ctx.lineWidth = Math.max(0.5, r * 0.85);
          ctx.strokeStyle = `rgba(255,${Math.round(170 + fog * 60)},${Math.round(110 + fog * 50)},${nodeA * 0.85})`;
          ctx.beginPath();
          for (let i = 0; i < s.pts.length; i++) {
            const p = s.pts[i];
            const dx = p.sx - vx;
            const dy = p.sy - vy;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const len = streak * 34 * (0.35 + fog);
            ctx.moveTo(p.sx, p.sy);
            ctx.lineTo(p.sx + (dx / d) * len, p.sy + (dy / d) * len);
          }
          ctx.stroke();
        }

        if (bokeh) {
          for (let i = 0; i < s.pts.length; i++) {
            const p = s.pts[i];
            if (p.sx < -80 || p.sx > w + 80 || p.sy < -80 || p.sy > h + 80) continue;
            // Chromatic bokeh: warm and cool lobes offset a couple of pixels
            // apart, the way a fast lens fringes a bright out-of-focus point.
            // Additive blending fuses them back to near-white in the core.
            const br = r * 5.5;
            const warm = ctx.createRadialGradient(p.sx + 1.6, p.sy - 1.1, 0, p.sx + 1.6, p.sy - 1.1, br);
            warm.addColorStop(0, `rgba(255,176,104,${nodeA * 0.42})`);
            warm.addColorStop(0.5, `rgba(228,116,54,${nodeA * 0.14})`);
            warm.addColorStop(1, "rgba(200,90,40,0)");
            ctx.fillStyle = warm;
            ctx.beginPath();
            ctx.arc(p.sx + 1.6, p.sy - 1.1, br, 0, 6.2832);
            ctx.fill();

            const cool = ctx.createRadialGradient(p.sx - 1.6, p.sy + 1.1, 0, p.sx - 1.6, p.sy + 1.1, br * 0.9);
            cool.addColorStop(0, `rgba(140,168,232,${nodeA * 0.2})`);
            cool.addColorStop(1, "rgba(110,140,210,0)");
            ctx.fillStyle = cool;
            ctx.beginPath();
            ctx.arc(p.sx - 1.6, p.sy + 1.1, br * 0.9, 0, 6.2832);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = `rgba(${Math.round(140 + fog * 115)},${Math.round(92 + fog * 92)},${Math.round(66 + fog * 54)},${nodeA})`;
          ctx.beginPath();
          for (let i = 0; i < s.pts.length; i++) {
            const p = s.pts[i];
            if (p.hot) continue;
            ctx.moveTo(p.sx + r, p.sy);
            ctx.arc(p.sx, p.sy, r, 0, 6.2832);
          }
          ctx.fill();

          ctx.fillStyle = `rgba(255,${Math.round(190 + fog * 40)},${Math.round(132 + fog * 48)},${Math.min(1, nodeA * 1.5)})`;
          ctx.beginPath();
          for (let i = 0; i < s.pts.length; i++) {
            const p = s.pts[i];
            if (!p.hot) continue;
            ctx.moveTo(p.sx + r * 1.35, p.sy);
            ctx.arc(p.sx, p.sy, r * 1.35, 0, 6.2832);
          }
          ctx.fill();

          if (fog > 0.45) {
            for (let i = 0; i < s.pts.length; i++) {
              const p = s.pts[i];
              if (!p.hot) continue;
              const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 9);
              g.addColorStop(0, `rgba(255,196,130,${0.26 * fog})`);
              g.addColorStop(1, "rgba(255,150,80,0)");
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.arc(p.sx, p.sy, r * 9, 0, 6.2832);
              ctx.fill();
            }
          }
        }

        // ---- cursor wiring: the field reaches back ----
        if (mActive && fog > 0.3) {
          ctx.lineWidth = 0.7;
          for (let i = 0; i < s.pts.length; i++) {
            const p = s.pts[i];
            const dx = mx - p.sx;
            const dy = my - p.sy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > WIRE_R) continue;
            const fall = 1 - d / WIRE_R;
            ctx.strokeStyle = `rgba(255,200,140,${fall * fall * 0.52 * fog})`;
            ctx.beginPath();
            ctx.moveTo(p.sx, p.sy);
            ctx.lineTo(mx, my);
            ctx.stroke();

            const gr = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 9);
            gr.addColorStop(0, `rgba(255,214,160,${fall * 0.6 * fog})`);
            gr.addColorStop(1, "rgba(255,170,100,0)");
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, 9, 0, 6.2832);
            ctx.fill();
          }
        }
      }

      // ---------- signal packets ----------
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pl = pulses[i];
        const s = shells[pl.s];
        if (!s || s.gen !== pl.gen) { pulses.splice(i, 1); continue; }
        pl.t += pl.sp * dt;
        if (pl.t >= 1) {
          // chain onward most of the time, so signals trace paths across the mesh
          if (hops.length < 12 && Math.random() < 0.62) {
            hops.push({ s: pl.s, gen: pl.gen, from: pl.b });
          }
          pulses.splice(i, 1);
          continue;
        }

        const a = s.pts[pl.a];
        const b = s.pts[pl.b];
        const x = a.sx + (b.sx - a.sx) * pl.t;
        const y = a.sy + (b.sy - a.sy) * pl.t;
        const life = Math.sin(pl.t * Math.PI); // fade in and out along the run

        const tailT = Math.max(0, pl.t - 0.16);
        ctx.strokeStyle = `rgba(255,206,150,${0.5 * life})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.sx + (b.sx - a.sx) * tailT, a.sy + (b.sy - a.sy) * tailT);
        ctx.lineTo(x, y);
        ctx.stroke();

        const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
        g.addColorStop(0, `rgba(255,236,206,${0.85 * life})`);
        g.addColorStop(0.35, `rgba(255,176,100,${0.35 * life})`);
        g.addColorStop(1, "rgba(255,140,70,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, 6.2832);
        ctx.fill();
      }

      // shockwave rings
      for (let i = 0; i < waves.length; i++) {
        const wv = waves[i];
        const life = Math.max(0, 1 - wv.r / (Math.max(w, h) * 1.15));
        ctx.strokeStyle = `rgba(255,204,152,${0.5 * life * life})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, wv.r, 0, 6.2832);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,150,80,${0.22 * life})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, wv.r, 0, 6.2832);
        ctx.stroke();
      }

      // cursor core
      if (mActive) {
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 46);
        g.addColorStop(0, "rgba(255,212,164,0.2)");
        g.addColorStop(0.4, "rgba(255,150,80,0.07)");
        g.addColorStop(1, "rgba(255,120,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, 46, 0, 6.2832);
        ctx.fill();
      }

      // ---------- vignette (normal blending) ----------
      ctx.globalCompositeOperation = "source-over";
      const vig = ctx.createRadialGradient(
        w * 0.5, h * 0.5, Math.min(w, h) * 0.24,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.8
      );
      vig.addColorStop(0, "rgba(6,4,4,0)");
      vig.addColorStop(1, "rgba(6,4,4,0.84)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    };

    const onPointer = (e: PointerEvent) => {
      tpx = (e.clientX / window.innerWidth - 0.5) * 2;
      tpy = (e.clientY / window.innerHeight - 0.5) * 2;
      mxT = e.clientX;
      myT = e.clientY;
      mActive = true;
    };
    const onLeave = () => { mActive = false; mx = -9999; my = -9999; };
    const onDown = (e: PointerEvent) => {
      if (waves.length > 3) return;
      waves.push({ x: e.clientX, y: e.clientY, r: 0 });
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      draw(0, 0);
      return () => window.removeEventListener("resize", resize);
    }

    if (!coarse) {
      // both, deliberately: pointermove is the modern event but some embedded
      // and automated contexts only deliver mousemove, and losing the cursor
      // interaction silently is worse than one redundant listener
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("mousemove", onPointer as unknown as EventListener, { passive: true });
      window.addEventListener("pointerleave", onLeave);
      document.addEventListener("mouseleave", onLeave);
    }
    // taps too: this is the one interaction that works on a phone
    window.addEventListener("pointerdown", onDown, { passive: true });

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      draw(dt, now / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("mousemove", onPointer as unknown as EventListener);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [progressRef]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
