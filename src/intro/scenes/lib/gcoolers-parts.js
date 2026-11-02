// Geometry, canvas engravings and timing curves for the Gcoolers beat (scenes/project-gcoolers.js).
// Everything here is built once in create(); nothing allocates per frame.
//
// Layout (world units, +z faces the final camera):
//   board      y = 0, an engraved logic board with isotherm rings around the chip
//   chip       substrate + die + nickel cold plate, centred near the origin
//   fins       16 vertical paper fins (planes facing x) over y 0.55..2.35, z -1..1,
//              split by a wider centre channel the camera flies through
//   heat pipes 4 ember U-pipes: out of the cold plate, up the sides, back across the fins
//   fan        on the front face (z ≈ 1.3), blowing -z through the slots
//   print      the framed site print, mounted on a post above and behind the stack

export const FIN = { y0: 0.55, y1: 2.35, z0: -1.0, z1: 1.0, t: 0.03 };
export const FAN = { x: 0, y: 1.45, z: 1.32, r: 0.86, hub: 0.28, blades: 7 };
// fin x positions: a centre channel (camera) then evenly spaced fins out to ±1.22
export const FIN_X = (() => {
  const xs = [];
  for (let k = 0; k < 8; k++) { const x = 0.25 + k * 0.14; xs.push(-x, x); }
  return xs.sort((a, b) => a - b);
})();
// air slots: the centre channel and the gaps between fins
export const SLOT_X = (() => {
  const s = [0];
  for (let k = 0; k < 7; k++) { const x = 0.32 + k * 0.14; s.push(-x, x); }
  return s.sort((a, b) => a - b);
})();

/** Small deterministic RNG (mulberry32), so the set is identical on every load. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smoothR = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ timing (pure functions of p)
/** Die temperature 0..1: hot while the camera is in the fins, settles idle, then cold. */
export function heatAt(p) {
  return (1 - 0.8 * smoothR(0.14, 0.6, p)) * (1 - smoothR(0.84, 0.97, p));
}
/** Fan speed 0..1: ramps to full under load, eases to a quiet idle, spins down to a stop. */
export function omegaAt(p) {
  const up = 0.55 + 0.45 * smoothR(0, 0.22, p);
  const settle = 1 - 0.62 * smoothR(0.3, 0.66, p);
  return up * settle * (1 - smoothR(0.84, 0.995, p));
}
/** Fan angle (radians) = integral of omega dp. Tabulated once, so it is a pure lookup. */
export function makeSpinTable(scale = 58, N = 2048) {
  const tab = new Float32Array(N + 1);
  let acc = 0;
  for (let i = 1; i <= N; i++) {
    const pa = (i - 1) / N, pb = i / N;
    acc += 0.5 * (omegaAt(pa) + omegaAt(pb)) * (pb - pa) * scale;
    tab[i] = acc;
  }
  return (p) => {
    const u = clamp01(p) * N, i = Math.min(N - 1, Math.floor(u)), f = u - i;
    return tab[i] + (tab[i + 1] - tab[i]) * f;
  };
}

// ------------------------------------------------------------------ geometry
/** One curved, twisted fan blade (root at the hub, swept back toward the tip). */
export function bladeGeometry(THREE, { r0 = 0.3, r1 = FAN.r - 0.03, nr = 10, nc = 7 } = {}) {
  const pos = [], idx = [];
  for (let i = 0; i <= nr; i++) {
    const r = r0 + (r1 - r0) * (i / nr);
    const sw = bladeSweep(r);
    const span = bladeSpan(r);
    for (let j = 0; j <= nc; j++) {
      const c = j / nc;
      // rounded tip: the chord narrows over the last 15% of the radius
      const tip = i === nr ? 0.82 : 1;
      const a = sw + span * (c * tip + (1 - tip) * 0.5);
      const z = (0.5 - c) * 0.16 * (1 - 0.35 * (r - r0) / (r1 - r0));
      pos.push(r * Math.cos(a), r * Math.sin(a), z);
    }
  }
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
    const a = i * (nc + 1) + j, b = a + nc + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export const bladeSweep = (r) => 0.9 * (r - 0.3);
export const bladeSpan = (r) => 0.6 - 0.22 * (r - 0.3) / 0.53;

/** Heat pipe centre lines: out of the cold plate, round the side, back across the fins. */
export function pipeCurves(THREE) {
  const out = [];
  const defs = [
    { z: -0.6, s: -1, y: 1.15 }, { z: -0.2, s: 1, y: 1.85 },
    { z: 0.2, s: -1, y: 1.85 }, { z: 0.6, s: 1, y: 1.15 },
  ];
  for (const { z, s, y } of defs) {
    const X = 1.62 * s;
    const pts = [
      [-0.55 * s, 0.31, z], [0.2 * s, 0.31, z], [0.9 * s, 0.33, z],
      [1.32 * s, 0.42, z], [X, 0.75, z], [X + 0.04 * s, (0.75 + y) / 2, z],
      [X, y - 0.3, z], [1.42 * s, y - 0.02, z], [1.0 * s, y, z], [0, y, z], [-1.3 * s, y, z],
    ].map(([a, b, c]) => new THREE.Vector3(a, b, c));
    out.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  }
  return out;
}

/** Air streamlines: in through the fan (with swirl), straight down a slot, out the back and up. */
export function streamCurves(THREE) {
  const R = rng(7);
  const out = [];
  const add = (x0, y0, a, r) => {
    const pts = [];
    const fx = FAN.x, fy = FAN.y;
    pts.push(new THREE.Vector3(fx + r * 1.5 * Math.cos(a + 0.5), fy + r * 1.35 * Math.sin(a + 0.5), 3.6));
    pts.push(new THREE.Vector3(fx + r * 1.15 * Math.cos(a + 0.25), fy + r * 1.1 * Math.sin(a + 0.25), 2.45));
    pts.push(new THREE.Vector3(fx + r * Math.cos(a), fy + r * Math.sin(a), FAN.z + 0.1));
    pts.push(new THREE.Vector3((fx + r * Math.cos(a - 0.35) + x0) / 2, (fy + r * Math.sin(a - 0.35) + y0) / 2, 1.12));
    pts.push(new THREE.Vector3(x0, y0, 0.86));
    pts.push(new THREE.Vector3(x0, y0, 0));
    pts.push(new THREE.Vector3(x0, y0, -0.95));
    pts.push(new THREE.Vector3(x0 * 1.25, y0 + 0.35, -1.75));
    pts.push(new THREE.Vector3(x0 * 1.6, y0 + 1.25, -2.6));
    pts.push(new THREE.Vector3(x0 * 1.9, y0 + 2.5, -3.1));
    out.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  };
  // two lanes in the centre channel, above and below the camera's path
  add(0, 0.98, -Math.PI / 2 + 0.3, 0.55);
  add(0, 2.12, Math.PI / 2 - 0.2, 0.6);
  // the rest spread over the slots
  const lanes = SLOT_X.filter((x) => x !== 0);
  for (let i = 0; i < 12; i++) {
    const x0 = lanes[Math.floor(R() * lanes.length)];
    const y0 = 0.75 + R() * 1.45;
    const a = Math.atan2(y0 - FAN.y, x0 - FAN.x + 1e-3) + (R() - 0.5) * 0.6;
    add(x0, y0, a, 0.42 + R() * 0.38);
  }
  return out;
}

// ------------------------------------------------------------------ canvas engravings
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/** Logic-board traces: light copper lines and vias on a dark board (tiles). */
export function boardTexture(THREE) {
  const [c, g] = canvas(512, 512);
  const R = rng(11);
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let i = 0; i < 70; i++) {
    let x = Math.round(R() * 32) * 16, y = Math.round(R() * 32) * 16;
    g.lineWidth = R() < 0.75 ? 2 : 4;
    g.beginPath(); g.moveTo(x, y);
    const steps = 2 + Math.floor(R() * 4);
    let horiz = R() < 0.5;
    for (let s = 0; s < steps; s++) {
      const len = (2 + Math.floor(R() * 8)) * 16 * (R() < 0.5 ? -1 : 1);
      // 45-degree jog between runs, like routed traces
      const j = 16 * (R() < 0.5 ? -1 : 1);
      if (horiz) { x += len; g.lineTo(x, y); x += j; y += j; g.lineTo(x, y); }
      else { y += len; g.lineTo(x, y); x += j; y += j; g.lineTo(x, y); }
      horiz = !horiz;
    }
    g.stroke();
    g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill();
  }
  // a few pad rows (connector footprints, no markings)
  for (let k = 0; k < 4; k++) {
    const x0 = 40 + R() * 380, y0 = 40 + R() * 420;
    for (let i = 0; i < 10; i++) g.fillRect(x0 + i * 9, y0, 5, 14);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// dial angles (radians, maths convention): cool at the lower left, hot at the lower right
export const DIAL = { cool: (215 * Math.PI) / 180, hot: (-35 * Math.PI) / 180 };

/** Temperature dial face: paper, ink ticks, a GLOW (cool) to EMBER (hot) band, frost and flame marks. No numbers. */
export function gaugeTexture(THREE) {
  const S = 512, [c, g] = canvas(S, S);
  const cx = S / 2, cy = S / 2;
  const P = (a, r) => [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#f4ede2'; g.beginPath(); g.arc(cx, cy, 250, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#000'; g.lineWidth = 16; g.beginPath(); g.arc(cx, cy, 240, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 222, 0, Math.PI * 2); g.stroke();
  // colour band, cool half then hot half (canvas angles are clockwise, so negate)
  const mid = (DIAL.cool + DIAL.hot) / 2;
  g.lineWidth = 34; g.lineCap = 'butt';
  g.strokeStyle = '#ffd21a'; g.beginPath(); g.arc(cx, cy, 182, -DIAL.cool, -mid); g.stroke();
  g.strokeStyle = '#e01010'; g.beginPath(); g.arc(cx, cy, 182, -mid, -DIAL.hot); g.stroke();
  // ticks
  g.strokeStyle = '#000';
  for (let i = 0; i <= 30; i++) {
    const a = DIAL.cool + (DIAL.hot - DIAL.cool) * (i / 30);
    const major = i % 5 === 0;
    g.lineWidth = major ? 7 : 3;
    const [x0, y0] = P(a, major ? 196 : 202), [x1, y1] = P(a, 218);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  // frost mark (cool end)
  const [fx, fy] = P(DIAL.cool + 0.38, 112);
  g.lineWidth = 6; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    const dx = Math.cos(a) * 30, dy = Math.sin(a) * 30;
    g.beginPath(); g.moveTo(fx - dx, fy - dy); g.lineTo(fx + dx, fy + dy); g.stroke();
    for (const s of [-1, 1]) {
      const bx = fx + dx * 0.62 * s, by = fy + dy * 0.62 * s;
      const n1 = a + (s > 0 ? 0 : Math.PI);
      for (const t of [-0.7, 0.7]) {
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(n1 + t) * 12, by + Math.sin(n1 + t) * 12); g.stroke();
      }
    }
  }
  // flame mark (hot end), red so it reads as ember
  const [hx, hy] = P(DIAL.hot - 0.38, 112);
  g.fillStyle = '#e01010';
  g.beginPath();
  g.moveTo(hx, hy - 38);
  g.bezierCurveTo(hx + 30, hy - 8, hx + 26, hy + 26, hx, hy + 30);
  g.bezierCurveTo(hx - 26, hy + 26, hx - 30, hy - 2, hx - 8, hy - 16);
  g.bezierCurveTo(hx - 6, hy - 4, hx + 2, hy - 2, hx, hy - 38);
  g.fill();
  // hub ring
  g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/** Fan-curve plate: speed rises with temperature. Returns the texture and the curve fn (t -> y, both 0..1). */
export const FANCURVE = (t) => 0.12 + 0.1 * t + 0.75 * Math.pow(Math.max(0, (t - 0.35) / 0.65), 1.7);
export const CURVE_BOX = { x0: 0.12, x1: 0.92, y0: 0.84, y1: 0.12 }; // fractions of the plate (y down)
export function curveTexture(THREE) {
  const W = 512, H = 320, [c, g] = canvas(W, H);
  g.fillStyle = '#f4ede2'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#000'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
  const bx = (u) => (CURVE_BOX.x0 + (CURVE_BOX.x1 - CURVE_BOX.x0) * u) * W;
  const by = (v) => (CURVE_BOX.y0 + (CURVE_BOX.y1 - CURVE_BOX.y0) * v) * H;
  g.strokeStyle = '#8a8a8a'; g.lineWidth = 2;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(bx(i / 6), by(0)); g.lineTo(bx(i / 6), by(1)); g.stroke(); }
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(bx(0), by(i / 4)); g.lineTo(bx(1), by(i / 4)); g.stroke(); }
  g.strokeStyle = '#000'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(bx(0), by(1.05)); g.lineTo(bx(0), by(0)); g.lineTo(bx(1.03), by(0)); g.stroke();
  g.strokeStyle = '#e01010'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i <= 60; i++) { const u = i / 60; const x = bx(u), y = by(FANCURVE(u)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  // curve control points (the knobs you drag in the app)
  g.fillStyle = '#000';
  for (const u of [0, 0.35, 0.6, 0.8, 1]) { g.beginPath(); g.arc(bx(u), by(FANCURVE(u)), 9, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
