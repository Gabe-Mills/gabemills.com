// A small stable-fluids ink sim (after Pavel Dobryakov's WebGL-Fluid-Simulation),
// run on half-float render targets through the engine's own WebGLRenderer.
//
//   const fluid = new InkFluid(renderer, { simW: 128, simH: 80, dyeW: 256, dyeH: 160 });
//   fluid.splat(u, v, dx, dy, amount, radius)   // u,v in 0..1, dx,dy in uv units (force)
//   fluid.step(dt)                              // advance; restores target/viewport/autoClear
//   fluid.dye.texture / fluid.velocity.texture  // sample in your own materials (R = density)
//   fluid.reset(); fluid.dispose();
//
// Splats are queued (no per-frame allocation) and applied at the start of step().
import * as THREE from 'three';

const VERT = /* glsl */ `
  uniform vec2 uTexel;
  varying vec2 vUv, vL, vR, vT, vB;
  void main() {
    vUv = uv;
    vL = uv - vec2(uTexel.x, 0.0); vR = uv + vec2(uTexel.x, 0.0);
    vT = uv + vec2(0.0, uTexel.y); vB = uv - vec2(0.0, uTexel.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;

const FRAG = {
  splat: /* glsl */ `
    uniform sampler2D uTarget; uniform float uAspect; uniform vec3 uColor; uniform vec2 uPoint; uniform float uRadius;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - uPoint; p.x *= uAspect;
      vec3 s = exp(-dot(p, p) / uRadius) * uColor;
      gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0);
    }`,
  advect: /* glsl */ `
    uniform sampler2D uVelocity, uSource; uniform vec2 uVelTexel; uniform float uDt, uDissipation, uClampMax;
    varying vec2 vUv;
    void main() {
      vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uVelTexel;
      vec4 r = texture2D(uSource, coord) / (1.0 + uDissipation * uDt);
      gl_FragColor = vec4(clamp(r.xyz, vec3(-uClampMax), vec3(uClampMax)), 1.0);
    }`,
  curl: /* glsl */ `
    uniform sampler2D uVelocity; varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
      gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
    }`,
  vorticity: /* glsl */ `
    uniform sampler2D uVelocity, uCurl; uniform float uCurlAmt, uDt; varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      f /= length(f) + 0.0001; f *= uCurlAmt * C; f.y *= -1.0;
      vec2 v = texture2D(uVelocity, vUv).xy + f * uDt;
      gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
    }`,
  divergence: /* glsl */ `
    uniform sampler2D uVelocity; varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
      if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
    }`,
  scale: /* glsl */ `
    uniform sampler2D uSource; uniform float uValue; varying vec2 vUv;
    void main() { gl_FragColor = uValue * texture2D(uSource, vUv); }`,
  pressure: /* glsl */ `
    uniform sampler2D uPressure, uDivergence; varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      float d = texture2D(uDivergence, vUv).x;
      gl_FragColor = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
    }`,
  gradient: /* glsl */ `
    uniform sampler2D uPressure, uVelocity; varying vec2 vUv, vL, vR, vT, vB;
    void main() {
      float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
      vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
      gl_FragColor = vec4(v, 0.0, 1.0);
    }`,
};

function makeTarget(w, h, linear) {
  const f = linear ? THREE.LinearFilter : THREE.NearestFilter;
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: f,
    magFilter: f,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

class DoubleFBO {
  constructor(w, h, linear) { this.read = makeTarget(w, h, linear); this.write = makeTarget(w, h, linear); }
  swap() { const t = this.read; this.read = this.write; this.write = t; }
  get texture() { return this.read.texture; }
  dispose() { this.read.dispose(); this.write.dispose(); }
}

const MAX_SPLATS = 24;

export class InkFluid {
  constructor(renderer, { simW = 128, simH = 80, dyeW = 256, dyeH = 160, curl = 22, velocityDissipation = 0.35, dyeDissipation = 0.18, pressureIters = 18 } = {}) {
    this.renderer = renderer;
    this.simW = simW; this.simH = simH; this.dyeW = dyeW; this.dyeH = dyeH;
    this.curlAmt = curl;
    this.velocityDissipation = velocityDissipation;
    this.dyeDissipation = dyeDissipation;
    this.pressureIters = pressureIters;
    this.aspect = simW / simH;

    this.velocity = new DoubleFBO(simW, simH, true);
    this.dye = new DoubleFBO(dyeW, dyeH, true);
    this.pressure = new DoubleFBO(simW, simH, false);
    this.divergenceT = makeTarget(simW, simH, false);
    this.curlT = makeTarget(simW, simH, false);

    this.simTexel = new THREE.Vector2(1 / simW, 1 / simH);
    this.dyeTexel = new THREE.Vector2(1 / dyeW, 1 / dyeH);

    const mk = (frag, uniforms) => new THREE.ShaderMaterial({
      uniforms: { uTexel: { value: this.simTexel }, ...uniforms },
      vertexShader: VERT,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
    });
    this.m = {
      splat: mk(FRAG.splat, { uTarget: { value: null }, uAspect: { value: this.aspect }, uColor: { value: new THREE.Vector3() }, uPoint: { value: new THREE.Vector2() }, uRadius: { value: 0.002 } }),
      advect: mk(FRAG.advect, { uVelocity: { value: null }, uSource: { value: null }, uVelTexel: { value: this.simTexel }, uDt: { value: 0 }, uDissipation: { value: 0 }, uClampMax: { value: 1000 } }),
      curl: mk(FRAG.curl, { uVelocity: { value: null } }),
      vorticity: mk(FRAG.vorticity, { uVelocity: { value: null }, uCurl: { value: null }, uCurlAmt: { value: curl }, uDt: { value: 0 } }),
      divergence: mk(FRAG.divergence, { uVelocity: { value: null } }),
      scale: mk(FRAG.scale, { uSource: { value: null }, uValue: { value: 0.8 } }),
      pressure: mk(FRAG.pressure, { uPressure: { value: null }, uDivergence: { value: null } }),
      gradient: mk(FRAG.gradient, { uPressure: { value: null }, uVelocity: { value: null } }),
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.m.splat);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // splat queue (flat array, reused): u, v, dx, dy, amount, radius
    this.queue = new Float32Array(MAX_SPLATS * 6);
    this.queued = 0;
    this.needsReset = true;
  }

  /** u,v in 0..1 (sim space), dx,dy force in uv/s-ish units, amount = ink added, radius in uv^2-ish units. */
  splat(u, v, dx, dy, amount = 1, radius = 0.0025) {
    if (this.queued >= MAX_SPLATS) return;
    const o = this.queued * 6;
    const q = this.queue;
    q[o] = u; q[o + 1] = v; q[o + 2] = dx; q[o + 3] = dy; q[o + 4] = amount; q[o + 5] = radius;
    this.queued++;
  }

  reset() { this.needsReset = true; this.queued = 0; }

  _pass(material, target, texel = this.simTexel) {
    material.uniforms.uTexel.value = texel;
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  _clear(fbo) {
    const r = this.renderer;
    r.setRenderTarget(fbo.read); r.clear(true, false, false);
    r.setRenderTarget(fbo.write); r.clear(true, false, false);
  }

  step(dt) {
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAutoClear = r.autoClear;
    r.getClearColor(this._prevClear || (this._prevClear = new THREE.Color()));
    const prevAlpha = r.getClearAlpha();
    r.autoClear = false;

    if (this.needsReset) {
      r.setClearColor(0x000000, 0);
      this._clear(this.velocity); this._clear(this.dye); this._clear(this.pressure);
      this.needsReset = false;
    }

    const m = this.m;
    // splats
    for (let i = 0; i < this.queued; i++) {
      const o = i * 6, q = this.queue;
      m.splat.uniforms.uPoint.value.set(q[o], q[o + 1]);
      m.splat.uniforms.uRadius.value = q[o + 5];
      m.splat.uniforms.uTarget.value = this.velocity.texture;
      m.splat.uniforms.uColor.value.set(q[o + 2], q[o + 3], 0);
      this._pass(m.splat, this.velocity.write); this.velocity.swap();
      if (q[o + 4] !== 0) {
        m.splat.uniforms.uTarget.value = this.dye.texture;
        m.splat.uniforms.uColor.value.set(q[o + 4], 0, 0);
        this._pass(m.splat, this.dye.write, this.dyeTexel); this.dye.swap();
      }
    }
    this.queued = 0;

    if (dt > 0) {
      m.curl.uniforms.uVelocity.value = this.velocity.texture;
      this._pass(m.curl, this.curlT);

      m.vorticity.uniforms.uVelocity.value = this.velocity.texture;
      m.vorticity.uniforms.uCurl.value = this.curlT.texture;
      m.vorticity.uniforms.uCurlAmt.value = this.curlAmt;
      m.vorticity.uniforms.uDt.value = dt;
      this._pass(m.vorticity, this.velocity.write); this.velocity.swap();

      m.divergence.uniforms.uVelocity.value = this.velocity.texture;
      this._pass(m.divergence, this.divergenceT);

      m.scale.uniforms.uSource.value = this.pressure.texture;
      m.scale.uniforms.uValue.value = 0.8;
      this._pass(m.scale, this.pressure.write); this.pressure.swap();

      m.pressure.uniforms.uDivergence.value = this.divergenceT.texture;
      for (let i = 0; i < this.pressureIters; i++) {
        m.pressure.uniforms.uPressure.value = this.pressure.texture;
        this._pass(m.pressure, this.pressure.write); this.pressure.swap();
      }

      m.gradient.uniforms.uPressure.value = this.pressure.texture;
      m.gradient.uniforms.uVelocity.value = this.velocity.texture;
      this._pass(m.gradient, this.velocity.write); this.velocity.swap();

      m.advect.uniforms.uDt.value = dt;
      m.advect.uniforms.uVelocity.value = this.velocity.texture;
      m.advect.uniforms.uSource.value = this.velocity.texture;
      m.advect.uniforms.uDissipation.value = this.velocityDissipation;
      m.advect.uniforms.uClampMax.value = 1000;
      this._pass(m.advect, this.velocity.write); this.velocity.swap();

      m.advect.uniforms.uSource.value = this.dye.texture;
      m.advect.uniforms.uDissipation.value = this.dyeDissipation;
      m.advect.uniforms.uClampMax.value = 4;
      this._pass(m.advect, this.dye.write, this.dyeTexel); this.dye.swap();
    }

    // restore what the engine expects (it renders the scene right after update())
    r.setClearColor(this._prevClear, prevAlpha);
    r.setRenderTarget(prevTarget);
    r.autoClear = prevAutoClear;
  }

  dispose() {
    this.velocity.dispose(); this.dye.dispose(); this.pressure.dispose();
    this.divergenceT.dispose(); this.curlT.dispose();
    for (const k in this.m) this.m[k].dispose();
    this.quad.geometry.dispose();
  }
}
