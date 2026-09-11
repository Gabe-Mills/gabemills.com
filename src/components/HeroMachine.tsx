import { motion } from "framer-motion";

/**
 * Hero — "Molten Glass" (DESIGN.md).
 *
 * The contour heat field paints its own ground and fades out at the lower edge,
 * so it replaces the old radial scrim entirely and hands off to the wire lattice
 * behind it. Display type is Instrument Serif; the only thick-glass surfaces on
 * the site live here.
 */
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
          className="select-none font-display font-normal leading-[0.9] tracking-[-0.02em] text-[17vw] sm:text-[15vw] md:text-[12vw] lg:text-[158px]"
          initial={{ opacity: 0, filter: "blur(18px)", y: 18 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            backgroundImage:
              "linear-gradient(96deg, #FFE9CC 0%, #FFFFFF 34%, #FFB673 58%, #FFE9CC 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 10px 66px rgba(255,120,40,0.28))",
          }}
        >
          <span className="block sm:inline">GABE</span>{" "}
          <span className="block sm:inline">MILLS</span>
        </motion.h1>

        {/* The wordmark is the entire hero. Removed on request, in order: the
            positioning line and both CTAs, then the "Systems emerging from the
            dark" eyebrow and the "Scroll to wake the machine" label. The
            animated capsule below survives deliberately — it is a graphic, not
            text, and with no copy left it is the only thing indicating the page
            continues past the first screen. */}
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
