// Beat "open" — "Then the walls come down." The last beat: below it the site hero scrolls
// in on its dark ground, so this ends in darkness and embers, never on a title.
//
// progress(p), a pure function of p (scrolling up rewinds everything):
//   0.00-0.20  ember sky with oxblood streak clouds, four white engraved columns + roof slab
//   0.20-0.55  ink cracks grow through the stone, chunks start to hover apart, grit lifts
//   0.55-0.90  the temple blows apart on precomputed ballistic paths (fracture set(t) is
//              scrubbed by p), shards streak past the camera, the camera tilts up and eases
//              back, and the ember sky burns away top-down into ink
//   0.90-1.00  near-solid ink with faint oxblood heat contours and a few rising embers.
//              The story's uDark fade then takes it to the site ground.
// No timed tweens. Shake is a tiny deterministic function of p; the one flash is a smooth
// bump in p at the moment of the break.
import { makeFracturedColumn, makeFracturedSlab, crackMaterial, rockGeometry, shardGeometry, rng, inkInstanced } from './lib/fracture.js';
import { shatterSky } from './lib/shatter-sky.js';
import { makeEmbers } from './lib/shatter-embers.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function create(ctx) {
  const { THREE, PAL, inkMaterial } = ctx;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  scene.add(camera);
  const CAM = new THREE.Vector3(0.3, 0.2, 10);   // desktop framing; portrait pulls back
  const LOOK = new THREE.Vector3(0, 4.1, 0);
  const ROLL = -0.05;
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();

  // ---- sky ---------------------------------------------------------------------------------
  const sky = shatterSky(ctx);
  const skyU = sky.material.uniforms;
  scene.add(sky);

  // ---- the temple: leaning fractured columns + roof slab ---------------------------------
  const temple = new THREE.Group();
  temple.rotation.z = -0.13;
  temple.rotation.x = 0.04;
  scene.add(temple);
  const outer = crackMaterial(ctx, { crackWidth: 0.034, tone: 0.95 });
  const inner = inkMaterial({ tone: 0.72, angle: -1, rim: 0 });
  const slabTop = inkMaterial({ tone: 0.97, angle: 0, rim: 0.1 });
  const slabSide = inkMaterial({ tone: 0.97, angle: Math.PI / 2, rim: 0.1 });
  const slabUnder = inkMaterial({ tone: 0.6, emissive: 0.32, angle: 0, rim: 0 });
  // [material, base tone, base emissive] so the stone can sink into the dark with the sky
  const toned = [[outer, 0.95, 0], [inner, 0.72, 0], [slabTop, 0.97, 0], [slabSide, 0.97, 0], [slabUnder, 0.6, 0.32]];
  const toward = new THREE.Vector3(0, 0.5, 3.4);
  const COLS = [
    { x: -4.3, z: 0.6, r: 0.66, tilt: 0.03, seed: 11 },
    { x: -1.1, z: -1.4, r: 0.62, tilt: -0.02, seed: 23 },
    { x: 2.1, z: 0.2, r: 0.7, tilt: 0.04, seed: 37 },
    { x: 5.1, z: -2.6, r: 0.6, tilt: -0.03, seed: 51 },
  ];
  const BASE_Y = -4.2, COL_H = 13.4, FLIGHT = 2.2;
  const columns = COLS.map((c) => {
    const col = makeFracturedColumn(ctx, { radius: c.r, height: COL_H, drums: 8, seed: c.seed, outer, inner, toward, power: 1.6, duration: FLIGHT });
    col.group.position.set(c.x, BASE_Y, c.z);
    col.group.rotation.z = c.tilt;
    temple.add(col.group);
    return col;
  });
  const slab = makeFracturedSlab(ctx, {
    width: 14, height: 1.0, depth: 2.6, pieces: 8, seed: 5, toward, power: 1.4, duration: FLIGHT,
    outer: slabTop, side: slabSide, under: slabUnder, inner,
  });
  slab.group.position.set(0.4, BASE_Y + COL_H + 0.5, -0.8);
  slab.group.rotation.z = -0.02;
  temple.add(slab.group);

  // ---- grit (instanced rocks) and shards (instanced slivers) -----------------------------
  const R_N = 36, S_AMB = 24, S_EXP = 44, S_N = S_AMB + S_EXP;
  const rubbleMat = inkInstanced(ctx, { tone: 0.9, angle: -1, rim: 0.1 });
  const rubbleGeo = rockGeometry(0.28, 4, 0.4);
  const rubble = new THREE.InstancedMesh(rubbleGeo, rubbleMat, R_N);
  rubble.frustumCulled = false;
  temple.add(rubble);
  const shardMat = inkInstanced(ctx, { tone: 1.0, hatch: 0.2, angle: Math.PI / 2, rim: 0.3, emissive: 0.3 });
  const shardGeo = shardGeometry();
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, S_N);
  shards.frustumCulled = false;
  scene.add(shards);
  toned.push([rubbleMat, 0.9, 0], [shardMat, 1.0, 0.3]);

  const rand = rng(99);
  const rb = new Float32Array(R_N * 12); // base xyz, vel xyz, spin xyz, scale, delay, lift
  for (let i = 0; i < R_N; i++) {
    const c = COLS[i % COLS.length];
    const y = BASE_Y + COL_H * (0.45 + rand() * 0.55);
    const a = rand() * Math.PI * 2;
    const o = i * 12;
    rb[o] = c.x + Math.cos(a) * c.r * 1.1; rb[o + 1] = y; rb[o + 2] = c.z + Math.sin(a) * c.r * 1.1;
    rb[o + 3] = Math.cos(a) * (1.5 + rand() * 4); rb[o + 4] = 2 + rand() * 6; rb[o + 5] = Math.sin(a) * 2 + 1.5 + rand() * 3;
    rb[o + 6] = (rand() - 0.5) * 8; rb[o + 7] = (rand() - 0.5) * 8; rb[o + 8] = (rand() - 0.5) * 8;
    rb[o + 9] = 0.35 + rand() * 1.1; rb[o + 10] = rand() * 0.3; rb[o + 11] = 0.2 + rand() * 0.7;
  }
  const sb = new Float32Array(S_N * 8); // base xyz, vel xyz, scale, phase/delay
  for (let i = 0; i < S_N; i++) {
    const o = i * 8;
    if (i < S_AMB) {
      sb[o] = -9 + rand() * 18; sb[o + 1] = -2 + rand() * 14; sb[o + 2] = -6 + rand() * 7;
      const sp = 0.8 + rand() * 1.6;
      sb[o + 3] = 0.55 * sp; sb[o + 4] = 1.0 * sp; sb[o + 5] = 0.15 * sp;
      sb[o + 6] = 0.03 + rand() * 0.05; sb[o + 7] = rand();
    } else {
      const c = COLS[i % COLS.length];
      const y = 1 + rand() * 8;
      sb[o] = c.x + (rand() - 0.5) * 1.6; sb[o + 1] = y; sb[o + 2] = c.z + 1.6 + rand() * 2;
      // aim past the camera, never through its centre
      const tx = CAM.x + (rand() < 0.5 ? -1 : 1) * (0.8 + rand() * 2.4), ty = CAM.y + 3 + (rand() - 0.5) * 7, tz = CAM.z + 3;
      const dx = tx - sb[o], dy = ty - y, dz = tz - sb[o + 2];
      const l = Math.hypot(dx, dy, dz), sp = 9 + rand() * 9;
      sb[o + 3] = (dx / l) * sp; sb[o + 4] = (dy / l) * sp; sb[o + 5] = (dz / l) * sp;
      sb[o + 6] = 0.16 + rand() * 0.2; sb[o + 7] = rand() * 0.35;
    }
  }
  const dummy = new THREE.Object3D();
  const v3 = new THREE.Vector3();

  // ---- embers --------------------------------------------------------------------------
  const embers = makeEmbers(ctx, { count: 60 });
  camera.add(embers.mesh);

  // ---- state: everything below is derived from p ------------------------------------------
  const st = { p: 0, crack: 0, lift: 0, ex: 0, burn: 0, sink: 0, tilt: 0, shake: 0, ember: 0, density: 0 };
  const flash = ctx.engine.ink.uniforms.uFlash;

  function derive(p) {
    st.p = p;
    st.crack = smooth(0.17, 0.5, p);
    st.lift = smooth(0.3, 0.56, p) * 2.2;
    // the break: fast at first, then the pieces sail (ease-out on the ballistic clock)
    const u = clamp01((p - 0.55) / 0.35);
    st.ex = u * (1.3 - 0.3 * u);
    st.burn = clamp01((p - 0.6) / 0.28);
    st.sink = smooth(0.66, 0.92, p);            // stone tone sinks into the dark
    st.tilt = smooth(0.56, 0.95, p);
    // shake: builds with the cracks, peaks at the break, gone once the pieces fly
    st.shake = smooth(0.25, 0.55, p) * (1 - smooth(0.56, 0.72, p)) * 0.022;
    st.ember = smooth(0.56, 0.7, p);
    st.density = 1 - smooth(0.82, 0.98, p) * 0.62;
    // one smooth flash at the break (scrubbable, reverses)
    const f = (p - 0.565) / 0.022;
    flash.value = ctx.reduced ? 0 : 0.32 * Math.exp(-f * f);
  }

  function placeAll(time) {
    const lift = st.lift, ex = st.ex;
    for (let i = 0; i < columns.length; i++) { columns[i].set(ex, lift); columns[i].crack(st.crack); }
    slab.set(ex, lift);
    for (let i = 0; i < toned.length; i++) {
      const u = toned[i][0].uniforms;
      u.uTone.value = toned[i][1] * (1 - 0.92 * st.sink);
      if (u.uEmissive) u.uEmissive.value = toned[i][2] * (1 - st.sink);
    }
    shardMat.uniforms.uRim.value = 0.3 * (1 - st.sink);
    skyU.uTime.value = time;
    skyU.uBurn.value = st.burn;
    skyU.uDrift.value = st.p * 0.35;

    // grit: appears as the stone gives, hovers while cracking, flies with the break
    const vis = Math.min(1, lift * 0.9 + ex * 4) * (1 - st.sink * 0.85);
    for (let i = 0; i < R_N; i++) {
      const o = i * 12;
      const d = rb[o + 10];
      const lt = ex <= d ? 0 : Math.min(1, (ex - d) / (1 - d)) * 2.2;
      const hover = Math.min(1, lift) * rb[o + 11];
      dummy.position.set(
        rb[o] + rb[o + 3] * lt,
        rb[o + 1] + hover * 0.6 + Math.sin(time * 1.3 + i) * 0.03 * hover + rb[o + 4] * lt + 0.75 * lt * lt,
        rb[o + 2] + rb[o + 5] * lt,
      );
      dummy.rotation.set(rb[o + 6] * (lt + hover * 0.2 + st.p), rb[o + 7] * (lt + hover * 0.2), rb[o + 8] * lt);
      const s = rb[o + 9] * vis;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.instanceMatrix.needsUpdate = true;

    // shards: a few slow streaks drift up through the sky; the break sends a volley past the lens
    for (let i = 0; i < S_N; i++) {
      const o = i * 8;
      let x, y, z, s, len;
      if (i < S_AMB) {
        let k = sb[o + 7] + time * 0.05 + st.p * 0.8;
        k -= Math.floor(k);
        const tr = k * 6 + ex * 6;
        x = sb[o] + sb[o + 3] * tr;
        y = sb[o + 1] + sb[o + 4] * tr;
        z = sb[o + 2] + sb[o + 5] * tr;
        s = sb[o + 6] * (0.5 + Math.min(1, lift) * 0.5 + ex) * Math.min(1, Math.min(k, 1 - k) * 8) * smooth(0.12, 0.3, st.p) * (1 - st.sink);
        len = 2 + ex * 4;
      } else {
        const d = sb[o + 7];
        const lt = ex <= d ? -1 : ((ex - d) / (1 - d)) * 3.2;
        x = sb[o] + sb[o + 3] * Math.max(0, lt);
        y = sb[o + 1] + sb[o + 4] * Math.max(0, lt);
        z = sb[o + 2] + sb[o + 5] * Math.max(0, lt);
        s = lt < 0 || lt > 2.6 ? 0 : sb[o + 6] * 1.4;
        len = 6;
      }
      dummy.position.set(x, y, z);
      v3.set(x + sb[o + 3], y + sb[o + 4], z + sb[o + 5]);
      dummy.lookAt(v3);
      dummy.scale.set(s, s, s * len);
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;

    embers.place(camera, st.ember, st.density, st.p, time);
  }

  function placeCamera(time) {
    // portrait: pull back so ~3 columns and the slab stay in frame
    const th = Math.tan((camera.fov * Math.PI) / 360);
    const back = Math.max(1, 3.3 / (th * camera.aspect * CAM.z));
    const portrait = camera.aspect < 0.8 ? 1 : 0;
    const t = st.tilt;
    camPos.set(CAM.x - portrait * 0.5, CAM.y + t * 1.2, CAM.z * back + t * 2.6 * back + (1 - st.p) * 0.4);
    look.set(LOOK.x - portrait * 0.5, LOOK.y + portrait * 0.6 + t * (9 + back * 2), LOOK.z - t * 2);
    // tiny deterministic tremor from p (no time): frozen when the scroll stops
    if (!ctx.reduced && st.shake > 0) {
      const q = st.p * 900;
      camPos.x += (Math.sin(q * 1.7) + Math.sin(q * 2.9) * 0.6) * st.shake * back;
      camPos.y += (Math.sin(q * 2.3 + 1.3) + Math.sin(q * 1.1) * 0.6) * st.shake * back;
    }
    if (!ctx.reduced) {
      camPos.x += Math.sin(time * 0.31) * 0.05;
      camPos.y += Math.sin(time * 0.23) * 0.03;
    }
    camera.position.copy(camPos);
    camera.lookAt(look);
    camera.rotateZ(ROLL * (1 - t * 0.6));
  }

  return {
    scene, camera,
    enter() {
      derive(st.p);
      placeAll(0);
      placeCamera(0);
    },
    progress(p) {
      derive(p);
    },
    update(dt, time) {
      placeAll(time);
      placeCamera(time);
    },
    pointer() {},
    exit() {
      flash.value = 0;
    },
    dispose() {
      flash.value = 0;
      for (const c of columns) c.dispose();
      slab.dispose();
      for (const [m] of toned) m.dispose();
      rubbleGeo.dispose(); rubble.dispose();
      shardGeo.dispose(); shards.dispose();
      sky.geometry.dispose(); sky.material.dispose();
      embers.dispose();
    },
  };
}
