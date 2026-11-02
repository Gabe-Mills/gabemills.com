// Engraved concert grand for the work-leland beat. Procedural: the case is an extruded
// grand outline (straight bass side, S-curved bentside), the rim is a ring extrusion, the
// soundboard is an ember plate with paper strings, the lid is hinged on the bass side and
// held by a prop stick, and the 88 keys are two instanced meshes that depress from a
// per-key press array. Everything is driven from outside by setLid() and setPress().
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PIANO = {
  HALF_W: 0.74,    // case half width (x)
  Y0: 0.64,        // case underside
  BOARD: 0.9,      // soundboard height
  RIM: 0.99,       // rim top (lid rests here)
  KEY_Y: 0.745,    // white key tops
  KB_HALF: 0.611,  // keyboard half width (52 whites)
  LID_FRONT: 0.3,  // fixed front lid section depth
  LID_OPEN: 0.6,   // lid angle when propped (rad)
  CENTER: new THREE.Vector3(0, 0.85, -0.92),
};

const LIGHT = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();
const V2 = (x, y) => new THREE.Vector2(x, y);

/** Grand outline in shape space (x across, y = distance back from the keyboard; world z = -y). Clockwise. */
export function outline(fromY = 0) {
  const curves = [
    new THREE.CubicBezierCurve(V2(-0.74, 1.66), V2(-0.74, 1.86), V2(-0.64, 1.95), V2(-0.47, 1.94)),
    new THREE.CubicBezierCurve(V2(-0.47, 1.94), V2(-0.22, 1.92), V2(-0.06, 1.62), V2(0.16, 1.28)),
    new THREE.CubicBezierCurve(V2(0.16, 1.28), V2(0.38, 0.95), V2(0.74, 0.86), V2(0.74, 0.46)),
  ];
  const pts = [V2(-0.74, fromY), V2(-0.74, 1.66)];
  for (const [i, c] of curves.entries()) pts.push(...c.getPoints(i === 0 ? 14 : 26).slice(1));
  pts.push(V2(0.74, fromY));
  return pts;
}

/** Offset a clockwise polygon inward by t (mitred). */
function inset(pts, t) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
    const n1 = V2(d1.y, -d1.x), n2 = V2(d2.y, -d2.x);
    const m = n1.clone().add(n2).normalize();
    out.push(b.clone().add(m.multiplyScalar(t / Math.max(0.35, m.dot(n1)))));
  }
  return out;
}

/** Shape-space extrusion -> world: x, extrusion up (y), shape y back (-z). */
function extrude(shape, depth, y) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

const ni = (g) => { if (!g.index) return g; const n = g.toNonIndexed(); g.dispose(); return n; };
const box = (w, h, d, x, y, z) => ni(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
const strip = (g) => { g.deleteAttribute('uv'); return g; };

/** inkMaterial twin that reads instanceMatrix and a per-instance press amount (darkens). */
export function inkInstanced({ GBUF_GLSL }, { tone = 0.9, pal = 0, angle = -1, hatch = 1, rim = 0.15, emissive = 0, pressDark = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTone: { value: tone }, uPal: { value: pal }, uAngle: { value: angle }, uHatch: { value: hatch },
      uRim: { value: rim }, uEmissive: { value: emissive }, uPressDark: { value: pressDark }, uLight: { value: LIGHT.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float aPress;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView; varying float vPress;
      void main() {
        vPress = aPress;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vVN = normalize(mat3(viewMatrix) * vN);
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uTone, uPal, uAngle, uHatch, uRim, uEmissive, uPressDark; uniform vec3 uLight;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView; varying float vPress;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float lam = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(normalize(vVN), normalize(vView)), 0.0), 3.0) * uRim;
        float shade = (uTone * (0.18 + 0.82 * lam) + rim + uEmissive) * (1.0 - uPressDark * vPress);
        float ang = uAngle >= 0.0 ? uAngle : atan(vVN.y, vVN.x) + 1.5707963;
        gl_FragColor = gbuf(shade, uPal, ang, uHatch);
      }`,
  });
}

function soundboardMaterial({ GBUF_GLSL }) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      varying vec3 vW;
      float lineAA(float x, float halfw) { float d = abs(fract(x) - 0.5); float w = fwidth(x); return 1.0 - smoothstep(halfw, halfw + w, d); }
      void main(){
        // iron plate in woodcut ember, strings in paper, the bass strings overstrung at an angle
        float bass = step(vW.x, -0.30);
        float sx = mix(vW.x, vW.x * 0.94 + (vW.z + 0.3) * 0.26, bass);
        float strings = lineAA(sx / 0.022, 0.12) * step(-1.86, vW.z) * step(vW.z, -0.36);
        // plate struts and the circular cut-outs
        float strut = step(abs(vW.z + 0.48), 0.035) + step(abs(vW.x + 0.30 + (vW.z + 0.4) * 0.12), 0.03) * step(vW.z, -0.45);
        vec2 h1 = vW.xz - vec2(0.18, -1.05), h2 = vW.xz - vec2(-0.15, -1.45), h3 = vW.xz - vec2(0.42, -0.72);
        float holes = step(length(h1), 0.11) + step(length(h2), 0.09) + step(length(h3), 0.08);
        float pins = lineAA(vW.x / 0.03, 0.18) * step(abs(vW.z + 0.40), 0.03);
        float shade = 0.8;
        float pal = PAL_RED;
        float hatch = 0.55;
        if (holes > 0.5) { shade = 0.08; pal = PAL_NEUTRAL; hatch = 1.0; }
        else if (strut > 0.5) { shade = 0.55; pal = PAL_OXBLOOD; }
        if (strings > 0.5 && holes < 0.5) { shade = 0.95; pal = PAL_NEUTRAL; hatch = 0.0; }
        if (pins > 0.5) { shade = 0.95; pal = PAL_NEUTRAL; hatch = 0.0; }
        gl_FragColor = gbuf(shade, pal, 1.5707963, hatch);
      }`,
  });
}

function sheetTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 200;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 200);
  g.fillStyle = '#000';
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let sys = 0; sys < 4; sys++) {
    const y0 = 24 + sys * 44;
    for (let l = 0; l < 5; l++) g.fillRect(12, y0 + l * 5, 232, 1.4);
    g.fillRect(12, y0, 1.6, 20); g.fillRect(242, y0, 1.6, 20);
    for (let k = 0; k < 13; k++) {
      const x = 30 + k * 16 + rnd() * 3, y = y0 - 4 + Math.floor(rnd() * 10) * 2.5;
      g.beginPath(); g.ellipse(x, y, 3.2, 2.3, -0.4, 0, Math.PI * 2); g.fill();
      g.fillRect(x + 2.4, y - 15, 1.2, 15);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function buildPiano(ctx) {
  const { inkMaterial, flatMaterial, cardMaterial, PAL } = ctx;
  const owned = [];
  const own = (o) => { owned.push(o); return o; };
  const group = new THREE.Group();
  const { HALF_W, Y0, BOARD, RIM, KEY_Y, KB_HALF, LID_FRONT } = PIANO;

  // ---------------------------------------------------------------- case, rim, keyboard furniture, legs, bench
  const out = outline(0);
  const inner = inset(out, 0.045);
  const caseShape = new THREE.Shape(out);
  const ring = new THREE.Shape(out);
  ring.holes.push(new THREE.Path(inner.slice().reverse()));
  const black = [
    strip(extrude(caseShape, BOARD - Y0, Y0)),
    strip(extrude(ring, RIM - BOARD, BOARD)),
    // fixed front lid section
    strip(ni(new THREE.BoxGeometry(HALF_W * 2, 0.022, LID_FRONT).translate(0, RIM + 0.011, -LID_FRONT / 2))),
    // fallboard, cheeks, keybed, key slip
    strip(box(KB_HALF * 2, 0.13, 0.035, 0, 0.815, 0.0175)),
    strip(box(HALF_W - KB_HALF, 0.15, 0.2, -(KB_HALF + HALF_W) / 2, 0.725, 0.1)),
    strip(box(HALF_W - KB_HALF, 0.15, 0.2, (KB_HALF + HALF_W) / 2, 0.725, 0.1)),
    strip(box(HALF_W * 2, 0.065, 0.2, 0, 0.69, 0.1)),
    strip(box(KB_HALF * 2, 0.04, 0.016, 0, 0.705, 0.193)),
    // music desk (tilted back) on the fixed front section
    strip(ni(new THREE.BoxGeometry(0.82, 0.3, 0.02).translate(0, 0.15, 0).rotateX(-0.22).translate(0, RIM + 0.022, -0.14))),
    strip(ni(new THREE.BoxGeometry(0.82, 0.025, 0.05).translate(0, 0, 0).translate(0, RIM + 0.034, -0.11))),
    // lyre posts + pedal box
    strip(box(0.022, 0.5, 0.03, -0.06, 0.39, -0.32)),
    strip(box(0.022, 0.5, 0.03, 0.06, 0.39, -0.32)),
    strip(box(0.26, 0.08, 0.09, 0, 0.1, -0.32)),
  ];
  const legAt = [[-0.6, -0.18], [0.6, -0.18], [-0.4, -1.62]];
  for (const [x, z] of legAt) {
    black.push(strip(ni(new THREE.CylinderGeometry(0.058, 0.04, 0.56, 14).translate(x, 0.08 + 0.28, z))));
    black.push(strip(box(0.15, 0.05, 0.15, x, Y0 - 0.025, z)));
  }
  // bench
  black.push(strip(box(0.78, 0.07, 0.36, 0, 0.5, 0.78)));
  for (const [x, z] of [[-0.35, 0.63], [0.35, 0.63], [-0.35, 0.93], [0.35, 0.93]]) black.push(strip(box(0.045, 0.47, 0.045, x, 0.235, z)));
  const caseGeo = own(mergeGeometries(black));
  for (const g of black) g.dispose();
  const caseMat = own(inkMaterial({ tone: 0.36, pal: PAL.NEUTRAL, angle: -1, hatch: 1, rim: 0.35 }));
  group.add(new THREE.Mesh(caseGeo, caseMat));

  // brass: casters and pedals
  const brassParts = [];
  for (const [x, z] of legAt) brassParts.push(strip(ni(new THREE.SphereGeometry(0.045, 10, 8).translate(x, 0.045, z))));
  for (const x of [-0.07, 0, 0.07]) brassParts.push(strip(box(0.028, 0.014, 0.1, x, 0.1, -0.24)));
  const brassGeo = own(mergeGeometries(brassParts));
  for (const g of brassParts) g.dispose();
  group.add(new THREE.Mesh(brassGeo, own(inkMaterial({ tone: 0.8, pal: PAL.DIM, angle: -1, rim: 0.3 }))));

  // soundboard + strings
  const board = new THREE.Mesh(own(extrude(new THREE.Shape(inner), 0.001, BOARD + 0.004)), own(soundboardMaterial(ctx)));
  group.add(board);

  // sheet music on the desk
  const sheetTex = own(sheetTexture());
  const sheet = new THREE.Mesh(own(new THREE.PlaneGeometry(0.56, 0.24)), own(cardMaterial(sheetTex, { hatch: 0.2, angle: 0, alphaTest: 0.5 })));
  sheet.position.set(0, RIM + 0.022 + 0.15 * Math.cos(0.22) + 0.02, -0.14 - 0.15 * Math.sin(0.22) + 0.016);
  sheet.rotation.x = -0.22;
  group.add(sheet);

  // ---------------------------------------------------------------- the lid, hinged on the straight (bass) side
  const lidPts = [V2(-0.74, LID_FRONT), ...outline(0).slice(1, -1), V2(0.74, LID_FRONT)];
  const lidShape = new THREE.Shape(lidPts);
  const lid = new THREE.Group();
  lid.position.set(-HALF_W, RIM, 0);
  const lidTop = extrude(lidShape, 0.024, 0);
  lidTop.translate(HALF_W, 0, 0);
  lid.add(new THREE.Mesh(own(lidTop), caseMat));
  const under = new THREE.ShapeGeometry(lidShape);
  under.rotateX(-Math.PI / 2);
  under.translate(HALF_W, -0.002, 0);
  const underMat = own(inkMaterial({ tone: 0.5, pal: PAL.NEUTRAL, angle: -1, hatch: 1, rim: 0.2, emissive: 0.12 }));
  underMat.side = THREE.DoubleSide;
  lid.add(new THREE.Mesh(own(under), underMat));
  group.add(lid);

  // prop stick
  const stickGeo = own(new THREE.CylinderGeometry(0.011, 0.013, 1, 8).translate(0, 0.5, 0));
  const stick = new THREE.Mesh(stickGeo, caseMat);
  const STICK_BASE = new THREE.Vector3(0.5, RIM - 0.03, -0.9);
  const R_CONTACT = STICK_BASE.x + HALF_W + 0.02;
  stick.position.copy(STICK_BASE);
  group.add(stick);
  const sdx = -0.74 + R_CONTACT * Math.cos(PIANO.LID_OPEN) - STICK_BASE.x;
  const sdy = RIM + R_CONTACT * Math.sin(PIANO.LID_OPEN) - STICK_BASE.y;
  const STICK_LEN = Math.hypot(sdx, sdy);
  const STICK_A0 = Math.atan2(sdy, -sdx);
  stick.scale.y = STICK_LEN;

  // ---------------------------------------------------------------- keys
  const WW = (KB_HALF * 2) / 52;
  const whites = [], blacks = [];
  for (let n = 0, w = 0; n < 88; n++) {
    const m = n % 12;
    if ([1, 4, 6, 9, 11].includes(m)) blacks.push({ n, x: -KB_HALF + w * WW });
    else { whites.push({ n, x: -KB_HALF + (w + 0.5) * WW }); w++; }
  }
  const whiteGeo = own(new THREE.BoxGeometry(WW * 0.93, 0.022, 0.15).translate(0, -0.011, 0.075));
  const blackGeo = own(new THREE.BoxGeometry(0.012, 0.016, 0.095).translate(0, -0.008, 0.0475));
  const wPress = new THREE.InstancedBufferAttribute(new Float32Array(whites.length), 1);
  const bPress = new THREE.InstancedBufferAttribute(new Float32Array(blacks.length), 1);
  whiteGeo.setAttribute('aPress', wPress);
  blackGeo.setAttribute('aPress', bPress);
  const whiteKeys = new THREE.InstancedMesh(whiteGeo, own(inkInstanced(ctx, { tone: 1.0, angle: 0, hatch: 0.3, rim: 0.05, pressDark: 0.55 })), whites.length);
  const blackKeys = new THREE.InstancedMesh(blackGeo, own(inkInstanced(ctx, { tone: 0.16, angle: 0, hatch: 1, rim: 0.35 })), blacks.length);
  for (const k of [whiteKeys, blackKeys]) { k.frustumCulled = false; k.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
  wPress.setUsage(THREE.DynamicDrawUsage); bPress.setUsage(THREE.DynamicDrawUsage);
  group.add(whiteKeys, blackKeys);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), X = new THREE.Vector3(1, 0, 0);
  const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();

  /** press: Float32Array(88), 0..1 per key (A0..C8). */
  function setPress(press) {
    whites.forEach((k, i) => {
      const a = press[k.n];
      q.setFromAxisAngle(X, a * 0.075);
      pos.set(k.x, KEY_Y, 0.035);
      whiteKeys.setMatrixAt(i, m4.compose(pos, q, one));
      wPress.array[i] = a;
    });
    blacks.forEach((k, i) => {
      const a = press[k.n];
      q.setFromAxisAngle(X, a * 0.085);
      pos.set(k.x, KEY_Y + 0.012, 0.035);
      blackKeys.setMatrixAt(i, m4.compose(pos, q, one));
      bPress.array[i] = a;
    });
    whiteKeys.instanceMatrix.needsUpdate = blackKeys.instanceMatrix.needsUpdate = true;
    wPress.needsUpdate = bPress.needsUpdate = true;
  }

  /** open: lid angle in radians; fold 0..1 lays the prop stick down into the case. */
  function setLid(open, fold) {
    lid.rotation.z = open;
    const a = STICK_A0 + (0.0 - STICK_A0) * fold;
    dir.set(-Math.cos(a), Math.sin(a), 0);
    stick.quaternion.setFromUnitVectors(UP, dir);
  }

  setPress(new Float32Array(88));
  setLid(PIANO.LID_OPEN, 0);

  return {
    group,
    setPress,
    setLid,
    dispose() { for (const o of owned) o.dispose(); },
  };
}

// ---------------------------------------------------------------- the phrase (pure function of p)
// Glissando up the whites, then I-vi-IV-V arpeggios in the right hand over roots in the
// left, then a held C chord before the lid closes.
const CHORDS = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const EVENTS = [];
for (let bar = 0; bar < 6; bar++) {
  const ch = CHORDS[bar % 4];
  for (let e = 0; e < 8; e++) EVENTS.push({ t: bar * 8 + e, k: ch[ARP[e]] + 12 - 21, d: 0.8 });
  EVENTS.push({ t: bar * 8, k: ch[0] - 24 - 21, d: 3.6 });
  EVENTS.push({ t: bar * 8 + 4, k: ch[2] - 24 - 21, d: 3.6 });
}
const FINAL = [36, 48, 55, 60, 64, 67, 72, 76].map((m) => m - 21);
const WHITE_IDX = [];
for (let n = 0; n < 88; n++) if (![1, 4, 6, 9, 11].includes(n % 12)) WHITE_IDX.push(n);

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function phrasePress(p, out) {
  out.fill(0);
  // glissando: a narrow wave over the whites, bass to treble
  const g = sm(0.0, 0.16, p) * 58 - 3;
  if (p < 0.17) {
    for (let w = 0; w < 52; w++) {
      const d = (w - g) / 1.4;
      const v = Math.exp(-d * d);
      if (v > 0.01) out[WHITE_IDX[w]] = Math.max(out[WHITE_IDX[w]], v);
    }
  }
  // arpeggios: 48 eighths over p 0.16 -> 0.78
  const s = ((p - 0.16) / 0.62) * 48;
  for (const ev of EVENTS) {
    const x = s - ev.t;
    if (x < 0 || x > ev.d + 0.25) continue;
    const v = x < 0.12 ? x / 0.12 : x < ev.d ? 1 : 1 - (x - ev.d) / 0.25;
    out[ev.k] = Math.max(out[ev.k], v);
  }
  // the final chord
  const c = sm(0.78, 0.8, p) * (1 - sm(0.84, 0.88, p));
  if (c > 0) for (const k of FINAL) out[k] = Math.max(out[k], c);
  return out;
}
