import { useState, type CSSProperties, type MouseEvent } from "react";
import "./github.css";
import Words from "../Words";
import { profile, repos, majorLanguages, minorLanguages, otherBytes, totalBytes } from "../../data/github";

const pct = (bytes: number) => (bytes / totalBytes) * 100;
const fmt = (p: number) => `${p.toFixed(1)}%`;

/**
 * The bar is one glowing metallic bar: the page's greens and silvers, in a fixed order that
 * alternates light and dark so neighbours separate. Names and percentages are written out
 * under it (and in the bar's label), so the tone never carries meaning alone.
 */
const TONES = ["#D6FBE8", "#3DBE80", "#8FE6B8", "#1E6B49", "#BFD8CB", "#2FA36B", "#7FA897", "#4D5C55"];

/** one bar: the seven majors with their own slot, then the tail summed as "Other" */
const segments = [
  ...majorLanguages.map((l) => ({ name: l.name, p: pct(l.bytes) })),
  { name: "Other", p: pct(otherBytes) },
].map((s, i) => ({ ...s, color: TONES[i % TONES.length] }));
const otherNames = minorLanguages.map((l) => l.name).join(", ");
const barLabel =
  `Languages across public repos, by bytes (${totalBytes.toLocaleString("en-US")} in all): ` +
  segments.map((s) => `${s.name} ${fmt(s.p)}`).join(", ") +
  ` (Other is ${otherNames}).`;
const colorOf = (key: string) => segments.find((s) => s.name === key)?.color ?? TONES[TONES.length - 1];

/** the big languages are named under their own stretch of the bar; the tail is listed after */
const BIG = 0.1;

/**
 * v4: "THE CODE, IN PUBLIC." in kinetic words, the profile set on the repo grid's last column,
 * the four repos as dark cards lit from above that the crew drags in (each name rises word by
 * word as its card lands), and the languages as one glowing metal bar. One left edge, one mono
 * kicker. A card's topics show on hover, keyboard focus or a tap (they are always in the DOM).
 */
export default function GitHub() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const onCard = (key: string) => (ev: MouseEvent) => {
    if ((ev.target as HTMLElement).closest("a, button")) return;
    setOpen((o) => ({ ...o, [key]: !o[key] }));
  };

  return (
    <section id="github" className="bp-section gh" aria-labelledby="github-title">
      <div className="gh-light" aria-hidden="true" />
      <div className="bp-wrap gh-wrap">
        <header className="gh-head">
          <p className="bp-kicker" data-build="fade">
            GitHub · <b>since {profile.since}</b>
          </p>
          <Words as="h2" id="github-title" className="bp-display gh-title" text={"THE CODE,\nIN *PUBLIC.*"} />

          <div className="gh-me" data-build="fade" data-delay="0.1">
            <img
              className="gh-avatar" src="/github-avatar.png" alt="Gabe Mills, GitHub avatar"
              width={400} height={400} loading="lazy" decoding="async"
            />
            <div className="gh-me-body">
              <a className="gh-handle" href={profile.url} target="_blank" rel="noreferrer">
                @{profile.handle} <span aria-hidden="true">↗</span>
              </a>
              <p className="gh-tagline">{profile.tagline}</p>
              <p className="gh-org">
                Org{" "}
                <a href={profile.orgUrl} target="_blank" rel="noreferrer">
                  {profile.org} <span aria-hidden="true">↗</span>
                </a>
              </p>
            </div>
          </div>
        </header>

        <ol className="gh-repos" aria-label={`${repos.length} public repositories`}>
          {repos.map((r, i) => (
            <li
              key={r.name} className="gh-repo" data-build="box" data-dur="2"
              data-from={i < 2 ? "left" : "right"} data-delay={(0.04 + i * 0.06).toFixed(2)}
              data-label={`repo · ${r.language.toLowerCase()}`}
              data-open={open[r.name] || undefined} onClick={onCard(r.name)}
              style={{ "--c": colorOf(r.langKey) } as CSSProperties}
            >
              <span className="gh-repo-lang">{r.language}</span>
              {/* the name's words rise with the card's own drag-in (--m), no extra build */}
              <a className="gh-repo-name" href={r.url} target="_blank" rel="noreferrer">
                <Words text={r.name} build={false} />
                <span className="gh-arrow" aria-hidden="true">↗</span>
              </a>
              <p className="gh-repo-desc">{r.description}</p>
              <p className="gh-repo-topics">
                <span className="sr-only">Topics: </span>
                {r.topics.join(" / ")}
              </p>
            </li>
          ))}
        </ol>

        <div className="gh-langs" data-build="box" data-from="below" data-delay="0.12" data-dur="2" data-label={`${segments.length} languages · bytes`}>
          <div className="gh-langs-head" aria-hidden="true">
            <span>Languages, by bytes</span>
            <span>{totalBytes.toLocaleString("en-US")} bytes</span>
          </div>
          <div className="gh-bar" role="img" aria-label={barLabel}>
            {segments.map((s, i) => (
              <span key={s.name} className="gh-seg" style={{ flexBasis: `${s.p}%`, "--i": i, "--c": s.color } as CSSProperties} />
            ))}
          </div>
          <div className="gh-names" aria-hidden="true">
            {segments.map((s, i) => (
              <span key={s.name} className="gh-name" style={{ flexBasis: `${s.p}%`, "--i": i, "--c": s.color } as CSSProperties}>
                {s.p / 100 >= BIG && (
                  <>
                    {s.name} <b>{fmt(s.p)}</b>
                  </>
                )}
              </span>
            ))}
          </div>
          <ul className="gh-legend" aria-hidden="true">
            {segments.map((s, i) => (
              <li
                key={s.name} className={s.p / 100 >= BIG ? "is-big" : undefined}
                style={{ "--i": i, "--c": s.color } as CSSProperties}
                title={s.name === "Other" ? otherNames : undefined}
              >
                {s.name} <b>{fmt(s.p)}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
