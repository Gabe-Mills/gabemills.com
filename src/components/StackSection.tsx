import { motion } from "framer-motion";
import Bubble from "./Bubble";
import BubbleField from "./BubbleField";
import { stack } from "../data/stack";

/**
 * The five groups from Gabe's profile README — unboxed.
 *
 * There is no card and no grid. Each group is a `BubbleField`: the bubbles fall
 * toward a point in the middle of the band, pack against each other, and get
 * pushed around by the cursor. Headings wear `.on-field` because once the panel
 * is gone a 10px mono label has a lattice of glowing lines running through it.
 */
/**
 * Where each cluster's attractor sits, as a fraction off the field's centre.
 * Five blobs on one axis read as one component repeated; drifting the point
 * they collapse toward is the same trick the project tiles use with width and
 * offset. Kept small — past about 0.1 the cluster starts leaning on a wall.
 */
const BIAS = [-0.07, 0.06, -0.05, 0.04, -0.06];

export default function StackSection() {
  return (
    <section
      id="stack"
      /* pb-16, not the old pb-28/40: every field now carries ~45px of its own
         slack below the cluster, and the two stacked left half a screen of
         nothing between the last bubble and the first tile. */
      className="relative z-10 scroll-mt-28 px-5 pb-16 md:pb-24"
      aria-label="Stack"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 md:gap-20">
        {stack.map((group, gi) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.65, delay: Math.min(gi * 0.05, 0.25), ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="on-field font-mono text-[11px] uppercase tracking-[0.24em] text-text-primary/75">
                {group.title}
              </h2>
              {group.link && (
                <>
                  <span aria-hidden="true" className="on-field font-mono text-[11px] text-muted/60">
                    ·
                  </span>
                  <a
                    href={group.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="on-field font-mono text-[11px] text-[#FFB15E] underline decoration-[rgba(255,177,94,0.4)] underline-offset-[3px] transition-colors hover:decoration-[rgba(255,177,94,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
                  >
                    {group.link.label}
                  </a>
                </>
              )}
              <span className="on-field ml-auto font-mono text-[11px] text-muted/70 [font-variant-numeric:tabular-nums]">
                {group.items.length}
              </span>
            </div>

            <BubbleField bias={BIAS[gi % BIAS.length]}>
              {group.items.map((item) => (
                <Bubble key={item.label} accent={item.accent}>
                  <span className="whitespace-nowrap font-mono text-[12.5px] tracking-[0.01em] text-text-primary/90">
                    {item.label}
                  </span>
                </Bubble>
              ))}
            </BubbleField>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
