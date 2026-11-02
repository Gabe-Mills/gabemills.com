// The G-buffer contract. Every mesh in every scene writes ONE vec4 per pixel
// into the engine's render target, and the ink pass turns it into engraving:
//
//   r = shade      0 = black ink, 1 = lit (paper / full colour)
//   g = palette    (index + 0.5) / 8, see PAL below. Read back with floor(g * 8).
//   b = hatch dir  angle / PI (0..1). Lines run along this angle in screen space.
//   a = hatch amt  0 = flat (no engraving lines), 1 = full hatching
//
// Custom ShaderMaterials must end with `gl_FragColor = gbuf(shade, PAL_X, angle, hatch);`
// using the GBUF_GLSL chunk. Never write real colours: the ink pass owns colour.
import * as THREE from 'three';

export const PAL = {
  NEUTRAL: 0, // paper / ink
  RED: 1,     // hero red
  ACCENT: 2,  // the flavour the visitor picked (uAccent)
  CIELO: 3,   // fixed flavour colours, for the choose beat
  PRATO: 4,
  SOLE: 5,
  OXBLOOD: 6,
  PAPER_FLAT: 7, // pure paper, never hatched (panel borders, caption plates)
  // gabemills.com names for the same slots
  EMBER: 1,   // #E4692C, the woodcut "red"
  GLOW: 2,    // #FFB15E lit ember
  HOT: 3,     // #FFC46B flame highlight
  DIM: 4,     // #9C8D86 warm grey
};

export const COLORS = {
  // gabemills.com DESIGN.md: ground #080605 is the ink, ink #F3EEE8 is the paper,
  // ember #E4692C plays the woodcut red, lit ember #FFB15E is the glow accent.
  paper: '#F1E9DE',
  ink: '#080605',
  red: '#E4692C',
  oxblood: '#5E2312',
  accent: '#FFB15E',
  hot: '#FFC46B',
  dim: '#9C8D86',
};

// The intro has no visitor choice; ACCENT is always lit ember. Kept as one entry so
// scenes that read ctx.flavour keep working.
export const FLAVOURS = {
  ember: { key: 'ember', name: 'EMBER', pal: PAL.ACCENT, color: '#FFB15E', notes: '' },
};

export const GBUF_GLSL = /* glsl */ `
#define PAL_NEUTRAL 0.0
#define PAL_RED 1.0
#define PAL_ACCENT 2.0
#define PAL_CIELO 3.0
#define PAL_PRATO 4.0
#define PAL_SOLE 5.0
#define PAL_OXBLOOD 6.0
#define PAL_PAPER_FLAT 7.0
vec4 gbuf(float shade, float pal, float angle, float hatch) {
  return vec4(clamp(shade, 0.0, 1.0), (pal + 0.5) / 8.0, fract(angle / 3.14159265), clamp(hatch, 0.0, 1.0));
}
`;

const LIGHT = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();

/**
 * Lit solid. Shade = tone * lambert (+ rim, + emissive). Hatch angle follows the
 * surface (screen-space normal) unless `angle` is given (radians, e.g. Math.PI/2
 * for the vertical striations on columns).
 */
export function inkMaterial({ tone = 0.85, pal = PAL.NEUTRAL, angle = -1, hatch = 1, emissive = 0, rim = 0.15, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    side,
    uniforms: {
      uTone: { value: tone },
      uPal: { value: pal },
      uAngle: { value: angle },
      uHatch: { value: hatch },
      uEmissive: { value: emissive },
      uRim: { value: rim },
      uLight: { value: LIGHT.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vVN; varying vec3 vView;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vVN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uTone, uPal, uAngle, uHatch, uEmissive, uRim; uniform vec3 uLight;
      varying vec3 vN; varying vec3 vVN; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float lam = max(dot(n, uLight), 0.0);
        float rim = pow(1.0 - max(dot(normalize(vVN), normalize(vView)), 0.0), 3.0) * uRim;
        float shade = uTone * (0.18 + 0.82 * lam) + rim + uEmissive;
        float ang = uAngle;
        if (uAngle < 0.0) {
          // Lines follow the form: they run along the silhouette contour (perpendicular to the
          // screen-space normal). Where the surface faces the camera that direction is
          // undefined, so blend (in doubled-angle space: lines are pi-periodic) toward a
          // stable fallback: horizontal cuts on floors/ceilings, vertical on walls.
          vec3 vn = normalize(vVN);
          float l = length(vn.xy);
          float contour = atan(vn.y, vn.x) + 1.5707963;
          float fallback = abs(n.y) > 0.7 ? 0.0 : 1.5707963;
          float k = smoothstep(0.12, 0.45, l);
          vec2 d2 = vec2(cos(2.0 * contour), sin(2.0 * contour)) * k + vec2(cos(2.0 * fallback), sin(2.0 * fallback)) * (1.0 - k);
          ang = 0.5 * atan(d2.y, d2.x);
        }
        gl_FragColor = gbuf(shade, uPal, ang, uHatch);
      }`,
  });
}

/** Unlit flat fill: backgrounds, skies, glows. */
export function flatMaterial({ shade = 1, pal = PAL.NEUTRAL, angle = 0, hatch = 0, transparent = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uShade: { value: shade }, uPal: { value: pal }, uAngle: { value: angle }, uHatch: { value: hatch } },
    vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `${GBUF_GLSL}
      uniform float uShade,uPal,uAngle,uHatch;
      void main(){ gl_FragColor = gbuf(uShade,uPal,uAngle,uHatch); }`,
  });
}

/**
 * Illustrated card (PNG with alpha). Ink art on transparent background:
 * luminance -> shade; pixels that are clearly red -> PAL_RED (or `redAs`).
 * `force` paints the whole card one palette entry (silhouettes).
 * uAccentMix 0..1 blends red regions to ACCENT from the bottom up (robe soak).
 */
export function cardMaterial(texture, { hatch = 0.25, angle = Math.PI / 2, redAs = PAL.RED, force = -1, alphaTest = 0.5 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: false,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: texture },
      uHatch: { value: hatch },
      uAngle: { value: angle },
      uRedAs: { value: redAs },
      uForce: { value: force },
      uAlphaTest: { value: alphaTest },
      uAccentMix: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform sampler2D uMap; uniform float uHatch, uAngle, uRedAs, uForce, uAlphaTest, uAccentMix, uOpacity;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec4 t = texture2D(uMap, vUv);
        // dithered opacity so cards can fade without blending
        if (t.a * uOpacity < max(uAlphaTest, hash(gl_FragCoord.xy) * step(uOpacity, 0.999))) discard;
        float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
        bool isRed = t.r > 0.45 && t.r > t.g * 1.8 && t.r > t.b * 1.8;
        bool isYellow = t.r > 0.6 && t.g > 0.5 && t.b < 0.35;
        float pal = PAL_NEUTRAL; float shade = lum;
        if (isRed) { pal = uRedAs; shade = clamp(t.r * 1.15, 0.0, 1.0); }
        if (isYellow) { pal = PAL_ACCENT; shade = clamp(lum * 1.1, 0.0, 1.0); }
        if (isRed && vUv.y < uAccentMix) pal = PAL_ACCENT;
        if (uForce >= 0.0) pal = uForce;
        gl_FragColor = gbuf(shade, pal, uAngle, uHatch);
      }`,
  });
}
