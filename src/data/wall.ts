import { stack } from "./stack";

/**
 * Tiles on the home wall. Clips are recorded from the live sites by
 * tools/capture-wall.cjs — re-run it after a site changes.
 */
export interface WallTile {
  id: string;
  title: string;
  host: string;
  url: string;
  /** what it is, one short line */
  kind: string;
  video: string;
  poster: string;
}

const tile = (id: string, title: string, url: string, kind: string): WallTile => ({
  id,
  title,
  url,
  kind,
  host: new URL(url).host.replace(/^www\./, ""),
  video: `/wall/${id}.mp4`,
  poster: `/wall/${id}.jpg`,
});

export const wallTiles: WallTile[] = [
  tile("gcoolers", "Gcoolers", "https://gcoolers.com/", "Open-source macOS thermal governor"),
  tile("crispergames", "Ricochet Tanks", "https://crispergames.com/", "3D tank game, 500 missions"),
  tile("prism", "Prism SMP", "https://theprismsmp.com/", "Minecraft server site"),
  tile("leland", "Leland Plays Piano", "https://lelandplayzpiano.com/", "Musician site"),
  tile("studynotes", "GM Study Notes", "https://gmstudynotes.com/", "YouTube to study notes"),
  tile("pawpath", "Gwen's Dog Walking", "https://dogwalk.gabemills.com/", "Local business site"),
  tile("gabesprojects", "Gabe's Projects", "https://gabesprojects.com/", "Systems lab"),
  tile("survival", "Would You Survive?", "https://survival.gabesprojects.com/", "Simulation game"),
  tile("trww", "Thomas Road Worldwide", "https://trww.gabesprojects.com/", "Ministry site"),
  tile("music", "Gabe Mills Music", "https://gabe-mills-music.pages.dev/", "Music"),
];

/**
 * Numbers on the wall HUD. Counted 20 Oct 2026:
 * - models: the "Models we've actually run" group in stack.ts
 * - commits: GitHub commit search for author:Gabe-Mills (public repos only)
 * - projects: folders in ~/Developer/Projects/Active, rounded down
 */
export const wallStats = [
  { value: wallTiles.length, suffix: "", label: "Sites live" },
  { value: 90, suffix: "+", label: "Projects built" },
  { value: 27, suffix: "", label: "AI models benchmarked" },
  { value: 313, suffix: "", label: "Commits on GitHub" },
];

/** Names only, no logos — taken from stack.ts plus where he works. */
export const workedWith = [
  "Massed Compute",
  "NVIDIA H100",
  "Blackwell",
  "Claude",
  "OpenAI",
  "Cloudflare",
  "Three.js",
  "React",
  "Swift",
  "Blender",
  "PyTorch",
  "vLLM",
  "ComfyUI",
  "Docker",
  "CUDA",
  "Higgsfield",
  "Ollama",
  "Apple Silicon",
];

/* ---------- the orb's menu (round 4, 20 Oct 2026) ---------- */


const group = (prefix: string) => stack.find((g) => g.title.startsWith(prefix))?.items.map((i) => i.label) ?? [];

export type TopicId = "languages" | "ai" | "gear" | "sites";

export interface Topic {
  id: TopicId;
  label: string;
  /** what the orb says when you pick it */
  line: string;
  /** big labels that orbit the pedestal */
  ring: string[];
  /** smaller outer ring, optional */
  outer?: string[];
  /** the colour the hologram takes for this topic */
  tint: string;
}

// Everything here comes from stack.ts (his GitHub profile README) — nothing invented.
export const topics: Topic[] = [
  {
    id: "languages",
    label: "Coding languages",
    line: "These are the languages Gabe writes in.",
    ring: group("Languages"),
    tint: "#ffb15e",
  },
  {
    id: "ai",
    label: "AI",
    line: "The AI he uses every day — and the outer ring is every model he's actually run and benchmarked on real GPUs.",
    ring: group("AI I use"),
    outer: group("Models"),
    tint: "#8fd3ff",
  },
  {
    id: "gear",
    label: "Physical equipment",
    line: "The hardware he works on — from his Mac to H200s and Blackwell in the data centre.",
    ring: group("Devices"),
    tint: "#9dffb0",
  },
  {
    id: "sites",
    label: "Websites & software",
    line: "He's got live sites, games and tools. What would you like to do?",
    ring: [],
    tint: "#ff8a4a",
  },
];

/**
 * Common questions. Answers only state things that are true today; anything about
 * price or timelines points at a request instead of quoting numbers. Gabe should
 * read these over before launch.
 */
export const faq = [
  {
    q: "What do you build?",
    a: "Websites, games, AI tools and native Apple apps — every screen on this wall is something live that I built.",
  },
  {
    q: "Where are you based?",
    a: "Lynchburg, Virginia.",
  },
  {
    q: "How much does a site cost?",
    a: "It depends on what it needs to do. Send a request with what you have in mind and I'll reply with a quote.",
  },
  {
    q: "What do you build with?",
    a: "Mostly TypeScript, React and Three.js on the web, Swift for Apple apps, Python for AI work — and most of my sites run on Cloudflare.",
  },
  {
    q: "How do I get started?",
    a: "Use “Request one” below, or email reachout@gabemills.com.",
  },
];

export const REQUEST_EMAIL = "reachout@gabemills.com";
export const requestKinds = ["Website", "Web app", "Game", "AI tool", "Apple app", "Something else"];
