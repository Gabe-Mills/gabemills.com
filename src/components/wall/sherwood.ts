// Sherwood, the emerald candy blob with gold eyes, ported from Gabe's trading dashboard
// (robinhood-agent web/js/modules/mascot.js + blobkit.js, T671/T692/T696) into the site's three.js
// scene (T730). Same shapes, faces, morphs, blinks and micro behaviours; the dashboard's photo
// studio lighting is evaluated inside Sherwood's own materials (see sherwood/shaders.ts), so it adds
// no lights, shadow maps, render targets or WebGL contexts to the host scene.
//
// Units: metres. group origin = blob centre, blob ~0.32 m tall, the gold ring ~0.5 m across.
// Usage:
//   const sw = createSherwood({ reducedMotion, quality: 1 });
//   scene.add(sw.group); sw.group.position.set(...); sw.appear();
//   per frame: sw.lookAt(cursorWorldPoint | null); sw.update(dt, t, camera);
//
// The morph approach is inspired by bloub (MIT) by Jérémy, https://github.com/jeremy-prt/bloub.

import * as THREE from "three";
import {
  BASE, KEYS, SPRINGY, STATES, MICRO, MICRO_KEYS, TAU, clamp, smooth, easeOutQuint, easeOutBack, hopCurve, dotPulse,
  type Pose, type MicroCtx,
} from "./sherwood/poses";
import { SHAPE, BODY_VERT, FACE, FACE_FRAG, LIGHT_FRAG, AO_FRAG, STUDIO_PARS, STUDIO_LIGHT, EXPO_FRAG } from "./sherwood/shaders";

export type SherwoodState = "idle" | "hello" | "talking" | "thinking" | "happy" | "listening";
export interface Sherwood {
  /** add to your scene; origin = blob centre; ~0.32 m tall blob */
  group: THREE.Group;
  /** materialize: grows from a bright point with overshoot + the gold ring snapping in, ~1.2 s */
  appear(): void;
  /** blended morph to a state, like the dashboard */
  setState(s: SherwoodState): void;
  /** eyes/head glance toward a world point (cursor); null = look at the camera */
  lookAt(worldPoint: THREE.Vector3 | null): void;
  /** once per frame; turns Sherwood to face the camera so the face is always readable */
  update(dt: number, t: number, camera: THREE.Camera): void;
  dispose(): void;
}

/** blob height in rig units (flat bottom at about -0.9, crown at +1) */
const UNIT_H = 1.92;
const HEIGHT_M = 0.32;
const SCALE = HEIGHT_M / UNIT_H;
const CENTRE_Y = 0.05; // rig-space y of the blob's visual centre
const GROUND = -1.0;
/** icosphere detail per quality level (0 low, 1 default, 2 high) */
const DETAIL = [20, 32, 48];
/** output scale matching the dashboard's Neutral@1.0 look under the site's ACES@1.1 (see EXPO_FRAG) */
const EXPOSURE = 0.56;
/** how much the host scene's own lights reach Sherwood (they tint, the built-in studio lights) */
const HOST_LIGHT = 0.25;
/** brightness ceilings (pre tone mapping) so only the eyes and a little of the ring reach the bloom */
const CAP_BODY = 0.98, CAP_RING = 1.3;

// the dashboard studio (blobkit buildKit + makeLights), in Sherwood's frame
const PANELS: { w: number; h: number; col: [number, number, number]; k: number; p: [number, number, number] }[] = [
  { w: 6, h: 4.2, col: [1, 0.98, 0.94], k: 9, p: [-4.2, 5.6, 5] }, // big softbox high left
  { w: 1.3, h: 8.5, col: [1, 0.6, 0.16], k: 5, p: [6.6, 1, -4.4] }, // warm gold strip behind right
  { w: 1.1, h: 7, col: [0.6, 0.85, 1], k: 2.2, p: [-7, 0, -1.6] }, // cool strip left
  { w: 2.4, h: 1.6, col: [1, 1, 1], k: 2.4, p: [3.6, 3.2, 6.4] }, // small front fill
  { w: 9, h: 4, col: [0.1, 0.35, 0.2], k: 0.8, p: [0, -6, 2] }, // green floor bounce
];
const KEY_DIR = new THREE.Vector3(-3, 5.5, 4.5).normalize();
const RIM_DIR = new THREE.Vector3(3.8, 2.2, -4).normalize();
const FILL_DIR = new THREE.Vector3(-4.5, -1.8, 2.5).normalize();

type U<T> = { value: T };
const u = <T,>(value: T): U<T> => ({ value });

export function createSherwood(opts: { reducedMotion?: boolean; quality?: 0 | 1 | 2 } = {}): Sherwood {
  const reduce = !!opts.reducedMotion;
  const motion = reduce ? 0.3 : 1;
  const detail = DETAIL[opts.quality ?? 1] ?? DETAIL[1];
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(o: T): T => (disposables.push(o), o);

  /* ---------------------------------------------------------- lighting uniforms ---- */
  const panelU = {
    uPanC: u(PANELS.map((p) => new THREE.Vector3(...p.p))),
    uPanU: u([] as THREE.Vector3[]), uPanW: u([] as THREE.Vector3[]),
    uPanH: u(PANELS.map((p) => new THREE.Vector2(p.w / 2, p.h / 2))),
    uPanL: u(PANELS.map((p) => new THREE.Vector3(...p.col).multiplyScalar(p.k))),
    uPanE: u(PANELS.map((p) => {
      const d2 = new THREE.Vector3(...p.p).lengthSq();
      return new THREE.Vector3(...p.col).multiplyScalar(p.k * ((p.w * p.h) / d2) * 0.8);
    })),
  };
  // panel axes exactly as Object3D.lookAt(origin) would orient a plane at p
  for (const c of panelU.uPanC.value) {
    const z = c.clone().negate().normalize();
    const x = new THREE.Vector3(0, 1, 0).cross(z).normalize();
    panelU.uPanU.value.push(x);
    panelU.uPanW.value.push(z.clone().cross(x));
  }
  const keyCol = new THREE.Color(0xfff1de).multiplyScalar(2.1);
  const fillCol = new THREE.Color(0x8ccfff).multiplyScalar(0.45);
  const LU = {
    ...panelU,
    uS2V: u(new THREE.Matrix3()), uStudioI: u(1), uHostI: u(HOST_LIGHT), uExpo: u(EXPOSURE),
    uKeyC: u(new THREE.Vector3(keyCol.r, keyCol.g, keyCol.b)), uKeyV: u(new THREE.Vector3()),
    uRimC: u(new THREE.Vector3()), uRimV: u(new THREE.Vector3()),
    uFillC: u(new THREE.Vector3(fillCol.r, fillCol.g, fillCol.b)), uFillV: u(new THREE.Vector3()),
  };
  /** light a physical material with the studio (no scene lights involved) */
  function studioize(mat: THREE.MeshPhysicalMaterial, key: string, cap: number) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, LU, { uCap: u(cap) });
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n#define SM_GLOW 0.0\n" + STUDIO_PARS)
        .replace("#include <lights_fragment_maps>", STUDIO_LIGHT)
        .replace("#include <opaque_fragment>", EXPO_FRAG);
    };
    mat.customProgramCacheKey = () => key;
    return mat;
  }

  /* ---------------------------------------------------------------- body ---- */
  const spk: THREE.Vector3[] = [];
  for (let i = 0; i < 14; i++) {
    const y = 1 - (i + 0.5) / 7, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.39996;
    spk.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize());
  }
  const eye = [1, 0.62, 0.17], sss = [0.01, 0.42, 0.17], fc = [1, 0.72, 0.3];
  const BU = {
    uTime: u(0), uEgg: u(0), uHex: u(0), uTri: u(0), uHeart: u(0), uFlower: u(0), uDrop: u(0), uMelt: u(0), uFlat: u(0),
    uBurst: u(0), uComet: u(0), uTwist: u(0), uTall: u(0), uBox: u(0), uBoxN: u(4), uBoxA: u(0),
    uWobble: u(0.02), uWobbleF: u(1.25), uLobe: u(0), uSpk: u(spk),
    uGaze: u(new THREE.Vector2()), uEyeWH: u(new THREE.Vector2(0.13, 0.172)), uOpen: u(new THREE.Vector2(1, 1)), uLine: u(new THREE.Vector2()),
    uSplit: u(0.29), uEyeY: u(0.1), uArcK: u(-1), uChev: u(0), uDiam: u(0), uSpiral: u(0), uPupil: u(0), uLid: u(0), uLidH: u(1.8), uCarve: u(0),
    uEyeGlow: u(1), uEyeRoll: u(0), uSss: u(1), uRimI: u(1), uFleck: u(0.16), uFT: u(0), uBlush: u(0), uGroundY: u(GROUND), uFlash: u(0),
    uBrow: u(new THREE.Vector4()), uMouth: u(new THREE.Vector4()), uMouth2: u(new THREE.Vector4()), uMouth3: u(new THREE.Vector4()),
    // gold features are HDR: eye cores reach ~1.3 after uExpo, so the host's bloom (threshold 1.02) catches them
    uEyeCol: u(new THREE.Color(eye[0], eye[1], eye[2]).multiplyScalar(1.45)), uRimCol: u(new THREE.Color()),
    uSssCol: u(new THREE.Color(sss[0], sss[1], sss[2])), uRimDir: LU.uRimV, uKeyDir: LU.uKeyV,
    uFleckCol: u(new THREE.Color(fc[0], fc[1], fc[2])),
  };
  const bodyMat = keep(new THREE.MeshPhysicalMaterial({
    color: 0x0a6a3e, roughness: 0.36, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.035, specularIntensity: 0.55, ior: 1.5,
  }));
  bodyMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, BU, LU, { uCap: u(CAP_BODY) });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + SHAPE)
      .replace("#include <beginnormal_vertex>", BODY_VERT)
      .replace("#include <begin_vertex>", "vec3 transformed = smPos;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n#define SM_GLOW max(smEye * (1.0 - smPup), smCatch)\n" + FACE + STUDIO_PARS)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + FACE_FRAG + LIGHT_FRAG)
      .replace("#include <lights_fragment_maps>", STUDIO_LIGHT)
      .replace("#include <opaque_fragment>", EXPO_FRAG)
      .replace("#include <aomap_fragment>", "#include <aomap_fragment>\n" + AO_FRAG);
  };
  bodyMat.customProgramCacheKey = () => "gm-sherwood-body-v1";

  const bodyGeo = keep(new THREE.IcosahedronGeometry(1, detail));
  bodyGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2); // room for spikes and squash

  // hierarchy: group (host) > facer (turns to the camera) > scaler (metres, appear) > rig (pose)
  const group = new THREE.Group();
  group.name = "Sherwood";
  group.userData.uniforms = LU; // for tuning in the lab (uExpo, uHostI, uStudioI)
  const facer = new THREE.Group();
  const scaler = new THREE.Group();
  scaler.position.y = -CENTRE_Y * SCALE;
  const rig = new THREE.Group();
  group.add(facer); facer.add(scaler); scaler.add(rig);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  rig.add(body);

  /* ---------------------------------------------------------------- ring ---- */
  const haloTilt = new THREE.Group(), haloSpin = new THREE.Group();
  haloTilt.add(haloSpin); rig.add(haloTilt);
  const ringMat = keep(studioize(new THREE.MeshPhysicalMaterial({
    color: 0xf3c160, metalness: 1, roughness: 0.2, anisotropy: 0.65, anisotropyRotation: Math.PI / 2,
    clearcoat: 0.6, clearcoatRoughness: 0.04, emissive: 0xf3c160, emissiveIntensity: 0.12,
  }), "gm-sherwood-ring-v1", CAP_RING));
  const beadMat = keep(studioize(new THREE.MeshPhysicalMaterial({
    color: 0xf3c160, metalness: 1, roughness: 0.16, clearcoat: 0.6, clearcoatRoughness: 0.04, emissive: 0xf3c160, emissiveIntensity: 0.12,
  }), "gm-sherwood-bead-v1", CAP_RING));
  const ringGeo = keep(new THREE.TorusGeometry(1.5, 0.036, 16, 128));
  ringGeo.computeTangents();
  haloSpin.add(new THREE.Mesh(ringGeo, ringMat));
  const beadGeo = keep(new THREE.SphereGeometry(1, 20, 10));
  [0.075, 0.055, 0.055].forEach((s, i) => {
    const b = new THREE.Mesh(beadGeo, beadMat);
    const a = (i / 3) * TAU;
    b.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0);
    b.scale.setScalar(s);
    haloSpin.add(b);
  });
  // thought dots for "thinking"
  const sats = [0, 1, 2].map(() => { const s = new THREE.Mesh(beadGeo, beadMat); s.visible = false; rig.add(s); return s; });

  /* ------------------------------------------------------------ confetti ---- */
  const CONF = 36;
  const confMat = keep(studioize(new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.25, clearcoat: 0.4 }), "gm-sherwood-conf-v1", CAP_BODY));
  const conf = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.09, 0.09, 0.014)), confMat, CONF);
  const confC = [0xe7b04a, 0xfff0c0, 0xc98a2a, 0x3fd38e].map((c) => new THREE.Color(c));
  type Bit = { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3; life: number };
  const bits: Bit[] = [];
  for (let i = 0; i < CONF; i++) {
    conf.setColorAt(i, confC[i % confC.length]);
    bits.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 });
  }
  conf.visible = false; conf.frustumCulled = false;
  scaler.add(conf);
  const dummy = new THREE.Object3D();

  /* ------------------------------------------------------ appear flash ---- */
  const flashTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,240,200,0.75)");
    gr.addColorStop(0.45, "rgba(255,200,110,0.2)"); gr.addColorStop(1, "rgba(255,190,90,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  keep(flashTex);
  const flashMat = keep(new THREE.SpriteMaterial({
    map: flashTex, color: new THREE.Color(1, 0.86, 0.6), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, toneMapped: false,
  }));
  const flash = new THREE.Sprite(flashMat);
  flash.visible = false;
  flash.renderOrder = 2;
  facer.add(flash); // outside the scaler, so it shows while the body is still at zero size

  /* ------------------------------------------------------------- state ---- */
  let time = 0;
  let req: string = "idle", reqT0 = 0;
  let active = "idle", activeT0 = 0, since = 9, morph = 0.45;
  const cur: Pose = { ...BASE }, from: Pose = { ...BASE }, tgt: Pose = { ...BASE };
  let spring = 0, springV = 0, blinkAt = -10, nextBlink = 1.4, doubleBlink = false;
  let jumpY = 0, jumpV = 0, jumpAt = -1, jumpPend = 0;
  let px = 0, py = 0, pgx = 0, pgy = 0, leanX = 0, leanY = 0, hasTarget = false;
  let wx = 0, wy = 0, wtx = 0, wty = 0, nextSacc = 1, noiseT = 0, lastConfCycle = -1;
  let micro: (MicroCtx & { k: string; t0: number; dur: number }) | null = null, nextMicro = 2.6, lastMicro = "";
  let appearT0 = -99, appearing = false, ringKicked = false;
  let yaw = 0, pitch = 0, faced = false;
  const target = new THREE.Vector3();
  let wantTarget = false;

  function enter(name: string) {
    if (name === active) return;
    Object.assign(from, cur);
    active = name; activeT0 = time;
    const S = STATES[name];
    morph = reduce ? 0.25 : S.morph;
    since = reduce ? 0 : -0.06; // a beat of anticipation squash before the morph starts
    if (S.blinkIn) blinkAt = time;
    if (!reduce) {
      springV -= 1.9;
      if (S.jump) { jumpAt = time + 0.08; jumpPend = S.jump; }
    }
    lastConfCycle = -1;
    micro = null; nextMicro = time + 2 + Math.random() * 2;
  }
  function resolve() {
    const d = STATES[req];
    return d.next && d.dur != null && time - reqT0 >= d.dur ? d.next : req;
  }

  function step(dt: number) {
    time += dt;
    enter(resolve());
    since += dt;
    const S = STATES[active];
    Object.assign(tgt, BASE, S.pose(time - activeT0));

    if (S.micro && !reduce && !appearing) {
      if (!micro && time >= nextMicro) {
        let k: string;
        do { k = MICRO_KEYS[(Math.random() * MICRO_KEYS.length) | 0]; } while (k === lastMicro || (k === "tilt" && active === "listening"));
        const M = MICRO[k];
        micro = { k, t0: time, dur: M.dur, gx: 0, gy: 0 };
        if (M.cursor) {
          micro.gx = hasTarget ? clamp(px * 0.22, -0.24, 0.24) : (Math.random() < 0.5 ? -0.18 : 0.18);
          micro.gy = hasTarget ? clamp(-py * 0.14, -0.14, 0.14) : 0.04;
        }
        if (M.jump) { jumpAt = time; jumpPend = M.jump; }
        lastMicro = k;
      }
      if (micro) {
        const uu = (time - micro.t0) / micro.dur;
        if (uu >= 1) { micro = null; nextMicro = time + 2.2 + Math.random() * 2.8; }
        else { const d = MICRO[micro.k].f(uu, micro); for (const key in d) tgt[key as keyof Pose] += d[key as keyof Pose]!; }
      }
    }

    const s = clamp(since / morph);
    const kq = easeOutQuint(s), kb = easeOutBack(s);
    for (const key of KEYS) cur[key] = from[key] + (tgt[key] - from[key]) * (SPRINGY.has(key) && !reduce ? kb : kq);

    if (!reduce) {
      for (let i = 0; i < 2; i++) { const h = dt / 2; springV += (-210 * spring - 13 * springV) * h; spring += springV * h; }
      spring = clamp(spring, -0.24, 0.24);
      if (jumpPend && time >= jumpAt) { jumpV = jumpPend; jumpPend = 0; springV += 1.4; }
      if (jumpY > 0 || jumpV > 0) {
        jumpV -= 17 * dt; jumpY += jumpV * dt;
        if (jumpY <= 0) { jumpY = 0; springV += jumpV * 0.32; jumpV = 0; }
      }
    }
    if (time >= nextBlink) {
      blinkAt = time;
      if (!doubleBlink && Math.random() < 0.18) { doubleBlink = true; nextBlink = time + 0.26; }
      else { doubleBlink = false; nextBlink = time + 1.9 + Math.random() * 2.7; }
    }
    // gaze: the look target when there is one, otherwise saccades and drift
    const ga = 1 - Math.exp(-dt * 6);
    const fresh = hasTarget ? 1 : 0;
    pgx += (px * 0.19 * fresh - pgx) * ga; pgy += (-py * 0.12 * fresh - pgy) * ga;
    if (time > nextSacc) {
      const home = Math.random() < 0.3;
      wtx = home ? 0 : (Math.random() * 2 - 1) * 0.11; wty = home ? 0 : (Math.random() * 2 - 1) * 0.06;
      nextSacc = time + 1.3 + Math.random() * 2.4;
    }
    const sa = 1 - Math.exp(-dt * 16);
    wx += (wtx - wx) * sa; wy += (wty - wy) * sa;
    const la = 1 - Math.exp(-dt * 3);
    leanX += (px * fresh - leanX) * la; leanY += (py * fresh - leanY) * la;
    noiseT += dt * cur.wobbleS * motion;
  }
  function blinkLid() {
    const k = (time - blinkAt) / 0.17;
    if (k < 0 || k > 1) return 1;
    return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
  }

  /* applyPose from blobkit, minus the floor shadow and sweat drop */
  function applyPose(p: Pose, lid: number, ringK: number, dt: number) {
    const t = time, mo = motion, Bu = BU;
    const breath = 1 + Math.sin(t * TAU * p.breathR) * p.breathA * (reduce ? 0.5 : 1);
    const bobY = Math.sin(t * TAU * p.bobR) * p.bob * mo;
    const [hh, hsq] = p.hopH > 0.001 ? hopCurve(t, p.hopP) : [0, 0];
    const hopY = hh * p.hopH * mo, hopSq = hsq * clamp(p.hopH / 0.22) * mo;
    const shakeX = (Math.sin(t * 57) + Math.sin(t * 41.3)) * 0.011 * p.shake * mo;
    const air = clamp(jumpV * 0.03, -0.08, 0.1);
    const sp = 1 + spring + hopSq + air;
    rig.position.set(p.x + shakeX, p.y + bobY + hopY + jumpY, 0);
    rig.rotation.set(leanY * 0.1 * p.lean * p.follow, leanX * 0.2 * p.lean * p.follow + p.yaw, p.rotZ + Math.sin(t * 31) * 0.012 * p.shake * mo);
    const sy = p.sy * breath * sp * p.scale, sx = (p.sx / Math.sqrt(Math.max(0.2, sp))) * (2 - breath) ** 0.5 * p.scale;
    body.scale.set(sx, sy, sx);
    body.position.y = (sy - 1) * 0.98;

    Bu.uTime.value = noiseT; Bu.uFT.value = t;
    Bu.uEgg.value = clamp(p.egg, 0, 1.2); Bu.uHex.value = clamp(p.hex, 0, 1.2); Bu.uTri.value = clamp(p.tri, 0, 1.2);
    Bu.uHeart.value = clamp(p.heart, 0, 1.2); Bu.uFlower.value = clamp(p.flower, 0, 1.2); Bu.uDrop.value = clamp(p.drop, 0, 1.2);
    Bu.uMelt.value = clamp(p.melt, 0, 1.2); Bu.uFlat.value = clamp(p.flat, 0, 1); Bu.uBurst.value = Math.max(0, p.burst);
    Bu.uComet.value = p.comet; Bu.uTwist.value = p.twist; Bu.uTall.value = clamp(p.tall, 0, 1.2); Bu.uLobe.value = t * 1.7;
    Bu.uBox.value = clamp(p.box, 0, 1.2); Bu.uBoxN.value = Math.max(1.2, p.boxN); Bu.uBoxA.value = p.boxA;
    Bu.uWobble.value = p.wobble * mo; Bu.uWobbleF.value = p.wobbleF;
    const microX = (Math.sin(t * 0.71) * 0.6 + Math.sin(t * 1.93) * 0.4) * 0.012, microY = Math.sin(t * 0.53 + 1) * 0.01;
    Bu.uGaze.value.set(
      clamp(p.gazeX + pgx * p.follow + (wx + microX) * p.wander, -0.32, 0.32),
      clamp(p.gazeY + pgy * p.follow + (wy + microY) * p.wander, -0.22, 0.22));
    Bu.uEyeWH.value.set(p.eyeW, p.eyeH);
    Bu.uOpen.value.set(clamp(p.openL, 0.05, 1.3) * lid, clamp(p.openR, 0.05, 1.3) * lid);
    Bu.uLine.value.set(clamp(p.lineL), clamp(p.lineR));
    Bu.uSplit.value = p.split; Bu.uEyeY.value = p.eyeY; Bu.uArcK.value = p.arcK;
    Bu.uChev.value = clamp(p.chev); Bu.uDiam.value = clamp(p.diam); Bu.uSpiral.value = clamp(p.spiral); Bu.uPupil.value = clamp(p.pupil);
    Bu.uLid.value = p.lid; Bu.uLidH.value = p.lidH; Bu.uCarve.value = clamp(p.carve);
    Bu.uEyeGlow.value = p.eyeGlow; Bu.uEyeRoll.value = -p.rotZ * 0.3;
    Bu.uBrow.value.set(clamp(p.browA), p.browT, p.browLY, p.browRY);
    Bu.uMouth.value.set(p.mY, Math.max(0.005, p.mW), p.mC, clamp(p.mOpen));
    Bu.uMouth2.value.set(clamp(p.mGrin), p.mWob, p.mTilt, p.mX);
    Bu.uMouth3.value.set(p.mZig, clamp(p.mA), 0, 0);
    Bu.uBlush.value = clamp(p.blush, 0, 1.4);
    Bu.uSss.value = p.sss; Bu.uRimI.value = p.rimI;
    Bu.uRimCol.value.setRGB(p.rimR, p.rimG * 0.85, p.rimB * 0.6).multiplyScalar(0.95);
    // the dashboard's gold rim light follows the pose (setRim)
    LU.uRimC.value.set(p.rimR, p.rimG, p.rimB).multiplyScalar(3.2 * clamp(p.rimI, 0.2, 2.6));

    const hs = Math.max(0, p.haloS * ringK);
    haloTilt.position.set(p.haloX, p.haloY, p.haloZ);
    haloTilt.rotation.set(Math.PI / 2 + 0.26 + p.haloTilt, 0, 0.16 + p.haloRoll);
    haloSpin.rotation.z += p.haloSpin * dt * (reduce ? 0.3 : 1);
    haloTilt.scale.setScalar(Math.max(0.0001, hs));
    haloTilt.visible = hs > 0.03;

    const wt = p.satThink, wo = p.satOrbit, wd = p.satDot, wsum = wt + wo + wd;
    for (let i = 0; i < 3; i++) {
      const s = sats[i];
      if (wsum < 0.01 || p.satS < 0.01) { s.visible = false; continue; }
      s.visible = true;
      const pulse = 1 + 0.4 * dotPulse(t, i);
      const tx = 0.92 + i * 0.28, ty = 1.0 + i * 0.3, tz = 0.25, ts = (0.06 + i * 0.032) * pulse;
      const a = t * 2.1 + (i * TAU) / 3, orR = 1.55;
      const ox = Math.cos(a) * orR, oz = Math.sin(a) * orR, oy = Math.sin(a + 0.6) * 0.45 + 0.24, os = 0.085;
      const ddy = i === 0 ? -0.86 : -0.6, ds = i === 0 ? 0.17 : 0.0001;
      s.position.set((tx * wt + ox * wo) / wsum, (ty * wt + oy * wo + ddy * wd) / wsum, (tz * wt + oz * wo + 0.1 * wd) / wsum);
      s.scale.setScalar(Math.max(0.0001, ((ts * wt + os * wo + ds * wd) / wsum) * clamp(p.satS)));
    }
  }

  function emitConfetti() {
    conf.visible = true;
    const d = new THREE.Vector3();
    for (const q of bits) {
      const th = Math.random() * TAU, ph = Math.random() * 1.2;
      d.set(Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph) * 0.6 + 0.3).normalize();
      q.p.copy(d).add(rig.position);
      q.v.copy(d).multiplyScalar(2.4 + Math.random() * 2.2); q.v.y += 1.4;
      q.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      q.w.set(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7);
      q.life = 1.5 + Math.random() * 0.5;
    }
  }
  function stepConfetti(dt: number) {
    if (!conf.visible) return;
    let alive = 0;
    for (let i = 0; i < bits.length; i++) {
      const q = bits[i];
      if (q.life > 0) {
        q.life -= dt; alive++;
        q.v.y -= 6.5 * dt; q.v.multiplyScalar(1 - 1.4 * dt);
        q.p.addScaledVector(q.v, dt);
        q.r.x += q.w.x * dt; q.r.y += q.w.y * dt; q.r.z += q.w.z * dt;
      }
      dummy.position.copy(q.p); dummy.rotation.copy(q.r);
      dummy.scale.setScalar(q.life > 0 ? clamp(q.life / 0.4) : 0.0001);
      dummy.updateMatrix();
      conf.setMatrixAt(i, dummy.matrix);
    }
    conf.instanceMatrix.needsUpdate = true;
    if (!alive) conf.visible = false;
  }

  /* -------------------------------------------------------------- frame ---- */
  const tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4(), camInv = new THREE.Matrix4();
  function update(rawDt: number, _t: number, camera: THREE.Camera) {
    const dt = Math.min(0.05, Math.max(0, rawDt || 0));
    // 1. face the camera (yaw fully, pitch mostly), smoothed so cuts do not snap the body
    group.updateWorldMatrix(true, false);
    tmpV.setFromMatrixPosition(camera.matrixWorld);
    group.worldToLocal(tmpV);
    const ty = Math.atan2(tmpV.x, tmpV.z);
    const tp = clamp(-Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z)) * 0.85, -1.0, 1.0);
    if (!faced) { yaw = ty; pitch = tp; faced = true; }
    else {
      const k = 1 - Math.exp(-dt * 10);
      let dy = ty - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw += dy * k; pitch += (tp - pitch) * k;
    }
    facer.rotation.set(pitch, yaw, 0, "YXZ");
    facer.updateMatrixWorld(true);

    // 2. the look target, as angles off Sherwood's forward axis
    if (wantTarget) {
      tmpV.copy(target);
      facer.worldToLocal(tmpV);
      tmpV.y -= CENTRE_Y * SCALE;
      const ax = Math.atan2(tmpV.x, Math.max(1e-4, tmpV.z) + 0.0001);
      const ay = Math.atan2(tmpV.y, Math.hypot(tmpV.x, tmpV.z));
      px = clamp(ax / 0.55, -1.4, 1.4); py = clamp(-ay / 0.55, -1.4, 1.4);
      hasTarget = true;
    } else { px = 0; py = 0; hasTarget = false; }

    // 3. simulate
    step(dt);

    // 4. appear
    let grow = 1, ringK = 1, lid = blinkLid(), flashK = 0;
    if (appearing) {
      const age = time - appearT0;
      const x = age - 0.12, xr = age - 0.5;
      if (reduce) {
        grow = smooth(age / 0.35); ringK = smooth((age - 0.15) / 0.35);
      } else {
        grow = x <= 0 ? 0 : 1 - Math.exp(-6.5 * x) * Math.cos(12 * x);
        ringK = xr <= 0 ? 0 : 1 - Math.exp(-8 * xr) * Math.cos(15 * xr);
        if (xr > 0) haloSpin.rotation.z += dt * 16 * Math.exp(-3.5 * xr);
        if (xr > 0 && !ringKicked) { ringKicked = true; springV -= 1.6; }
      }
      lid = Math.min(lid, 0.05 + 0.95 * smooth((age - 0.5) / 0.2));
      flashK = Math.exp(-Math.max(0, x) * 4) * smooth(age / 0.08);
      // a bright point swells for ~0.14 s, then collapses into the growing body
      flash.visible = age < 0.6;
      if (flash.visible) {
        const r = age < 0.14 ? 0.15 + 1.1 * easeOutQuint(age / 0.14) : 1.25 * (1 - smooth((age - 0.14) / 0.4));
        flash.scale.setScalar(SCALE * Math.max(0.0001, reduce ? 1 : r));
        const fk = 6 * (age < 0.04 ? age / 0.04 : 1) * (age < 0.14 ? 1 : Math.exp(-(age - 0.14) * 7));
        flashMat.color.setRGB(fk, fk * 0.86, fk * 0.6);
      }
      if (age > 1.8) { appearing = false; flash.visible = false; }
    }
    scaler.scale.setScalar(SCALE * Math.max(0.0001, grow));
    BU.uFlash.value = flashK * 1.4;

    applyPose(cur, lid, ringK, dt);

    // confetti at the pop of the star
    const S = STATES[active];
    if (S.confettiAt != null && !reduce) {
      const lt = time - activeT0 - S.confettiAt;
      const cyc = Math.floor(lt / (S.loop ?? 99));
      if (lt >= 0 && cyc !== lastConfCycle) { lastConfCycle = cyc; emitConfetti(); }
    }
    stepConfetti(dt);

    // 5. studio frame -> view space for the lighting
    camInv.copy(camera.matrixWorld).invert();
    tmpM.multiplyMatrices(camInv, facer.matrixWorld);
    const m3 = LU.uS2V.value.setFromMatrix4(tmpM), e = m3.elements;
    for (let c = 0; c < 3; c++) {
      const l = Math.hypot(e[c * 3], e[c * 3 + 1], e[c * 3 + 2]) || 1;
      e[c * 3] /= l; e[c * 3 + 1] /= l; e[c * 3 + 2] /= l;
    }
    LU.uKeyV.value.copy(KEY_DIR).applyMatrix3(m3).normalize();
    LU.uRimV.value.copy(RIM_DIR).applyMatrix3(m3).normalize();
    LU.uFillV.value.copy(FILL_DIR).applyMatrix3(m3).normalize();
  }

  return {
    group,
    appear() {
      appearT0 = time; appearing = true; ringKicked = false;
      blinkAt = -10;
      scaler.scale.setScalar(0.0001);
      haloTilt.visible = false;
    },
    setState(s: SherwoodState) {
      if (!STATES[s]) return;
      // re-sending a chained state (happy) replays it from the top
      if (s !== req || STATES[s].next) { req = s; reqT0 = time; }
    },
    lookAt(p: THREE.Vector3 | null) {
      if (p) { target.copy(p); wantTarget = true; } else wantTarget = false;
    },
    update,
    dispose() {
      group.removeFromParent();
      conf.dispose();
      for (const d of disposables) d.dispose();
    },
  };
}
