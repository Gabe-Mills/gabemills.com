/**
 * GitHub data, captured 11 Sep 2026 from the live API via `gh`.
 * Refreshed the same day once gabemills.com itself was pushed public — which
 * moved TypeScript from 28% to 36% and pushed JavaScript above Astro and Swift,
 * so the chart needed an eighth slot. All eight validate; see DESIGN.md.
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
    name: "gabemills.com",
    description: "This site — an interactive constellation field",
    language: "TypeScript",
    langKey: "TypeScript",
    topics: ["vite", "react", "canvas", "cloudflare-workers"],
    url: "https://github.com/Gabe-Mills/gabemills.com",
  },
  {
    name: "gcoolers",
    description: "Apple Silicon thermal governor",
    language: "TypeScript",
    langKey: "TypeScript",
    topics: ["apple-silicon", "macos", "thermal", "menubar"],
    url: "https://github.com/Gabe-Mills/gcoolers",
  },
  {
    name: "MC-Stocks",
    description: "Stocks for the EssentialsX plugin",
    language: "Java",
    langKey: "Java",
    topics: ["minecraft", "plugin", "java"],
    url: "https://github.com/Gabe-Mills/MC-Stocks",
  },
  {
    name: "homebrew-gcoolers",
    description: "Homebrew tap for Gcoolers",
    language: "Ruby",
    langKey: "Other",
    topics: ["homebrew", "tap"],
    url: "https://github.com/Gabe-Mills/homebrew-gcoolers",
  },
];

export interface Lang {
  name: string;
  bytes: number;
  /**
   * A validated dark-mode categorical slot, in fixed order — see DESIGN.md.
   * Languages WITHOUT a colour roll into the "Other" segment of the bar but are
   * still itemised individually in the legend. That split is deliberate: the
   * validated palette has eight slots, and a ninth hue cannot be invented
   * without breaking colourblind separation. So the bar stays legal at eight
   * segments while the legend still accounts for every language on the profile.
   */
  color?: string;
}

/** The colour of the aggregated "Other" segment — the eighth and last slot. */
export const OTHER_COLOR = "#e66767";

/**
 * Every language GitHub reports across all public repos, by real byte count,
 * size-descending. Nothing is hidden — the tail is grouped in the bar for
 * colour-safety reasons only, and listed by name in the legend.
 */
export const languages: Lang[] = [
  { name: "TypeScript", bytes: 367065, color: "#3987e5" },
  { name: "Python", bytes: 200346, color: "#d95926" },
  { name: "Java", bytes: 153815, color: "#199e70" },
  { name: "CSS", bytes: 146566, color: "#c98500" },
  { name: "JavaScript", bytes: 51281, color: "#d55181" },
  { name: "Astro", bytes: 30686, color: "#008300" },
  { name: "Swift", bytes: 24099, color: "#9085e9" },
  // the tail — own rows in the legend, aggregated into one bar segment
  { name: "Shell", bytes: 13545 },
  { name: "C", bytes: 13308 },
  { name: "HTML", bytes: 3396 },
  { name: "Ruby", bytes: 2420 },
];

/** the seven that get their own bar segment */
export const majorLanguages = languages.filter((l) => l.color);
/** the tail that shares the "Other" segment */
export const minorLanguages = languages.filter((l) => !l.color);
export const otherBytes = minorLanguages.reduce((sum, l) => sum + l.bytes, 0);

export const totalBytes = languages.reduce((sum, l) => sum + l.bytes, 0);
export const repoCount = 5;
