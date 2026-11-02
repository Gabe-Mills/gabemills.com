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
  /**
   * Optional muted scroll-through loop of the live site
   * (`/showcase/previews/<id>.mp4`, 1920x1200, with a smaller `.webm` beside it).
   * Lets the showcase develop an engraving into the moving site; `shot` is the
   * loop's first frame, so it doubles as the poster and the engraved texture.
   */
  loop?: string;
}

export const projects: Project[] = [
  {
    id: "prism-smp",
    title: "Prism SMP",
    url: "https://theprismsmp.com/",
    host: "theprismsmp.com",
    module: "01",
    accent: "blue-purple",
    tag: "Minecraft server",
    role: "Site and server plugins",
    status: "Live · Paper 1.21.11",
    summary:
      "A public Minecraft survival server — four survival worlds on one server — with a live 3D site in front and nine custom plugins behind it.",
    problem:
      "Four survival worlds on one server need a single front door, and the economy, shops and duels the server runs on had to be written to fit it.",
    outcome:
      "A Next.js site over a live three.js world: a glass prism splitting light into an Overworld village, a Nether fortress and the End, with a server-status widget. On the server, nine Paper plugins — a 100-tier generator shop, wealth ranks, server and player shops, five resettable duel arenas, and world picking with chat shared across worlds.",
    stack: ["Next.js", "React Three Fiber", "Tailwind CSS", "Paper plugins (Java)"],
    glow: "235, 78, 46",
    glowClass: "purple-glow",
    blurb:
      "One Minecraft server, four survival worlds — a live 3D site and nine plugins.",
    shot: "/showcase/previews/prism-smp.jpg",
    shotAlt:
      "Prism SMP homepage — the pixel-type title over a wall of enchanting-table glyphs, a glass prism splitting light, and a live server-status card",
    loop: "/showcase/previews/prism-smp.mp4",
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
    shot: "/showcase/previews/leland-plays-piano.jpg",
    shotAlt:
      "Leland Plays Piano homepage — a large serif headline beside the most recent performance, a Zelda piano medley video",
    loop: "/showcase/previews/leland-plays-piano.mp4",
  },
  {
    id: "ricochet-tanks",
    title: "Ricochet Tanks",
    url: "https://crispergames.com/",
    host: "crispergames.com",
    module: "03",
    accent: "green-cyan",
    tag: "Game · Discord Activity",
    role: "Game, site and backend",
    status: "v1.6.2 · Live",
    summary:
      "A top-down 3D tank battler that runs inside Discord — bank shots, mines, and 500 missions across 10 worlds.",
    problem:
      "A game that lives inside a Discord call has to start fast, be worth coming back to, and keep a leaderboard people can trust.",
    outcome:
      "One three.js game served as a Discord Activity, in the browser, and in an iPhone app, with co-op, an Endless mode, a Hangar for designing your own tank, and a leaderboard whose runs are checked by the server.",
    stack: ["three.js", "TypeScript + Vite", "Discord Embedded App SDK", "Cloudflare Pages · D1 · Durable Objects", "Capacitor (iOS)"],
    glow: "255, 196, 92",
    glowClass: "green-status-glow",
    blurb:
      "A 3D tank battler inside Discord — bank shots, mines, 500 missions.",
    shot: "/showcase/previews/ricochet-tanks.jpg",
    shotAlt:
      "Ricochet Tanks homepage — the chrome RICOCHET TANKS logo over a dim top-down battlefield, with Add to Discord and Play now buttons",
    loop: "/showcase/previews/ricochet-tanks.mp4",
  },
  {
    id: "gcoolers",
    title: "Gcoolers",
    url: "https://gcoolers.com/",
    host: "gcoolers.com",
    module: "04",
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
    shot: "/showcase/previews/gcoolers.jpg",
    shotAlt:
      "Gcoolers homepage — the wordmark above a live terminal panel graphing CPU and GPU temperature history",
    loop: "/showcase/previews/gcoolers.mp4",
  },
];
