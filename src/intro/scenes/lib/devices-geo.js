// Geometry helpers for the "apps" beat (devices.js): rounded slabs for device bodies and a
// flattened tube for the watch strap. Everything returns plain BufferGeometry; the caller owns
// and disposes it.

/** Rounded rectangle Shape, centred on the origin. */
export function roundedRect(THREE, w, h, r) {
  const s = new THREE.Shape();
  const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * A device body: w x h footprint with corner radius r (in XY), d thick (Z), softly bevelled
 * edges. Centred on the origin, front face at +d/2.
 */
export function roundedSlab(THREE, w, h, d, r, bevel = Math.min(0.02, d * 0.3)) {
  const b = Math.min(bevel, d * 0.45);
  const shape = roundedRect(THREE, w - 2 * b, h - 2 * b, Math.max(0.001, r - b));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, d - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.translate(0, 0, -(d - 2 * b) / 2);
  // keep the extruder's flat per-face normals: smoothing pulls the big caps' normals toward
  // the bevel and leaves a diagonal seam across them; the bevel facets read as form lines.
  return g;
}

/** Same body lying flat: footprint w (X) x depth (Z), thickness t (Y), bottom at y = 0. */
export function flatSlab(THREE, w, depth, t, r, bevel) {
  const g = roundedSlab(THREE, w, depth, t, r, bevel);
  g.rotateX(-Math.PI / 2);
  g.translate(0, t / 2, 0);
  return g;
}

/**
 * Watch strap: a band swept round an ellipse in the YZ plane (the wrist loop), from angle a to b
 * (theta 0 = front, +z). A tube with a thin radius flattened along X gives a band with soft edges.
 */
export function strapLoop(THREE, { cy, ry, rz, a, b, width, thick }) {
  class Loop extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const th = a + (b - a) * t;
      return target.set(0, cy + ry * Math.sin(th), rz * Math.cos(th));
    }
  }
  const g = new THREE.TubeGeometry(new Loop(), 64, thick / 2, 10, false);
  g.scale(width / thick, 1, 1);
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
