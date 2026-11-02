// Ink pass: G-buffer (see gbuffer.js) -> engraved woodcut comic.
//
// The look, in order:
//  1. shade -> ink coverage through a tone curve (paper/colour stays clean in the light,
//     goes solid black in deep shadow).
//  2. Coverage drives the WIDTH of one family of parallel burin cuts: lines swell in the
//     dark, taper to nothing in the light, and when they merge the gaps become fine
//     paper/colour lines cut into the black (inverse engraving).
//  3. Lines meander together like wood grain, each line ends at its own point
//     (streaky tips), and they re-draw ("boil") at 8 fps.
//  4. Colour regions (red, accent, flavours) are flat saturated colour with ink only in
//     their shadows, and fine paper highlight lines where they're brightly lit.
//  5. Thin ink outlines on palette / tone / hatch-direction breaks.
//  6. The between-scene "ink rain" wipe (uWipe 0..2: 0 clear, 1 fully inked, 2 clear).
//
// Debug: ?wipe=0.5 pins the wipe (screenshots).
import * as THREE from 'three';
import { COLORS } from './gbuffer.js';

const c = (hex) => new THREE.Color(hex);
const LINE_CSS = 6.5; // hatch spacing in CSS px (x DPR on the GPU)

export class InkPass {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.lineCss = LINE_CSS;
    this.uniforms = {
      tG: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uLine: { value: LINE_CSS },      // hatch spacing in device px (CSS px x DPR, set in setSize)
      uPaper: { value: c(COLORS.paper) },
      uInk: { value: c(COLORS.ink) },
      uPalette: { value: [c(COLORS.paper), c(COLORS.red), c(COLORS.accent), c(COLORS.hot), c(COLORS.dim), c(COLORS.accent), c(COLORS.oxblood), c(COLORS.paper)] },
      uWipe: { value: 0 },
      uWipeColor: { value: 0 },        // 0 = ink rain, 1 = red rain
      uFlash: { value: 0 },
      uDark: { value: 0 },             // 0..1 fade to ground (hand-off into the site hero)            // 0..1 paper flash (impacts, light beams)
      uBoil: { value: 1 },             // 1 = hand-drawn line boil on
    };
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) this.uniforms.uBoil.value = 0;
    const pin = typeof location !== 'undefined' && new URLSearchParams(location.search).get('wipe');
    if (pin) this.uniforms.uWipe.value = parseFloat(pin);

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tG; uniform vec2 uRes; uniform float uDpr, uTime, uLine, uWipe, uWipeColor, uFlash, uBoil;
        uniform float uDark; uniform vec3 uPaper, uInk; uniform vec3 uPalette[8];
        varying vec2 vUv;

        float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float hash1(float n){ return fract(sin(n * 91.3458) * 47453.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }

        int palAt(vec4 g){ return int(floor(g.g * 8.0)); }

        // Engraving cut field for one family of parallel lines.
        // x = px distance from the nearest line centre, y = per-line tone jitter (-0.5..0.5)
        // so every line tapers out at its own point.
        vec2 cutField(vec2 px, float ang, float S, float boil, float seed){
          vec2 d = vec2(cos(ang), sin(ang));
          vec2 nrm = vec2(-d.y, d.x);
          float along = dot(px, d), across = dot(px, nrm);
          float sc = 1.0 / uDpr;                       // noise in CSS px so DPR 1 and 2 match
          // grain: neighbouring lines bend together, slowly
          across += (noise(vec2(along * 0.008 * sc, across * 0.005 * sc + seed)) - 0.5) * S * 1.1;
          // burin wobble: small, partly re-cut each boil frame. Continuous across lines (no seams).
          float k = across / S;
          float wob = mix(noise(vec2(along * 0.055 * sc, k * 0.8 + seed)),
                          noise(vec2(along * 0.055 * sc + boil * 13.1, k * 0.8 + 7.0 + seed)), 0.35 * uBoil);
          across += (wob - 0.5) * S * 0.3;
          k = across / S;
          float dist = abs(k - floor(k + 0.5)) * S;
          // streak jitter: each line fades out at its own point, some lines run longer than others
          float j = mix(noise(vec2(along * 0.016 * sc, k * 1.31 + seed)),
                        noise(vec2(along * 0.016 * sc + boil * 5.3, k * 1.31 + 19.0 + seed)), 0.25 * uBoil);
          j = j * 0.75 + noise(vec2(k * 2.7, seed + 0.5)) * 0.25;
          return vec2(dist, j - 0.5);
        }

        // ink 0..1 for coverage t (0 = no line, 1 = solid), anti-aliased over ~1 device px
        float cut(float dist, float t, float S){
          float aa = 0.6;
          float hw = mix(-aa, S * 0.5 + aa, clamp(t, 0.0, 1.0));
          return 1.0 - smoothstep(hw - aa, hw + aa, dist);
        }

        // shade -> ink coverage. Neutral stays clean paper longer than colour does.
        float toneNeutral(float s){ return 1.0 - smoothstep(0.07, 0.90, s); }
        float toneColour(float s){ return 1.0 - smoothstep(0.08, 0.95, s); }

        void main(){
          vec2 px = vUv * uRes;
          vec4 g = texture2D(tG, vUv);
          int pal = palAt(g);
          float shade = g.r, ang = g.b * 3.14159265, hatchAmt = g.a;
          float S = uLine;
          float boil = floor(uTime * 8.0) * uBoil;
          bool colour = pal != 0 && pal != 7;

          // ---- outlines: palette, tone or hatch-direction breaks, 8 taps at ~1 CSS px
          float edge = 0.0;
          vec2 o = uDpr / uRes;
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.7853982;
            vec4 n = texture2D(tG, vUv + vec2(cos(a), sin(a)) * o);
            int pn = palAt(n);
            float e = (pn != pal && min(pn, pal) != 7) ? 1.0 : 0.0;
            e = max(e, smoothstep(0.28, 0.5, abs(n.r - shade)));
            float da = abs(n.b - g.b); da = min(da, 1.0 - da);
            e = max(e, step(0.12, da) * step(0.5, min(n.a, hatchAmt)));
            edge += e;
          }
          edge = smoothstep(0.5, 2.5, edge);

          // ---- engraving
          vec3 base = pal == 0 ? uPaper : uPalette[pal];
          float ink = 0.0;
          float hi = 0.0;                    // paper highlight cuts on colour
          if (pal != 7) {
            float s = mix(step(0.22, shade), shade, hatchAmt);   // hatch 0 = hard threshold
            float t = colour ? toneColour(s) : toneNeutral(s);
            if (hatchAmt > 0.01) {
              vec2 f = cutField(px, ang, S, boil, 0.0);
              // per-line jitter only bites in the transition: solids stay solid, light stays clean
              float tj = t + f.y * 1.6 * t * (1.0 - t);
              ink = cut(f.x, tj, S);
              // neutral deep shadow: a second, finer cross cut before it closes to solid
              if (!colour && t > 0.55) {
                vec2 f2 = cutField(px, ang + 0.62, S * 1.15, boil, 11.0);
                ink = max(ink, cut(f2.x, (t - 0.55) * 1.4 + f2.y * 0.2, S * 1.15));
              }
              if (colour && s > 0.84) {
                // fine paper highlight cuts between the ink lines where colour is brightly lit
                float hl = smoothstep(0.84, 0.97, s) * mix(0.26, 0.12, smoothstep(0.975, 1.0, s));  // flat full-bright fills stay mostly flat
                hi = cut(abs(S * 0.5 - f.x), hl + f.y * 0.25 * hl, S) * (1.0 - ink);
              }
            } else {
              ink = t > 0.5 ? 1.0 : 0.0;
            }
          }
          ink = max(ink, edge);

          vec3 col = mix(base, uInk, ink);
          col = mix(col, uPaper, hi);

          // paper: barely-there tooth, never on colour
          if (!colour) col *= 1.0 - (noise(px / uDpr * 0.7) * 0.018 + noise(px / uDpr * 0.05) * 0.012) * (1.0 - ink);

          col = mix(col, uPaper, uFlash);

          // ---- ink rain wipe
          // 0..1: vertical streaks grow up from the bottom in a ragged tree-line front until black.
          // 1..2: the black lifts from the bottom as red streaks rising into it, revealing the new scene.
          if (uWipe > 0.001 && uWipe < 1.999) {
            float Sw = S * 1.5;
            vec2 fw = cutField(px, 1.5707963, Sw, floor(uTime * 12.0) * uBoil, 31.0);
            float x = vUv.x * uRes.x / uRes.y;
            float sil = noise(vec2(x * 3.0, 1.0)) * 0.6 + noise(vec2(x * 9.0, 4.0)) * 0.3 + noise(vec2(x * 23.0, 9.0)) * 0.1;
            float y = vUv.y;
            vec3 rain = uWipeColor > 0.5 ? uPalette[1] : uInk;
            if (uWipe <= 1.0) {
              float w = uWipe;
              float front = mix(-0.45, 1.85, w) + (sil - 0.5) * 0.55 + fw.y * 0.18;
              float t = 1.0 - smoothstep(front - 0.42, front + 0.02, y);      // below the front: solid
              // a few drips running down from the top ahead of the front
              float drip = step(0.86, hash1(floor(px.x / Sw + 0.5) + 3.0)) * (1.0 - smoothstep(0.0, 0.5 + w, 1.0 - y)) * smoothstep(0.05, 0.35, w);
              t = max(t, drip * 0.55);
              col = mix(col, rain, cut(fw.x, t, Sw));
            } else {
              float u = uWipe - 1.0;
              float front = mix(-0.5, 1.55, u) + (sil - 0.5) * 0.4 + fw.y * 0.22;
              float t = smoothstep(front - 0.02, front + 0.4, y);           // above the front: still black
              // the thin gaps that rise into the black are red
              vec3 gap = mix(col, uPalette[1], smoothstep(0.15, 0.6, t) * (1.0 - uWipeColor));
              col = mix(gap, rain, cut(fw.x, t, Sw));
            }
          }
          col = mix(col, uInk, uDark);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setAccent(hex) { this.uniforms.uPalette.value[2].set(hex); }

  setSize(w, h, dpr) {
    this.uniforms.uRes.value.set(Math.floor(w * dpr), Math.floor(h * dpr));
    this.uniforms.uDpr.value = dpr;
    this.lineCss = this.lineCss ?? LINE_CSS;
    this.uniforms.uLine.value = this.lineCss * dpr;
  }

  render(renderer, texture, time) {
    this.uniforms.tG.value = texture;
    this.uniforms.uTime.value = time;
    renderer.render(this.scene, this.camera);
  }
}
