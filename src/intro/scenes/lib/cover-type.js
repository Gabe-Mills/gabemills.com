// The cover's type (DOM in ctx.overlay): GM mark, the name, the positioning line, where
// Gabe is now, and two quiet profile links. Scrubbed by p, so it rewinds with the scroll:
//   0.05 -> 0.40  letters rise into place one by one (arriving lit, cooling to paper), lines follow
//   0.40 -> 0.82  hold
//   0.82 -> 0.99  everything lifts and fades; the two words part with the field
// Nothing is ever clipped: letters move and fade, they are never masked mid-glyph.
const GITHUB_URL = 'https://github.com/Gabe-Mills';
const LINKEDIN_URL = 'https://www.linkedin.com/in/gabemillsmc/';
const MASSED_COMPUTE_URL = 'https://massedcompute.com';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ramp = (a, b, x) => clamp01((x - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

export function makeCoverType(overlay) {
  const root = document.createElement('div');
  root.className = 'cvb';
  const words = ['GABE', 'MILLS'];
  root.innerHTML = `
    <div class="cvb-inner">
      <img class="cvb-mark cvb-step" src="/logo-gm.webp" alt="" width="170" height="100" decoding="async" />
      <h1 class="cvb-name" aria-label="Gabe Mills">${words
        .map((w, wi) => `<span class="cvb-word" data-w="${wi}">${[...w].map((c) => `<span class="cvb-l" aria-hidden="true">${c}</span>`).join('')}</span>`)
        .join('<span class="cvb-gap" aria-hidden="true"> </span>')}</h1>
      <span class="cvb-rule cvb-step" aria-hidden="true"></span>
      <p class="cvb-line cvb-step"><span class="cvb-ph">Software development<span class="cvb-sep" aria-hidden="true">&nbsp;·</span></span> <span class="cvb-ph">native Apple apps<span class="cvb-sep" aria-hidden="true">&nbsp;·</span></span> <span class="cvb-ph">creative tech</span></p>
      <p class="cvb-current cvb-step">
        <span class="cvb-current-k">Currently</span>
        <span class="cvb-current-d">software development at <a class="cvb-mc" href="${MASSED_COMPUTE_URL}" target="_blank" rel="noopener noreferrer">Massed Compute<span aria-hidden="true">&nbsp;↗</span></a></span>
      </p>
      <nav class="cvb-links cvb-step" aria-label="Profiles">
        <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">GitHub<span aria-hidden="true">&nbsp;↗</span></a>
        <a href="${LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">LinkedIn<span aria-hidden="true">&nbsp;↗</span></a>
      </nav>
    </div>`;

  const letters = [...root.querySelectorAll('.cvb-l')];
  // each letter knows its word and its offset from that word's middle (for the parting)
  const meta = letters.map((el) => {
    const word = el.parentElement;
    const sibs = [...word.children];
    const wi = Number(word.dataset.w);
    return { el, wi, c: sibs.indexOf(el) - (sibs.length - 1) / 2 };
  });
  const [mark, rule, line, current, links] = ['.cvb-mark', '.cvb-rule', '.cvb-line', '.cvb-current', '.cvb-links'].map((s) => root.querySelector(s));
  // [element, in-start, in-end, out-start, out-end]: lines come in after the name, leave before it
  const steps = [
    [mark, 0.05, 0.17, 0.88, 0.97],
    [rule, 0.22, 0.32, 0.85, 0.93],
    [line, 0.25, 0.35, 0.84, 0.92],
    [current, 0.28, 0.38, 0.83, 0.91],
    [links, 0.3, 0.4, 0.82, 0.9],
  ];
  const N = letters.length;
  let last = -1;

  function update(p) {
    if (Math.abs(p - last) < 1e-5) return;
    last = p;
    root.style.visibility = p > 0.045 && p < 0.995 ? 'visible' : 'hidden';
    for (let i = 0; i < N; i++) {
      const m = meta[i];
      // in: 0.05 -> ~0.33, left to right; out: 0.85 -> ~0.98, outside letters first
      const tin = easeOut(ramp(0.05 + i * 0.022, 0.15 + i * 0.022, p));
      const rank = Math.abs(i - (N - 1) / 2) / ((N - 1) / 2); // 1 at the ends, 0 in the middle
      const os = 0.85 + (1 - rank) * 0.05;
      const tout = easeIn(ramp(os, os + 0.08, p));
      const s = m.el.style;
      s.setProperty('--in', tin.toFixed(4));
      s.setProperty('--out', tout.toFixed(4));
      s.setProperty('--dx', `${((m.wi ? 1 : -1) * 0.5 + m.c * 0.06).toFixed(3)}em`);
    }
    for (const [el, a, b, c, d] of steps) {
      el.style.setProperty('--in', easeOut(ramp(a, b, p)).toFixed(4));
      el.style.setProperty('--out', easeIn(ramp(c, d, p)).toFixed(4));
    }
  }

  return {
    root,
    show() { if (!root.parentNode) overlay.appendChild(root); root.classList.add('is-on'); last = -1; },
    hide() { root.classList.remove('is-on'); root.style.visibility = 'hidden'; },
    update,
    dispose() { root.remove(); },
  };
}
