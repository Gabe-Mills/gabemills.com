export interface Scene {
  id: string;
  /** scroll progress where this scene begins (0..1) */
  start: number;
  end: number;
  label: string;
  status: string;
}

/** The 7 cinematic phases of the fog machine sequence. */
export const scenes: Scene[] = [
  { id: "idle", start: 0.0, end: 0.15, label: "BLACK FOG", status: "MACHINE IDLE" },
  { id: "boot", start: 0.15, end: 0.3, label: "MACHINE BOOT", status: "SYS ONLINE" },
  { id: "open", start: 0.3, end: 0.45, label: "CORE OPEN", status: "MODULE RELEASE" },
  { id: "leland", start: 0.45, end: 0.6, label: "MODULE 01", status: "PIANO ACTIVE" },
  { id: "member-ex", start: 0.6, end: 0.75, label: "MODULE 02", status: "FORGE ACTIVE" },
  { id: "music", start: 0.75, end: 0.9, label: "MODULE 03", status: "LISTEN ACTIVE" },
  { id: "command", start: 0.9, end: 1.0, label: "COMMAND", status: "ALL SYSTEMS ONLINE" },
];

/** Optional cinematic keyframe images, crossfaded by scroll if present. */
export const keyframeImages = [
  "/visuals/01_black_fog.webp",
  "/visuals/02_machine_boot.webp",
  "/visuals/03_core_open.webp",
  "/visuals/04_trww_active.webp",
  "/visuals/05_gabesprojects_active.webp",
  "/visuals/06_corvus_active.webp",
  "/visuals/07_final_dashboard.webp",
];

/** Atmospheric code chips floating in the fog (not claims, just texture). */
export const codeChips = [
  "REACT", "TYPESCRIPT", "JAVASCRIPT", "VITE", "TAILWIND", "GSAP",
  "FRAMER", "HTML", "CSS", "NODE", "PYTHON", "SWIFT", "SWIFTUI",
  "MARKDOWN", "MDX", "JSON", "YAML", "BASH", "GIT", "GITHUB",
  "API", "SEO", "DEPLOY",
];
