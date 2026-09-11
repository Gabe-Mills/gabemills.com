import { motion } from "framer-motion";
import Bubble from "./Bubble";
import { stack } from "../data/stack";

/**
 * The five groups from Gabe's profile README — unboxed.
 *
 * There is no card. Each bubble floats directly on the constellation and grows
 * when you touch it. Headings wear `.on-field` because once the panel is gone
 * a 10px mono label has a lattice of glowing lines running through it.
 */
export default function StackSection() {
  return (
    <section
      id="stack"
      className="relative z-10 scroll-mt-28 px-5 pb-28 md:pb-40"
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

            <ul className="mt-6 flex flex-wrap gap-3">
              {group.items.map((item) => (
                <li key={item.label}>
                  <Bubble accent={item.accent}>
                    <span className="whitespace-nowrap font-mono text-[12.5px] tracking-[0.01em] text-text-primary/90">
                      {item.label}
                    </span>
                  </Bubble>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
