// Beat "apps": "By night: native Apple apps."
// Night flips the mood from the ember racks: a dark engraved room (an ink curtain of vertical
// lines, a desk with a paper edge) lit only by device screens in GLOW.
//   p 0.00-0.30  the laptop lid opens on the desk and its screen powers on
//   p 0.25-0.55  the phone rises from the right and turns to face the camera
//   p 0.50-0.75  the watch slides in from the left on its looped strap
//   p 0.75-1.00  the camera pushes into the phone until its glowing list fills the frame
// progress(p) is a pure function of p (plus aspect and a small pointer parallax).
// Portrait screens get their own layout: laptop at the back, phone and watch in front.
import { makeLaptop, makePhone, makeWatch } from './lib/devices-models.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const outCubic = (t) => 1 - (1 - t) ** 3;
const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const outBack = (t, s = 1.4) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

// layouts: device placement + what the wide camera must fit (half width / height around `look`)
const LAND = {
  laptop: { x: -0.25, z: -0.45, ry: 0.08 },
  phone: { x: 2.0, y: 0.86, z: 0.8, ry: -0.36 },
  watch: { x: -2.15, z: 0.95, ry: 0.42 },
  look: { x: 0, y: 0.8, z: 0.1 }, hw: 3.05, hh: 1.45, elev: 0.2,
};
const PORT = {
  laptop: { x: 0, z: -1.0, ry: 0 },
  phone: { x: 0.72, y: 0.84, z: 1.25, ry: -0.24 },
  watch: { x: -0.82, z: 1.45, ry: 0.34 },
  look: { x: 0, y: 0.62, z: 0.3 }, hw: 1.58, hh: 2.0, elev: 0.3,
};
const DESK_FRONT = 2.3;
const LID_OPEN = 1.86;

const LIGHT_GLSL = /* glsl */ `
  uniform vec4 uL0, uL1, uL2;   // xyz = light centre, w = intensity
  uniform vec3 uR;               // radius per light
  float pool(vec2 p, vec2 c, float r){ vec2 d = (p - c) / r; return exp(-dot(d, d)); }
`;

export function create(ctx) {
  const { THREE, inkMaterial, flatMaterial, PAL, GBUF_GLSL, engine } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, engine?.aspect || 1.6, 0.03, 80);
  const owned = [];
  const own = (x) => (owned.push(x), x);

  const lightU = {
    uL0: { value: new THREE.Vector4() },
    uL1: { value: new THREE.Vector4() },
    uL2: { value: new THREE.Vector4() },
  };
  const lights = [lightU.uL0.value, lightU.uL1.value, lightU.uL2.value];

  // ---------------------------------------------------------------- backdrop: ink curtain of vertical lines
  const curtainMat = own(new THREE.ShaderMaterial({
    uniforms: { ...lightU, uR: { value: new THREE.Vector3(2.0, 0.9, 0.7) } },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      ${LIGHT_GLSL}
      varying vec3 vW;
      float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
      float n(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
      void main(){
        float x = vW.x, y = vW.y;
        float fold = 0.5 + 0.5 * sin(x * 2.1 + 1.6 * sin(x * 0.6) + n(x * 1.2) * 2.0);
        float pleat = n(x * 8.0 + 3.0);
        float L = uL0.w * pool(vec2(x, y * 1.3), vec2(uL0.x, uL0.y * 1.3), uR.x)
                + uL1.w * pool(vec2(x, y), uL1.xy, uR.y * 1.6)
                + uL2.w * pool(vec2(x, y), uL2.xy, uR.z * 1.6);
        // night: mostly ink, folds catch a little paper; the screens lift it around them
        float shade = 0.08 + 0.15 * fold + 0.06 * pleat;
        shade += L * (0.1 + 0.2 * fold);
        shade *= mix(0.55, 1.0, smoothstep(6.5, 2.0, y));
        gl_FragColor = gbuf(shade, PAL_NEUTRAL, 1.5707963, 1.0);
      }`,
  }));
  const curtain = new THREE.Mesh(own(new THREE.PlaneGeometry(40, 14)), curtainMat);
  curtain.position.set(0, 4.5, -3.2);
  scene.add(curtain);

  // ---------------------------------------------------------------- desk: dark top, pools of screen light, paper edge
  const deskMat = own(new THREE.ShaderMaterial({
    uniforms: { ...lightU, uR: { value: new THREE.Vector3(1.55, 0.5, 0.38) } },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      ${LIGHT_GLSL}
      varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float L = uL0.w * pool(p, uL0.xz, uR.x) + uL1.w * pool(p, uL1.xz, uR.y) + uL2.w * pool(p, uL2.xz, uR.z);
        float grain = sin(p.y * 7.0 + sin(p.x * 0.9) * 1.5) * 0.5 + 0.5;
        float s = 0.07 + 0.06 * grain + L * 0.55;
        float pal = L > 0.55 ? PAL_ACCENT : PAL_NEUTRAL;
        if (L > 0.55) s = 0.55 + 0.4 * smoothstep(0.55, 1.1, L) + 0.04 * grain;
        // the front of the desk catches a little more light
        s += 0.12 * smoothstep(${(DESK_FRONT - 1.2).toFixed(2)}, ${DESK_FRONT.toFixed(2)}, p.y);
        gl_FragColor = gbuf(s, pal, 0.0, 1.0);
      }`,
  }));
  const deskDepth = DESK_FRONT + 3.3;
  const desk = new THREE.Mesh(own(new THREE.PlaneGeometry(40, deskDepth)), deskMat);
  desk.rotation.x = -Math.PI / 2;
  desk.position.set(0, 0, DESK_FRONT - deskDepth / 2);
  scene.add(desk);
  // paper edge: a bright lip and a thin rule under it, then the void
  const lip = new THREE.Mesh(own(new THREE.BoxGeometry(40, 0.16, 0.06)), own(inkMaterial({ tone: 0.9, pal: PAL.NEUTRAL, angle: 0, rim: 0, emissive: 0.12 })));
  lip.position.set(0, -0.08, DESK_FRONT);
  const rule = new THREE.Mesh(own(new THREE.BoxGeometry(40, 0.03, 0.1)), own(flatMaterial({ shade: 1, pal: PAL.PAPER_FLAT })));
  rule.position.set(0, -0.2, DESK_FRONT - 0.02);
  const under = new THREE.Mesh(own(new THREE.PlaneGeometry(40, 12)), own(flatMaterial({ shade: 0.02, pal: PAL.NEUTRAL })));
  under.position.set(0, -6.2, DESK_FRONT - 0.05);
  scene.add(lip, rule, under);

  // ---------------------------------------------------------------- devices
  const laptop = makeLaptop(ctx);
  const phone = makePhone(ctx);
  const watch = makeWatch(ctx);
  scene.add(laptop.group, phone.group, watch.group);

  // ---------------------------------------------------------------- state
  let P = 0;
  let pnx = 0, pny = 0;
  const lay = { laptop: { x: 0, z: 0, ry: 0 }, phone: { x: 0, y: 0, z: 0, ry: 0 }, watch: { x: 0, z: 0, ry: 0 }, look: { x: 0, y: 0, z: 0 }, hw: 0, hh: 0, elev: 0 };
  const v = new THREE.Vector3();
  const camWide = new THREE.Vector3();
  const lookWide = new THREE.Vector3();
  const camEnd = new THREE.Vector3();
  const lookEnd = new THREE.Vector3();
  const look = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  function blendLayout(aspect) {
    const k = sm(1.15, 0.7, aspect);
    for (const dev of ['laptop', 'phone', 'watch', 'look']) {
      for (const key of Object.keys(lay[dev])) lay[dev][key] = lerp(LAND[dev][key], PORT[dev][key], k);
    }
    lay.hw = lerp(LAND.hw, PORT.hw, k);
    lay.hh = lerp(LAND.hh, PORT.hh, k);
    lay.elev = lerp(LAND.elev, PORT.elev, k);
  }

  function pose() {
    const p = P;
    const aspect = camera.aspect || 1.6;
    blendLayout(aspect);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

    // ---- laptop: lid opens, screen powers on
    const L = lay.laptop;
    laptop.group.position.set(L.x, 0, L.z);
    laptop.group.rotation.y = L.ry;
    const open = sm(0.02, 0.28, p);
    laptop.setOpen(LID_OPEN * outCubic(open));
    const lapOn = sm(0.14, 0.32, p);
    laptop.screenMat.uniforms.uOn.value = lapOn;
    laptop.screenMat.uniforms.uFill.value = p < 0.45 ? 1 : 2;
    laptop.deckMat.uniforms.uGlow.value = lapOn;

    // ---- phone: rises from the lower right, turning from its back to face the camera
    const F = lay.phone;
    const tp = sm(0.25, 0.55, p);
    const push = inOutCubic(sm(0.75, 1.0, p));
    phone.group.position.set(
      lerp(F.x + 2.2, F.x, outCubic(tp)),
      lerp(F.y - 3.0, F.y, outBack(tp, 0.9)),
      lerp(F.z + 0.6, F.z, outCubic(tp)),
    );
    phone.group.rotation.set(0, lerp(F.ry - 2.75, F.ry, outCubic(tp)) * (1 - push), lerp(-0.42, 0, outCubic(tp)));
    phone.screenMat.uniforms.uOn.value = sm(0.42, 0.6, p);
    phone.screenMat.uniforms.uFill.value = p < 0.66 ? -9 : (p < 0.86 ? 2 : 3);

    // ---- watch: slides in from the left along the desk
    const W = lay.watch;
    const tw = sm(0.5, 0.75, p);
    watch.group.position.set(lerp(W.x - 5.2, W.x, outCubic(tw)), 0, lerp(W.z + 0.4, W.z, outCubic(tw)));
    watch.group.rotation.y = lerp(W.ry + 1.3, W.ry, outCubic(tw));
    watch.screenMat.uniforms.uOn.value = sm(0.6, 0.76, p);
    watch.screenMat.uniforms.uFill.value = 0.12 + 0.72 * sm(0.62, 0.95, p);

    // ---- screen light on the desk and curtain (screen centre, pushed forward along its facing)
    laptop.group.updateMatrixWorld(true);
    phone.group.updateMatrixWorld(true);
    v.copy(laptop.screenLocal);
    laptop.lid.localToWorld(v);
    lights[0].set(v.x + Math.sin(L.ry) * 0.9, v.y, v.z + 0.9, lapOn);
    lights[1].set(phone.group.position.x - 0.08, phone.group.position.y, phone.group.position.z + 0.16, phone.screenMat.uniforms.uOn.value * 0.9);
    lights[2].set(watch.group.position.x + 0.03, 0.55, watch.group.position.z + 0.62, watch.screenMat.uniforms.uOn.value * 0.8);

    // ---- camera: wide fit around the layout, then push square into the phone screen
    const dist = Math.max(lay.hh / tanV, lay.hw / (tanV * aspect));
    const par = 1 - push;
    lookWide.set(lay.look.x + pnx * 0.06 * par, lay.look.y, lay.look.z);
    camWide.set(lay.look.x + pnx * 0.25 * par, lay.look.y + Math.sin(lay.elev) * dist + pny * 0.12 * par, lay.look.z + Math.cos(lay.elev) * dist);
    // establish: start a touch further out and drift in until the push
    const drift = 1 + 0.08 * (1 - sm(0.0, 0.75, p));
    camWide.sub(lookWide).multiplyScalar(drift).add(lookWide);

    nrm.set(0, 0, 1).applyQuaternion(phone.group.quaternion);
    lookEnd.set(0, 0, phone.front).applyMatrix4(phone.group.matrixWorld);
    const fill = Math.min((phone.screenH / 2) / tanV, (phone.screenW / 2) / (tanV * aspect)) * 0.86;
    camEnd.copy(lookEnd).addScaledVector(nrm, fill);
    camera.position.lerpVectors(camWide, camEnd, push);
    look.lerpVectors(lookWide, lookEnd, push);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }

  return {
    scene, camera,
    enter() { pose(); },
    progress(p) { P = p; pose(); },
    update(dt) {
      const k = ctx.reduced ? 1 : Math.min(1, dt * 3);
      const tx = ctx.reduced ? 0 : ctx.pointer?.nx ?? 0;
      const ty = ctx.reduced ? 0 : ctx.pointer?.ny ?? 0;
      if (Math.abs(tx - pnx) + Math.abs(ty - pny) > 1e-4) {
        pnx += (tx - pnx) * k;
        pny += (ty - pny) * k;
        pose();
      }
    },
    resize() { pose(); },
    exit() {},
    dispose() {
      laptop.dispose(); phone.dispose(); watch.dispose();
      for (const o of owned) o.dispose?.();
      scene.clear();
    },
  };
}
