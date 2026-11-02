// DOM for the `code` beat, in ctx.overlay: the header, one label per repo signboard
// (pinned to the board's projected rect with a leader line), the profile card and the
// map legend. Everything is scrubbed by p through custom properties; nothing animates
// on its own, so scrolling back up rewinds it. Layout rules:
//   - never under the navbar pill (top ~96 px desktop, ~72 px phone) or the skip button
//   - labels are shown one at a time; the card and legend only after the last label
//   - phones (< 760 px): labels and the card sit at the bottom, the legend at the top
import { profile, repos, languages, majorLanguages, minorLanguages, otherBytes, totalBytes, repoCount } from '../../../data/github';
import { SPEC, OTHER_SWATCH } from './code-city.js';

const ENGRAVED_AVATAR = '/showcase/engraved/avatar.webp';
const FALLBACK_AVATAR = '/github-avatar.png';

const pct = (b) => (b / totalBytes) * 100;
const fmtPct = (n) => (n >= 10 ? n.toFixed(0) : n.toFixed(1));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** CSS for a hatched swatch in the tower's palette, lines at the tower's screen angle. */
function swatch(color, angleRad, cross = false) {
  const a = -(angleRad * 180) / Math.PI;
  const line = `repeating-linear-gradient(${a.toFixed(1)}deg, ${color} 0 1.6px, transparent 1.6px 3.6px)`;
  return cross ? `${line}, repeating-linear-gradient(${(a + 90).toFixed(1)}deg, ${color} 0 1.2px, transparent 1.2px 4px)` : line;
}

export function makeCodeDom(ctx) {
  const root = document.createElement('section');
  root.className = 'cb';
  root.setAttribute('aria-labelledby', 'cb-title');

  const ariaLabel = `Language composition across ${repoCount} repositories, by bytes: ${languages
    .map((l) => `${l.name} ${fmtPct(pct(l.bytes))}%`)
    .join(', ')}. ${minorLanguages.map((l) => l.name).join(', ')} are grouped as Other, ${fmtPct(pct(otherBytes))}%.`;
  const rows = [
    ...majorLanguages.map((l) => ({ name: l.name, bytes: l.bytes, bg: swatch(SPEC[l.name].swatch, SPEC[l.name].angle) })),
    { name: 'Other', bytes: otherBytes, bg: swatch(OTHER_SWATCH, 0.8, true) },
  ];

  root.innerHTML = `
    <header class="cb-head cb-plate">
      <p class="cb-kicker">GitHub</p>
      <h2 class="cb-title" id="cb-title">The code, in public.</h2>
    </header>
    <ul class="cb-repos" aria-label="Public repositories">
      ${repos.map((r, i) => `
      <li class="cb-repo">
        <i class="cb-lead" aria-hidden="true"></i><i class="cb-pin" aria-hidden="true"></i>
        <div class="cb-box cb-plate">
          <p class="cb-repo-k"><span>${String(i + 1).padStart(2, '0')}</span> / ${String(repos.length).padStart(2, '0')} · ${esc(r.language)}</p>
          <a class="cb-repo-name" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} <span aria-hidden="true">↗</span></a>
          <p class="cb-repo-desc">${esc(r.description)}</p>
          <p class="cb-repo-topics"><span class="cb-sr">Topics: </span>${r.topics.map(esc).join(' · ')}</p>
        </div>
      </li>`).join('')}
    </ul>
    <aside class="cb-card cb-plate" aria-label="GitHub profile">
      <div class="cb-card-top">
        <a class="cb-avatar" href="${esc(profile.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(profile.handle)} on GitHub">
          <img src="${ENGRAVED_AVATAR}" alt="" width="76" height="76" decoding="async" />
        </a>
        <div class="cb-id">
          <p class="cb-kicker">GitHub profile</p>
          <a class="cb-handle" href="${esc(profile.url)}" target="_blank" rel="noopener noreferrer">${esc(profile.handle)}</a>
        </div>
      </div>
      <p class="cb-tagline">${esc(profile.tagline)}</p>
      <dl class="cb-meta">
        <div><dt>Org</dt><dd><a href="${esc(profile.orgUrl)}" target="_blank" rel="noopener noreferrer">${esc(profile.org)}</a></dd></div>
        <div><dt>Since</dt><dd>${esc(profile.since)}</dd></div>
      </dl>
      <a class="cb-cta" href="${esc(profile.url)}" target="_blank" rel="noopener noreferrer">View profile <span aria-hidden="true">↗</span></a>
    </aside>
    <div class="cb-legend cb-plate" role="img" aria-label="${esc(ariaLabel)}">
      <p class="cb-legend-k">Legend</p>
      <p class="cb-legend-t">Language composition</p>
      <p class="cb-legend-sub">Tower height = bytes · ${Math.round(totalBytes / 1024)} KB across ${repoCount} repos</p>
      <ul class="cb-legend-list">
        ${rows.map((r, i) => `<li style="--i:${i}"><i style="background-image:${r.bg}"></i><span class="n">${esc(r.name)}</span><span class="v">${fmtPct(pct(r.bytes))}%</span></li>`).join('')}
      </ul>
      <p class="cb-legend-tail">Other: ${minorLanguages.map((l) => `${esc(l.name)} ${fmtPct(pct(l.bytes))}%`).join(' · ')}</p>
    </div>`;

  const img = root.querySelector('.cb-avatar img');
  img.addEventListener('error', () => { if (!img.src.endsWith(FALLBACK_AVATAR)) img.src = FALLBACK_AVATAR; });

  const head = root.querySelector('.cb-head');
  const card = root.querySelector('.cb-card');
  const legend = root.querySelector('.cb-legend');
  const labels = [...root.querySelectorAll('.cb-repo')].map((li) => ({
    li, box: li.querySelector('.cb-box'), lead: li.querySelector('.cb-lead'), pin: li.querySelector('.cb-pin'),
    w: 0, h: 0, last: '',
  }));

  let mounted = false, sizedFor = '';
  const vis = new Map();
  function show(el, v, prop = '--v') {
    const key = v.toFixed(2);   // 100 steps is smooth; finer just re-styled more often
    if (vis.get(el) === key) return;
    vis.set(el, key);
    el.style.setProperty(prop, key);
    el.style.visibility = v > 0.002 ? 'visible' : 'hidden';
  }
  function measure(W, H) {
    const key = `${W}x${H}`;
    if (key === sizedFor) return;
    sizedFor = key;
    for (const l of labels) { l.w = l.box.offsetWidth; l.h = l.box.offsetHeight; l.last = ''; }
  }
  document.fonts?.ready?.then(() => { sizedFor = ''; });

  return {
    root,
    enter() {
      if (!mounted) { ctx.overlay.appendChild(root); mounted = true; }
      root.classList.add('is-active');
    },
    exit() { root.classList.remove('is-active'); },
    /**
     * @param s.head, s.card, s.legend  0..1 visibility
     * @param s.labels  per repo: { v: 0..1, rect: [x0, y0, x1, y1] | null }
     */
    update(s) {
      const W = ctx.engine.width, H = ctx.engine.height, phone = W < 760;
      root.classList.toggle('is-phone', phone);
      measure(W, H);
      show(head, s.head);
      show(card, s.card);
      show(legend, s.legend);
      const top = phone ? 76 : 100, bottom = phone ? 66 : 76, gap = phone ? 22 : 44;
      labels.forEach((l, i) => {
        const { v, rect } = s.labels[i];
        const on = v > 0.002 && rect;
        show(l.li, on ? v : 0);
        if (!on) return;
        const [x0, y0, x1, y1] = rect, cy = (y0 + y1) / 2, cx = (x0 + x1) / 2;
        let bx, by, ax, ay, ex, ey;
        if (phone) {
          bx = 16; by = H - bottom - l.h;
          ax = clamp(cx, 24, W - 24); ay = Math.min(y1, by - 12);
          ex = clamp(ax, bx + 16, bx + l.w - 16); ey = by;
        } else {
          const right = x1 + gap + l.w < W - 72;
          bx = right ? x1 + gap : x0 - gap - l.w;
          bx = clamp(bx, 24, W - 72 - l.w);
          by = clamp(cy - l.h / 2, top, H - bottom - l.h);
          ax = right ? x1 : x0; ay = cy;
          ex = right ? bx : bx + l.w; ey = clamp(cy, by + 16, by + l.h - 16);
        }
        const len = Math.hypot(ex - ax, ey - ay), ang = Math.atan2(ey - ay, ex - ax);
        const key = `${bx | 0},${by | 0},${ax | 0},${ay | 0},${len | 0},${ang.toFixed(2)}`;
        if (key === l.last) return;
        l.last = key;
        l.box.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
        l.pin.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0)`;
        // length as scaleX on a 1px line: a width write here forced layout every frame
        l.lead.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) rotate(${ang.toFixed(4)}rad) scaleX(${len.toFixed(1)})`;
      });
    },
    dispose() { root.remove(); },
  };
}
