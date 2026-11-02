// Procedural fracture, no Blender. A fluted column is cut into drums (tilted planar
// cuts at jittered heights) and each drum into 3-4 wedges around a jittered centre.
// Every chunk is a closed mesh with two material groups:
//   0 = the fluted outer wall (paper, vertical hatch, ink crack lines grow with uCrack)
//   1 = the fresh broken faces (darker ink, surface-following cross-hatch)
// set(t, lift) places every chunk on a precomputed ballistic path: t 0 = intact,
// 1 = exploded. `lift` (0..1) is the pre-explosion hover used while the visitor holds.
// No per-frame allocation.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const LIGHT = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();

export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Outer-wall material: inkMaterial lighting plus jagged ink cracks along chunk borders. */
export function crackMaterial(ctx, { tone = 0.97, pal = ctx.PAL.NEUTRAL, angle = Math.PI / 2, hatch = 1, rim = 0.12, crackWidth = 0.03 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTone: { value: tone }, uPal: { value: pal }, uAngle: { value: angle }, uHatch: { value: hatch },
      uRim: { value: rim }, uLight: { value: LIGHT.clone() }, uCrack: { value: 0 }, uCrackW: { value: crackWidth },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aD; attribute vec2 aUV; attribute float aSeed; attribute vec3 aL;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView;
      varying vec4 vD; varying vec2 vUV; varying float vSeed; varying vec3 vL;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vVN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vD = aD; vUV = aUV; vSeed = aSeed; vL = aL;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uTone, uPal, uAngle, uHatch, uRim, uCrack, uCrackW; uniform vec3 uLight;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView;
      varying vec4 vD; varying vec2 vUV; varying float vSeed; varying vec3 vL;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 n = normalize(vN);
        float lam = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(normalize(vVN), normalize(vView)), 0.0), 3.0) * uRim;
        float shade = uTone * (0.3 + 0.7 * lam) + rim;
        // jagged crack lines: chunk borders first, then one stray crack across the face
        float jag = vnoise(vUV * vec2(7.0, 5.0) + vSeed * 31.0);
        float rv = clamp((uCrack - vSeed * 0.55) / 0.35, 0.0, 1.0);
        float d = min(min(vD.x, vD.y), min(vD.z, vD.w));
        float crack = float(d < uCrackW * rv * (0.3 + 1.4 * jag));
        float dl = abs(dot(vL.xy, vUV) - vL.z) + (jag - 0.5) * 0.06;
        float rv2 = clamp((uCrack - 0.3 - vSeed * 0.45) / 0.3, 0.0, 1.0);
        crack = max(crack, float(dl < uCrackW * 0.55 * rv2));
        shade = mix(shade, 0.0, crack);
        gl_FragColor = gbuf(shade, uPal, uAngle, uHatch);
      }`,
  });
}

// ---------------------------------------------------------------------------------------
// chunk builder (non-indexed, explicit normals, two groups)

class ChunkBuilder {
  constructor() { this.wall = []; this.inner = []; }
  // wall vertex: pos(3) nrm(3) d(4) uv(2)
  w(p, n, d, uv) { this.wall.push(p[0], p[1], p[2], n[0], n[1], n[2], d[0], d[1], d[2], d[3], uv[0], uv[1]); }
  tri(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) this.inner.push(p[0], p[1], p[2], nx, ny, nz);
  }
  build(seed, line) {
    const nw = this.wall.length / 12, ni = this.inner.length / 6, n = nw + ni;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), d = new Float32Array(n * 4);
    const uv = new Float32Array(n * 2), sd = new Float32Array(n), ln = new Float32Array(n * 3);
    for (let i = 0; i < nw; i++) {
      const o = i * 12;
      pos.set(this.wall.slice(o, o + 3), i * 3);
      nrm.set(this.wall.slice(o + 3, o + 6), i * 3);
      d.set(this.wall.slice(o + 6, o + 10), i * 4);
      uv.set(this.wall.slice(o + 10, o + 12), i * 2);
    }
    for (let i = 0; i < ni; i++) {
      const o = i * 6, k = nw + i;
      pos.set(this.inner.slice(o, o + 3), k * 3);
      nrm.set(this.inner.slice(o + 3, o + 6), k * 3);
      d.set([9, 9, 9, 9], k * 4);
    }
    sd.fill(seed);
    for (let i = 0; i < n; i++) ln.set(line, i * 3);
    // centre the chunk so it spins about itself
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
    for (let i = 0; i < n; i++) { pos[i * 3] -= cx; pos[i * 3 + 1] -= cy; pos[i * 3 + 2] -= cz; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aD', new THREE.BufferAttribute(d, 4));
    g.setAttribute('aUV', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    g.setAttribute('aL', new THREE.BufferAttribute(ln, 3));
    g.addGroup(0, nw, 0);
    g.addGroup(nw, ni, 1);
    g.computeBoundingSphere();
    return { geometry: g, centre: new THREE.Vector3(cx, cy, cz) };
  }
}

/**
 * Shared ballistic system. chunk: { mesh, base: Vector3, radial: Vector3, vel, spin, delay, lift }
 * set(t, lift): t 0..1 maps to `duration` seconds of flight.
 */
function chunkSystem(chunks, { duration = 1.4, accel = new THREE.Vector3(0, 4, 0), maxDelay = 0.25 } = {}) {
  const ax = accel.x, ay = accel.y, az = accel.z;
  function set(t = 0, lift = 0) {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const d = c.delay * maxDelay;
      const lt = t <= d ? 0 : Math.min(1, (t - d) / (1 - d));
      const T = lt * duration;
      const L = lift * c.lift;
      const m = c.mesh;
      m.position.set(
        c.base.x + c.radial.x * 0.07 * lift + c.vel.x * T + 0.5 * ax * T * T,
        c.base.y + L + c.vel.y * T + 0.5 * ay * T * T,
        c.base.z + c.radial.z * 0.07 * lift + c.vel.z * T + 0.5 * az * T * T,
      );
      m.rotation.set(c.spin.x * (T + 0.02 * lift), c.spin.y * (T + 0.02 * lift), c.spin.z * (T + 0.02 * lift));
    }
  }
  return set;
}

/**
 * makeFracturedColumn(ctx, opts) -> { group, chunks:[{mesh, vel, spin}], set(t, lift), crack(c), dispose() }
 * opts: radius, height, flutes, fluteDepth, drums, seed, power (explosion speed),
 *       toward (Vector3 bias added to every velocity, e.g. toward the camera),
 *       outer / inner (shared materials; created when absent)
 */
export function makeFracturedColumn(ctx, opts = {}) {
  const {
    radius: R = 0.55, height: H = 10, flutes = 16, fluteDepth = 0.07, drums = 7, seed = 1,
    power = 1, toward = new THREE.Vector3(0, 0, 0), duration = 1.4, crackWidth = 0.03,
  } = opts;
  const rand = rng(seed);
  const own = !opts.outer;
  const outer = opts.outer ?? crackMaterial(ctx, { crackWidth });
  const inner = opts.inner ?? ctx.inkMaterial({ tone: 0.42, angle: -1, rim: 0 });
  const mats = [outer, inner];
  const group = new THREE.Group();

  const rOf = (th) => R * (1 - fluteDepth * Math.sin(flutes * th * 0.5) ** 2);
  const drOf = (th) => -R * fluteDepth * flutes * 0.5 * Math.sin(flutes * th);

  // cut planes y = h + kx * x + kz * z (first and last flat: the column ends)
  const cuts = [];
  for (let k = 0; k <= drums; k++) {
    const flat = k === 0 || k === drums;
    const h = (H * k) / drums + (flat ? 0 : (rand() - 0.5) * 0.45 * (H / drums));
    cuts.push({ h, kx: flat ? 0 : (rand() - 0.5) * 0.55, kz: flat ? 0 : (rand() - 0.5) * 0.55, end: flat });
  }
  const yAt = (c, x, z) => c.h + c.kx * x + c.kz * z;

  const chunks = [];
  const tmpCentre = new THREE.Vector3();
  for (let k = 0; k < drums; k++) {
    const cb = cuts[k], ct = cuts[k + 1];
    const cx = (rand() - 0.5) * 0.4 * R, cz = (rand() - 0.5) * 0.4 * R;
    const wedges = rand() < 0.5 ? 3 : 4;
    const start = rand() * TAU;
    const angles = [];
    for (let i = 0; i <= wedges; i++) angles.push(start + (TAU * i) / wedges + (i > 0 && i < wedges ? (rand() - 0.5) * 0.35 * (TAU / wedges) : 0));
    for (let wI = 0; wI < wedges; wI++) {
      const a0 = angles[wI], a1 = angles[wI + 1];
      // sample on a global angular grid (plus the wedge ends) so neighbouring drums share
      // vertices and the intact column shows no slivers
      const grid = TAU / (flutes * 6);
      const ths = [a0];
      for (let g = Math.floor(a0 / grid) + 1; g * grid < a1 - grid * 0.2; g++) if (g * grid > a0 + grid * 0.2) ths.push(g * grid);
      ths.push(a1);
      const steps = ths.length - 1;
      const b = new ChunkBuilder();
      const CB = [cx, yAt(cb, cx, cz), cz], CT = [cx, yAt(ct, cx, cz), cz];
      const bot = [], top = [];
      let arc = 0; const arcs = [0];
      for (let j = 0; j <= steps; j++) {
        const th = ths[j];
        const r = rOf(th), x = r * Math.cos(th), z = r * Math.sin(th);
        bot.push([x, yAt(cb, x, z), z]); top.push([x, yAt(ct, x, z), z]);
        if (j > 0) { arc += Math.hypot(x - bot[j - 1][0], z - bot[j - 1][2]); arcs.push(arc); }
      }
      // wall
      for (let j = 0; j <= steps; j++) {
        const th = ths[j];
        const r = rOf(th), dr = drOf(th);
        const c = Math.cos(th), s = Math.sin(th);
        let nx = r * c + dr * s, nz = r * s - dr * c; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
        const dl = arcs[j], drr = arc - arcs[j];
        const yb = bot[j][1], yt = top[j][1];
        const dB = cb.end ? 9 : 0, dT = ct.end ? 9 : 0;
        bot[j].d = [dl, drr, dB, (ct.end ? 9 : yt - yb)];
        top[j].d = [dl, drr, (cb.end ? 9 : yt - yb), dT];
        bot[j].n = [nx, 0, nz]; top[j].n = [nx, 0, nz];
        bot[j].uv = [dl, yb]; top[j].uv = [dl, yt];
      }
      for (let j = 0; j < steps; j++) {
        const B0 = bot[j], T0 = top[j], B1 = bot[j + 1], T1 = top[j + 1];
        b.w(B0, B0.n, B0.d, B0.uv); b.w(T0, T0.n, T0.d, T0.uv); b.w(B1, B1.n, B1.d, B1.uv);
        b.w(B1, B1.n, B1.d, B1.uv); b.w(T0, T0.n, T0.d, T0.uv); b.w(T1, T1.n, T1.d, T1.uv);
      }
      // caps and the two radial fracture faces
      for (let j = 0; j < steps; j++) {
        b.tri(CT, top[j + 1], top[j]);
        b.tri(CB, bot[j], bot[j + 1]);
      }
      b.tri(CB, CT, bot[0]); b.tri(bot[0], CT, top[0]);
      b.tri(CB, bot[steps], CT); b.tri(bot[steps], top[steps], CT);
      // one stray surface crack across the face (half the chunks)
      const ym = (bot[steps >> 1][1] + top[steps >> 1][1]) * 0.5, sm = arc * 0.5;
      const la = rand() * Math.PI;
      const lx = Math.cos(la), ly = Math.sin(la);
      const line = rand() < 0.6 ? [lx, ly, lx * (sm + (rand() - 0.5) * arc * 0.4) + ly * ym] : [0, 0, 99];
      const chunkSeed = rand();
      const { geometry, centre } = b.build(chunkSeed, line);
      const mesh = new THREE.Mesh(geometry, mats);
      mesh.position.copy(centre);
      group.add(mesh);

      tmpCentre.copy(centre);
      const radial = new THREE.Vector3(centre.x, 0, centre.z);
      if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
      radial.normalize();
      const hN = centre.y / H;
      const out = (1.4 + rand() * 2.6) * power;
      const up = (1.5 + rand() * 3.5 + hN * 2.5) * power;
      const vel = new THREE.Vector3(radial.x * out + toward.x * (0.5 + rand()), up + toward.y, radial.z * out + toward.z * (0.5 + rand()));
      const spin = new THREE.Vector3((rand() - 0.5) * 6, (rand() - 0.5) * 6, (rand() - 0.5) * 6);
      chunks.push({
        mesh, vel, spin, radial, base: centre.clone(),
        delay: Math.min(1, (1 - hN) * 0.7 + rand() * 0.3),
        lift: (0.05 + rand() * 0.25) * hN * hN,
      });
    }
  }

  const set = chunkSystem(chunks, { duration, maxDelay: 0.25 });
  set(0, 0);
  return {
    group, chunks, set, outer, inner,
    crack(c) { outer.uniforms.uCrack.value = c; },
    dispose() {
      for (const c of chunks) c.mesh.geometry.dispose();
      if (own) { outer.dispose(); inner.dispose(); }
    },
  };
}

/**
 * A roof slab (entablature) cut into blocks with jittered vertical joints.
 * Same API as the column: { group, chunks, set(t, lift), dispose() }.
 */
export function makeFracturedSlab(ctx, opts = {}) {
  const {
    width = 12, height = 0.9, depth = 2, pieces = 7, seed = 7, power = 1,
    toward = new THREE.Vector3(), duration = 1.4,
  } = opts;
  const rand = rng(seed);
  const made = [];
  const mk = (m) => (made.push(m), m);
  const outer = opts.outer ?? mk(ctx.inkMaterial({ tone: 0.97, angle: 0, rim: 0.1 }));
  const side = opts.side ?? mk(ctx.inkMaterial({ tone: 0.97, angle: Math.PI / 2, rim: 0.1 }));
  const inner = opts.inner ?? mk(ctx.inkMaterial({ tone: 0.42, angle: -1, rim: 0 }));
  const under = opts.under ?? mk(ctx.inkMaterial({ tone: 0.6, emissive: 0.32, angle: 0, rim: 0 }));
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z
  const group = new THREE.Group();
  const xs = [-width / 2];
  for (let i = 1; i < pieces; i++) xs.push(-width / 2 + (width * i) / pieces + (rand() - 0.5) * (width / pieces) * 0.5);
  xs.push(width / 2);
  const chunks = [];
  for (let i = 0; i < pieces; i++) {
    const w = xs[i + 1] - xs[i];
    const geo = new THREE.BoxGeometry(w - 0.004, height, depth);
    const mats = [i === pieces - 1 ? side : inner, i === 0 ? side : inner, outer, under, side, side];
    const mesh = new THREE.Mesh(geo, mats);
    const base = new THREE.Vector3((xs[i] + xs[i + 1]) / 2, 0, 0);
    mesh.position.copy(base);
    group.add(mesh);
    const radial = new THREE.Vector3(Math.sign(base.x) || 1, 0, 0);
    const vel = new THREE.Vector3(base.x * 0.35 * power + toward.x, (2 + rand() * 3) * power + toward.y, toward.z * (0.4 + rand()));
    const spin = new THREE.Vector3((rand() - 0.5) * 3, (rand() - 0.5) * 2, (rand() - 0.5) * 3);
    chunks.push({ mesh, vel, spin, radial, base, delay: rand(), lift: 0.05 + rand() * 0.2 });
  }
  const set = chunkSystem(chunks, { duration, maxDelay: 0.3 });
  set(0, 0);
  return {
    group, chunks, set,
    dispose() {
      for (const c of chunks) c.mesh.geometry.dispose();
      for (const m of made) m.dispose();
    },
  };
}

/** Jittered low-poly rock geometry (closed: jitter is a function of the original vertex). */
export function rockGeometry(radius = 0.3, seed = 3, amount = 0.35) {
  const g = new THREE.IcosahedronGeometry(radius, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(x * 12.9898 * seed + y * 78.233 + z * 37.719) * 43758.5453;
    const k = 1 + (h - Math.floor(h) - 0.5) * 2 * amount;
    p.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** A long sharp sliver (tetrahedral spike along +z) for shards streaking past the camera. */
export function shardGeometry() {
  const v = [
    [0, 0, 1], [-0.22, -0.12, -1], [0.25, -0.1, -1], [0, 0.2, -0.85],
  ];
  const tris = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
  const pos = [];
  for (const t of tris) for (const i of t) pos.push(...v[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * inkMaterial for InstancedMesh (the core inkMaterial ignores instanceMatrix).
 * Same G-buffer output: lit shade, palette, hatch angle (-1 = follow the surface).
 */
export function inkInstanced(ctx, { tone = 0.85, pal = ctx.PAL.NEUTRAL, angle = -1, hatch = 1, emissive = 0, rim = 0.15 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTone: { value: tone }, uPal: { value: pal }, uAngle: { value: angle }, uHatch: { value: hatch },
      uEmissive: { value: emissive }, uRim: { value: rim }, uLight: { value: LIGHT.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vVN; varying vec3 vView;
      void main() {
        mat4 im = instanceMatrix;
        vN = normalize(mat3(modelMatrix) * mat3(im) * normal);
        vVN = normalize(mat3(viewMatrix) * vN);
        vec4 mv = modelViewMatrix * im * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uTone, uPal, uAngle, uHatch, uEmissive, uRim; uniform vec3 uLight;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float lam = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(normalize(vVN), normalize(vView)), 0.0), 3.0) * uRim;
        float shade = uTone * (0.18 + 0.82 * lam) + rim + uEmissive;
        float ang = uAngle >= 0.0 ? uAngle : atan(vVN.y, vVN.x) + 1.5707963;
        gl_FragColor = gbuf(shade, uPal, ang, uHatch);
      }`,
  });
}

/**
 * Deep red sky dome: slow diagonal hatch with drifting oxblood streak clouds.
 * Set .uniforms.uTime each frame. `streaks` 0..1 scales how much cloud there is.
 */
export function redSky(ctx, { radius = 90, streaks = 1, angle = 0.62 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: streaks }, uAng: { value: angle } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uTime, uAmt, uAng; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.1; a *= 0.5; } return s; }
      void main(){
        float az = atan(vDir.x, -vDir.z), el = vDir.y;
        // stretched along a diagonal so the clouds read as long streaks
        vec2 q = vec2(az * 2.2 + el * 2.4, (el * 2.6 - az * 1.1) * 5.5);
        q.x += uTime * 0.05;
        float n = fbm(q);
        float th = mix(0.9, 0.6, uAmt);
        float streak = smoothstep(th, th + 0.04, n);
        float core = smoothstep(th + 0.1, th + 0.14, n);
        float pal = streak > 0.5 ? PAL_OXBLOOD : PAL_RED;
        float shade = mix(0.9, 0.62, streak) - core * 0.25;
        gl_FragColor = gbuf(shade, pal, uAng, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}
