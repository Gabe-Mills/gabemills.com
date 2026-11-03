import "./hero.css";
import { profile } from "../../data/github";
import Words from "../Words";

/**
 * Hero (#top), shot like a film opening (v3: cinematic, nothing crossing the portrait, no live
 * dots; v4: kinetic words, one left edge, 8px rhythm). One ~3 s load sequence on one clock:
 *   0.0 s       black
 *   0.1-1.2 s   the key light rises: a green back light behind his head and shoulders
 *   0.3-1.9 s   BUILDER's outline draws itself on, far behind
 *   0.35 s      the portrait is grabbed and carried into the light as a dark silhouette, dropped ~1.2 s
 *   1.15-2.1 s  his exposure comes up out of the dark (brightness / contrast only, no tint)
 *   1.55 s      the crew drags out a text box; GABE, MILLS and the period rise in turn
 *   2.2 s       the positioning line rises word by word
 *   2.45 s      the buttons are dropped, 2.8 s the Massed Compute line fades up
 *   2.3-3.1 s   BUILDER fills with metallic green; from 3.4 s a slow light sweep crosses it
 * Camera: on scroll the shot pushes in on three depth layers (word slowest, portrait, name
 * fastest) and the frame falls back to black (CSS scroll timelines, transform / opacity only).
 *
 * The portrait (Gabe's own photo, 1137 x 1250, both shoulders) is a cut-out, contained and
 * bottom-anchored. The green light lives only BEHIND him (the halo) and on his outline (a thin
 * mint drop-shadow on the cut-out itself, so it can never tint the suit or skin). Nothing green
 * is drawn over him; his suit stays near-black and his skin natural.
 */
const LINKEDIN = "https://www.linkedin.com/in/gabemillsmc/";
const MASSED = "https://massedcompute.com";

export function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.05-.13-.36-.95.08-1.98 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.03.13 1.85.08 1.98.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A7.995 7.995 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function LinkedInIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="currentColor">
      <path d="M0 1.15C0 .52.52 0 1.18 0h13.64C15.48 0 16 .52 16 1.15v13.7c0 .63-.52 1.15-1.18 1.15H1.18C.52 16 0 15.48 0 14.85V1.15zm4.94 12.24V6.17H2.54v7.22h2.4zM3.74 5.18c.84 0 1.36-.55 1.36-1.25-.02-.71-.52-1.25-1.34-1.25-.82 0-1.36.54-1.36 1.25 0 .7.52 1.25 1.32 1.25h.02zm4.91 8.21V9.36c0-.22.02-.43.08-.59.17-.43.57-.88 1.23-.88.87 0 1.21.66 1.21 1.63v3.87h2.4V9.25c0-2.22-1.18-3.25-2.76-3.25-1.27 0-1.84.7-2.16 1.19v.03h-.02l.02-.03V6.17h-2.4c.03.68 0 7.22 0 7.22h2.4z" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section id="top" className="hero">
      <div className="bp-wrap hero__in">
        {/* the shot: a giant metallic word far behind, the key light, the portrait. Each depth
            layer sits in its own parallax wrapper so the build's transform never collides. */}
        <div className="hero__stage" aria-hidden="true">
          <div className="hero__wordpx">
            {/* viewBox fitted to Anton's caps at 404 units; textLength pins the width */}
            <svg className="hero__word" viewBox="-6 -6 1216 364" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="hero-metal" x1="0" y1="0" x2="1" y2="0.35">
                  <stop offset="0" stopColor="#1E6B49" />
                  <stop offset="0.24" stopColor="#4FC98C" />
                  <stop offset="0.42" stopColor="#D6FBE8" />
                  <stop offset="0.58" stopColor="#3DBE80" />
                  <stop offset="0.74" stopColor="#9BE8C0" />
                  <stop offset="1" stopColor="#1A5A3E" />
                </linearGradient>
                <linearGradient id="hero-sweep" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#D6FBE8" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#E9FFF3" stopOpacity="0.62" />
                  <stop offset="1" stopColor="#D6FBE8" stopOpacity="0" />
                </linearGradient>
                <clipPath id="hero-wordclip">
                  <text x="0" y="350" textLength="1204" lengthAdjust="spacingAndGlyphs">BUILDER</text>
                </clipPath>
              </defs>
              <text className="hero__wordfill" x="0" y="350" textLength="1204" lengthAdjust="spacingAndGlyphs">BUILDER</text>
              {/* the light sweep: a soft band that crosses the letters (clipped to them) */}
              <g clipPath="url(#hero-wordclip)">
                <rect className="hero__sweep" x="-420" y="-6" width="300" height="364" fill="url(#hero-sweep)" />
              </g>
              <text className="hero__wordline" x="0" y="350" textLength="1204" lengthAdjust="spacingAndGlyphs">BUILDER</text>
            </svg>
          </div>
          <div className="hero__portraitpx">
            <div className="hero__rig">
              {/* the key light: a green back light behind his head and shoulders, rising first. It
                  sits BEHIND the portrait in z-order and fades out above his chest */}
              <div className="hero__light"><i className="hero__halo" /><i className="hero__beam" /></div>
              <div className="hero__portrait" data-build="box" data-from="right" data-mode="load" data-delay="0.35" data-span="0.85" data-label="portrait.webp">
                <div className="hero__cut">
                  <picture>
                    <source media="(max-width: 899px)" srcSet="/build/portrait-m.webp" />
                    <img src="/build/portrait.webp" alt="" width={1137} height={1250} decoding="async" {...{ fetchpriority: "high" }} />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hero__namepx">
          <div className="hero__left">
            {/* kinetic words on the load clock: GABE, MILLS, then the period rise in turn */}
            <Words as="h1" className="bp-display hero__name" text={"Gabe\nMills *.*"}
              delay={1.55} data-mode="load" data-span="1.1" data-label="h1" />
            <Words as="p" className="hero__pos" text={"Software development ·\nnative Apple apps · creative tech"}
              delay={2.2} data-mode="load" data-span="0.8" data-label="p" />
            <div className="hero__cta" data-build="box" data-from="below" data-mode="load" data-delay="2.45" data-span="0.7" data-label="2 links">
              <a className="bp-link" href={profile.url} target="_blank" rel="noopener noreferrer">
                <GitHubIcon className="h-4 w-4" /> GitHub
              </a>
              <a className="bp-link bp-link--ghost" href={LINKEDIN} target="_blank" rel="noopener noreferrer">
                <LinkedInIcon className="h-4 w-4" /> LinkedIn
              </a>
            </div>
            <a className="hero__now" href={MASSED} target="_blank" rel="noopener noreferrer"
              aria-label="Currently software development at Massed Compute (opens in a new tab)"
              data-build="fade" data-mode="load" data-delay="2.8" data-span="0.4">
              Now at <b>Massed Compute</b> <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
      {/* the grade: vignette and the fall to black at the bottom, then black as you scroll away */}
      <div className="hero__vignette" aria-hidden="true" />
      <div className="hero__out" aria-hidden="true" />
    </section>
  );
}
