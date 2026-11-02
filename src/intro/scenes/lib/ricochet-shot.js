// Ricochet beat: the shot. A glow tracer tube revealed up to an arc length (with a hot,
// swollen head), a hatched glow ribbon on the floor under it, instanced spark shards at
// the muzzle / every bounce / the impact, scorch stars on the walls and the floor, and
// the shell itself. Everything is a pure function of the revealed arc and beat p.
import * as THREE from 'three';

const hash = (n) => { const s = Math.sin(n * 91.345 + 47.853) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * @param pts   THREE.Vector3[] path corners (start, bounces..., end), at shell height
 * @param bursts [{ at: arc, o: Vector3, n: Vector3, r: Vector3, count, speed, life, wall: bool, size }]
 */
export function makeShot(ctx, { pts, start, bursts, radius = 0.05 }) {
  const { PAL, GBUF_GLSL, inkMaterial } = ctx;
  const group = new THREE.Group();

  // ---- arc lengths ----
  const arcs = [0];
  for (let i = 1; i < pts.length; i++) arcs.push(arcs[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = arcs[arcs.length - 1];

  // ---- tracer tube: centre positions + radial offsets, so the head can swell ----
  const SIDES = 8, STEP = 0.1;
  const P = [], OFF = [], ARC = [], IDX = [];
  const dir = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = arcs[i + 1] - arcs[i];
    dir.subVectors(b, a).normalize();
    side.crossVectors(dir, Y).normalize();
    up.crossVectors(side, dir).normalize();
    const rings = Math.max(2, Math.ceil(L / STEP) + 1);
    const base = P.length / 3;
    for (let r = 0; r < rings; r++) {
      const t = r / (rings - 1);
      for (let s = 0; s < SIDES; s++) {
        const th = (s / SIDES) * Math.PI * 2;
        const ox = side.x * Math.cos(th) + up.x * Math.sin(th), oy = side.y * Math.cos(th) + up.y * Math.sin(th), oz = side.z * Math.cos(th) + up.z * Math.sin(th);
        P.push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
        OFF.push(ox, oy, oz);
        ARC.push(arcs[i] + L * t);
      }
      if (r > 0) for (let s = 0; s < SIDES; s++) {
        const s1 = (s + 1) % SIDES, c0 = base + (r - 1) * SIDES, c1 = base + r * SIDES;
        IDX.push(c0 + s, c1 + s, c0 + s1, c0 + s1, c1 + s, c1 + s1);
      }
    }
  }
  const tubeGeo = new THREE.BufferGeometry();
  tubeGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  tubeGeo.setAttribute('aOff', new THREE.Float32BufferAttribute(OFF, 3));
  tubeGeo.setAttribute('aArc', new THREE.Float32BufferAttribute(ARC, 1));
  tubeGeo.setIndex(IDX);
  const tubeMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uReveal: { value: 0 }, uStart: { value: start }, uSwell: { value: 1 }, uR: { value: radius } },
    vertexShader: /* glsl */ `
      attribute vec3 aOff; attribute float aArc;
      uniform float uReveal, uSwell, uR;
      varying float vArc, vHead;
      void main(){
        float behind = max(uReveal - aArc, 0.0);
        vHead = exp(-behind * 2.6) * uSwell;
        vArc = aArc;
        vec3 p = position + aOff * uR * (1.0 + 1.1 * vHead);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uReveal, uStart;
      varying float vArc, vHead;
      void main(){
        if (vArc > uReveal || vArc < uStart) discard;
        float pal = vHead > 0.3 ? PAL_CIELO : PAL_ACCENT;   // CIELO slot = HOT on this site
        gl_FragColor = gbuf(1.0, pal, 0.0, 0.0);
      }`,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  tube.frustumCulled = false;

  // ---- floor glow ribbon: stippled light under the tracer ----
  const RP = [], RA = [], RX = [], RI = [];
  const W = 0.62;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = arcs[i + 1] - arcs[i];
    dir.subVectors(b, a).normalize();
    const nx = -dir.z, nz = dir.x;
    // overhang each end a little so the corners close
    const e = W * 0.5;
    const ax = a.x - dir.x * e, az = a.z - dir.z * e, bx = b.x + dir.x * e, bz = b.z + dir.z * e;
    const base = RP.length / 3;
    RP.push(ax + nx * W, 0.018, az + nz * W, ax - nx * W, 0.018, az - nz * W, bx + nx * W, 0.018, bz + nz * W, bx - nx * W, 0.018, bz - nz * W);
    RA.push(arcs[i] - e, arcs[i] - e, arcs[i] + L + e, arcs[i] + L + e);
    RX.push(1, -1, 1, -1);
    RI.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const ribGeo = new THREE.BufferGeometry();
  ribGeo.setAttribute('position', new THREE.Float32BufferAttribute(RP, 3));
  ribGeo.setAttribute('aArc', new THREE.Float32BufferAttribute(RA, 1));
  ribGeo.setAttribute('aX', new THREE.Float32BufferAttribute(RX, 1));
  ribGeo.setIndex(RI);
  const ribMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uReveal: { value: 0 }, uStart: { value: start } },
    vertexShader: `attribute float aArc, aX; varying float vArc, vX; void main(){ vArc = aArc; vX = aX; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uReveal, uStart;
      varying float vArc, vX;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        if (vArc > uReveal || vArc < uStart - 0.3) discard;
        float w = 1.0 - abs(vX);
        float head = exp(-max(uReveal - vArc, 0.0) * 0.9);
        float k = w * w * (0.55 + 0.45 * head);
        if (h21(floor(gl_FragCoord.xy * 0.5)) > k * 1.15) discard;
        gl_FragColor = gbuf(w > 0.82 ? 1.0 : 0.88, PAL_ACCENT, 0.0, 0.55);
      }`,
  });
  const ribbon = new THREE.Mesh(ribGeo, ribMat);
  ribbon.frustumCulled = false;

  // ---- shell ----
  const shellGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10).translate(0, -0.05, 0);
  const tip = new THREE.ConeGeometry(0.06, 0.12, 10).translate(0, 0.11, 0);
  const shell = new THREE.Group();
  shell.add(new THREE.Mesh(shellGeo, inkMaterial({ tone: 1, pal: PAL.NEUTRAL, emissive: 0.25, angle: -1 })), new THREE.Mesh(tip, inkMaterial({ tone: 1, pal: PAL.HOT, emissive: 0.3, angle: -1 })));

  // ---- sparks ----
  const sparks = [];
  bursts.forEach((b, k) => {
    for (let j = 0; j < b.count; j++) {
      const h1 = hash(k * 131 + j * 7.1), h2 = hash(k * 17 + j * 3.3 + 0.5), h3 = hash(k * 59 + j * 1.7 + 0.25), h4 = hash(k * 7 + j * 11.9);
      const v = new THREE.Vector3(h1 * 2 - 1, h2 * 1.4 - 0.2, h3 * 2 - 1).normalize();
      v.multiplyScalar(0.8).addScaledVector(b.n, 0.9).addScaledVector(b.r, 0.7).add(new THREE.Vector3(0, 0.35, 0)).normalize();
      sparks.push({ at: b.at, o: b.o, v, speed: b.speed * (0.45 + 0.9 * h4), life: b.life * (0.7 + 0.5 * h2), size: b.size * (0.7 + 0.6 * h1), pal: h3 > 0.55 ? 1 : 0 });
    }
  });
  const sparkGeo = new THREE.OctahedronGeometry(1, 0).scale(0.028, 0.028, 0.17);
  const palAttr = new Float32Array(sparks.map((s) => s.pal));
  sparkGeo.setAttribute('aHot', new THREE.InstancedBufferAttribute(palAttr, 1));
  const sparkMat = new THREE.ShaderMaterial({
    vertexShader: `attribute float aHot; varying float vHot; void main(){ vHot = aHot; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${GBUF_GLSL} varying float vHot; void main(){ gl_FragColor = gbuf(1.0, vHot > 0.5 ? PAL_CIELO : PAL_ACCENT, 0.0, 0.0); }`,
  });
  const sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, sparks.length);
  sparkMesh.frustumCulled = false;

  // ---- scorch stars (walls + floor) ----
  const decals = [];
  const decalGeo = new THREE.CircleGeometry(1, 40);
  const Zv = new THREE.Vector3(0, 0, 1);
  bursts.forEach((b, k) => {
    if (!b.scorch) return;
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uHeat: { value: 0 }, uGrow: { value: 0 }, uSeed: { value: k * 1.37 }, uClipY: { value: b.clipY ?? 99 } },
      vertexShader: `varying vec2 vUv; varying float vY; void main(){ vUv = position.xy; vY = (modelMatrix * vec4(position, 1.0)).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${GBUF_GLSL}
        uniform float uHeat, uGrow, uSeed, uClipY;
        varying vec2 vUv; varying float vY;
        void main(){
          if (vY > uClipY) discard;
          float r = length(vUv), a = atan(vUv.y, vUv.x);
          float rays = pow(0.5 + 0.5 * cos(a * 7.0 + uSeed) * cos(a * 3.0 - uSeed * 2.0), 2.0);
          float edge = (0.28 + 0.72 * rays) * uGrow;
          if (r > edge) discard;
          float k = r / max(edge, 1e-3);
          float pal = PAL_OXBLOOD; float shade = 0.3 + 0.2 * k;
          if (uHeat > 0.0) {
            if (k < uHeat) { pal = PAL_CIELO; shade = 1.0; }
            else if (k < uHeat * 1.6) { pal = PAL_ACCENT; shade = 0.95; }
          }
          gl_FragColor = gbuf(shade, pal, 0.7, 0.8);
        }`,
    });
    const d = new THREE.Mesh(decalGeo, mat);
    d.scale.setScalar(b.scorch);
    d.position.copy(b.o).addScaledVector(b.n, 0.012);
    d.quaternion.setFromUnitVectors(Zv, b.n);
    decals.push({ mesh: d, at: b.at, life: b.life });
    group.add(d);
  });

  group.add(ribbon, tube, shell, sparkMesh);

  // ---- per-frame (no allocation) ----
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), vel = new THREE.Vector3(), scl = new THREE.Vector3(), Zaxis = new THREE.Vector3(0, 0, 1), Yaxis = new THREE.Vector3(0, 1, 0), zero = new THREE.Matrix4().makeScale(0, 0, 0);

  /** Position on the path at arc s (clamped). Writes into out; returns the segment index. */
  function at(s, out) {
    s = Math.min(total, Math.max(0, s));
    let i = 0;
    while (i < arcs.length - 2 && arcs[i + 1] < s) i++;
    const t = (s - arcs[i]) / Math.max(1e-6, arcs[i + 1] - arcs[i]);
    out.lerpVectors(pts[i], pts[i + 1], t);
    return i;
  }

  /**
   * @param reveal  revealed arc length (start..total)
   * @param p       beat progress (for bursts / decals, timed by their `p`)
   * @param burstP  arc -> p mapping function
   */
  function update(reveal, p, arcToP) {
    tubeMat.uniforms.uReveal.value = reveal;
    ribMat.uniforms.uReveal.value = reveal;
    const done = reveal >= total - 1e-4;
    // after impact the hot head cools off
    tubeMat.uniforms.uSwell.value = done ? 1 - smooth(0, 0.06, p - arcToP(total)) : 1;
    tube.visible = ribbon.visible = reveal > start + 1e-4;

    shell.visible = reveal > start + 1e-4 && !done;
    if (shell.visible) {
      const i = at(reveal, shell.position);
      dir.subVectors(pts[i + 1], pts[i]).normalize();
      shell.quaternion.setFromUnitVectors(Yaxis, dir);
    }

    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i];
      const age = (p - arcToP(s.at)) / s.life;
      if (age < 0 || age > 1) { sparkMesh.setMatrixAt(i, zero); continue; }
      const e = 1 - (1 - age) * (1 - age);
      pos.copy(s.o).addScaledVector(s.v, s.speed * e);
      pos.y -= 1.6 * age * age;
      if (pos.y < 0.03) pos.y = 0.03;
      vel.copy(s.v).multiplyScalar(s.speed * 2 * (1 - age));
      vel.y -= 3.2 * age;
      if (vel.lengthSq() < 1e-6) vel.set(0, 1, 0);
      q.setFromUnitVectors(Zaxis, vel.normalize());
      const k = s.size * (1 - age) ** 0.6;
      scl.set(k, k, k * (0.6 + 1.6 * (1 - age)));
      sparkMesh.setMatrixAt(i, m.compose(pos, q, scl));
    }
    sparkMesh.instanceMatrix.needsUpdate = true;

    for (const d of decals) {
      const age = (p - arcToP(d.at)) / d.life;
      d.mesh.visible = age >= 0;
      if (age < 0) continue;
      const u = d.mesh.material.uniforms;
      u.uGrow.value = smooth(0, 0.25, age);
      u.uHeat.value = 0.75 * (1 - smooth(0.2, 1.6, age));
    }
  }

  return { group, update, at, total, arcs };
}
