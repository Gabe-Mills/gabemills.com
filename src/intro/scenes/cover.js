// Cover beat (anchor #top): the name reveal, right after the walls come down.
// Set: an engraved heat field (contour isolines bunching toward a hot centre, the original
// site's "Molten Glass" hero) with a few lit embers circling it. Type: DOM in ctx.overlay.
//   0    -> 0.15  dark, the field faintly warm, embers carried over from the shatter
//   0.05 -> 0.40  the name rises in letter by letter while the camera pushes in and the
//                 heat blooms toward the centre
//   0.40 -> 0.82  hold (a slow drift keeps it alive)
//   0.82 -> 1     the field cools and parts down the middle, the type lifts away -> wipe
// progress(p) is pure; update() only adds ambient drift (ring flow, ember orbits).
import '../cover.css';
import { makeHeatField } from './lib/cover-field.js';
import { makeOrbitEmbers } from './lib/cover-embers.js';
import { makeCoverType } from './lib/cover-type.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export function create(ctx, beat) {
  const { THREE } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);

  const field = makeHeatField(ctx);
  const embers = makeOrbitEmbers(ctx);
  scene.add(field.mesh, embers.mesh);
  const type = makeCoverType(ctx.overlay);

  const look = new THREE.Vector3();
  const centre = field.u.uCentre.value;
  let P = 0, time = 0, px = 0, py = 0;

  function apply() {
    const p = P;
    const phone = camera.aspect < 0.8;
    const land = smooth(0.0, 0.4, p);        // push in while the name arrives
    const heatIn = smooth(0.06, 0.42, p);
    const cool = smooth(0.82, 1.0, p);
    const part = Math.pow(smooth(0.86, 1.0, p), 1.6);

    const u = field.u;
    u.uHeat.value = (0.24 + 0.76 * heatIn) * (1 - 0.82 * cool);
    u.uBloom.value = lerp(0.6, phone ? 1.2 : 1.45, heatIn) + 0.15 * smooth(0.42, 0.82, p);
    // the pool opens to hold the type as it lands, and closes again as the field cools
    u.uPool.value = lerp(0.3, phone ? 2.3 : 1.38, smooth(0.03, 0.3, p)) * (1 - 0.35 * cool);
    u.uSquash.value = phone ? 1.45 : 0.56;
    u.uR.value = phone ? 3.4 : 4.2;
    u.uFlow.value = time * 0.07 + p * 1.6;
    u.uPart.value = part * (phone ? 2.6 : 4.2);
    u.uTime.value = time;
    u.uDpr.value = ctx.engine.dpr;
    centre.set(0, phone ? 0.25 : 0.1);

    // camera: tilted down onto the field, pushing in as the heat blooms, then on through the gap
    const z = lerp(phone ? 15 : 10.5, phone ? 10.2 : 6.6, land) - 0.6 * smooth(0.4, 0.82, p) - 1.6 * smooth(0.82, 1, p);
    const y = lerp(-3.2, -1.1, land) + 0.4 * smooth(0.82, 1, p);
    camera.position.set(px * 0.22, y + py * 0.14, z);
    look.set(0, centre.y + 0.05, 0);
    camera.lookAt(look);
    camera.updateMatrixWorld();

    // embers: carried over dim from the shatter, gathering as the heat blooms, gone by the wipe
    const amount = (0.45 + 0.55 * heatIn) * (1 - smooth(0.86, 0.98, p));
    embers.place(amount, p, time, u.uPart.value, centre.x, centre.y, u.uSquash.value);
  }

  return {
    scene, camera,
    enter() { type.show(); type.update(P); },
    progress(p) {
      P = p;
      apply();
      type.update(p);
    },
    // the engine runs this after progress(), so the frame drawn always has this frame's drift
    update(dt, t) { time = t ?? time + dt; apply(); },
    pointer(nx, ny) { px = nx; py = ny; },
    exit() { type.hide(); },
    dispose() { type.dispose(); field.dispose(); embers.dispose(); },
  };
}
