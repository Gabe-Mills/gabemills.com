import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Bubble from "./Bubble";
import {
  profile,
  repos,
  languages,
  majorLanguages,
  minorLanguages,
  otherBytes,
  totalBytes,
  repoCount,
  OTHER_COLOR,
} from "../data/github";

const GH_MARK =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.05-.13-.36-.95.08-1.98 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.03.13 1.85.08 1.98.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8z";

const pct = (bytes: number) => (bytes / totalBytes) * 100;
const fmtPct = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1));

/**
 * GitHub — unboxed. No card; everything floats on the constellation.
 *
 * The one thing that could NOT be unboxed is the language bar. It's a chart:
 * the segments have to sit flush against each other for their widths to be
 * comparable, so it stays a single solid object. Its legend, though, becomes
 * bubbles — which still satisfies the table-view requirement, since every row
 * carries the name and the percentage alongside its swatch.
 */
export default function GitHubProfile() {
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useReducedMotion();

  return (
    <section
      id="github"
      className="relative z-10 scroll-mt-28 px-5 pb-16 pt-24 md:pb-24 md:pt-36"
      aria-label="GitHub"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 md:gap-20">
        {/* ---- identity ---- */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-6 sm:gap-8"
        >
          <motion.a
            href={profile.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${profile.handle} on GitHub`}
            whileHover={reduced ? undefined : { scale: 1.06 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E] focus-visible:ring-offset-4 focus-visible:ring-offset-bg"
          >
            <span
              aria-hidden="true"
              className="absolute -inset-3 rounded-full blur-xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,140,60,0.55), rgba(228,105,44,0) 70%)",
              }}
            />
            <img
              src="/github-avatar.png"
              alt="Gabe Mills"
              width={96}
              height={96}
              className="relative h-[76px] w-[76px] rounded-full object-cover ring-1 ring-[rgba(255,200,150,0.4)] sm:h-[92px] sm:w-[92px]"
              loading="lazy"
              decoding="async"
            />
          </motion.a>

          <div className="min-w-0 flex-1">
            <a
              href={profile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
            >
              <svg viewBox="0 0 16 16" className="h-5 w-5 shrink-0 fill-current text-text-primary" aria-hidden="true">
                <path d={GH_MARK} />
              </svg>
              <span className="on-field truncate font-mono text-[17px] tracking-tight text-text-primary transition-colors group-hover:text-[#FFB15E] sm:text-[19px]">
                {profile.handle}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5">
                <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <p className="on-field mt-2.5 max-w-prose text-[14.5px] leading-relaxed text-text-primary/75 sm:text-[15.5px]">
              {profile.tagline}
            </p>
          </div>
        </motion.div>

        {/* ---- language composition ---- */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="on-field font-mono text-[11px] uppercase tracking-[0.24em] text-text-primary/75">
              Language composition
            </h2>
            <span className="on-field font-mono text-[11px] tracking-[0.08em] text-muted/80 [font-variant-numeric:tabular-nums]">
              {Math.round(totalBytes / 1024)} KB across {repoCount} repos
            </span>
          </div>

          {/* The chart stays one solid object — segment widths are only
              comparable if they sit flush, so this is the one thing here that
              can't float free. */}
          <div
            className="mt-6 flex h-3.5 w-full gap-[2px] overflow-hidden rounded-full"
            style={{ boxShadow: "0 8px 24px -10px rgba(4,3,3,0.85)" }}
            role="img"
            aria-label={`Language composition across ${repoCount} repositories: ${languages
              .map((l) => `${l.name} ${fmtPct(pct(l.bytes))}%`)
              .join(", ")}`}
          >
            {majorLanguages.map((l, i) => (
              <div
                key={l.name}
                onMouseEnter={() => setHover(l.name)}
                onMouseLeave={() => setHover(null)}
                className="h-full transition-opacity duration-200"
                style={{
                  width: `${pct(l.bytes)}%`,
                  background: l.color,
                  opacity: hover && hover !== l.name ? 0.28 : 1,
                  borderRadius: i === 0 ? "999px 3px 3px 999px" : "3px",
                }}
              />
            ))}
            <div
              onMouseEnter={() => setHover("Other")}
              onMouseLeave={() => setHover(null)}
              className="h-full transition-opacity duration-200"
              style={{
                width: `${pct(otherBytes)}%`,
                background: OTHER_COLOR,
                opacity: hover && hover !== "Other" ? 0.28 : 1,
                borderRadius: "3px 999px 999px 3px",
              }}
            />
          </div>

          {/* legend as bubbles — still the table view: swatch, name, value */}
          <ul className="mt-7 flex flex-wrap gap-3">
            {majorLanguages.map((l) => (
              <li
                key={l.name}
                onMouseEnter={() => setHover(l.name)}
                onMouseLeave={() => setHover(null)}
                style={{ opacity: hover && hover !== l.name ? 0.45 : 1, transition: "opacity 200ms" }}
              >
                <Bubble accent={l.color}>
                  <span className="whitespace-nowrap font-mono text-[12.5px] text-text-primary/90">
                    {l.name}{" "}
                    <span className="text-muted [font-variant-numeric:tabular-nums]">
                      {fmtPct(pct(l.bytes))}%
                    </span>
                  </span>
                </Bubble>
              </li>
            ))}
            <li
              onMouseEnter={() => setHover("Other")}
              onMouseLeave={() => setHover(null)}
              style={{ opacity: hover && hover !== "Other" ? 0.45 : 1, transition: "opacity 200ms" }}
            >
              <Bubble accent={OTHER_COLOR}>
                <span className="whitespace-nowrap font-mono text-[12.5px] text-text-primary/90">
                  Other{" "}
                  <span className="text-muted [font-variant-numeric:tabular-nums]">
                    {fmtPct(pct(otherBytes))}%
                  </span>
                </span>
              </Bubble>
            </li>
          </ul>

          {/* the tail, named — smaller bubbles, same system */}
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {minorLanguages.map((l) => (
              <li key={l.name}>
                <Bubble accent={OTHER_COLOR} className="!px-3 !py-1.5 opacity-80">
                  <span className="whitespace-nowrap font-mono text-[11px] text-muted">
                    {l.name}{" "}
                    <span className="[font-variant-numeric:tabular-nums]">{fmtPct(pct(l.bytes))}%</span>
                  </span>
                </Bubble>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* ---- repos ---- */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-70px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="on-field font-mono text-[11px] uppercase tracking-[0.24em] text-text-primary/75">
            Public repositories
          </h2>
          <ul className="mt-6 flex flex-wrap gap-4">
            {repos.map((r) => {
              const lang = languages.find((l) => l.name === r.langKey);
              const tint = lang?.color ?? OTHER_COLOR;
              return (
                <li key={r.name}>
                  <motion.a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={reduced ? undefined : { scale: 1.035 }}
                    whileTap={reduced ? undefined : { scale: 0.99 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22, mass: 0.6 }}
                    className="group flex max-w-full flex-col rounded-[22px] border px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    style={{
                      borderColor: `${tint}4D`,
                      background: `${tint}12`,
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 26px -12px rgba(4,3,3,0.8)",
                      backdropFilter: "blur(6px)",
                      WebkitBackdropFilter: "blur(6px)",
                    }}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: tint, boxShadow: `0 0 8px ${tint}99` }}
                      />
                      <span className="truncate font-mono text-[13.5px] text-text-primary">
                        {r.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-muted">
                        {r.language}
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                      >
                        <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="mt-1.5 max-w-[30ch] text-[13px] leading-snug text-muted">
                      {r.description}
                    </span>
                  </motion.a>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
