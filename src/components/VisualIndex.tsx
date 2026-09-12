import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { projects } from "../data/projects";
import type { Project } from "../data/projects";

/**
 * The builds, as pictures.
 *
 * No prose — each tile carries a screenshot, the project name, and its host.
 * With no copy to protect, the composition can do the work that words used to:
 * tiles are deliberately unequal in width and vertical offset (a uniform
 * three-across grid is the thing that reads as generated), and each one
 * parallaxes at its own rate against the lattice behind it.
 */
export default function VisualIndex() {
  return (
    <section
      id="builds"
      className="relative z-10 scroll-mt-28 overflow-hidden px-5 py-24 md:py-36"
      aria-label="Builds"
    >
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-24 md:gap-32">
        {projects.map((p, i) => (
          <Tile key={p.id} project={p} index={i} />
        ))}
      </div>
    </section>
  );
}

/** Unequal widths and offsets — the asymmetry is the composition. */
/**
 * `lift` is a CLASS, not an inline style. As `style={{ marginTop }}` the negative
 * offsets applied at every breakpoint and cancelled the flex gap on narrow
 * screens, so the tiles ended up touching. Scoped to md+, the stagger only
 * happens where the asymmetric layout actually exists.
 */
const layout = [
  { width: "md:w-[52%]", align: "md:self-start", lift: "" },
  { width: "md:w-[44%]", align: "md:self-end", lift: "md:-mt-16" },
  { width: "md:w-[48%]", align: "md:self-start md:ml-[12%]", lift: "md:-mt-10" },
];

function Tile({ project: p, index }: { project: Project; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // each tile drifts at its own rate, so the row never moves as one slab
  // Overscan is 12%, so the parallax range has to stay inside it or an edge shows.
  // The sources are now 4:3 and the image box is 1.6/1.12 = 1.43, which means
  // object-cover trims top and bottom rather than the sides — at 16:10 sources
  // with a 20% overscan it cropped horizontally and clipped "Leland" to "eland".
  const y = useTransform(scrollYProgress, [0, 1], [13 + index * 3, -13 - index * 3]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.04, 1, 1.04]);

  const l = layout[index % layout.length];

  return (
    <motion.a
      ref={ref}
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${p.title} — ${p.host}`}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative block w-full ${l.width} ${l.align} ${l.lift} focus-visible:outline-none`}
    >
      <div className="glass-smoked relative overflow-hidden rounded-[14px]">
        {/* molten rim, revealed on hover — the hero's glass language, used sparingly */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 rounded-[14px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{
            padding: "1px",
            background:
              "linear-gradient(140deg, rgba(255,214,170,0.72) 0%, rgba(255,120,50,0.28) 30%, rgba(120,170,255,0.22) 62%, rgba(255,200,150,0.5) 100%)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Image stays clean. The name used to sit on top of it, which put
            "Fuji Afterglow" directly over the screenshot's own "Fuji Afterglow"
            and read as a doubling bug — these are screenshots of text-heavy
            sites, so there is no reliably quiet region to caption into. */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <motion.img
            src={p.shot}
            alt={p.shotAlt}
            style={{ y, scale }}
            className="absolute inset-x-0 -top-[6%] h-[112%] w-full object-cover object-top"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* ember hairline divides image from caption */}
        <span
          aria-hidden="true"
          className="pointer-events-none block h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(${p.glow},0.7), transparent)`,
          }}
        />

        {/* Caption row. Until 12 Sep this was a name and a host, and that is all
            a stranger got — no way to tell whether Gabe built the thing or
            skinned it. `role`, `status` and a one-line blurb were sitting in
            projects.ts unrendered the whole time; a portfolio tile that doesn't
            say what you did is a screenshot, not a credit. */}
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight text-text-primary sm:text-[16.5px]">
              {p.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10.5px] tracking-wide text-muted">
              <span className="truncate">{p.host}</span>
              <span aria-hidden="true" className="text-muted/40">
                ·
              </span>
              <span className="text-[#FFB15E]/75">{p.role}</span>
              <span aria-hidden="true" className="text-muted/40">
                ·
              </span>
              <span>{p.status}</span>
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.5] text-text-primary/60">
              {p.blurb}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-text-primary transition-all duration-300 group-hover:translate-x-0.5 group-hover:border-[rgba(255,177,94,0.6)]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 17L17 7M17 7H9M17 7V15"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </motion.a>
  );
}
