// Beat "motion" — "And creative tech that moves." (ported from VESPRO's levitation beat)
// An ink-and-paper storm of diagonal speed lines, a vertical GLOW beam, and Gabe rising
// through it with his ember jacket soaking to glow from the hem up. Three comic panels of
// his real projects (engraved from the site's screenshots) orbit him and drift past in
// parallax. At the peak the beam swells to fill the frame under a paper flash: that is
// what the ink wipe covers.
//
// progress(p) is a pure function of p (scroll back = rewind). update() only adds ambient
// motion on top: storm/streak flow, a small bob, camera drift.
//   p 0.00-0.15  establish: storm, narrow beam, Gabe low in frame
//   p 0.00-0.60  he rises; jacket soaks ember -> glow; panels orbit and drift down past him
//   p 0.80-1.00  he peaks, panels fly out past the camera, flash ramps to 0.5, beam fills

const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ return noise(p) * 0.6 + noise(p * 2.1 + 7.3) * 0.3 + noise(p * 4.3 + 1.7) * 0.1; }`;
const UV_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const FIG_H = 4.4;                       // figure card height (world units)
const FIG_LOW = -3.3, FIG_RISEN = -0.05, FIG_PEAK = 0.3;
const STREAKS = 64;
const FLASH_MAX = 0.5;
const HALF_TAN = Math.tan((35 * Math.PI) / 360);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// the three projects: [texture, base orbit angle, height offset, vertical drift, depth radius, phone height]
const PROJECTS = [
  ['art/shot-afterglow.jpg', 0.35, 0.7, 2.6, 1.6, 2.1],
  ['art/shot-gcoolers.jpg', 2.45, 0.2, 3.4, 1.9, 0.1],
  ['art/shot-leland.jpg', 4.4, 0.9, 2.0, 1.3, -1.9],
];

export function create(ctx) {
  const { THREE, tex, cardPlane, cardMaterial, makePanel, GBUF_GLSL, engine } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, engine.aspect || 1.6, 0.1, 120);
  const look = new THREE.Vector3();
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  // ---- the storm: paper vortex torn by diagonal ink strokes and radial speed rays
  const stormU = { uTime: { value: 0 }, uPower: { value: 0 } };
  const storm = new THREE.Mesh(keep(new THREE.PlaneGeometry(56, 40)), keep(new THREE.ShaderMaterial({
    uniforms: stormU,
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `${GBUF_GLSL}${NOISE}
      uniform float uTime, uPower; varying vec2 vUv;
      void main(){
        vec2 c = (vUv - 0.5) * vec2(56.0, 40.0) - vec2(0.0, 0.1);
        vec2 d = normalize(vec2(1.0, 0.38)), nd = vec2(-d.y, d.x);
        float along = dot(c, d), across = dot(c, nd);
        float t = uTime;
        float s1 = fbm(vec2(along * 0.16 - t * 0.8, across * 1.6));
        float s2 = noise(vec2(along * 0.45 - t * 1.9, across * 6.5));
        float r = length(c / vec2(5.6 + uPower * 1.2, 3.8 + uPower * 0.9));
        float inside = step(r, 1.0 + (s1 - 0.5) * 1.4 + (s2 - 0.5) * 0.4);
        float shade = inside > 0.5 ? 0.93 : 0.0;
        float hatch = inside > 0.5 ? 1.0 : 0.0;
        if (inside < 0.5 && s2 > 0.76) { shade = 1.0; hatch = 0.0; }   // paper strokes torn into the ink
        if (inside > 0.5 && s2 < 0.2) shade = 0.35;                     // ink strokes across the paper
        float ang = atan(c.y, c.x);
        float ray = noise(vec2(ang * 30.0, length(c) * 0.3 - t * 2.2));
        if (inside < 0.5 && ray > 0.84 && length(c) > 3.0) { shade = 1.0; hatch = 0.0; }  // radial speed rays
        gl_FragColor = gbuf(shade, PAL_NEUTRAL, atan(d.y, d.x), hatch);
      }`,
  })));
  storm.position.z = -5;
  scene.add(storm);

  // ---- the GLOW beam: back half of a tall cylinder (the figure stays in front of it)
  const beamU = { uTime: { value: 0 }, uPower: { value: 0 } };
  const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.95, 0.95, 22, 48, 1, true, Math.PI / 2, Math.PI)), keep(new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: beamU,
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */ `${GBUF_GLSL}${NOISE}
      uniform float uTime, uPower; varying vec2 vUv;
      void main(){
        float centre = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float flow = vUv.y * 9.0 + uTime * 1.6;
        float n = noise(vec2(vUv.x * 26.0, flow));
        float shade = 0.84 - smoothstep(0.6, 0.82, n) * 0.4;               // streaks flowing down
        // white-hot paper core with a flickering, flowing edge
        float core = centre + (noise(vec2(vUv.x * 4.0, flow * 0.35)) - 0.5) * 0.35;
        if (core > 0.62 + 0.2 * (1.0 - uPower)) { gl_FragColor = gbuf(0.97 - smoothstep(0.7, 0.85, n) * 0.3, PAL_NEUTRAL, 1.5707963, 0.9); return; }
        gl_FragColor = gbuf(shade, PAL_ACCENT, 1.5707963, 0.85);
      }`,
  })));
  beam.position.set(0, 0, -0.9);
  scene.add(beam);

  // ---- streaks: paper and ink speed lines streaming down past him (instanced, deterministic seeds)
  let rs = 7;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) - 1) / 2147483646;
  const sGeo = keep(new THREE.InstancedBufferGeometry().copy(keep(new THREE.PlaneGeometry(1, 1))));
  sGeo.instanceCount = STREAKS;
  const seed = new Float32Array(STREAKS * 4), sPhase = new Float32Array(STREAKS * 2);
  for (let i = 0; i < STREAKS; i++) {
    const inBeam = i % 3 !== 0;
    seed[i * 4] = inBeam ? (rnd() - 0.5) * 2.4 : (rnd() < 0.5 ? -1 : 1) * (1.6 + rnd() * 3.5);
    seed[i * 4 + 1] = inBeam ? -0.85 + rnd() * 0.95 : -0.7 + rnd() * 2.2;   // beam streaks stay behind him
    seed[i * 4 + 2] = 3 + rnd() * 6;
    seed[i * 4 + 3] = 0.4 + rnd() * 1.6;
    sPhase[i * 2] = rnd() * 20;
    sPhase[i * 2 + 1] = inBeam ? 1 : (rnd() < 0.5 ? 0 : 1);
  }
  sGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
  sGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(sPhase, 2));
  const streakU = { uTime: { value: 0 }, uPower: { value: 0 }, uSpread: { value: 1 } };
  const streaks = new THREE.Mesh(sGeo, keep(new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: streakU,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; attribute vec2 aPhase;
      uniform float uTime, uPower, uSpread;
      varying float vType;
      void main(){
        vType = aPhase.y;
        float H = 15.0;
        float y = 7.5 - mod(aPhase.x + uTime * aSeed.z * 0.45, H);
        float w = aPhase.y > 0.5 ? 0.06 : 0.035;
        float x = abs(aSeed.x) > 1.4 ? aSeed.x * uSpread : aSeed.x;
        vec3 p = vec3(x, y, aSeed.y) + position * vec3(w, aSeed.w * (0.6 + uPower), 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `${GBUF_GLSL}
      varying float vType;
      void main(){
        if (vType > 0.5) gl_FragColor = gbuf(1.0, PAL_NEUTRAL, 1.5707963, 0.0);   // paper
        else gl_FragColor = gbuf(0.0, PAL_NEUTRAL, 1.5707963, 0.0);
      }`,
  })));
  streaks.frustumCulled = false;
  scene.add(streaks);

  // ---- Gabe: red jacket -> ember, soaking to glow from the hem up (uAccentMix)
  const figTex = tex('art/gabe_float.png', { aspect: 1 / 1.6 });
  const figMat = keep(cardMaterial(figTex, { hatch: 0.35, angle: Math.PI / 2 }));
  const fig = cardPlane(figTex, figMat, FIG_H);
  disposables.push(fig.geometry);
  scene.add(fig);

  // ---- three comic panels of his real projects
  const panels = PROJECTS.map(([path, a0, y0, drift, depth, yP]) => {
    const g = makePanel(tex(path, { aspect: 1500 / 1050 }), { w: 1.75, h: 1.225, border: 0.06, hatch: 0.9 });
    g.traverse((o) => { if (o.isMesh) disposables.push(o.geometry, o.material); });
    disposables.push(g.userData.art.material.uniforms.uMap.value);
    scene.add(g);
    return { g, a0, y0, drift, depth, yP };
  });

  // ---- pose: everything that depends on p (pure), plus the layout from the viewport aspect
  const pose = { figY: FIG_LOW, camZ: 9, lookY: 0, flow: 0, power: 0 };
  const fl = engine.ink.uniforms.uFlash;

  function progress(p) {
    const aspect = camera.aspect || 1.6;
    const portrait = aspect < 0.9;
    // pull back on narrow screens so the arms and a slice of each panel stay in frame
    const baseZ = Math.max(9, 1.75 / (HALF_TAN * aspect));
    const halfW = HALF_TAN * baseZ * aspect;          // visible half width at the figure plane

    // rise 0 -> 0.6, keep climbing slowly, peak 0.8 -> 1
    const rise = smooth(0.0, 0.6, p);
    const peak = smooth(0.78, 1.0, p);
    pose.figY = lerp(FIG_LOW, FIG_RISEN, rise) + (FIG_PEAK - FIG_RISEN) * smooth(0.6, 0.95, p);
    pose.power = 0.25 + 0.6 * smooth(0.05, 0.6, p) + 0.15 * peak;
    pose.flow = p * 7.0;                                // scroll drives the storm flow too
    pose.camZ = baseZ * (1 - 0.12 * peak);
    pose.lookY = pose.figY * 0.35;

    fig.scale.y = FIG_H * (1 + 0.06 * peak);
    fig.scale.x = fig.scale.y * (figTex.userData.aspect ?? 1 / 1.6);
    // the jacket spans card uv.y ~0.47 (hem) .. 0.80 (hood): soak hem -> hood across the rise
    figMat.uniforms.uAccentMix.value = lerp(0.42, 0.84, smooth(0.12, 0.8, p));

    stormU.uPower.value = beamU.uPower.value = streakU.uPower.value = pose.power;
    streakU.uSpread.value = portrait ? 0.45 : 1;

    // beam: narrow column, swelling to cover the frame at the peak
    const camDist = pose.camZ + 1.9;
    const fillX = (HALF_TAN * camDist * aspect * 1.25) / 0.95;
    const baseX = 0.75 + 0.35 * pose.power;
    beam.scale.x = lerp(baseX, Math.max(baseX, fillX), Math.pow(smooth(0.82, 1.0, p), 1.6));

    // panels: orbit him (real depth, so they pass behind him) and drift down past the rise.
    // Phones: no room to orbit, so they ride the two edges (alternating sides) with parallax.
    const out = smooth(0.8, 1.0, p);                    // the peak throws them out past the camera
    const orbitX = Math.min(3.0, halfW * 0.78);
    for (let i = 0; i < panels.length; i++) {
      const P = panels[i];
      const th = P.a0 + p * Math.PI * 1.15;
      if (portrait) {
        const side = i === 1 ? -1 : 1;
        P.g.position.set(
          side * halfW * (0.6 + out * 1.4) + Math.sin(th) * 0.15,
          pose.lookY + P.yP + (0.5 - p) * P.drift * 1.7,
          Math.cos(th) * P.depth * 0.5 + 0.3 + out * 6,
        );
        P.g.rotation.set(0.04 * Math.cos(th), -side * 0.3, -side * 0.06 + Math.sin(th * 1.3) * 0.05);
        P.g.scale.setScalar(0.66);
      } else {
        const r = orbitX * (1 + out * 1.6);
        P.g.position.set(
          Math.sin(th) * r,
          // tilted ring: the front pass runs low (past his legs), the back pass high (behind his head)
          pose.lookY + P.y0 - Math.cos(th) * 1.5 + (0.5 - p) * P.drift,
          Math.cos(th) * P.depth + 0.3 + out * 5.5,
        );
        P.g.rotation.set(0.04 * Math.cos(th), -Math.sin(th) * 0.38, (i - 1) * 0.07 + Math.sin(th * 1.3) * 0.05);
        P.g.scale.setScalar(1);
      }
    }

    // paper flash ramps in for the peak (max 0.5); the wipe takes it from there
    // (the ink pass mixes in linear light, so even 0.1 reads as a strong wash: keep it late)
    fl.value = ctx.reduced ? 0 : FLASH_MAX * Math.pow(smooth(0.85, 1.0, p), 2.2);
  }

  function update(dt, time) {
    const amb = ctx.reduced ? 0 : 1;
    const T = time * 0.55 * amb + pose.flow;
    stormU.uTime.value = T * (0.5 + 2.0 * pose.power) * 0.5;
    beamU.uTime.value = T;
    streakU.uTime.value = T * (0.6 + pose.power);

    const bob = Math.sin(time * 1.7) * 0.06 * amb;
    fig.position.set(nx * 0.08 * amb, pose.figY + bob, 0.3);
    fig.rotation.z = Math.sin(time * 0.9) * 0.025 * amb;
    camera.position.set(
      Math.sin(time * 0.31) * 0.08 * amb + nx * 0.12 * amb,
      pose.lookY + Math.sin(time * 0.23) * 0.05 * amb + ny * 0.08 * amb,
      pose.camZ,
    );
    look.set(0, pose.lookY, 0);
    camera.lookAt(look);
  }

  let nx = 0, ny = 0;
  progress(0);

  return {
    scene, camera,
    enter() { nx = ny = 0; },
    progress,
    update,
    pointer(x, y) { nx = x; ny = y; },
    exit() { fl.value = 0; },
    dispose() {
      fl.value = 0;
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
