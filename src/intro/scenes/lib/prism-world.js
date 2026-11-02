// Prism SMP set: floating voxel islands in an ember sky, Minecraft-style block clouds,
// a big engraved glass prism splitting a GLOW beam into a palette "spectrum", and the
// nine orbiting plugin blocks. Everything writes the G-buffer (see core/gbuffer.js).
import * as THREE from 'three';

const LIGHT = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();

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

// block kinds (aInfo.w)
export const KIND = { PLAIN: 0, GRASS: 1, LAVA: 2, LEAVES: 3, GLOW: 4 };

/**
 * Voxel material. Two paths:
 *  - plain Mesh + InstancedBufferGeometry: per-instance aPos (block centre), aInfo, and a
 *    per-island drift offset uOff[aInfo.z] (islands drift as a function of p).
 *  - InstancedMesh (USE_INSTANCING): instanceMatrix places/rotates each block.
 * aInfo = (tone, palette, island, kind). Faces get fixed hatch directions so every cube
 * edge is a hatch-direction break, which the ink pass outlines: crisp voxels.
 */
export function voxelMaterial(ctx, { isles = 1, size = 1 } = {}) {
  const offs = Array.from({ length: isles }, () => new THREE.Vector3());
  return new THREE.ShaderMaterial({
    defines: { ISLES: isles },
    uniforms: {
      uOff: { value: offs },
      uSize: { value: size },
      uLight: { value: LIGHT.clone() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo;
      varying vec3 vN; varying vec3 vLN; varying vec3 vL; varying vec4 vInfo; varying float vSeed;
      #ifndef USE_INSTANCING
      attribute vec3 aPos;
      uniform vec3 uOff[ISLES];
      uniform float uSize;
      #endif
      void main() {
        vLN = normal; vL = position; vInfo = aInfo;
        #ifdef USE_INSTANCING
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vSeed = fract(sin(float(gl_InstanceID) * 12.9898 + 4.1) * 43758.5453);
        #else
        vec3 off = vec3(0.0);
        int k = int(aInfo.z + 0.5);
        for (int i = 0; i < ISLES; i++) { if (i == k) off = uOff[i]; }
        vec4 wp = modelMatrix * vec4(aPos + off + position * uSize, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vSeed = fract(sin(dot(aPos, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform vec3 uLight; uniform float uTime;
      varying vec3 vN; varying vec3 vLN; varying vec3 vL; varying vec4 vInfo; varying float vSeed;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 a = abs(vLN);
        vec2 uv; float ang;
        if (a.y > 0.5) { uv = vL.xz; ang = 0.12; }
        else if (a.x > 0.5) { uv = vL.zy; ang = 1.5707963; }
        else { uv = vL.xy; ang = 0.95; }
        vec2 px = floor((uv + 0.5) * 8.0);
        float n = h(px + vSeed * 61.0);
        float tone = vInfo.x, pal = vInfo.y, kind = vInfo.w, hatch = 1.0, em = 0.0;
        bool top = vLN.y > 0.5;
        if (kind > 0.5 && kind < 1.5) {
          // grass block: paper top, paper lip with a ragged pixel edge down the sides
          float lip = 0.5 - (0.16 + 0.1 * step(0.55, h(vec2(px.x, 3.0) + vSeed * 17.0)));
          if (top || (a.y < 0.5 && vL.y > lip)) tone = 0.98;
        } else if (kind > 1.5 && kind < 2.5) {
          pal = PAL_RED; tone = 0.9 + 0.1 * n; hatch = 0.55;
          em = 0.28 + 0.07 * sin(uTime * 2.2 + vSeed * 20.0 + px.x * 0.7);
        } else if (kind > 2.5 && kind < 3.5) {
          tone *= n < 0.3 ? 0.4 : 1.0;
        } else if (kind > 3.5) {
          em = 0.42; hatch = 0.45;
        }
        tone *= 0.9 + 0.2 * n;
        float lam = max(dot(normalize(vN), uLight), 0.0);
        float shade = tone * (0.16 + 0.84 * lam) + em;
        float e = max(abs(uv.x), abs(uv.y));
        shade *= mix(1.0, 0.42, smoothstep(0.43, 0.48, e));
        gl_FragColor = gbuf(shade, pal, ang, hatch);
      }`,
  });
}

/**
 * Floating islands from specs { c:[x,y,z], R, H, seed, trees, flat, lava:{i,j,r}, fall }.
 * Only exposed blocks are kept. Returns { geometry, count }.
 */
export function buildIslands(specs, S, PAL) {
  const pos = [], info = [];
  const push = (c, i, y, j, tone, pal, isle, kind) => {
    pos.push(c[0] + i * S, c[1] + y * S, c[2] + j * S);
    info.push(tone, pal, isle, kind);
  };
  specs.forEach((sp, isle) => {
    const r = rng(sp.seed * 7919 + 13);
    const R = sp.R, ph = sp.seed * 1.37;
    const cols = new Map();
    const key = (i, j) => (i + 200) * 1000 + (j + 200);
    for (let i = -R - 3; i <= R + 3; i++) {
      for (let j = -R - 3; j <= R + 3; j++) {
        const ang = Math.atan2(j, i);
        const rr = R * (0.84 + 0.17 * Math.sin(ang * 3 + ph) + 0.09 * Math.sin(ang * 5 + ph * 2.3));
        const d = Math.hypot(i, j);
        if (d > rr) continue;
        const f = 1 - d / rr;
        const top = sp.flat ? 0 : Math.round((Math.sin(i * 0.7 + ph) + Math.cos(j * 0.6 + ph)) * 0.55 * f + f * 1.1);
        const depth = Math.max(1, Math.round(sp.H * Math.pow(f, 0.6) + r() * 1.7));
        cols.set(key(i, j), { i, j, top, bot: top - depth + 1, f, lava: false });
      }
    }
    if (sp.lava) {
      for (const col of cols.values()) {
        if (Math.hypot(col.i - sp.lava.i, col.j - sp.lava.j) <= sp.lava.r) { col.lava = true; col.top -= 1; }
      }
    }
    const covers = (i, y, j) => { const c = cols.get(key(i, j)); return c && y <= c.top && y >= c.bot; };
    for (const col of cols.values()) {
      for (let y = col.top; y >= col.bot; y--) {
        const exposed = y === col.top || y === col.bot ||
          !covers(col.i + 1, y, col.j) || !covers(col.i - 1, y, col.j) || !covers(col.i, y, col.j + 1) || !covers(col.i, y, col.j - 1);
        if (!exposed) continue;
        const layer = col.top - y;
        if (layer === 0 && col.lava) push(sp.c, col.i, y, col.j, 0.95, PAL.EMBER, isle, 2);
        else if (layer === 0) push(sp.c, col.i, y, col.j, 0.62, PAL.NEUTRAL, isle, 1);
        else if (layer < 3) push(sp.c, col.i, y, col.j, 0.6, PAL.NEUTRAL, isle, 0);
        else if (r() < 0.07) push(sp.c, col.i, y, col.j, 0.85, PAL.DIM, isle, 0);
        else push(sp.c, col.i, y, col.j, 0.47, PAL.NEUTRAL, isle, 0);
      }
    }
    // a lavafall pouring off the island's edge, down past its keel
    if (sp.fall) {
      const j = sp.fall.j;
      let edge = null;
      for (const col of cols.values()) if (col.j === j && (!edge || col.i > edge.i)) edge = col;
      if (edge) {
        // a channel of lava from the pool to the edge, then the fall
        for (let i = sp.lava.i; i <= edge.i; i++) {
          const c = cols.get(key(i, j));
          if (c && !c.lava) push(sp.c, i, c.top + 0.02, j, 0.95, PAL.EMBER, isle, 2);
        }
        for (let y = edge.top; y >= edge.bot - sp.fall.len; y--) push(sp.c, edge.i + 1, y, j, 0.95, PAL.EMBER, isle, 2);
      }
    }
    // blocky trees
    const spots = [...cols.values()].filter((c) => c.f > 0.35 && !c.lava);
    for (let t = 0; t < (sp.trees || 0) && spots.length; t++) {
      const c = spots[Math.floor(r() * spots.length)];
      if (sp.lava && Math.hypot(c.i - sp.lava.i, c.j - sp.lava.j) < sp.lava.r + 2) continue;
      const tall = 3 + Math.floor(r() * 2);
      for (let y = 1; y <= tall; y++) push(sp.c, c.i, c.top + y, c.j, 0.3, PAL.NEUTRAL, isle, 0);
      for (let dy = tall - 1; dy <= tall; dy++) {
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;
          if (Math.abs(di) + Math.abs(dj) === 2 && dy === tall && r() < 0.5) continue;
          push(sp.c, c.i + di, c.top + dy, c.j + dj, 0.88, PAL.NEUTRAL, isle, 3);
        }
      }
      push(sp.c, c.i, c.top + tall + 1, c.j, 0.88, PAL.NEUTRAL, isle, 3);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) push(sp.c, c.i + di, c.top + tall + 1, c.j + dj, 0.88, PAL.NEUTRAL, isle, 3);
    }
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry().copy(box);
  box.dispose();
  geometry.instanceCount = pos.length / 3;
  geometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(info), 4));
  return { geometry, count: pos.length / 3 };
}

/** Ember sky dome: deeper toward zenith and the void below, flat blocky clouds above and a cloud sea below. */
export function skyDome(ctx, radius = 150) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uTime; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float cloud(vec2 cell, float seed){ return vn(cell * 0.21 + seed) * 0.7 + vn(cell * 0.53 + seed * 2.0) * 0.3; }
      void main(){
        vec3 d = normalize(vDir);
        float el = d.y;
        float pal = PAL_RED, ang = 0.06, hatch = 1.0;
        float shade = 0.9 - 0.2 * smoothstep(0.12, 0.95, el);
        if (el < 0.0) shade = 0.9 - 0.2 * smoothstep(0.0, -0.45, el);
        // the void far below: oxblood, with a stepped (pixel) edge
        float az = atan(d.x, -d.z);
        float stepEdge = -0.62 + 0.05 * floor(h(vec2(floor(az * 14.0), 2.0)) * 3.0);
        if (el < stepEdge) { pal = PAL_OXBLOOD; shade = 0.72; }
        float ae = abs(el);
        if (ae > 0.1) {
          bool up = el > 0.0;
          vec2 q = d.xz / ae * (up ? 5.0 : 6.5);
          q.x += uTime * (up ? 0.12 : 0.07);
          vec2 cell = floor(q);
          float c = cloud(cell, up ? 0.0 : 37.0);
          float thr = up ? 0.6 : 0.57;
          float fade = smoothstep(0.1, 0.22, ae);
          if (c > thr && h(cell + 9.0) < fade) {
            pal = PAL_NEUTRAL; hatch = 0.45; ang = 0.0;
            // thickness: the cell on the near (lower) side is a shadow face
            float below = cloud(cell + vec2(0.0, up ? 1.0 : -1.0), up ? 0.0 : 37.0);
            shade = up ? 0.97 : 0.86;
            if (below <= thr && fract(q.y) > (up ? 0.62 : 0.0) && fract(q.y) < (up ? 1.0 : 0.38)) shade = 0.42;
          }
        }
        gl_FragColor = gbuf(shade, pal, ang, hatch);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * The glass prism with its beam. A triangular prism (equilateral cross-section, apex up,
 * extruded along local z), paper glass with ink edges and a bright bevel glint. The beam
 * lies in the front-face plane: a GLOW beam from the upper left hits the left face, runs
 * through the glass, and fans out of the right face as four palette bands.
 * setFlare(f) widens and brightens everything (the wipe). Returns { group, setFlare, setTime }.
 */
export function makePrism(ctx, { side = 3, depth = 1.6, inLen = 26, outLen = 42 } = {}) {
  const { PAL } = ctx;
  const s = side, hgt = (s * Math.sqrt(3)) / 2, dz = depth / 2;
  const A = [0, (2 * hgt) / 3], BL = [-s / 2, -hgt / 3], BR = [s / 2, -hgt / 3];

  // ---- glass body ----
  const P = [], N = [], E = [], L2 = [];
  const tri = (pts, nz) => {
    for (const [k, p] of pts.entries()) {
      P.push(p[0], p[1], nz * dz); N.push(0, 0, nz);
      const b = [0, 0, 0]; b[k] = hgt; E.push(b[0], b[1], b[2], -1); L2.push(p[0], p[1]);
    }
  };
  tri([BL, BR, A], 1);
  tri([BL, A, BR], -1);
  const quad = (p, q) => {
    // side face along edge p->q, extruded in z
    const ex = q[0] - p[0], ey = q[1] - p[1], len = Math.hypot(ex, ey);
    let nx = ey / len, ny = -ex / len;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (nx * mx + ny * (my - 0) < 0) { nx = -nx; ny = -ny; }
    const v = [[p, -1, 0, 0], [q, -1, len, 0], [q, 1, len, depth], [p, -1, 0, 0], [q, 1, len, depth], [p, 1, 0, depth]];
    for (const [pt, zz, u, w] of v) {
      P.push(pt[0], pt[1], zz * dz); N.push(nx, ny, 0); E.push(u, w, len, depth); L2.push(u, w);
    }
  };
  quad(BL, A); quad(A, BR); quad(BR, BL);
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  bodyGeo.setAttribute('aE', new THREE.Float32BufferAttribute(E, 4));
  bodyGeo.setAttribute('aL', new THREE.Float32BufferAttribute(L2, 2));
  const bodyMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uLight: { value: LIGHT.clone() }, uFlare: { value: 0 }, uSide: { value: s } },
    vertexShader: /* glsl */ `
      attribute vec4 aE; attribute vec2 aL;
      varying vec4 vE; varying vec2 vL; varying vec3 vN; varying vec3 vLN;
      void main(){
        vE = aE; vL = aL; vLN = normal; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform vec3 uLight; uniform float uFlare, uSide;
      varying vec4 vE; varying vec2 vL; varying vec3 vN; varying vec3 vLN;
      void main(){
        bool triFace = vE.w < 0.0;
        float e = triFace ? min(min(vE.x, vE.y), vE.z) : min(min(vE.x, vE.z - vE.x), min(vE.y, vE.w - vE.y));
        vec3 n = normalize(vN);
        float lam = max(dot(n, uLight), 0.0);
        float tone = triFace ? 1.2 : 1.0;
        float shade = tone * (0.22 + 0.78 * lam);
        float ang;
        if (triFace) {
          ang = 1.05;
          // glass: two diagonal reflection streaks across the face
          float r = (vL.x * 0.7 + vL.y) / uSide;
          float streak = max(1.0 - smoothstep(0.05, 0.075, abs(r - 0.12)), 1.0 - smoothstep(0.018, 0.03, abs(r + 0.2)));
          shade = mix(shade, 1.0, streak);
        } else {
          ang = vLN.y < -0.5 ? 0.0 : (vLN.x < 0.0 ? 2.15 : 0.95);
        }
        // strong ink edges, a bright bevel glint just inside them
        float edge = 1.0 - smoothstep(0.045, 0.075, e);
        float glint = smoothstep(0.085, 0.1, e) * (1.0 - smoothstep(0.12, 0.15, e));
        shade = max(mix(shade, 0.05, edge), glint * 1.0);
        shade = mix(shade, max(shade, 0.92), uFlare * (1.0 - edge));
        gl_FragColor = gbuf(shade, PAL_NEUTRAL, ang, 1.0);
      }`,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  // ---- beam: 7 quads (incoming halo + core, through-glass band, 4 spectrum bands) ----
  const Q = 7, V = Q * 6;
  const bPos = new Float32Array(V * 3);
  const bAlong = new Float32Array(V);
  const bMeta = new Float32Array(V * 3); // pal, shade, flow direction
  const beamGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(bPos, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  beamGeo.setAttribute('position', posAttr);
  const alongAttr = new THREE.BufferAttribute(bAlong, 1);
  alongAttr.setUsage(THREE.DynamicDrawUsage);
  beamGeo.setAttribute('aAlong', alongAttr);
  beamGeo.setAttribute('aMeta', new THREE.BufferAttribute(bMeta, 3));
  const beamMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uFlare: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aAlong; attribute vec3 aMeta;
      varying float vAlong; varying vec3 vMeta;
      void main(){ vAlong = aAlong; vMeta = aMeta; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uTime, uFlare;
      varying float vAlong; varying vec3 vMeta;
      void main(){
        float shade = vMeta.y + 0.05 * sin(vAlong * 2.4 - uTime * 3.0 * vMeta.z);
        shade = mix(shade, 1.0, uFlare * 0.85);
        vec2 g = vec2(dFdx(vAlong), dFdy(vAlong));
        float ang = atan(g.y, g.x);
        float hatch = mix(0.7, 0.15, uFlare);
        gl_FragColor = gbuf(shade, vMeta.x, ang, hatch);
      }`,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.frustumCulled = false;

  // static per-quad metadata
  const META = [
    [PAL.GLOW, 0.8, -1],  // incoming halo (flows toward the prism)
    [PAL.HOT, 1.0, -1],   // incoming core
    [PAL.GLOW, 0.97, 1],  // through the glass
    [PAL.HOT, 1.0, 1], [PAL.GLOW, 0.92, 1], [PAL.EMBER, 0.6, 1], [PAL.DIM, 0.8, 1],
  ];
  for (let q = 0; q < Q; q++) for (let k = 0; k < 6; k++) bMeta.set(META[q], (q * 6 + k) * 3);

  const zf = dz + 0.02;
  const ZQ = [zf - 0.01, zf + 0.005, zf, zf, zf, zf, zf];
  // intersection of P + d*t with Q + e*u (2D)
  const hit = (p, d, q, e) => {
    const den = d[0] * e[1] - d[1] * e[0];
    const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  };
  const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
  const eL = norm([A[0] - BL[0], A[1] - BL[1]]);
  const eR = norm([A[0] - BR[0], A[1] - BR[1]]);
  const Ein = [BL[0] + eL[0] * s * 0.56, BL[1] + eL[1] * s * 0.56];
  const X = [BR[0] + eR[0] * s * 0.44, BR[1] + eR[1] * s * 0.44];
  const inA = 0.42;
  const u = [-Math.cos(inA), Math.sin(inA)];
  const n = [-u[1], u[0]];

  // quad writer: near edge (a0, a1) -> far edge (b0, b1), along 0 at near, len at far
  const writeQuad = (q, a0, a1, b0, b1, len) => {
    const z = ZQ[q];
    const vs = [[a0, 0], [a1, 0], [b1, len], [a0, 0], [b1, len], [b0, len]];
    for (let k = 0; k < 6; k++) {
      const [pt, al] = vs[k], o = (q * 6 + k) * 3;
      bPos[o] = pt[0]; bPos[o + 1] = pt[1]; bPos[o + 2] = z;
      bAlong[q * 6 + k] = al;
    }
  };

  let lastF = -1;
  function setFlare(f) {
    if (Math.abs(f - lastF) < 1e-4) return;
    lastF = f;
    bodyMat.uniforms.uFlare.value = f;
    beamMat.uniforms.uFlare.value = f;
    const wc = 0.22 * (1 + 4 * f), wh = 0.6 * (1 + 7 * f);
    // incoming: near ends sit exactly on the left face edge
    for (const [q, w] of [[0, wh], [1, wc]]) {
      const p0 = [Ein[0] + n[0] * w / 2, Ein[1] + n[1] * w / 2];
      const p1 = [Ein[0] - n[0] * w / 2, Ein[1] - n[1] * w / 2];
      const a0 = hit(p0, u, BL, eL), a1 = hit(p1, u, BL, eL);
      writeQuad(q, a0, a1, [p0[0] + u[0] * inLen, p0[1] + u[1] * inLen], [p1[0] + u[0] * inLen, p1[1] + u[1] * inLen], inLen);
    }
    // through the glass: left-edge entry -> right-edge exit, widening
    const wOut = 0.62 * (1 + 1.4 * f);
    const c0 = [Ein[0] + n[0] * wc / 2, Ein[1] + n[1] * wc / 2], c1 = [Ein[0] - n[0] * wc / 2, Ein[1] - n[1] * wc / 2];
    const i0 = hit(c0, u, BL, eL), i1 = hit(c1, u, BL, eL);
    const xTop = [X[0] + eR[0] * wOut / 2, X[1] + eR[1] * wOut / 2], xBot = [X[0] - eR[0] * wOut / 2, X[1] - eR[1] * wOut / 2];
    writeQuad(2, i0, i1, xTop, xBot, s * 0.5);
    // the spectrum: four bands fanning down-right from the exit edge
    const spread = 0.46 * (1 + 1.6 * f), top = -0.06 + 0.3 * f;
    for (let b = 0; b < 4; b++) {
      const t0 = b / 4, t1 = (b + 1) / 4;
      const nA = [xTop[0] + (xBot[0] - xTop[0]) * t0, xTop[1] + (xBot[1] - xTop[1]) * t0];
      const nB = [xTop[0] + (xBot[0] - xTop[0]) * t1, xTop[1] + (xBot[1] - xTop[1]) * t1];
      const th0 = top - spread * t0, th1 = top - spread * t1;
      const fA = [X[0] + Math.cos(th0) * outLen, X[1] + Math.sin(th0) * outLen];
      const fB = [X[0] + Math.cos(th1) * outLen, X[1] + Math.sin(th1) * outLen];
      writeQuad(3 + b, nA, nB, fA, fB, outLen);
    }
    posAttr.needsUpdate = true;
    alongAttr.needsUpdate = true;
  }
  setFlare(0);
  beamGeo.computeBoundingSphere();

  const group = new THREE.Group();
  group.add(body, beam);
  return {
    group,
    setFlare,
    setTime(t) { beamMat.uniforms.uTime.value = t; },
    dispose() { bodyGeo.dispose(); bodyMat.dispose(); beamGeo.dispose(); beamMat.dispose(); },
  };
}
