import { motion } from "framer-motion";
import { stack } from "../data/stack";

/**
 * The five groups from Gabe's GitHub profile README, rendered as chip rows.
 *
 * Chips are ember by default because the README's own badges are #C4783A, which
 * is already the site accent — so the default case needs no translation. Only
 * the items he gave explicit brand colours carry a coloured dot, which is what
 * makes the Anthropic / OpenAI / NVIDIA groupings readable at a glance. If
 * every chip were coloured none of them would mean anything.
 */
export default function StackSection() {
  return (
    <section
      id="stack"
      className="relative z-10 scroll-mt-28 px-5 pb-24 md:pb-36"
      aria-label="Stack"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="glass-smoked edge-lit overflow-hidden rounded-[14px]">
          {stack.map((group, gi) => (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: Math.min(gi * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
              className={`p-7 sm:p-10 ${gi > 0 ? "border-t border-white/[0.07]" : ""}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  {group.title}
                </h2>
                {group.link && (
                  <>
                    <span aria-hidden="true" className="font-mono text-[10px] text-muted/50">
                      ·
                    </span>
                    <a
                      href={group.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10.5px] text-[#FFB15E] underline decoration-[rgba(255,177,94,0.35)] underline-offset-[3px] transition-colors hover:decoration-[rgba(255,177,94,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB15E]"
                    >
                      {group.link.label}
                    </a>
                  </>
                )}
                <span className="ml-auto font-mono text-[10px] text-muted/60 [font-variant-numeric:tabular-nums]">
                  {group.items.length}
                </span>
              </div>

              <ul className="mt-6 flex flex-wrap gap-2.5 sm:gap-3">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-2.5 rounded-full border px-4 py-2.5 transition-colors"
                    style={{
                      borderColor: item.accent ? `${item.accent}55` : "rgba(255,177,94,0.22)",
                      background: item.accent ? `${item.accent}14` : "rgba(255,177,94,0.06)",
                      // top inner highlight — what makes a pill read as a bubble
                      // rather than as a flat outlined rectangle with round ends
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: item.accent ?? "#E4692C",
                        boxShadow: `0 0 7px ${item.accent ?? "#E4692C"}88`,
                      }}
                    />
                    <span className="whitespace-nowrap font-mono text-[12.5px] tracking-[0.01em] text-text-primary/90">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
