export type AccentKey = "green-cyan" | "blue-purple" | "orange-red-cyan";

export interface Project {
  id: string;
  title: string;
  url: string;
  host: string;
  module: string;
  accent: AccentKey;
  /** short kind-of-thing label, shown as the module eyebrow */
  tag: string;
  /** what Gabe did on it */
  role: string;
  /** deploy state, shown in the status strip — keep this true */
  status: string;
  /** one line: what the thing is */
  summary: string;
  /** why it exists */
  problem: string;
  /** what shipped */
  outcome: string;
  /** real technologies, not decorative labels */
  stack: string[];
  /** primary glow color rgb */
  glow: string;
  /** css class for glow shadow */
  glowClass: string;
  /**
   * One line, present tense, ~12 words. `summary` is two sentences of prose
   * written for a case-study layout that no longer exists — at tile width it
   * wraps to five lines and nobody reads it. This is the tile's copy.
   */
  blurb: string;
  /** real screenshot of the live site */
  shot: string;
  shotAlt: string;
}

export const projects: Project[] = [
  {
    id: "gcoolers",
    title: "Gcoolers",
    url: "https://gcoolers.com/",
    host: "gcoolers.com",
    module: "01",
    accent: "green-cyan",
    tag: "Open source · macOS",
    role: "Author and maintainer",
    status: "v3.06 · MIT",
    summary:
      "A thermal governor for Apple Silicon Macs — fan curves, live temperatures, and a Meeting Mode that keeps the fans quiet on calls.",
    problem:
      "Apple Silicon Macs ramp their fans on a schedule you don't control, and the tools that fix it want either a kernel extension or a subscription.",
    outcome:
      "A user-space daemon with Silent, Balanced, Frost and Max profiles, a menu-bar widget graphing CPU and GPU temperature, and a one-line Homebrew install. No network calls — the state never leaves the machine.",
    stack: ["IOKit (user space)", "Local daemon", "Homebrew tap", "Menu-bar app"],
    glow: "255, 196, 92",
    glowClass: "green-status-glow",
    blurb:
      "Fan curves and live temperatures for Apple Silicon, entirely in user space.",
    shot: "/screenshots/shot-gcoolers.jpg",
    shotAlt:
      "Gcoolers homepage — the wordmark above a live terminal panel graphing CPU and GPU temperature history",
  },
  {
    id: "leland-plays-piano",
    title: "Leland Plays Piano",
    url: "https://lelandplayzpiano.com/",
    host: "lelandplayzpiano.com",
    module: "02",
    accent: "orange-red-cyan",
    tag: "Artist site",
    role: "Design and build",
    status: "Live",
    summary:
      "A working musician's home base — recordings, sheet music, and a booking path in one place.",
    problem:
      "A pianist, violinist and composer with a growing video catalogue and nowhere single to send bookers, teachers, or new listeners.",
    outcome:
      "A site that doubles as a press kit: the latest performance pulled in automatically, a photo history, sheet music, and separate booking paths for concerts, private events, and church services.",
    stack: ["Next.js", "YouTube embeds", "Image optimization", "Newsletter capture"],
    glow: "196, 148, 84",
    glowClass: "corvus-glow",
    blurb:
      "Press kit, catalogue and booking paths for a working pianist, in one place.",
    shot: "/screenshots/shot-leland.jpg",
    shotAlt:
      "Leland Plays Piano homepage with a large serif headline and the most recent performance video",
  },
  {
    id: "fuji-afterglow",
    title: "Fuji Afterglow",
    url: "https://lofi-afterglow.cc/",
    host: "lofi-afterglow.cc",
    module: "03",
    accent: "blue-purple",
    tag: "Listening room",
    role: "Concept and build",
    status: "Live",
    summary:
      "An endless evening you join rather than start — everyone who opens it lands on the same moment of the same track.",
    problem:
      "On-demand ambient music is private and a little lonely. The version worth building is the one where the clock is shared.",
    outcome:
      "A synchronized stream: one continuous track over an illustrated Japanese townscape, with a shared clock so every listener hears the same bar at the same time.",
    stack: ["Web Audio", "Shared playback clock", "Illustrated scene"],
    glow: "235, 78, 46",
    glowClass: "purple-glow",
    blurb:
      "One endless track on a shared clock — everyone hears the same bar.",
    shot: "/screenshots/shot-afterglow.jpg",
    shotAlt:
      "Fuji Afterglow homepage — an illustrated rainy window looking out at Mount Fuji, with a Join live button",
  },
];
