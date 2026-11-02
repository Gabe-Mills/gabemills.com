// Procedural engraved devices for the "apps" beat: a laptop with a hinged lid, a phone, and a
// watch on a looped strap. Ink bodies with engraved form lines, thin paper glass edges, side
// buttons, no logos or brand marks. Each builder returns { group, screen, ...pivots, dispose }.
import { roundedSlab, flatSlab, strapLoop } from './devices-geo.js';
import { screenMaterial } from './devices-screens.js';

function kit(ctx) {
  const { THREE, inkMaterial, PAL } = ctx;
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const mesh = (geo, mat) => new THREE.Mesh(own(geo), mat);
  const mats = {
    body: own(inkMaterial({ tone: 0.42, pal: PAL.NEUTRAL, angle: -1, rim: 0.55 })),
    dark: own(inkMaterial({ tone: 0.2, pal: PAL.NEUTRAL, angle: -1, rim: 0.4 })),
    metal: own(inkMaterial({ tone: 0.75, pal: PAL.NEUTRAL, angle: -1, rim: 0.4 })),
    strap: own(inkMaterial({ tone: 0.2, pal: PAL.NEUTRAL, angle: -1, rim: 0.3 })),
  };
  return { THREE, own, mesh, mats, dispose: () => owned.forEach((o) => o.dispose?.()) };
}

// ---------------------------------------------------------------- keyboard deck (shader on the base top)
function deckMaterial(ctx) {
  const { THREE, GBUF_GLSL } = ctx;
  return new THREE.ShaderMaterial({
    uniforms: { uGlow: { value: 0 }, uSize: { value: new THREE.Vector2(1, 1) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uGlow; uniform vec2 uSize; varying vec2 vUv;
      float sdRR(vec2 p, vec2 hs, float r){ vec2 d = abs(p) - hs + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
      void main(){
        vec2 p = (vUv - 0.5) * uSize;           // x right, y = back (hinge) .. front
        float back = clamp(0.5 + p.y / uSize.y, 0.0, 1.0);   // 1 at the hinge
        // the deck catches the screen's light near the hinge
        float lit = uGlow * (0.25 + 0.75 * back * back);
        float s = 0.2 + 0.42 * lit;
        float pal = lit > 0.62 ? PAL_ACCENT : PAL_NEUTRAL;
        float h = 1.0;
        // keys: 6 rows x 14, ink caps in a backlit bed (crisp, unhatched)
        vec2 kb = vec2(uSize.x * 0.86, uSize.y * 0.44);
        vec2 kc = vec2(0.0, uSize.y * 0.19);
        vec2 kp = p - kc;
        float bed = sdRR(kp, kb * 0.5 + 0.03, 0.04);
        if (bed < 0.0) {
          s = 0.06; pal = PAL_NEUTRAL; h = 0.0;
          if (uGlow > 0.3) { s = 0.6 + 0.35 * lit; pal = PAL_ACCENT; }
          vec2 cell = vec2(kb.x / 14.0, kb.y / 6.0);
          float row = clamp(floor((kp.y + kb.y * 0.5) / cell.y), 0.0, 5.0);
          float off = row == 0.0 ? 0.0 : (row == 1.0 ? 0.25 : 0.5 * mod(row, 2.0));
          vec2 g = vec2(kp.x + kb.x * 0.5 + off * cell.x, kp.y + kb.y * 0.5);
          vec2 f = mod(g, cell) - cell * 0.5;
          float cx = floor(g.x / cell.x);
          vec2 hs = cell * 0.39;
          // space bar on the front row (front = -y here)
          if (row == 0.0 && cx > 3.0 && cx < 9.0) { f.x = g.x - 6.5 * cell.x; hs.x = cell.x * 2.4; }
          float d = sdRR(f, hs, cell.y * 0.14);
          if (abs(kp.x) > kb.x * 0.5 || abs(kp.y) > kb.y * 0.5) d = 1.0;
          if (d < 0.0) { s = 0.04; pal = PAL_NEUTRAL; }
        }
        // trackpad
        float tp = sdRR(p - vec2(0.0, -uSize.y * 0.27), vec2(uSize.x * 0.19, uSize.y * 0.17), 0.05);
        if (tp < 0.0) s = s + 0.1;
        if (abs(tp) < 0.007) { s = 0.04; h = 0.0; }
        gl_FragColor = gbuf(s, pal, 0.0, h);
      }`,
  });
}

// ---------------------------------------------------------------- laptop
export function makeLaptop(ctx, { w = 3.0, depth = 2.0, base = 0.09, lidT = 0.05 } = {}) {
  const k = kit(ctx);
  const { THREE, mesh, mats, own } = k;
  const group = new THREE.Group();

  const body = mesh(flatSlab(THREE, w, depth, base, 0.12, 0.025), mats.body);
  group.add(body);
  // front lip notch + feet line
  const lip = mesh(new THREE.BoxGeometry(0.5, 0.012, 0.02), mats.dark);
  lip.position.set(0, base - 0.006, depth / 2 - 0.004);
  group.add(lip);

  const deckMat = own(deckMaterial(ctx));
  deckMat.uniforms.uSize.value.set(w - 0.16, depth - 0.16);
  const deck = mesh(new THREE.PlaneGeometry(w - 0.16, depth - 0.16), deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = base + 0.002;
  group.add(deck);

  // hinge barrel at the back edge
  const hinge = mesh(new THREE.CylinderGeometry(0.045, 0.045, w * 0.82, 16), mats.dark);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, base + 0.01, -depth / 2 + 0.03);
  group.add(hinge);

  // lid pivots at the hinge. Closed (angle 0) it lies on the base, screen face down.
  const lid = new THREE.Group();
  lid.position.set(0, base + 0.004, -depth / 2 + 0.02);
  group.add(lid);
  const lidBody = mesh(flatSlab(THREE, w, depth - 0.02, lidT, 0.12, 0.018), mats.body);
  lidBody.position.z = (depth - 0.02) / 2;
  lid.add(lidBody);
  const sw = w - 0.07, sh = depth - 0.09;
  const screenMat = own(screenMaterial(ctx, 'laptop', { size: [sw, sh], radius: 0.09, edge: 0.012, border: 0.07 }));
  const screen = mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
  screen.rotation.x = Math.PI / 2;            // faces -y (into the base when closed), top = +z
  screen.position.set(0, -0.002, (depth - 0.02) / 2 + 0.005);
  lid.add(screen);

  return {
    group, lid, screen, screenMat, deckMat,
    // world-space screen centre is lid-local (0, 0, depth/2)
    screenLocal: new THREE.Vector3(0, 0, (depth - 0.02) / 2),
    setOpen(rad) { lid.rotation.x = -rad; },
    dispose: k.dispose,
  };
}

// ---------------------------------------------------------------- phone
export function makePhone(ctx, { w = 0.76, h = 1.56, d = 0.085 } = {}) {
  const k = kit(ctx);
  const { THREE, mesh, mats, own } = k;
  const group = new THREE.Group();
  const body = mesh(roundedSlab(THREE, w, h, d, 0.13, 0.022), mats.body);
  group.add(body);

  // side buttons: power on the right, action + volume on the left
  const btn = (x, y, len) => {
    const b = mesh(roundedSlab(THREE, 0.024, len, 0.034, 0.011, 0.006), mats.metal);
    b.position.set(x, y, 0);
    group.add(b);
  };
  btn(w / 2 + 0.006, 0.3, 0.22);
  btn(-w / 2 - 0.006, 0.45, 0.08);
  btn(-w / 2 - 0.006, 0.28, 0.15);
  btn(-w / 2 - 0.006, 0.09, 0.15);

  // camera plateau on the back with two lenses and a flash
  const plate = mesh(roundedSlab(THREE, 0.32, 0.32, 0.03, 0.08, 0.01), mats.body);
  plate.position.set(-w / 2 + 0.2, h / 2 - 0.2, -d / 2 - 0.01);
  group.add(plate);
  const lensGeo = own(new THREE.CylinderGeometry(0.06, 0.065, 0.04, 24));
  const glassGeo = own(new THREE.CircleGeometry(0.038, 24));
  for (const [x, y] of [[-0.065, 0.065], [-0.065, -0.065]]) {
    const l = new THREE.Mesh(lensGeo, mats.metal);
    l.rotation.x = Math.PI / 2;
    l.position.set(plate.position.x + x, plate.position.y + y, -d / 2 - 0.035);
    const g = new THREE.Mesh(glassGeo, mats.dark);
    g.rotation.y = Math.PI;
    g.position.set(l.position.x, l.position.y, -d / 2 - 0.056);
    group.add(l, g);
  }
  const flash = new THREE.Mesh(own(new THREE.CircleGeometry(0.022, 16)), mats.metal);
  flash.rotation.y = Math.PI;
  flash.position.set(plate.position.x + 0.075, plate.position.y + 0.06, -d / 2 - 0.0265);
  group.add(flash);

  const sw = w - 0.03, sh = h - 0.03;
  const screenMat = own(screenMaterial(ctx, 'phone', { size: [sw, sh], radius: 0.115, edge: 0.007, border: 0.022 }));
  const screen = mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
  screen.position.z = d / 2 + 0.002;
  group.add(screen);

  return { group, screen, screenMat, screenW: sw - 2 * 0.029, screenH: sh - 2 * 0.029, front: d / 2 + 0.002, dispose: k.dispose };
}

// ---------------------------------------------------------------- watch on a looped strap
export function makeWatch(ctx, { w = 0.56, h = 0.66, d = 0.15 } = {}) {
  const k = kit(ctx);
  const { THREE, mesh, mats, own } = k;
  const group = new THREE.Group();
  // the loop stands on the desk; the case sits on its front at mid height
  const ry = 0.5, rz = 0.4, cy = ry + 0.02;
  const caseZ = rz + 0.02;
  const kase = mesh(roundedSlab(THREE, w, h, d, 0.16, 0.03), mats.body);
  kase.position.set(0, cy, caseZ);
  group.add(kase);

  const span = Math.asin(Math.min(0.95, (h * 0.42) / ry));
  const strap = mesh(strapLoop(THREE, { cy, ry, rz, a: span, b: Math.PI * 2 - span, width: w * 0.66, thick: 0.045 }), mats.strap);
  group.add(strap);
  // strap keeper loop and buckle at the back
  const keeper = mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 20), mats.metal);
  keeper.scale.set(4.6, 1, 1.4);
  keeper.rotation.x = Math.PI / 2;
  keeper.position.set(0, cy + ry * 0.05, -rz - 0.005);
  group.add(keeper);

  // digital crown (ridged) and side button
  const crown = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 14), mats.metal);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(w / 2 + 0.03, cy + 0.12, caseZ);
  const btn = mesh(roundedSlab(THREE, 0.03, 0.17, 0.06, 0.012, 0.008), mats.metal);
  btn.position.set(w / 2 + 0.008, cy - 0.1, caseZ);
  group.add(crown, btn);

  const sw = w - 0.05, sh = h - 0.05;
  const screenMat = own(screenMaterial(ctx, 'watch', { size: [sw, sh], radius: 0.13, edge: 0.008, border: 0.03 }));
  const screen = mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
  screen.position.set(0, cy, caseZ + d / 2 + 0.002);
  group.add(screen);

  return { group, screen, screenMat, height: cy + ry, dispose: k.dispose };
}
