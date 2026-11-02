// Rising embers for the "open" beat: small flat sparks of lit ember / hot ember, one
// instanced draw, parented to the camera so they fill the frame at any aspect.
// place(amount, density, p, time): amount 0..1 scales them in, density 0..1 is the
// share of the swarm that is lit (fewer as the scene settles into the dark).
import * as THREE from 'three';
import { rng } from './fracture.js';

export function makeEmbers(ctx, { count = 60, seed = 77 } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const pal = new Float32Array(count);
  const rand = rng(seed);
  const data = new Float32Array(count * 8); // u, depth, phase, speed, size, sway, swayF, rank
  for (let i = 0; i < count; i++) {
    const o = i * 8;
    data[o] = rand();
    data[o + 1] = 3.5 + rand() * 9;
    data[o + 2] = rand();
    data[o + 3] = 0.035 + rand() * 0.05;
    data[o + 4] = 0.02 + rand() * rand() * 0.06;
    data[o + 5] = 0.08 + rand() * 0.25;
    data[o + 6] = 0.4 + rand() * 0.9;
    data[o + 7] = rand();
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
        if (d.x + d.y > 0.5) discard;          // a diamond, stretched into a spark by the instance scale
        gl_FragColor = gbuf(1.0, vPal, 0.0, 0.0);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  const dummy = new THREE.Object3D();
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function place(camera, amount, density, p, time) {
    const th = Math.tan((camera.fov * Math.PI) / 360);
    for (let i = 0; i < count; i++) {
      const o = i * 8;
      const z = data[o + 1];
      const hh = th * z * 1.15, hw = hh * camera.aspect;
      // rise: scroll lifts them a little, time keeps them drifting when the page is still
      let k = data[o + 2] + time * data[o + 3] + p * 0.9;
      k -= Math.floor(k);
      const edge = Math.min(1, Math.min(k, 1 - k) * 7);
      const lit = smooth(data[o + 7] - 0.08, data[o + 7] + 0.02, density) * amount;
      const s = data[o + 4] * (0.35 + z * 0.13) * edge * lit;
      dummy.position.set(
        (data[o] * 2 - 1) * hw + Math.sin(time * data[o + 6] + i) * data[o + 5],
        -hh + k * hh * 2,
        -z,
      );
      dummy.rotation.set(0, 0, Math.sin(time * data[o + 6] * 0.7 + i * 2.3) * 0.35);
      dummy.scale.set(s, s * 2.1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    mesh, place,
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}
