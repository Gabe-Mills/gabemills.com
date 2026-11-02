// Mounts the engraved scroll intro into a <section>. Returns { destroy }.
// The section gets the full scroll height; a sticky stage inside holds the one canvas.
import './intro.css';
import { Engine } from './core/engine.js';
import { ScrollStory } from './story.js';

function webgl2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function mountIntro(section, { onSkipTo = '#top' } = {}) {
  if (!webgl2()) { section.style.display = 'none'; return { destroy() {} }; }
  section.classList.add('intro');
  section.innerHTML = `
    <div class="intro-stage">
      <canvas class="intro-canvas" aria-hidden="true"></canvas>
      <div class="intro-overlay"></div>
      <div class="intro-caption" aria-live="polite">
        <span class="intro-caption-n"></span>
        <p class="intro-caption-text"></p>
      </div>
      <div class="intro-hint" aria-hidden="true"><span>Scroll</span><i></i></div>
      <button type="button" class="intro-skip">Skip intro</button>
      <div class="intro-rail" aria-hidden="true"><i></i></div>
    </div>`;
  const canvas = section.querySelector('.intro-canvas');
  const engine = new Engine(canvas);
  const story = new ScrollStory({
    engine,
    section,
    captionEl: section.querySelector('.intro-caption'),
    overlay: section.querySelector('.intro-overlay'),
  });
  section.querySelector('.intro-skip').addEventListener('click', () => {
    document.querySelector(onSkipTo)?.scrollIntoView({ behavior: 'smooth' });
  });
  window.__intro = { engine, story };
  story.init().then(() => { section.classList.add('is-ready'); engine.start(); });
  return {
    destroy() {
      story.destroy();
      engine.stop();
      engine.renderer.dispose();
      section.innerHTML = '';
    },
  };
}
