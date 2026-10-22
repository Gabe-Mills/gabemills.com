import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import {
  wallTiles,
  wallStats,
  topics,
  faq,
  requestKinds,
  REQUEST_EMAIL,
  type WallTile,
  type TopicId,
} from "../data/wall";
import { createDome, createGlyphRings, createVortex, createShockwave, createCards, createRibbons, createSigil, createSparks, createArcs, createRipples, createAsh } from "./wall/fx";
import { createSfx } from "./wall/sfx";
import { createMusic } from "./wall/music";
// CRISP is Gabe's assistant; the character was first built as the trading dashboard's mascot (Sherwood)
import { createSherwood as createOrb, type SherwoodState as OrbState } from "./wall/sherwood";

/**
 * Home wall — 21 Oct 2026, fifth pass: slow-motion entrance, no HUD, effects on the score's beat.
 *
 * It opens as a short film: a dark room, Gabe walks up to the plinth, and the
 * moment he steps onto it the plinth ignites — rings, a beam, energy whooshing
 * up around him, the dome lighting from the floor. His assistant CRISP (the orb)
 * materialises and asks what you'd like to see. Nothing else is on screen until
 * you choose: the language / AI / hardware rings fly out of the orb, and the
 * wall of live sites only prints in when you ask to see them.
 *
 * The scene is a director (a few clocks and a phase) over mostly stateless
 * effects; React only owns the orb's panel, the headline and the click-to-enter gate, and talks
 * to the scene through `api`.
 *
 * Wall tiles: the screen's real shape only exists in the vertex shader (a sphere
 * patch that can un-bend onto a camera-facing plane), so picking is analytic
 * against the sphere and floor rather than a raycast.
 */

const R = 10;
const CENTER = new THREE.Vector3(0, 4.6, 0);
const COLS = 16;
const ROWS = 4;
const COL_STEP = (Math.PI * 2) / COLS;
const TILE_AZ = COL_STEP * 0.88;
const TILE_EL = TILE_AZ * 0.625; // 16:10
const ROW_STEP = TILE_EL + COL_STEP * 0.12;
const MARGIN = 0.1;
const MAX_PLAYING = 5;

const PLINTH_H = 0.22;
const PLINTH_R = 0.95;
const PLINTH = new THREE.Vector3(0, 0, 2.2);
// the entrance is a slow-motion walk: a short distance, the stride at half speed
const ARRIVE_FROM = new THREE.Vector3(0.12, 0, 5.4);
const WALK_SPEED = 1.3; // m/s when you drive him
const TURN_SPEED = 1.9; // rad/s, A/D
const SLOWMO = 0.3; // how fast the world's own motion runs during the entrance
// the film opens in near silence (footsteps, a low rumble); the score comes in this many
// seconds after ENTER, so its hit (score.json hitAt) lands at SCORE_IN + hitAt film time
const SCORE_IN = 2.8;
const CLIP_SPEED = 0.969; // m/s the Walk clip's stride covers at timeScale 1 (T729)
const ROAM_R = 7.4;

const CAM_DIST = 4.7;
const CAM_H = 1.85;

type Phase = "arrive" | "ignite" | "menu";

export interface WallApi {
  showTopic(id: TopicId | null): void;
  showSites(on: boolean): void;
  setSound(on: boolean): void;
  skip(): void;
  /** ENTER: start the film (and the score, if with sound) */
  start(sound: boolean): void;
  /** true when the browser already lets this page play sound without a click */
  canAutoplay(): boolean;
  orbSay(state: OrbState): void;
  /** fly one screen forward, as if it had been clicked (the phone's site strip) */
  openTile(id: string): void;
}

/** the phone's topic chips land one per this many seconds, each with a chime */
const CHIP_STEP = 0.07;
const isPhone = () => window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;

interface Slot {
  tile: WallTile;
  az: number;
  el: number;
  dir: THREE.Vector3;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  hover: number;
  hoverT: number;
  delay: number;
}

const tileVert = /* glsl */ `
  uniform float uAz, uEl, uFocus, uHover, uPush, uTwist, uMargin, uReveal;
  uniform vec3 uCenter, uFlatC, uFlatR, uFlatU, uFlatF;
  uniform float uR, uW, uH;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vec2 t = (uv - 0.5) * (1.0 + 2.0 * uMargin) + 0.5;
    vUv = t;
    float az = uAz + (t.x - 0.5) * uW;
    float el = uEl + (t.y - 0.5) * uH;
    // screens arrive from deeper in the dark as they print in
    // screens fly in from deep in the dark, swinging round into place as they land
    float far = (1.0 - uReveal) * (1.0 - uReveal);
    az += far * 0.7;
    el += far * 0.25;
    float r = uR - uHover * 0.55 + uPush + far * 9.0;
    vec3 onWall = uCenter + r * vec3(sin(az) * cos(el), sin(el), -cos(az) * cos(el));
    float x = t.x * 2.0 - 1.0, y = t.y * 2.0 - 1.0;
    float lenR = length(uFlatR);
    vec3 axisX = cos(uTwist) * uFlatR + sin(uTwist) * uFlatF * lenR;
    vec3 flatP = uFlatC + x * axisX + y * uFlatU;
    vec3 p = mix(onWall, flatP, uFocus);
    p += normalize(uFlatC - onWall) * sin(uFocus * 3.14159) * 1.1;
    vFacing = cos(az);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const tileFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHover, uHoverT, uFocus, uDim, uTime, uPower, uFlash, uReveal;
  varying vec2 vUv;
  varying float vFacing;
  float roundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    if (uReveal < 0.001) discard;
    vec2 p = (vUv - 0.5) * vec2(1.6, 1.0);
    float d = roundBox(p, vec2(0.8, 0.5), mix(0.028, 0.012, uFocus));
    float hov = uHover * (1.0 - uFocus);
    vec3 ember = vec3(1.0, 0.52, 0.2);

    // print-in: scanlines draw top to bottom with a hot leading edge
    float rows = floor(vUv.y * 60.0);
    float n = hash(vec2(rows, floor(vUv.x * 24.0)));
    float front = 1.0 - uReveal * 1.25;
    float shown = step(front + n * 0.12, vUv.y);
    float lead = exp(-pow((vUv.y - (front + n * 0.12)) * 40.0, 2.0)) * (1.0 - uReveal);

    if (d > 0.0) {
      if ((hov < 0.01 && uFlash < 0.01 && lead < 0.01) || d > 0.08) discard;
      float halo = exp(-d * 38.0) * 0.9;
      vec2 ap = abs(p);
      float corner = step(0.64, ap.x) * step(0.36, ap.y);
      float bracket = corner * (1.0 - smoothstep(0.004, 0.007, abs(d - 0.026)));
      float ang = atan(p.y, p.x * 0.625);
      float comet = pow(max(0.0, cos(ang - uTime * 2.6)), 28.0) * exp(-d * 90.0);
      vec3 c = ember * (halo * 0.55 + bracket * 2.4 + comet * 5.0) * hov;
      c += vec3(1.0, 0.85, 0.7) * exp(-d * 30.0) * uFlash * 3.0;
      c += vec3(0.6, 0.8, 1.0) * exp(-d * 60.0) * lead * 2.0;
      float a = clamp(max(max(halo * 0.6, bracket), comet) * hov + exp(-d * 30.0) * (uFlash + lead), 0.0, 1.0);
      gl_FragColor = vec4(c, a);
      #include <colorspace_fragment>
      return;
    }
    if (shown < 0.5 && lead < 0.02) discard;

    vec2 uv = vUv;
    float open = smoothstep(0.0, 1.0, uPower);
    float band = abs(uv.y - 0.5);
    float lineOpen = smoothstep(0.0, 0.35, uPower);
    float vis = 1.0 - step(mix(0.004, 0.5, open), band);
    vis *= 1.0 - step(lineOpen * 0.5, abs(uv.x - 0.5));
    vec3 c = texture2D(uMap, uv).rgb * shown;
    float scan = 0.9 + 0.1 * sin(uv.y * 900.0);
    c = mix(c, c * scan, max(uFocus * (1.0 - open * 0.7), 1.0 - uReveal));

    float light = mix(0.1, 0.85, smoothstep(-0.3, 0.95, vFacing));
    light = mix(light * uDim, 0.94, uFocus);
    light += hov * 0.18;
    c *= light;
    c += vec3(0.6, 0.8, 1.0) * lead * 2.5;

    if (uFocus > 0.001 && uPower < 0.999) {
      float lineGlow = exp(-band * mix(400.0, 6.0, open)) * (1.0 - open) * lineOpen;
      c = c * vis + vec3(1.0, 0.92, 0.8) * lineGlow * 3.0;
    }

    float edge = 1.0 - smoothstep(0.0, 0.006, abs(d));
    float ang = atan(p.y, p.x * 0.625);
    float comet = pow(max(0.0, cos(ang - uTime * 2.6)), 28.0);
    c += ember * edge * (0.9 + comet * 4.0) * hov;
    c += vec3(0.6) * edge * 0.08 * (1.0 - uFocus) * uReveal;
    float sweep = uHoverT * 1.6 - 0.3;
    float sheen = exp(-pow((uv.x + uv.y * 0.6) - sweep * 1.6, 2.0) * 60.0);
    c += vec3(1.0, 0.9, 0.8) * sheen * 0.22 * hov;
    c += vec3(1.0, 0.9, 0.8) * uFlash * 0.6;

    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

const floorShader = {
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vLocal = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 r = vec3(0.0);
      r += texture2D(tDiffuse, uv).rgb * 0.30;
      r += texture2D(tDiffuse, uv + vec2(0.0, 0.006)).rgb * 0.22;
      r += texture2D(tDiffuse, uv - vec2(0.0, 0.006)).rgb * 0.22;
      r += texture2D(tDiffuse, uv + vec2(0.0, 0.014)).rgb * 0.13;
      r += texture2D(tDiffuse, uv - vec2(0.0, 0.014)).rgb * 0.13;
      float dist = length(vLocal);
      float fade = 1.0 - smoothstep(4.0, 11.0, dist);
      vec3 c = vec3(0.006, 0.005, 0.005) + r * 0.42 * fade;
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
};

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uBar: { value: 0 },
    uFade: { value: 0 },
    uHit: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / 1440, 1 / 900) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uBar, uFade, uHit;
    uniform vec2 uTexel;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 hot(vec2 uv) { vec3 s = texture2D(tDiffuse, uv).rgb; return max(s - 0.82, 0.0); }
    void main() {
      vec2 c = vUv - 0.5;
      float l2 = dot(c, c);
      vec2 off = c * (l2 * 0.014 + uHit * 0.035);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      vec3 streak = vec3(0.0);
      for (int i = 1; i <= 10; i++) {
        float fi = float(i);
        vec2 o = vec2(uTexel.x * fi * fi * 1.6, 0.0);
        float w = 1.0 - fi / 11.0;
        streak += (hot(vUv + o) + hot(vUv - o)) * w;
      }
      col += streak * vec3(0.35, 0.45, 0.8) * 0.16;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, col * vec3(0.86, 0.97, 1.08), (1.0 - smoothstep(0.0, 0.45, luma)) * 0.6);
      col = mix(col, col * vec3(1.08, 1.0, 0.9), smoothstep(0.45, 1.0, luma) * 0.5);
      col = (col - 0.5) * 1.07 + 0.5;
      col *= mix(1.0, 0.25, smoothstep(0.08, 0.42, l2));
      col += (hash(vUv * 1024.0 + fract(uTime * 7.0) * 100.0) - 0.5) * 0.045;
      col += vec3(1.0, 0.85, 0.7) * uHit * 0.18 * (1.0 - l2 * 2.0);
      col *= step(uBar, vUv.y) * step(vUv.y, 1.0 - uBar);
      col *= uFade;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

function hashOrder(n: number) {
  const out: number[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) out.push((c * 5 + r * 7 + (c % 3) * r) % n);
  return out;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const barFor = (aspect: number, target: number) => Math.max(0, (1 - aspect / target) * 0.5);
const smooth = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);

function useCountUp(target: number, start: boolean, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 4))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, start, ms]);
  return v;
}

function Stat({ value, suffix, label, start, delay }: { value: number; suffix: string; label: string; start: boolean; delay: number }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!start) return;
    const id = window.setTimeout(() => setGo(true), delay);
    return () => window.clearTimeout(id);
  }, [start, delay]);
  const v = useCountUp(value, go);
  return (
    <div className={`wall-stat flex items-baseline gap-2 whitespace-nowrap ${go ? "is-in" : ""}`}>
      <span className="font-display text-[24px] leading-none text-text-primary tabular-nums">
        {v}
        <span className="text-[#FFB15E]">{suffix}</span>
      </span>
      <span className="hud-label text-muted">{label.toUpperCase()}</span>
    </div>
  );
}

/** Types a line out, one character at a time; restarts when the text changes. */
function Typed({ text, speed = 22 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = window.setInterval(() => setN((k) => (k >= text.length ? (window.clearInterval(id), k) : k + 1)), speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return (
    <span>
      {text.slice(0, n)}
      <span className="opacity-0">{text.slice(n)}</span>
    </span>
  );
}

type SitesView = "menu" | "see" | "request" | "faq";

interface InboxFields {
  name: string;
  email: string;
  topic: string;
  message: string;
  website: string; // honeypot
}

/** The orb's request / question form. It posts to the inbox Worker; Gabe's Mac pulls it from there. */
function InboxForm({
  kind,
  form,
  setForm,
  send,
  onSubmit,
  onAgain,
  onBack,
}: {
  kind: "request" | "question";
  form: InboxFields;
  setForm: (f: InboxFields) => void;
  send: "idle" | "sending" | "sent" | "error";
  onSubmit: () => void;
  onAgain: () => void;
  onBack?: () => void;
}) {
  if (send === "sent") {
    return (
      <div className="wall-chip mt-3 rounded-lg border border-[rgba(157,255,176,0.35)] bg-[rgba(157,255,176,0.06)] p-3">
        <p className="text-[13px] text-text-primary">Delivered. Gabe will reply to {form.email || "your email"}.</p>
        <button type="button" onClick={onAgain} className="mt-2 font-mono text-[10px] tracking-[0.16em] text-[#9dffb0] hover:underline">
          SEND ANOTHER
        </button>
      </div>
    );
  }
  const set = (k: keyof InboxFields) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <form
      className="mt-3 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <input required maxLength={80} placeholder="Your name" autoComplete="name" value={form.name} onChange={set("name")} className="wall-input" />
        <input required maxLength={120} type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={set("email")} className="wall-input" />
      </div>
      {kind === "request" && (
        <select value={form.topic} onChange={set("topic")} className="wall-input">
          {requestKinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      )}
      <textarea
        required
        minLength={3}
        maxLength={2000}
        rows={3}
        placeholder={kind === "request" ? "What should it do?" : "Your question"}
        value={form.message}
        onChange={set("message")}
        className="wall-input resize-none"
      />
      {/* honeypot: hidden from people, irresistible to bots */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set("website")} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <div className="flex items-center gap-2">
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-lg border border-white/12 px-3 py-2 text-[13px] text-text-primary/85 hover:border-white/30">
            ← FAQ
          </button>
        )}
        <button
          type="submit"
          disabled={send === "sending"}
          className="flex-1 rounded-lg bg-[#E4692C] px-3 py-2 text-[13px] font-medium text-[#120D0C] transition-colors hover:bg-[#FFB15E] disabled:opacity-60"
        >
          {send === "sending" ? "Sending…" : kind === "request" ? "Send to Gabe →" : "Ask Gabe →"}
        </button>
      </div>
      {send === "error" && (
        <p className="text-[12px] text-[#ff9a7a]">
          That didn&apos;t go through. Try again, or email{" "}
          <a href={`mailto:${REQUEST_EMAIL}`} className="underline">
            {REQUEST_EMAIL}
          </a>
          .
        </p>
      )}
    </form>
  );
}

export default function WallHero() {
  const hostRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<WallApi | null>(null);
  const closeRef = useRef<() => void>(() => {});
  const [focused, setFocused] = useState<WallTile | null>(null);
  const [phase, setPhase] = useState<Phase>("arrive");
  const [topic, setTopic] = useState<TopicId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sitesView, setSitesView] = useState<SitesView>("menu");
  const [openQ, setOpenQ] = useState<number | null>(null);
  const [sound, setSound] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", topic: requestKinds[0], message: "", website: "" });
  const [send, setSend] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [asking, setAsking] = useState(false);
  const [entered, setEntered] = useState(false);
  const [bar, setBar] = useState(0);
  // phones get CRISP as a bottom sheet with big targets instead of the floating panel
  const [phone] = useState(isPhone);
  const [sheetMin, setSheetMin] = useState(false);
  const [allModels, setAllModels] = useState(false);

  // captions sit against the letterbox bars, so they need their height (the grade pass draws them at 2.05:1)
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth,
        h = window.innerHeight;
      const phone = w <= 760;
      setBar(phone ? 0 : Math.max(0, (1 - w / h / 2.05) * 0.5) * h);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const host = hostRef.current!;
    const tag = tagRef.current!;
    const bubble = bubbleRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = isPhone();
    const sfx = createSfx();
    const music = createMusic(sfx.context, sfx.destination);
    void music.preload();

    let dpr = Math.min(window.devicePixelRatio, phone ? 1.25 : 1.5);
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y";
    // setSize(..., false) leaves the CSS size alone, so pin it: without this the canvas lays
    // out at its buffer size (w * dpr) and the scene is cropped off-centre on any dpr > 1
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#030303");
    const BASE_FOV = phone ? 64 : 50;
    const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 120);
    const time = { value: 0 };

    const world = { value: 0 }; // the effects' clock: runs slow during the slow-motion entrance

    // ---------- stars ----------
    {
      const n = phone ? 900 : 1800;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 25);
        pos.set([v.x, Math.abs(v.y) * 0.9 + 6, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#e8ddd0", size: 0.09, transparent: true, opacity: 0.75, depthWrite: false })));
    }

    // ---------- textures ----------
    const videos = new Map<string, HTMLVideoElement>();
    const posters = new Map<string, THREE.Texture>();
    const loader = new THREE.TextureLoader();
    for (const t of wallTiles) {
      const p = loader.load(t.poster);
      p.colorSpace = THREE.SRGBColorSpace;
      p.anisotropy = 4;
      posters.set(t.id, p);
    }
    const slots: Slot[] = [];
    const setMap = (id: string, tex: THREE.Texture) => {
      for (const s of slots) if (s.tile.id === id) s.mat.uniforms.uMap.value = tex;
    };
    const videoFor = (t: WallTile) => {
      let v = videos.get(t.id);
      if (!v) {
        v = document.createElement("video");
        v.src = t.video;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = "auto";
        videos.set(t.id, v);
        const tex = new THREE.VideoTexture(v);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false;
        v.addEventListener("playing", () => setMap(t.id, tex));
        v.addEventListener("pause", () => setMap(t.id, posters.get(t.id)!));
      }
      return v;
    };

    // ---------- wall (hidden until asked for) ----------
    const geo = new THREE.PlaneGeometry(1, 1, 20, 10);
    const order = hashOrder(wallTiles.length);
    const flatC = new THREE.Vector3();
    const flatR = new THREE.Vector3();
    const flatU = new THREE.Vector3();
    const flatF = new THREE.Vector3();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = wallTiles[order[r * COLS + c]];
        const az = c * COL_STEP + (r % 2) * COL_STEP * 0.5;
        const el = (r - (ROWS - 1) / 2) * ROW_STEP + 0.04;
        const mat = new THREE.ShaderMaterial({
          vertexShader: tileVert,
          fragmentShader: tileFrag,
          side: THREE.DoubleSide,
          transparent: true,
          uniforms: {
            uMap: { value: posters.get(tile.id) },
            uAz: { value: az },
            uEl: { value: el },
            uFocus: { value: 0 },
            uHover: { value: 0 },
            uHoverT: { value: 0 },
            uPush: { value: 0 },
            uTwist: { value: 0 },
            uPower: { value: 1 },
            uFlash: { value: 0 },
            uReveal: { value: 0 },
            uDim: { value: 1 },
            uTime: time,
            uMargin: { value: MARGIN },
            uCenter: { value: CENTER },
            uFlatC: { value: flatC },
            uFlatR: { value: flatR },
            uFlatU: { value: flatU },
            uFlatF: { value: flatF },
            uR: { value: R },
            // angular size of the screen itself; the shader extends past it by uMargin
            uW: { value: TILE_AZ },
            uH: { value: TILE_EL },
          },
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.visible = false;
        scene.add(mesh);
        const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
        slots.push({ tile, az, el, dir, mesh, mat, hover: 0, hoverT: 0, delay: 0 });
      }
    }

    // ---------- room ----------
    const floor = new Reflector(new THREE.CircleGeometry(14, 64), {
      textureWidth: Math.round((window.innerWidth * dpr) / (phone ? 3 : 2)),
      textureHeight: Math.round((window.innerHeight * dpr) / (phone ? 3 : 2)),
      clipBias: 0.003,
      shader: floorShader,
    });
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const dome = createDome(CENTER, R);
    scene.add(dome.mesh);

    // ---------- plinth ----------
    const plinth = new THREE.Group();
    plinth.position.copy(PLINTH);
    scene.add(plinth);
    const stone = new THREE.MeshStandardMaterial({ color: "#0d0b0a", roughness: 0.35, metalness: 0.6 });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(PLINTH_R, PLINTH_R + 0.07, PLINTH_H - 0.02, 72), stone);
    drum.position.y = (PLINTH_H - 0.02) / 2;
    const stepMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.06, 72), stone);
    stepMesh.position.y = 0.03;
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(PLINTH_R + 0.005, 0.012, 8, 128), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = PLINTH_H - 0.01;
    const ring2Mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false });
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.006, 8, 128), ring2Mat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.061;
    // a lit top face: an ember disc that floods out from the centre on ignition
    const topMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOn: { value: 0 }, uTime: time },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uOn, uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5; float d = length(p) * 2.0; float a = atan(p.y, p.x);
          float flood = smoothstep(uOn * 1.2, uOn * 1.2 - 0.2, d);
          float circuits = step(0.92, fract(d * 9.0)) + step(0.97, fract(a * 6.0 / 3.14159 + d * 2.0)) * step(0.3, d);
          float pulse = 0.5 + 0.5 * sin(d * 18.0 - uTime * 3.0);
          float c = flood * (0.1 + circuits * 0.5 * pulse) * (1.0 - smoothstep(0.92, 1.0, d));
          gl_FragColor = vec4(vec3(1.0, 0.5, 0.2) * c * 1.6, 1.0);
        }`,
    });
    const top = new THREE.Mesh(new THREE.CircleGeometry(PLINTH_R, 72), topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = PLINTH_H + 0.002;
    plinth.add(drum, stepMesh, ring, ring2, top);

    const glowVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
    const poolMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: time, uOn: { value: 0 } },
      vertexShader: glowVert,
      fragmentShader: `uniform float uTime, uOn; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2) * (0.32 + 0.04 * sin(uTime * 1.3)) * uOn; gl_FragColor = vec4(vec3(1.0, 0.5, 0.22) * a, 1.0); }`,
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(PLINTH.x, 0.01, PLINTH.z);
    scene.add(pool);

    const markMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uAge: { value: 9 } },
      vertexShader: glowVert,
      fragmentShader: `uniform float uAge; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float r = min(uAge * 1.4, 1.0); float a = exp(-pow((d - r) * 14.0, 2.0)) * max(0.0, 1.0 - uAge * 0.9); a += exp(-d * 9.0) * 0.6 * max(0.0, 1.0 - uAge * 1.5); gl_FragColor = vec4(vec3(1.0, 0.55, 0.22) * a * 2.0, 1.0); }`,
    });
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), markMat);
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.012;
    scene.add(mark);

    const shock = createShockwave();
    shock.mesh.position.x = PLINTH.x;
    shock.mesh.position.z = PLINTH.z;
    scene.add(shock.mesh);

    const glyphs = createGlyphRings();
    glyphs.group.position.copy(PLINTH);
    scene.add(glyphs.group);

    const ribbons = createRibbons();
    ribbons.group.position.set(PLINTH.x, PLINTH_H, PLINTH.z);
    scene.add(ribbons.group);

    const sparks = createSparks(phone ? 260 : 600);
    sparks.mat.uniforms.uPx.value = dpr;
    scene.add(sparks.points);
    const arcs = createArcs();
    scene.add(arcs.lines);
    const ripples = createRipples();
    scene.add(ripples.group);
    const ash = createAsh(phone ? 260 : 700);
    ash.mat.uniforms.uPx.value = dpr;
    scene.add(ash.points);

    const sigil = createSigil();
    sigil.mesh.position.x = PLINTH.x;
    sigil.mesh.position.z = PLINTH.z;
    scene.add(sigil.mesh);

    const vortex = createVortex(phone ? 320 : 760);
    vortex.points.position.copy(PLINTH);
    vortex.mat.uniforms.uPx.value = dpr;
    scene.add(vortex.points);

    const cards = createCards({ narrow: phone && window.innerWidth < window.innerHeight });
    scene.add(cards.group);

    // ---------- beam + dust ----------
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: time, uOn: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uOn; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
        void main(){
          float core = pow(abs(dot(vN, vView)), 2.0);
          float h = vUv.y;
          // slams down from the top on ignition
          float reach = smoothstep(1.0 - uOn * 1.3, 1.0 - uOn * 1.3 + 0.15, h);
          float a = core * core * (1.0 - smoothstep(0.25, 0.9, h)) * smoothstep(0.0, 0.08, h) * 0.075 * reach;
          a *= 0.9 + 0.1 * sin(uTime * 0.7 + h * 9.0);
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.62) * a * (1.0 + (1.0 - min(uOn, 1.0)) * 1.2), 1.0);
        }`,
    });
    const beamH = 11;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1.15, beamH, 48, 1, true), beamMat);
    beam.position.set(PLINTH.x, beamH / 2, PLINTH.z);
    scene.add(beam);

    const DUST = phone ? 160 : 420;
    const dustPos = new Float32Array(DUST * 3);
    const dustSeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = Math.random() * 6;
      const rr = Math.sqrt(Math.random()) * (1.3 - y * 0.12);
      dustPos.set([Math.cos(a) * rr, y, Math.sin(a) * rr], i * 3);
      dustSeed[i] = Math.random();
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(dustSeed, 1));
    const dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: world, uPx: { value: dpr }, uOn: { value: 0.25 } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPx, uOn; attribute float aSeed; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.05 + aSeed * 0.08), 6.0);
          p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.15;
          p.z += cos(uTime * 0.25 + aSeed * 30.0) * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min((1.5 + aSeed * 2.5) * uPx * (6.0 / -mv.z), 5.0 * uPx);
          vA = (0.3 + 0.7 * fract(aSeed * 17.0)) * smoothstep(0.0, 0.6, p.y) * (1.0 - smoothstep(4.0, 6.0, p.y)) * uOn;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.85, 0.65) * a * 0.9, 1.0); }`,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.position.copy(PLINTH);
    scene.add(dust);

    // ---------- mist ----------
    const mistTex = (() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const g = cv.getContext("2d")!;
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, "rgba(255,255,255,0.55)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(cv);
    })();
    const mists: THREE.Sprite[] = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: mistTex,
          color: i % 3 ? "#7d8aa0" : "#a0705a",
          transparent: true,
          opacity: 0.07,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const a = (i / 14) * Math.PI * 2;
      s.scale.set(7, 1.6, 1);
      s.position.set(Math.sin(a) * (3 + (i % 3) * 1.6), 0.35, Math.cos(a) * (3 + (i % 3) * 1.6));
      s.userData.seed = Math.random() * 10;
      mists.push(s);
      scene.add(s);
    }

    // a hot glow held in each hand while he's on the plinth
    const handGlows = [0, 1].map(() => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: "#ffb36b", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sp.scale.setScalar(0.0001);
      scene.add(sp);
      return sp;
    });

    // ---------- lights ----------
    const spot = new THREE.SpotLight("#ffd7ae", 0, 14, 0.32, 0.6, 1.6);
    spot.position.set(PLINTH.x, 10.5, PLINTH.z + 0.2);
    spot.target.position.set(PLINTH.x, PLINTH_H, PLINTH.z);
    const wallKey = new THREE.DirectionalLight("#bcd0ff", 0.5);
    wallKey.position.set(-2, 4, -6);
    const screenLight = new THREE.PointLight("#9fb8ff", 0, 7, 1.5);
    const rimR = new THREE.PointLight("#ff8a4a", 0, 6, 1.5);
    // a cold edge light so he reads as a silhouette walking in the dark
    const moon = new THREE.DirectionalLight("#9fb4ff", 1.1);
    moon.position.set(3, 6, -4);
    const back = new THREE.DirectionalLight("#cfdcff", 0.35);
    back.position.set(0, 2, 9);
    scene.add(spot, spot.target, wallKey, screenLight, rimR, moon, back, new THREE.HemisphereLight("#8fa2c8", "#140c08", 0.22));

    // ---------- Gabe ----------
    const gabe = new THREE.Group();
    gabe.position.copy(ARRIVE_FROM);
    scene.add(gabe);
    let headBone: THREE.Object3D | null = null;
    // hands carry the energy on the plinth; feet leave light where they land
    const handBones: THREE.Object3D[] = [];
    const feet: { bone: THREE.Object3D; min: number; down: boolean }[] = [];
    let neckBone: THREE.Object3D | null = null;
    const headRest = new THREE.Quaternion();
    const headWritten = new THREE.Quaternion(NaN, NaN, NaN, NaN);
    let mixer: THREE.AnimationMixer | null = null;
    let idleAct: THREE.AnimationAction | null = null;
    let walkAct: THREE.AnimationAction | null = null;
    const useModel = (gltf: GLTF) => {
      gabe.add(gltf.scene);
      gltf.scene.traverse((o) => {
        if (o.name === "Head") headBone = o;
        if (o.name === "Neck") neckBone = o;
        if (o.name === "LeftHand" || o.name === "RightHand") handBones.push(o);
        if (o.name === "LeftFoot" || o.name === "RightFoot") feet.push({ bone: o, min: 9, down: true });
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && "roughness" in m) m.roughness = 0.8;
        if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
      });
      if (headBone) headRest.copy((headBone as THREE.Object3D).quaternion);
      mixer = new THREE.AnimationMixer(gltf.scene);
      const idle = gltf.animations.find((a) => a.name === "Idle");
      const walk = gltf.animations.find((a) => a.name === "Walk");
      if (idle) {
        idleAct = mixer.clipAction(idle);
        idleAct.play();
      }
      if (walk) {
        walkAct = mixer.clipAction(walk);
        walkAct.setEffectiveWeight(0);
        walkAct.play();
      }
    };
    const gl = new GLTFLoader();
    gl.load("/wall/gabe-rigged.glb", useModel, undefined, () => gl.load("/wall/gabe.glb", useModel, undefined, () => {}));

    // ---------- orb ----------
    const orb = createOrb({ reducedMotion: reduced, quality: phone ? 0 : 1 });
    orb.group.position.set(PLINTH.x + 0.8, 1.9, PLINTH.z);
    scene.add(orb.group);
    const orbPos = new THREE.Vector3().copy(orb.group.position);
    // CRISP lights his shoulder, brighter on the music
    const orbLight = new THREE.PointLight("#7dffa0", 0, 3.5, 1.6);
    scene.add(orbLight);
    let orbKick = 0;

    // ---------- post ----------
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr);
    composer.addPass(new RenderPass(scene, camera));
    const BLOOM = phone ? 0.7 : 0.9;
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.6, 1.02);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(gradeShader);
    composer.addPass(grade);

    // ---------- director state ----------
    let ph: Phase = "arrive";
    let started = false; // ENTER pressed
    let filmT = 0; // seconds since ENTER
    let musicOn = false;
    let buildSent = false;
    let scoreSent = false;
    let igniteT = -1; // seconds since he stepped on; -1 = not yet
    let orbShown = false;
    let menuSent = false;
    let sitesOn = false;
    let sitesT = 0;
    let sitesHit = 0; // sitesT at which the wall lands (on a beat)
    let sitesBoomed = true;
    let launches: number[] = []; // clock times cards leave the orb
    let ribbonAge = -1;
    let shake = 0;
    const lit = { v: 0 }; // 0..1 how lit the room is

    // ---------- interaction state ----------
    const pointer = new THREE.Vector2(0, 0);
    const ptrSmooth = new THREE.Vector2();
    let pointerInside = false;
    let dragging = false,
      dragX = 0,
      dragY = 0,
      dragMoved = 0;
    let hovered: Slot | null = null;
    let active: Slot | null = null;
    let focusT = 0,
      focusTarget = 0,
      focusClock = 0;
    let waveFrom: Slot | null = null,
      waveT = 9;
    let hit = 0;
    // the camera always stays behind him (you never see his face): `heading` trails his
    // facing, and dragging only swings it a little off that
    let heading = 0,
      camYaw = 0,
      camPitch = 0;
    const keys = new Set<string>();
    const walkTarget = new THREE.Vector3(PLINTH.x, 0, PLINTH.z);
    let hasWalkTarget = true; // the entrance walk is just a walk target
    let speed = 0;
    let backing = false;
    let facing = Math.atan2(PLINTH.x - ARRIVE_FROM.x, PLINTH.z - ARRIVE_FROM.z);
    const lookAtPoint = new THREE.Vector3(0, 3, -6);

    // ---------- picking ----------
    const ray = new THREE.Ray();
    const ndc = new THREE.Vector2();
    const setRay = (cx: number, cy: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      ray.origin.copy(camera.position);
      ray.direction.set(ndc.x, ndc.y, 0.5).unproject(camera).sub(camera.position).normalize();
    };
    const sphereHit = (out: THREE.Vector3) => {
      const oc = ray.origin.clone().sub(CENTER);
      const b = oc.dot(ray.direction);
      const c = oc.lengthSq() - R * R;
      return ray.at(-b + Math.sqrt(b * b - c), out);
    };
    const pickTile = (cx: number, cy: number): Slot | null => {
      if (!sitesOn || sitesT < 1.2) return null;
      setRay(cx, cy);
      const p = sphereHit(new THREE.Vector3()).sub(CENTER).divideScalar(R);
      if (ray.direction.y < 0) {
        const tFloor = -ray.origin.y / ray.direction.y;
        const tWall = ray.origin.distanceTo(p.clone().multiplyScalar(R).add(CENTER));
        if (tFloor < tWall) return null;
      }
      const el = Math.asin(THREE.MathUtils.clamp(p.y, -1, 1));
      const az = Math.atan2(p.x, -p.z);
      for (const s of slots) {
        if (Math.abs(wrap(az - s.az)) < TILE_AZ / 2 && Math.abs(el - s.el) < TILE_EL / 2) return s;
      }
      return null;
    };
    const pickFloor = (cx: number, cy: number): THREE.Vector3 | null => {
      setRay(cx, cy);
      if (ray.direction.y >= -0.01) return null;
      const p = ray.at(-ray.origin.y / ray.direction.y, new THREE.Vector3());
      if (Math.hypot(p.x, p.z) > ROAM_R) p.multiplyScalar(ROAM_R / Math.hypot(p.x, p.z));
      p.y = 0;
      return p;
    };

    // ---------- focus ----------
    const open = (s: Slot) => {
      active = s;
      focusTarget = 1;
      focusClock = 0;
      waveFrom = s;
      waveT = 0;
      hit = 1;
      s.mesh.renderOrder = 10;
      s.mat.depthTest = false;
      s.mat.uniforms.uPower.value = 0;
      videoFor(s.tile).play().catch(() => {});
      tag.style.opacity = "0";
      sfx.whoosh(1.3);
      music.duck(0.55);
      setFocused(s.tile);
    };
    const close = () => {
      if (!active) return;
      focusTarget = 0;
      waveFrom = active;
      waveT = 0;
      hit = 0.5;
      sfx.whoosh(0.8);
      music.duck(0);
      setFocused(null);
    };
    closeRef.current = close;

    // ---------- the beat ----------
    /** seconds until the next multiple of `beats` on the score's grid (0 with no music) */
    const untilBeat = (beats: number) => {
      const b = musicOn ? music.beat() : -1;
      if (b < 0) return 0;
      const spb = 60 / music.bpm;
      return ((Math.ceil(b / beats + 0.001) * beats - b) * spb);
    };
    const spb = () => 60 / music.bpm;

    // ---------- the director's moments ----------
    const ignite = () => {
      if (igniteT >= 0) return;
      igniteT = 0;
      ribbonAge = 0;
      if (import.meta.env.DEV) console.debug(`[wall] ignite at film ${filmT.toFixed(3)}s (score hit ${(SCORE_IN + music.hitAt).toFixed(3)}s)`);
      ph = "ignite";
      setPhase("ignite");
      shock.fire();
      hit = 0.5;
      shake = 1;
    };
    const showOrb = () => {
      if (orbShown) return;
      orbShown = true;
      orb.appear();
      orb.setState("hello");
      sfx.blip(true);
    };
    const toMenu = () => {
      if (menuSent) return;
      menuSent = true;
      ph = "menu";
      setPhase("menu");
      orb.setState("idle");
    };
    const skip = () => {
      if (ph === "menu") return;
      started = true;
      filmT = Math.max(filmT, SCORE_IN + music.hitAt + 3.2);
      buildSent = true;
      if (musicOn) {
        scoreSent = true;
        void music.start(filmT - SCORE_IN, true);
      }
      gabe.position.set(PLINTH.x, PLINTH_H, PLINTH.z);
      hasWalkTarget = false;
      facing = Math.PI;
      heading = 0;
      if (igniteT < 0) {
        igniteT = 0;
        shock.fire();
      }
      igniteT = Math.max(igniteT, 3.2);
      ribbonAge = -1;
      showOrb();
      toMenu();
    };

    apiRef.current = {
      showTopic(id) {
        const tp = topics.find((t) => t.id === id);
        if (tp && tp.ring.length && phone) {
          // too small to read as cards in the scene: the phone lists them in CRISP's sheet
          cards.hide(orbPos);
          launches = [];
          tp.ring.forEach((_, i) => sfx.chime((i * 2) % 9, 0.15 + i * CHIP_STEP));
          sfx.whoosh(0.7);
          orb.setState("happy");
          window.setTimeout(() => orb.setState("talking"), 900);
        } else if (tp && tp.ring.length) {
          // one card per eighth note, starting on the next one, each with a note from the score's key
          const first = untilBeat(0.5) + (musicOn ? 0 : 0.15);
          const step = spb() / 2;
          const at = cards.show(tp.label, tp.ring, tp.outer, tp.tint, orbPos, heading, first, step);
          const now = clock.elapsedTime;
          launches = at.map((a) => now + a);
          at.forEach((a, i) => i < tp.ring.length && sfx.chime((i * 2) % 9, a));
          sfx.whoosh(1);
          orb.setState("happy");
          window.setTimeout(() => orb.setState("talking"), 900);
        } else {
          cards.hide(orbPos);
          launches = [];
          orb.setState(id ? "talking" : "idle");
        }
        sfx.blip(false);
      },
      showSites(on) {
        if (on === sitesOn) return;
        sitesOn = on;
        sitesT = 0;
        if (on) {
          // CRISP gathers it up, a riser climbs to the next beat, and on the beat the wall
          // lands: a shockwave, then the screens fly in from the dark in a sweep that
          // starts in front of you and runs round the dome both ways
          cards.hide(orbPos);
          launches = [];
          let rise = untilBeat(2);
          if (rise < 0.9) rise += spb() * 2;
          if (!musicOn) rise = 1.1;
          sitesHit = rise;
          sitesBoomed = false;
          sfx.ignite(rise, 0.8);
          orb.setState("thinking");
          const cd = new THREE.Vector3();
          camera.getWorldDirection(cd);
          const camAz = Math.atan2(cd.x, -cd.z);
          for (const s of slots) {
            const off = Math.abs(wrap(s.az - camAz)) / Math.PI; // 0 in front, 1 behind
            s.delay = rise + off * 1.4 + (ROWS - 1 - Math.abs(s.el) * 4) * 0.02 + Math.random() * 0.08;
          }
        } else {
          if (active) close();
          hovered = null;
          tag.style.opacity = "0";
        }
      },
      setSound(on) {
        sfx.setEnabled(on);
        // entered silently and turned sound on later: start the score where the film is
        if (on && !musicOn && filmT >= SCORE_IN) {
          scoreSent = true;
          void music.start(filmT - SCORE_IN, true);
        }
        else music.setOn(on);
        musicOn = on;
        if (on) sfx.tick();
      },
      skip,
      start(sound) {
        if (started) return;
        started = true;
        filmT = 0;
        if (sound) {
          musicOn = true;
          sfx.setEnabled(true);
          sfx.rumble(SCORE_IN + 0.6);
        }
      },
      canAutoplay() {
        try {
          return sfx.context().state === "running";
        } catch {
          return false;
        }
      },
      orbSay(s) {
        orb.setState(s);
      },
      openTile(id) {
        if (active || !sitesOn || sitesT < 1.2) return;
        // a site appears more than once round the dome: take the copy most in front of you
        let best: Slot | null = null;
        for (const x of slots) if (x.tile.id === id && (!best || x.dir.dot(camDir) > best.dir.dot(camDir))) best = x;
        if (best) open(best);
      },
    };

    // ---------- input ----------
    // A stray tap must never move anything (round 11): on touch only a clean tap on a
    // screen does something, and the finger never steers the camera; with a mouse the
    // floor needs a double-click to walk, so a slipped click stays put.
    const el = renderer.domElement;
    let downAt = 0;
    let downTouch = false;
    let lastFloorClick = -1e9;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      dragX = e.clientX;
      dragY = e.clientY;
      dragMoved = 0;
      downAt = performance.now();
      downTouch = e.pointerType !== "mouse";
    };
    const onCancel = () => {
      dragging = false;
      dragMoved = 1e9;
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (e.pointerType !== "mouse") {
        // fingers only count toward telling a tap from a swipe
        if (dragging) dragMoved += Math.abs(e.clientX - dragX) + Math.abs(e.clientY - dragY);
        dragX = e.clientX;
        dragY = e.clientY;
        return;
      }
      pointerInside = e.clientY < rect.bottom && e.clientY > rect.top;
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      if (dragging && !active && ph === "menu") {
        const dx = e.clientX - dragX,
          dy = e.clientY - dragY;
        dragX = e.clientX;
        dragY = e.clientY;
        dragMoved += Math.abs(dx) + Math.abs(dy);
        camYaw = THREE.MathUtils.clamp(camYaw - (dx / rect.width) * 3.2, -0.7, 0.7);
        camPitch = THREE.MathUtils.clamp(camPitch + (dy / rect.height) * 1.2, -0.25, 0.35);
      }
      if (!active && e.pointerType === "mouse" && ph === "menu" && pointerInside) {
        const h = pickTile(e.clientX, e.clientY);
        if (h !== hovered && h) {
          h.hoverT = 0;
          sfx.tick();
        }
        hovered = h;
        el.style.cursor = hovered ? "pointer" : dragging ? "grabbing" : "crosshair";
        if (hovered) {
          tag.style.opacity = "1";
          tag.style.transform = `translate(${e.clientX - rect.left + 18}px, ${e.clientY - rect.top + 14}px)`;
          const t = hovered.tile;
          if (tag.dataset.id !== t.id) {
            tag.dataset.id = t.id;
            (tag.children[0] as HTMLElement).textContent = t.title;
            (tag.children[1] as HTMLElement).textContent = t.host;
          }
        } else tag.style.opacity = "0";
        setRay(e.clientX, e.clientY);
        sphereHit(lookAtPoint);
      }
    };
    const onUp = (e: PointerEvent) => {
      const wasDrag = dragMoved > (downTouch ? 12 : 8);
      const wasDown = dragging;
      dragging = false;
      if (wasDrag || !wasDown) return;
      if (ph !== "menu") return skip(); // a click during the film skips to the end of it
      if (active) {
        // on a phone the open screen only closes from BACK
        if (!downTouch && focusTarget === 1 && focusClock > 0.6) close();
        return;
      }
      // a long press is a slip or a scroll that didn't move far, not a choice
      if (downTouch && performance.now() - downAt > 450) return;
      const s = pickTile(e.clientX, e.clientY);
      if (s) return open(s);
      if (downTouch) return;
      const now = performance.now();
      const dbl = now - lastFloorClick < 380;
      lastFloorClick = dbl ? -1e9 : now;
      if (!dbl) return;
      const p = pickFloor(e.clientX, e.clientY);
      if (p) {
        walkTarget.copy(p);
        hasWalkTarget = true;
        mark.position.set(p.x, 0.012, p.z);
        markMat.uniforms.uAge.value = 0;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input,textarea,select,button,a")) return;
      if (e.key === "Escape" && active) return close();
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        if (!running || active) return;
        if (ph !== "menu") return skip();
        if (k.startsWith("arrow")) e.preventDefault();
        keys.add(k);
        hasWalkTarget = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      (grade.uniforms.uTexel.value as THREE.Vector2).set(1 / w, 1 / h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const camDir = new THREE.Vector3();
    const syncVideos = () => {
      if (!sitesOn) {
        videos.forEach((v) => !v.paused && v.pause());
        return;
      }
      const ranked = slots.map((s) => ({ s, d: -s.dir.dot(camDir) + Math.abs(s.el) * 0.3 })).sort((a, b) => a.d - b.d);
      const want = new Set<string>();
      if (active) want.add(active.tile.id);
      for (const { s } of ranked) {
        if (want.size >= (phone ? 2 : MAX_PLAYING)) break;
        want.add(s.tile.id);
      }
      for (const t of wallTiles) {
        if (want.has(t.id)) {
          const v = videoFor(t);
          if (v.paused) v.play().catch(() => {});
        } else {
          const v = videos.get(t.id);
          if (v && !v.paused) v.pause();
        }
      }
    };

    document.documentElement.dataset.wall = "on";
    if (reduced) skip();
    // lets the headless checks see whether a tap moved him or the camera
    if (import.meta.env.DEV) (window as unknown as { __wall: () => object }).__wall = () => ({ x: gabe.position.x, z: gabe.position.z, facing, camYaw, ptr: pointer.x, active: !!active });

    // compile every shader now, with everything visible, so the ignition frame doesn't stall
    {
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      camera.position.copy(CENTER);
      renderer.compile(scene, camera);
      composer.render(0);
      hidden.forEach((o) => (o.visible = false));
    }

    // ---------- loop ----------
    const clock = new THREE.Clock();
    const camRight = new THREE.Vector3();
    const camUp = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const shotA = new THREE.Vector3(),
      lookA = new THREE.Vector3(),
      shotB = new THREE.Vector3(),
      lookB = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const qLook = new THREE.Quaternion();
    const eLook = new THREE.Euler(0, 0, 0, "YXZ");
    const proj = new THREE.Vector3();
    const bubbleAt = { x: 0, y: 0 };
    const comets: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];
    const handPos = [new THREE.Vector3(), new THREE.Vector3()];
    const sv = new THREE.Vector3();
    const sv2 = new THREE.Vector3();
    let lastBeat = -1;
    let sparkAcc = 0;
    let raf = 0;
    let running = true;
    let frame = 0;
    let fpsAcc = 0,
      fpsN = 0,
      degraded = false;
    let groundY = 0;
    let sheetCover = 0,
      sheetLift = 0;
    const io = new IntersectionObserver(([en]) => {
      running = en.isIntersecting;
      document.documentElement.dataset.wall = running ? "on" : "off";
      if (!running) keys.clear();
      if (running) {
        clock.getDelta();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(host);

    const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

    function tick() {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      time.value = t;
      frame++;

      if (!degraded && t > 1.5 && t < 6) {
        fpsAcc += dt;
        fpsN++;
        if (fpsN > 90 && fpsAcc / fpsN > 1 / 48) {
          degraded = true;
          dpr = 1;
          renderer.setPixelRatio(1);
          composer.setPixelRatio(1);
          resize();
        }
      }

      // ---- director ----
      if (started) filmT += dt;
      // slow motion for the entrance; the world speeds back up after the ignition
      const rate = reduced ? 1 : igniteT < 0 ? SLOWMO : THREE.MathUtils.lerp(SLOWMO, 1, smooth(igniteT, 1.2, 4.5));
      world.value += dt * rate;
      const wt = world.value;
      // the score, as the scene hears it: a level and the beat
      const pulse = musicOn ? music.level() : 0;
      const b = musicOn ? music.beat() : -1;
      const kick = b < 0 ? 0 : Math.exp(-(b - Math.floor(b)) * 7) * pulse;
      // the whoosh rises for 1.1 s and its boom lands on the hit
      if (started && musicOn && !scoreSent && filmT >= SCORE_IN) {
        scoreSent = true;
        void music.start(filmT - SCORE_IN, true);
      }
      if (started && !buildSent && filmT >= SCORE_IN + music.hitAt - 1.1) {
        buildSent = true;
        sfx.ignite(1.1, 0.8);
      }
      if (igniteT >= 0) igniteT += dt;
      if (igniteT > 1.6) showOrb();
      if (igniteT > 2.7) toMenu();
      lit.v = igniteT < 0 ? 0 : smooth(igniteT, 0, 2.2);
      const flare = igniteT < 0 ? 0 : Math.exp(-igniteT * 1.6) * smooth(igniteT, 0, 0.08);

      // ---- walking ----
      const fwdX = -Math.sin(camYaw),
        fwdZ = -Math.cos(camYaw);
      let mx = 0,
        mz = 0;
      // A/D turn him, W/S walk forward and back: he never turns round to face the camera
      const turn = (keys.has("a") || keys.has("arrowleft") ? 1 : 0) - (keys.has("d") || keys.has("arrowright") ? 1 : 0);
      if (turn && !active) facing += turn * TURN_SPEED * dt;
      const fwd = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      backing = fwd < 0;
      if (fwd) (mx += Math.sin(facing) * fwd), (mz += Math.cos(facing) * fwd);
      void fwdX;
      void fwdZ;
      if (hasWalkTarget && !mx && !mz) {
        const dx = walkTarget.x - gabe.position.x,
          dz = walkTarget.z - gabe.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.06) hasWalkTarget = false;
        else {
          mx = dx / d;
          mz = dz / d;
        }
      }
      const ml = Math.hypot(mx, mz);
      let top = backing ? WALK_SPEED * 0.45 : WALK_SPEED;
      if (ph === "arrive") {
        // pace the entrance so his foot finds the plinth on the score's hit
        const left = Math.max(0, Math.hypot(gabe.position.x - PLINTH.x, gabe.position.z - PLINTH.z) - PLINTH_R * 0.55);
        top = THREE.MathUtils.clamp(left / Math.max(0.15, SCORE_IN + music.hitAt - filmT), 0.18, 1.0);
      }
      // the entrance holds a beat in the dark before he starts walking
      const canMove = !active && (ph !== "arrive" || (started && filmT > 0.7));
      speed = damp(speed, ml > 0.01 && canMove ? top : 0, ph === "arrive" ? 3 : 6, dt);
      // a click-to-walk turns him toward the spot; the keys already set his facing
      if (ml > 0.01 && !keys.size) facing += wrap(Math.atan2(mx, mz) - facing) * (1 - Math.exp(-6 * dt));
      if (speed > 0.01 && ml > 0.01) {
        gabe.position.x += (mx / ml) * speed * dt;
        gabe.position.z += (mz / ml) * speed * dt;
        const rr = Math.hypot(gabe.position.x, gabe.position.z);
        if (rr > ROAM_R) {
          gabe.position.x *= ROAM_R / rr;
          gabe.position.z *= ROAM_R / rr;
        }
      }
      const fromPlinth = Math.hypot(gabe.position.x - PLINTH.x, gabe.position.z - PLINTH.z);
      groundY = damp(groundY, fromPlinth < PLINTH_R + 0.05 ? PLINTH_H : 0, 14, dt);
      gabe.position.y = groundY;
      gabe.rotation.y = facing;
      if (fromPlinth < PLINTH_R * 0.55) ignite();

      const moving = speed / WALK_SPEED;
      if (walkAct && idleAct) {
        const w = Math.min(1, speed / 0.22);
        walkAct.setEffectiveWeight(w);
        idleAct.setEffectiveWeight(1 - w);
        // the stride matches the ground covered, so the slow entrance reads as slow motion
        walkAct.timeScale = Math.max(0.2, speed / CLIP_SPEED) * (backing ? -1 : 1);
      } else if (!walkAct) {
        gabe.position.y += Math.abs(Math.sin(t * 8.5)) * 0.035 * moving;
      }
      mixer?.update(dt);

      screenLight.position.set(gabe.position.x * 0.8, 2.6, gabe.position.z - 2.4);
      screenLight.intensity = (sitesOn ? 4.5 : 1.2) * lit.v + Math.sin(t * 3.1) * 0.3 * lit.v;
      rimR.position.set(gabe.position.x + 1.4, 1.6, gabe.position.z - 0.6);
      rimR.intensity = 6 * lit.v;
      // a cold backlight finds his outline while he walks in the dark
      back.intensity = 0.35 + (1 - lit.v) * 0.9;

      // ---- camera ----
      ptrSmooth.x = damp(ptrSmooth.x, pointer.x, 3, dt);
      ptrSmooth.y = damp(ptrSmooth.y, pointer.y, 3, dt);
      // the camera trails behind whichever way he faces; a drag swings it a little, then lets go
      heading += wrap(facing + Math.PI - heading) * (1 - Math.exp(-2.2 * dt));
      if (!dragging) camYaw = damp(camYaw, 0, 0.9, dt);
      const yaw = heading + camYaw;
      const bx = gabe.position.x,
        bz = gabe.position.z;
      // the rig: third person behind him, lifted and pulled back while the wall is up
      const lift = sitesOn ? smooth(sitesT, 0, Math.max(1.2, sitesHit + 0.6)) : 0;
      // a portrait phone is tall and narrow: stand further back so the rings fit across,
      // and aim lower so he sits between the headline and CRISP's panel
      const tall = THREE.MathUtils.clamp((0.95 - camera.aspect) / 0.45, 0, 1);
      let dist = CAM_DIST + lift * 1.1 + tall * 1.3;
      camPos.set(bx + Math.sin(yaw) * dist, CAM_H + camPitch * 3 + groundY * 0.5 + lift * 0.45 + tall * 0.25, bz + Math.cos(yaw) * dist);
      tmp.copy(camPos).sub(CENTER);
      if (tmp.length() > 9.2) {
        dist *= 9.2 / tmp.length();
        camPos.set(bx + Math.sin(yaw) * dist, camPos.y, bz + Math.cos(yaw) * dist);
      }
      // on a phone, the taller CRISP's sheet grows (a topic's chips, the request form),
      // the higher he rides in the frame so it never covers him
      if (phone && frame % 10 === 0) sheetCover = orbShown && !sitesOn ? bubble.offsetHeight / Math.max(1, host.clientHeight) : 0;
      sheetLift = damp(sheetLift, Math.max(0, sheetCover - 0.27), 2.5, dt);
      look.set(bx - Math.sin(yaw) * 6.2, 1.95 + camPitch * 4 + lift * 0.9 - tall * (1.7 - lift * 1.2) - sheetLift * 7, bz - Math.cos(yaw) * 6.2);
      // the film, always from behind him: a low hero angle at his heels looking up past him,
      // rising over his shoulder as he nears the plinth, then a crane up into the rig once it ignites
      if (ph !== "menu" || igniteT < 4.2) {
        const p = THREE.MathUtils.clamp((ARRIVE_FROM.z - gabe.position.z) / (ARRIVE_FROM.z - PLINTH.z), 0, 1);
        // opens on his feet: the floor at ankle height, each step lighting the mirror, then
        // cranes up behind him to show the plinth waiting
        // three slow shots, all from behind: his feet on the mirror; over his shoulder,
        // looking down at the plinth ahead; then low and wide as he reaches it
        shotA.set(bx + 0.38, 0.14, bz + 1.7);
        lookA.set(bx - 0.05, 0.42, bz - 2.4);
        shotB.set(bx + 0.62, 1.72, bz + 1.35);
        lookB.set(bx - 0.25, 0.75, bz - 2.6);
        shotA.lerp(shotB, smooth(p, 0.3, 0.44));
        lookA.lerp(lookB, smooth(p, 0.3, 0.44));
        shotB.set(bx + 0.55, 0.62, bz + 4.1);
        lookB.set(bx - 0.05, 1.35, bz - 5);
        shotA.lerp(shotB, smooth(p, 0.58, 0.9));
        lookA.lerp(lookB, smooth(p, 0.58, 0.9));
        const crane = igniteT < 0 ? 0 : smooth(igniteT, 0.9, 4.2);
        camPos.lerpVectors(shotA, camPos, crane);
        look.lerpVectors(lookA, look, crane);
      }
      const settled = ph === "menu" ? 1 : 0;
      const par = active ? 0 : settled;
      const sway = reduced ? 0 : 1;
      camPos.x += (-ptrSmooth.x * 0.35 + Math.sin(t * 0.31) * 0.06 * sway) * par + Math.sin(t * 0.4) * 0.025 * (1 - settled) * sway;
      camPos.y += (-ptrSmooth.y * 0.15 + Math.sin(t * 0.23) * 0.04 * sway) * par;
      look.x += ptrSmooth.x * 0.9 * par;
      look.y += ptrSmooth.y * 0.5 * par;
      shake = damp(shake, 0, 3, dt);

      // ---- focus ----
      focusClock += dt;
      focusT = damp(focusT, focusTarget, focusTarget ? 3.4 : 5, dt);
      const ease = focusT * focusT * (3 - 2 * focusT);
      const land = active && focusTarget ? Math.max(0, 1 - Math.abs(focusClock - 0.75) * 5) : 0;
      camera.fov = damp(camera.fov, BASE_FOV + (active ? 9 * Math.sin(Math.min(1, focusClock / 0.9) * Math.PI) : 0) + flare * 6 + lift * 8, 6, dt);
      camera.updateProjectionMatrix();
      const jolt = land * 0.03 + shake * 0.06;
      camPos.x += (Math.random() - 0.5) * jolt;
      camPos.y += (Math.random() - 0.5) * jolt;
      camera.position.copy(camPos);
      camera.lookAt(look);
      // a slight dutch tilt on the low shot, levelling as the camera rises
      if (ph === "arrive" && !reduced) {
        const pA = THREE.MathUtils.clamp((ARRIVE_FROM.z - gabe.position.z) / (ARRIVE_FROM.z - PLINTH.z), 0, 1);
        camera.rotateZ(0.07 * (1 - smooth(pA, 0.15, 0.75)));
      }
      camera.updateMatrixWorld();

      camera.getWorldDirection(camDir);
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      camUp.setFromMatrixColumn(camera.matrixWorld, 1);
      const fd = 1.4;
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * fd;
      const halfW = halfH * camera.aspect;
      let fh = halfH * 0.5,
        fw = fh * 1.6;
      if (fw > halfW * 0.86) {
        fw = halfW * 0.86;
        fh = fw / 1.6;
      }
      fw /= 1 + 2 * MARGIN;
      fh /= 1 + 2 * MARGIN;
      flatC.copy(camera.position).addScaledVector(camDir, fd).addScaledVector(camUp, halfH * 0.02);
      flatR.copy(camRight).multiplyScalar(fw);
      flatU.copy(camUp).multiplyScalar(fh);
      flatF.copy(camDir).negate();

      if (active && focusTarget === 0 && focusT < 0.002) {
        const a = active as Slot;
        a.mat.uniforms.uFocus.value = 0;
        a.mat.uniforms.uTwist.value = 0;
        a.mesh.renderOrder = 0;
        a.mat.depthTest = true;
        active = null;
      }

      // ---- wall ----
      sitesT += dt;
      waveT += dt;
      hit = damp(hit, 0, 3.2, dt);
      // the wall lands on the beat
      if (sitesOn && !sitesBoomed && sitesT >= sitesHit) {
        sitesBoomed = true;
        shock.fire();
        hit = 1;
        shake = 0.7;
        ribbonAge = 0;
        orbKick = 1.5;
        orb.setState("happy");
      }
      const charge = sitesOn && !sitesBoomed ? smooth(sitesT, 0, sitesHit) : 0;
      for (const s of slots) {
        const u = s.mat.uniforms;
        const rv = sitesOn ? smooth(sitesT - s.delay, 0, 1.3) : Math.max(0, (u.uReveal.value as number) - dt * 2.2);
        u.uReveal.value = rv;
        s.mesh.visible = rv > 0.001;
        if (!s.mesh.visible) continue;
        s.hover = damp(s.hover, s === hovered && !active ? 1 : 0, 9, dt);
        s.hoverT += dt;
        u.uHover.value = s.hover;
        u.uHoverT.value = s.hoverT;
        const isActive = s === active;
        u.uFocus.value = isActive ? ease : 0;
        u.uTwist.value = isActive ? Math.sin(ease * Math.PI) * 0.9 * (focusTarget ? 1 : -1) : 0;
        if (isActive) {
          u.uPower.value = focusTarget ? smooth(focusClock, 0.55, 1.25) : 1;
          u.uFlash.value = focusTarget ? Math.max(0, 1 - focusClock * 2.2) : 0;
        } else {
          // each screen flashes as it arrives
          const since = sitesT - s.delay - 0.9;
          u.uFlash.value = sitesOn && since > 0 && since < 0.8 ? Math.exp(-since * 6) * 0.9 : 0;
        }
        u.uDim.value = active && !isActive ? 1 - ease * 0.85 : 1;
        if (waveFrom && waveT < 2.2 && !isActive) {
          const ang = Math.acos(THREE.MathUtils.clamp(s.dir.dot(waveFrom.dir), -1, 1));
          u.uPush.value = Math.exp(-Math.pow((ang - waveT * 2.6) * 4.5, 2)) * 0.9 * Math.max(0, 1 - waveT / 2.2);
        } else u.uPush.value = 0;
      }

      // ---- orb: floats off his right shoulder, as the camera sees it ----
      tmp.set(gabe.position.x, gabe.position.y + 1.95, gabe.position.z).addScaledVector(camRight, 0.85);
      tmp.y += Math.sin(t * 1.3) * 0.05 + kick * 0.04 + charge * 0.25;
      orbPos.lerp(tmp, 1 - Math.exp(-(orbShown ? 2.5 : 20) * dt));
      // it moves with the music, jolts as it throws each card out, and swells while it charges the wall
      while (launches.length && t >= launches[0]) {
        launches.shift();
        orbKick = 1;
      }
      orbKick = damp(orbKick, 0, 9, dt);
      orb.group.position.copy(orbPos);
      orb.group.scale.setScalar(1 + pulse * 0.14 + kick * 0.08 + orbKick * 0.16 + charge * 0.35);
      orbLight.position.copy(orbPos);
      orbLight.intensity = orbShown ? 0.6 + pulse * 2.4 + orbKick * 2 + charge * 4 : 0;
      orb.lookAt(pointerInside && ph === "menu" && !active ? lookAtPoint : null);
      orb.update(dt, t, camera);
      orb.group.visible = orbShown && ease < 0.5;

      // ---- head: looks at the orb when it arrives, then follows the cursor ----
      if (headBone) {
        const hb = headBone as THREE.Object3D;
        if (hb.quaternion.equals(headWritten)) hb.quaternion.copy(headRest);
        headRest.copy(hb.quaternion);
        let yaw = 0,
          pitch = 0;
        const watchOrb = orbShown && igniteT < 5.5;
        const target = active ? flatC : watchOrb ? orbPos : pointerInside && !keys.size && ph === "menu" ? lookAtPoint : null;
        if (target && moving < 0.3) {
          tmp.copy(target).sub(gabe.position);
          tmp.y -= 1.6;
          // a small turn only: from behind you see him look, never his face
          yaw = THREE.MathUtils.clamp(wrap(Math.atan2(tmp.x, tmp.z) - facing), -0.45, 0.45);
          pitch = THREE.MathUtils.clamp(Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)), -0.25, 0.25);
        }
        const cur = (hb.userData.look as { y: number; p: number }) ?? { y: 0, p: 0 };
        cur.y = damp(cur.y, yaw, 4, dt);
        cur.p = damp(cur.p, pitch, 4, dt);
        hb.userData.look = cur;
        eLook.set(cur.p, cur.y, 0); // signs verified on gabe-rigged.glb: cursor left -> looks left
        hb.quaternion.multiply(qLook.setFromEuler(eLook));
        headWritten.copy(hb.quaternion);
        if (neckBone) (neckBone as THREE.Object3D).rotation.y = cur.y * 0.25;
      }

      // ---- the plinth and the room ----
      const ringGlow = (4.2 + Math.sin(t * 1.6) * 0.5 + pulse * 3) * lit.v + flare * 5 + charge * 6;
      ringMat.color.setRGB(1, 0.48, 0.19).multiplyScalar(ringGlow);
      ring2Mat.color.setRGB(1, 0.69, 0.37).multiplyScalar(1.6 * lit.v + flare * 4);
      // before it ignites, the plinth edge breathes faintly so you know where he's headed
      // before it ignites, the plinth edge beats with the score, harder the closer he gets
      const near = igniteT < 0 ? THREE.MathUtils.clamp((ARRIVE_FROM.z - gabe.position.z) / (ARRIVE_FROM.z - PLINTH.z), 0, 1) : 0;
      if (igniteT < 0) ringMat.color.setRGB(1, 0.48, 0.19).multiplyScalar(0.25 + near * 0.8 + kick * (0.5 + near * 3) + 0.15 * Math.sin(t * 2.2));
      topMat.uniforms.uOn.value = lit.v;
      poolMat.uniforms.uOn.value = lit.v * (1 + pulse * 0.5) + flare * 0.35 + charge * 0.6;
      beamMat.uniforms.uOn.value = igniteT < 0 ? 0 : smooth(igniteT, 0.05, 0.6) + flare * 0.2 + kick * 0.25 + charge * 0.6;
      spot.intensity = 60 * lit.v + flare * 35 + kick * 18 + near * near * 14;
      dustMat.uniforms.uOn.value = 0.25 + lit.v * 0.75;
      dome.mat.uniforms.uOn.value = igniteT < 0 ? 0 : smooth(igniteT, 0.2, 3.0);
      dome.mat.uniforms.uTime.value = t;
      // the rings wrap round him wherever he stands
      glyphs.group.position.set(gabe.position.x, groundY, gabe.position.z);
      glyphs.update(wt, dt * rate, igniteT < 0 ? 0 : smooth(igniteT, 0.15, 3.2), (1 - 0.45 * smooth(igniteT, 5, 8)) * (1 + charge), pulse + kick * 0.6);
      ribbons.group.position.set(gabe.position.x, groundY, gabe.position.z);
      if (ribbonAge >= 0) ribbonAge += dt * (sitesOn ? 1.4 : rate * 1.6);
      ribbons.update(ribbonAge);
      sigil.mat.uniforms.uOn.value = igniteT < 0 ? 0 : smooth(igniteT, 0.0, 2.6);
      sigil.mat.uniforms.uTime.value = wt;
      sigil.mat.uniforms.uPulse.value = pulse * 0.6 + kick * 0.5 + charge;
      vortex.mat.uniforms.uTime.value = wt;
      // a full swirl for the ignition, then just a few embers drifting up; it surges again for the wall
      vortex.mat.uniforms.uOn.value = igniteT < 0 ? 0 : smooth(igniteT, 0, 0.3) * (1 - 0.65 * smooth(igniteT, 4, 7)) + charge * 0.8;
      vortex.mat.uniforms.uBurst.value = (igniteT < 0 ? 0 : Math.exp(-igniteT * 0.9) * smooth(igniteT, 0, 0.15)) + charge * 0.7;
      shock.update(dt);
      cards.update(dt, t, tmp.set(gabe.position.x, groundY, gabe.position.z), pulse);
      ash.mat.uniforms.uTime.value = wt;
      ash.mat.uniforms.uOn.value = 0.6 + lit.v * 0.4;

      // ---- footsteps: light on the mirror (and a thud) where each foot lands ----
      for (const f of feet) {
        f.bone.getWorldPosition(sv);
        const y = sv.y - groundY;
        f.min = Math.min(f.min + dt * 0.01, y);
        const down = y < f.min + 0.02;
        if (down && !f.down && speed > 0.1) {
          ripples.spawn(sv.x, groundY, sv.z, ph === "arrive" ? 1 : 0.45);
          sfx.step(ph === "arrive" ? 1 : 0.35);
          if (ph === "arrive") sparks.emit(sv.set(sv.x, groundY + 0.03, sv.z), sv2.set(0, 0.5, 0), 0.9, 6, 0.7);
        }
        f.down = down;
      }
      ripples.update(dt);

      // ---- the rings throw sparks, and on the beat, lightning finds his hands ----
      const onPlinth = fromPlinth < PLINTH_R && igniteT > 0;
      const handOn = onPlinth ? smooth(igniteT, 0.6, 2.5) : 0;
      handBones.forEach((h, i) => h.getWorldPosition(handPos[i]).add(sv.set(0, -0.06, 0)));
      handGlows.forEach((g, i) => {
        const on = handBones[i] ? handOn : 0;
        g.position.copy(handPos[i]);
        g.scale.setScalar(Math.max(0.0001, (0.16 + pulse * 0.1 + kick * 0.12) * on));
        g.material.opacity = on * (0.75 + pulse * 0.25);
      });
      glyphs.comets(comets);
      const ringsLit = igniteT < 0 ? 0 : smooth(igniteT, 0.8, 2.5);
      sparkAcc += dt * (12 + pulse * 30) * ringsLit * (reduced ? 0 : 1);
      while (sparkAcc >= 1) {
        sparkAcc -= 1;
        const c = comets[Math.floor(Math.random() * comets.length)];
        if (c && !isNaN(c.p.x)) sparks.emit(c.p, sv.copy(c.d).multiplyScalar(1.3).add(sv2.set(0, 0.35, 0)), 0.5, 1, 0.8);
        if (handOn > 0.5 && Math.random() < 0.3) sparks.emit(handPos[Math.floor(Math.random() * 2)], sv.set(0, 0.25, 0), 0.4, 1, 0.6);
      }
      const beatNow = b < 0 ? -1 : Math.floor(b);
      if (beatNow > lastBeat) {
        if (lastBeat >= 0 && !reduced && ringsLit > 0.9) {
          // a burst off every comet on the beat
          for (const c of comets) if (!isNaN(c.p.x)) sparks.emit(c.p, sv.copy(c.d).multiplyScalar(1.6), 0.9, 5, 0.9);
          if (onPlinth && handBones.length && ph === "menu" && pulse > 0.12 && Math.random() < 0.6) {
            const c = comets[Math.floor(Math.random() * comets.length)];
            if (c && !isNaN(c.p.x)) {
              arcs.strike(c.p, handPos[Math.floor(Math.random() * handBones.length)]);
              sfx.zap(0.8);
            }
          }
        }
        lastBeat = beatNow;
      }
      // the ignition itself: lightning from the plinth's edge up into both hands
      if (igniteT > 0.05 && igniteT - dt <= 0.05 && handBones.length) {
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          arcs.strike(sv.set(PLINTH.x + Math.cos(a) * PLINTH_R, PLINTH_H, PLINTH.z + Math.sin(a) * PLINTH_R), handPos[i % handBones.length], 0.35);
        }
      }
      sparks.update(dt * (igniteT < 0 ? rate : 1));
      arcs.update(dt);
      markMat.uniforms.uAge.value += dt;
      for (const m of mists) {
        const sd = m.userData.seed as number;
        m.position.x += Math.sin(wt * 0.05 + sd) * 0.002 * rate;
        (m.material as THREE.SpriteMaterial).opacity = 0.03 + 0.02 * lit.v + 0.02 * Math.sin(wt * 0.2 + sd) + pulse * 0.015;
      }

      // ---- the orb's speech bubble follows it on screen ----
      if (orbShown) {
        proj.copy(orbPos).project(camera);
        const rect = host.getBoundingClientRect();
        const sx = (proj.x * 0.5 + 0.5) * rect.width;
        const sy = (-proj.y * 0.5 + 0.5) * rect.height;
        // it drifts after the orb, but holds still while you're using it
        const busy = bubble.matches(":hover") || bubble.contains(document.activeElement);
        if (!phone && !busy) {
          const bw = bubble.offsetWidth,
            bh = bubble.offsetHeight;
          const x = THREE.MathUtils.clamp(sx + 46, 16, rect.width - bw - 16);
          // stay inside the picture, clear of the HUD in the letterbox bars
          const barPx = Math.max(56, barFor(camera.aspect, 2.05) * rect.height);
          const y = THREE.MathUtils.clamp(sy - 40, barPx + 24, rect.height - bh - barPx - 24);
          bubbleAt.x = damp(bubbleAt.x || x, x, 3, dt);
          bubbleAt.y = damp(bubbleAt.y || y, y, 3, dt);
          bubble.style.transform = `translate(${Math.round(bubbleAt.x)}px, ${Math.round(bubbleAt.y)}px)`;
        }
      }

      // ---- lens ----
      const aspect = camera.aspect;
      // on a portrait phone a true 2.39 crop would black out most of the screen, so the bars stay slim there
      const filmBar = phone ? 0.09 : barFor(aspect, 2.39);
      const restBar = phone ? 0 : barFor(aspect, 2.05);
      const bar = THREE.MathUtils.lerp(filmBar, restBar, reduced ? 1 : igniteT < 0 ? 0 : smooth(igniteT, 2.5, 4.5));
      grade.uniforms.uBar.value = THREE.MathUtils.lerp(bar, Math.max(bar, phone ? 0.06 : filmBar), ease);
      grade.uniforms.uTime.value = t;
      grade.uniforms.uFade.value = Math.min(1, filmT / 2.4);
      grade.uniforms.uHit.value = reduced ? 0 : hit;
      bloom.strength = BLOOM + hit * 0.9 + flare * 0.3 + kick * 0.15 + charge * 0.4;

      if (frame % 15 === 0) syncVideos();
      composer.render(dt);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      delete document.documentElement.dataset.wall;
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      videos.forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      orb.dispose();
      music.dispose();
      sfx.dispose();
      composer.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      apiRef.current = null;
    };
  }, []);

  const inMenu = phase === "menu";
  const shown = inMenu && !focused;
  const current = topics.find((t) => t.id === topic);

  const pick = (id: TopicId) => {
    setSheetMin(false);
    setAllModels(false);
    setTopic(id);
    setMenuOpen(false);
    setSitesView("menu");
    setOpenQ(null);
    apiRef.current?.showTopic(id);
    if (id !== "sites") apiRef.current?.showSites(false);
  };
  const goSites = (v: SitesView) => {
    setSitesView(v);
    setSend("idle");
    setAsking(false);
    apiRef.current?.showSites(v === "see");
    apiRef.current?.orbSay(v === "faq" ? "thinking" : v === "request" ? "listening" : "happy");
  };

  /** questions and requests go to the inbox Worker, and from there to Gabe's Mac (T731) */
  const submit = async (kind: "request" | "question") => {
    setSend("sending");
    apiRef.current?.orbSay("thinking");
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, ...form, topic: kind === "request" ? form.topic : "" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSend("sent");
      setForm((f) => ({ ...f, message: "" }));
      apiRef.current?.orbSay("happy");
    } catch {
      setSend("error");
      apiRef.current?.orbSay("listening");
    }
  };
  const workWithMe = () => {
    pick("sites");
    goSites("request");
  };

  const orbLine = !topic
    ? "Hey, I'm CRISP. What can I show you?"
    : topic === "sites"
      ? sitesView === "see"
        ? phone ? "Here they are. Swipe the row and tap one to open it." : "Here they are — click any screen to open it."
        : sitesView === "request"
          ? send === "sent"
            ? "Sent. It's already on Gabe's computer."
            : "Tell me what you need — it goes straight to Gabe."
          : sitesView === "faq"
            ? send === "sent"
              ? "Got it — Gabe will get back to you by email."
              : asking
                ? "Ask away — it goes straight to Gabe."
                : "Here's what people usually ask."
            : current!.line
      : current!.line;

  // the film always plays with its score; browsers only allow that after one click,
  // unless this visitor has already been here and the browser remembers it
  const enter = () => {
    if (entered) return;
    setEntered(true);
    setSound(true);
    apiRef.current?.start(true);
  };
  useEffect(() => {
    const id = window.setTimeout(() => apiRef.current?.canAutoplay() && enter(), 300);
    const onKey = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && enter();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  return (
    <section
      id="top"
      className="wall-hud relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-[#030303]"
      style={{ "--bar": `${bar}px` } as React.CSSProperties}
    >
      <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />

      {/* a quiet ground for the type, only once the room is lit */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${inMenu ? "opacity-100" : "opacity-0"}`}
        style={{ background: "radial-gradient(55% 50% at 0% 30%, rgba(3,3,3,0.78), rgba(3,3,3,0) 70%)" }}
      />

      <div ref={tagRef} aria-hidden="true" className="hud-tag pointer-events-none absolute left-0 top-0 z-10 opacity-0">
        <p className="font-display text-[19px] leading-none text-text-primary" />
        <p className="mt-1.5 font-mono text-[9px] tracking-[0.2em] text-[#FFB15E]" />
      </div>

      {/* ---------- gate: one click so the score can play ---------- */}
      <button
        type="button"
        onClick={enter}
        aria-label="Enter"
        className={`wall-gate absolute inset-0 z-40 flex cursor-pointer flex-col items-center justify-center bg-[#030303] transition-opacity duration-[1400ms] ${
          entered ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <span className="font-display text-[54px] leading-none text-text-primary md:text-[76px]">
          Gabe <em className="text-[#FFB15E]">Mills</em>
        </span>
        <span className="wall-gate-cue hud-label mt-10 text-white/55">Click to enter</span>
      </button>

      {/* the one control left on screen: mute */}
      <button
        type="button"
        onClick={() => {
          const on = !sound;
          setSound(on);
          apiRef.current?.setSound(on);
        }}
        aria-label={sound ? "Mute" : "Unmute"}
        aria-pressed={sound}
        className={`absolute z-30 transition-opacity duration-1000 ${phone ? "right-2 top-[max(8px,env(safe-area-inset-top))] p-4" : "bottom-5 right-5 p-2 md:bottom-7 md:right-8"} ${inMenu ? "opacity-60 hover:opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <span className={`hud-eq ${sound ? "is-on" : ""}`} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>

      {/* headline */}
      <div className={`wall-reveal pointer-events-none absolute left-5 top-[calc(var(--bar)+28px)] z-20 max-w-[36rem] md:left-14 md:top-[calc(var(--bar)+8vh)] ${shown ? "is-in" : ""} ${topic ? "!opacity-0" : ""}`}>
        <p className={phone ? "text-[13px] tracking-[0.04em] text-[#FFB15E]" : "hud-label text-[#FFB15E]"}>{phone ? "Websites · Games · AI tools" : "WEBSITES · GAMES · AI TOOLS"}</p>
        <h1 className="mt-3 font-display text-[44px] leading-[0.95] tracking-[-0.01em] text-text-primary md:text-[64px]">
          I build things
          <br />
          people <em className="text-[#FFB15E]">remember.</em>
        </h1>
        <div className="mt-6 hidden w-max grid-cols-2 gap-x-8 gap-y-3 md:grid">
          {wallStats.map((st, i) => (
            <Stat key={st.label} {...st} start={inMenu} delay={500 + i * 140} />
          ))}
        </div>
        <div className="mt-7 flex items-center gap-3">
          <button type="button" onClick={workWithMe} className={`hud-btn hud-btn-primary pointer-events-auto ${phone ? "sheet-btn hero-btn" : ""}`}>
            {phone ? "Work with me →" : "WORK WITH ME →"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (phone) setSheetMin(false);
              else setMenuOpen(true);
              apiRef.current?.orbSay("hello");
            }}
            className={`hud-btn pointer-events-auto ${phone ? "sheet-btn hero-btn" : ""}`}
          >
            {phone ? "Ask CRISP" : "ASK CRISP"}
          </button>
        </div>
      </div>

      {/* ---------- CRISP: a floating panel on desktop, a bottom sheet on phones ---------- */}
      <div
        ref={bubbleRef}
        className={`wall-bubble absolute z-30 ${phone ? "wall-sheet inset-x-0 bottom-0" : "max-md:inset-x-3 max-md:bottom-[64px] md:left-0 md:top-0 md:w-[348px]"} ${inMenu && !focused ? "is-in" : ""}`}
      >
        <div className={`hud-panel ${phone ? "sheet-panel" : ""}`}>
          {phone ? (
            <button type="button" onClick={() => setSheetMin((m) => !m)} aria-expanded={!sheetMin} className="sheet-head">
              <span className="sheet-grab" aria-hidden="true" />
              <span className="hud-label flex items-center gap-2 text-[#9dffb0]">
                <span className={`h-1.5 w-1.5 rounded-full bg-[#9dffb0] shadow-[0_0_8px_#9dffb0] ${send === "sending" ? "animate-ping" : "animate-pulse"}`} />
                CRISP
              </span>
              <span className="sheet-toggle">{send === "sending" ? "Sending…" : sheetMin ? "Show ▲" : "Hide ▼"}</span>
            </button>
          ) : (
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
              <p className="hud-label flex items-center gap-2 text-[#9dffb0]">
                <span className={`h-1.5 w-1.5 rounded-full bg-[#9dffb0] shadow-[0_0_8px_#9dffb0] ${send === "sending" ? "animate-ping" : "animate-pulse"}`} />
                CRISP
              </p>
              <p className="hud-label text-muted">{send === "sending" ? "SENDING…" : "ONLINE"}</p>
            </div>
          )}
          <div className={phone ? `sheet-body ${sheetMin ? "is-min" : ""}` : "p-4"}>
            <p className={`min-h-[2.6em] leading-snug text-text-primary ${phone ? "text-[16px]" : "text-[15px]"}`}>
              <Typed text={orbLine} />
            </p>

            {phone ? (
              // every topic one tap away, no dropdown; hidden while the wall is up so you can see it
              !(topic === "sites" && sitesView === "see") &&
              (topic ? (
                // once a topic is open the switcher shrinks to one row, so the sheet stays short
                <div className="sheet-pills mt-3">
                  {topics.map((tp) => (
                    <button key={tp.id} type="button" onClick={() => pick(tp.id)} className={`sheet-pill ${topic === tp.id ? "is-on" : ""}`} aria-pressed={topic === tp.id}>
                      {tp.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {topics.map((tp) => (
                    <button key={tp.id} type="button" onClick={() => pick(tp.id)} className={`sheet-topic ${topic === tp.id ? "is-on" : ""}`} aria-pressed={topic === tp.id}>
                      <span className="text-[15px] font-medium leading-tight text-text-primary">{tp.label}</span>
                      <span className="text-[12.5px] text-muted">
                        {tp.ring.length ? `${tp.ring.length + (tp.outer?.length ?? 0)} items` : `${wallTiles.length} live sites`}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="relative mt-3">
                <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} className="hud-select">
                  <span>{current ? current.label : "Choose a topic"}</span>
                  <span className={`text-[9px] transition-transform ${menuOpen ? "rotate-180" : ""}`}>▼</span>
                </button>
                <ul className={`hud-menu ${menuOpen ? "is-open" : ""}`}>
                  {topics.map((tp, i) => (
                    <li key={tp.id}>
                      <button type="button" onClick={() => pick(tp.id)} style={{ transitionDelay: menuOpen ? `${i * 40}ms` : "0ms" }} className="hud-option">
                        <span className="font-mono text-[10px] text-muted">0{i + 1}</span>
                        <span className="flex-1 text-text-primary">{tp.label}</span>
                        <span className="font-mono text-[10px] text-muted">
                          {tp.ring.length ? tp.ring.length + (tp.outer?.length ?? 0) : `${wallTiles.length} LIVE`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {current && current.id !== "sites" && phone && (
              // the phone reads the topic as chips; the main ring lands with the chimes
              <div key={current.id} className="mt-3">
                <p className="sheet-label">
                  {current.ring.length} {current.id === "gear" ? "devices" : current.id === "ai" ? "tools" : "languages"}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {current.ring.map((w, i) => (
                    <li key={w} className="wall-chip sheet-chip" style={{ animationDelay: `${0.15 + i * CHIP_STEP}s`, borderColor: current.tint, color: current.tint }}>
                      {w}
                    </li>
                  ))}
                </ul>
                {current.outer && (
                  <>
                    <p className="sheet-label mt-4">{current.outer.length} models run on real GPUs</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {(allModels ? current.outer : current.outer.slice(0, 8)).map((w, i) => (
                        <li key={w} className="wall-chip sheet-chip sheet-chip-sm" style={{ animationDelay: `${0.15 + current.ring.length * CHIP_STEP + i * 0.025}s` }}>
                          {w}
                        </li>
                      ))}
                      {!allModels && current.outer.length > 8 && (
                        <li>
                          <button type="button" onClick={() => setAllModels(true)} className="sheet-chip sheet-more">
                            +{current.outer.length - 8} more
                          </button>
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}

            {current && current.id !== "sites" && !phone && (
              <div className="mt-3">
                {/* the words themselves are in the scene as cards; screen readers get them here */}
                <ul className="sr-only">
                  {[...current.ring, ...(current.outer ?? [])].map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="hud-label leading-relaxed text-muted" aria-hidden="true">
                  ↑ {current.ring.length} {current.id === "gear" ? "DEVICES" : current.id === "ai" ? "TOOLS" : "LANGUAGES"}
                  {current.outer ? ` · ${current.outer.length} MODELS RUN ON REAL GPUS` : ""}
                </p>
              </div>
            )}

            {current?.id === "sites" && (
              <div className="mt-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["see", "See them"],
                      ["request", "Request one"],
                      ["faq", "Questions"],
                    ] as [SitesView, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => goSites(sitesView === v && v === "see" ? "menu" : v)}
                      className={`hud-tab ${phone ? "sheet-tab" : ""} ${sitesView === v ? "is-on" : ""}`}
                    >
                      {v === "see" && sitesView === "see" ? (phone ? "← Topics" : "Hide them") : label}
                    </button>
                  ))}
                </div>

                {phone && sitesView === "see" && (
                  // a swipeable strip of every site; tapping one flies its screen forward
                  <ul className="sheet-strip mt-3">
                    {wallTiles.map((t) => (
                      <li key={t.id}>
                        <button type="button" onClick={() => apiRef.current?.openTile(t.id)} className="sheet-site">
                          <img src={t.poster} alt="" loading="lazy" decoding="async" />
                          <span className="block truncate pt-2 text-[15px] font-medium text-text-primary">{t.title}</span>
                          <span className="block truncate text-[12.5px] text-muted">{t.host}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {sitesView === "request" && (
                  <InboxForm kind="request" form={form} setForm={setForm} send={send} onSubmit={() => submit("request")} onAgain={() => setSend("idle")} />
                )}

                {sitesView === "faq" && asking && (
                  <InboxForm
                    kind="question"
                    form={form}
                    setForm={setForm}
                    send={send}
                    onSubmit={() => submit("question")}
                    onAgain={() => setSend("idle")}
                    onBack={() => {
                      setAsking(false);
                      setSend("idle");
                    }}
                  />
                )}
                {sitesView === "faq" && !asking && (
                  <ul className={`mt-3 divide-y divide-white/[0.07] overflow-y-auto pr-1 ${phone ? "max-h-[34svh]" : "max-h-[250px]"}`}>
                    {faq.map((f, i) => (
                      <li key={f.q}>
                        <button
                          type="button"
                          onClick={() => setOpenQ(openQ === i ? null : i)}
                          className={`flex w-full items-center justify-between text-left text-text-primary ${phone ? "min-h-[48px] py-3 text-[14px]" : "py-2.5 text-[13px]"}`}
                        >
                          {f.q}
                          <span className={`ml-2 text-[#FFB15E] transition-transform ${openQ === i ? "rotate-45" : ""}`}>+</span>
                        </button>
                        <p className={`overflow-hidden text-[13px] leading-relaxed text-muted transition-all duration-300 ${openQ === i ? "max-h-40 pb-3" : "max-h-0"}`}>{f.a}</p>
                      </li>
                    ))}
                    <li className="pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAsking(true);
                          setSend("idle");
                          apiRef.current?.orbSay("listening");
                        }}
                        className={`hud-tab w-full ${phone ? "sheet-tab" : ""}`}
                      >
                        Didn&apos;t see yours? Ask Gabe →
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* focused screen caption, set in the lower letterbox bar */}
      <div
        className={`absolute inset-x-0 z-30 flex flex-wrap items-end justify-between gap-3 transition-all duration-700 ${
          phone ? "sheet-caption bottom-0 px-4" : "bottom-[calc(var(--bar)+20px)] px-6 md:px-14"
        } ${focused ? "translate-y-0 opacity-100 delay-500" : "pointer-events-none translate-y-4 opacity-0"}`}
      >
        <div className={phone ? "w-full" : ""}>
          <p className={phone ? "text-[13px] text-[#FFB15E]" : "hud-label text-[#FFB15E]"}>{phone ? focused?.host : focused?.host.toUpperCase()}</p>
          <p className={`mt-2 font-display leading-none text-text-primary ${phone ? "text-[32px]" : "text-[38px] md:text-[50px]"}`}>{focused?.title}</p>
          <p className={`mt-1.5 text-muted ${phone ? "text-[15px]" : "text-[14px]"}`}>{focused?.kind}</p>
        </div>
        <div className={`flex gap-2 ${phone ? "w-full" : ""}`}>
          <button type="button" onClick={() => closeRef.current()} className={`hud-btn ${phone ? "sheet-btn" : ""}`}>
            {phone ? "← Back" : "← BACK"}
          </button>
          <a href={focused?.url} target="_blank" rel="noreferrer" className={`hud-btn hud-btn-primary ${phone ? "sheet-btn flex-[1.4]" : ""}`}>
            {phone ? "Visit site ↗" : "VISIT SITE ↗"}
          </a>
        </div>
      </div>

      <ul className="sr-only">
        {wallTiles.map((t) => (
          <li key={t.id}>
            <a href={t.url}>
              {t.title} — {t.kind}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
