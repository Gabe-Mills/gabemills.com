// Dev-only lab for Sherwood (sherwood-lab.html). Mirrors the wall scene's render setup:
// ACESFilmic at exposure 1.1, UnrealBloom (strength 0.9, radius 0.6, threshold 1.02), a dark room
// with a warm overhead spot. Not part of the production build (Vite only builds index.html).
// URL params: ?state=<name>  ?q=0|1|2  ?reduce  ?manual (no rAF; drive with window.__lab.advance)
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createSherwood, type SherwoodState } from "./components/wall/sherwood";

const params = new URLSearchParams(location.search);
const stage = document.getElementById("stage")!;
const note = document.getElementById("note")!;
const bar = document.getElementById("bar")!;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(0x050607);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050607, 4, 11);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);
camera.position.set(0.05, 1.5, 1.55);
const LOOK = new THREE.Vector3(-0.05, 1.32, 0);
camera.lookAt(LOOK);

// dark room: floor, back wall, warm overhead spot (like the wall scene), a dim cool hemisphere
const roomMat = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.9 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), roomMat);
floor.rotation.x = -Math.PI / 2;
const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), roomMat);
wall.position.set(0, 3, -2.2);
scene.add(floor, wall);
const spot = new THREE.SpotLight("#ffd7ae", 60, 14, 0.32, 0.6, 1.6);
spot.position.set(0, 4.2, 0.6);
spot.target.position.set(0, 0, 0);
scene.add(spot, spot.target, new THREE.HemisphereLight("#8fa2c8", "#140c08", 0.28));
// a stand-in for 3D Gabe (1.78 m) for scale
const gabe = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.78 - 0.4, 6, 16), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 }));
gabe.position.set(-0.62, 0.89, -0.3);
scene.add(gabe);

const q = params.get("q");
const sw = createSherwood({ reducedMotion: params.has("reduce"), quality: q === "0" ? 0 : q === "2" ? 2 : 1 });
sw.group.position.set(0, 1.32, 0);
{
  const U = sw.group.userData.uniforms as Record<string, { value: number }>;
  for (const [k, n] of [["host", "uHostI"], ["expo", "uExpo"], ["studio", "uStudioI"]]) if (params.has(k)) U[n].value = +params.get(k)!;
}
scene.add(sw.group);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), params.has("bloom") ? +params.get("bloom")! : 0.9, 0.6, 1.02);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// cursor -> world point on a plane through Sherwood that faces the camera
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
let cursor: THREE.Vector3 | null = null;
addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const n = camera.getWorldDirection(new THREE.Vector3()).negate();
  plane.setFromNormalAndCoplanarPoint(n, sw.group.getWorldPosition(new THREE.Vector3()));
  cursor = ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
});
document.documentElement.addEventListener("pointerleave", () => { cursor = null; });

// buttons
const STATES: SherwoodState[] = ["idle", "hello", "talking", "thinking", "happy", "listening"];
let current: SherwoodState = "idle";
const btns: HTMLButtonElement[] = [];
function setState(s: SherwoodState) {
  current = s; sw.setState(s);
  for (const b of btns) b.setAttribute("aria-pressed", String(b.dataset.s === s));
}
const ab = document.createElement("button"); ab.textContent = "appear()"; ab.onclick = () => sw.appear(); bar.appendChild(ab);
for (const s of STATES) {
  const b = document.createElement("button"); b.textContent = s; b.dataset.s = s; b.onclick = () => setState(s);
  bar.appendChild(b); btns.push(b);
}
const initial = params.get("state") as SherwoodState | null;
setState(initial && STATES.includes(initial) ? initial : "idle");

// loop
let simT = 0, last = performance.now(), updMs = 0, frameMs = 0;
function frame(dt: number) {
  simT += dt;
  sw.lookAt(cursor);
  const t0 = performance.now();
  sw.update(dt, simT, camera);
  updMs = updMs * 0.95 + (performance.now() - t0) * 0.05;
  composer.render(dt);
}
const manual = params.has("manual");
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  frameMs = frameMs * 0.95 + dt * 1000 * 0.05;
  frame(dt);
  requestAnimationFrame(loop);
}
if (!manual) requestAnimationFrame(loop); else frame(1 / 60);
setInterval(() => { note.textContent = `Sherwood lab · ${current} · update ${updMs.toFixed(3)} ms CPU · frame ${frameMs.toFixed(1)} ms`; }, 400);

// headless hooks: deterministic stepping and a GPU-synchronised cost probe
const gl = renderer.getContext();
const px = new Uint8Array(4);
function syncGPU() { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
(window as unknown as { __lab: unknown }).__lab = {
  sw, setState, appear: () => sw.appear(),
  look(x: number | null, y = 0) { cursor = x == null ? null : new THREE.Vector3(x, 1.32 + y, 0.1); },
  advance(sec: number, fps = 60) { const n = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < n; i++) frame(1 / fps); },
  /** average ms per frame (CPU + GPU, synchronised) with Sherwood shown vs hidden */
  bench(n = 120) {
    const run = (vis: boolean) => {
      sw.group.visible = vis;
      for (let i = 0; i < 10; i++) frame(1 / 60);
      syncGPU();
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { frame(1 / 60); syncGPU(); }
      return (performance.now() - t0) / n;
    };
    const off1 = run(false), on1 = run(true), off2 = run(false), on2 = run(true);
    sw.group.visible = true;
    const on = (on1 + on2) / 2, off = (off1 + off2) / 2;
    return { onMs: on, offMs: off, deltaMs: on - off, updateCpuMs: updMs, w: renderer.domElement.width, h: renderer.domElement.height };
  },
};
