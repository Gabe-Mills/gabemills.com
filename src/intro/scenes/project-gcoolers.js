// Showcase beat "work-gcoolers": an engraved Apple-Silicon cooling assembly.
// A paper fin stack split by a centre channel, ember heat pipes, a big front fan on a
// die-like chip, airflow drawn as engraved streamlines, a temperature dial and a fan-curve
// plate. The site print is mounted like a screen on a post above the stack.
//
//   0    -> 0.14  inside the fin channel, looking at the back of the spinning fan (hot: ember
//                 shimmer, isotherms crawling over the board, ember dashes in the exhaust)
//   0.14 -> 0.38  pull back out of the fins, orbit round the right side to the front; the
//                 camera arrives straight-on and level, print big on the left
//   0.38 -> 0.87  hold: the print develops into the live site (full 0.5 -> 0.82), the card
//                 shows on the right; the fan eases to a quiet idle and the dial falls to cool
//   0.87 -> 1     the fan spins down to a stop and the camera drops onto the dial as the
//                 needle settles in the cool band (the frame the ink-rain wipe takes)
// progress(p) is a pure function of p (fan angle, flow and needle are all lookups of p).
// update() only drives the heat shimmer's ambient wobble.
import { makeProjectFrame, cardCurve, smooth } from './lib/project-frame.js';
import { projects } from '../../data/projects';
import {
  FIN, FAN, FIN_X, rng, heatAt, omegaAt, makeSpinTable, bladeGeometry, pipeCurves, streamCurves,
  boardTexture, gaugeTexture, curveTexture, DIAL, FANCURVE, CURVE_BOX,
} from './lib/gcoolers-parts.js';
import { finMaterial, boardMaterial, haloMaterial, shimmerMaterial, streamMaterial, blurMaterial } from './lib/gcoolers-shaders.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PW = 4.6;               // print width (world); 16:10
const PH = PW / 1.6;
const RIM = 0.07;
const FOV_IN = 64, FOV_F = 40;

export function create(ctx, beat) {
  const { THREE, inkMaterial, flatMaterial, cardMaterial, PAL, GBUF_GLSL } = ctx;
  const project = projects.find((x) => x.id === beat.project);
  const index = projects.indexOf(project) + 1;
  const side = index % 2 ? 'left' : 'right';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV_IN, 1, 0.02, 220);
  const owned = [];
  const own = (o) => { owned.push(o); return o; };
  const add = (geo, mat, parent = scene) => { const m = new THREE.Mesh(own(geo), own(mat)); parent.add(m); return m; };
  const m4 = new THREE.Matrix4();
  const spin = makeSpinTable(58);

  // ---------------------------------------------------------------- void + heat halo
  const voidMat = flatMaterial({ shade: 0, pal: PAL.NEUTRAL });
  voidMat.side = THREE.BackSide;
  add(new THREE.SphereGeometry(90, 24, 12), voidMat);
  const haloMat = haloMaterial(THREE, GBUF_GLSL);
  const halo = add(new THREE.PlaneGeometry(17, 17), haloMat);

  // ---------------------------------------------------------------- logic board
  const boardMap = own(boardTexture(THREE));
  const boardMat = boardMaterial(THREE, GBUF_GLSL, boardMap);
  const board = add(new THREE.PlaneGeometry(18, 18), boardMat);
  board.rotation.x = -Math.PI / 2;
  board.position.z = 0.35;

  // ---------------------------------------------------------------- chip: substrate, die, cold plate, SMD parts
  add(new THREE.BoxGeometry(3.3, 0.1, 3.5).translate(0, 0.05, 0.35), inkMaterial({ tone: 0.72, pal: PAL.DIM, angle: 0, hatch: 1, rim: 0.05 }));
  const dieMat = inkMaterial({ tone: 0.62, pal: PAL.EMBER, angle: 0, hatch: 1, emissive: 0.3, rim: 0.05 });
  add(new THREE.BoxGeometry(1.95, 0.09, 2.3).translate(0, 0.145, 0.45), dieMat);
  add(new THREE.BoxGeometry(1.55, 0.2, 1.7).translate(0, 0.29, 0), inkMaterial({ tone: 0.9, pal: PAL.NEUTRAL, angle: -1, hatch: 1, rim: 0.1 }));
  {
    const R = rng(3);
    const parts = [];
    for (let i = 0; i < 46; i++) {
      const edge = i % 4;
      const t = R() * 2.9 - 1.45;
      const x = edge < 2 ? t : (edge === 2 ? -1.42 : 1.42);
      const z = 0.35 + (edge < 2 ? (edge === 0 ? -1.52 : 1.52) : t * 1.1);
      if (Math.abs(x) < 1.05 && Math.abs(z - 0.45) < 1.25) continue;
      parts.push(new THREE.BoxGeometry(0.09, 0.05, 0.05).applyMatrix4(m4.makeRotationY(R() < 0.5 ? 0 : Math.PI / 2)).translate(x, 0.125, z));
    }
    const g = mergeGeometries(parts); parts.forEach((p) => p.dispose());
    add(g, inkMaterial({ tone: 0.95, pal: PAL.NEUTRAL, angle: 0, hatch: 1, rim: 0.2 }));
  }

  // ---------------------------------------------------------------- fin stack (thin paper fins, one merged draw)
  {
    const parts = FIN_X.map((x) => new THREE.BoxGeometry(FIN.t, FIN.y1 - FIN.y0, FIN.z1 - FIN.z0).translate(x, (FIN.y0 + FIN.y1) / 2, (FIN.z0 + FIN.z1) / 2));
    const g = mergeGeometries(parts); parts.forEach((p) => p.dispose());
    add(g, finMaterial(THREE, GBUF_GLSL));
  }
  // folded top and bottom lips that tie the stack together visually
  add(new THREE.BoxGeometry(2.5, 0.03, 0.05).translate(0, FIN.y1, FIN.z1 - 0.025), inkMaterial({ tone: 0.3, pal: PAL.NEUTRAL, angle: 0 }));
  add(new THREE.BoxGeometry(2.5, 0.03, 0.05).translate(0, FIN.y1, FIN.z0 + 0.025), inkMaterial({ tone: 0.3, pal: PAL.NEUTRAL, angle: 0 }));

  // ---------------------------------------------------------------- heat pipes (ember)
  {
    const tubes = pipeCurves(THREE).map((c) => new THREE.TubeGeometry(c, 120, 0.062, 10, false));
    const g = mergeGeometries(tubes); tubes.forEach((t) => t.dispose());
    add(g, inkMaterial({ tone: 0.82, pal: PAL.EMBER, angle: -1, hatch: 1, rim: 0.3, emissive: 0.12 }));
  }

  // ---------------------------------------------------------------- fan: shroud, struts, blades, hub, blur
  const fan = new THREE.Group();
  fan.position.set(FAN.x, FAN.y, FAN.z);
  scene.add(fan);
  {
    const s = 0.95;
    const shape = new THREE.Shape();
    const rr = 0.16;
    shape.moveTo(-s + rr, -s); shape.lineTo(s - rr, -s); shape.quadraticCurveTo(s, -s, s, -s + rr);
    shape.lineTo(s, s - rr); shape.quadraticCurveTo(s, s, s - rr, s); shape.lineTo(-s + rr, s);
    shape.quadraticCurveTo(-s, s, -s, s - rr); shape.lineTo(-s, -s + rr); shape.quadraticCurveTo(-s, -s, -s + rr, -s);
    const hole = new THREE.Path(); hole.absarc(0, 0, FAN.r + 0.03, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const shroud = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false, curveSegments: 48 }).translate(0, 0, -0.1);
    add(shroud, inkMaterial({ tone: 0.36, pal: PAL.NEUTRAL, angle: 0.785, hatch: 1, rim: 0.25 }), fan);
    // corner screws
    const screws = [];
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) screws.push(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16).rotateX(Math.PI / 2).translate(x * 0.8, y * 0.8, 0.11));
    const sg = mergeGeometries(screws); screws.forEach((x) => x.dispose());
    add(sg, inkMaterial({ tone: 0.95, pal: PAL.DIM, angle: -1, rim: 0.3 }), fan);
    // motor struts at the back
    const struts = [];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      struts.push(new THREE.BoxGeometry(FAN.r + 0.1, 0.05, 0.04).translate((FAN.r + 0.1) / 2, 0, 0).rotateZ(a).translate(0, 0, -0.09));
    }
    const stg = mergeGeometries(struts); struts.forEach((x) => x.dispose());
    add(stg, inkMaterial({ tone: 0.3, pal: PAL.NEUTRAL, angle: -1 }), fan);
  }
  const rotor = new THREE.Group();
  fan.add(rotor);
  {
    const one = bladeGeometry(THREE);
    const copies = [];
    for (let k = 0; k < FAN.blades; k++) copies.push(one.clone().applyMatrix4(m4.makeRotationZ((k * Math.PI * 2) / FAN.blades)));
    one.dispose();
    const g = mergeGeometries(copies); copies.forEach((c) => c.dispose());
    add(g, inkMaterial({ tone: 0.97, pal: PAL.NEUTRAL, angle: -1, hatch: 1, rim: 0.2, side: THREE.DoubleSide, emissive: 0.05 }), rotor);
    add(new THREE.CylinderGeometry(FAN.hub, FAN.hub, 0.24, 40).rotateX(Math.PI / 2), inkMaterial({ tone: 0.28, pal: PAL.NEUTRAL, angle: -1, rim: 0.3 }), rotor);
  }
  const ledMat = flatMaterial({ shade: 0.95, pal: PAL.GLOW });
  const led = add(new THREE.TorusGeometry(FAN.hub - 0.06, 0.022, 8, 48).translate(0, 0, 0.125), ledMat, fan);
  add(new THREE.CircleGeometry(FAN.hub - 0.1, 32).translate(0, 0, 0.122), flatMaterial({ shade: 0.08, pal: PAL.NEUTRAL }), fan);
  const blurMat = blurMaterial(THREE, GBUF_GLSL, FAN.blades);
  add(new THREE.RingGeometry(FAN.hub + 0.02, FAN.r - 0.02, 96, 1).translate(0, 0, 0.1), blurMat, fan);

  // ---------------------------------------------------------------- airflow streamlines
  const streamMat = streamMaterial(THREE, GBUF_GLSL);
  {
    const tubes = streamCurves(THREE).map((c, i) => {
      const g = new THREE.TubeGeometry(c, 170, 0.0105, 4, false);
      g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill((i * 0.618034) % 1), 1));
      return g;
    });
    const g = mergeGeometries(tubes); tubes.forEach((t) => t.dispose());
    add(g, streamMat);
  }

  // ---------------------------------------------------------------- heat shimmer above the fins
  const shimMat = shimmerMaterial(THREE, GBUF_GLSL);
  {
    const R = rng(5);
    const planes = [];
    for (let i = 0; i < 7; i++) {
      const x = -1.0 + (i / 6) * 2.0 + (R() - 0.5) * 0.2, z = (R() - 0.5) * 1.2;
      for (const rot of [0, Math.PI / 2]) {
        const g = new THREE.PlaneGeometry(0.8, 1.9).translate(0, 0.95, 0).rotateY(rot + (R() - 0.5) * 0.4).translate(x, FIN.y1 + 0.02, z);
        g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(R()), 1));
        planes.push(g);
      }
    }
    const g = mergeGeometries(planes); planes.forEach((x) => x.dispose());
    add(g, shimMat);
  }

  // ---------------------------------------------------------------- temperature dial (front left)
  const G = new THREE.Vector3(-1.66, 0.84, 2.1);
  const gauge = new THREE.Group();
  gauge.position.copy(G);
  gauge.rotation.set(-0.08, 0.16, 0);
  scene.add(gauge);
  const GR = 0.46;
  add(new THREE.CylinderGeometry(GR + 0.06, GR + 0.08, 0.12, 64).rotateX(Math.PI / 2).translate(0, 0, -0.06), inkMaterial({ tone: 0.3, pal: PAL.DIM, angle: -1, rim: 0.4 }), gauge);
  const gaugeTex = own(gaugeTexture(THREE));
  add(new THREE.CircleGeometry(GR, 64).translate(0, 0, 0.002), cardMaterial(gaugeTex, { hatch: 0.18, angle: 0.4, alphaTest: 0.5 }), gauge);
  const needleShape = new THREE.Shape();
  needleShape.moveTo(-0.09, -0.028); needleShape.lineTo(GR * 0.84, -0.006); needleShape.lineTo(GR * 0.86, 0);
  needleShape.lineTo(GR * 0.84, 0.006); needleShape.lineTo(-0.09, 0.028); needleShape.lineTo(-0.09, -0.028);
  const needle = add(new THREE.ShapeGeometry(needleShape), flatMaterial({ shade: 0.03, pal: PAL.NEUTRAL }), gauge);
  needle.position.z = 0.012;
  const capMat = inkMaterial({ tone: 0.9, pal: PAL.EMBER, angle: -1, rim: 0.2, emissive: 0.15 });
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 24).rotateX(Math.PI / 2).translate(0, 0, 0.03), capMat, gauge);
  add(new THREE.CylinderGeometry(0.035, 0.05, G.y - 0.1, 12).translate(0, -(G.y - 0.1) / 2 - GR + 0.12, -0.05), inkMaterial({ tone: 0.4, pal: PAL.DIM, angle: Math.PI / 2 }), gauge);

  // ---------------------------------------------------------------- fan-curve plate (front right)
  const plate = new THREE.Group();
  plate.position.set(1.62, 0.62, 2.12);
  plate.rotation.set(-0.12, -0.14, 0);
  scene.add(plate);
  const PLW = 0.92, PLH = 0.575;
  add(new THREE.BoxGeometry(PLW + 0.06, PLH + 0.06, 0.05).translate(0, 0, -0.03), inkMaterial({ tone: 0.25, pal: PAL.NEUTRAL, angle: -1 }), plate);
  const curveTex = own(curveTexture(THREE));
  add(new THREE.PlaneGeometry(PLW, PLH), cardMaterial(curveTex, { hatch: 0.15, angle: 0.4, alphaTest: 0.0 }), plate);
  const dot = add(new THREE.CircleGeometry(0.034, 24), flatMaterial({ shade: 0.96, pal: PAL.GLOW }), plate);
  add(new THREE.CircleGeometry(0.05, 24).translate(0, 0, -0.001), flatMaterial({ shade: 0.0, pal: PAL.NEUTRAL }), dot);
  add(new THREE.BoxGeometry(0.06, 0.4, 0.06).translate(0, -PLH / 2 - 0.2, -0.04), inkMaterial({ tone: 0.4, pal: PAL.DIM, angle: Math.PI / 2 }), plate);

  // ---------------------------------------------------------------- the print, mounted on a post
  const frame = makeProjectFrame(ctx, project, { width: PW, index, total: projects.length, side });
  const PC = new THREE.Vector3(0, FIN.y1 + 0.26 + RIM + PH / 2, 0);
  frame.print.position.copy(PC);
  scene.add(frame.print);
  const postMat = inkMaterial({ tone: 0.5, pal: PAL.DIM, angle: Math.PI / 2, rim: 0.3 });
  // a gantry behind the stack (two posts and a cross bar) with an arm to the print's back
  for (const sx of [-1.75, 1.75]) add(new THREE.CylinderGeometry(0.075, 0.09, PC.y + 0.1, 20).translate(sx, (PC.y + 0.1) / 2, -1.7), postMat);
  add(new THREE.BoxGeometry(3.62, 0.13, 0.13).translate(0, PC.y + 0.1, -1.7), postMat);
  add(new THREE.BoxGeometry(0.12, 0.12, 1.66).translate(0, PC.y, -0.87), postMat);
  add(new THREE.BoxGeometry(0.9, 0.6, 0.04).translate(0, PC.y, -0.1), inkMaterial({ tone: 0.3, pal: PAL.DIM, angle: 0 }));

  // ---------------------------------------------------------------- camera path
  // control points: inside the centre channel (looking +z at the fan's back), out the back,
  // round the right side, to the straight-on final point F (solved per viewport).
  const F = new THREE.Vector3();
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.5, 0.45), new THREE.Vector3(0, 1.5, -0.45), new THREE.Vector3(0, 1.54, -1.45),
    new THREE.Vector3(0.25, 1.95, -3.3), new THREE.Vector3(4.2, 2.8, -5.2), new THREE.Vector3(8.2, 3.5, -1.0),
    new THREE.Vector3(7.6, 3.9, 5.0), F,
  ], false, 'centripetal');
  const NSEG = 7;
  // monotone Hermite remap p -> curve t: slow through the fins, quicker round the orbit, arrive at rest
  const KP = [0, 0.15, 0.38], KT = [0, 2 / NSEG, 1], KM = [1.0, 2.3, 0];
  const pathT = (p) => {
    if (p >= KP[2]) return 1;
    const i = p < KP[1] ? 0 : 1;
    const h = KP[i + 1] - KP[i], s = (p - KP[i]) / h;
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * KT[i] + (s3 - 2 * s2 + s) * h * KM[i] + (-2 * s3 + 3 * s2) * KT[i + 1] + (s3 - s2) * h * KM[i + 1];
  };

  let solvedFor = '';
  const tanF = Math.tan((FOV_F / 2) * Math.PI / 180);
  const PZ = PC.z + 0.012;
  const ENDP = new THREE.Vector3(), ENDL = new THREE.Vector3();
  /** Place F so the print fills its side of the screen, straight-on (camera looks exactly -z). */
  function solve() {
    const W = ctx.engine.width, H = ctx.engine.height;
    const key = `${W}x${H}`;
    if (key === solvedFor) return;
    solvedFor = key;
    const a = W / H, phone = W < 760;
    const pw = PW + RIM * 2, ph = PH + RIM * 2, ar = pw / ph;
    let left, wpx, top;
    if (!phone) {
      const cardW = Math.min(400, 0.34 * W), cardR = Math.min(72, Math.max(20, 0.05 * W));
      left = Math.max(24, 0.035 * W);
      wpx = Math.min(0.62 * W, W - cardR - cardW - 56 - left);
      top = Math.max(90, 0.1 * H);
      if (wpx / ar > 0.66 * H) wpx = 0.66 * H * ar;
    } else {
      left = 14; wpx = W - 28;
      top = Math.max(70, 0.085 * H);
      if (wpx / ar > 0.36 * H) { wpx = 0.36 * H * ar; left = (W - wpx) / 2; }
    }
    const hpx = wpx / ar;
    const d = pw / (2 * (wpx / W) * tanF * a);
    const nx = ((left + wpx / 2) / W) * 2 - 1, ny = 1 - ((top + hpx / 2) / H) * 2;
    F.set(PC.x - nx * d * tanF * a, PC.y - ny * d * tanF, PZ + d);
    // the end: drop onto the dial (it fills the frame for the wipe)
    ENDL.copy(G);
    ENDP.set(G.x + 0.2, G.y + 0.1, G.z + (phone ? 2.3 : 1.55));
  }

  const pos = new THREE.Vector3(), dirA = new THREE.Vector3(), dirB = new THREE.Vector3(), look = new THREE.Vector3();
  const center = new THREE.Vector3(0, 1.8, 0.2);
  const camDir = new THREE.Vector3();
  let lastFov = -1, pNow = 0;

  return {
    scene, camera,
    enter() { frame.enter(); },
    progress(p) {
      pNow = p;
      solve();
      const heat = heatAt(p), om = omegaAt(p), theta = spin(p);

      // ---- camera
      path.getPoint(pathT(p), pos);
      // look: +z down the channel -> the assembly during the orbit -> exactly -z (straight-on)
      dirA.set(0, 0, 1);
      dirB.copy(center).sub(pos).normalize();
      dirA.lerp(dirB, smooth(0.1, 0.22, p)).normalize();
      dirA.lerp(dirB.set(0, 0, -1), smooth(0.25, 0.38, p)).normalize();
      // the hold: a slow straight push (translation only keeps the print square to the lens)
      const hold = smooth(0.38, 0.87, p);
      pos.z -= hold * 0.35 * (F.z - PZ) * 0.06;
      // the end: drop onto the dial
      const e = smooth(0.87, 1, p);
      if (e > 0) {
        pos.lerp(ENDP, e);
        dirB.copy(ENDL).sub(pos).normalize();
        dirA.lerp(dirB, smooth(0.87, 0.97, p)).normalize();
      }
      const roll = 0.07 * (1 - smooth(0.06, 0.2, p)) * Math.sin(p * 30);
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      camera.position.copy(pos);
      look.copy(pos).add(dirA);
      camera.lookAt(look);
      const fov = THREE.MathUtils.lerp(FOV_IN, FOV_F, smooth(0.12, 0.34, p)) - 6 * e;
      if (Math.abs(fov - lastFov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); lastFov = fov; }
      camera.updateMatrixWorld();

      // ---- set state
      rotor.rotation.z = -theta;
      blurMat.uniforms.uTheta.value = theta;
      blurMat.uniforms.uOmega.value = om;
      ledMat.uniforms.uShade.value = 0.35 + 0.6 * om;
      streamMat.uniforms.uFlow.value = theta * 0.42;
      streamMat.uniforms.uDuty.value = 0.62 * Math.min(1, om * 1.25);
      streamMat.uniforms.uHeat.value = heat;
      shimMat.uniforms.uHeat.value = heat;
      boardMat.uniforms.uHeat.value = heat;
      boardMat.uniforms.uPhase.value = p * 3.0;
      dieMat.uniforms.uEmissive.value = 0.05 + 0.4 * heat;
      dieMat.uniforms.uTone.value = 0.45 + 0.45 * heat;
      capMat.uniforms.uPal.value = heat > 0.45 ? PAL.EMBER : PAL.GLOW;
      haloMat.uniforms.uPal.value = heat > 0.45 ? PAL.EMBER : PAL.GLOW;
      haloMat.uniforms.uAmt.value = 0.45 + 0.55 * heat;
      needle.rotation.z = THREE.MathUtils.lerp(DIAL.cool - 0.12, DIAL.hot + 0.1, heat);
      const tx = heat;
      dot.position.set((CURVE_BOX.x0 + (CURVE_BOX.x1 - CURVE_BOX.x0) * tx - 0.5) * PLW, (0.5 - (CURVE_BOX.y0 + (CURVE_BOX.y1 - CURVE_BOX.y0) * FANCURVE(tx))) * PLH, 0.006);
      // halo hangs behind the assembly, facing the lens
      camera.getWorldDirection(camDir);
      halo.position.copy(center).addScaledVector(camDir, 8);
      halo.quaternion.copy(camera.quaternion);

      const develop = smooth(0.38, 0.5, p) * (1 - smooth(0.82, 0.87, p));
      frame.update(p, camera, { develop, cardIn: cardCurve(p, 0.34, 0.48, 0.88, 1.0) });
      led.visible = om > 0.02;
    },
    update(dt, time) {
      shimMat.uniforms.uPhase.value = pNow * 9 + time * 1.4;
    },
    exit() { frame.exit(); },
    dispose() {
      frame.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      for (const o of owned) o.dispose?.();
    },
  };
}
