// Floating comic panels: an art card inside a paper border with an ink outline.
// Put them in your scene in front of the camera; tween .position / .scale with gsap.
import * as THREE from 'three';
import { cardMaterial, flatMaterial, PAL } from './gbuffer.js';

/**
 * @param texture  card texture (opaque art is fine for panels)
 * @param w,h      inner size in world units
 * @param border   paper border width in world units
 */
export function makePanel(source, { w = 1.6, h = 0.6, border = 0.035, hatch = 0.3 } = {}) {
  const g = new THREE.Group();
  // crop a private copy so the shared cached texture keeps its own repeat/offset
  const texture = source.clone();
  texture.userData = { ...source.userData };
  source.addEventListener('loaded', () => {
    texture.dispose();
    texture.image = source.image;
    texture.userData.aspect = source.userData.aspect;
    texture.needsUpdate = true;
    texture.dispatchEvent({ type: 'loaded' });
  });
  const outline = new THREE.Mesh(new THREE.PlaneGeometry(w + border * 2 + 0.012, h + border * 2 + 0.012), flatMaterial({ shade: 0, pal: PAL.NEUTRAL }));
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(w + border * 2, h + border * 2), flatMaterial({ shade: 1, pal: PAL.PAPER_FLAT }));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cardMaterial(texture, { hatch, alphaTest: 0.01 }));
  frame.position.z = 0.001;
  art.position.z = 0.002;
  // cover-fit the art into the panel once its aspect is known
  const fit = () => {
    const a = texture.userData.aspect;
    if (!a) return;
    const pa = w / h;
    texture.repeat.set(a > pa ? pa / a : 1, a > pa ? 1 : a / pa);
    texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
  };
  fit();
  texture.addEventListener('loaded', fit);
  g.add(outline, frame, art);
  g.userData.art = art;
  return g;
}
