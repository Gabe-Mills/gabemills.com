// Custom G-buffer materials for the Gcoolers beat. Each ends in gbuf(shade, pal, angle, hatch):
// the ink pass owns colour. No blending anywhere; shapes are cut with discard.
import { bladeSweep } from './gcoolers-parts.js';

const HASH = /* glsl */ `float h11(float n){ return fract(sin(n * 91.3458) * 47453.5453); }`;

/**
 * Paper fins with stamped grooves running along the airflow (world z). The grooves converge in
 * perspective, so the channel reads as a deep corridor; dark cuts on the lit faces, paper cuts on
 * the shadowed ones.
 */
export function finMaterial(THREE, GBUF_GLSL) {
  return new THREE.ShaderMaterial({
    uniforms: { uLight: { value: new THREE.Vector3(-0.45, 0.8, 0.55).normalize() } },
    vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform vec3 uLight; varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float lam = max(dot(n, uLight), 0.0);
        float shade = 0.95 * (0.2 + 0.8 * lam) + 0.1;
        float ang = 1.5707963;
        if (abs(n.x) > 0.5) {
          float gy = abs(fract(vW.y * 9.0) - 0.5);
          // a narrow groove plus a hairline shoulder beside it
          bool groove = gy > 0.455;
          bool shoulder = gy > 0.40 && gy < 0.415;
          if (groove || shoulder) shade = shade > 0.5 ? 0.06 : 0.9;
          // the leading and trailing edges are folded: a darker band near each end
          float edge = min(vW.z - ${(-1.0).toFixed(1)}, ${(1.0).toFixed(1)} - vW.z);
          if (edge < 0.06 && !groove) shade *= 0.55;
        } else {
          ang = 0.0;
        }
        gl_FragColor = gbuf(shade, PAL_NEUTRAL, ang, 1.0);
      }`,
  });
}

/** Logic board: trace texture, faded to ink at the edges, with ember isotherm rings round the chip. */
export function boardMaterial(THREE, GBUF_GLSL, map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uHeat: { value: 1 }, uPhase: { value: 0 }, uDim: { value: 1 } },
    vertexShader: /* glsl */ `varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform sampler2D uMap; uniform float uHeat, uPhase, uDim; varying vec3 vW;
      void main(){
        vec2 w = vW.xz - vec2(0.0, 0.35);
        float d = length(w * vec2(1.0, 1.08));
        float fade = 1.0 - smoothstep(3.6, 7.5, d);
        float tr = texture2D(uMap, vW.xz / 3.2).r;
        float shade = mix(0.13, 0.66, tr) * fade;
        float pal = PAL_NEUTRAL;
        float hatch = 0.9;
        // isotherms: contour rings that crawl outward with the heat and shrink as it cools
        float R = 2.1 + 3.4 * uHeat;
        float ring = abs(fract(d * 2.6 - uPhase) - 0.5);
        float wR = 0.07 * (1.0 - smoothstep(R - 1.6, R, d));
        if (d > 1.95 && d < R && ring < wR) { pal = PAL_RED; shade = 0.9; hatch = 0.0; }
        gl_FragColor = gbuf(shade * uDim, pal, 0.0, hatch);
      }`,
  });
}

/** Heat halo: a camera-facing disc of concentric engraved light behind the set. EMBER when hot, GLOW when cool. */
export function haloMaterial(THREE, GBUF_GLSL) {
  return new THREE.ShaderMaterial({
    uniforms: { uAmt: { value: 1 }, uPal: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform float uAmt, uPal; varying vec2 vP;
      void main(){
        float d = length(vP) / 8.0;
        float s = uAmt * (1.0 - smoothstep(0.05, 0.95, d));
        if (s < 0.05) discard;
        gl_FragColor = gbuf(s * 0.95, uPal, atan(vP.y, vP.x) + 1.5707963, 1.0);
      }`,
  });
}

/** Heat shimmer: wavy ember strands rising off the fins; height and wobble scale with heat. */
export function shimmerMaterial(THREE, GBUF_GLSL) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uHeat: { value: 1 }, uPhase: { value: 0 } },
    vertexShader: /* glsl */ `attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      uniform float uHeat, uPhase; varying vec2 vUv; varying float vSeed;
      void main(){
        float h = vUv.y;
        float lim = 0.08 + 0.92 * uHeat;
        if (h > lim || uHeat < 0.03) discard;
        float amp = (0.04 + 0.16 * h) * (0.3 + 0.7 * uHeat);
        float x = vUv.x + sin(h * 8.0 - uPhase + vSeed * 6.0) * amp + sin(h * 21.0 - uPhase * 1.7 + vSeed * 3.0) * 0.025 * uHeat;
        float l = abs(fract(x * 3.0 + vSeed) - 0.5);
        float w = 0.085 * (1.0 - h / lim) * smoothstep(0.0, 0.06, h);
        if (l > w || vUv.x < 0.06 || vUv.x > 0.94) discard;
        gl_FragColor = gbuf(0.92, PAL_RED, 1.5707963, 0.0);
      }`,
  });
}

/** Airflow streamlines: dashes travel along each tube (uv.x) with the fan. Hot dashes ride EMBER. */
export function streamMaterial(THREE, GBUF_GLSL) {
  return new THREE.ShaderMaterial({
    uniforms: { uFlow: { value: 0 }, uDuty: { value: 0.5 }, uHeat: { value: 1 } },
    vertexShader: /* glsl */ `attribute float aSeed; varying vec2 vUv; varying float vSeed;
      void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      ${HASH}
      uniform float uFlow, uDuty, uHeat; varying vec2 vUv; varying float vSeed;
      void main(){
        float u = vUv.x;
        float k = u * 15.0 - uFlow + vSeed * 7.0;
        float dash = floor(k);
        float e = smoothstep(0.0, 0.16, u) * (1.0 - smoothstep(0.78, 1.0, u));
        if (fract(k) > uDuty * e) discard;
        // after the fins the air carries the heat away
        float pal = (u > 0.52 && h11(dash + vSeed * 13.0) < uHeat * 1.1) ? PAL_RED : PAL_NEUTRAL;
        gl_FragColor = gbuf(0.97, pal, 0.0, 0.0);
      }`,
  });
}

/** Motion-blur disc in front of the blades: engraved arcs trailing each blade, length ~ fan speed. */
export function blurMaterial(THREE, GBUF_GLSL, blades) {
  const sweepA = bladeSweep(1) - bladeSweep(0); // slope of the linear sweep
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTheta: { value: 0 }, uOmega: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      ${HASH}
      uniform float uTheta, uOmega; varying vec2 vP;
      void main(){
        if (uOmega < 0.04) discard;
        float r = length(vP);
        float a = atan(vP.y, vP.x);
        float sector = 6.2831853 / ${blades.toFixed(1)};
        float span = (0.6 - 0.22 * (r - 0.3) / 0.53) / sector;
        float rel = (a + uTheta - ${sweepA.toFixed(4)} * (r - 0.3)) / sector;
        float local = fract(rel);
        float rk = r * 30.0;
        float ri = floor(rk);
        if (fract(rk) > 0.42) discard;
        float j = h11(ri);
        float len = uOmega * (0.35 + 0.35 * j);
        float s = local - span;
        if (s < 0.0 || s > len) discard;
        gl_FragColor = gbuf(0.95, PAL_NEUTRAL, 0.0, 0.0);
      }`,
  });
}
