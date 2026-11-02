// work-prism: Prism SMP, a Minecraft server. The camera flies between floating voxel
// islands in an ember sky, past a big engraved glass prism splitting a GLOW beam into a
// palette spectrum, and settles straight-on to the framed print of the site (big, on the
// right on desktop, the upper half on phones). Nine plugin blocks orbit the print. The
// print develops into the live site, the card shows on the left, then the beam flares and
// the camera tilts up and away for the wipe. progress(p) is a pure function of p.
import { makeProjectFrame, cardCurve, smooth } from './lib/project-frame.js';
import { voxelMaterial, buildIslands, skyDome, makePrism, rng } from './lib/prism-world.js';
import { projects } from '../../data/projects';

const S = 0.34; // block size

// islands: the flight corridor (z > 8), the one under the print, and the far backdrop
const ISLES = [
  { c: [0.6, -3.1, -4.6], R: 9, H: 7, seed: 1, trees: 3, flat: true, lava: { i: 4, j: -1, r: 1.7 }, fall: { j: -1, len: 9 } },
  { c: [-5.2, -1.6, 27], R: 6, H: 6, seed: 2, trees: 2 },
  { c: [3.8, 1.3, 21], R: 4, H: 5, seed: 3, trees: 1 },
  { c: [-3.4, 2.7, 15.5], R: 4, H: 4, seed: 4, trees: 1 },
  { c: [3.6, -2.5, 11], R: 5, H: 6, seed: 5, trees: 2 },
  { c: [8.5, 2.6, -10], R: 6, H: 7, seed: 6, trees: 2 },
  { c: [-9.5, -3.6, -13], R: 7, H: 8, seed: 7, trees: 3 },
  { c: [2.5, 7.4, -19], R: 5, H: 5, seed: 8, trees: 1 },
  { c: [-13, 1.5, -22], R: 5, H: 5, seed: 9, trees: 1 },
  { c: [12, -5.2, -6], R: 6, H: 6, seed: 10, trees: 2 },
  { c: [16, 4, -24], R: 7, H: 7, seed: 11, trees: 2 },
  { c: [-15, 6, -26], R: 6, H: 6, seed: 12, trees: 1 },
];

// the nine plugin blocks: [tone, palette key, kind]
const PLUGINS = [
  [0.62, 'NEUTRAL', 1], [0.9, 'GLOW', 4], [0.47, 'NEUTRAL', 0], [0.85, 'DIM', 0], [0.95, 'EMBER', 2],
  [0.88, 'NEUTRAL', 3], [0.3, 'NEUTRAL', 0], [1.0, 'HOT', 4], [0.6, 'NEUTRAL', 0],
];

export function create(ctx, beat) {
  const { THREE, PAL, engine } = ctx;
  const project = projects.find((x) => x.id === beat.project);
  const index = projects.indexOf(project) + 1;
  const scene = new THREE.Scene();
  const FOV = 36, T = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);

  // ---- sky ----
  const sky = skyDome(ctx, 160);
  scene.add(sky);

  // ---- islands (one draw) ----
  const isleMat = voxelMaterial(ctx, { isles: ISLES.length, size: S });
  const { geometry: isleGeo } = buildIslands(ISLES, S, PAL);
  const isles = new THREE.Mesh(isleGeo, isleMat);
  isles.frustumCulled = false;
  scene.add(isles);
  const drift = ISLES.map((_, i) => { const r = rng(100 + i); return [r() * 6.28, r() * 6.28, 0.6 + r() * 0.5]; });

  // ---- the prism and its beam ----
  const prism = makePrism(ctx, { side: 3.4, depth: 1.8 });
  prism.group.position.set(-5.6, 4.4, -16);
  scene.add(prism.group);

  // ---- the print ----
  const frame = makeProjectFrame(ctx, project, { width: 3.2, index, total: projects.length, side: index % 2 ? 'left' : 'right' });
  const right = index % 2 === 1; // card on the left -> print on the right
  scene.add(frame.print);
  const PW = 3.2, PH = PW / 1.6;

  // ---- nine plugin blocks orbiting the print ----
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const info = new Float32Array(9 * 4);
  PLUGINS.forEach(([tone, pal, kind], i) => info.set([tone, PAL[pal], 0, kind], i * 4));
  blockGeo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  const blockMat = voxelMaterial(ctx);
  const blocks = new THREE.InstancedMesh(blockGeo, blockMat, 9);
  blocks.frustumCulled = false;
  scene.add(blocks);
  const dummy = new THREE.Object3D();

  // ---- camera path ----
  const settle = new THREE.Vector3();
  const pts = [
    new THREE.Vector3(7.5, 5.5, 40), new THREE.Vector3(1.8, 3.2, 28), new THREE.Vector3(-0.8, 1.2, 19),
    new THREE.Vector3(0.6, 0.4, 12.5), new THREE.Vector3(),
  ];
  const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), straight = new THREE.Vector3();
  const lay = { phone: false, rx: 1.9, ry: 2.05, d: 6 };
  const par = { x: 0, y: 0, tx: 0, ty: 0 };

  // Where the camera sits at develop time: straight down -z, print big on its side.
  function layout() {
    const W = engine.width, H = engine.height, A = W / H;
    const phone = W < 760;
    let pw, cx, cy;
    if (phone) {
      pw = W * 0.94;
      pw = Math.min(pw, H * 0.5 * 1.6);
      cx = W / 2;
      cy = H * 0.28;
    } else {
      const cardRight = Math.min(72, Math.max(20, 0.05 * W)) + Math.min(400, 0.34 * W) + 36;
      const r0 = right ? cardRight : W * 0.02, r1 = right ? W * 0.985 : W - cardRight;
      pw = Math.min(W * 0.6, r1 - r0, H * 0.82 * 1.6);
      cx = right ? Math.max(r0 + pw / 2, Math.min(r1 - pw / 2, (r0 + r1) / 2)) : (r0 + r1) / 2;
      cy = H * 0.5;
    }
    const d = (PW * W) / (pw * 2 * T * A);
    const nx = (cx / W) * 2 - 1, ny = 1 - (cy / H) * 2;
    settle.set(-nx * T * A * d, -ny * T * d, d);
    lay.phone = phone; lay.d = d;
    lay.rx = phone ? 2.0 : 1.95; lay.ry = phone ? 1.85 : 2.05;
  }

  return {
    scene, camera,
    enter() { frame.enter(); },
    progress(p) {
      layout();
      // ---- camera: flight 0 -> 0.34, settle with a slow push to 0.86, tilt up and away after
      const u = smooth(0, 0.34, p);
      const push = 1 + 0.035 * (1 - smooth(0.34, 0.82, p));
      pts[4].set(settle.x, settle.y, settle.z * 1.035);
      if (u < 1) path.getPoint(u, camPos);
      else camPos.set(settle.x, settle.y, settle.z * push);
      camPos.x += par.x; camPos.y += par.y;
      // look: at the print early, blending to dead straight (-z) as the camera settles
      straight.set(camPos.x, camPos.y, camPos.z - 10);
      look.set(0.4, 0.6, -2).lerp(straight, smooth(0.45, 1, u));
      const e = smooth(0.87, 1, p);
      if (e > 0) {
        camPos.x += -0.6 * e; camPos.y += 1.6 * e; camPos.z += 2.6 * e;
        const pitch = 0.2 * e, yaw = -0.2 * e;
        look.set(camPos.x + Math.sin(yaw) * 10, camPos.y + Math.sin(pitch) * 10, camPos.z - Math.cos(pitch) * 10);
      }
      const roll = -0.13 * Math.sin(Math.PI * u) - 0.08 * e;
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      camera.position.copy(camPos);
      camera.lookAt(look);
      camera.updateMatrixWorld();
      sky.position.copy(camPos);

      // ---- islands drift with scroll
      const offs = isleMat.uniforms.uOff.value;
      for (let i = 0; i < ISLES.length; i++) {
        const [a, b, k] = drift[i], amp = i === 0 ? 0.25 : 1;
        offs[i].set(Math.sin(p * 2.2 * k + a) * 0.35 * amp, Math.sin(p * 2.9 * k + b) * 0.45 * amp, 0);
      }

      // ---- prism turns a touch, the beam flares at the end
      prism.group.rotation.set(0.04, 0.32 - 0.14 * p, 0);
      prism.setFlare(smooth(0.84, 1, p));

      // ---- plugin blocks: sweep in from wide, orbit outside the print's rect
      const gather = smooth(0.08, 0.4, p), scatter = smooth(0.86, 1, p);
      const spread = 1 + 1.6 * (1 - gather) + 2.2 * scatter;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + p * Math.PI * 1.3;
        const sz = 0.26 * smooth(0.04 + i * 0.012, 0.3 + i * 0.012, p);
        dummy.position.set(Math.cos(a) * lay.rx * spread, Math.sin(a) * lay.ry * spread + 0.08 * Math.sin(p * 9 + i), 0.15 * Math.sin(a * 2 + i));
        dummy.rotation.set(p * 5 + i * 0.7, p * 3.4 + i * 1.3, i * 0.4);
        dummy.scale.setScalar(Math.max(sz, 1e-4));
        dummy.updateMatrix();
        blocks.setMatrixAt(i, dummy.matrix);
      }
      blocks.instanceMatrix.needsUpdate = true;

      // develop: in 0.35 -> 0.5, hold to 0.82, back out before the tilt
      const develop = smooth(0.35, 0.5, p) * (1 - smooth(0.82, 0.87, p));
      frame.update(p, camera, { develop, cardIn: cardCurve(p, 0.32, 0.48, 0.9, 1.0) });
    },
    update(dt, time) {
      sky.material.uniforms.uTime.value = time;
      isleMat.uniforms.uTime.value = time;
      blockMat.uniforms.uTime.value = time;
      prism.setTime(time);
      const k = Math.min(1, dt * 3);
      par.x += (par.tx - par.x) * k; par.y += (par.ty - par.y) * k;
    },
    pointer(nx, ny) { par.tx = nx * 0.08; par.ty = ny * 0.06; },
    exit() { frame.exit(); },
    dispose() {
      frame.dispose();
      prism.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    },
  };
}
