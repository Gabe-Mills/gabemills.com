// Ricochet beat: the engraved arena. Tiled paper floor (with wall AO and cast shadows
// baked analytically in the shader), low maze walls of hatched paper blocks, an ember
// surround, a night sky, floodlight towers and a few mines. Also the 2D ricochet tracer
// that the shot is built from (so the walls and the shell path always agree).
import * as THREE from 'three';

const T = 0.5; // wall thickness
export const ARENA = { X: 6, Z: 4.5, WALL_H: 1.0 };
const { X, Z } = ARENA;

// Axis-aligned wall rects [x0, z0, x1, z1] in the floor plane (world x, world z).
export const WALLS = [
  [-X - T, -Z - T, X + T, -Z], [-X - T, Z, X + T, Z + T], [-X - T, -Z, -X, Z], [X, -Z, X + T, Z],
  [-2.6, -1.6, -1.8, 2.0],  // left bar
  [0.6, -4.5, 1.4, -1.8],   // back stub
  [1.8, 1.2, 4.4, 2.0],     // right bar
  [-0.6, 3.2, 0.2, 4.5],    // front stub
  [3.6, -2.6, 6, -1.8],     // right stub
];

/** 2D ray vs the wall rects. Returns { t, face } (face 0 = x face, 1 = z face) or null. */
function cast(ox, oz, dx, dz) {
  let best = null;
  for (const [x0, z0, x1, z1] of WALLS) {
    let tmin = -1e9, tmax = 1e9, face = -1;
    for (let ax = 0; ax < 2; ax++) {
      const lo = ax ? z0 : x0, hi = ax ? z1 : x1, o = ax ? oz : ox, d = ax ? dz : dx;
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) tmin = 1e9; continue; }
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) { tmin = t1; face = ax; }
      tmax = Math.min(tmax, t2);
    }
    if (tmin <= tmax && tmin > 1e-6 && (!best || tmin < best.t)) best = { t: tmin, face };
  }
  return best;
}

/**
 * Trace a shell from (ox, oz) at `angle` (radians, x = cos, z = sin) through `bounces`
 * wall reflections. Returns bounce points with their face normals and the final leg.
 */
export function traceRicochet(ox, oz, angle, bounces) {
  let dx = Math.cos(angle), dz = Math.sin(angle), x = ox, z = oz;
  const hits = [];
  for (let i = 0; i < bounces; i++) {
    const h = cast(x, z, dx, dz);
    x += dx * h.t; z += dz * h.t;
    // the normal faces back toward where the shell came from
    const nx = h.face === 0 ? -Math.sign(dx) : 0, nz = h.face === 1 ? -Math.sign(dz) : 0;
    const inX = dx, inZ = dz;
    if (h.face === 0) dx = -dx; else dz = -dz;
    hits.push({ x, z, nx, nz, inX, inZ, outX: dx, outZ: dz });
  }
  const last = cast(x, z, dx, dz);
  return { hits, dir: [dx, dz], free: last ? last.t : 10 };
}

/** inkMaterial for InstancedMesh, with an optional per-instance tone (attribute aTone). */
export function inkInstanced(ctx, { tone = 0.85, pal = ctx.PAL.NEUTRAL, angle = -1, hatch = 1, emissive = 0, rim = 0.15 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTone: { value: tone }, uPal: { value: pal }, uAngle: { value: angle }, uHatch: { value: hatch },
      uEmissive: { value: emissive }, uRim: { value: rim }, uLight: { value: new THREE.Vector3(-0.45, 0.8, 0.55).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute float aTone;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView; varying float vTone;
      void main() {
        vTone = aTone;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vVN = normalize(mat3(viewMatrix) * vN);
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uTone, uPal, uAngle, uHatch, uEmissive, uRim; uniform vec3 uLight;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView; varying float vTone;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float lam = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(normalize(vVN), normalize(vView)), 0.0), 3.0) * uRim;
        float shade = uTone * vTone * (0.18 + 0.82 * lam) + rim + uEmissive;
        float ang = uAngle;
        if (uAngle < 0.0) {
          vec3 vn = normalize(vVN);
          float l = length(vn.xy);
          float contour = atan(vn.y, vn.x) + 1.5707963;
          float fallback = abs(n.y) > 0.7 ? 0.0 : 1.5707963;
          float k = smoothstep(0.12, 0.45, l);
          vec2 d2 = vec2(cos(2.0 * contour), sin(2.0 * contour)) * k + vec2(cos(2.0 * fallback), sin(2.0 * fallback)) * (1.0 - k);
          ang = 0.5 * atan(d2.y, d2.x);
        }
        gl_FragColor = gbuf(shade, uPal, ang, uHatch);
      }`,
  });
}

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** The maze: every wall rect chopped into ~1 unit paper blocks with thin gaps. */
function makeWalls(ctx) {
  const blocks = [];
  for (const [x0, z0, x1, z1] of WALLS) {
    const lx = x1 - x0, lz = z1 - z0, alongX = lx >= lz;
    const L = alongX ? lx : lz, n = Math.max(1, Math.round(L / 1.05)), seg = L / n;
    for (let i = 0; i < n; i++) {
      const a = (alongX ? x0 : z0) + seg * (i + 0.5);
      blocks.push(alongX
        ? { x: a, z: (z0 + z1) / 2, sx: seg - 0.06, sz: lz - 0.02 }
        : { x: (x0 + x1) / 2, z: a, sx: lx - 0.02, sz: seg - 0.06 });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const tones = new Float32Array(blocks.length);
  const mesh = new THREE.InstancedMesh(geo, inkInstanced(ctx, { tone: 1, pal: ctx.PAL.NEUTRAL, angle: -1, hatch: 1, rim: 0.1 }), blocks.length);
  const m = new THREE.Matrix4();
  blocks.forEach((b, i) => {
    const h = ARENA.WALL_H * (0.97 + 0.06 * hash(i));
    m.makeScale(b.sx, h, b.sz).setPosition(b.x, h / 2, b.z);
    mesh.setMatrixAt(i, m);
    tones[i] = 0.8 + 0.16 * hash(i + 17);
  });
  geo.setAttribute('aTone', new THREE.InstancedBufferAttribute(tones, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Tiled floor. Shade comes from per-tile tone, bevel, grout lines, wall AO, wall cast
 * shadows (along the ink light) and soft tank shadows (uTanks: x, z, yaw, strength).
 */
function makeFloor(ctx) {
  const rects = WALLS.map((r) => new THREE.Vector4(...r));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uRects: { value: rects },
      uTanks: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      #define NR ${rects.length}
      uniform vec4 uRects[NR]; uniform vec4 uTanks[3];
      varying vec2 vXZ;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float sdBox(vec2 p, vec4 r){ vec2 c = (r.xy + r.zw) * 0.5, h = (r.zw - r.xy) * 0.5; vec2 d = abs(p - c) - h;
        return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      void main(){
        vec2 q = vXZ + vec2(0.5, 0.5);   // tiles centred on the arena grid
        vec2 cell = floor(q), f = fract(q);
        float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
        float shade = 0.72 + 0.14 * h21(cell);
        shade -= 0.14 * (1.0 - smoothstep(0.02, 0.1, edge));
        float hatch = 0.85;
        // walls: contact AO and the cast shadow toward -light
        vec2 L = normalize(vec2(-0.45, 0.55));
        float d = 1e3, s = 1e3;
        for (int i = 0; i < NR; i++) {
          d = min(d, sdBox(vXZ, uRects[i]));
          s = min(s, sdBox(vXZ - L * 0.35, uRects[i]));
          s = min(s, sdBox(vXZ - L * 0.75, uRects[i]));
        }
        float ao = mix(0.55, 1.0, smoothstep(0.0, 0.55, d));
        float sh = mix(0.55, 1.0, smoothstep(-0.02, 0.06, s));
        // tanks: rotated soft boxes nudged along the shadow direction
        float ts = 1.0;
        for (int i = 0; i < 3; i++) {
          vec4 t = uTanks[i];
          if (t.w <= 0.0) continue;
          vec2 p = vXZ - t.xy + L * 0.28;
          float c = cos(t.z), sn = sin(t.z);
          p = vec2(c * p.x - sn * p.y, sn * p.x + c * p.y);
          float b = sdBox(p, vec4(-0.68, -0.88, 0.68, 0.88));
          ts *= mix(1.0, mix(0.45, 1.0, smoothstep(-0.1, 0.3, b)), t.w);
        }
        shade *= ao * sh * ts;
        if (edge < 0.022) { shade = 0.22; hatch = 1.0; }
        gl_FragColor = gbuf(shade, PAL_NEUTRAL, 0.0, hatch);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * X + 1, 2 * Z + 1), mat);
  floor.rotation.x = -Math.PI / 2;
  return floor;
}

/** Night sky dome: ink with fine horizontal cuts, sparse glow stars, an ember horizon band. */
function makeSky(ctx) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float el = vDir.y;
        float pal = PAL_NEUTRAL;
        float shade = 0.1 + 0.16 * (1.0 - smoothstep(0.0, 0.35, el));
        float hatch = 1.0;
        vec2 g = vec2(atan(vDir.x, -vDir.z) * 60.0, el * 60.0);
        vec2 c = floor(g);
        if (el > 0.06 && h21(c) > 0.985 && length(fract(g) - 0.5) < 0.18) { pal = PAL_ACCENT; shade = 1.0; hatch = 0.0; }
        if (el < 0.05) { pal = PAL_RED; shade = mix(0.82, 0.55, smoothstep(0.0, 0.05, el)); }
        gl_FragColor = gbuf(shade, pal, 0.0, hatch);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 32, 16), mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

/** Floodlight towers at the four outer corners, lamps angled into the arena. */
function makeFloodlights(ctx) {
  const { PAL, inkMaterial, flatMaterial } = ctx;
  const g = new THREE.Group();
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 1, 8), inkInstanced(ctx, { tone: 0.32, pal: PAL.NEUTRAL, angle: Math.PI / 2 }), 2);
  posts.geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(new Float32Array([1, 1]), 1));
  const heads = new THREE.Group();
  const m = new THREE.Matrix4();
  const H = 5.4;
  // back corners only: front towers would stand in the camera's way
  const corners = [[-X - 1.3, -Z - 1.3], [X + 1.3, -Z - 1.3]];
  const housingMat = inkMaterial({ tone: 0.4, pal: PAL.NEUTRAL, angle: -1 });
  const lampMat = flatMaterial({ shade: 1, pal: PAL.GLOW });
  const housingGeo = new THREE.BoxGeometry(1.1, 0.62, 0.22);
  const lampGeo = new THREE.PlaneGeometry(0.96, 0.5);
  corners.forEach(([x, z], i) => {
    m.makeScale(1, H, 1).setPosition(x, H / 2, z);
    posts.setMatrixAt(i, m);
    const head = new THREE.Group();
    head.position.set(x, H + 0.2, z);
    head.lookAt(0, 0, 0);
    const housing = new THREE.Mesh(housingGeo, housingMat);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.z = 0.115;
    // lamp grid: a few ink mullions over the glow
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.02), housingMat);
    mull.position.z = 0.12;
    const mull2 = mull.clone(); mull2.position.x = -0.32;
    const mull3 = mull.clone(); mull3.position.x = 0.32;
    head.add(housing, lamp, mull, mull2, mull3);
    heads.add(head);
  });
  posts.instanceMatrix.needsUpdate = true;
  posts.computeBoundingSphere();
  g.add(posts, heads);
  return g;
}

/** Mines: low ink discs with a glow pip. */
function makeMines(ctx, spots) {
  const { PAL, inkMaterial, flatMaterial } = ctx;
  const g = new THREE.Group();
  const body = new THREE.CylinderGeometry(0.24, 0.28, 0.07, 16);
  const pip = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12);
  const bodyMat = inkMaterial({ tone: 0.3, pal: PAL.NEUTRAL, angle: -1 });
  const pipMat = flatMaterial({ shade: 1, pal: PAL.GLOW });
  for (const [x, z] of spots) {
    const b = new THREE.Mesh(body, bodyMat); b.position.set(x, 0.035, z);
    const p = new THREE.Mesh(pip, pipMat); p.position.set(x, 0.08, z);
    g.add(b, p);
  }
  return g;
}

export function makeArena(ctx) {
  const { PAL, flatMaterial } = ctx;
  const group = new THREE.Group();
  const floor = makeFloor(ctx);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), flatMaterial({ shade: 0.8, pal: PAL.EMBER, angle: 0, hatch: 0.7 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  const walls = makeWalls(ctx);
  const sky = makeSky(ctx);
  const lights = makeFloodlights(ctx);
  const mines = makeMines(ctx, [[-5.2, 0.9], [-0.6, 1.2], [5.0, 3.6], [-3.6, -3.4]]);
  group.add(sky, ground, floor, walls, lights, mines);
  return { group, floor, tanksUniform: floor.material.uniforms.uTanks.value };
}
