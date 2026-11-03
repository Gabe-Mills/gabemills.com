import { type CSSProperties } from "react";
import "./numbers.css";
import Words from "../Words";
import { wallStats, workedWith } from "../../data/wall";

/** wall.ts: "Numbers on the wall HUD. Counted 20 Oct 2026" */
const COUNTED = "Counted 20 Oct 2026.";
const lead = wallStats.find((s) => s.label === "Projects built") ?? wallStats[0];
const rest = wallStats.filter((s) => s !== lead);

/** a word or two on screen; the full wall.ts label stays for screen readers */
const SHORT: Record<string, string> = {
  "Sites live": "Sites live",
  "Projects built": "Projects built",
  "AI models benchmarked": "AI models",
  "Commits on GitHub": "Commits",
};
const short = (label: string) => SHORT[label] ?? label;

/**
 * A number that rolls up with its build. The value is drawn by a CSS counter computed
 * from the engine's --e (registered @property in numbers.css), so there is no per-frame
 * JS here. A hidden copy of the final value reserves the width so nothing shifts while
 * it counts; screen readers get the real value as text.
 */
function Count({ value, suffix }: { value: number; suffix: string }) {
  return (
    <span className="nm-count" aria-hidden="true">
      <span className="nm-count-num">
        <span className="nm-count-ghost">{value}</span>
        <span className="nm-count-roll" style={{ "--to": value } as CSSProperties} />
      </span>
      {suffix && <span className="nm-count-suffix">{suffix}</span>}
    </span>
  );
}

/**
 * v4, one shot on one left edge: the giant metal 90+ rises out of the dark under a single
 * green key light, a slow sweep crossing its metal, and the other three stats are dropped
 * beside it. Every numeral sits on one baseline and every label on one line below it (a
 * subgrid, numerals trimmed to cap height and baseline). Behind it the worked-with names
 * drift past as a huge, dim band (the depth layer).
 */
export default function Numbers() {
  const names = (hidden: boolean) => (
    <ul className="nm-track" aria-hidden={hidden || undefined} aria-label={hidden ? undefined : "Worked with"}>
      {workedWith.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );

  return (
    <section id="numbers" className="bp-section nm" aria-labelledby="numbers-title">
      <div className="bp-wrap nm-wrap">
        <p className="bp-kicker" data-build="fade">
          By the <b>numbers</b>
        </p>
        <Words as="h2" id="numbers-title" className="bp-display nm-title" text={"THE *RECEIPTS.*"} />

        <div className="nm-stage">
          {/* the key light: one soft cone from above, it comes up as the shot arrives */}
          <div className="nm-light" aria-hidden="true">
            <span className="nm-cone" />
            <span className="nm-pool" />
          </div>

          {/* depth layer: the worked-with names, huge and dim, drifting slowly */}
          <div className="nm-band" data-build="fade" data-delay="0.02">
            <p className="nm-band-label" aria-hidden="true">Worked with</p>
            <div className="nm-band-depth">
              <div className="nm-belt">
                {names(false)}
                {names(true)}
              </div>
            </div>
          </div>

          <ul className="nm-grid">
            <li
              className="nm-cell nm-hero" data-build="box" data-from="below" data-delay="0.06" data-dur="2.4"
              data-label={`${lead.value}${lead.suffix} · ${short(lead.label).toLowerCase()}`}
            >
              <span className="sr-only">{`${lead.value}${lead.suffix} ${lead.label}`}</span>
              <span className="nm-num"><Count value={lead.value} suffix={lead.suffix} /></span>
              <span className="nm-label" aria-hidden="true">{short(lead.label)}</span>
            </li>
            {rest.map((s, i) => (
              <li
                key={s.label} className="nm-cell nm-stat" data-build="box"
                data-from={i === 2 ? "right" : "below"} data-delay={(0.12 + i * 0.05).toFixed(2)}
                data-label={`stat · ${short(s.label).toLowerCase()}`}
              >
                <span className="sr-only">{`${s.value}${s.suffix} ${s.label}`}</span>
                <span className="nm-num"><Count value={s.value} suffix={s.suffix} /></span>
                <span className="nm-label" aria-hidden="true">{short(s.label)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="nm-counted" data-build="fade" data-delay="0.22">{COUNTED}</p>
      </div>
    </section>
  );
}
