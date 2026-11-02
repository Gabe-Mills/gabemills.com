// The engraved city for the `code` beat: one tower per language, height = real bytes.
//
//   towers   one merged mesh (one draw). Each tower sinks below the street by uDrop[t]
//            and rises out of it with p, so nothing stretches.
//   windows  one InstancedMesh. Lit GLOW / dark ink, per-tower lit fraction from p,
//            flicker from uTime (ambient, set in update()).
//   ground   a paper street plan (blocks, kerbs, centre dashes) with long engraved tower
//            shadows thrown toward the camera by the low sun.
//   sky      ember, hatched, with a striped HOT sun and oxblood cloud streaks.
//   signs    a paper signboard per repo, hung on its language's tower; `lit` 0..1 spreads
//            GLOW from the centre of the board outward.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { languages, repos } from '../../../data/github';

export const SCALE = 9 / languages[0].bytes; // the tallest language (TypeScript) is 9 units
const LIGHT = new THREE.Vector3(-0.3, 0.45, -0.84).normalize(); // low sun behind the city
const SUN = new THREE.Vector3(-0.22, 0.13, -0.97).normalize();  // where the disc sits in the sky

// Street plan: 4-unit blocks centred on x = 4k, z = 4k - 1; streets 1.4 wide between them.
// The avenue (x = 2) runs from the front of the city to the Other cluster at its far end.
// `pal`/`tone` hint the language colour through the palette only; `angle` is the hatch.
export const SPEC = {
  TypeScript: { x: 0, z: -5, w: 2.0, pal: 'NEUTRAL', tone: 0.95, angle: Math.PI / 2, form: 'deco', swatch: '#F1E9DE' },
  Python:     { x: -4, z: -5, w: 1.8, pal: 'EMBER', tone: 0.9, angle: 0.62, form: 'twin', swatch: '#E4692C' },
  Java:       { x: 4, z: -5, w: 1.7, pal: 'DIM', tone: 0.95, angle: 1.05, form: 'round', swatch: '#9C8D86' },
  CSS:        { x: -4, z: -1, w: 1.7, pal: 'HOT', tone: 0.85, angle: 2.3, form: 'zig', swatch: '#FFC46B' },
  JavaScript: { x: 4, z: -1, w: 1.5, pal: 'EMBER', tone: 0.55, angle: 0.3, form: 'block', swatch: '#A9461A' },
  Astro:      { x: -4, z: 3, w: 1.4, pal: 'DIM', tone: 0.6, angle: 2.75, form: 'block', swatch: '#6E625C' },
  Swift:      { x: 0, z: 3, w: 1.3, pal: 'GLOW', tone: 0.85, angle: 1.3, form: 'block', swatch: '#FFB15E' },
  // the tail: a cluster of small blocks on the block that closes the avenue
  Shell:      { x: 1.55, z: -8.75, w: 0.62, pal: 'NEUTRAL', tone: 0.8, angle: 1.9, form: 'block', minor: true },
  C:          { x: 2.4, z: -8.75, w: 0.62, pal: 'DIM', tone: 0.85, angle: 0.9, form: 'block', minor: true },
  HTML:       { x: 1.55, z: -9.55, w: 0.62, pal: 'EMBER', tone: 0.8, angle: 0.0, form: 'block', minor: true },
  Ruby:       { x: 2.4, z: -9.55, w: 0.62, pal: 'GLOW', tone: 0.8, angle: 2.4, form: 'block', minor: true },
};
export const OTHER_SWATCH = '#080605';

export const TOWERS = languages.map((l, i) => ({ ...SPEC[l.name], name: l.name, bytes: l.bytes, H: l.bytes * SCALE, i }));
const IDX = Object.fromEntries(TOWERS.map((t) => [t.name, t.i]));
export const N = TOWERS.length;

// Repo signboards: which tower, where (world, tower risen), size, and how they hang.
const SIGN_AT = {
  'gabemills.com':     { on: 'TypeScript', pos: [0, 4.35, -3.78], w: 1.5, h: 0.84, mount: 'wall' },
  gcoolers:            { on: 'TypeScript', pos: [1.72, 2.5, -4.35], w: 1.1, h: 0.62, mount: 'blade', wall: 1.0 },
  'MC-Stocks':         { on: 'Java', pos: [2.43, 2.1, -5.5], w: 1.1, h: 0.62, mount: 'blade', wall: 3.15 },
  'homebrew-gcoolers': { on: 'Ruby', pos: [2.0, 1.12, -7.75], w: 1.04, h: 0.58, mount: 'post' },
};
export const SIGNS = repos.map((r) => ({ repo: r, ...SIGN_AT[r.name], t: IDX[SIGN_AT[r.name].on] }));

// ---------------------------------------------------------------- towers
function segmentsFor(t) {
  const { H, w, form } = t;
  if (form === 'deco') return [
    { y0: 0, y1: 0.6 * H, w }, { y0: 0.6 * H, y1: 0.81 * H, w: 0.75 * w }, { y0: 0.81 * H, y1: 0.92 * H, w: 0.48 * w },
    { y0: 0.92 * H, y1: H, w: 0.07 * w, noWin: true },
  ];
  if (form === 'twin') return [
    { y0: 0, y1: 0.56 * H, w }, { y0: 0.56 * H, y1: H, w: 0.38 * w, d: 0.7 * w, dx: -0.26 * w },
    { y0: 0.56 * H, y1: 0.88 * H, w: 0.38 * w, d: 0.7 * w, dx: 0.26 * w },
  ];
  if (form === 'round') return [{ y0: 0, y1: 0.78 * H, w, round: true }, { y0: 0.78 * H, y1: H, w: 0.62 * w, round: true }];
  if (form === 'zig') return [
    { y0: 0, y1: 0.55 * H, w }, { y0: 0.55 * H, y1: 0.72 * H, w: 0.8 * w }, { y0: 0.72 * H, y1: 0.86 * H, w: 0.6 * w },
    { y0: 0.86 * H, y1: H, w: 0.4 * w, noWin: true },
  ];
  return [{ y0: 0, y1: H, w, noWin: t.minor }];
}

export function buildTowers(ctx) {
  const { PAL, GBUF_GLSL } = ctx;
  const parts = [];
  for (const t of TOWERS) {
    for (const s of segmentsFor(t)) {
      const h = Math.max(0.02, s.y1 - s.y0);
      const g = s.round ? new THREE.CylinderGeometry(s.w / 2, s.w / 2, h, 28, 1) : new THREE.BoxGeometry(s.w, h, s.d ?? s.w);
      g.translate(t.x + (s.dx || 0), s.y0 + h / 2, t.z);
      const n = g.attributes.position.count;
      const look = new Float32Array(n * 4), ti = new Float32Array(n);
      for (let k = 0; k < n; k++) { look.set([t.tone, PAL[t.pal], t.angle, s.round ? 1 : 0], k * 4); ti[k] = t.i; }
      g.setAttribute('aLook', new THREE.BufferAttribute(look, 4));
      g.setAttribute('aT', new THREE.BufferAttribute(ti, 1));
      if (g.index) parts.push(g.toNonIndexed()); else parts.push(g);
      g.dispose();
    }
  }
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'aLook', 'aT'].includes(k)) p.deleteAttribute(k);
  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDrop: { value: new Float32Array(N) }, uLight: { value: LIGHT.clone() } },
    vertexShader: /* glsl */ `
      uniform float uDrop[${N}];
      attribute vec4 aLook; attribute float aT;
      varying vec3 vN; varying vec4 vLook; varying vec3 vVN; varying vec3 vView;
      void main() {
        vec3 p = position; p.y -= uDrop[int(aT + 0.5)];
        vN = normalize(mat3(modelMatrix) * normal);
        vVN = normalize(normalMatrix * normal);
        vLook = aLook;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform vec3 uLight;
      varying vec3 vN; varying vec4 vLook; varying vec3 vVN; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN);
        float lam = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(normalize(vVN), normalize(vView)), 0.0), 3.0) * 0.12;
        float shade = vLook.x * (0.3 + 0.75 * lam) + rim;
        float ang = vLook.z;
        if (n.y > 0.7) { ang += 1.2; shade = vLook.x * 0.92; }      // roofs catch the sky
        gl_FragColor = gbuf(shade, vLook.y, ang, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- windows
export function buildWindows(ctx) {
  const { GBUF_GLSL } = ctx;
  const mats = [], info = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(0.13, 0.17, 1), v = new THREE.Vector3();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ROW = 0.3, COL = 0.27;
  for (const t of TOWERS) {
    for (const s of segmentsFor(t)) {
      if (s.noWin) continue;
      const h = s.y1 - s.y0;
      const rows = Math.max(0, Math.floor((h - 0.22) / ROW));
      if (!rows) continue;
      const yStart = s.y0 + (h - (rows - 1) * ROW) / 2;
      if (s.round) {
        const r = s.w / 2 + 0.008, cols = Math.floor((Math.PI * s.w) / COL);
        for (let c = 0; c < cols; c++) {
          const a = (c / cols) * Math.PI * 2;
          for (let k = 0; k < rows; k++) {
            v.set(t.x + Math.sin(a) * r, yStart + k * ROW, t.z + Math.cos(a) * r);
            q.setFromEuler(e.set(0, a, 0));
            mats.push(m.compose(v, q, sc).clone());
            info.push(t.i, rnd(), rnd(), k / rows);
          }
        }
        continue;
      }
      const d = s.d ?? s.w, cx = t.x + (s.dx || 0);
      // four faces: +z, +x, -z, -x
      const faces = [[0, d / 2, s.w], [Math.PI / 2, s.w / 2, d], [Math.PI, d / 2, s.w], [-Math.PI / 2, s.w / 2, d]];
      for (const [rot, off, span] of faces) {
        const cols = Math.max(1, Math.floor((span - 0.14) / COL));
        const x0 = -((cols - 1) * COL) / 2;
        for (let c = 0; c < cols; c++) {
          for (let k = 0; k < rows; k++) {
            const lx = x0 + c * COL;
            v.set(cx + Math.cos(rot) * lx + Math.sin(rot) * (off + 0.008), yStart + k * ROW, t.z - Math.sin(rot) * lx + Math.cos(rot) * (off + 0.008));
            q.setFromEuler(e.set(0, rot, 0));
            mats.push(m.compose(v, q, sc).clone());
            info.push(t.i, rnd(), rnd(), k / rows);
          }
        }
      }
    }
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(info), 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDrop: { value: new Float32Array(N) }, uLit: { value: new Float32Array(N) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uDrop[${N}]; uniform float uLit[${N}];
      attribute vec4 aInfo;
      varying float vLit; varying float vPhase; varying float vSeed;
      void main() {
        int t = int(aInfo.x + 0.5);
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        wp.y -= uDrop[t];
        // windows light from the street up as the lit fraction grows
        float l = uLit[t];
        vLit = step(aInfo.y, l * (1.25 - 0.5 * aInfo.w));
        vPhase = aInfo.z; vSeed = aInfo.y - l;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uTime;
      varying float vLit; varying float vPhase; varying float vSeed;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float k = floor(uTime * (0.7 + vPhase) + vPhase * 31.0);
        float on = vLit;
        if (on > 0.5 && h(vec2(vPhase * 91.0, k)) < 0.07) on = 0.0;                 // a brief outage
        if (on < 0.5 && vSeed < 0.06 && h(vec2(vPhase * 53.0, k + 3.0)) > 0.55) on = 1.0; // someone's still up
        if (on > 0.5) gl_FragColor = gbuf(0.94 - 0.12 * h(vec2(vPhase, 2.0)), PAL_ACCENT, 0.0, 0.0);
        else gl_FragColor = gbuf(0.06, PAL_NEUTRAL, 0.0, 0.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((mm, i) => mesh.setMatrixAt(i, mm));
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- ground: the street plan
export function buildGround(ctx) {
  const { GBUF_GLSL } = ctx;
  const sh = new THREE.Vector2(-LIGHT.x, -LIGHT.z).normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTow: { value: TOWERS.map((t) => new THREE.Vector4(t.x, t.z, t.w / 2, 0)) },
      uShadow: { value: sh },
    },
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform vec4 uTow[${N}]; uniform vec2 uShadow;
      varying vec2 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      bool inShadow(vec2 p) {
        for (int i = 0; i < ${N}; i++) {
          vec4 t = uTow[i];
          float L = t.w * 1.15;
          if (L < 0.01) continue;
          vec2 q = p - t.xy, d = uShadow;
          // the square swept along d for t in [0, L]: intersect the per-axis t intervals
          float a0 = (q.x - t.z) / d.x, a1 = (q.x + t.z) / d.x;
          float b0 = (q.y - t.z) / d.y, b1 = (q.y + t.z) / d.y;
          float lo = max(max(min(a0, a1), min(b0, b1)), 0.0);
          float hi = min(min(max(a0, a1), max(b0, b1)), L);
          if (hi > lo) return true;
        }
        return false;
      }
      void main() {
        vec2 p = vW;
        // block-local coords: block centres at x = 4k, z = 4k - 1
        vec2 cell = floor((p + vec2(2.0, 3.0)) / 4.0);
        vec2 b = p - (cell * 4.0 + vec2(0.0, -1.0));
        float far = length(cell * 4.0 + vec2(0.0, -1.0) - vec2(0.5, -3.0));
        float edge = 15.0 + 9.0 * h(cell);                      // a ragged, mapped edge
        vec2 ab = abs(b);
        bool streetX = ab.x > 1.3, streetZ = ab.y > 1.3;
        // the avenue (x = 2) ends at the block that holds the Other cluster
        if (abs(p.x - 2.0) < 0.75 && p.y < -7.7 && p.y > -10.3) { streetX = false; ab.x = 0.0; }
        bool street = streetX || streetZ;
        float shade = 1.0, hatch = 0.0, ang = 0.0, pal = PAL_NEUTRAL;
        if (!street) {
          shade = 0.5; hatch = 1.0; ang = 0.0;
          float m = max(ab.x, ab.y);
          if (m > 1.14) { shade = 0.92; hatch = 0.2; }                         // pavement
          else if (m > 1.08) { shade = 0.12; hatch = 0.0; }                    // kerb line
          else if (h(cell + 5.0) > 0.74) {                                     // a square: diagonal paths
            shade = 0.64; ang = 0.785;
            if (min(abs(b.x - b.y), abs(b.x + b.y)) < 0.05) { shade = 0.95; hatch = 0.1; }
          }
        } else {
          // centre dashes
          float along = streetX && !streetZ ? p.y : p.x;
          float across = streetX && !streetZ ? ab.x - 2.0 : ab.y - 2.0;
          if (!(streetX && streetZ) && abs(across) < 0.035 && fract(along * 0.9) < 0.45) { shade = 0.18; hatch = 0.0; }
        }
        if (far > edge) { shade = 0.8 - 0.06 * smoothstep(edge, edge + 30.0, far); hatch = 0.6; ang = 0.35; }
        else if (inShadow(p)) { shade = street ? 0.5 : 0.3; hatch = 1.0; ang = 0.785; }
        gl_FragColor = gbuf(shade, pal, ang, hatch);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, -3);
  return mesh;
}

// ---------------------------------------------------------------- sky
export function buildSky(ctx) {
  const { GBUF_GLSL } = ctx;
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSun: { value: SUN.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uTime; uniform vec3 uSun; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 d = normalize(vDir);
        float el = d.y, az = atan(d.x, -d.z);
        float pal = PAL_RED, ang = 0.05, hatch = 1.0;
        float shade = 0.9 - 0.22 * smoothstep(0.05, 0.9, el);
        // lit strata on the horizon: GLOW bars thinning upward
        if (el > -0.02 && el < 0.16 && fract(el / 0.026) > el / 0.16) { pal = PAL_ACCENT; shade = 0.9; ang = 0.0; }
        // the sun, cut by horizontal gaps in its lower half
        float r = acos(clamp(dot(d, uSun), -1.0, 1.0));
        if (r < 0.12) {
          float below = uSun.y - el;
          bool cut = below > 0.0 && fract(below / 0.024) < below / 0.13;
          if (!cut) { pal = PAL_CIELO; shade = 0.98; hatch = 0.15; ang = 0.0; }
        } else if (r < 0.135) { pal = PAL_ACCENT; shade = 0.95; hatch = 0.0; }
        // long oxblood streaks drifting across
        float s = vn(vec2(az * 3.2 + uTime * 0.012, el * 38.0)) * 0.7 + vn(vec2(az * 9.0 - uTime * 0.02, el * 70.0)) * 0.3;
        if (el > 0.02 && el < 0.42 && s > 0.66 + 0.5 * el) { pal = PAL_OXBLOOD; shade = 0.72; ang = 0.02; hatch = 0.9; }
        if (el < -0.02) { pal = PAL_OXBLOOD; shade = 0.6; }
        gl_FragColor = gbuf(shade, pal, ang, hatch);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 24), mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- signboards
function signTexture(sign, index, total) {
  const c = document.createElement('canvas');
  const W = 640, H = Math.round(640 * (sign.h / sign.w));
  c.width = W; c.height = H;
  const t = new THREE.CanvasTexture(c);
  const draw = () => {
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#000'; g.lineWidth = 10; g.strokeRect(14, 14, W - 28, H - 28);
    g.lineWidth = 3; g.strokeRect(32, 32, W - 64, H - 64);
    g.fillStyle = '#000';
    g.font = '500 30px "JetBrains Mono", monospace';
    g.textBaseline = 'alphabetic';
    const k = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}  ${sign.repo.language.toUpperCase()}`;
    g.fillText(k, 60, 84);
    let size = H * 0.4;
    g.font = `400 ${size}px "Instrument Serif", serif`;
    const max = W - 120;
    const w = g.measureText(sign.repo.name).width;
    if (w > max) { size *= max / w; g.font = `400 ${size}px "Instrument Serif", serif`; }
    g.fillText(sign.repo.name, 58, H - 62);
    t.needsUpdate = true;
  };
  draw();
  document.fonts?.ready?.then(draw);
  return t;
}

export function buildSign(ctx, sign, index, total) {
  const { GBUF_GLSL, inkMaterial, flatMaterial, PAL } = ctx;
  const group = new THREE.Group();
  const map = signTexture(sign, index, total);
  const faceMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uLit: { value: 0 }, uAspect: { value: sign.w / sign.h } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform sampler2D uMap; uniform float uLit, uAspect; varying vec2 vUv;
      void main() {
        float lum = dot(texture2D(uMap, vUv).rgb, vec3(0.299, 0.587, 0.114));
        vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
        float reach = uLit * (0.5 * length(vec2(uAspect, 1.0)) + 0.05);
        float pal = PAL_NEUTRAL, shade = lum > 0.5 ? 1.0 : 0.04, hatch = 0.18;
        if (length(c) < reach && lum > 0.5) { pal = PAL_ACCENT; shade = 0.97; hatch = 0.0; }
        gl_FragColor = gbuf(shade, pal, 0.0, hatch);
      }`,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(sign.w, sign.h), faceMat);
  face.position.z = 0.032;
  const ink = inkMaterial({ tone: 0.16, pal: PAL.NEUTRAL, angle: 0.8, hatch: 1 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(sign.w + 0.07, sign.h + 0.07, 0.05), ink);
  group.add(face, frame);
  const lampMat = flatMaterial({ shade: 0.12, pal: PAL.NEUTRAL });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(sign.w * 0.55, 0.045, 0.1), lampMat);
  lamp.position.set(0, sign.h / 2 + 0.11, 0.1);
  const lampArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), ink);
  lampArm.position.set(0, sign.h / 2 + 0.06, 0.05);
  group.add(lamp, lampArm);

  const [x, y, z] = sign.pos;
  if (sign.mount === 'wall') {
    for (const sx of [-0.4, 0.4]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.24), ink);
      st.position.set(sx * sign.w, 0, -0.14);
      group.add(st);
    }
  } else if (sign.mount === 'blade') {
    // an arm out of the facade, the board hanging from it on two rods
    const dir = Math.sign(x - sign.wall);
    const len = Math.abs(x - sign.wall) + sign.w / 2 + 0.06;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), ink);
    arm.position.set(-dir * (len / 2 - sign.w / 2 - 0.06), sign.h / 2 + 0.2, 0);
    group.add(arm);
    for (const sx of [-0.36, 0.36]) {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), ink);
      rod.position.set(sx * sign.w, sign.h / 2 + 0.1, 0);
      group.add(rod);
    }
    lamp.position.y = sign.h / 2 + 0.26; lampArm.position.y = sign.h / 2 + 0.23;
  } else {
    // a street signpost
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, y + sign.h / 2 + 0.35, 0.07), ink);
    post.position.set(-sign.w / 2 - 0.12, (sign.h / 2 + 0.35 - y) / 2, -0.02);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(sign.w + 0.3, 0.05, 0.05), ink);
    arm.position.set(-0.03, sign.h / 2 + 0.3, 0);
    group.add(post, arm);
    for (const sx of [-0.38, 0.38]) {
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.02), ink);
      rod.position.set(sx * sign.w, sign.h / 2 + 0.15, 0);
      group.add(rod);
    }
    lamp.position.y = sign.h / 2 + 0.38; lampArm.position.y = sign.h / 2 + 0.34;
  }
  group.position.set(x, y, z);
  const base = new THREE.Vector3(x, y, z);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3((a * sign.w) / 2, (b * sign.h) / 2, 0.032));
  return {
    group, corners,
    set(drop, lit) {
      group.position.set(base.x, base.y - drop, base.z);
      faceMat.uniforms.uLit.value = lit;
      lampMat.uniforms.uShade.value = lit > 0.08 ? 1 : 0.12;
      lampMat.uniforms.uPal.value = lit > 0.08 ? PAL.GLOW : PAL.NEUTRAL;
    },
    dispose() { map.dispose(); },
  };
}
