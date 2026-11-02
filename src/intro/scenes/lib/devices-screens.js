// Device screens for the "apps" beat: G-buffer shaders that draw flat, engraved native-app UI
// (no text; bars and blocks stand in for it) in GLOW / HOT / EMBER + ink.
//
// Each screen is a plane with a rounded-rect outline: a thin paper glass edge, an ink border,
// then the display. uOn 0..1 powers it up: dark glass with a glare, then the UI spreads out
// from the centre behind a hot ring, and the engraving lines lift off it as it reaches full
// brightness. uFill drives the one bit of live data per screen (ring fill, selected row).

const COMMON = /* glsl */ `
  float sdRR(vec2 p, vec2 hs, float r){ vec2 d = abs(p) - hs + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
  // box from (x0,y0) to (x1,y1) in display units (x 0..1 across, y 0..H top-down)
  float box(vec2 q, vec4 b, float r){ return sdRR(q - (b.xy + b.zw) * 0.5, (b.zw - b.xy) * 0.5, r); }
  float circ(vec2 q, vec2 c, float r){ return length(q - c) - r; }
  float seg(vec2 q, vec2 a, vec2 b, float w){ vec2 pa = q - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - w; }
  float h1(float n){ return fract(sin(n * 91.3458) * 47453.5453); }
  // paint a layer: shade, palette, hatch amount
  #define PAINT(d, S, P, Hh) if ((d) < 0.0) { s = (S); pal = (P); h = (Hh); }
`;

// ---------------------------------------------------------------- phone: a grouped list app
const PHONE_UI = /* glsl */ `
  void ui(vec2 q, float H, inout float s, inout float pal, inout float h, inout float a){
    // ground
    s = 0.9; pal = PAL_ACCENT; h = 0.0;
    // status bar + island
    PAINT(box(q, vec4(0.09, 0.045, 0.2, 0.068), 0.01), 0.04, PAL_NEUTRAL, 0.0);
    PAINT(box(q, vec4(0.36, 0.03, 0.64, 0.085), 0.0275), 0.03, PAL_NEUTRAL, 0.0);
    PAINT(box(q, vec4(0.76, 0.048, 0.84, 0.066), 0.006), 0.04, PAL_NEUTRAL, 0.0);
    PAINT(box(q, vec4(0.855, 0.046, 0.91, 0.068), 0.008), 0.04, PAL_NEUTRAL, 0.0);
    // nav bar: large title + add button
    PAINT(box(q, vec4(0.06, 0.15, 0.52, 0.215), 0.016), 0.04, PAL_NEUTRAL, 0.0);
    PAINT(circ(q, vec2(0.885, 0.183), 0.05), 1.0, PAL_CIELO, 0.0);
    PAINT(min(box(q, vec4(0.86, 0.178, 0.91, 0.188), 0.003), box(q, vec4(0.88, 0.158, 0.89, 0.208), 0.003)), 0.04, PAL_NEUTRAL, 0.0);
    // search field
    PAINT(box(q, vec4(0.05, 0.255, 0.95, 0.325), 0.035), 1.0, PAL_CIELO, 0.0);
    PAINT(abs(circ(q, vec2(0.105, 0.288), 0.015)) - 0.005, 0.05, PAL_NEUTRAL, 0.0);
    PAINT(seg(q, vec2(0.116, 0.299), vec2(0.128, 0.311), 0.005), 0.05, PAL_NEUTRAL, 0.0);
    PAINT(box(q, vec4(0.15, 0.282, 0.42, 0.296), 0.007), 0.9, PAL_PRATO, 0.0);
    // two grouped lists
    for (int g = 0; g < 2; g++) {
      float y0 = g == 0 ? 0.37 : 1.25;
      int n = g == 0 ? 6 : 4;
      float y1 = y0 + float(n) * 0.13;
      if (g == 1) PAINT(box(q, vec4(0.08, 1.195, 0.34, 1.215), 0.008), 0.15, PAL_NEUTRAL, 0.0);
      PAINT(box(q, vec4(0.05, y0, 0.95, y1), 0.05), 1.0, PAL_CIELO, 0.0);
      for (int i = 0; i < 6; i++) {
        if (i >= n) break;
        float k = float(i + g * 7);
        float yr = y0 + float(i) * 0.13;
        float yc = yr + 0.065;
        // selected row (uFill walks down the first group)
        if (g == 0 && abs(float(i) - uFill) < 0.5) PAINT(box(q, vec4(0.05, yr, 0.95, yr + 0.13), i == 0 ? 0.05 : 0.0), 0.9, PAL_ACCENT, 0.0);
        // icon tile
        float ic = box(q, vec4(0.085, yc - 0.042, 0.17, yc + 0.042), 0.022);
        float ip = mod(k, 3.0) < 1.0 ? PAL_RED : (mod(k, 3.0) < 2.0 ? PAL_ACCENT : PAL_NEUTRAL);
        PAINT(ic, ip == PAL_NEUTRAL ? 0.04 : 0.95, ip, 0.0);
        PAINT(box(q, vec4(0.11, yc - 0.012, 0.145, yc + 0.012), 0.008), ip == PAL_NEUTRAL ? 0.95 : 0.04, ip == PAL_NEUTRAL ? PAL_CIELO : PAL_NEUTRAL, 0.0);
        // title + subtitle bars
        float tl = 0.28 + 0.3 * h1(k + 1.0);
        PAINT(box(q, vec4(0.21, yc - 0.03, 0.21 + tl, yc - 0.006), 0.009), 0.04, PAL_NEUTRAL, 0.0);
        PAINT(box(q, vec4(0.21, yc + 0.012, 0.21 + tl * (0.45 + 0.4 * h1(k + 9.0)), yc + 0.028), 0.007), 0.9, PAL_PRATO, 0.0);
        // chevron
        PAINT(min(seg(q, vec2(0.885, yc - 0.018), vec2(0.905, yc), 0.0045), seg(q, vec2(0.905, yc), vec2(0.885, yc + 0.018), 0.0045)), 0.05, PAL_NEUTRAL, 0.0);
        // separator
        if (i < n - 1) PAINT(box(q, vec4(0.21, yr + 0.126, 0.95, yr + 0.134), 0.0), 0.05, PAL_NEUTRAL, 0.0);
      }
    }
    // tab bar + home indicator
    PAINT(box(q, vec4(-0.1, H - 0.23, 1.1, H + 0.1), 0.0), 1.0, PAL_CIELO, 0.0);
    PAINT(box(q, vec4(-0.1, H - 0.234, 1.1, H - 0.228), 0.0), 0.05, PAL_NEUTRAL, 0.0);
    for (int i = 0; i < 4; i++) {
      vec2 c = vec2(0.14 + float(i) * 0.24, H - 0.165);
      float d = i == 0 ? box(q, vec4(c - 0.032, c + 0.032), 0.012) : (i == 1 ? circ(q, c, 0.034) : (i == 2 ? abs(circ(q, c, 0.03)) - 0.008 : box(q, vec4(c.x - 0.036, c.y - 0.012, c.x + 0.036, c.y + 0.012), 0.01)));
      PAINT(d, i == 0 ? 0.95 : 0.04, i == 0 ? PAL_RED : PAL_NEUTRAL, 0.0);
      PAINT(box(q, vec4(c.x - 0.04, c.y + 0.05, c.x + 0.04, c.y + 0.062), 0.006), 0.04, PAL_NEUTRAL, 0.0);
    }
    PAINT(box(q, vec4(0.34, H - 0.04, 0.66, H - 0.026), 0.007), 0.04, PAL_NEUTRAL, 0.0);
  }
`;

// ---------------------------------------------------------------- watch: activity rings + complications
const WATCH_UI = /* glsl */ `
  void ui(vec2 q, float H, inout float s, inout float pal, inout float h, inout float a){
    s = 0.035; pal = PAL_NEUTRAL; h = 0.0;
    vec2 c = vec2(0.5, H * 0.56);
    vec2 v = q - c;
    float r = length(v);
    // clockwise from 12 o'clock, 0..1
    float ang = fract(atan(v.x, -v.y) / 6.2831853 + 1.0);
    for (int i = 0; i < 3; i++) {
      float R = 0.35 - float(i) * 0.105;
      float w = 0.042;
      float f = clamp(uFill * (1.0 - float(i) * 0.17) + float(i) * 0.06, 0.0, 0.98);
      float P = i == 0 ? PAL_RED : (i == 1 ? PAL_ACCENT : PAL_CIELO);
      float ring = abs(r - R) - w;
      // track: the same colour, cut through with ink lines
      PAINT(ring, 0.42, P, 1.0);
      if (ring < 0.0) a = 0.8;
      // fill arc with round caps
      vec2 e = c + R * vec2(sin(f * 6.2831853), -cos(f * 6.2831853));
      float cap = min(circ(q, c + vec2(0.0, -R), w), circ(q, e, w));
      float arc = ang < f ? ring : 1.0;
      PAINT(min(arc, cap), 0.97, P, 0.0);
    }
    // time + date bars, two corner complications
    PAINT(box(q, vec4(0.56, 0.06, 0.9, 0.12), 0.02), 0.97, PAL_CIELO, 0.0);
    PAINT(box(q, vec4(0.1, 0.07, 0.3, 0.105), 0.016), 0.9, PAL_PRATO, 0.0);
    PAINT(abs(circ(q, vec2(0.13, H - 0.12), 0.06)) - 0.012, 0.95, PAL_ACCENT, 0.0);
    PAINT(circ(q, vec2(0.87, H - 0.12), 0.06), 0.95, PAL_RED, 0.0);
    PAINT(box(q, vec4(0.85, H - 0.15, 0.89, H - 0.09), 0.008), 0.04, PAL_NEUTRAL, 0.0);
  }
`;

// ---------------------------------------------------------------- laptop: desktop, menu bar, a window with a sidebar, dock
const LAPTOP_UI = /* glsl */ `
  void ui(vec2 q, float H, inout float s, inout float pal, inout float h, inout float a){
    // wallpaper: engraved dunes in glow
    float dune = sin(q.x * 9.0 + sin(q.y * 7.0 + q.x * 3.0) * 1.6 - q.y * 14.0);
    s = 0.6 + 0.3 * dune + 0.12 * (1.0 - q.y / H); pal = PAL_ACCENT; h = 1.0; a = 0.35 + 0.25 * sin(q.x * 4.0);
    // menu bar
    PAINT(box(q, vec4(-0.1, -0.1, 1.1, 0.032), 0.0), 0.05, PAL_NEUTRAL, 0.0);
    for (int i = 0; i < 5; i++) PAINT(box(q, vec4(0.03 + float(i) * 0.06, 0.011, 0.03 + float(i) * 0.06 + 0.035 + 0.01 * h1(float(i)), 0.021), 0.004), 0.9, PAL_ACCENT, 0.0);
    PAINT(box(q, vec4(0.84, 0.011, 0.97, 0.021), 0.004), 0.9, PAL_ACCENT, 0.0);
    // window shadow (offset ink) then the window
    vec4 win = vec4(0.11, 0.075, 0.89, 0.505);
    PAINT(box(q, win + vec4(0.008, 0.012, 0.008, 0.012), 0.016), 0.04, PAL_NEUTRAL, 0.0);
    PAINT(box(q, win, 0.014), 1.0, PAL_NEUTRAL, 0.0);
    // sidebar
    PAINT(box(q, vec4(win.x, win.y, 0.3, win.w), 0.014), 1.0, PAL_CIELO, 0.0);
    PAINT(box(q, vec4(0.296, win.y, 0.3, win.w), 0.0), 0.05, PAL_NEUTRAL, 0.0);
    for (int i = 0; i < 3; i++) {
      float P = i == 0 ? PAL_RED : (i == 1 ? PAL_ACCENT : PAL_PRATO);
      PAINT(circ(q, vec2(0.13 + float(i) * 0.017, 0.093), 0.0058), 0.95, P, 0.0);
    }
    for (int i = 0; i < 8; i++) {
      float y = 0.135 + float(i) * 0.034 + (i > 4 ? 0.02 : 0.0);
      if (abs(float(i) - uFill) < 0.5) PAINT(box(q, vec4(0.122, y - 0.014, 0.288, y + 0.014), 0.008), 0.9, PAL_ACCENT, 0.0);
      if (i == 5) PAINT(box(q, vec4(0.13, y - 0.04, 0.19, y - 0.032), 0.003), 0.9, PAL_PRATO, 0.0);
      PAINT(box(q, vec4(0.132, y - 0.007, 0.146, y + 0.007), 0.004), 0.04, PAL_NEUTRAL, 0.0);
      PAINT(box(q, vec4(0.155, y - 0.005, 0.2 + 0.07 * h1(float(i) + 3.0), y + 0.005), 0.004), 0.04, PAL_NEUTRAL, 0.0);
    }
    // toolbar
    PAINT(box(q, vec4(0.32, 0.087, 0.5, 0.101), 0.005), 0.04, PAL_NEUTRAL, 0.0);
    PAINT(box(q, vec4(0.78, 0.084, 0.87, 0.104), 0.008), 0.95, PAL_CIELO, 0.0);
    PAINT(box(q, vec4(0.3, 0.118, win.z, 0.121), 0.0), 0.05, PAL_NEUTRAL, 0.0);
    // the document: lines of code, indented, with coloured tokens
    for (int i = 0; i < 14; i++) {
      float k = float(i);
      float y = 0.142 + k * 0.025;
      float ind = 0.33 + 0.03 * floor(mod(k * 0.7 + floor(k / 4.0), 3.0));
      if (mod(k, 6.0) == 5.0) continue;
      float x = ind;
      for (int j = 0; j < 4; j++) {
        float fj = float(j);
        float len = 0.03 + 0.09 * h1(k * 7.0 + fj);
        if (x + len > 0.87) break;
        float P = mod(k + fj * 2.0, 5.0) < 1.0 ? PAL_RED : (mod(k * 3.0 + fj, 4.0) < 1.0 ? PAL_ACCENT : PAL_NEUTRAL);
        PAINT(box(q, vec4(x, y - 0.0055, x + len, y + 0.0055), 0.004), P == PAL_NEUTRAL ? 0.04 : 0.9, P, 0.0);
        x += len + 0.014;
        if (h1(k * 3.0 + fj) > 0.7) break;
      }
    }
    // dock
    PAINT(box(q, vec4(0.29, H - 0.075, 0.71, H - 0.012), 0.022), 0.05, PAL_NEUTRAL, 0.0);
    for (int i = 0; i < 8; i++) {
      float x = 0.31 + float(i) * 0.0505;
      float P = mod(float(i), 4.0) < 1.0 ? PAL_RED : (mod(float(i), 4.0) < 2.0 ? PAL_ACCENT : (mod(float(i), 4.0) < 3.0 ? PAL_CIELO : PAL_NEUTRAL));
      PAINT(box(q, vec4(x, H - 0.065, x + 0.04, H - 0.022), 0.011), 0.95, P, 0.0);
    }
  }
`;

const UIS = { phone: PHONE_UI, watch: WATCH_UI, laptop: LAPTOP_UI };

/**
 * Screen material. size = plane size in world units, radius = corner radius, edge = paper glass
 * line width, border = ink border inside it (world units).
 */
export function screenMaterial(ctx, kind, { size, radius, edge = 0.008, border = 0.02 }) {
  const { THREE, GBUF_GLSL } = ctx;
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: new THREE.Vector2(size[0], size[1]) },
      uRadius: { value: radius },
      uEdge: { value: edge },
      uBorder: { value: border },
      uOn: { value: 0 },
      uFill: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${GBUF_GLSL}
      uniform vec2 uSize; uniform float uRadius, uEdge, uBorder, uOn, uFill;
      varying vec2 vUv;
      ${COMMON}
      ${UIS[kind]}
      void main(){
        vec2 p = (vUv - 0.5) * uSize;
        float d = sdRR(p, uSize * 0.5, uRadius);
        if (d > 0.0) discard;
        if (d > -uEdge) { gl_FragColor = gbuf(1.0, PAL_PAPER_FLAT, 0.0, 0.0); return; }
        vec2 inner = uSize - 2.0 * (uEdge + uBorder);
        float di = sdRR(p, inner * 0.5, max(0.001, uRadius - uEdge - uBorder));
        if (di > 0.0) { gl_FragColor = gbuf(0.03, PAL_NEUTRAL, 0.0, 0.0); return; }
        vec2 uv = p / inner + 0.5;
        float H = inner.y / inner.x;
        vec2 q = vec2(uv.x, (1.0 - uv.y) * H);
        // dark glass with one diagonal glare
        float g = uv.x * 0.75 + uv.y * 0.55;
        float glare = smoothstep(0.07, 0.0, abs(g - 0.95)) + 0.6 * smoothstep(0.025, 0.0, abs(g - 1.1));
        float s = 0.04 + glare * 0.42 * (1.0 - uOn), pal = PAL_NEUTRAL, h = 1.0, a = 0.85;
        // power on: the UI spreads from the centre behind a hot ring
        vec2 cq = (uv - 0.5) * vec2(1.0, H);
        float rr = length(cq) / (0.5 * sqrt(1.0 + H * H));
        float front = uOn * 1.25;
        if (rr < front - 0.05) {
          float us = 0.0, up = 0.0, uh = 0.0, ua = 0.0;
          ui(q, H, us, up, uh, ua);
          float full = smoothstep(0.55, 1.0, uOn);
          s = us * mix(0.72, 1.0, full);
          pal = up; a = ua;
          h = mix(1.0, uh, full);
        } else if (rr < front && uOn < 0.999) {
          s = 1.0; pal = PAL_CIELO; h = 0.0;
        }
        gl_FragColor = gbuf(s, pal, a, h);
      }`,
  });
}
