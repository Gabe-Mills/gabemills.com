// work-ricochet: Ricochet Tanks. An engraved tank arena at night: tiled paper floor, maze
// walls of hatched paper blocks, floodlight towers, an ember tank (the player) and two
// grey enemies. The player fires; the shell's glow tracer banks off four walls, sparking
// and scorching each one, and blows the far enemy apart. The camera swoops after the
// shell, settles square-on to a giant billboard at the arena's back edge (the print),
// which develops into the live site; then it pulls up high for the wipe.
// Everything is a pure function of p, so scrolling back rewinds the shot.
import * as THREE from 'three';
import { makeProjectFrame, cardCurve, smooth } from './lib/project-frame.js';
import { projects } from '../../data/projects';
import { makeArena, traceRicochet } from './lib/ricochet-arena.js';
import { makeTank, linkMaterial, popPlan, applyPop } from './lib/ricochet-tank.js';
import { makeShot } from './lib/ricochet-shot.js';

// ---- timeline (beat p) ----
const P_FIRE = 0.075;   // shell leaves the barrel
const P_HIT = 0.3;      // shell reaches the enemy
const P_POP = 0.16;     // debris flight time
const SETTLE = [0.27, 0.41];
const DEVELOP = [0.4, 0.5, 0.8, 0.86];
const PULL = [0.86, 1.0];

const SHOT_Y = 0.78;
const PRINT_W = 6.4;
const FOV = 40;
const FOLLOW = [-1.6, -0.8, 0, 0.7]; // arc offsets averaged for the chase target

export function create(ctx, beat) {
  const { PAL, inkMaterial, flatMaterial, engine } = ctx;
  const project = projects.find((x) => x.id === beat.project);
  const index = projects.indexOf(project) + 1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);

  // ---- arena ----
  const arena = makeArena(ctx);
  scene.add(arena.group);

  // ---- tanks ----
  const links = linkMaterial(ctx);
  const player = makeTank(ctx, { pal: PAL.EMBER, tone: 0.9, turretTone: 0.95, barrelTone: 0.45, linkMat: links });
  const enemyMk = () => makeTank(ctx, { pal: PAL.DIM, tone: 0.85, turretTone: 0.92, barrelTone: 0.4, linkMat: links });
  const target = enemyMk();
  const sentry = enemyMk();

  const ANG = (316.5 * Math.PI) / 180;
  const aim = new THREE.Vector3(Math.cos(ANG), 0, Math.sin(ANG));
  const aimYaw = Math.atan2(aim.x, aim.z);
  const restYaw = aimYaw + 0.9; // where the turret starts before it swings onto the shot
  player.root.position.set(-4.4, 0, 2.9);
  player.root.rotation.y = aimYaw - 0.55;
  const pivot = new THREE.Vector3(0, SHOT_Y, -0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.root.rotation.y).add(player.root.position);
  pivot.y = SHOT_Y;

  const tr = traceRicochet(pivot.x, pivot.z, ANG, 4);
  const last = tr.hits[tr.hits.length - 1];
  const finalDir = new THREE.Vector3(tr.dir[0], 0, tr.dir[1]);
  const E = new THREE.Vector3(last.x, 0, last.z).addScaledVector(finalDir, 2.3);
  target.root.position.copy(E);
  target.root.rotation.y = Math.atan2(-0.55, 0.84);
  target.turret.rotation.y = 0.6;
  sentry.root.position.set(2.9, 0, 3.3);
  sentry.root.rotation.y = -Math.PI / 2;
  scene.add(player.root, target.root, sentry.root);
  const pop = popPlan(target);

  // tank shadows on the floor
  const tankU = arena.tanksUniform;
  const setShadow = (i, t, k) => tankU[i].set(t.root.position.x, t.root.position.z, t.root.rotation.y, k);
  setShadow(0, player, 1); setShadow(1, target, 1); setShadow(2, sentry, 1);

  // ---- the shot ----
  const hitPt = E.clone().addScaledVector(finalDir, -0.62); hitPt.y = SHOT_Y;
  const pts = [pivot.clone(), ...tr.hits.map((h) => new THREE.Vector3(h.x, SHOT_Y, h.z)), hitPt];
  const MUZZLE = 1.46; // turret pivot -> muzzle
  const arcs = [0];
  for (let i = 1; i < pts.length; i++) arcs.push(arcs[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const TOTAL = arcs[arcs.length - 1];
  const UP = new THREE.Vector3(0, 1, 0);
  const muzzlePt = pivot.clone().addScaledVector(aim, MUZZLE);
  const bursts = [
    { at: MUZZLE, o: muzzlePt, n: aim, r: aim, count: 14, speed: 0.9, life: 0.035, size: 1 },
    ...tr.hits.map((h, i) => ({
      at: arcs[i + 1], o: pts[i + 1], n: new THREE.Vector3(h.nx, 0, h.nz), r: new THREE.Vector3(h.outX, 0, h.outZ),
      count: 18, speed: 1.3, life: 0.05, size: 1, scorch: 0.36, clipY: 0.99,
    })),
    { at: TOTAL, o: hitPt, n: finalDir.clone().negate(), r: UP, count: 42, speed: 2.4, life: 0.09, size: 1.5 },
    { at: TOTAL, o: new THREE.Vector3(E.x, 0.004, E.z), n: UP, r: UP, count: 0, speed: 0, life: 0.09, size: 1, scorch: 1.7 },
  ];
  const shot = makeShot(ctx, { pts, start: MUZZLE, bursts });
  scene.add(shot.group);
  const arcToP = (s) => P_FIRE + ((s - MUZZLE) / (TOTAL - MUZZLE)) * (P_HIT - P_FIRE);
  const revealAt = (p) => MUZZLE + (TOTAL - MUZZLE) * Math.min(1, Math.max(0, (p - P_FIRE) / (P_HIT - P_FIRE)));

  // ---- the billboard: print + backing, catwalk, lamps, posts ----
  const frame = makeProjectFrame(ctx, project, { width: PRINT_W, index, total: projects.length, side: index % 2 ? 'left' : 'right' });
  const PH = PRINT_W / 1.6;
  const B = new THREE.Vector3(2.5, 3.25, -6.9);
  const rig = new THREE.Group();
  const dark = inkMaterial({ tone: 0.24, pal: PAL.NEUTRAL, angle: -1 });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(PRINT_W + 0.6, PH + 0.6, 0.22), dark);
  backing.position.z = -0.2;
  const catwalk = new THREE.Mesh(new THREE.BoxGeometry(PRINT_W + 0.4, 0.07, 0.7), inkMaterial({ tone: 0.5, pal: PAL.NEUTRAL, angle: 0 }));
  catwalk.position.set(0, -PH / 2 - 0.36, 0.25);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(PRINT_W + 0.4, 0.04, 0.04), dark);
  rail.position.set(0, -PH / 2 - 0.02, 0.58);
  rig.add(backing, catwalk, rail);
  const lampMat = flatMaterial({ shade: 1, pal: PAL.GLOW });
  for (const sx of [-1, 0, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.8), dark);
    arm.position.set(sx * PRINT_W * 0.36, PH / 2 + 0.42, 0.25);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.22), dark);
    head.position.set(sx * PRINT_W * 0.36, PH / 2 + 0.4, 0.68);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.16), lampMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(sx * PRINT_W * 0.36, PH / 2 + 0.325, 0.68);
    rig.add(arm, head, lamp);
  }
  const postGeo = new THREE.BoxGeometry(0.22, 1, 0.22).translate(0, 0.5, 0);
  const posts = [-1, 1].map(() => new THREE.Mesh(postGeo, dark));
  const brace = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.12), dark);
  scene.add(frame.print, rig, ...posts, brace);

  // ---- layout: the settled camera, square to the print ----
  const Qs = new THREE.Quaternion(), Cs = new THREE.Vector3(), Ts = new THREE.Vector3();
  const sRight = new THREE.Vector3(), sUp = new THREE.Vector3(), sFwd = new THREE.Vector3();
  const tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
  const corner = new THREE.Vector3();
  let layoutKey = '', phone = false;
  function layout() {
    const W = engine.width, H = engine.height, aspect = W / H;
    phone = W < 760;
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    let cx, cy, hw, maxHH;
    if (phone) {
      // upper part of the screen; the card owns roughly the lower 42%
      cx = 0; hw = 0.9; cy = 0.46; maxHH = 0.4;
    } else {
      const cardW = Math.min(400, 0.34 * W), margin = Math.min(72, Math.max(20, 0.05 * W));
      const left = -1 + (2 * (cardW + margin + 36)) / W;
      const right = 1 - (2 * 72) / W;
      cx = (left + right) / 2; hw = (right - left) / 2; cy = 0.03; maxHH = 0.8;
    }
    let D = PRINT_W / 2 / (hw * t * aspect);
    if (PH / 2 / (D * t) > maxHH) D = PH / 2 / (maxHH * t);
    const ox = cx * D * t * aspect, oy = cy * D * t;
    tmpE.set(phone ? -0.2 : -0.12, phone ? 0 : -0.1, 0);
    Qs.setFromEuler(tmpE);
    sRight.set(1, 0, 0).applyQuaternion(Qs);
    sUp.set(0, 1, 0).applyQuaternion(Qs);
    sFwd.set(0, 0, -1).applyQuaternion(Qs);
    Cs.copy(B).addScaledVector(sRight, -ox).addScaledVector(sUp, -oy).addScaledVector(sFwd, -D);
    Ts.copy(Cs).addScaledVector(sFwd, D);
    frame.print.position.copy(B);
    frame.print.quaternion.copy(Qs);
    rig.position.copy(B);
    rig.quaternion.copy(Qs);
    rig.updateMatrixWorld(true);
    // posts: straight down from the backing's lower corners
    let y0 = 0;
    [-1, 1].forEach((s, i) => {
      corner.set(s * PRINT_W * 0.34, -PH / 2 - 0.3, -0.25).applyMatrix4(rig.matrixWorld);
      posts[i].position.set(corner.x, 0, corner.z);
      posts[i].scale.y = corner.y;
      y0 = corner.y;
    });
    brace.position.set((posts[0].position.x + posts[1].position.x) / 2, y0 * 0.45, (posts[0].position.z + posts[1].position.z) / 2);
    brace.scale.x = posts[0].position.distanceTo(posts[1].position);
    brace.quaternion.setFromAxisAngle(UP, Math.atan2(-(posts[1].position.z - posts[0].position.z), posts[1].position.x - posts[0].position.x));
  }

  // ---- per-frame scratch ----
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  const fPos = new THREE.Vector3(), fLook = new THREE.Vector3(), tmp = new THREE.Vector3(), head = new THREE.Vector3();
  const offA = new THREE.Vector3(), offB = new THREE.Vector3();
  const lead = new THREE.Vector3();

  return {
    scene, camera,
    enter() { frame.enter(); },
    progress(p) {
      const key = `${engine.width}x${engine.height}`;
      if (key !== layoutKey) { layoutKey = key; layout(); }
      const k = phone ? 1.7 : 1;

      // -- player: turret swings onto the shot, barrel recoils --
      player.turret.rotation.y = THREE.MathUtils.lerp(restYaw, aimYaw, smooth(0.0, 0.065, p)) - player.root.rotation.y;
      const since = p - P_FIRE;
      player.barrel.position.z = 0.42 - (since > 0 ? 0.24 * Math.min(1, since / 0.004) * Math.exp(-since * 38) : 0);

      // -- shell --
      const reveal = revealAt(p);
      shot.update(reveal, p, arcToP);
      shot.at(reveal, head);

      // -- the sentry's turret tracks the action --
      if (p < P_FIRE) head.copy(player.root.position);
      else if (p >= P_HIT) head.copy(E);
      sentry.turret.rotation.y = Math.atan2(head.x - sentry.root.position.x, head.z - sentry.root.position.z) - sentry.root.rotation.y;

      // -- the hit: the target blows apart (pure parabolas) --
      const tp = Math.min(1, Math.max(0, (p - P_HIT) / P_POP));
      applyPop(pop, tp);
      tankU[1].w = 1 - smooth(0, 0.3, tp);

      // -- camera --
      // A: establishing three-quarter over the player
      offA.set(-1.9, 5.6, 3.2).multiplyScalar(k * (1.12 - 0.12 * smooth(0, P_FIRE, p)));
      pos.copy(pivot).add(offA);
      look.copy(pivot).addScaledVector(aim, 2.4);
      // follow: chase a smoothed shell position
      fLook.set(0, 0, 0);
      for (const d of FOLLOW) { shot.at(reveal + d, tmp); fLook.add(tmp); }
      fLook.multiplyScalar(0.25);
      shot.at(reveal + 2.0, lead);
      const u = smooth(P_FIRE, P_HIT, p);
      offB.set(-1.6, 6.2, 5.6).multiplyScalar(k);
      fPos.copy(offA).lerp(offB, u).add(fLook);
      fLook.lerp(lead, 0.35);
      const w1 = smooth(P_FIRE - 0.03, P_FIRE + 0.07, p);
      pos.lerp(fPos, w1); look.lerp(fLook, w1);
      // settle: square to the billboard, drifting up a touch
      const w2 = smooth(SETTLE[0], SETTLE[1], p);
      const drift = 0.22 * (smooth(SETTLE[1], PULL[0], p) - 0.5);
      tmp.copy(sUp).multiplyScalar(drift);
      fPos.copy(Cs).add(tmp); fLook.copy(Ts).add(tmp);
      pos.lerp(fPos, w2); look.lerp(fLook, w2);
      // pull up high over the arena for the wipe
      const w3 = smooth(PULL[0], PULL[1], p);
      fPos.set(0.6, 17, 11.5).multiplyScalar(phone ? 1.6 : 1);
      fLook.set(0.4, 0, -0.6);
      pos.lerp(fPos, w3); look.lerp(fLook, w3);

      camera.position.copy(pos);
      camera.lookAt(look);
      if (w2 >= 1 && w3 <= 0) camera.quaternion.copy(Qs); // exactly square while the print develops
      camera.updateMatrixWorld();

      const develop = smooth(DEVELOP[0], DEVELOP[1], p) * (1 - smooth(DEVELOP[2], DEVELOP[3], p));
      frame.update(p, camera, { develop, cardIn: cardCurve(p) });
    },
    update() {},
    exit() { frame.exit(); },
    dispose() {
      frame.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    },
  };
}
