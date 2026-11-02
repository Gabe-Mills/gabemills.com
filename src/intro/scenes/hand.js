// Beat "line": "Every build starts with one line."
// Looking down at an ember woodgrain table. An engraved hand reaches in from the right
// edge, touches down and draws ONE continuous ink line: a long, confident S. The line is
// black ink with a wet ember-glow edge, revealed by uDraw on a precomputed ribbon, so
// scrolling back erases it exactly. A stable-fluids sim (lib/fluid.js) adds ambient wet
// ink around the stroke: it is splatted at the fingertip by scroll speed and never rewinds.
//   p 0    -> 0.1   establish: the hand hovers over a drop of ink, then touches down
//   p 0.1  -> 0.8   the stroke (the camera pans with it so the whole S lands in frame)
//   p 0.8  -> 1     the hand lifts away, the ink floods and the camera dives into the line
// On portrait screens the stroke runs down the screen instead of across it and the arm
// comes in from the right across it, so the hand and the line both read at 390x844.
// Everything placed in progress() is a pure function of p (and the aspect).
import { InkFluid } from './lib/fluid.js';

const DOM_W = 13;     // world size of the sim domain along the stroke
const DOM_H = 8.125;  // across the stroke (same 1.6 aspect as the sim grid)
const N = 720;        // ribbon samples
const WMAX = 0.62;    // ribbon half-width in world units (the visible width is cut in the shader)
const FOV = 38;
const T = Math.tan((FOV * Math.PI) / 360);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => smooth(clamp01((p - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;
// brush pressure along the stroke (shared with the ribbon shader, keep in sync)
const pressure = (s) => 0.55 + 0.25 * Math.sin(s * 9.0 + 1.0) + 0.1 * Math.sin(s * 23.0 + 2.0);

// The S, in stroke space: u runs along the stroke, v across it (+v = toward the viewer
// on desktop). One gesture: a lead-in hook, a deep dip, the long rise, and a settle.
const PATH = [
  [-3.5, 0.15], [-2.95, 0.75], [-2.15, 0.95], [-1.25, 0.35], [-0.45, -0.55],
  [0.35, -1.05], [1.25, -0.95], [2.05, -0.2], [2.8, 0.55], [3.45, 0.78],
]
const DIVE_S = 0.5;  // where the camera dives (the long straight-ish run, mid-screen at p 0.8)

export function create(ctx) {
  const { THREE, engine, tex, cardPlane, cardMaterial, GBUF_GLSL } = ctx;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, engine.aspect || 1.6, 0.05, 80);

  // ---------------------------------------------------------------- the path (arc-length samples)
  const curve = new THREE.CatmullRomCurve3(PATH.map(([u, v]) => new THREE.Vector3(u, 0, v)), false, 'centripetal');
  const pts = curve.getSpacedPoints(N);
  const LEN = curve.getLength();
  const PU = new Float32Array(N + 1), PV = new Float32Array(N + 1);
  const TU = new Float32Array(N + 1), TV = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { PU[i] = pts[i].x; PV[i] = pts[i].z; }
  for (let i = 0; i <= N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N, i + 1);
    const du = PU[b] - PU[a], dv = PV[b] - PV[a], l = Math.hypot(du, dv) || 1;
    TU[i] = du / l; TV[i] = dv / l;
  }
  const U0 = PU[0], U1 = PU[N];
  // sample the path at s (0..1) into out = {u, v, tu, tv}
  const at = (s, out) => {
    const f = clamp01(s) * N, i = Math.min(N - 1, Math.floor(f)), k = f - i;
    out.u = lerp(PU[i], PU[i + 1], k); out.v = lerp(PV[i], PV[i + 1], k);
    const tu = lerp(TU[i], TU[i + 1], k), tv = lerp(TV[i], TV[i + 1], k), l = Math.hypot(tu, tv) || 1;
    out.tu = tu / l; out.tv = tv / l;
    return out;
  };

  // ---------------------------------------------------------------- fluid (ambient wet ink)
  const fluid = new InkFluid(engine.renderer, { simW: 128, simH: 80, dyeW: 256, dyeH: 160, curl: 24, velocityDissipation: 1.2, dyeDissipation: 0.1 });

  // ---------------------------------------------------------------- table
  const tableMat = new THREE.ShaderMaterial({
    uniforms: {
      uDye: { value: null },
      uVel: { value: null },
      uDom: { value: new THREE.Vector2(DOM_W, DOM_H) },
      uFrame: { value: new THREE.Vector2(1, 0) },         // cos a, sin a of the stroke frame
      uFlood: { value: new THREE.Vector4(0, 0, 0, 0) },   // x,z centre, radius, strength
      uTime: { value: 0 },
      uHandInv: { value: new THREE.Matrix4() },           // world -> hand card local
      uHandH: { value: 0.5 },
      uHandOn: { value: 1 },
      uMap: { value: null },
      uLightS: { value: new THREE.Vector3(-0.5, 1.0, -0.62).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform sampler2D uDye, uVel, uMap; uniform vec2 uDom, uFrame; uniform vec4 uFlood; uniform float uTime;
      uniform mat4 uHandInv; uniform float uHandH, uHandOn; uniform vec3 uLightS;
      varying vec3 vW;
      float hash1(float n){ return fract(sin(n * 91.345) * 47453.5453); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

      float grainX(vec2 p){ return p.x + 0.35 * sin(p.y * 0.42 + p.x * 0.6) + 1.1 * (fbm(vec2(p.x * 0.22, p.y * 0.07)) - 0.5); }

      float handA(vec2 uv){
        float ins = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        return texture2D(uMap, clamp(uv, 0.0, 1.0)).a * ins;
      }

      void main() {
        // sim space follows the stroke frame (u along, v across)
        vec2 lw = vec2(vW.x * uFrame.x + vW.z * uFrame.y, -vW.x * uFrame.y + vW.z * uFrame.x);
        vec2 suv = vec2(lw.x / uDom.x + 0.5, -lw.y / uDom.y + 0.5);
        float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
        float d = texture2D(uDye, suv).r * inside;
        vec2 vel = texture2D(uVel, suv).xy * inside;
        vec2 tx = vec2(1.0 / 256.0, 1.0 / 160.0) * 1.5;
        vec2 gS = vec2(texture2D(uDye, suv + vec2(tx.x, 0.0)).r - texture2D(uDye, suv - vec2(tx.x, 0.0)).r,
                       texture2D(uDye, suv + vec2(0.0, tx.y)).r - texture2D(uDye, suv - vec2(0.0, tx.y)).r) * inside;
        // sim axes -> screen axes (screen up = world -z)
        gS = gS.x * vec2(uFrame.x, -uFrame.y) + gS.y * vec2(uFrame.y, uFrame.x);

        // ---- wood grain (smeared a touch by the moving ink) ----
        vec2 p = vW.xz - vec2(vel.x, -vel.y) * 0.003;
        p -= vec2(d * 0.16, d * 0.09);
        float gx = grainX(p);
        float sp = 0.72;
        float g = gx / sp;
        float cell = floor(g);
        float c = 0.5 + (hash1(cell) - 0.5) * 0.55;
        float dist = abs(fract(g) - c) * sp;
        float th = 0.012 + 0.05 * pow(noise(vec2(cell * 3.1, p.y * 0.32)), 1.6);
        th *= smoothstep(0.22, 0.42, noise(vec2(cell * 7.3, p.y * 0.55 + 4.0)));
        float dist2 = abs(fract(g) - c - 0.18 * sin(p.y * 0.9 + cell)) * sp;
        float th2 = 0.018 * smoothstep(0.62, 0.78, noise(vec2(cell * 5.7, p.y * 0.4)));
        float aa = fwidth(gx) * 0.75;
        float grain = max(1.0 - smoothstep(th - aa, th + aa, dist), 1.0 - smoothstep(th2 - aa, th2 + aa, dist2));

        vec2 G = vec2(grainX(p + vec2(0.05, 0.0)) - gx, grainX(p + vec2(0.0, 0.05)) - gx);
        float woodAng = atan(-G.y, G.x) + 1.5707963;
        float woodShade = 0.8 + 0.1 * (fbm(vec2(p.x * 0.6, p.y * 0.15)) - 0.5);
        woodShade -= 0.22 * smoothstep(th * 4.0 + 0.04, th, dist);

        // ---- the hand's cast shadow: the card projected along the light onto the table.
        // Engraved: it only lowers the shade, so the grain hatching thickens under it.
        if (uHandOn > 0.0) {
          vec3 Q = vW + uLightS * (uHandH / uLightS.y);
          vec2 huv = (uHandInv * vec4(Q, 1.0)).xy + 0.5;
          float r = 0.004 + 0.012 * uHandH;
          float sh = handA(huv) * 0.4 + 0.15 * (handA(huv + vec2(r, 0.0)) + handA(huv - vec2(r, 0.0)) + handA(huv + vec2(0.0, r * 2.0)) + handA(huv - vec2(0.0, r * 2.0)));
          woodShade -= 0.36 * sh * uHandOn;
        }

        float shade = mix(woodShade, 0.02, grain);
        float pal = PAL_RED;
        float ang = woodAng;
        float hatch = grain > 0.5 ? 0.0 : 1.0;

        // ---- wet ink (fluid) + the flood ----
        float fl = 0.0;
        if (uFlood.w > 0.0) {
          float r = length(vW.xz - uFlood.xy);
          float edge = uFlood.z * (0.82 + 0.3 * fbm(vW.xz * 0.9 + uTime * 0.3));
          fl = uFlood.w * smoothstep(edge, edge * 0.25, r) * (0.8 + 0.4 * fbm(vW.xz * 1.7 - uTime * 0.5));
        }
        float dE = max(d, fl);
        vec2 gd = fl > d ? vec2(dFdx(dE), dFdy(dE)) : gS;
        float gl = length(gd) + 1e-5;
        float fw = fwidth(dE) + 1e-4;
        const float T0 = 0.14;
        const float T1 = 0.3;
        if (dE > T0) {
          // the same ink as the line: a wet ember-glow rim, thin oxblood stain, black body
          vec2 n = gd / gl;
          float swirl = atan(gd.y, gd.x) + 1.5707963;     // lines follow the flow
          if (dE < T0 + 0.045) { pal = PAL_ACCENT; shade = 0.92; hatch = 0.0; }
          else if (dE < T1) { pal = PAL_OXBLOOD; shade = mix(0.78, 0.45, smoothstep(T0, T1, dE)); hatch = 1.0; ang = swirl; }
          else {
            pal = PAL_NEUTRAL; shade = 0.03; hatch = 0.0;
            // wet highlight on the side of the pool facing the light
            float lit = dot(n, normalize(vec2(-0.6, 0.8)));
            float band = smoothstep(T1, T1 + 0.05, dE) * smoothstep(T1 + 0.3, T1 + 0.1, dE);
            if (lit * band > 0.6 && gl > 0.015) { shade = 0.55; hatch = 1.0; ang = swirl; }
          }
          if (fl > d && dE > T1) {
            // the flood: a whirlpool of oxblood engraving rings around the dive point
            vec2 rv = vW.xz - uFlood.xy;
            pal = PAL_OXBLOOD; hatch = 1.0;
            ang = atan(-rv.y, rv.x) + 1.5707963 + 0.35 * sin(length(rv) * 3.0 - uTime * 4.0);
            shade = mix(0.8, 0.42, smoothstep(T1, 1.0, fl));
          }
        }
        float cont = 1.0 - smoothstep(0.9, 1.6, abs(dE - T0) / fw);
        if (cont > 0.5 && dE > T0 * 0.5) { shade = 0.0; hatch = 0.0; pal = PAL_NEUTRAL; }

        gl_FragColor = gbuf(shade, pal, ang, hatch);
      }`,
  });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), tableMat);
  table.rotation.x = -Math.PI / 2;
  scene.add(table);

  // ---------------------------------------------------------------- the line (ribbon)
  // Built once in stroke space; `frame` rotates it to the screen's stroke direction.
  const frame = new THREE.Group();
  scene.add(frame);
  const pos = new Float32Array((N + 1) * 2 * 3);
  const aS = new Float32Array((N + 1) * 2);
  const aSide = new Float32Array((N + 1) * 2);
  const aTan = new Float32Array((N + 1) * 2 * 2);
  for (let i = 0; i <= N; i++) {
    const nu = -TV[i], nv = TU[i]; // left normal
    for (let k = 0; k < 2; k++) {
      const side = k === 0 ? -1 : 1, j = i * 2 + k;
      pos[j * 3] = PU[i] + nu * side * WMAX;
      pos[j * 3 + 1] = 0.004;
      pos[j * 3 + 2] = PV[i] + nv * side * WMAX;
      aS[j] = i / N; aSide[j] = side;
      aTan[j * 2] = TU[i]; aTan[j * 2 + 1] = TV[i];
    }
  }
  const idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lineGeo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  lineGeo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  lineGeo.setAttribute('aTan', new THREE.BufferAttribute(aTan, 2));
  lineGeo.setIndex(idx);
  const lineMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uDraw: { value: 0 },
      uLen: { value: LEN },
      uWmax: { value: WMAX },
      uSwell: { value: 0 },
      uDiveS: { value: DIVE_S },
    },
    vertexShader: /* glsl */ `
      attribute float aS, aSide; attribute vec2 aTan;
      varying float vS, vSide, vAng;
      void main() {
        vS = aS; vSide = aSide;
        vec3 t = mat3(modelMatrix) * vec3(aTan.x, 0.0, aTan.y);
        vAng = atan(-t.z, t.x);                       // screen-space direction of the stroke
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform float uDraw, uLen, uWmax, uSwell, uDiveS;
      varying float vS, vSide, vAng;
      float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
      float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
      void main() {
        float ds = (uDraw - vS) * uLen;                 // world distance behind the wet head
        if (ds < 0.0) discard;
        float d0 = vS * uLen;                           // from the touch-down
        float pr = 0.55 + 0.25 * sin(vS * 9.0 + 1.0) + 0.1 * sin(vS * 23.0 + 2.0);
        float w = 0.07 + 0.055 * pr;
        w += 0.05 * exp(-d0 * d0 / 0.012);              // the touch-down blot
        float dv = (vS - uDiveS) * uLen;
        w *= 1.0 + uSwell * (0.6 + 2.2 * exp(-dv * dv / 1.4));   // the flood swells the line
        // brush edge: each side wavers on its own
        float side = sign(vSide);
        w *= 0.93 + 0.14 * n1(d0 * 7.0 + side * 31.0) + 0.05 * n1(d0 * 31.0 + side * 7.0);
        float wet = 1.0 - smoothstep(0.0, 2.2, ds);
        float halo = mix(0.016, 0.042, wet) + 0.03 * uSwell;
        // round caps at both ends (the head ends exactly at uDraw)
        float R = w + halo;
        float capH = ds < R ? sqrt(max(0.0, 1.0 - pow(1.0 - ds / R, 2.0))) : 1.0;
        float capT = d0 < R ? sqrt(max(0.0, 1.0 - pow(1.0 - d0 / R, 2.0))) : 1.0;
        float cap = min(capH, capT);
        float x = abs(vSide) * uWmax;                   // world distance from the centre line
        if (x > R * cap) discard;
        float shade = 0.03, pal = PAL_NEUTRAL, hatch = 0.0, ang = vAng;
        if (x > w * cap) {
          pal = PAL_ACCENT; shade = 0.92;               // wet ember-glow edge
        } else {
          // wet sheen: a pale engraved streak along the lit side of the fresh ink
          float sx = vSide * uWmax / max(w * cap, 1e-3);
          float band = 1.0 - smoothstep(0.08, 0.2, abs(sx + 0.42));
          float sheen = band * mix(0.35, 1.0, wet) * step(0.04, ds);
          if (sheen > 0.3) { shade = mix(0.3, 0.62, sheen); hatch = 1.0; }
        }
        gl_FragColor = gbuf(shade, pal, ang, hatch);
      }`,
  });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.frustumCulled = false;
  frame.add(line);

  // ---------------------------------------------------------------- hand card (2:1)
  const handTex = tex('art/hand_reach.png', { aspect: 2 });
  const handMat = cardMaterial(handTex, { hatch: 0, angle: Math.PI / 4, alphaTest: 0.5 });
  const H = 3.7;                      // card height in world units (width = 2H)
  const TIP_U = 0.042;                // index fingertip in card uv
  const TIP_V = 0.575;
  const card = cardPlane(handTex, handMat, H);
  const holder = new THREE.Group();   // lies flat, facing up
  holder.rotation.x = -Math.PI / 2;
  holder.add(card);
  const aim = new THREE.Group();      // origin = fingertip, rotates around y
  aim.add(holder);
  scene.add(aim);
  const placeCard = () => {
    card.position.set((0.5 - TIP_U) * card.scale.x, (0.5 - TIP_V) * card.scale.y, 0);
    tableMat.uniforms.uMap.value = handTex;
  };
  placeCard();
  handTex.addEventListener('loaded', placeCard);

  // ---------------------------------------------------------------- state (no per-frame allocation)
  const st = { p: 0, s: 0, prevS: -1, time: 0, touch: 0, lift: 0, a: 0, cos: 1, sin: 0, splatK: 0 };
  const P = { u: 0, v: 0, tu: 1, tv: 0 };
  const Q = { u: 0, v: 0, tu: 1, tv: 0 };
  const head = new THREE.Vector3();
  const prevHead = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const camBase = new THREE.Vector3();
  const lookBase = new THREE.Vector3();
  const look = new THREE.Vector3();
  const dive = new THREE.Vector3();
  const sim = new THREE.Vector2();

  const toWorld = (u, v, out) => out.set(u * st.cos - v * st.sin, 0, u * st.sin + v * st.cos);
  const toSim = (x, z) => sim.set((x * st.cos + z * st.sin) / DOM_W + 0.5, -(-x * st.sin + z * st.cos) / DOM_H + 0.5);
  // world (x,z) vector -> sim uv vector
  const simVX = (x, z) => (x * st.cos + z * st.sin) / DOM_W;
  const simVY = (x, z) => -(-x * st.sin + z * st.cos) / DOM_H;

  // stroke timing: a confident gesture, quick through the middle, settling at the end
  const drawAt = (p) => {
    const t = clamp01((p - 0.085) / (0.8 - 0.085));
    return lerp(t, smooth(t), 0.55);
  };

  function pose(p) {
    // layout by aspect: w = 1 landscape (stroke across), 0 portrait (stroke down the screen)
    const aspect = camera.aspect;
    const w = seg(aspect, 0.72, 1.2);
    st.a = (1 - w) * Math.PI * 0.5;
    st.cos = Math.cos(st.a); st.sin = Math.sin(st.a);
    frame.rotation.y = -st.a;
    tableMat.uniforms.uFrame.value.set(st.cos, st.sin);

    // camera distance keeps ~5.4 world units visible ACROSS the stroke
    const across = 2.7;
    const D = lerp(across / (T * aspect), across / T, w);
    const halfAlong = lerp(across / aspect, across * aspect, w);   // visible half-extent along the stroke
    // pan along the stroke: the head starts left/top of centre, the whole S is in frame by p 0.8
    // (portrait: the S sits in the top ~80%, clear of the caption)
    const uStart = U0 + lerp(0.8, 0.42, w) * halfAlong;
    const uEnd = Math.max(uStart, U0 + halfAlong - lerp(0.18 * halfAlong, 0.5, w));
    const camU = lerp(uStart, uEnd, seg(p, 0.02, 0.8));
    const camV = lerp(0.1, 0.0, w);
    toWorld(camU, camV, lookBase);
    const tilt = 0.26;
    const px = ctx.pointer.nx * 0.06, pz = -ctx.pointer.ny * 0.05;   // tiny parallax
    camBase.set(lookBase.x + px, D * Math.cos(tilt), lookBase.z + D * Math.sin(tilt) + pz);

    // the stroke
    st.touch = seg(p, 0.0, 0.1);
    st.lift = seg(p, 0.8, 0.97);
    const s = drawAt(p);
    st.s = s;
    lineMat.uniforms.uDraw.value = p < 0.07 ? 0 : s + 0.0005;
    at(s, P);
    toWorld(P.u, P.v, head);

    // the hand: arm angle relative to the stroke. It always comes in from the right edge:
    // across the stroke on a phone (so the sleeve never shows), trailing it on desktop.
    const delta = lerp(0.45 - Math.PI / 2, 0.3, w) + 0.15 * Math.atan2(P.tv, P.tu);
    const alpha = st.a + delta;
    const ax = Math.cos(alpha), az = Math.sin(alpha);
    // height above the table: hover, touch down, ride the pressure, lift away
    const pr = pressure(s);
    let h = lerp(0.7, 0.34 - 0.05 * pr, st.touch) + 3.4 * st.lift * st.lift;
    const back = 0.4 * (1 - st.touch) + 6.5 * st.lift * st.lift;   // enter / withdraw along the arm
    // put the fingertip on the camera ray through the line's head, so it sits on the ink
    const k = Math.min(0.6, h / camBase.y);
    tip.set(head.x + (camBase.x - head.x) * k, h, head.z + (camBase.z - head.z) * k);
    tip.x += ax * back; tip.z += az * back;
    aim.position.copy(tip);
    aim.rotation.y = -alpha;
    aim.updateMatrixWorld(true);
    tableMat.uniforms.uHandInv.value.copy(card.matrixWorld).invert();
    tableMat.uniforms.uHandH.value = h;
    tableMat.uniforms.uHandOn.value = 1 - st.lift;

    // the dive: down into the line, with a slow roll
    at(DIVE_S, Q);
    toWorld(Q.u, Q.v, dive);
    const e = Math.pow(seg(p, 0.8, 1.0), 2.2);
    camera.position.set(lerp(camBase.x, dive.x, e), lerp(camBase.y, 0.95 / lerp(0.2, 1, w), e), lerp(camBase.z, dive.z + 0.18, e));
    look.set(lerp(lookBase.x, dive.x, e), 0, lerp(lookBase.z, dive.z, e));
    const roll = 0.55 * e;
    camera.up.set(Math.sin(roll), 0, -Math.cos(roll));
    camera.lookAt(look);
    camera.up.set(0, 1, 0);

    const fl = seg(p, 0.8, 0.9);
    tableMat.uniforms.uFlood.value.set(dive.x, dive.z, lerp(0.4, 9, Math.pow(seg(p, 0.8, 1.0), 1.4)), fl);
    lineMat.uniforms.uSwell.value = 0.85 * seg(p, 0.82, 1.0);
  }

  // scroll-driven splats at the fingertip (ambient: the sim never rewinds)
  function splatStroke(dt) {
    if (st.prevS < 0) { st.prevS = st.s; prevHead.copy(head); return; }
    const ds = st.s - st.prevS;
    if (dt > 0 && Math.abs(ds) > 1e-5 && st.touch > 0.6 && st.lift < 0.5) {
      const dist = Math.abs(ds) * LEN;
      const n = Math.min(3, 1 + Math.floor(dist / 0.12));
      const amt = Math.min(0.5, dist * 2.2) / n;
      const vx = (head.x - prevHead.x) / dt, vz = (head.z - prevHead.z) / dt;
      const sp = Math.min(1, dist / dt / 6);   // tip speed, normalised
      for (let i = 1; i <= n; i++) {
        const f = i / n;
        const x = lerp(prevHead.x, head.x, f), z = lerp(prevHead.z, head.z, f);
        toSim(x, z);
        // forward drag plus a sideways kick that alternates, so the ink curls off the stroke
        st.splatK = (st.splatK + 1) % 2;
        const sgn = st.splatK ? 1 : -1;
        const fx = simVX(vx, vz) * 26, fy = simVY(vx, vz) * 26;
        fluid.splat(sim.x, sim.y, fx - fy * sgn * 0.9, fy + fx * sgn * 0.9, amt * (0.6 + sp), 0.0005 + 0.0009 * sp);
      }
    }
    st.prevS = st.s;
    prevHead.copy(head);
  }

  function seedPool() {
    // a drop of ink waiting under the fingertip (so the first frame is never empty)
    at(0, P);
    toWorld(P.u, P.v, head);
    toSim(head.x, head.z);
    fluid.splat(sim.x, sim.y, 0, 0, 2.2, 0.0018);
    for (let i = 0; i < 3; i++) {
      // tangential kicks: the drop spreads with a slight curl instead of a stamp
      const a = (i / 3) * Math.PI * 2 + 0.7;
      const ox = Math.cos(a) * 0.012, oy = Math.sin(a) * 0.019;
      fluid.splat(sim.x + ox, sim.y + oy, -Math.sin(a) * 60, Math.cos(a) * 60, 0.4, 0.0008);
    }
  }

  function update(dt) {
    st.time += dt;
    tableMat.uniforms.uTime.value = st.time;
    // the fingertip keeps bleeding a little while it's down
    if (dt > 0 && st.touch > 0.5 && st.lift < 0.3) {
      toSim(head.x, head.z);
      const a = st.time * 1.7;
      fluid.splat(sim.x, sim.y, Math.cos(a) * 6, Math.sin(a * 1.3) * 6, dt * 0.45, 0.0006);
    }
    if (dt > 0) fluid.step(Math.min(dt, 1 / 30));
    tableMat.uniforms.uDye.value = fluid.dye.texture;
    tableMat.uniforms.uVel.value = fluid.velocity.texture;
  }

  // debug (?intro=...): expose the p-driven pose so a script can check that scrubbing rewinds exactly
  if (new URLSearchParams(location.search).has('intro')) {
    window.__lineState = () => [...camera.position.toArray(), ...aim.position.toArray(), aim.rotation.y, lineMat.uniforms.uDraw.value];
  }

  return {
    scene, camera,
    enter() {
      st.time = 0; st.prevS = -1;
      fluid.reset();
      pose(st.p);
      seedPool();
      pose(st.p);
    },
    progress(p, dt) {
      st.p = p;
      pose(p);
      splatStroke(dt || 0);
    },
    update,
    pointer() {},   // parallax reads ctx.pointer in pose()
    exit() {},
    dispose() {
      handTex.removeEventListener('loaded', placeCard);
      fluid.dispose();
      table.geometry.dispose(); tableMat.dispose();
      lineGeo.dispose(); lineMat.dispose();
      card.geometry.dispose(); handMat.dispose();
    },
  };
}
