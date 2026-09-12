import { motion } from "framer-motion";

/**
 * Hero — "Molten Glass" (DESIGN.md).
 *
 * The contour heat field paints its own ground and fades out at the lower edge,
 * so it replaces the old radial scrim entirely and hands off to the wire lattice
 * behind it. Display type is Instrument Serif; the only thick-glass surfaces on
 * the site live here.
 */
/**
 * The separator in the positioning line.
 *
 * Same trap as the stack index, and it caught me twice: margins make visual
 * space but no *break opportunity*, so three `whitespace-nowrap` phrases with
 * margin-separated dots and no whitespace text node between them produced one
 * unbreakable line that ran off both edges of a phone. The hero clips it with
 * `overflow-hidden`, so it never registered as page overflow — it just silently
 * cut "GPU CLOUD" to "CLOUD".
 *
 * A no-break space glues the dot to the phrase before it; the caller puts an
 * ordinary space after, which is the only place the line may break.
 */
function Sep() {
  return (
    <span aria-hidden="true" className="text-muted/45">
      {" ·"}
    </span>
  );
}

export default function HeroMachine({ isReady }: { isReady: boolean }) {
  return (
    <section
      id="top"
      className="relative flex w-full flex-col items-center justify-center overflow-hidden px-5 pb-28 pt-36 sm:pb-32 sm:pt-40 md:min-h-[92vh] md:pb-36 md:pt-44"
    >
      {/* Local quiet ground for the type block. The contour field is at its densest
          exactly where the wordmark sits, and lines crossing the letter counters
          read as noise however bright the type is. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(46% 34% at 50% 43%, rgba(8,5,4,0.78) 0%, rgba(8,5,4,0.5) 48%, rgba(8,5,4,0) 82%)",
        }}
      />

      {/* Quiet ground for the type block. Third time this has been necessary:
          whatever the background is, a dense field directly behind the wordmark
          puts lines through the letter counters and the mono labels. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            "radial-gradient(50% 38% at 50% 46%, rgba(7,5,5,0.82) 0%, rgba(7,5,5,0.5) 52%, rgba(7,5,5,0) 84%)",
        }}
      />

      <div
        className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center"
        style={{
          transform:
            "translate3d(calc(var(--px,0) * -8px), calc(var(--py,0) * -8px), 0)",
        }}
      >
        <motion.h1
          className="wordmark select-none font-display font-normal leading-[0.9] tracking-[-0.02em] text-[17vw] sm:text-[15vw] md:text-[12vw] lg:text-[158px]"
          initial={{ opacity: 0, filter: "blur(18px)", y: 18 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="block sm:inline">GABE</span>{" "}
          <span className="block sm:inline">MILLS</span>
        </motion.h1>

        {/* Two lines, and they are the whole argument.

            The site spent a week as a pure visual index — 28 words, no
            positioning, no role — which looks confident and tells a stranger
            nothing. A portfolio has about three seconds to answer "what does
            this person do" before someone decides how hard to look. This is
            that answer, at the size and restraint the rest of the page earns:
            one line of discipline, one line of employer, mono, small, quiet.

            Both are lifted from Gabe's own profile README rather than written
            fresh, so the site and the GitHub page say the same thing. */}
        <motion.p
          className="on-field mt-8 font-mono text-[11.5px] uppercase tracking-[0.26em] text-text-primary/80 sm:text-[13px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Inner no-break spaces hold each discipline together, so a narrow
              screen breaks BETWEEN the three and never through the middle of
              one — at 375 it was landing as "NATIVE APPLE / APPS". */}
          {"GPU cloud"}
          <Sep />{" "}
          {"native Apple apps"}
          <Sep />{" "}
          {"creative tech"}
        </motion.p>

        <motion.p
          className="on-field mt-3.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-[0.05em] text-muted"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="uppercase tracking-[0.22em] text-muted/60">Currently</span>
          <a
            href="https://massedcompute.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1 text-[#FFB15E] underline decoration-[rgba(255,177,94,0.35)] underline-offset-[4px] transition-colors hover:decoration-[rgba(255,177,94,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
          >
            Massed Compute
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 17L17 7M17 7H9M17 7V15"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <span className="text-muted/70">
            NVIDIA GPU cloud — recipes, marketplace, design
          </span>
        </motion.p>
      </div>

      {/* scroll indicator */}
      {isReady && (
        <motion.div
          className="relative z-10 mt-16 flex flex-col items-center md:absolute md:bottom-10 md:left-1/2 md:mt-0 md:-translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 1 }}
        >
          <div className="relative h-9 w-5 rounded-full border border-white/20">
            <span className="anim-scroll-dot absolute left-1/2 top-1.5 h-1.5 w-1 -translate-x-1/2 rounded-full bg-[#FFB15E]" />
          </div>
        </motion.div>
      )}
    </section>
  );
}
