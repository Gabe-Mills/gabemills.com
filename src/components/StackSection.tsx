import type { CSSProperties } from "react";
import { stack } from "../data/stack";
import type { Chip } from "../data/stack";

/**
 * The stack as a typographic index.
 *
 * Three versions of this section died to get here: a boxed card, a flex-wrap of
 * pills, and a physics field where the pills clustered toward a point. All three
 * had the same problem — 75 short strings, each wrapped in its own bordered,
 * filled, blurred container, is 75 pieces of furniture competing with the
 * constellation behind them. The content is a list of words. It is set as words.
 *
 * What the pills were actually carrying was the brand colour, and that survives:
 * an item with an explicit accent wears it, everything else is warm white. The
 * run stays calm and the coloured terms punctuate it — which is what the little
 * coloured dots were doing, minus the containers they were glued to.
 *
 * Nothing moves. No entrance, no drift, no scroll reveal: the terms are simply
 * there, and only the one under the cursor responds. Stripping the panels off
 * was always in service of the constellation, and this is the version that
 * finally lets it be the only thing alive on the page.
 */

/** neutral terms — warm white, not ember; sixty orange words is a wall */
const REST = "rgba(255, 242, 234, 0.7)";
/** what a neutral term becomes under the cursor */
const HOT = "#FFB15E";
/** the warm white brand colours are blended toward, so they stay in the palette */
const PAPER = [255, 242, 234] as const;
/** relative luminance a term has to clear to be readable on this ground */
const MIN_LUM = 0.2;

const srgb = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: number[]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const hex = ([r, g, b]: number[]) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/**
 * A brand colour chosen for a badge is not automatically a colour you can set
 * text in. OpenAI's #412991 is fine as a 8px dot with a border around it and
 * nearly invisible as a word on near-black — so each accent is blended toward
 * the page's warm white until it clears a luminance floor, and no further.
 * Colours that already clear it (NVIDIA's green) come back untouched, which is
 * why this is a loop and not a flat 40% tint: a flat tint washes every brand to
 * the same pastel and the distinctions stop meaning anything.
 */
function legible(brand: string): string {
  const n = parseInt(brand.slice(1), 16);
  let c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  for (let i = 0; i < 10 && lum(c) < MIN_LUM; i++) {
    c = c.map((v, k) => v + (PAPER[k] - v) * 0.12);
  }
  return hex(c);
}

export default function StackSection() {
  return (
    <section
      id="stack"
      className="relative z-10 scroll-mt-28 px-5 pb-20 md:pb-28"
      aria-label="Stack"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 md:gap-[4.5rem]">
        {stack.map((group) => (
          <div key={group.title}>
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

            {/* The only rule in the section. It's what makes the run below read
                as an indexed list rather than a runaway paragraph, and it fades
                out to the right so it never reads as the top of a box. */}
            <span
              aria-hidden="true"
              className="mt-3 block h-px w-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,177,94,0.3), rgba(255,177,94,0.06) 42%, transparent)",
              }}
            />

            {/* Inline `li`s, so the terms flow and wrap like prose. Any grid puts
                us back where the pills were: aligned columns and a shape, rather
                than a sentence. */}
            <ul className="on-field mt-5 text-[clamp(18px,2.05vw,25px)] font-medium leading-[1.66] tracking-[-0.014em] [word-spacing:0.2em]">
              {group.items.map((item, i) => (
                <li key={item.label} className="inline">
                  <Term chip={item} />
                  {i < group.items.length - 1 && (
                    <>
                      {/* A no-break space glues the dot to the word before it and
                          an ordinary space after it is the line's only break
                          opportunity — so a wrap leaves the dot at the end of its
                          own line instead of starting the next one with "· CSS".
                          Getting this wrong in either direction is visible:
                          nowrap on the whole item removed every break point and
                          the run ran straight off the right edge of the page. */}
                      <span aria-hidden="true" className="text-muted/25">
                        {"\u00A0\u00B7"}
                      </span>{" "}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * One term.
 *
 * The colours are custom properties rather than event handlers so the hover
 * lives entirely in CSS — which is also what gets it keyboard focus and the
 * reduced-motion opt-out for free. `.term` in index.css also explains why it
 * has to stay `display: inline` for the separator to behave.
 */
function Term({ chip }: { chip: Chip }) {
  const tint = chip.accent ? legible(chip.accent) : HOT;
  return (
    <span
      className="term"
      style={
        {
          "--rest": chip.accent ? `${tint}D9` : REST,
          "--hot": tint,
          "--halo": `${tint}5C`,
        } as CSSProperties
      }
    >
      {chip.label}
    </span>
  );
}
