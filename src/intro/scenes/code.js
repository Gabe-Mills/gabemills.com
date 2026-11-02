// code (anchor #github), the last beat: "The code, in public." as an engraved city.
// Every language on the GitHub profile is a tower whose height is its real byte count
// (TypeScript tallest); the tail ("Other") is a cluster of small blocks closing the avenue.
// The four public repos hang as paper signboards on their language's tower.
//   0    -> 0.25  title over a high aerial view; the towers rise out of the street plan
//   0.25 -> 0.70  the camera dives down the TypeScript facade and along the avenue past
//                 each signboard in turn; each board lights and its label pops as it passes
//   0.70 -> 0.90  pull back to a wide hero view: profile card and map legend
//   0.90 -> 1     a slow push while the story fades to the site ground
// progress(p) is a pure function of p. update() only flickers windows and drifts clouds.
import '../code.css';
import { TOWERS, SIGNS, N, buildTowers, buildWindows, buildGround, buildSky, buildSign } from './lib/code-city.js';
import { makeCodeDom } from './lib/code-dom.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SLOTS = [0.33, 0.43, 0.53, 0.64]; // when the camera is at each signboard

// camera keyframes: time, position, look target, phone pull-back factor (along the view)
const KEYS = [
  { t: 0,    pos: [3, 30, 13],         look: [0.5, 0, -3.5],      f: 1.05 },
  { t: 0.21, pos: [6, 18.5, 12],       look: [0.4, 1.8, -4.2],    f: 1.1 },
  { t: SLOTS[0], pos: [1.3, 5.0, 1.7], look: [0, 4.35, -3.78],    f: 1.6 },
  { t: SLOTS[1], pos: [2.35, 2.75, -0.2], look: [1.72, 2.5, -4.35], f: 1.6 },
  { t: SLOTS[2], pos: [1.8, 1.85, -1.7], look: [2.43, 2.1, -5.5], f: 1.6 },
  { t: SLOTS[3], pos: [1.85, 0.95, -4.5], look: [2.0, 1.05, -7.75], f: 1.5 },
  { t: 0.73, pos: [2.6, 3.6, 3.0],     look: [1.2, 2.4, -5],      f: 1.8 },
  { t: 0.82, pos: [13.6, 10.4, 29.5],  look: [0.6, 2.7, -3.8],    f: 1.35 },
  { t: 1.0,  pos: [12.6, 9.8, 27.4],   look: [0.6, 2.8, -3.8],    f: 1.35 },
];

export function create(ctx) {
  const { THREE, engine } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);

  const sky = buildSky(ctx);
  const ground = buildGround(ctx);
  const towers = buildTowers(ctx);
  const windows = buildWindows(ctx);
  scene.add(sky, ground, towers, windows);
  const signs = SIGNS.map((s, i) => buildSign(ctx, s, i, SIGNS.length));
  signs.forEach((s) => scene.add(s.group));
  const dom = makeCodeDom(ctx);

  const drop = towers.material.uniforms.uDrop.value;
  const wDrop = windows.material.uniforms.uDrop.value;
  const wLit = windows.material.uniforms.uLit.value;
  const tow = ground.material.uniforms.uTow.value;
  const rise = new Float32Array(N);

  // camera path, rebuilt in place from KEYS each frame (the phone pull-back depends on aspect)
  const posPts = KEYS.map(() => new THREE.Vector3());
  const lookPts = KEYS.map(() => new THREE.Vector3());
  const posPath = new THREE.CatmullRomCurve3(posPts, false, 'centripetal');
  const lookPath = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal');
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), v = new THREE.Vector3();
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  const labelState = SIGNS.map(() => ({ v: 0, rect: null }));
  const rects = SIGNS.map(() => [0, 0, 0, 0]);
  const domState = { head: 0, card: 0, legend: 0, labels: labelState };

  function signRect(i) {
    const s = signs[i], r = rects[i];
    s.group.updateMatrixWorld(true);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const W = engine.width, H = engine.height;
    for (const c of s.corners) {
      v.copy(c).applyMatrix4(s.group.matrixWorld);
      const behind = v.applyMatrix4(camera.matrixWorldInverse).z > -0.05;
      if (behind) return null;
      v.applyMatrix4(camera.projectionMatrix);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (x1 < 0 || x0 > W || y1 < 0 || y0 > H) return null;
    r[0] = x0; r[1] = y0; r[2] = x1; r[3] = y1;
    return r;
  }

  return {
    scene, camera,
    enter() { dom.enter(); },
    progress(p) {
      const W = engine.width, H = engine.height, A = W / H, phone = W < 760;
      // portrait: widen the lens a little and pull back along each view
      const narrow = Math.min(1, Math.max(0, (1.3 - A) / 0.84));
      const fov = 40 + 10 * narrow;
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }

      // ---- the city rises: biggest first, each tower sliding up out of the street
      for (let i = 0; i < N; i++) {
        const r = smooth(0.01 + 0.013 * i, 0.16 + 0.013 * i, p);
        rise[i] = r;
        const d = (1 - r) * (TOWERS[i].H + 0.02);
        drop[i] = d; wDrop[i] = d;
        tow[i].w = TOWERS[i].H * r;
      }

      // ---- signboards light as the camera reaches them, and stay lit
      const hero = smooth(0.7, 0.8, p);
      for (let i = 0; i < N; i++) wLit[i] = 0.08 + 0.1 * rise[i] + 0.18 * hero;
      SIGNS.forEach((s, j) => {
        const lit = smooth(SLOTS[j] - 0.07, SLOTS[j] - 0.015, p);
        const pass = smooth(SLOTS[j] - 0.06, SLOTS[j], p) * (1 - smooth(SLOTS[j] + 0.03, SLOTS[j] + 0.1, p));
        wLit[s.t] = Math.min(0.85, wLit[s.t] + 0.5 * pass);
        const sd = (1 - rise[s.t]) * Math.max(TOWERS[s.t].H, s.pos[1] + s.h + 0.4);
        signs[j].set(sd, lit);
      });

      // ---- camera
      for (let k = 0; k < KEYS.length; k++) {
        const K = KEYS[k], f = 1 + (K.f - 1) * narrow;
        lookPts[k].fromArray(K.look);
        posPts[k].fromArray(K.pos).sub(lookPts[k]).multiplyScalar(f).add(lookPts[k]);
      }
      let seg = 0;
      while (seg < KEYS.length - 2 && p >= KEYS[seg + 1].t) seg++;
      const x = Math.min(1, Math.max(0, (p - KEYS[seg].t) / (KEYS[seg + 1].t - KEYS[seg].t)));
      const ex = seg === 0 ? x : x + (x * x * (3 - 2 * x) - x) * 0.8; // hold a beat at each board
      const u = (seg + ex) / (KEYS.length - 1);
      posPath.getPoint(u, camPos);
      lookPath.getPoint(u, look);
      camPos.x += par.x; camPos.y += par.y;
      camera.position.copy(camPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(look);
      // frame the subject around the type: phones lift it above the bottom label/card,
      // desktop nudges the aerial city right of the title
      const aerial = 1 - smooth(0.2, 0.3, p);
      const fly = smooth(0.24, 0.32, p) * (1 - smooth(0.68, 0.78, p));
      const ox = phone ? 0 : -0.1 * W * aerial - 0.025 * W * hero;
      const oy = H * (phone ? -0.11 * aerial + 0.15 * fly + 0.07 * hero : -0.07 * aerial);
      camera.setViewOffset(W, H, ox, oy, W, H);
      camera.updateMatrixWorld();
      sky.position.copy(camPos);

      // ---- DOM
      domState.head = smooth(0.015, 0.075, p) * (1 - smooth(0.19, 0.245, p));
      // the story fades the canvas to the site ground after p = 1; the plates go with it
      const dark = smooth(0.05, 0.6, engine.ink?.uniforms?.uDark?.value ?? 0);
      domState.card = smooth(0.72, 0.785, p) * (1 - dark);
      domState.legend = smooth(0.735, 0.8, p) * (1 - dark);
      SIGNS.forEach((_, j) => {
        const s = SLOTS[j];
        // windows just touch, so two labels are never up at once
        const lv = smooth(s - 0.055, s - 0.03, p) * (1 - smooth(s + 0.02, s + 0.045, p));
        labelState[j].v = lv;
        labelState[j].rect = lv > 0.002 ? signRect(j) : null;
      });
      dom.update(domState);
    },
    update(dt, time) {
      windows.material.uniforms.uTime.value = time;
      sky.material.uniforms.uTime.value = time;
      const k = Math.min(1, dt * 3);
      par.x += (par.tx - par.x) * k; par.y += (par.ty - par.y) * k;
    },
    pointer(nx, ny) { par.tx = nx * 0.12; par.ty = ny * 0.08; },
    exit() { dom.exit(); camera.clearViewOffset(); },
    dispose() {
      dom.dispose();
      signs.forEach((s) => s.dispose());
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    },
  };
}
