// Ember sky for the "open" beat, with a burn that eats it away into darkness.
//
// uBurn 0: the woodcut ember sky (diagonal hatch, drifting oxblood streak clouds).
// uBurn 0..1: a ragged front, top first, burns the sky away. The front has a thin
// lit-ember rim and a band of oxblood char; behind it is near-solid ink with faint
// oxblood heat contours, the same warm field the site hero opens on.
// uBurn 1: all dark. Pure function of uBurn and uDrift (both driven by scroll p);
// uTime only adds a very slow cloud drift.
import * as THREE from 'three';

export function shatterSky(ctx, { radius = 90, angle = 0.62 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uBurn: { value: 0 }, uDrift: { value: 0 }, uAng: { value: angle } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uTime, uBurn, uDrift, uAng; varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.1; a *= 0.5; } return s; }
      void main(){
        float az = atan(vDir.x, -vDir.z), el = vDir.y;

        // ember sky: long diagonal oxblood streaks
        vec2 q = vec2(az * 2.2 + el * 2.4, (el * 2.6 - az * 1.1) * 5.5);
        q.x += uTime * 0.02 + uDrift;
        float n = fbm(q);
        float streak = smoothstep(0.6, 0.64, n);
        float core = smoothstep(0.7, 0.74, n);
        float pal = streak > 0.5 ? PAL_OXBLOOD : PAL_RED;
        float shade = mix(0.88, 0.62, streak) - core * 0.25;
        float hatch = 1.0;

        // burn front: ragged, starts high in the sky and works down
        float m = fbm(vec2(az * 3.1, el * 3.6) + 4.7) * 0.62 + (1.0 - smoothstep(-0.35, 1.0, el)) * 0.42;
        float front = 0.3 + 0.4 * uBurn - 0.42 * pow(1.0 - uBurn, 6.0);   // ignites fast, then eats steadily
        float d = m - front;                       // < 0: burned through
        if (d < 0.0) {
          // the dark: ink, with faint oxblood heat contours drifting slowly
          float h = fbm(vec2(az * 1.7, el * 2.3) * 1.3 + vec2(uDrift * 0.4, uTime * 0.01));
          float c = abs(fract(h * 7.0) - 0.5) * 2.0;           // 0 on a contour
          float line = 1.0 - smoothstep(0.0, 0.16, c);
          pal = PAL_OXBLOOD;
          shade = 0.05 + line * 0.24 + smoothstep(-0.06, 0.0, d) * 0.12;
        } else if (d < 0.022) {
          pal = d < 0.009 ? PAL_CIELO : PAL_ACCENT;          // HOT core, lit-ember rim
          shade = 1.0; hatch = 0.0;
        } else if (d < 0.07) {
          pal = PAL_OXBLOOD;                                   // char
          shade = mix(0.35, 0.6, (d - 0.022) / 0.048);
        }
        gl_FragColor = gbuf(shade, pal, uAng, hatch);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}
