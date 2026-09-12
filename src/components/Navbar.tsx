import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const GITHUB_URL = "https://github.com/Gabe-Mills";

/**
 * The button renders only when this is non-empty — that was the point of
 * holding the slot, and it stays that way: empty the string and the site loses
 * the button cleanly rather than serving a link to nowhere.
 */
const LINKEDIN_URL = "https://www.linkedin.com/in/gabemillsmc/";

/**
 * Wordmark, GitHub, LinkedIn.
 *
 * The section links went with the prose, so the bar is down to identity and the
 * two ways to reach Gabe. The mailto Build pill was removed 11 Sep 2026 on
 * request; the contact question reopened 12 Sep and closed the same day when he
 * supplied the LinkedIn profile — that is now the only non-GitHub path in, so
 * it earns equal weight in the bar rather than being tucked in the footer.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed left-0 right-0 top-0 z-50 flex justify-center px-3 pt-3 md:px-4 md:pt-6"
    >
      <div
        className={`flex max-w-full items-center gap-1.5 rounded-full border px-2 py-2 transition-all duration-500 ${
          scrolled
            ? "border-white/12 bg-surface/70 shadow-lg shadow-black/40 backdrop-blur-xl"
            : "border-white/8 bg-surface/40 backdrop-blur-md"
        }`}
      >
        <a
          href="#top"
          aria-label="Gabe Mills — back to top"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] font-mono text-[11px] font-semibold tracking-tight text-text-primary transition-colors hover:border-[rgba(255,177,94,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
        >
          GM
        </a>

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gabe Mills on GitHub"
          className="group flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-text-primary transition-colors hover:border-[rgba(255,177,94,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.05-.13-.36-.95.08-1.98 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.03.13 1.85.08 1.98.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="font-mono text-[12px] tracking-tight">GitHub</span>
        </a>

        {LINKEDIN_URL && (
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Gabe Mills on LinkedIn"
            className="group flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-text-primary transition-colors hover:border-[rgba(255,177,94,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M13.63 13.63h-2.37V9.92c0-.89-.02-2.03-1.24-2.03-1.24 0-1.43.97-1.43 1.97v3.77H6.22V6h2.28v1.04h.03c.32-.6 1.09-1.24 2.25-1.24 2.4 0 2.85 1.58 2.85 3.64v4.19zM3.56 4.96a1.38 1.38 0 1 1 0-2.75 1.38 1.38 0 0 1 0 2.75zm1.19 8.67H2.37V6h2.38v7.63zM14.81 0H1.18C.53 0 0 .52 0 1.16v13.68C0 15.48.53 16 1.18 16h13.63c.65 0 1.19-.52 1.19-1.16V1.16C16 .52 15.46 0 14.81 0z" />
            </svg>
            <span className="font-mono text-[12px] tracking-tight">LinkedIn</span>
          </a>
        )}
      </div>
    </motion.nav>
  );
}
