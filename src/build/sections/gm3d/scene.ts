/**
 * The finale's real-time GM: Gabe's monogram (shape.ts) extruded with a generous bevel, in
 * brushed metallic green, lit like a product shot: RoomEnvironment reflections (PMREM), two
 * mint rim lights from behind, a dim key, a green bounce from below and a soft floor glow.
 * ACES tone mapping, sRGB out, transparent canvas so the section's CSS light pool shows behind.
 *
 * Motion (all eased, nothing spins continuously):
 *   rise   setRise(0..1) from the component (its own scroll position, one-shot): the mark comes
 *          up out of the dark, tilted back, while exposure and the lights come up
 *   idle   a slow turn (oscillating, never a full spin) and a slight float
 *   tilt   leans toward the pointer
 *   sweep  sweep() runs a band of light across the metal (hover, and once when the rise lands)
 *
 * The owner drives the loop: start()/stop() (only while on screen), renderOnce() for reduced
 * motion, dispose() frees every GPU resource and removes the canvas.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, PointLight, RepeatWrapping, Scene, Shape, SRGBColorSpace, Vector2,
  WebGLRenderer, type Texture,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { gmOutlines, GM_BOUNDS } from "./shape";

const PX = 1 / 100; // logo pixels -> scene units
const W = (GM_BOUNDS.x1 - GM_BOUNDS.x0) * PX; // ~4.66
const H = (GM_BOUNDS.y1 - GM_BOUNDS.y0) * PX; // ~2.57
const DEPTH = 0.42;

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

function buildGeometry(): BufferGeometry {
  const cx = (GM_BOUNDS.x0 + GM_BOUNDS.x1) / 2, cy = (GM_BOUNDS.y0 + GM_BOUNDS.y1) / 2;
  const parts = gmOutlines(80).map((pts) => {
    // y-down logo pixels -> y-up units, centred (ExtrudeGeometry normalises the winding)
    const shape = new Shape(pts.map(([x, y]) => new Vector2((x - cx) * PX, -(y - cy) * PX)));
    const g = new ExtrudeGeometry(shape, {
      depth: DEPTH, steps: 1, curveSegments: 1,
      bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.065, bevelOffset: -0.065, bevelSegments: 6,
    });
    g.translate(0, 0, -DEPTH / 2);
    return g;
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  // smooth the bowls and the rounded bevels, keep the hard 90-degree corners crisp
  const out = toCreasedNormals(merged, (35 * Math.PI) / 180);
  merged.dispose();
  return out;
}

/** horizontal hairline streaks: a cheap brushed-metal roughness map */
function brushedTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgb(200,200,200)";
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    const v = 170 + rnd() * 85;
    g.fillStyle = `rgba(${v},${v},${v},${0.2 + rnd() * 0.35})`;
    g.fillRect(rnd() * c.width - 60, rnd() * c.height, 40 + rnd() * 340, rnd() < 0.8 ? 1 : 2);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1.1, 4.5);
  return t;
}

/** a soft radial pool of green for the floor */
function glowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  // reaches zero well inside the plane, so the pool never shows an edge
  r.addColorStop(0, "rgba(168,240,200,0.9)");
  r.addColorStop(0.2, "rgba(61,190,128,0.55)");
  r.addColorStop(0.5, "rgba(43,147,99,0.14)");
  r.addColorStop(0.82, "rgba(43,147,99,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface GMSceneOptions { dpr: number; staticFrame?: boolean }

export class GMScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(28, 1.6, 0.1, 60);
  private group = new Group();
  private floor: Mesh;
  private geo: BufferGeometry | null = null;
  private mat: MeshPhysicalMaterial;
  private floorMat: MeshBasicMaterial;
  private envTex: Texture | null = null;
  private textures: Texture[] = [];
  private rims: DirectionalLight[] = [];
  private key: DirectionalLight;
  private bounce: PointLight;
  private uniforms = { uSweep: { value: -1 }, uSweepColor: { value: new Color("#A8F0C8") } };

  private raf = 0;
  private last = 0;
  private time = 0;
  private riseTarget = 0;
  private rise = 0;
  private landed = false;
  private sweepT = -1; // seconds into the current sweep, -1 = none
  private pointer = { x: 0, y: 0 };
  private tilt = { x: 0, y: 0 };
  private staticFrame: boolean;

  constructor(container: HTMLElement, opts: GMSceneOptions) {
    this.staticFrame = !!opts.staticFrame;
    // throws when WebGL is unavailable: the component catches it and shows the image
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-hidden", "true");
    this.renderer.setPixelRatio(opts.dpr);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMappingExposure = 0;
    container.appendChild(this.canvas);

    this.renderer.setClearColor(0x000000, 0);

    const rough = brushedTexture();
    this.textures.push(rough);
    this.mat = new MeshPhysicalMaterial({
      color: new Color("#2B9363"),
      metalness: 1,
      roughness: 0.4, // x the brushed map (0.6..1) => ~0.24..0.4
      roughnessMap: rough,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.62,
    });
    // the hover light sweep: a soft diagonal band of mint across the mark's own surface
    this.mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGmPos;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGmPos = position;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGmPos;\nuniform float uSweep;\nuniform vec3 uSweepColor;")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            float s = (vGmPos.x / ${W.toFixed(3)} + 0.5) * 0.82 + (vGmPos.y / ${H.toFixed(3)} + 0.5) * 0.36;
            float d = (s - uSweep) / 0.075;
            float band = exp(-d * d);
            float face = 0.45 + 0.55 * pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 1.5);
            totalEmissiveRadiance += uSweepColor * band * (0.55 + 0.9 * face);
          }`,
        );
    };
    this.scene.add(this.group);

    // lights: two mint rims from behind (they catch the bevels), a dim key, a green bounce
    const mint = new Color("#A8F0C8");
    for (const [x, y, z] of [[-3.5, 3, -4], [4, 1.5, -3.5]]) {
      const l = new DirectionalLight(mint, 0);
      l.position.set(x, y, z);
      this.rims.push(l);
      this.scene.add(l);
    }
    this.key = new DirectionalLight(new Color("#E9F5EE"), 0);
    this.key.position.set(-3, 4, 6);
    this.scene.add(this.key);
    this.bounce = new PointLight(new Color("#3DBE80"), 0, 9, 1.6);
    this.bounce.position.set(0, -2.8, 2.4);
    this.scene.add(this.bounce);

    // the floor glow: a horizontal pool of green light under the mark
    const glow = glowTexture();
    this.textures.push(glow);
    this.floorMat = new MeshBasicMaterial({
      map: glow, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.floor = new Mesh(new PlaneGeometry(6, 2.2), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, -H / 2 - 0.4, -0.35);
    this.scene.add(this.floor);

    this.camera.position.set(0, 0.55, 8);
    this.camera.lookAt(0, -0.05, 0);
  }

  /** the heavy setup, in short tasks with a breath between them so the scroll never stalls:
   *  the geometry, the room reflections (PMREM), then the shaders (compiled off the main
   *  thread where the browser can, KHR_parallel_shader_compile) */
  async ready(alive: () => boolean = () => true) {
    const breathe = () => new Promise<void>((r) => setTimeout(r, 16));
    this.geo = buildGeometry();
    this.group.add(new Mesh(this.geo, this.mat));
    await breathe();
    if (!alive()) return;
    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(this.renderer);
    this.envTex = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.renderer.setClearColor(0x000000, 0); // PMREM leaves its own clear colour behind
    await breathe();
    if (!alive()) return;
    try { await this.renderer.compileAsync(this.scene, this.camera); } catch { /* the first render compiles */ }
  }

  /** triangles in the mark (for the report) */
  get triangles(): number { return this.geo ? this.geo.attributes.position.count / 3 : 0; }

  resize(w: number, h: number) {
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // fit the mark (plus room for tilt and float) inside the frame
    const fitW = W * 1.2, fitH = H * 1.55;
    const vt = Math.tan((this.camera.fov * Math.PI) / 360);
    const dist = Math.max(fitH / (2 * vt), fitW / (2 * vt * aspect));
    this.camera.position.set(0, dist * 0.07, dist);
    this.camera.lookAt(0, -0.18, 0);
    this.camera.updateProjectionMatrix();
    if (this.staticFrame || !this.raf) this.renderOnce();
  }

  /** 0..1 from the owner's scroll measure; only ever rises */
  setRise(v: number) { if (v > this.riseTarget) this.riseTarget = Math.min(1, v); }

  /** pointer in -1..1 (x right, y up) */
  setPointer(x: number, y: number) { this.pointer.x = x; this.pointer.y = y; }

  sweep() { if (this.sweepT < 0 || this.sweepT > 0.9) this.sweepT = 0; }

  start() {
    if (this.raf || this.staticFrame) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  /** one finished, settled frame (reduced motion, or a resize while paused) */
  renderOnce() {
    if (this.staticFrame) { this.rise = this.riseTarget = 1; this.time = 0; this.pointer.x = this.pointer.y = 0; }
    this.step(0);
    this.renderer.render(this.scene, this.camera);
  }

  private step(dt: number) {
    this.time += dt;
    // the rise eases toward its scroll target; once it is well under way it finishes on its own
    if (this.riseTarget > 0.55) this.riseTarget = Math.min(1, this.riseTarget + dt * 0.6);
    this.rise += (this.riseTarget - this.rise) * (1 - Math.exp(-dt * 3.2));
    if (this.riseTarget >= 1 && 1 - this.rise < 0.002) this.rise = 1;
    const r = ease(this.rise);
    if (!this.landed && this.rise > 0.97 && !this.staticFrame) { this.landed = true; this.sweep(); }

    // pointer tilt, eased
    const k = 1 - Math.exp(-dt * 3);
    this.tilt.x += (this.pointer.x - this.tilt.x) * k;
    this.tilt.y += (this.pointer.y - this.tilt.y) * k;

    const t = this.time;
    const idle = smooth((this.rise - 0.6) / 0.4); // idle motion fades in as it lands
    this.group.position.y = -1.1 * (1 - r) + Math.sin(t * 0.7) * 0.045 * idle;
    this.group.rotation.x = 0.55 * (1 - r) - this.tilt.y * 0.12 + Math.sin(t * 0.45 + 1) * 0.025 * idle;
    this.group.rotation.y = Math.sin(t * 0.21) * 0.2 * idle + this.tilt.x * 0.26;
    this.group.rotation.z = 0.035 * (1 - r);
    const s = 0.9 + 0.1 * r;
    this.group.scale.setScalar(s);

    // out of the dark: exposure and lights come up with the rise, a beat behind the motion
    const lit = smooth(this.rise);
    this.renderer.toneMappingExposure = 0.04 + 1.06 * lit;
    this.rims[0].intensity = 5 * lit;
    this.rims[1].intensity = 3.6 * lit;
    this.key.intensity = 0.55 * lit;
    this.bounce.intensity = 3.2 * lit;
    this.floorMat.opacity = 0.85 * smooth((this.rise - 0.2) / 0.8);

    // the light sweep (1.15 s across, eased)
    if (this.sweepT >= 0) {
      this.sweepT += dt;
      const p = this.sweepT / 1.15;
      this.uniforms.uSweep.value = -0.25 + 1.5 * smooth(p);
      if (p >= 1) { this.sweepT = -1; this.uniforms.uSweep.value = -1; }
    }
  }

  dispose() {
    this.stop();
    this.geo?.dispose();
    this.mat.dispose();
    this.floor.geometry.dispose();
    this.floorMat.dispose();
    this.textures.forEach((t) => t.dispose());
    this.envTex?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
