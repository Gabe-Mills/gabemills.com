// Texture loading with a placeholder fallback, so scenes run before the art exists.
// Art lives in public/art/*.png (ink on transparent background). See ART.md.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();

function placeholder(name, aspect = 0.6) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 / aspect);
  const g = c.getContext('2d');
  g.fillStyle = '#111';
  g.beginPath();
  g.ellipse(c.width / 2, c.height * 0.18, c.width * 0.16, c.width * 0.18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(c.width * 0.22, c.height * 0.3, c.width * 0.56, c.height * 0.68);
  g.fillStyle = '#fff';
  g.font = 'bold 18px sans-serif';
  g.textAlign = 'center';
  g.fillText(name, c.width / 2, c.height * 0.6);
  const t = new THREE.CanvasTexture(c);
  t.userData.placeholder = true;
  return t;
}

/** Returns a texture immediately; swaps in the real image when it loads. */
export function tex(path, { aspect } = {}) {
  if (cache.has(path)) return cache.get(path);
  const t = placeholder(path.split('/').pop().replace(/\.\w+$/, ''), aspect);
  cache.set(path, t);
  loader.load(
    `${import.meta.env.BASE_URL}intro/${path.replace(/^\//, '')}`,
    (img) => {
      // the placeholder may already be uploaded at a different size; drop the GL texture first
      t.dispose();
      t.image = img.image;
      t.userData.placeholder = false;
      t.userData.aspect = img.image.width / img.image.height;
      t.needsUpdate = true;
      t.dispatchEvent({ type: 'loaded' });
    },
    undefined,
    () => {},
  );
  return t;
}

/** A plane sized to a card's aspect (height in world units), re-fitting when the art arrives. */
export function cardPlane(texture, material, height = 1) {
  const aspect = texture.userData.aspect ?? (texture.image?.width / texture.image?.height || 0.6);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  const fit = () => {
    const a = texture.userData.aspect ?? aspect;
    mesh.scale.set(height * a, height, 1);
  };
  fit();
  texture.addEventListener('loaded', fit);
  return mesh;
}

export function preload(paths) {
  return Promise.all(paths.map((p) => new Promise((res) => {
    const t = tex(p);
    if (!t.userData.placeholder) return res();
    t.addEventListener('loaded', res);
    setTimeout(res, 4000);
  })));
}
