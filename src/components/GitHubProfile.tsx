import { useState } from "react";
import { motion } from "framer-motion";
import { profile, repos, languages, totalBytes } from "../data/github";

const GH_MARK =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.05-.13-.36-.95.08-1.98 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.03.13 1.85.08 1.98.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8z";

const pct = (bytes: number) => (bytes / totalBytes) * 100;
const fmtPct = (n: number) => (n >= 10 ? n.toFixed(0) : n.toFixed(1));

/**
 * The GitHub section. Sits ABOVE the site previews — the code is the lead now.
 *
 * The language bar is a real chart of real data: byte counts summed across every
 * public repo. Colours are the validated dark-mode categorical slots assigned in
 * fixed order (see DESIGN.md), NOT the site's ember accent — a categorical scale
 * needs separable hues, and seven warm ones would fail CVD separation outright.
 * Text stays on text tokens throughout; the coloured swatch beside a label is
 * what carries identity, so nothing depends on colour alone.
 */
export default function GitHubProfile() {
  const [hover, setHover] = useState<string | null>(null);

  return (
    <section
      id="github"
      className="relative z-10 scroll-mt-24 px-5 py-16 md:py-24"
      aria-label="GitHub"
    >
      <div className="mx-auto w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="glass-smoked edge-lit overflow-hidden rounded-[14px]"
        >
          {/* ---- identity ---- */}
          <div className="flex items-center gap-5 p-5 sm:gap-6 sm:p-7">
            <div className="relative shrink-0">
              <div
                className="absolute -inset-2 rounded-full opacity-70 blur-xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,140,60,0.5), rgba(228,105,44,0) 70%)",
                }}
              />
              <img
                src="/github-avatar.png"
                alt="Gabe Mills"
                width={96}
                height={96}
                className="relative h-[68px] w-[68px] rounded-full object-cover ring-1 ring-[rgba(255,200,150,0.35)] sm:h-[84px] sm:w-[84px]"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="min-w-0 flex-1">
              <a
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <svg viewBox="0 0 16 16" className="h-[19px] w-[19px] shrink-0 fill-current text-text-primary" aria-hidden="true">
                  <path d={GH_MARK} />
                </svg>
                <span className="truncate font-mono text-[16px] tracking-tight text-text-primary transition-colors group-hover:text-[#FFB15E] sm:text-[18px]">
                  {profile.handle}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5">
                  <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-muted sm:text-[15px]">
                {profile.tagline}
              </p>
            </div>
          </div>

          {/* ---- language composition ---- */}
          <div className="border-t border-white/[0.07] p-5 sm:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                Language composition
              </h2>
              <span className="font-mono text-[10px] tracking-[0.1em] text-muted [font-variant-numeric:tabular-nums]">
                {Math.round(totalBytes / 1024)} KB across {repos.length + 1} repos
              </span>
            </div>

            {/* stacked bar — 2px surface gaps between segments, rounded outer ends */}
            <div
              className="mt-4 flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
              role="img"
              aria-label={`Language composition: ${languages
                .map((l) => `${l.name} ${fmtPct(pct(l.bytes))}%`)
                .join(", ")}`}
            >
              {languages.map((l, i) => (
                <div
                  key={l.name}
                  onMouseEnter={() => setHover(l.name)}
                  onMouseLeave={() => setHover(null)}
                  className="h-full transition-opacity duration-200"
                  style={{
                    width: `${pct(l.bytes)}%`,
                    background: l.color,
                    opacity: hover && hover !== l.name ? 0.3 : 1,
                    borderRadius:
                      i === 0
                        ? "999px 3px 3px 999px"
                        : i === languages.length - 1
                        ? "3px 999px 999px 3px"
                        : "3px",
                  }}
                />
              ))}
            </div>

            {/* legend doubles as the table view — identity never colour-alone */}
            <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
              {languages.map((l) => (
                <li
                  key={l.name}
                  onMouseEnter={() => setHover(l.name)}
                  onMouseLeave={() => setHover(null)}
                  className="flex items-center gap-2.5 transition-opacity duration-200"
                  style={{ opacity: hover && hover !== l.name ? 0.4 : 1 }}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: l.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary/90">
                    {l.name}
                  </span>
                  <span className="font-mono text-[12px] text-muted [font-variant-numeric:tabular-nums]">
                    {fmtPct(pct(l.bytes))}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---- repos ---- */}
          <div className="border-t border-white/[0.07] p-5 sm:p-7">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              Public repositories
            </h2>
            <ul className="mt-4 grid gap-2.5">
              {repos.map((r) => {
                const lang = languages.find((l) => l.name === r.langKey);
                return (
                  <li key={r.name}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 rounded-[8px] border border-white/[0.07] bg-white/[0.02] px-4 py-3 transition-colors hover:border-[rgba(255,177,94,0.4)] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: lang?.color ?? "#9085e9" }}
                          />
                          <span className="truncate font-mono text-[13.5px] text-text-primary">
                            {r.name}
                          </span>
                          <span className="shrink-0 font-mono text-[10.5px] text-muted">
                            {r.language}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-[13px] text-muted">
                          {r.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.topics.slice(0, 4).map((tp) => (
                            <span
                              key={tp}
                              className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[9.5px] tracking-[0.04em] text-muted"
                            >
                              {tp}
                            </span>
                          ))}
                        </div>
                      </div>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className="shrink-0 text-muted transition-all group-hover:translate-x-0.5 group-hover:text-text-primary"
                      >
                        <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
