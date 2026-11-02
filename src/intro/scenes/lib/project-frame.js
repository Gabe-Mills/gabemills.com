// Shared kit for the showcase beats (one beat per project).
//
// makeProjectFrame(ctx, project, opts) gives a scene three things:
//   print   a THREE.Group: the site's screenshot as an engraved print in a frame. The
//           live ink pass engraves it, so it matches every other surface in the story.
//   develop a DOM layer pinned over the print's projected screen rect. Its real image
//           (or loop video) shows through hatch lines that widen with `develop` 0..1,
//           so the engraving "develops" into the live site. Scrubbed, so it reverses.
//   card    the project's details (index, tag, title, blurb, role/status, outcome,
//           stack, Visit link), scrubbed in and out by p. The link is clickable.
//
// The scene calls frame.update(p, camera, { develop, card }) every progress() call.
// Keep the print roughly facing the camera while develop > 0: the DOM layer is an
// axis-aligned rect around the projected corners.
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeProjectFrame(ctx, project, { width = 3.2, index = 1, total = 4, side = 'left' } = {}) {
  const { tex, cardMaterial, inkMaterial, flatMaterial, PAL } = ctx;
  const aspect = 1.6; // screenshots are 16:10
  const height = width / aspect;

  // ---- the engraved print, framed ----
  const print = new THREE.Group();
  const shot = tex(project.shot.replace(/^\//, '../'), { aspect });
  // the shot lives in /public/screenshots; tex() prefixes intro/, so step out of it
  const art = new THREE.Mesh(new THREE.PlaneGeometry(width, height), cardMaterial(shot, { hatch: 0.75, angle: 1.05, alphaTest: 0.0 }));
  art.position.z = 0.012;
  const frameDepth = 0.08, rim = 0.07;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + rim * 2, height + rim * 2, frameDepth),
    inkMaterial({ tone: 0.18, pal: PAL.NEUTRAL, angle: -1, hatch: 1 }),
  );
  frame.position.z = -frameDepth / 2;
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.02, height + 0.02), flatMaterial({ shade: 1, pal: PAL.PAPER_FLAT }));
  mat.position.z = 0.006;
  print.add(frame, mat, art);
  print.userData.corners = [
    new THREE.Vector3(-width / 2, -height / 2, 0.012), new THREE.Vector3(width / 2, -height / 2, 0.012),
    new THREE.Vector3(width / 2, height / 2, 0.012), new THREE.Vector3(-width / 2, height / 2, 0.012),
  ];

  // ---- DOM: develop layer + card ----
  const root = document.createElement('div');
  root.className = `pf pf--${side}`;
  root.setAttribute('aria-hidden', 'false');
  const real = document.createElement('div');
  real.className = 'pf-real';
  let video = null;
  if (project.loop) {
    video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'none' });
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.poster = project.shot;
    // VP9 webm first (2-3x smaller), the H.264 mp4 as the fallback
    for (const [src, type] of [[project.loop.replace(/\.mp4$/, '.webm'), 'video/webm'], [project.loop, 'video/mp4']]) {
      const s = document.createElement('source');
      s.src = src;
      s.type = type;
      video.appendChild(s);
    }
    real.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = project.shot;
    img.alt = project.shotAlt || '';
    real.appendChild(img);
  }
  const card = document.createElement('article');
  card.className = 'pf-card';
  const stack = (project.stack || []).join(' · ');
  card.innerHTML = `
    <p class="pf-index"><span>${String(index).padStart(2, '0')}</span> / ${String(total).padStart(2, '0')} <em>${esc(project.tag)}</em></p>
    <h3 class="pf-title">${esc(project.title)}</h3>
    <p class="pf-blurb">${esc(project.blurb)}</p>
    <p class="pf-meta">${esc(project.role)} · ${esc(project.status)}</p>
    <p class="pf-outcome">${esc(project.outcome)}</p>
    <p class="pf-stack">${esc(stack)}</p>
    <a class="pf-visit" href="${project.url}" target="_blank" rel="noopener noreferrer">Visit ${esc(project.host)} <span aria-hidden="true">↗</span></a>`;
  root.append(real, card);

  const v = new THREE.Vector3();
  let mounted = false, playing = false, lastRect = '';

  function rect(camera) {
    const W = ctx.engine.width, H = ctx.engine.height;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    print.updateWorldMatrix(true, false);
    for (const c of print.userData.corners) {
      v.copy(c).applyMatrix4(print.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return [x0, y0, x1 - x0, y1 - y0];
  }

  return {
    print,
    card,
    enter() {
      if (!mounted) { ctx.overlay.appendChild(root); mounted = true; }
      root.classList.add('is-active');
    },
    exit() {
      root.classList.remove('is-active');
      if (video && playing) { video.pause(); playing = false; }
    },
    /**
     * @param p        beat progress 0..1
     * @param camera   the scene camera (after it has been positioned this frame)
     * @param develop  0..1, how far the engraving has turned into the real site
     * @param cardIn   0..1, card visibility (scrubbed; 0 hides it)
     */
    update(p, camera, { develop = 0, cardIn = 0 } = {}) {
      const [x, y, w, h] = rect(camera);
      const key = `${x | 0},${y | 0},${w | 0},${h | 0}`;
      if (key !== lastRect) {
        lastRect = key;
        real.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        real.style.width = `${w}px`;
        real.style.height = `${h}px`;
      }
      // hatch lines widen from 0 to the full 8px period: engraving -> real
      const d = smooth(0, 1, develop);
      real.style.setProperty('--d', d.toFixed(3));
      real.style.visibility = d > 0.002 ? 'visible' : 'hidden';
      if (video) {
        const want = d > 0.05 && !ctx.reduced;
        if (want && !playing) { video.play().catch(() => {}); playing = true; }
        else if (!want && playing) { video.pause(); playing = false; }
      }
      card.style.setProperty('--c', cardIn.toFixed(3));
      card.style.visibility = cardIn > 0.002 ? 'visible' : 'hidden';
    },
    dispose() {
      root.remove();
      print.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    },
  };
}

/** Card visibility for a beat: in over [a, b], out over [c, d]. */
export function cardCurve(p, a = 0.32, b = 0.5, c = 0.9, d = 1.0) {
  return smooth(a, b, p) * (1 - smooth(c, d, p));
}
export { smooth };

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
