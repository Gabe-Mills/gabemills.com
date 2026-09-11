/**
 * GitHub data, captured 11 Sep 2026 from the live API via `gh`.
 *
 * Baked rather than fetched at runtime on purpose: the unauthenticated GitHub
 * API allows 60 requests/hour per IP, and this is the only content section on
 * the page — a rate-limited or failed fetch would render the site broken. The
 * numbers move slowly; re-run the capture command in DESIGN.md to refresh.
 *
 * Deliberately absent: follower count and star counts. They're 0 and 1, so
 * putting them on screen would undersell the work rather than support it. The
 * language composition is the honest signal here.
 */

export const profile = {
  handle: "Gabe-Mills",
  url: "https://github.com/Gabe-Mills",
  /** From his own profile README repo description — his words, not mine. */
  tagline:
    "GPU cloud, native Apple apps, creative tech. Make it useful. Then make it feel right.",
  org: "Massed-Compute",
  orgUrl: "https://github.com/Massed-Compute",
  since: "May 2026",
};

export interface Repo {
  name: string;
  description: string;
  language: string;
  /** must match a `Lang.name` below, so the dot colour and the bar agree */
  langKey: string;
  topics: string[];
  url: string;
}

export const repos: Repo[] = [
  {
    name: "gcoolers",
    description: "Apple Silicon thermal governor",
    language: "TypeScript",
    langKey: "TypeScript",
    topics: ["apple-silicon", "macos", "thermal", "menubar", "widgetkit", "homebrew"],
    url: "https://github.com/Gabe-Mills/gcoolers",
  },
  {
    name: "homebrew-gcoolers",
    description: "Homebrew tap for Gcoolers",
    language: "Ruby",
    langKey: "Other",
    topics: ["homebrew", "tap"],
    url: "https://github.com/Gabe-Mills/homebrew-gcoolers",
  },
  {
    name: "MC-Stocks",
    description: "Stocks for the EssentialsX plugin",
    language: "Java",
    langKey: "Java",
    topics: ["minecraft", "plugin", "java"],
    url: "https://github.com/Gabe-Mills/MC-Stocks",
  },
];

export interface Lang {
  name: string;
  bytes: number;
  /** Validated dark-mode categorical slots, in fixed order — see DESIGN.md. */
  color: string;
}

/**
 * Real byte counts summed across all public repos. Order is size-descending
 * with "Other" pinned last, and colours are assigned in that fixed order from
 * the validated palette — never by rank, never cycled.
 */
export const languages: Lang[] = [
  { name: "TypeScript", bytes: 219857, color: "#3987e5" },
  { name: "Python", bytes: 200346, color: "#d95926" },
  { name: "Java", bytes: 153815, color: "#199e70" },
  { name: "CSS", bytes: 114924, color: "#c98500" },
  { name: "Astro", bytes: 30686, color: "#d55181" },
  { name: "Swift", bytes: 24099, color: "#008300" },
  // Shell 13,545 · C 13,308 · JavaScript 9,047 · Ruby 2,420
  { name: "Other", bytes: 38320, color: "#9085e9" },
];

export const totalBytes = languages.reduce((sum, l) => sum + l.bytes, 0);
