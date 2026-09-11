import { motion } from "framer-motion";

const GITHUB_URL = "https://github.com/Gabe-Mills";
const HANDLE = "Gabe-Mills";

/**
 * The one outbound personal link on the site.
 *
 * The avatar is a static asset captured at build time rather than fetched from
 * the GitHub API at runtime — this is now the only way off the page, so it must
 * not depend on a request that can rate-limit or fail. No repo or follower
 * counts: they go stale, and a number is text.
 */
export default function GitHubCard() {
  return (
    <section
      id="github"
      className="relative z-10 scroll-mt-24 px-5 py-20 md:py-28"
      aria-label="GitHub profile"
    >
      <motion.a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Gabe Mills on GitHub — github.com/${HANDLE}`}
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="glass-smoked edge-lit group mx-auto flex w-full max-w-xl items-center gap-5 overflow-hidden rounded-[14px] p-5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E] focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:gap-7 sm:p-7"
      >
        {/* portrait — the only human element on the page, so it leads */}
        <div className="relative shrink-0">
          <div
            className="absolute -inset-2 rounded-full opacity-60 blur-xl transition-opacity duration-500 group-hover:opacity-100"
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
            className="relative h-[72px] w-[72px] rounded-full object-cover ring-1 ring-[rgba(255,200,150,0.35)] sm:h-24 sm:w-24"
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <svg
              viewBox="0 0 16 16"
              className="h-5 w-5 shrink-0 fill-current text-text-primary sm:h-[22px] sm:w-[22px]"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.05-.13-.36-.95.08-1.98 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.03.13 1.85.08 1.98.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="truncate font-mono text-[15px] tracking-tight text-text-primary sm:text-[17px]">
              {HANDLE}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            github.com
          </p>
        </div>

        {/* arrow */}
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 text-text-primary transition-all duration-300 group-hover:translate-x-0.5 group-hover:border-[rgba(255,177,94,0.6)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 17L17 7M17 7H9M17 7V15"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </motion.a>
    </section>
  );
}
