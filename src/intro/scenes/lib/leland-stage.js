// The work-leland stage: engraved floor planks with one GLOW spotlight pool under the
// piano (and the piano's shadow in it), inside an ember cyclorama wall engraved with
// faint sound rings that ripple outward with scroll (uP, a pure function of p).
import * as THREE from 'three';

export function buildStage(ctx, { center = new THREE.Vector3(0, 0, -0.9) } = {}) {
  const { GBUF_GLSL } = ctx;
  const owned = [];
  const own = (o) => { owned.push(o); return o; };
  const group = new THREE.Group();
  const uP = { value: 0 };

  const floorMat = own(new THREE.ShaderMaterial({
    uniforms: { uC: { value: center.clone() } },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform vec3 uC; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
      void main(){
        // planks run up and down stage (along z), butt joints staggered per board
        float u = vW.x / 0.17;
        float col = floor(u);
        float len = 1.7 + h(vec2(col, 3.1)) * 1.3;
        float v = (vW.z + h(vec2(col, 7.7)) * len) / len;
        float fu = fract(u), fv = fract(v);
        float wu = fwidth(u), wv = fwidth(v);
        float seam = max(1.0 - smoothstep(0.0, 0.04 + wu * 1.2, min(fu, 1.0 - fu)),
                         1.0 - smoothstep(0.0, 0.008 + wv * 1.2, min(fv, 1.0 - fv)));
        float tone = h(vec2(col, floor(v)));
        // the spotlight pool: a slightly long ellipse under the piano, hard woodcut edge
        vec2 q = (vW.xz - uC.xz) / vec2(2.05, 2.45);
        float r = length(q);
        float dist = length(vW.xz - uC.xz);
        float pool = 1.0 - step(1.0, r);
        // the piano's shadow, thrown back and to the treble side
        vec2 s = (vW.xz - vec2(0.18, -1.08)) / vec2(0.86, 1.08);
        float shadow = 1.0 - smoothstep(0.75, 1.05, length(s));
        vec2 b = (vW.xz - vec2(0.05, 0.72)) / vec2(0.5, 0.26);
        shadow = max(shadow, 1.0 - smoothstep(0.7, 1.0, length(b)));
        float shade, pal, hatch;
        if (pool > 0.5) {
          shade = (0.84 + 0.1 * tone) * mix(1.0, 0.82, smoothstep(0.55, 1.0, r));
          shade = mix(shade, 0.22, shadow * 0.85);
          pal = PAL_ACCENT; hatch = 0.55;
          seam *= 0.7;
        } else {
          // outside the light: dark boards with engraved falloff rings
          shade = mix(0.36, 0.05, smoothstep(1.0, 4.2, r)) * (0.82 + 0.3 * tone);
          float ring = fract(r * 3.2);
          shade *= mix(1.0, 0.55, (1.0 - smoothstep(0.0, 0.05 + fwidth(r * 3.2), ring)) * (1.0 - smoothstep(1.0, 2.2, r)));
          pal = PAL_NEUTRAL; hatch = 1.0;
        }
        shade = mix(shade, 0.03, seam);
        gl_FragColor = gbuf(shade, pal, 0.0, hatch);
      }`,
  }));
  const floor = new THREE.Mesh(own(new THREE.CircleGeometry(13, 72)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, 0, center.z);
  group.add(floor);

  const wallMat = own(new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uP, uSrc: { value: new THREE.Vector3(center.x + 0.3, 1.2, center.z) } },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform float uP; uniform vec3 uSrc; varying vec3 vW;
      void main(){
        float y = vW.y;
        float shade = mix(0.86, 0.5, smoothstep(2.0, 9.0, y));
        float pal = PAL_RED;
        if (y > 9.0) { pal = PAL_OXBLOOD; shade = mix(0.75, 0.3, smoothstep(9.0, 15.0, y)); }
        // a dark skirting band where wall meets floor
        shade = mix(shade, 0.12, 1.0 - smoothstep(0.0, 0.35, y));
        // sound rings radiating from the piano, travelling with scroll
        float d = distance(vW, uSrc);
        float k = d * 0.42 - uP * 3.0;
        float f = fract(k);
        float ring = 1.0 - smoothstep(0.0, 0.08 + fwidth(k) * 1.2, min(f, 1.0 - f));
        shade = mix(shade, shade * 0.3, ring * smoothstep(0.4, 1.2, y));
        gl_FragColor = gbuf(shade, pal, 0.0, 1.0);
      }`,
  }));
  const wall = new THREE.Mesh(own(new THREE.CylinderGeometry(12.5, 12.5, 18, 72, 1, true)), wallMat);
  wall.position.set(center.x, 9, center.z);
  group.add(wall);

  return {
    group,
    setP(p) { uP.value = p; },
    dispose() { for (const o of owned) o.dispose(); },
  };
}
