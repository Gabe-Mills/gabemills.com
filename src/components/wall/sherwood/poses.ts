// Sherwood's pose maths, ported from Gabe's robinhood-agent dashboard (web/js/modules/blobkit.js,
// T671/T692/T696). Every pose is a flat bag of numbers, so any two poses blend key by key.
// The morph approach is inspired by bloub (MIT) by Jérémy, https://github.com/jeremy-prt/bloub;
// the shapes, faces and code are Gabe's own.

export const TAU = Math.PI * 2;
export const FACE_ON = -(Math.PI / 2 + 0.26); // haloTilt that turns the ring to face the camera
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;
export const easeOutBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const env = (u: number, a = 0.18, b = 0.78) => smooth(u / a) * (1 - smooth((u - b) / (1 - b)));
/** pulse that runs across three dots, left to right */
export const dotPulse = (t: number, i: number) => { const p = ((((t - i * 0.33) / 1.2) % 1) + 1) % 1; return p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU * 2) : 0; };
/** a hop loop: [height 0..1, squash(-)/stretch(+)] */
export function hopCurve(t: number, P: number): [number, number] {
  const ph = (((t / P) % 1) + 1) % 1, air = 0.48;
  if (ph < air) { const u = ph / air; return [4 * u * (1 - u), 0.09 * Math.abs(1 - 2 * u) - 0.01]; }
  const g = (ph - air) / (1 - air);
  return [0, -0.2 * Math.exp(-g * 8) - 0.1 * Math.sin(Math.PI * clamp((g - 0.55) / 0.45))];
}

export const BASE = {
  // silhouette
  egg: 0, hex: 0, tri: 0, heart: 0, flower: 0, drop: 0, melt: 0.22, flat: 0.3, burst: 0, comet: 0, twist: 0, tall: 0,
  box: 0, boxN: 4, boxA: 0,
  wobble: 0.02, wobbleF: 1.25, wobbleS: 1,
  // body
  sx: 1, sy: 1, x: 0, y: 0, rotZ: 0, yaw: 0, lean: 1, scale: 1, hopH: 0, hopP: 1.3,
  // eyes
  openL: 1, openR: 1, lineL: 0, lineR: 0, arcK: -1, chev: 0, diam: 0, spiral: 0, pupil: 0,
  eyeW: 0.13, eyeH: 0.172, eyeY: 0.1, split: 0.29, lid: 0, lidH: 1.8, carve: 0,
  gazeX: 0, gazeY: 0, eyeGlow: 1, follow: 1, wander: 1,
  // brows and mouth
  browA: 0, browT: 0, browLY: 0, browRY: 0,
  mY: -0.17, mW: 0.075, mC: 0.55, mOpen: 0, mGrin: 0, mWob: 0, mZig: 0, mTilt: 0, mX: 0, mA: 1, blush: 0,
  // light
  rimR: 1, rimG: 0.68, rimB: 0.26, rimI: 1, sss: 1,
  // ring
  haloSpin: 0.35, haloTilt: 0, haloRoll: 0, haloS: 1, haloX: 0, haloY: -0.32, haloZ: 0,
  // satellites, misc
  satThink: 0, satOrbit: 0, satDot: 0, satS: 0,
  breathA: 0.014, breathR: 0.27, bob: 0.02, bobR: 0.42, shake: 0,
};
export type Pose = typeof BASE;
export type PoseKey = keyof Pose;
export type PosePart = Partial<Pose>;
export const KEYS = Object.keys(BASE) as PoseKey[];
/** body and shape keys morph with a back-eased overshoot; the face eases out without overshoot */
export const SPRINGY = new Set<PoseKey>(["egg", "hex", "tri", "heart", "flower", "drop", "melt", "flat", "tall", "box", "sx", "sy", "x", "y", "rotZ", "scale", "haloS", "haloY", "haloX", "haloTilt", "haloRoll"]);

export interface StateDef {
  morph: number;
  jump?: number;
  blinkIn?: boolean;
  /** this internal state hands over to `next` after `dur` seconds */
  dur?: number;
  next?: string;
  /** confetti pop at this time into each `loop`-second cycle */
  confettiAt?: number;
  loop?: number;
  micro?: boolean;
  pose: (t: number) => PosePart;
}

/* ---- dashboard poses, unchanged ---- */
const dashIdle = (t: number): PosePart => ({ rotZ: Math.sin(t * 0.9) * 0.03, yaw: Math.sin(t * 0.47) * 0.07 });
const dashHappy = (t: number): PosePart => ({
  melt: 0, flat: 0.2, sx: 1.08, sy: 0.95, lineL: 1, lineR: 1, arcK: -1, carve: 0.3, eyeY: 0.11,
  mGrin: 1, mW: 0.12, mY: -0.15, mC: 0.6, blush: 1, hopH: 0.22, hopP: 1.15, wander: 0.4,
  haloY: 1.3, haloS: 0.42, haloTilt: -0.12, haloSpin: 1.4, rimI: 1.25, eyeGlow: 1.15, rotZ: Math.sin(t * 2.73) * 0.07,
});
const dashThinking = (t: number): PosePart => ({
  drop: 1, melt: 0, flat: 0.2, sy: 1.02, rotZ: -0.13 + Math.sin(t * 1.1) * 0.04,
  gazeX: 0.16 + 0.04 * Math.sin(t * 1.3), gazeY: 0.13, openR: 0.5, browA: 1, browT: -0.08, browLY: 0.05, browRY: -0.012,
  mC: -0.2, mW: 0.05, mX: 0.06, mTilt: 0.22, mY: -0.18, follow: 0.1, wander: 0.15, satThink: 1, satS: 1,
  haloTilt: FACE_ON, haloY: 0.1, haloZ: -0.6, haloS: 0.86, haloSpin: 5.5, wobble: 0.025,
});
export function burstPose(t: number): PosePart {
  const lt = t % 2.4;
  const ant = clamp(lt / 0.28), pop = clamp((lt - 0.28) / 0.22), fall = Math.max(0, lt - 0.5);
  const spikes = lt < 0.28 ? 0 : lt < 0.5 ? easeOutBack(pop) : (0.82 + 0.18 * Math.cos(fall * 11) * Math.exp(-fall * 3)) * (1 - smooth((lt - 1.5) / 0.6));
  const squash = lt < 0.28 ? -0.2 * easeInOut(ant) : lt < 0.5 ? -0.2 + 0.34 * easeOutQuint(pop) : 0.14 * Math.exp(-fall * 4) * Math.cos(fall * 13);
  const pre = lt < 0.28;
  return {
    melt: 0, flat: 0, burst: spikes, sy: 1 + squash, sx: 1 - squash * 0.55, y: pre ? -0.05 * ant : 0.14 * Math.exp(-fall * 3),
    chev: pre || lt > 1.3 ? 0 : 1, lineL: pre ? 0 : 1, lineR: pre ? 0 : 1, arcK: -1, openL: pre ? 0.5 : 1, openR: pre ? 0.5 : 1,
    mGrin: pre ? 0 : 1, mOpen: pre ? 1 : 0, mW: pre ? 0.04 : 0.11, mY: -0.16, blush: 1,
    eyeGlow: pre ? 1 : 1.55, rimI: 1.6, twist: pre ? 0 : 0.35 * Math.exp(-fall * 2) * Math.sin(fall * 6), haloSpin: 3.2, haloS: 1 + 0.3 * spikes,
  };
}

/* ---- site poses built from the dashboard vocabulary ---- */
// talking: a syllable envelope drives an "o" mouth that wobbles open and shut, with phrase pauses
function talkEnv(t: number) {
  const phrase = smooth(Math.sin(t * 1.05) * 1.6 + 1.1) * smooth(Math.sin(t * 0.37 + 2) * 2 + 1.6);
  const syl = Math.abs(Math.sin(t * 8.6 + Math.sin(t * 2.3) * 1.4)) ** 0.8;
  return syl * phrase;
}
const talking = (t: number): PosePart => {
  const s = talkEnv(t);
  return {
    melt: 0.12, flat: 0.25, mOpen: s, mW: 0.042 + 0.03 * s, mY: -0.18 - 0.012 * s, mC: 0.5 * (1 - s), mWob: 0.25 * s,
    sy: 1 + 0.03 * s, sx: 1 - 0.014 * s, browA: 0.45, browT: 0.04, browLY: 0.012 + 0.022 * s, browRY: 0.012 + 0.018 * s,
    rotZ: Math.sin(t * 1.7) * 0.045, yaw: Math.sin(t * 0.9) * 0.09, eyeGlow: 1.05 + 0.12 * s, wander: 0.5,
    haloSpin: 0.7, wobble: 0.024,
  };
};
const listening = (t: number): PosePart => ({
  melt: 0.15, flat: 0.25, sy: 1.03, sx: 0.98, rotZ: 0.16 + Math.sin(t * 0.8) * 0.025,
  eyeW: 0.14, eyeH: 0.186, eyeY: 0.11, browA: 0.85, browT: 0.06, browLY: 0.045, browRY: 0.02, gazeY: 0.04,
  mC: 0.35, mW: 0.05, mY: -0.18, mOpen: 0.25, follow: 1.4, wander: 0.5, eyeGlow: 1.12, rimI: 1.1,
  haloTilt: 0.08, haloRoll: 0.12, haloSpin: 0.25, wobble: 0.015, bob: 0.012,
});
const hello = (t: number): PosePart => ({
  ...dashHappy(t),
  // a wave: the whole body rocks side to side while it hops
  rotZ: Math.sin(t * 6.4) * 0.13 * (0.55 + 0.45 * Math.cos(t * 0.8)), x: Math.sin(t * 6.4) * 0.03,
});
const heart = (t: number): PosePart => {
  const beat = (t % 1.1);
  const pulse = 0.07 * Math.max(0, Math.sin(beat * 9)) * Math.exp(-beat * 3);
  return {
    heart: 1, melt: 0, flat: 0, lineL: 1, lineR: 1, arcK: -1, carve: 0.25, mGrin: 0.7, mC: 0.9, mW: 0.08, mY: -0.18, blush: 1.2,
    rotZ: Math.sin(t * 2.1) * 0.06, scale: 1 + pulse, hopH: 0.12, hopP: 1.1, wander: 0.3,
    haloY: 1.0, haloS: 0.44, haloTilt: -0.15, haloSpin: 1.2, eyeGlow: 1.2, rimI: 1.3,
  };
};

export const STATES: Record<string, StateDef> = {
  idle: { morph: 0.45, micro: true, pose: dashIdle },
  hello: { morph: 0.42, jump: 3.2, blinkIn: true, pose: hello },
  talking: { morph: 0.32, pose: talking },
  thinking: { morph: 0.4, blinkIn: true, micro: true, pose: dashThinking },
  listening: { morph: 0.4, blinkIn: true, micro: true, pose: listening },
  // happy = the dashboard's "celebrating a fill" star pop with confetti, then it settles into a heart
  happy: { morph: 0.22, dur: 2.3, next: "heart", confettiAt: 0.28, loop: 2.4, pose: burstPose },
  heart: { morph: 0.34, blinkIn: true, jump: 2.4, pose: heart },
};

/* ---- idle micro behaviours (dashboard MICRO) ---- */
export interface MicroCtx { gx: number; gy: number }
export interface MicroDef { dur: number; jump?: number; cursor?: boolean; f: (u: number, m: MicroCtx) => PosePart }
export const MICRO: Record<string, MicroDef> = {
  look: { dur: 2.3, f: (u) => { const g = u < 0.42 ? -1 : u < 0.8 ? 1 : 0; const e = env(u, 0.1, 0.85); return { gazeX: 0.2 * g * e, yaw: 0.22 * g * e, browA: 0.25 * e }; } },
  hop: { dur: 0.8, jump: 2.6, f: () => ({}) },
  wink: { dur: 0.75, f: (u) => { const e = env(u, 0.2, 0.7); return { lineR: e, mC: 0.35 * e, rotZ: 0.07 * e, blush: 0.6 * e }; } },
  glance: { dur: 1.7, cursor: true, f: (u, m) => { const e = env(u, 0.12, 0.8); return { gazeX: m.gx * e, gazeY: m.gy * e, yaw: m.gx * 0.9 * e, browA: 0.4 * e, browLY: 0.03 * e, browRY: 0.03 * e }; } },
  tilt: { dur: 1.5, f: (u) => { const e = env(u, 0.2, 0.75); return { rotZ: 0.17 * e, browA: 0.8 * e, browLY: 0.045 * e, mC: -0.2 * e, gazeY: 0.05 * e }; } },
  stretch: { dur: 1.1, f: (u) => { const e = env(u, 0.35, 0.6); return { sy: 0.12 * e, sx: -0.07 * e, openL: -0.3 * e, openR: -0.3 * e, mOpen: 0.8 * e }; } },
  squint: { dur: 1.2, f: (u) => { const e = env(u, 0.2, 0.75); return { carve: 0.45 * e, mC: 0.4 * e, blush: 0.7 * e }; } },
};
export const MICRO_KEYS = Object.keys(MICRO);
