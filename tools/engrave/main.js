// Engrave tool (DEV ONLY — not part of the production build; vite's build input is only /index.html).
//
// Renders an image through the intro's own G-buffer + InkPass (src/intro/core), so stills match the
// intro exactly. The image is cover-cropped to w x h, pre-processed on the CPU into the colour code that
// cardMaterial understands (grey = NEUTRAL by luminance, pure red = EMBER, pure yellow = GLOW), drawn
// full-frame as an opaque cardMaterial plane (alphaTest 0) into a half-float G-buffer, then inked at
// exactly w x h, DPR 1, boil frozen. window.__engrave = { done, error, w, h } when finished.
//
// URL params (all optional except src):
//   src     image url (same origin, e.g. /screenshots/shot-leland.jpg)
//   w,h     output size in px (1600x1000)
//   fx,fy   crop focus 0..1 (0.5, 0.5);  zoom > 1 crops tighter, < 1 letterboxes with the edge colour (1)
//   line    hatch spacing in px (4.6 — the intro runs 6.5 CSS px live)
//   hatch   cardMaterial hatch amount 0..1 (1 = full engraving, 0 = hard threshold)
//   ang     hatch angle in degrees, screen space (62)
//   pal     auto | mono   (auto: warm saturated -> EMBER, bright saturated -> GLOW, rest NEUTRAL)
//   lo,hi   levels black/white points as luminance percentiles (0.5, 99.6)
//   gamma   tone gamma after levels (< 1 lifts mids) (0.75)
//   curve   S-curve amount 0..1 after gamma: pushes mid-tones toward clean paper / solid ink (0)
//   lift    black floor 0..1: pure black becomes this shade, so dark sites still hatch (0.16)
//   top     white ceiling (1)
//   lc,lcr  local contrast amount / blur radius px (0.55, 28)
//   text,tr,core  fine-detail boost: amount / radius px / noise core (2.2, 3, 0.035) — keeps type legible
//   sharp,sr unsharp amount / radius px (0.6, 1.2)
//   denoise pre-blur px (0.8)
//   cth     chroma threshold for colour (0.2);  sth saturation threshold (0.42)
//   warm    warm hue range in degrees "lo,hi" (-30,62): red-orange -> EMBER, but hue >= gwarm (28) and
//           brightness > gbth (0.55) -> GLOW;  bth  brightness for cool colours to become GLOW (0.42)
//   knock,kr  type knockout: NEUTRAL pixels whose (2kr+1)^2 box is >= knock colour become solid ink, so
//           white labels on coloured buttons engrave as ink type on EMBER/GLOW (0.3, 9; 0 = off)
//   cool    what bright cool colour becomes: glow | ember | mono (glow)
//   band    "lo,hi": NEUTRAL tones in this shade band become EMBER (woodcut red fills), off by default
//   emin    min EMBER shade (0.56);  gmin min GLOW shade (0.7)
//   quant   0 off | 1 snap to paper/ink/ember/glow | 2 + AA mids (5 ink-paper, 1 per colour pair) | 3 finer (2)
//   view    ink (default) | prep (show the pre-processed G-buffer source instead)
import * as THREE from 'three';
import { cardMaterial, PAL, COLORS } from '/src/intro/core/gbuffer.js';
import { InkPass } from '/src/intro/core/ink.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? parseFloat(q.get(k)) : d);
const pair = (k, d) => (q.has(k) ? q.get(k).split(',').map(Number) : d);

const P = {
  src: q.get('src'),
  w: Math.round(num('w', 1600)),
  h: Math.round(num('h', 1000)),
  fx: num('fx', 0.5), fy: num('fy', 0.5), zoom: Math.max(0.7, num('zoom', 1)),
  line: num('line', 4.6),
  hatch: num('hatch', 1),
  ang: num('ang', 62),
  pal: q.get('pal') || 'auto',
  lo: num('lo', 0.5), hi: num('hi', 99.6),
  gamma: num('gamma', 0.75), curve: num('curve', 0), lift: num('lift', 0.16), top: num('top', 1),
  lc: num('lc', 0.35), lcr: num('lcr', 28),
  sharp: num('sharp', 0.6), sr: num('sr', 1.2),
  text: num('text', 2.2), tr: num('tr', 3), core: num('core', 0.035),
  denoise: num('denoise', 0.8),
  cth: num('cth', 0.24), sth: num('sth', 0.45),
  warm: pair('warm', [-30, 62]), gwarm: num('gwarm', 20), gbth: num('gbth', 0.45), bth: num('bth', 0.62),
  knock: num('knock', 0.3), kr: num('kr', 9),
  cool: q.get('cool') || 'glow',
  band: q.has('band') ? pair('band', null) : null,
  emin: num('emin', 0.56), gmin: num('gmin', 0.7),
  view: q.get('view') || 'ink',
  quant: num('quant', 2),
};

const info = document.getElementById('info');
window.__engrave = { done: false, error: null, w: P.w, h: P.h, params: P };

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('could not load ' + src));
    img.src = src;
  });
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })];
}

// cover-crop the image into w x h around the focus point
function crop(img, w, h) {
  const [c, g] = canvas2d(w, h);
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * P.zoom;
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  // zoom < 1 letterboxes: pad with the image's mean edge colour (a dark site's ground) and centre it
  const fit = (v, lo, hi) => (lo <= hi ? Math.min(hi, Math.max(lo, v)) : (lo + hi) / 2);
  const dx = fit(w / 2 - P.fx * dw, w - dw, 0);
  const dy = fit(h / 2 - P.fy * dh, h - dh, 0);
  if (P.zoom < 1) {
    const [e, eg] = canvas2d(img.naturalWidth, img.naturalHeight);
    eg.drawImage(img, 0, 0);
    const d = eg.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
    const acc = [0, 0, 0]; let cnt = 0;
    for (let x = 0; x < img.naturalWidth; x += 4) for (const y of [0, img.naturalHeight - 1]) {
      const i = (y * img.naturalWidth + x) * 4; acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2]; cnt++;
    }
    g.fillStyle = `rgb(${acc.map((v) => Math.round(v / cnt)).join(',')})`;
    g.fillRect(0, 0, w, h);
  }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  if (P.denoise > 0) g.filter = `blur(${P.denoise}px)`;
  g.drawImage(img, dx, dy, dw, dh);
  g.filter = 'none';
  return g.getImageData(0, 0, w, h);
}

// Gaussian blur of a single-channel float array through a canvas filter
function blurLum(L, w, h, r) {
  const [c, g] = canvas2d(w, h);
  const id = g.createImageData(w, h);
  for (let i = 0; i < L.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(L[i] * 255)));
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  const [c2, g2] = canvas2d(w, h);
  // pad with edge pixels so the blur doesn't darken the borders
  g2.filter = `blur(${r}px)`;
  g2.drawImage(c, 0, 0);
  g2.filter = 'none';
  const d = g2.getImageData(0, 0, w, h).data;
  const out = new Float32Array(L.length);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

function percentile(L, p) {
  const hist = new Uint32Array(1024);
  for (let i = 0; i < L.length; i++) hist[Math.max(0, Math.min(1023, (L[i] * 1023) | 0))]++;
  const target = (p / 100) * L.length;
  let acc = 0;
  for (let i = 0; i < 1024; i++) { acc += hist[i]; if (acc >= target) return i / 1023; }
  return 1;
}

const NEU = 0, EMB = 1, GLW = 2;

function prep(id) {
  const { width: w, height: h, data } = id;
  const n = w * h;
  let L = new Float32Array(n);
  const cls = new Uint8Array(n);
  const [wl, wh] = P.warm;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    if (P.pal === 'mono') continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), C = mx - mn;
    if (C < P.cth || C / (mx + 1e-5) < P.sth) continue;
    let H;
    if (mx === r) H = 60 * (((g - b) / C) % 6);
    else if (mx === g) H = 60 * ((b - r) / C + 2);
    else H = 60 * ((r - g) / C + 4);
    if (H > 180) H -= 360;
    const warm = H >= wl && H <= wh;
    // warm: red-orange is EMBER; bright orange-yellow (lamps, lit windows, gold type) is GLOW
    if (warm) cls[i] = H >= P.gwarm && mx > P.gbth ? GLW : mx > 0.3 ? EMB : NEU;
    else if (mx > P.bth) cls[i] = P.cool === 'ember' ? EMB : P.cool === 'mono' ? NEU : GLW;
  }

  // clean the colour mask: a pixel keeps its colour only if most of its 3x3 neighbourhood agrees
  // (kills JPEG chroma speckle and anti-aliased fringes)
  const c2 = new Uint8Array(cls);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, k = cls[i];
    if (k === NEU) continue;
    let same = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) same += cls[i + dy * w + dx] === k ? 1 : 0;
    if (same < 5) c2[i] = NEU;
  }

  // knockout: type inside colour fills (white label on a blue button). Through integral images of the
  // colour mask and of the colour pixels' luminance: a NEUTRAL pixel in a box that is >= knock colour
  // becomes solid ink if it differs from the fill's mean luminance by > 0.22 (the letter core), and
  // otherwise joins the fill (its anti-aliased fringe), so letters stay thin and crisp.
  const knock = new Int8Array(n).fill(-1);
  if (P.knock > 0 && P.pal !== 'mono') {
    const W = w + 1;
    const I = new Float64Array(W * (h + 1)), IL = new Float64Array(W * (h + 1));
    const IE = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0, rowL = 0, rowE = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x, c = c2[i] !== NEU ? 1 : 0;
        row += c; rowL += c * L[i]; rowE += c2[i] === EMB ? 1 : 0;
        I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row;
        IL[(y + 1) * W + x + 1] = IL[y * W + x + 1] + rowL;
        IE[(y + 1) * W + x + 1] = IE[y * W + x + 1] + rowE;
      }
    }
    const box = (A, x0, y0, x1, y1) => A[y1 * W + x1] - A[y0 * W + x1] - A[y1 * W + x0] + A[y0 * W + x0];
    const r = P.kr;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (c2[i] !== NEU) continue;
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      const cnt = box(I, x0, y0, x1, y1);
      if (cnt / ((x1 - x0) * (y1 - y0)) < P.knock) continue;
      const fillL = box(IL, x0, y0, x1, y1) / cnt;
      if (Math.abs(L[i] - fillL) > 0.22) knock[i] = 0;                         // letter core -> ink
      else knock[i] = box(IE, x0, y0, x1, y1) * 2 > cnt ? EMB : GLW;           // fringe -> the fill
    }
  }

  // local contrast (big radius) then unsharp (small radius) on luminance
  if (P.lc > 0) {
    const B = blurLum(L, w, h, P.lcr);
    for (let i = 0; i < n; i++) L[i] = L[i] + P.lc * (L[i] - B[i]);
  }
  if (P.text > 0) {
    // fine-detail boost with coring: type and UI strokes snap to clean paper / solid ink while
    // flat areas (and JPEG noise below the core) keep their tone and stay hatched
    const B = blurLum(L, w, h, P.tr);
    for (let i = 0; i < n; i++) {
      const d = L[i] - B[i], a = Math.abs(d) - P.core;
      if (a > 0) L[i] += Math.sign(d) * a * P.text;
    }
  }
  if (P.sharp > 0) {
    const B = blurLum(L, w, h, P.sr);
    for (let i = 0; i < n; i++) L[i] = L[i] + P.sharp * (L[i] - B[i]);
  }

  // levels + gamma + lift into the shade range the ink pass engraves
  const lo = percentile(L, P.lo), hi = Math.max(lo + 0.02, percentile(L, P.hi));
  const out = new ImageData(w, h);
  const o = out.data;
  for (let i = 0; i < n; i++) {
    let t = Math.max(0, Math.min(1, (L[i] - lo) / (hi - lo)));
    t = Math.pow(t, P.gamma);
    if (P.curve) t += (t * t * (3 - 2 * t) - t) * P.curve;     // S-curve: fewer broken mid-tones
    let s = P.lift + (P.top - P.lift) * t;
    let k = c2[i];
    if (knock[i] === 0) s = 0;
    else if (knock[i] > 0) k = knock[i];
    if (k === NEU && P.band && s >= P.band[0] && s <= P.band[1]) k = EMB;
    let r, g, b;
    if (k === EMB) {
      // cardMaterial: isRed -> EMBER, shade = r * 1.15 (r must stay > 0.45)
      const sh = P.emin + (1 - P.emin) * t;
      r = Math.min(0.869, Math.max(0.46, sh / 1.15)); g = 0; b = 0;
    } else if (k === GLW) {
      // cardMaterial: isYellow -> GLOW, shade = lum * 1.1, lum = 0.299 + 0.587 g
      const sh = P.gmin + (0.975 - P.gmin) * t;
      r = 1; g = Math.min(1, Math.max(0.51, (sh / 1.1 - 0.299) / 0.587)); b = 0;
    } else {
      r = g = b = s;
    }
    o[i * 4] = Math.round(r * 255); o[i * 4 + 1] = Math.round(g * 255); o[i * 4 + 2] = Math.round(b * 255); o[i * 4 + 3] = 255;
  }
  return out;
}

async function run() {
  if (!P.src) throw new Error('missing ?src=');
  const { w, h } = P;
  const img = await loadImage(P.src);
  const g = prep(crop(img, w, h));

  if (P.view === 'prep') {
    const out = document.getElementById('out');
    out.width = w; out.height = h;
    out.getContext('2d').putImageData(g, 0, 0);
    return;
  }

  const [srcCanvas, sg] = canvas2d(w, h);
  sg.putImageData(g, 0, 0);
  const texture = new THREE.CanvasTexture(srcCanvas);
  texture.colorSpace = THREE.NoColorSpace;          // exact code values, no sRGB decode
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  const glCanvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  const mat = cardMaterial(texture, { hatch: P.hatch, angle: (P.ang * Math.PI) / 180, alphaTest: 0, redAs: PAL.EMBER });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const ink = new InkPass();
  ink.lineCss = P.line;
  ink.setSize(w, h, 1);
  ink.uniforms.uBoil.value = 0;   // boil frozen
  ink.uniforms.uWipe.value = 0;

  renderer.setRenderTarget(rt);
  renderer.setClearColor(new THREE.Color(1, 0.5 / 8, 0.5), 1);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  ink.render(renderer, rt.texture, 0);
  renderer.getContext().finish();

  texture.dispose(); rt.dispose(); mat.dispose();

  // Copy to the 2D output canvas, optionally snapping to the ink palette (+ anti-alias mid tones).
  // Snapping drops only the shader's ~2% paper tooth and sub-step AA, and lets lossless WebP use a
  // colour-indexed palette: a 1600x1000 engraving goes from ~1.7 MB lossless to a few hundred KB.
  const out = document.getElementById('out');
  out.width = w; out.height = h;
  out.style.width = w + 'px'; out.style.height = h + 'px';
  const og = out.getContext('2d', { willReadFrequently: true });
  og.drawImage(glCanvas, 0, 0);
  if (P.quant > 0) {
    const id = og.getImageData(0, 0, w, h);
    quantize(id.data, P.quant);
    og.putImageData(id, 0, 0);
  }
  renderer.dispose();
}

function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
// The ink pass mixes colours in linear light and the renderer encodes to sRGB, so AA mid tones are
// built the same way (otherwise a neutral grey edge would snap to a tinted mid).
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const toSrgb = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
function quantize(d, level) {
  const base = [COLORS.paper, COLORS.ink, COLORS.red, COLORS.accent].map(hexRGB);
  const [paper, ink, ember, glow] = base;
  const pal = [...base];
  const mix = (a, b, t) => a.map((v, i) => toSrgb(toLin(v) + (toLin(b[i]) - toLin(v)) * t));
  if (level >= 2) {
    // ink <-> paper carries most edges: 3 steps; colour pairs: 1 step
    for (const t of level >= 3 ? [0.03, 0.08, 0.15, 0.25, 0.4, 0.6, 0.8] : [0.06, 0.16, 0.32, 0.55, 0.8]) pal.push(mix(ink, paper, t));
    for (const [a, b] of [[ink, ember], [ink, glow], [paper, ember], [paper, glow]]) pal.push(mix(a, b, 0.5));
  }
  const cache = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let k = cache.get(key);
    if (k === undefined) {
      let best = 1e9;
      for (let j = 0; j < pal.length; j++) {
        const dr = d[i] - pal[j][0], dg = d[i + 1] - pal[j][1], db = d[i + 2] - pal[j][2];
        // plain RGB distance plus a warmth (r - b) term, so neutral AA never snaps to a tinted mid
        const dw = dr - db;
        const e = dr * dr + dg * dg + db * db + dw * dw;
        if (e < best) { best = e; k = j; }
      }
      cache.set(key, k);
    }
    d[i] = pal[k][0]; d[i + 1] = pal[k][1]; d[i + 2] = pal[k][2]; d[i + 3] = 255;
  }
}

run()
  .then(() => {
    window.__engrave.done = true;
    info.textContent = `${P.w}x${P.h}  line ${P.line}  hatch ${P.hatch}  ang ${P.ang}  pal ${P.pal}`;
  })
  .catch((e) => {
    window.__engrave.error = String(e && e.message || e);
    window.__engrave.done = true;
    info.textContent = 'error: ' + window.__engrave.error;
    console.error(e);
  });
