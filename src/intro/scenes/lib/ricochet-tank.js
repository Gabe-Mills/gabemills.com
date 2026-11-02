// Ricochet beat: a procedural engraved tank. Hull, two treads (housing + road wheels,
// and instanced links running round a stadium loop), turret with hatch and antenna,
// barrel with muzzle brake. Parts are separate groups so a hit can blow them apart.
// Local forward is +z. Everything here is built once; nothing allocates per frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { inkInstanced } from './ricochet-arena.js';

const box = (w, h, l, x, y, z, rx = 0) => {
  const g = new THREE.BoxGeometry(w, h, l);
  if (rx) g.rotateX(rx);
  return g.translate(x, y, z);
};
const cyl = (rt, rb, h, seg, x, y, z, axis = 'y') => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return g.translate(x, y, z);
};

// tread loop (yz plane): straight runs of length 2A, end radius R, centred at height C
const A = 0.66, R = 0.2, C = 0.22;
const PERIM = 4 * A + 2 * Math.PI * R;
const LINKS = 36;

function loopAt(s, out) {
  // s in [0, PERIM): bottom run (forward), front arc, top run (back), back arc
  s = ((s % PERIM) + PERIM) % PERIM;
  if (s < 2 * A) { out.y = C - R; out.z = -A + s; out.a = 0; return out; }
  s -= 2 * A;
  if (s < Math.PI * R) { const t = s / R - Math.PI / 2; out.y = C + Math.sin(t) * R; out.z = A + Math.cos(t) * R; out.a = -(t + Math.PI / 2); return out; }
  s -= Math.PI * R;
  if (s < 2 * A) { out.y = C + R; out.z = A - s; out.a = Math.PI; return out; }
  s -= 2 * A;
  const t = s / R + Math.PI / 2;
  out.y = C + Math.sin(t) * R; out.z = -A + Math.cos(t) * R; out.a = -(t + Math.PI / 2);
  return out;
}

/**
 * @param ctx scene ctx
 * @param opts { body: {pal, tone}, dark: tone for treads, linkMat (shared instanced material) }
 */
export function makeTank(ctx, { pal, tone = 0.85, turretTone = tone, barrelPal = ctx.PAL.NEUTRAL, barrelTone = 0.4, linkMat }) {
  const { inkMaterial, PAL } = ctx;
  const root = new THREE.Group();

  // ---- hull ----
  const hull = new THREE.Group();
  const hullGeo = mergeGeometries([
    box(0.78, 0.3, 1.5, 0, 0.3, 0),                // lower hull between the treads
    box(1.34, 0.06, 1.66, 0, 0.47, 0),             // fenders over the treads
    box(1.0, 0.16, 1.18, 0, 0.58, -0.08),          // upper deck
    box(1.0, 0.07, 0.42, 0, 0.53, 0.66, -0.42),    // sloped glacis
    box(0.9, 0.08, 0.2, 0, 0.62, -0.62),           // engine deck grille block
    box(0.12, 0.05, 0.36, -0.36, 0.69, -0.3),      // tool boxes
    box(0.12, 0.05, 0.36, 0.36, 0.69, -0.3),
  ]);
  hull.add(new THREE.Mesh(hullGeo, inkMaterial({ tone, pal, angle: -1 })));

  // ---- treads ----
  const treadMat = inkMaterial({ tone: 0.42, pal: PAL.NEUTRAL, angle: -1 });
  const treads = [-1, 1].map((side) => {
    const g = new THREE.Group();
    g.position.x = side * 0.53;
    const parts = [box(0.16, 0.3, 1.32, 0, C, 0)];
    for (let i = 0; i < 5; i++) parts.push(cyl(0.135, 0.135, 0.22, 12, 0, 0.17, -0.48 + i * 0.24, 'x'));
    parts.push(cyl(0.16, 0.16, 0.2, 12, 0, C, A + 0.02, 'x'), cyl(0.15, 0.15, 0.2, 12, 0, C, -A - 0.02, 'x'));
    for (let i = 0; i < 5; i++) parts.push(cyl(0.05, 0.05, 0.25, 8, 0, 0.17, -0.48 + i * 0.24, 'x')); // hubs
    g.add(new THREE.Mesh(mergeGeometries(parts), treadMat));
    const links = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.05, 0.085), linkMat, LINKS);
    links.geometry.setAttribute('aTone', new THREE.InstancedBufferAttribute(new Float32Array(LINKS).fill(1), 1));
    g.add(links);
    return { group: g, links };
  });

  // ---- turret (pivot at hull centre) ----
  const turret = new THREE.Group();
  turret.position.set(0, 0.66, -0.06);
  const turretGeo = mergeGeometries([
    cyl(0.34, 0.43, 0.24, 8, 0, 0.12, 0),          // octagonal turret
    box(0.5, 0.18, 0.3, 0, 0.11, -0.42),           // bustle
    box(0.36, 0.2, 0.16, 0, 0.12, 0.42),           // mantlet
    cyl(0.12, 0.13, 0.07, 12, 0.12, 0.27, -0.1),   // hatch
    cyl(0.014, 0.014, 0.75, 4, -0.24, 0.6, -0.36), // antenna
  ]);
  turret.add(new THREE.Mesh(turretGeo, inkMaterial({ tone: turretTone, pal, angle: -1 })));
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.12, 0.42);
  const barrelGeo = mergeGeometries([
    cyl(0.05, 0.06, 0.95, 10, 0, 0, 0.5, 'z'),
    cyl(0.085, 0.085, 0.16, 10, 0, 0, 0.96, 'z'),
  ]);
  barrel.add(new THREE.Mesh(barrelGeo, inkMaterial({ tone: barrelTone, pal: barrelPal, angle: -1 })));
  turret.add(barrel);

  root.add(hull, turret, treads[0].group, treads[1].group);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const pt = { y: 0, z: 0, a: 0 };
  /** Lay the links round the loop, advanced by `roll` (distance driven). */
  function setTreads(roll = 0) {
    for (const t of treads) {
      for (let i = 0; i < LINKS; i++) {
        loopAt(i * (PERIM / LINKS) + roll, pt);
        e.set(pt.a, 0, 0);
        q.setFromEuler(e);
        pos.set(0, pt.y, pt.z);
        t.links.setMatrixAt(i, m.compose(pos, q, one));
      }
      t.links.instanceMatrix.needsUpdate = true;
      t.links.computeBoundingSphere();
    }
  }
  setTreads(0);

  // the muzzle in turret space (barrel at rest)
  const MUZZLE = 1.18;
  return { root, hull, turret, barrel, treads: treads.map((t) => t.group), setTreads, MUZZLE };
}

/** The shared material for every tread link. */
export function linkMaterial(ctx) {
  return inkInstanced(ctx, { tone: 0.3, pal: ctx.PAL.NEUTRAL, angle: -1, hatch: 1, rim: 0.2 });
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Blow a tank apart: each part flies on a parabola from its rest pose to a scattered
 * landing pose, tumbling. t in 0..1 (pure). `plan` is built once by popPlan().
 */
export function popPlan(tank) {
  const parts = [
    { o: tank.turret, peak: 2.6, to: [0.9, -0.36, -1.2], rot: [Math.PI + 0.12, 1.9, 0.1] },
    { o: tank.hull, peak: 0.9, to: [-0.15, 0.08, 0.2], rot: [0.18, -0.5, 0.32] },
    { o: tank.treads[0], peak: 1.4, to: [-0.75, 0.16, 0.5], rot: [0.2, 0.8, Math.PI / 2] },
    { o: tank.treads[1], peak: 1.7, to: [0.95, 0.16, 0.35], rot: [-0.3, -0.6, -Math.PI / 2] },
  ];
  for (const p of parts) {
    p.p0 = p.o.position.clone();
    p.r0 = p.o.rotation.clone();
  }
  return parts;
}
export function applyPop(plan, t) {
  for (const p of plan) {
    const o = p.o;
    o.position.set(
      p.p0.x + p.to[0] * t,
      p.p0.y + p.to[1] * t + 4 * p.peak * t * (1 - t),
      p.p0.z + p.to[2] * t,
    );
    o.rotation.set(lerp(p.r0.x, p.r0.x + p.rot[0], t), lerp(p.r0.y, p.r0.y + p.rot[1], t), lerp(p.r0.z, p.r0.z + p.rot[2], t));
  }
}
