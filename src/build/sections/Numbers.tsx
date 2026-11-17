import { type CSSProperties } from "react";
import "./numbers.css";
import { wallStats } from "../../data/wall";

/** a word or two on screen; the full wall.ts label stays for screen readers */
const SHORT: Record<string, string> = {
  "AI models benchmarked": "AI models benchmarked",
  "Commits on GitHub": "Commits on GitHub",
};
const ORDER = ["Projects built", "Sites live", "AI models benchmarked", "Commits on GitHub"];
const stats = ORDER.map((l) => wallStats.find((s) => s.label === l)).filter(Boolean) as typeof wallStats;

/**
 * A number that rolls up as it rises in. The value is a CSS counter computed from the
 * reveal's --e (registered @property in numbers.css), no per-frame JS. A hidden copy of the
 * final value reserves the width; screen readers get the real value as text.
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
 * Numbers, v6 "simplify": one quiet row of four, between two hairlines. Each figure rolls up
 * as it rises in. (Counted 20 Oct 2026, wall.ts.)
 */
export default function Numbers() {
  return (
    <section id="numbers" className="nm" aria-label="By the numbers">
      <div className="bp-wrap">
        <ul className="nm-row">
          {stats.map((s, i) => (
            <li key={s.label} className="nm-cell" data-build="box" data-delay={(i * 0.06).toFixed(2)} data-dur="1.4">
              <span className="sr-only">{`${s.value}${s.suffix} ${s.label}`}</span>
              <span className="bp-display nm-num"><Count value={s.value} suffix={s.suffix} /></span>
              <span className="nm-label" aria-hidden="true">{SHORT[s.label] ?? s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
