import { Fragment, useState, type CSSProperties } from "react";
import "./stack.css";
import Words from "../Words";
import { stack, stackCount } from "../../data/stack";

/** The short list shown up front: what Gabe reaches for most. Everything is in "See all". */
const TOP = ["Claude Code", "Cursor", "Swift", "TypeScript", "Python", "React", "Three.js", "Cloudflare", "Blender", "CUDA"];

/**
 * Stack, v6 "simplify": the headline, ten tools on one line, and "See all 75" opening the
 * five groups as plain lists. Brand accents (stack.ts) stay as a coloured dot in the full list.
 */
export default function Stack() {
  const [open, setOpen] = useState(false);
  return (
    <section id="stack" className="bp-section sk" aria-labelledby="stack-title">
      <div className="bp-wrap">
        <Words as="h2" id="stack-title" className="bp-display sk-title" text={"THE *KIT.*"} />
        <p className="sk-top" data-build="box" data-delay="0.1">
          {TOP.map((t, i) => (
            <Fragment key={t}><span>{t}</span>{i < TOP.length - 1 && <i aria-hidden="true"> · </i>}</Fragment>
          ))}
        </p>
        <button type="button" className="sk-more" aria-expanded={open} aria-controls="sk-all"
          onClick={() => setOpen((o) => !o)} data-build="box" data-delay="0.18">
          {open ? "Show less" : `See all ${stackCount} tools`}
          <span className="sk-more__mark" aria-hidden="true" />
        </button>
        <div id="sk-all" className={`sk-all${open ? " is-open" : ""}`} hidden={!open}>
          {stack.map((g) => (
            <div key={g.title} className="sk-group">
              <h3 className="sk-group__title">{g.title} <span>{g.items.length}</span></h3>
              <ul>
                {g.items.map((it) => (
                  <li key={it.label} style={it.accent ? ({ "--brand": it.accent } as CSSProperties) : undefined}
                    className={it.accent ? "is-accent" : undefined}>
                    {it.label}
                  </li>
                ))}
              </ul>
              {g.link && (
                <a className="sk-link" href={g.link.url} target="_blank" rel="noreferrer">
                  {g.link.label} <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
