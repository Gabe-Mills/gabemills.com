// A few lit embers drifting round the cover's hot centre, each on its own contour orbit
// (not rising: the shatter beat owns rising sparks). One instanced draw, flat GLOW / HOT
// diamonds, laid on the field plane so they ride the camera push and the parting.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function makeOrbitEmbers(ctx, { count = 16, seed = 1907 } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const pal = new Float32Array(count);
  const rand = rng(seed);
  const data = new Float32Array(count * 6); // radius, phase, speed, size, wobble, rank
  for (let i = 0; i < count; i++) {
    const o = i * 6;
    data[o] = 0.9 + Math.pow(rand(), 0.8) * 3.6;
    data[o + 1] = rand() * Math.PI * 2;
    data[o + 2] = (0.035 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1);
    data[o + 3] = 0.035 + rand() * rand() * 0.06;
    data[o + 4] = rand() * 10;
    data[o + 5] = rand();
    pal[i] = rand() < 0.3 ? ctx.PAL.HOT : ctx.PAL.GLOW;
  }
  geo.setAttribute('aPal', new THREE.InstancedBufferAttribute(pal, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aPal; varying vec2 vUv; varying float vPal;
      void main(){ vUv = uv; vPal = aPal; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      varying vec2 vUv; varying float vPal;
      void main(){
        vec2 d = abs(vUv - 0.5);
        if (d.x + d.y > 0.5) discard;
        gl_FragColor = gbuf(1.0, vPal, 0.0, 0.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  const dummy = new THREE.Object3D();
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /**
   * amount 0..1 scales the swarm in (lower-ranked embers go first), p turns the orbits a
   * little with scroll, time keeps them drifting, part/centre/squash match the field.
   */
  function place(amount, p, time, part, cx, cy, squash) {
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      const a = data[o + 1] + time * data[o + 2] + p * 0.9 * Math.sign(data[o + 2]);
      const rr = data[o] * (1 + 0.04 * Math.sin(time * 0.5 + data[o + 4]));
      let x = cx + (Math.cos(a) * rr) / squash;
      const y = cy + Math.sin(a) * rr;
      x += (x < 0 ? -1 : 1) * part;
      const lit = smooth(data[o + 5] - 0.1, data[o + 5] + 0.05, amount);
      const s = data[o + 3] * lit;
      dummy.position.set(x, y, 0.02);
      // stretched along the orbit, like a spark on the move
      dummy.rotation.set(0, 0, a + Math.PI / 2 * Math.sign(data[o + 2]) + Math.PI / 2);
      dummy.scale.set(s * 2.4, s, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, place, dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); } };
}
