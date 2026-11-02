import type { CSSProperties } from "react";
import "./Stack.css";
import { useScrub } from "./useScrub";
import { stack, stackCount } from "../data/stack";

const NVIDIA = "#76B900";

/** layout slot per group, in data order: the column spans live in Stack.css */
const SLOTS = ["lang", "libs", "ai", "models", "dev"];
/** parallax depth per column, so neighbours arrive at different speeds */
const DEPTH = [3, 1.5, 2.5, 1, 2];

/**
 * Stack, calm layout, scrubbed by scroll: the five README groups fly up as layered
 * columns, then each item inks in as hatch strokes, one after another. Items the README
 * gave a brand colour turn ember at the end; the NVIDIA GPU items glow. Plays backwards
 * on the way up; reduced motion shows the finished state.
 */
export default function Stack() {
  const ref = useScrub<HTMLElement>(1.1);
  return (
    <section ref={ref} id="stack" className="sc-scrub sc-rain st" aria-labelledby="st-title">
      <div className="sc-stage">
        <div className="sc-stage-inner">
          <div className="sc-wrap">
            <header className="st-head" data-scrub data-from="-0.3" data-to="0.06">
              <p className="sc-kicker sc-rise">Stack</p>
              <h2 id="st-title" className="sc-title sc-ink">
                What I build with.
              </h2>
              <p className="sc-body st-sub sc-rise">
                {stackCount} entries in {stack.length} groups, as listed in the GitHub profile README.
              </p>
            </header>

            <div className="st-cols">
              {stack.map((g, gi) => {
                const slot = SLOTS[gi] ?? "auto";
                const titleId = `st-g-${slot}`;
                return (
                  <section
                    key={g.title}
                    className={`st-group st-group--${slot}`}
                    data-scrub
                    data-from={String(0.02 + gi * 0.06)}
                    data-to={String(0.5 + gi * 0.06)}
                    style={{ "--z": DEPTH[gi] ?? 1, "--n": g.items.length } as CSSProperties}
                    aria-labelledby={titleId}
                  >
                    <h3 id={titleId} className="st-group-title">
                      {g.title}
                      <span className="st-n">
                        <span className="sr-only">, </span>
                        {g.items.length}
                        <span className="sr-only"> items</span>
                      </span>
                    </h3>
                    <ul className="st-items">
                      {g.items.map((item, i) => (
                        <li
                          key={item.label}
                          className={[
                            "sc-ink",
                            item.accent ? "is-accent" : "",
                            item.accent === NVIDIA ? "is-gpu" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{ "--i": i } as CSSProperties}
                        >
                          {item.label}
                        </li>
                      ))}
                    </ul>
                    {g.link && (
                      <a className="sc-link st-link" href={g.link.url} target="_blank" rel="noopener noreferrer">
                        {g.link.label} <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
