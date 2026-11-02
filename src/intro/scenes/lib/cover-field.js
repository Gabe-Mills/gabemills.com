// The cover's heat field: contour isolines that bunch and bend toward a hot centre (the
// original site's "Molten Glass" hero, DESIGN.md), engraved. One full-frame plane, one
// ShaderMaterial writing the G-buffer:
//   - between the rings: oxblood bands hatched along the contours (hotter = cleaner), ink outside
//   - the rings themselves: flat ember / lit-ember cuts, thicker and hotter toward the centre
//   - at the end the field parts down the middle, the cut edges glowing as they slide apart
// Uniforms are set from progress(p) (pure) plus uFlow/uTime drift from update() (ambient).
import * as THREE from 'three';

export function makeHeatField(ctx, { width = 70, height = 46 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uHeat: { value: 0.2 },       // 0..1 overall temperature
      uBloom: { value: 1.2 },      // how far the heat reaches past the pool (world units)
      uPool: { value: 1.0 },       // radius of the calm molten pool the type sits in
      uR: { value: 4.2 },          // ring layout radius
      uN: { value: 12.0 },         // rings within uR of the pool
      uFlow: { value: 0 },         // rings drift inward as this grows
      uPart: { value: 0 },         // half-width of the parting gap (world units)
      uSquash: { value: 0.7 },     // x scale of the rings (<1 = wider than tall)
      uCentre: { value: new THREE.Vector2(0, 0) },
      uDpr: { value: 1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vQ;
      void main(){ vQ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${ctx.GBUF_GLSL}
      uniform float uHeat, uBloom, uR, uN, uFlow, uPart, uSquash, uDpr, uTime, uPool;
      uniform vec2 uCentre;
      varying vec2 vQ;
      #define EXPO 0.62
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float ringR(float lraw){ return uPool + uR * pow(max(lraw, 0.0) / uN, 1.0 / EXPO); }
      float heatAt(float r){ float x = max(r - uPool, 0.0); return uHeat * exp(-(x * x) / (uBloom * uBloom)); }

      void main(){
        // parting: each half slides away from x = 0 by uPart
        float side = vQ.x < 0.0 ? -1.0 : 1.0;
        vec2 q = vQ - vec2(side * uPart, 0.0);
        vec2 d = q - uCentre;
        d.x *= uSquash;
        // slow domain warp so the rings bend like heat shimmer; none inside the pool
        vec2 w = vec2(vnoise(q * 0.3 + vec2(uTime * 0.025, 3.1)), vnoise(q * 0.3 + vec2(17.7, -uTime * 0.025))) - 0.5;
        float r0 = length(d);
        d += w * 0.8 * smoothstep(uPool, uPool + 1.6, r0);
        float r = length(d);
        // rings bunch toward the pool's rim and spread out into the dark
        float L = uN * pow(max(r - uPool, 0.0) / uR, EXPO) + uFlow;

        // all derivatives before any branching
        float fw = max(fwidth(L), 1e-5);
        float fwr = max(fwidth(r), 1e-5);
        vec2 g = vec2(dFdx(L), dFdy(L));
        float fwx = max(fwidth(vQ.x), 1e-5);

        // ---- the nearest ring line
        float n = floor(L + 0.5);
        float distPx = abs(L - n) / fw / uDpr;                 // CSS px to the line centre
        float lrawN = n - uFlow;
        float Hn = heatAt(ringR(lrawN));
        // visible core grows with heat; +2 px is what the ink pass's outlines eat.
        // Rings fade in as they leave the rim (lrawN small) so the flow never pops.
        float core = (0.6 + 2.0 * Hn) * smoothstep(0.04, 0.2, Hn) * smoothstep(0.15, 0.9, lrawN);
        float lineW = core > 0.35 ? core + 2.0 : 0.0;
        bool onLine = distPx < lineW * 0.5;

        // ---- the band this pixel sits in
        float k = floor(L);
        float Hb = heatAt(ringR(k + 0.5 - uFlow));
        float odd = mod(k, 2.0);
        // hatch along the contour: perpendicular to the screen-space gradient
        float ang = atan(g.y, g.x) + 1.5707963;
        float rimPx = (r - uPool) / fwr / uDpr;                // CSS px outside the pool's rim

        vec4 outv;
        if (rimPx < 0.0) {
          // the pool: calm molten oxblood under the type, cut with fine level lines
          outv = gbuf(0.62 + 0.18 * uHeat, PAL_OXBLOOD, 0.0, 1.0);
        } else if (rimPx < 2.0 + 3.0 * uHeat) {
          outv = gbuf(1.0, uHeat > 0.45 ? PAL_ACCENT : (uHeat > 0.2 ? PAL_RED : PAL_OXBLOOD), 0.0, 0.0);
        } else if (onLine) {
          float pal = Hn > 0.6 ? PAL_ACCENT : (Hn > 0.22 ? PAL_RED : PAL_OXBLOOD);
          outv = gbuf(1.0, pal, 0.0, 0.0);
        } else if (Hb > 0.16) {
          float shade = 0.08 + 0.72 * Hb + 0.06 * odd;
          outv = gbuf(shade, PAL_OXBLOOD, ang, 1.0);
        } else {
          outv = gbuf(0.02, PAL_NEUTRAL, 0.0, 0.0);
        }

        // the parting gap: solid ink, its cut edges lit while the field is still warm
        float edgePx = (abs(vQ.x) - uPart) / fwx / uDpr;
        if (uPart > 0.0) {
          if (edgePx < 0.0) outv = gbuf(0.0, PAL_NEUTRAL, 0.0, 0.0);
          else if (edgePx < 4.0 && uHeat > 0.12) outv = gbuf(1.0, PAL_ACCENT, 0.0, 0.0);
        }
        gl_FragColor = outv;
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    u: mat.uniforms,
    dispose() { mesh.geometry.dispose(); mat.dispose(); },
  };
}
