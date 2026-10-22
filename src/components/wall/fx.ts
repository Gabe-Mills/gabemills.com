import * as THREE from "three";

/**
 * The home wall's effects, kept out of WallHero so the scene file stays about
 * choreography. Every effect is driven by a 0..1 uniform the director animates;
 * nothing here owns time except its own idle motion.
 */

const fullVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

/* ---------------------------------------------------------------- dome ---- */
/** A faint lat/long grid on the inside of the sphere that lights up from the floor on ignition. */
export function createDome(center: THREE.Vector3, radius: number) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOn: { value: 0 },
      uTime: { value: 0 },
      uCenter: { value: center },
      uR: { value: radius },
    },
    vertexShader: fullVert,
    fragmentShader: /* glsl */ `
      uniform float uOn, uTime, uR;
      uniform vec3 uCenter;
      varying vec3 vWorld;
      float line(float x, float w) { float f = abs(fract(x) - 0.5); return 1.0 - smoothstep(0.5 - w, 0.5, f); }
      void main() {
        vec3 d = normalize(vWorld - uCenter);
        float az = atan(d.x, -d.z) / 6.28318 + 0.5;
        float el = asin(d.y) / 3.14159 + 0.5;
        float g = max(line(az * 64.0, 0.018), line(el * 32.0, 0.03));
        // the light climbs the dome from the floor
        float h = (vWorld.y + 0.5) / (uR * 1.6);
        float front = uOn * 1.4;
        float lit = smoothstep(front, front - 0.25, h);
        float edge = exp(-pow((h - front) * 14.0, 2.0)) * step(0.001, uOn) * (1.0 - smoothstep(0.9, 1.0, uOn));
        float a = g * (0.022 * lit + edge * 0.8);
        a *= 1.0 - smoothstep(0.75, 1.0, h);
        vec3 col = mix(vec3(0.35, 0.55, 1.0), vec3(1.0, 0.55, 0.22), edge);
        gl_FragColor = vec4(col * a, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius - 0.05, 96, 48),
    mat,
  );
  mesh.position.copy(center);
  return { mesh, mat };
}

/* ---------------------------------------------------------- glyph rings ---- */
function glyphTexture(seed: number) {
  const cv = document.createElement("canvas");
  cv.width = 2048;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#fff";
  g.font = "600 30px 'JetBrains Mono', monospace";
  g.textBaseline = "middle";
  const words = [
    "GABE.MILLS",
    "BUILD",
    "SHIP",
    "0x47",
    "RENDER",
    "DEPLOY",
    "Λ",
    "∴",
    "LYNCHBURG",
    "VA",
    "CUDA",
    "SWIFT",
    "TS",
    "PY",
    "GPU",
    "▲",
    "◆",
    "◇",
    "//",
    "<>",
    "{}",
    "01101",
  ];
  let x = 10;
  let i = seed;
  while (x < cv.width - 40) {
    const w = words[i++ % words.length];
    g.globalAlpha = 0.45 + ((i * 37) % 55) / 100;
    g.fillText(w, x, 34);
    x += g.measureText(w).width + 28;
  }
  g.globalAlpha = 0.6;
  g.fillRect(0, 2, cv.width, 2);
  g.fillRect(0, 60, cv.width, 2);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * Three bands of glyphs that wrap around him on ignition: each starts wide and flat on
 * the floor, spinning, and tightens and tilts up around his body like an armillary.
 * Once there they turn slowly and breathe with the score (`pulse`).
 */
export function createGlyphRings() {
  const group = new THREE.Group();
  const rings: {
    pivot: THREE.Group;
    mesh: THREE.Mesh;
    mat: THREE.ShaderMaterial;
    s: (typeof spec)[number];
    spin: number;
  }[] = [];
  const spec = [
    { r: 0.78, h: 0.07, y: 0.6, tiltX: 0.32, tiltZ: -0.12, speed: 0.5, ride: 0.32 },
    { r: 0.92, h: 0.055, y: 1.15, tiltX: -0.22, tiltZ: 0.3, speed: -0.38, ride: 0.42 },
    { r: 0.7, h: 0.045, y: 1.8, tiltX: 0.12, tiltZ: 0.36, speed: 0.62, ride: 0.3 },
  ];
  spec.forEach((s, i) => {
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMap: { value: glyphTexture(i * 5) },
        uOn: { value: 0 },
        uLevel: { value: 1 },
        uPulse: { value: 0 },
        uTime: { value: 0 },
        uSpeed: { value: s.speed },
        uRepeat: { value: 2 },
      },
      vertexShader: fullVert,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uOn, uLevel, uPulse, uTime, uSpeed, uRepeat;
        varying vec2 vUv;
        void main() {
          vec2 uv = vec2(vUv.x * uRepeat + uTime * uSpeed * 0.04, vUv.y);
          float a = texture2D(uMap, uv).r;
          // the band writes itself in around the circle as it closes
          float wipe = smoothstep(uOn * 1.15 - 0.15, uOn * 1.15, vUv.x);
          // a bright comet runs round each band
          float comet = pow(fract(vUv.x - uTime * uSpeed * 0.35), 14.0);
          a = (a * (0.75 + uPulse * 0.9) + comet * 0.9) * (1.0 - wipe) * uOn * uLevel;
          vec3 c = mix(vec3(1.0, 0.58, 0.26), vec3(1.0, 0.9, 0.7), clamp(a, 0.0, 1.0));
          gl_FragColor = vec4(c * a, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, s.h, 128, 1, true),
      mat,
    );
    const pivot = new THREE.Group();
    pivot.add(mesh);
    pivot.visible = false;
    group.add(pivot);
    rings.push({ pivot, mesh, mat, s, spin: i * 2.1 });
  });
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  return {
    group,
    /** where each band's bright comet is right now (world space), and which way it's travelling */
    comets(out: { p: THREE.Vector3; d: THREE.Vector3 }[]) {
      rings.forEach((r, i) => {
        if (!out[i])
          out[i] = { p: new THREE.Vector3(), d: new THREE.Vector3() };
        if (!r.pivot.visible) return void out[i].p.set(NaN, NaN, NaN);
        const T = (r.mat.uniforms.uTime.value as number) * r.s.speed * 0.35;
        const th = (T - Math.floor(T)) * Math.PI * 2;
        const th2 = th + 0.02 * Math.sign(r.s.speed);
        r.mesh.localToWorld(v0.set(Math.sin(th), 0, Math.cos(th)));
        r.mesh.localToWorld(v1.set(Math.sin(th2), 0, Math.cos(th2)));
        out[i].p.copy(v0);
        out[i].d.subVectors(v1, v0).normalize();
      });
      return out;
    },
    update(t: number, dt: number, on: number, level = 1, pulse = 0) {
      rings.forEach((r, i) => {
        const k = THREE.MathUtils.clamp(on * 1.5 - i * 0.22, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        r.pivot.visible = k > 0.001;
        if (!r.pivot.visible) return;
        r.mat.uniforms.uTime.value = t;
        r.mat.uniforms.uLevel.value = level;
        r.mat.uniforms.uPulse.value = pulse;
        r.mat.uniforms.uOn.value = Math.min(1, k * 1.4);
        // spins hard while it's wrapping, then settles to its slow turn
        r.spin += dt * r.s.speed * (1 + (1 - e) * 14);
        const rad = THREE.MathUtils.lerp(3.4, r.s.r, e) * (1 + pulse * 0.04);
        r.mesh.scale.set(rad, 1, rad);
        r.mesh.rotation.y = r.spin;
        // once wrapped, each band travels: it rides up and down his body, its tilt
        // swings round him like a gyroscope, and its centre circles him a little
        const dir = Math.sign(r.s.speed);
        const orbit = t * 0.55 * dir + i * 2;
        r.pivot.position.set(
          Math.cos(orbit) * 0.09 * e,
          THREE.MathUtils.lerp(0.04, r.s.y + Math.sin(t * 0.42 + i * 2.1) * r.s.ride, e),
          Math.sin(orbit) * 0.09 * e,
        );
        const tilt = Math.hypot(r.s.tiltX, r.s.tiltZ) * (1 + 0.25 * Math.sin(t * 0.33 + i)) * e;
        const swing = Math.atan2(r.s.tiltZ, r.s.tiltX) + t * 0.6 * dir * e;
        r.pivot.rotation.set(Math.cos(swing) * tilt, 0, Math.sin(swing) * tilt);
      });
    },
  };
}

/* -------------------------------------------------------------- ribbons ---- */
/** Two threads of light that coil up around him from the floor on ignition, then burn away. */
export function createRibbons() {
  const group = new THREE.Group();
  const mats: THREE.ShaderMaterial[] = [];
  for (let i = 0; i < 2; i++) {
    const pts: THREE.Vector3[] = [];
    const turns = 3.2;
    for (let j = 0; j <= 160; j++) {
      const u = j / 160;
      const a = u * turns * Math.PI * 2 + i * Math.PI;
      const rad = THREE.MathUtils.lerp(1.15, 0.42, u);
      pts.push(
        new THREE.Vector3(Math.cos(a) * rad, 0.05 + u * 2.5, Math.sin(a) * rad),
      );
    }
    const geo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts),
      320,
      0.012,
      6,
      false,
    );
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uHead: { value: -1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uHead; varying vec2 vUv;
        void main() {
          float d = uHead - vUv.x;           // how far behind the head this point is
          if (d < 0.0) discard;
          float tail = exp(-d * 5.0);
          float tip = exp(-d * 60.0) * 3.0;
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.4) * (tail + tip) * 1.6, 1.0);
        }`,
    });
    mats.push(mat);
    group.add(new THREE.Mesh(geo, mat));
  }
  group.visible = false;
  return {
    group,
    /** age: seconds since they were launched (-1 = idle) */
    update(age: number) {
      group.visible = age >= 0 && age < 3.2;
      if (!group.visible) return;
      // clamped: a negative base would make pow() NaN, and bloom smears one NaN over the whole frame
      mats.forEach(
        (m, i) =>
          (m.uniforms.uHead.value =
            Math.pow(THREE.MathUtils.clamp((age - i * 0.08) / 1.5, 0, 1), 0.7) *
              1.4 -
            0.05),
      );
    },
  };
}

/* ---------------------------------------------------------------- sigil ---- */
/** one hand-drawn-looking symbol, from a seed: a stem with branches, hooks, eyes and bars */
function drawRune(g: CanvasRenderingContext2D, rnd: () => number, h: number) {
  const k = Math.floor(rnd() * 6);
  g.beginPath();
  if (k === 0) {
    // stem with branches
    g.moveTo(0, -h);
    g.lineTo(0, h);
    for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) {
      const y = -h * 0.8 + rnd() * h * 1.6;
      const sd = rnd() > 0.5 ? 1 : -1;
      g.moveTo(0, y);
      g.lineTo(sd * h * (0.4 + rnd() * 0.4), y + (rnd() - 0.5) * h);
    }
  } else if (k === 1) {
    // an eye: circle with a dot and a bar
    g.arc(0, 0, h * 0.55, 0, Math.PI * 2);
    g.moveTo(-h * 0.9, h * 0.9);
    g.lineTo(h * 0.9, h * 0.9);
    g.moveTo(h * 0.12, 0);
    g.arc(0, 0, h * 0.12, 0, Math.PI * 2);
  } else if (k === 2) {
    // a crescent over a stem
    g.arc(0, -h * 0.35, h * 0.5, Math.PI * 0.1, Math.PI * 0.9);
    g.moveTo(0, -h * 0.2);
    g.lineTo(0, h);
    g.moveTo(-h * 0.35, h * 0.45);
    g.lineTo(h * 0.35, h * 0.45);
  } else if (k === 3) {
    // a triangle with a line through it
    g.moveTo(0, -h);
    g.lineTo(h * 0.8, h * 0.6);
    g.lineTo(-h * 0.8, h * 0.6);
    g.closePath();
    g.moveTo(0, -h * 0.2);
    g.lineTo(0, h);
  } else if (k === 4) {
    // a zig-zag bolt between bars
    g.moveTo(-h * 0.5, -h);
    g.lineTo(h * 0.5, -h);
    g.moveTo(h * 0.3, -h * 0.7);
    g.lineTo(-h * 0.3, 0);
    g.lineTo(h * 0.3, 0);
    g.lineTo(-h * 0.3, h * 0.7);
    g.moveTo(-h * 0.5, h);
    g.lineTo(h * 0.5, h);
  } else {
    // a diamond with hooks
    g.moveTo(0, -h);
    g.lineTo(h * 0.6, 0);
    g.lineTo(0, h);
    g.lineTo(-h * 0.6, 0);
    g.closePath();
    g.moveTo(h * 0.6, 0);
    g.lineTo(h, -h * 0.4);
    g.moveTo(-h * 0.6, 0);
    g.lineTo(-h, h * 0.4);
  }
  g.stroke();
}

function sigilTexture() {
  const S = 2048;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.translate(S / 2, S / 2);
  g.strokeStyle = "#fff";
  g.fillStyle = "#fff";
  g.lineCap = "round";
  g.lineJoin = "round";
  const circle = (r: number, w: number, a = 1, dash: number[] = []) => {
    g.globalAlpha = a;
    g.lineWidth = w;
    g.setLineDash(dash);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  };
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  /** a band of symbols around the circle */
  const band = (r: number, n: number, h: number, w: number, a: number) => {
    g.globalAlpha = a;
    g.lineWidth = w;
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate((i / n) * Math.PI * 2);
      g.translate(0, -r);
      drawRune(g, rnd, h);
      g.restore();
    }
  };
  /** a band of code and math symbols, set in type */
  const typeBand = (r: number, text: string, size: number, a: number) => {
    g.globalAlpha = a;
    g.font = `500 ${size}px 'JetBrains Mono', monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      g.save();
      g.rotate((i / chars.length) * Math.PI * 2);
      g.translate(0, -r);
      g.fillText(chars[i], 0, 0);
      g.restore();
    }
  };
  // outer frame
  circle(1010, 5);
  circle(990, 2, 0.5);
  band(948, 54, 26, 4, 0.95);
  circle(902, 3);
  // ticks
  g.globalAlpha = 0.7;
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const l = i % 10 === 0 ? 30 : i % 5 === 0 ? 18 : 9;
    g.lineWidth = i % 10 === 0 ? 3 : 1.5;
    g.beginPath();
    g.moveTo(Math.cos(a) * 902, Math.sin(a) * 902);
    g.lineTo(Math.cos(a) * (902 - l), Math.sin(a) * (902 - l));
    g.stroke();
  }
  typeBand(
    826,
    "{ } < / > ; λ Σ ∞ ∆ ∂ ∫ π √ ≠ ≈ ⊕ ⊗ ∴ ∵ ∇ Ω µ φ ψ 0 1 & | ! ? # $ % @ ".repeat(
      2,
    ),
    30,
    0.8,
  );
  circle(790, 2, 0.8);
  circle(776, 1, 0.4, [6, 10]);
  // twelve seals on a ring, each a symbol in its own circle
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.save();
    g.translate(Math.cos(a) * 700, Math.sin(a) * 700);
    g.rotate(a + Math.PI / 2);
    g.globalAlpha = 0.9;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 48, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(0, 0, 40, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3.5;
    drawRune(g, rnd, 24);
    g.restore();
  }
  circle(630, 3);
  band(590, 40, 20, 3, 0.85);
  circle(552, 2, 0.7);
  // concentric arcs that break and turn, like a lock
  for (let k = 0; k < 4; k++) {
    const r = 500 - k * 40;
    g.globalAlpha = 0.75 - k * 0.1;
    g.lineWidth = 4 - k * 0.6;
    const segs = 3 + k;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2 + k * 0.7;
      g.beginPath();
      g.arc(0, 0, r, a0, a0 + (Math.PI * 2) / segs - 0.25);
      g.stroke();
    }
  }
  typeBand(300, "GABE · MILLS · BUILD · SHIP · DEPLOY · RENDER · ", 26, 0.75);
  circle(270, 2, 0.6, [2, 8]);
  band(230, 24, 14, 2.5, 0.7);
  circle(200, 2.5, 0.8);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 8;
  return t;
}

/** A magic circle on the floor around the pedestal: it draws itself in on ignition and turns slowly. */
export function createSigil(size = 5.6) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: sigilTexture() },
      uOn: { value: 0 },
      uTime: { value: 0 },
      uPulse: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uOn, uTime, uPulse; varying vec2 vUv;
      vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        // the bands turn at their own speeds, alternating direction
        float a = r > 0.88 ? uTime * 0.05 : r > 0.75 ? -uTime * 0.035 : r > 0.53 ? uTime * 0.025 : r > 0.28 ? -uTime * 0.06 : uTime * 0.09;
        float m = texture2D(uMap, rot(p, a) + 0.5).r;
        // drawn in around the circle, outer rings first
        float ang = fract(atan(p.y, p.x) / 6.28318 + 0.25);
        float draw = step(ang, uOn * 1.6 - (1.0 - r) * 0.6);
        float wave = exp(-pow((r - fract(uTime * 0.18)) * 8.0, 2.0)) * 0.6;
        float k = m * draw * (0.35 + uPulse * 0.8 + wave) * min(1.0, uOn * 2.0);
        gl_FragColor = vec4(vec3(1.0, 0.55, 0.22) * k * 1.3, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.018;
  return { mesh, mat };
}

/* --------------------------------------------------------------- vortex ---- */
/** Energy that whooshes up in a helix around him on ignition, then settles to a slow swirl. */
export function createVortex(count: number) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seed.set([Math.random(), Math.random(), Math.random()], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBurst: { value: 0 },
      uOn: { value: 0 },
      uPx: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uBurst, uOn, uPx;
      attribute vec3 aSeed;
      varying float vA; varying float vHot;
      void main() {
        float life = fract(aSeed.x + uTime * (0.08 + aSeed.y * 0.1) + uBurst * 0.9);
        float y = life * (2.2 + uBurst * 3.5);
        float rad = mix(1.25, 0.35, life) * (0.8 + aSeed.z * 0.4) + uBurst * 0.6 * (1.0 - life);
        float ang = aSeed.y * 6.28318 + uTime * (0.6 + uBurst * 7.0) + life * 5.0;
        vec3 p = vec3(cos(ang) * rad, y, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min((1.8 + aSeed.z * 3.0) * uPx * (5.0 / -mv.z) * (1.0 + uBurst * 1.5), 7.0 * uPx);
        vA = sin(life * 3.14159) * uOn * (0.35 + uBurst * 0.9);
        vHot = aSeed.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vHot;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        vec3 c = mix(vec3(1.0, 0.5, 0.18), vec3(1.0, 0.9, 0.7), vHot) * 1.4;
        gl_FragColor = vec4(c * a, 1.0);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

/* ------------------------------------------------------------ shockwave ---- */
export function createShockwave() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uAge: { value: 9 } },
    vertexShader: fullVert,
    fragmentShader: /* glsl */ `
      uniform float uAge; varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float r = 1.0 - exp(-uAge * 2.6);
        float ring = exp(-pow((d - r) * 30.0, 2.0)) * exp(-uAge * 1.4);
        float inner = exp(-pow((d - r * 0.7) * 50.0, 2.0)) * exp(-uAge * 2.2) * 0.5;
        gl_FragColor = vec4(vec3(1.0, 0.6, 0.28) * (ring + inner) * 2.5, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  return {
    mesh,
    fire() {
      mat.uniforms.uAge.value = 0;
    },
    update(dt: number) {
      mat.uniforms.uAge.value += dt;
    },
  };
}

/* ---------------------------------------------------------------- cards ---- */
const CARD_W = 560;
const CARD_H = 150;
const CHIP_W = 300;
const CHIP_H = 64;

/** a fixed-size glass card: index number, name, and a tint rule — every card the same size, so the grid reads */
function cardTexture(text: string, index: number, tint: string, big: boolean) {
  const W = big ? CARD_W : CHIP_W;
  const H = big ? CARD_H : CHIP_H;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const r = big ? 14 : 8;
  const rr = (x: number, y: number, w: number, h: number) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "rgba(28,26,24,0.94)");
  grd.addColorStop(1, "rgba(8,8,8,0.92)");
  rr(2, 2, W - 4, H - 4);
  g.fillStyle = grd;
  g.fill();
  g.strokeStyle = tint;
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  g.stroke();
  g.globalAlpha = 1;
  // a lit edge along the top
  const sh = g.createLinearGradient(0, 0, W, 0);
  sh.addColorStop(0, "rgba(255,255,255,0)");
  sh.addColorStop(0.35, tint);
  sh.addColorStop(0.65, tint);
  sh.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sh;
  g.fillRect(r, 2, W - r * 2, 3);
  g.textBaseline = "middle";
  if (big) {
    g.font = "500 22px 'JetBrains Mono', monospace";
    g.fillStyle = tint;
    g.globalAlpha = 0.9;
    g.fillText(String(index + 1).padStart(2, "0"), 30, H / 2);
    g.fillRect(78, H / 2 - 22, 2, 44);
    g.globalAlpha = 1;
    let fs = 60;
    const font = () => `400 ${fs}px 'Instrument Serif', serif`;
    g.font = font();
    while (g.measureText(text).width > W - 130 && fs > 30) {
      fs -= 2;
      g.font = font();
    }
    g.shadowColor = tint;
    g.shadowBlur = 16;
    g.fillStyle = "#fff6ec";
    g.fillText(text, 104, H / 2 + 3);
  } else {
    let fs = 26;
    const font = () => `400 ${fs}px 'JetBrains Mono', monospace`;
    g.font = font();
    while (g.measureText(text).width > W - 40 && fs > 14) {
      fs -= 1;
      g.font = font();
    }
    g.textAlign = "center";
    g.fillStyle = "#f3ece4";
    g.fillText(text, W / 2, H / 2 + 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function headerTexture(text: string, count: number, tint: string) {
  const cv = document.createElement("canvas");
  cv.width = 900;
  cv.height = 90;
  const g = cv.getContext("2d")!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "500 30px 'JetBrains Mono', monospace";
  const label = `${text.toUpperCase()}  ·  ${count}`;
  const spaced = [...label].join("\u200a");
  g.fillStyle = tint;
  g.shadowColor = tint;
  g.shadowBlur = 14;
  g.fillText(spaced, 450, 45);
  const w = Math.min(420, g.measureText(spaced).width / 2 + 40);
  g.shadowBlur = 0;
  g.globalAlpha = 0.6;
  g.fillRect(450 - w - 120, 44, 100, 2);
  g.fillRect(450 + w + 20, 44, 100, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Card {
  sprite: THREE.Sprite;
  /** grid slot: sideways offset (m), height, distance ahead of him */
  ang: number;
  y: number;
  r: number;
  /** seconds after show() that it launches */
  at: number;
  launched: boolean;
}

/**
 * CRISP projects the topic as a tidy holographic grid floating over the plinth, in
 * front of him: a header, then same-size cards in rows, each fired out of the orb
 * on its own eighth note along a beam of light. They fold back into the orb when
 * you pick something else.
 */
export function createCards(opts: { narrow?: boolean } = {}) {
  const group = new THREE.Group();
  let cards: Card[] = [];
  let state: "in" | "out" | "idle" = "idle";
  let clock = 0;
  let base = 0; // his heading when they were shown
  let lean = 0;
  const from = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const MAXB = 48;
  const beamPos = new Float32Array(MAXB * 6);
  const beamCol = new Float32Array(MAXB * 6);
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute("position", new THREE.BufferAttribute(beamPos, 3));
  beamGeo.setAttribute("color", new THREE.BufferAttribute(beamCol, 3));
  const beams = new THREE.LineSegments(
    beamGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  beams.frustumCulled = false;
  beams.renderOrder = 29;
  (beams.material as THREE.LineBasicMaterial).depthTest = false;
  group.add(beams);
  const tintC = new THREE.Color();

  const clear = () => {
    for (const c of cards) {
      group.remove(c.sprite);
      c.sprite.material.map?.dispose();
      c.sprite.material.dispose();
    }
    cards = [];
  };

  const sprite = (tex: THREE.Texture, w: number, h: number) => {
    // drawn over everything in the scene (rings, sparks, him), so nothing can cover a card
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
      toneMapped: false,
    });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 30;
    s.scale.set(0.0001, 0.0001, 1);
    s.userData.full = new THREE.Vector2(w, h);
    s.visible = false;
    group.add(s);
    return s;
  };

  return {
    group,
    show(
      title: string,
      ring: string[],
      outer: string[] | undefined,
      tint: string,
      origin: THREE.Vector3,
      heading: number,
      first: number,
      step: number,
    ) {
      clear();
      from.copy(origin);
      base = heading;
      tintC.set(tint);
      // two wings either side of him, so the grid can hang low without covering him
      // phone: a block above his head. Wide screen: a block to his left, in the space the
      // headline gives up, clear of him, CRISP and its panel on the right
      const cols = 2;
      const aisle = 0;
      lean = opts.narrow ? 0 : 1.85;
      const cw = 1.05; // card width in metres
      const ch = cw * (CARD_H / CARD_W);
      const R0 = 1.7;
      const gap = 0.08;
      const rows = Math.ceil(ring.length / cols);
      // the grid hangs above his head, its bottom row just over his shoulders
      // the wings' top row; the small outer chips (if any) stack above them, the header above everything
      const top = (opts.narrow ? 2.25 : 1.15) + (rows - 1) * (ch + gap);
      const ocols = 4;
      const sw = opts.narrow ? 0.5 : 0.42;
      const sh = sw * (CHIP_H / CHIP_W);
      const orows = outer?.length ? Math.ceil(outer.length / ocols) : 0;
      const chipsTop = top + ch / 2 + 0.1 + orows * (sh + 0.035);
      const hw = 2.0;
      cards.push({
        sprite: sprite(
          headerTexture(title, ring.length + (outer?.length ?? 0), tint),
          hw,
          hw * (90 / 900),
        ),
        ang: 0,
        y: (orows ? chipsTop : top + ch / 2) + 0.14,
        r: R0,
        at: first,
        launched: false,
      });
      ring.forEach((w, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, ring.length - row * cols);
        const col = i % cols;
        const cx = (col - (inRow - 1) / 2) * (cw + gap);
        const x = cx + Math.sign(cx) * aisle;
        cards.push({
          sprite: sprite(cardTexture(w, i, tint, true), cw, ch),
          ang: x,
          y: top - row * (ch + gap),
          r: R0,
          at: first + i * step,
          launched: false,
        });
      });
      if (outer?.length) {
        const y0 = chipsTop - sh / 2 - 0.02;
        const t0 = first + ring.length * step;
        outer.forEach((w, i) => {
          const row = Math.floor(i / ocols);
          const inRow = Math.min(ocols, outer.length - row * ocols);
          const x = ((i % ocols) - (inRow - 1) / 2) * (sw + 0.035);
          cards.push({
            sprite: sprite(cardTexture(w, i, tint, false), sw, sh),
            ang: x,
            y: y0 - row * (sh + 0.035),
            r: R0 + 0.02,
            at: t0 + i * (step / 4),
            launched: false,
          });
        });
      }
      state = "in";
      clock = 0;
      return cards.slice(1, ring.length + 1).map((c) => c.at);
    },
    hide(origin: THREE.Vector3) {
      from.copy(origin);
      if (cards.length) {
        state = "out";
        clock = 0;
      }
    },
    update(dt: number, t: number, center: THREE.Vector3, pulse: number) {
      clock += dt;
      group.position.copy(center);
      const local = tmp.copy(from).sub(center);
      let nb = 0;
      for (const c of cards) {
        const s = c.sprite;
        // a flat grid square to his line of sight, c.r ahead of him; c.ang holds the sideways offset (m)
        const f = base + Math.PI;
        const x = c.ang - lean;
        const tx = Math.sin(f) * c.r - Math.cos(f) * x,
          tz = Math.cos(f) * c.r + Math.sin(f) * x,
          ty = c.y + Math.sin(t * 0.9 + c.ang * 3) * 0.012;
        let k: number;
        if (state === "in")
          k = THREE.MathUtils.clamp((clock - c.at) / 0.55, 0, 1);
        else if (state === "out")
          k = c.launched
            ? 1 - THREE.MathUtils.clamp((clock - (c.at % 0.3)) / 0.4, 0, 1)
            : 0;
        else k = 1;
        if (state === "in" && k > 0) c.launched = true;
        s.visible = k > 0.001;
        if (!s.visible) continue;
        const e = 1 - Math.pow(1 - k, 4);
        s.position.set(
          local.x + (tx - local.x) * e,
          local.y + (ty - local.y) * e,
          local.z + (tz - local.z) * e,
        );
        // unfolds from a sliver of light: width first, then height
        const full = s.userData.full as THREE.Vector2;
        const wk = Math.min(1, e * 1.6);
        const hk = THREE.MathUtils.clamp((e - 0.35) / 0.65, 0.04, 1);
        s.scale.set(full.x * Math.max(0.0001, wk), full.y * hk, 1);
        const since = clock - c.at;
        const flash =
          state === "in" && since > 0
            ? Math.exp(-Math.max(0, since - 0.4) * 6)
            : 0;
        s.material.opacity = Math.min(1, e * 1.3);
        s.material.color.setScalar(1 + flash * 1.4 + pulse * 0.15);
        // the beam that carried it out of the orb, fading once it lands
        const bk =
          state === "in"
            ? Math.max(0, 1 - Math.max(0, since - 0.35) * 2.5) *
              Math.min(1, since * 8)
            : 0;
        if (bk > 0.01 && nb < MAXB) {
          beamPos.set(
            [
              local.x,
              local.y,
              local.z,
              s.position.x,
              s.position.y,
              s.position.z,
            ],
            nb * 6,
          );
          beamCol.set(
            [
              tintC.r * bk * 2,
              tintC.g * bk * 2,
              tintC.b * bk * 2,
              tintC.r * bk * 0.6,
              tintC.g * bk * 0.6,
              tintC.b * bk * 0.6,
            ],
            nb * 6,
          );
          nb++;
        }
      }
      beamGeo.setDrawRange(0, nb * 2);
      beamGeo.attributes.position.needsUpdate = true;
      beamGeo.attributes.color.needsUpdate = true;
      if (state === "out" && clock > 1.0) {
        clear();
        state = "idle";
      }
    },
  };
}

/* --------------------------------------------------------------- sparks ---- */
/** a pool of hot sparks: flung off the rings' comets and his hands, they arc down and die */
export function createSparks(n: number) {
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const life = new Float32Array(n);
  const max = new Float32Array(n);
  const alpha = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aA", new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uPx; attribute float aA; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(2.6 * uPx * (5.0 / -mv.z) * (0.5 + aA), 6.0 * uPx);
        vA = aA;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(mix(vec3(1.0, 0.45, 0.15), vec3(1.0, 0.92, 0.75), vA) * a * 1.8, 1.0);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let next = 0;
  return {
    points,
    mat,
    emit(
      p: THREE.Vector3,
      v: THREE.Vector3,
      spread: number,
      count = 1,
      lifeS = 0.9,
    ) {
      for (let k = 0; k < count; k++) {
        const i = next;
        next = (next + 1) % n;
        pos.set([p.x, p.y, p.z], i * 3);
        vel.set(
          [
            v.x + (Math.random() - 0.5) * spread,
            v.y + (Math.random() - 0.3) * spread,
            v.z + (Math.random() - 0.5) * spread,
          ],
          i * 3,
        );
        max[i] = life[i] = lifeS * (0.5 + Math.random() * 0.8);
      }
    },
    update(dt: number) {
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) {
          alpha[i] = 0;
          continue;
        }
        life[i] -= dt;
        const j = i * 3;
        vel[j + 1] -= 2.4 * dt;
        const drag = Math.exp(-1.6 * dt);
        vel[j] *= drag;
        vel[j + 1] *= drag;
        vel[j + 2] *= drag;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        if (pos[j + 1] < 0.02) {
          pos[j + 1] = 0.02;
          vel[j + 1] *= -0.3;
        }
        alpha[i] = Math.max(0, life[i] / max[i]);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aA.needsUpdate = true;
    },
  };
}

/* ----------------------------------------------------------------- arcs ---- */
/** lightning: jagged bolts between two points that crackle for a moment */
export function createArcs(maxBolts = 6, segs = 14) {
  // each bolt is drawn as two strands with their own jitter, so it reads thick and crackling
  const pos = new Float32Array(maxBolts * segs * 12);
  const col = new Float32Array(maxBolts * segs * 12);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const lines = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  lines.frustumCulled = false;
  const bolts: {
    a: THREE.Vector3;
    b: THREE.Vector3;
    age: number;
    life: number;
    jitter: number;
  }[] = [];
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  return {
    lines,
    strike(a: THREE.Vector3, b: THREE.Vector3, life = 0.22) {
      if (bolts.length >= maxBolts) bolts.shift();
      bolts.push({ a: a.clone(), b: b.clone(), age: 0, life, jitter: 0 });
    },
    update(dt: number) {
      for (let i = bolts.length - 1; i >= 0; i--) {
        bolts[i].age += dt;
        if (bolts[i].age > bolts[i].life) bolts.splice(i, 1);
      }
      let k = 0;
      for (const bo of bolts)
        for (let strand = 0; strand < 2; strand++) {
          const f = (1 - bo.age / bo.life) * (strand ? 0.6 : 1);
          const flick = 0.6 + Math.random() * 0.4;
          const len = bo.a.distanceTo(bo.b);
          p.copy(bo.a);
          for (let s = 1; s <= segs; s++) {
            const u = s / segs;
            q.lerpVectors(bo.a, bo.b, u);
            if (s < segs) {
              const amp = Math.sin(u * Math.PI) * len * 0.12;
              q.x += (Math.random() - 0.5) * amp;
              q.y += (Math.random() - 0.5) * amp;
              q.z += (Math.random() - 0.5) * amp;
            }
            const c = f * flick * 3;
            pos.set([p.x, p.y, p.z, q.x, q.y, q.z], k * 6);
            col.set([c, c * 0.85, c * 0.6, c, c * 0.85, c * 0.6], k * 6);
            k++;
            p.copy(q);
          }
        }
      geo.setDrawRange(0, k * 2);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

/* -------------------------------------------------------------- ripples ---- */
/** a footstep: a ring of light that spreads on the mirror floor where his foot lands */
export function createRipples(count = 8) {
  const items: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uAge: { value: 9 }, uK: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uAge, uK; varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float r = 1.0 - exp(-uAge * 2.2);
          float ring = exp(-pow((d - r) * 18.0, 2.0)) * exp(-uAge * 1.6);
          float core = exp(-d * 10.0) * exp(-uAge * 3.0) * 0.8;
          gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * (ring + core) * uK * 1.6, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    items.push({ mesh, mat });
  }
  let next = 0;
  return {
    group,
    spawn(x: number, y: number, z: number, k = 1) {
      const it = items[next];
      next = (next + 1) % count;
      it.mesh.position.set(x, y + 0.012, z);
      it.mat.uniforms.uAge.value = 0;
      it.mat.uniforms.uK.value = k;
      it.mesh.visible = true;
    },
    update(dt: number) {
      for (const it of items) {
        if (!it.mesh.visible) continue;
        it.mat.uniforms.uAge.value += dt;
        if (it.mat.uniforms.uAge.value > 3) it.mesh.visible = false;
      }
    },
  };
}

/* ------------------------------------------------------------------ ash ---- */
/** embers drifting down through the whole room, on the world's (slow-motion) clock */
export function createAsh(n: number) {
  const pos = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 9;
    pos.set([Math.cos(a) * r, Math.random() * 7, Math.sin(a) * r], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uOn: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPx, uOn; attribute float aSeed; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * (0.06 + aSeed * 0.08), 7.0);
        p.x += sin(uTime * 0.2 + aSeed * 50.0) * 0.4;
        p.z += cos(uTime * 0.17 + aSeed * 40.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min((1.0 + aSeed * 2.2) * uPx * (6.0 / -mv.z), 4.0 * uPx);
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 30.0);
        vA = tw * smoothstep(0.0, 0.8, p.y) * (1.0 - smoothstep(5.5, 7.0, p.y)) * uOn * (0.25 + 0.75 * fract(aSeed * 13.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.6, 0.3) * smoothstep(0.5, 0.0, d) * vA, 1.0); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}
