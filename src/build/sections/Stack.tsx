import { useState, type CSSProperties, type MouseEvent } from "react";
import "./stack.css";
import Words from "../Words";
import { stack, stackCount } from "../../data/stack";

const pad = (n: number) => String(n).padStart(2, "0");
const PREVIEW = 3;
const MID = (stack.length - 1) / 2;

/** card titles fit one line; the full stack.ts title stays in the heading for screen readers
 *  and is written out at the top of the card's expanded list */
const SHORT: Record<string, string> = {
  "Libraries & tools": "Tools",
  "AI I use every day": "AI daily",
  "Models we've actually run": "Models run",
};
const short = (title: string) => SHORT[title] ?? title;

/**
 * v4: "THE KIT." in kinetic words, one-line card titles, no card numbers or rules, and the
 * same card language as the GitHub repos (radius, padding, light from above).
 * v3, cinematic: five cards in a dark space under a green key light. As the section scrolls
 * up they fan slowly out of a deck that sits deep in the shot (a scroll timeline on each slot,
 * transform only), the far ones in shadow until they arrive. Each card's face is its title,
 * its count as a big metal numeral and a short preview; hover, keyboard focus or "All" turns
 * it to every item. All items are always in the DOM; brand accents are a coloured underline.
 */
export default function Stack() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const flip = (i: number) => setOpen((o) => ({ ...o, [i]: !o[i] }));
  const onCard = (i: number) => (ev: MouseEvent) => {
    if ((ev.target as HTMLElement).closest("a, button")) return;
    flip(i);
  };

  return (
    <section id="stack" className="bp-section sk" aria-labelledby="stack-title">
      <div className="sk-light" aria-hidden="true" />
      <div className="bp-wrap sk-wrap">
        <p className="bp-kicker" data-build="fade">
          Stack · <b>{stackCount} tools</b>
        </p>
        <Words as="h2" id="stack-title" className="bp-display sk-title" text={"THE *KIT.*"} />

        <div className="sk-deck">
          {stack.map((g, gi) => {
            const c = gi - MID;
            const rest = g.items.length - PREVIEW;
            return (
              <div key={g.title} className="sk-slot" style={{ "--c": c, "--a": Math.abs(c) } as CSSProperties}>
                <section
                  className="sk-card" aria-labelledby={`sk-g${gi}`}
                  data-build="box" data-from={c < 0 ? "left" : c > 0 ? "right" : "below"}
                  data-delay={(0.05 + gi * 0.06).toFixed(2)} data-dur="2.2"
                  data-label={`${g.title.toLowerCase()} · ${g.items.length}`}
                  data-open={open[gi] || undefined} onClick={onCard(gi)}
                >
                  <h3 id={`sk-g${gi}`} className="sk-card-title">
                    <span aria-hidden="true">{short(g.title)}</span>
                    <span className="sr-only">{g.title}</span>
                  </h3>

                  <div className="sk-flip">
                    <div className="sk-face" aria-hidden="true">
                      <span className="sk-count">
                        <span className="sk-count-ghost">{pad(g.items.length)}</span>
                        <span className="sk-count-roll" style={{ "--to": g.items.length } as CSSProperties} />
                      </span>
                      <span className="sk-preview">
                        {g.items.slice(0, PREVIEW).map((it) => it.label).join(" · ")}
                        {rest > 0 && <b> +{rest}</b>}
                      </span>
                    </div>
                    <div className="sk-items" id={`sk-items-${gi}`}>
                      <p className="sk-full" aria-hidden="true">{g.title}</p>
                      <ul aria-label={`${g.title}, ${g.items.length} items`}>
                      {g.items.map((it) => (
                        <li
                          key={it.label} className={it.accent ? "is-accent" : undefined}
                          style={it.accent ? ({ "--brand": it.accent } as CSSProperties) : undefined}
                        >
                          {it.label}
                        </li>
                      ))}
                      </ul>
                    </div>
                  </div>

                  <footer className="sk-card-foot">
                    {g.link ? (
                      <a className="sk-link" href={g.link.url} target="_blank" rel="noreferrer">
                        {g.link.label} <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button" className="sk-all" aria-expanded={!!open[gi]} aria-controls={`sk-items-${gi}`}
                      onClick={() => flip(gi)}
                    >
                      {open[gi] ? "Close" : `All ${g.items.length}`}
                      <span className="sr-only"> in {g.title}</span>
                    </button>
                  </footer>
                  <span className="sk-shade" aria-hidden="true" />
                </section>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
