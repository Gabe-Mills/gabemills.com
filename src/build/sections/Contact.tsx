import "./contact.css";
import { profile } from "../../data/github";
import { GitHubIcon, LinkedInIcon } from "./Hero";
import Words from "../Words";
import GM3D from "./GM3D";

/**
 * Contact (#contact), the last shot (v3: cinematic, no status dots, better arrows; v4: kinetic
 * words, one left edge, 8px rhythm). It emerges from black: the headline rises in word by word,
 * the two ways in are dragged into place (GitHub from the left, LinkedIn from the right, each
 * label rising as it is carried), then the closing statement rises on the left while a single
 * shaft of green light opens onto the stage on the right, where Gabe's GM monogram rises out
 * of the dark in real-time 3D (GM3D: brushed green metal, rim-lit, it leans toward the pointer
 * and catches a light sweep on hover). Every line starts on the .bp-wrap column.
 * Each row ends in an arrow that launches on hover: the ring fills with metal, the arrow
 * flies out to the top right and a fresh one slides in from the bottom left.
 * No email (removed on request).
 */
const LINKEDIN = { url: "https://www.linkedin.com/in/gabemillsmc/", handle: "in/gabemillsmc" };

const rows = [
  { label: "GitHub", handle: `@${profile.handle}`, url: profile.url, Icon: GitHubIcon, from: "left" },
  { label: "LinkedIn", handle: LINKEDIN.handle, url: LINKEDIN.url, Icon: LinkedInIcon, from: "right" },
];

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7M8.5 7H17v8.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

export default function Contact() {
  return (
    <section id="contact" className="bp-section contact">
      <div className="bp-wrap">
        <div className="contact__head">
          <Words as="h2" className="bp-display contact__title" text={"Let\u2019s *build*\nsomething."} delay={0} />
        </div>

        <div className="contact__ways">
          {rows.map(({ label, handle, url, Icon, from }, i) => (
            <a key={label} className="contact__row" href={url} target="_blank" rel="noopener noreferrer"
              aria-label={`${label}, ${handle} (opens in a new tab)`}
              data-build="box" data-from={from} data-delay={String(0.12 + i * 0.05)} data-label={label}>
              {/* the label rises out of its mask as the crew carries the row in (reads the row's --m) */}
              <Words build={false} className="bp-display contact__label" text={label} />
              <span className="contact__handle" aria-hidden="true"><Icon className="contact__icon" />{handle}</span>
              <span className="contact__go" aria-hidden="true">
                <span className="contact__fly"><Arrow /><Arrow /></span>
              </span>
            </a>
          ))}
        </div>

        {/* the final shot: the statement on the column, the light and the monogram stage beside it */}
        <figure className="contact__finale">
          <Words as="blockquote" className="bp-display contact__quote"
            text={"Make it useful.\n*Then make it*\n*feel right.*"} delay={0.25} />
          <div className="contact__shot">
            <div className="contact__light" aria-hidden="true"><i className="contact__shaft" /><i className="contact__pool" /></div>
            <GM3D className="contact__stage" />
          </div>
        </figure>

        <footer className="contact__foot" data-build="fade" data-delay="0.35">
          <span>© 2026 Gabe Mills</span>
          <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
        </footer>
      </div>
    </section>
  );
}
