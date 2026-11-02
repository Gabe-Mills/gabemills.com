// Scene "project-leland" (beat: work-leland). Leland Plays Piano, a working pianist's site.
// An engraved concert grand stands in one GLOW spotlight pool on an engraved plank stage,
// inside an ember cyclorama rippling with sound rings. The lid is propped open; the keys
// play a phrase (glissando, arpeggios, a final chord) and engraved staves with notes riding
// them unspool out of the lid and arc up into the framed print hanging above the piano.
//   p 0    -> 0.34  the camera glides from the keyboard around the front of the piano and
//                   rises to the audience view; the staves write themselves up to the print
//   p 0.36 -> 0.5   the print develops into the live site (held at 1 until 0.84)
//   p 0.32 -> 1     the card (right side, index 2) scrubs in and out
//   p 0.84 -> 1     the stick folds, the lid closes, the camera cranes up over the piano
// Everything in progress() is a pure function of p. update() only drives the note flutter.
// The print is placed in the final camera's view space, so it always faces the camera
// squarely and level (the develop layer is an axis-aligned rect), sized from the viewport.
import { makeProjectFrame, cardCurve, smooth } from './lib/project-frame.js';
import { projects } from '../../data/projects';
import { buildPiano, phrasePress, PIANO } from './lib/leland-piano.js';
import { buildStage } from './lib/leland-stage.js';
import { buildStream } from './lib/leland-notes.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * t * (t * (t * 6 - 15) + 10); };

const PRINT_W = 3.2;           // makeProjectFrame width (scaled per layout)
const PRINT_H = PRINT_W / 1.6;
const RIM = 0.07;

export function create(ctx, beat) {
  const { THREE, engine } = ctx;
  const project = projects.find((x) => x.id === beat.project);
  const index = projects.indexOf(project) + 1;
  const side = index % 2 ? 'left' : 'right';
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);

  const stage = buildStage(ctx, { center: new THREE.Vector3(0, 0, PIANO.CENTER.z) });
  const piano = buildPiano(ctx);
  const stream = buildStream(ctx);
  const frame = makeProjectFrame(ctx, project, { width: PRINT_W, index, total: projects.length, side });
  scene.add(stage.group, piano.group, stream.group, frame.print);

  // two hanging wires from the print's top corners
  const wireGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 5).translate(0, 0.5, 0);
  const wireMat = ctx.flatMaterial({ shade: 0.05, pal: ctx.PAL.NEUTRAL });
  const wires = [new THREE.Mesh(wireGeo, wireMat), new THREE.Mesh(wireGeo, wireMat)];
  scene.add(...wires);

  // ---------------------------------------------------------------- layout (runs when the viewport shape changes)
  const ref = new THREE.PerspectiveCamera();
  const L = { key: '', pos: new THREE.Vector3(), look: new THREE.Vector3(), phi: 0, dist: 0, y: 0, fov: 32, phone: false };
  const R = new THREE.Vector3(), U = new THREE.Vector3(), tv = new THREE.Vector3();

  function ndcToWorld(nx, ny, depth, out, aspect, tanH) {
    out.set(nx * depth * tanH * aspect, ny * depth * tanH, -depth);
    return ref.localToWorld(out);
  }

  function relayout() {
    const W = engine.width, H = engine.height;
    const aspect = camera.aspect;
    const key = `${W}x${H}`;
    if (key === L.key) return;
    L.key = key;
    const phone = aspect < 0.8;
    L.phone = phone;
    L.fov = phone ? 50 : 30;
    const tanH = Math.tan(THREE.MathUtils.degToRad(L.fov / 2));
    L.phi = phone ? 0.86 : 0.95;
    L.dist = phone ? 12 : 11.6;
    L.y = phone ? 3.6 : 2.9;

    // print rect in NDC
    let pw, pcx, top, depth;
    if (phone) {
      pw = 1.84; pcx = 0; top = 0.8; depth = 13;
    } else {
      const margin = Math.min(72, Math.max(20, W * 0.05));
      const cardL = 1 - (2 * (margin + Math.min(400, W * 0.34))) / W;
      const right = cardL - 0.07, left = -0.95;
      pw = Math.min(1.12, right - left, (1.06 * 1.6) / aspect);
      pcx = right - pw / 2 - Math.max(0, (right - left - pw) / 2) * 0.6;
      top = 0.84; depth = 12;
    }
    const ph = (pw * aspect) / 1.6;
    const pcy = top - ph / 2;
    const bottom = top - ph;

    // where the piano sits on screen: under the print, clear of the card
    const pianoNdc = phone ? [0.02, Math.min(0.06, bottom - 0.32)] : [pcx + 0.1, -0.58];

    // final camera: on the audience side, shifted so the piano lands at pianoNdc
    const C = PIANO.CENTER;
    L.pos.set(C.x + Math.sin(L.phi) * L.dist, L.y, C.z + Math.cos(L.phi) * L.dist);
    ref.fov = L.fov; ref.aspect = aspect; ref.updateProjectionMatrix();
    ref.position.copy(L.pos);
    ref.lookAt(C);
    ref.updateMatrixWorld();
    const d = L.pos.distanceTo(C);
    R.setFromMatrixColumn(ref.matrixWorld, 0); U.setFromMatrixColumn(ref.matrixWorld, 1);
    L.look.copy(C).addScaledVector(R, -pianoNdc[0] * d * tanH * aspect).addScaledVector(U, -pianoNdc[1] * d * tanH);
    ref.lookAt(L.look);
    ref.updateMatrixWorld();

    // the print, squarely facing the final camera
    const worldW = pw * depth * tanH * aspect;
    const s = worldW / (PRINT_W + RIM * 2);
    ndcToWorld(pcx, pcy, depth, frame.print.position, aspect, tanH);
    frame.print.quaternion.copy(ref.quaternion);
    frame.print.scale.setScalar(s);
    frame.print.updateMatrixWorld(true);
    for (const [i, sx] of [-1, 1].entries()) {
      tv.set(sx * (PRINT_W / 2 - 0.3), PRINT_H / 2 + RIM, -0.03);
      frame.print.localToWorld(tv);
      wires[i].position.copy(tv);
      wires[i].scale.set(1, 20 - tv.y, 1);
    }

    // staves: out of the lid on the treble side, up into the print's lower edge
    const paths = [];
    for (let r = 0; r < 3; r++) {
      const k = r - 1;
      const pts = [
        new THREE.Vector3(0.15 + 0.1 * k, 1.02, -1.0 + 0.28 * k),
        new THREE.Vector3(0.95, 1.32 + 0.08 * k, -0.78 + 0.26 * k),
      ];
      if (phone) {
        pts.push(ndcToWorld(0.5 + 0.08 * k, pianoNdc[1] + 0.1 + 0.04 * k, d - 0.6, new THREE.Vector3(), aspect, tanH));
        pts.push(ndcToWorld(0.62 + 0.06 * k, bottom - 0.08 + 0.03 * k, (d + depth) / 2, new THREE.Vector3(), aspect, tanH));
        pts.push(ndcToWorld(0.28 + 0.22 * k, bottom - 0.012, depth - 0.12, new THREE.Vector3(), aspect, tanH));
      } else {
        const rightEdge = pcx + pw / 2;
        pts.push(ndcToWorld(Math.min(rightEdge, pianoNdc[0] + 0.3) + 0.03 * k, pianoNdc[1] + 0.2 + 0.06 * k, d - 0.2, new THREE.Vector3(), aspect, tanH));
        pts.push(ndcToWorld(Math.min(rightEdge - 0.02, pianoNdc[0] + 0.36) + 0.03 * k, bottom - 0.12 + 0.03 * k, (d + depth) / 2, new THREE.Vector3(), aspect, tanH));
        pts.push(ndcToWorld(pcx + 0.14 + 0.2 * k, bottom - 0.012, depth - 0.12, new THREE.Vector3(), aspect, tanH));
      }
      paths.push(pts);
    }
    U.setFromMatrixColumn(ref.matrixWorld, 1);
    stream.layout(paths, L.pos, U);

    camera.fov = L.fov;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- per-frame state (no allocation)
  const press = new Float32Array(88);
  const revs = [0, 0, 0];
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), top = new THREE.Vector3();
  const LOOK0 = new THREE.Vector3(-0.12, 0.8, 0.08);
  const BODY = PIANO.CENTER;

  return {
    scene, camera,
    enter() { frame.enter(); },
    progress(p) {
      relayout();
      // camera: glide around the front of the piano to the audience view
      const a = ease(0, 0.34, p);
      const phi = lerp(-0.72, L.phi, a);
      const dist = lerp(L.phone ? 3.9 : 3.0, L.dist, a);
      const y = lerp(L.phone ? 1.55 : 1.25, L.y, a);
      pos.set(BODY.x + Math.sin(phi) * dist, y, BODY.z + Math.cos(phi) * dist);
      look.lerpVectors(LOOK0, L.look, a);
      // resolve: crane up over the piano
      const r = ease(0.86, 1, p);
      if (r > 0) {
        top.set(BODY.x + Math.sin(L.phi) * 2.4, L.phone ? 9.5 : 7.2, BODY.z + Math.cos(L.phi) * 2.4);
        pos.lerp(top, r);
        look.lerp(BODY, r);
      }
      camera.position.copy(pos);
      camera.lookAt(look);
      camera.updateMatrixWorld();

      // the piano plays, then closes
      piano.setPress(phrasePress(p, press));
      piano.setLid(PIANO.LID_OPEN * (1 - smooth(0.88, 0.99, p)), smooth(0.84, 0.9, p));

      // the staves write themselves out of the lid to the print
      for (let i = 0; i < 3; i++) revs[i] = smooth(0.03 + 0.03 * i, 0.34 + 0.01 * i, p);
      stream.update(p, revs, 1 - smooth(0.84, 0.95, p), smooth(0.85, 0.99, p));
      stage.setP(p);

      frame.update(p, camera, { develop: smooth(0.36, 0.5, p) * (1 - smooth(0.84, 0.92, p)), cardIn: cardCurve(p) });
    },
    update(dt, time) { stream.tick(time); },
    exit() { frame.exit(); },
    dispose() {
      frame.dispose();
      piano.dispose(); stage.dispose(); stream.dispose();
      wireGeo.dispose(); wireMat.dispose();
    },
  };
}
