import { profile } from "../data/github";

const LINKEDIN_URL = "https://www.linkedin.com/in/gabemillsmc/";

/**
 * Back cover: the old footer (wordmark + Online status) plus the two outbound links
 * the navbar carries, as one quiet row. No email: removed on request 11 Sep 2026.
 */
export default function BackCover() {
  return (
    <footer className="sc-back">
      <div className="sc-wrap">
        <div className="sc-back-row">
          <a className="sc-back-mark" href="#top">
            Gabe Mills
          </a>
          <nav className="sc-back-links" aria-label="Elsewhere">
            <a className="sc-link" href={profile.url} target="_blank" rel="noopener noreferrer">
              GitHub <span aria-hidden="true">↗</span>
            </a>
            <a className="sc-link" href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
              LinkedIn <span aria-hidden="true">↗</span>
            </a>
          </nav>
          <span className="sc-status">
            <i aria-hidden="true" />
            Online
          </span>
        </div>
      </div>
    </footer>
  );
}
