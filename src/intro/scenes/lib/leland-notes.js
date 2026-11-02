// The music for work-leland: engraved staves (five paper lines plus bar lines, drawn in a
// ribbon shader) that unspool out of the piano's open lid, and instanced note glyphs that
// ride them. layout() takes the ribbon control points (it runs only when the viewport
// shape changes); update(p) places everything as a pure function of p.
import * as THREE from 'three';

const GLYPHS = 8;
const CELL_W = 128, CELL_H = 256, HEAD = [64, 192];

/** White-on-transparent atlas: 8 cells, note head (or accidental centre) at HEAD in every cell. */
function glyphAtlas() {
  const c = document.createElement('canvas');
  c.width = CELL_W * GLYPHS; c.height = CELL_H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round';
  const head = (ox, hollow = false, big = false) => {
    g.beginPath();
    g.ellipse(ox + HEAD[0], HEAD[1], big ? 34 : 30, big ? 23 : 21, big ? 0 : -0.38, 0, Math.PI * 2);
    g.fill();
    if (hollow) {
      g.save(); g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.ellipse(ox + HEAD[0], HEAD[1], big ? 13 : 20, big ? 18 : 8, big ? 0.5 : -0.6, 0, Math.PI * 2);
      g.fill(); g.restore();
    }
  };
  const stem = (ox) => g.fillRect(ox + HEAD[0] + 24, 38, 7, HEAD[1] - 44);
  const flag = (ox, dy = 0) => {
    const x = ox + HEAD[0] + 27;
    g.beginPath();
    g.moveTo(x, 38 + dy);
    g.bezierCurveTo(x + 4, 70 + dy, x + 36, 84 + dy, x + 26, 134 + dy);
    g.bezierCurveTo(x + 28, 100 + dy, x + 14, 88 + dy, x, 80 + dy);
    g.closePath(); g.fill();
  };
  let ox = 0;
  head(ox); stem(ox);                                   // 0 quarter
  ox += CELL_W; head(ox); stem(ox); flag(ox);           // 1 eighth
  ox += CELL_W; head(ox, true); stem(ox);               // 2 half
  ox += CELL_W; head(ox); stem(ox); flag(ox); flag(ox, 34); // 3 sixteenth
  ox += CELL_W; head(ox, true, true);                   // 4 whole
  ox += CELL_W;                                         // 5 sharp
  g.lineWidth = 7;
  for (const x of [54, 76]) { g.beginPath(); g.moveTo(ox + x, HEAD[1] - 64); g.lineTo(ox + x, HEAD[1] + 58); g.stroke(); }
  g.lineWidth = 13;
  for (const y of [-16, 22]) { g.beginPath(); g.moveTo(ox + 38, HEAD[1] + y + 8); g.lineTo(ox + 92, HEAD[1] + y - 8); g.stroke(); }
  ox += CELL_W;                                         // 6 flat
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(ox + 50, HEAD[1] - 100); g.lineTo(ox + 50, HEAD[1] + 30); g.stroke();
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(ox + 50, HEAD[1] + 30); g.bezierCurveTo(ox + 100, HEAD[1] + 2, ox + 96, HEAD[1] - 34, ox + 50, HEAD[1] - 12); g.stroke();
  ox += CELL_W; head(ox); stem(ox);                     // 7 dotted quarter
  g.beginPath(); g.arc(ox + 112, HEAD[1] - 4, 9, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function buildStream(ctx, { ribbons = 3, perRibbon = 26, samples = 150, space = 0.042 } = {}) {
  const { GBUF_GLSL } = ctx;
  const owned = [];
  const own = (o) => { owned.push(o); return o; };
  const group = new THREE.Group();
  const S = samples + 1;
  const HALF = 2.25; // band half width in staff spaces (lines at -2..2)

  // ---------------------------------------------------------------- staff ribbons
  const vCount = ribbons * S * 2;
  const posA = new THREE.BufferAttribute(new Float32Array(vCount * 3), 3);
  const uA = new Float32Array(vCount), vA = new Float32Array(vCount), rA = new Float32Array(vCount), lA = new Float32Array(vCount);
  const idx = [];
  for (let r = 0; r < ribbons; r++) {
    for (let j = 0; j < S; j++) {
      const i = (r * S + j) * 2;
      uA[i] = uA[i + 1] = j / samples;
      vA[i] = -HALF; vA[i + 1] = HALF;
      rA[i] = rA[i + 1] = r;
      if (j < samples) idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const lAttr = new THREE.BufferAttribute(lA, 1);
  const staffGeo = own(new THREE.BufferGeometry());
  staffGeo.setAttribute('position', posA);
  staffGeo.setAttribute('aU', new THREE.BufferAttribute(uA, 1));
  staffGeo.setAttribute('aV', new THREE.BufferAttribute(vA, 1));
  staffGeo.setAttribute('aR', new THREE.BufferAttribute(rA, 1));
  staffGeo.setAttribute('aL', lAttr);
  staffGeo.setIndex(idx);
  const reveal = new THREE.Vector3();
  const staffMat = own(new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uReveal: { value: reveal }, uBar: { value: 0.62 }, uTail: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aU, aV, aR, aL; varying float vU, vV, vR, vL;
      void main(){ vU = aU; vV = aV; vR = aR; vL = aL; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform vec3 uReveal; uniform float uBar, uTail; varying float vU, vV, vR, vL;
      void main(){
        float rev = vR < 0.5 ? uReveal.x : (vR < 1.5 ? uReveal.y : uReveal.z);
        if (vU > rev || vU < max(0.012, uTail)) discard;
        float y = vV;
        float d = abs(y - floor(y + 0.5));
        float w = fwidth(y);
        float line = (1.0 - smoothstep(0.05, 0.05 + w * 1.3, d)) * step(abs(y), 2.3);
        float b = vL / uBar;
        float db = abs(b - floor(b + 0.5));
        float bar = (1.0 - smoothstep(0.006, 0.006 + fwidth(b) * 1.3, db)) * step(abs(y), 2.0);
        // a double bar where the staff is being written
        float head = step(rev - vU, 0.006) * step(abs(y), 2.0);
        if (max(max(line, bar), head) < 0.5) discard;
        gl_FragColor = gbuf(0.96, PAL_NEUTRAL, 0.0, 0.0);
      }`,
  }));
  const staff = new THREE.Mesh(staffGeo, staffMat);
  staff.frustumCulled = false;
  group.add(staff);

  // ---------------------------------------------------------------- note glyphs
  const N = ribbons * perRibbon;
  const atlas = own(glyphAtlas());
  const glyphGeo = own(new THREE.PlaneGeometry(3, 6).translate(0, 1.5, 0));
  const gAttr = new Float32Array(N);
  const notes = [];
  for (let i = 0; i < N; i++) {
    const r = i % ribbons;
    const h1 = hash(i + 1), h2 = hash(i * 3.7 + 9), h3 = hash(i * 7.3 + 2);
    const pos = Math.floor(h2 * 11) - 1;           // staff position in half-spaces: -1..9 (bottom line = 0)
    const glyph = h3 < 0.32 ? 0 : h3 < 0.52 ? 1 : h3 < 0.64 ? 2 : h3 < 0.74 ? 3 : h3 < 0.8 ? 4 : h3 < 0.87 ? 5 : h3 < 0.93 ? 6 : 7;
    gAttr[i] = glyph;
    notes.push({ r, seed: (Math.floor(i / ribbons) + h1 * 0.6) / perRibbon, y: (pos - 4) * 0.5, flip: pos > 4 && glyph < 4, gate: hash(i * 1.9 + 4) });
  }
  glyphGeo.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(gAttr, 1));
  const uTime = { value: 0 };
  const noteMat = own(new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uMap: { value: atlas }, uTime },
    vertexShader: /* glsl */ `
      attribute float aGlyph; varying vec2 vUv;
      uniform float uTime;
      void main(){
        vUv = vec2((uv.x + aGlyph) / ${GLYPHS.toFixed(1)}, uv.y);
        vec3 p = position;
        float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].y * 1.7;
        p.y += sin(uTime * 2.1 + ph) * 0.12;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform sampler2D uMap; varying vec2 vUv;
      void main(){
        if (texture2D(uMap, vUv).a < 0.5) discard;
        gl_FragColor = gbuf(0.97, PAL_NEUTRAL, 0.0, 0.0);
      }`,
  }));
  const noteMesh = new THREE.InstancedMesh(glyphGeo, noteMat, N);
  noteMesh.frustumCulled = false;
  noteMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(noteMesh);

  // per-sample frames, filled by layout()
  const F = { P: new Float32Array(ribbons * S * 3), T: new Float32Array(ribbons * S * 3), B: new Float32Array(ribbons * S * 3), N: new Float32Array(ribbons * S * 3) };
  const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3() };

  /**
   * @param paths  one array of Vector3 control points per ribbon (world)
   * @param camPos the camera position the staves should face
   * @param camUp  that camera's up vector
   */
  function layout(paths, camPos, camUp) {
    for (let r = 0; r < ribbons; r++) {
      const curve = new THREE.CatmullRomCurve3(paths[r], false, 'centripetal', 0.5);
      const pts = curve.getSpacedPoints(samples);
      const len = curve.getLength();
      const B = new THREE.Vector3(), T = new THREE.Vector3(), Nn = new THREE.Vector3(), toCam = new THREE.Vector3(), face = new THREE.Vector3();
      for (let j = 0; j < S; j++) {
        const u = j / samples;
        curve.getTangentAt(Math.min(u, 0.9999), T).normalize();
        // propagate the band direction (rotation-minimising), nudged toward facing the camera
        if (j === 0) B.copy(camUp);
        B.addScaledVector(T, -B.dot(T)).normalize();
        toCam.copy(camPos).sub(pts[j]).normalize();
        face.crossVectors(toCam, T).normalize();
        if (face.dot(B) < 0) face.negate();
        B.lerp(face, j === 0 ? 1 : 0.1).addScaledVector(T, -B.dot(T)).normalize();
        Nn.crossVectors(T, B);
        // a gentle twist so the staves read as ribbons
        const tw = Math.sin(u * 5.0 + r * 2.1) * 0.22 * Math.sin(Math.PI * u);
        const bx = B.x * Math.cos(tw) + Nn.x * Math.sin(tw), by = B.y * Math.cos(tw) + Nn.y * Math.sin(tw), bz = B.z * Math.cos(tw) + Nn.z * Math.sin(tw);
        const o = (r * S + j) * 3;
        F.P[o] = pts[j].x; F.P[o + 1] = pts[j].y; F.P[o + 2] = pts[j].z;
        F.T[o] = T.x; F.T[o + 1] = T.y; F.T[o + 2] = T.z;
        F.B[o] = bx; F.B[o + 1] = by; F.B[o + 2] = bz;
        tmp.a.set(bx, by, bz); tmp.b.crossVectors(T, tmp.a);
        F.N[o] = tmp.b.x; F.N[o + 1] = tmp.b.y; F.N[o + 2] = tmp.b.z;
        // taper the band where it leaves the lid and where it enters the print
        const taper = Math.min(1, u / 0.06, (1 - u) / 0.04 + 0.35);
        const hw = HALF * space * Math.max(0.35, taper);
        const vi = (r * S + j) * 2;
        posA.setXYZ(vi, pts[j].x - bx * hw, pts[j].y - by * hw, pts[j].z - bz * hw);
        posA.setXYZ(vi + 1, pts[j].x + bx * hw, pts[j].y + by * hw, pts[j].z + bz * hw);
        lA[vi] = lA[vi + 1] = u * len;
      }
    }
    posA.needsUpdate = true;
    lAttr.needsUpdate = true;
    staffGeo.computeBoundingSphere();
  }

  const m4 = new THREE.Matrix4();
  const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), P = new THREE.Vector3();
  function frameAt(r, u, out) {
    const f = Math.min(samples - 1e-4, Math.max(0, u * samples));
    const j = Math.floor(f), t = f - j;
    const o0 = (r * S + j) * 3, o1 = o0 + 3;
    for (const k of ['P', 'T', 'B', 'N']) {
      const a = F[k], v = out[k];
      v.set(a[o0] + (a[o1] - a[o0]) * t, a[o0 + 1] + (a[o1 + 1] - a[o0 + 1]) * t, a[o0 + 2] + (a[o1 + 2] - a[o0 + 2]) * t);
    }
  }
  const fr = { P, T: X, B: Y, N: Z };

  /**
   * @param p       beat progress
   * @param revs    [r0, r1, r2] how far each staff has been written (0..1 of its length)
   * @param flow    0..1, how many notes are still riding the staves
   * @param tail    0..1, the staves reel in from the piano end toward the print
   */
  function update(p, revs, flow, tail = 0) {
    reveal.set(revs[0], revs[1] ?? revs[0], revs[2] ?? revs[0]);
    staffMat.uniforms.uTail.value = tail;
    for (let i = 0; i < N; i++) {
      const n = notes[i];
      const u = (n.seed + p * 1.15) % 1;
      const rev = revs[n.r] ?? revs[0];
      const on = u < rev - 0.015 && n.gate < flow && u > Math.max(0.03, tail);
      if (!on) { m4.makeScale(0, 0, 0); noteMesh.setMatrixAt(i, m4); continue; }
      frameAt(n.r, u, fr);
      const sc = space * Math.min(1, (u - 0.03) / 0.05, (1 - u) / 0.06);
      Y.normalize(); X.normalize(); Z.crossVectors(X, Y);
      P.addScaledVector(Y, n.y * space).addScaledVector(Z, 0.006);
      if (n.flip) { X.negate(); Y.negate(); }
      X.multiplyScalar(sc); Y.multiplyScalar(sc); Z.multiplyScalar(sc);
      m4.makeBasis(X, Y, Z).setPosition(P);
      noteMesh.setMatrixAt(i, m4);
    }
    noteMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    layout,
    update,
    tick(time) { uTime.value = time; },
    dispose() { for (const o of owned) o.dispose(); },
  };
}
