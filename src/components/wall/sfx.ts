/**
 * The wall's sound effects, synthesized — no audio files. Browsers won't start
 * audio without a gesture, so nothing plays until ENTER (or the sound toggle);
 * the score itself lives in music.ts and shares this AudioContext.
 */
export function createSfx() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = false;

  const ensure = () => {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  };

  const noise = (c: AudioContext, seconds: number) => {
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    return src;
  };

  const env = (g: GainNode, at: number, peak: number, attack: number, release: number) => {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  };

  return {
    get enabled() {
      return enabled;
    },
    /** the shared AudioContext (created on first use, inside a click) — the score plays on it too */
    context: () => ensure(),
    destination: () => ensure().destination,
    setEnabled(on: boolean) {
      enabled = on;
      if (on) ensure();
    },
    /**
     * rising air, then a sub boom `rise` seconds later: call it that long before the moment
     * so the boom lands on it (the ignition, the wall arriving)
     */
    ignite(rise = 1.1, size = 1) {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime;
      const n = noise(c, rise + 1.3);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(180, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + rise * 1.45);
      const g = c.createGain();
      env(g, t, 0.9 * size, rise * 1.09, 1.1);
      n.connect(bp).connect(g).connect(master!);
      n.start(t);
      const sub = c.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(90, t + rise);
      sub.frequency.exponentialRampToValueAtTime(32, t + rise + 1.3);
      const sg = c.createGain();
      env(sg, t + rise, size, 0.02, 1.5);
      sub.connect(sg).connect(master!);
      sub.start(t + rise);
      sub.stop(t + rise + 1.9);
    },
    /** short swish, for things flying past */
    whoosh(pitch = 1) {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime;
      const n = noise(c, 0.7);
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 2;
      bp.frequency.setValueAtTime(600 * pitch, t);
      bp.frequency.exponentialRampToValueAtTime(2600 * pitch, t + 0.35);
      const g = c.createGain();
      env(g, t, 0.35, 0.12, 0.45);
      n.connect(bp).connect(g).connect(master!);
      n.start(t);
    },
    /** the orb arriving / talking */
    blip(up = true) {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(up ? 520 : 880, t);
      o.frequency.exponentialRampToValueAtTime(up ? 1040 : 440, t + 0.12);
      const g = c.createGain();
      env(g, t, 0.18, 0.01, 0.2);
      o.connect(g).connect(master!);
      o.start(t);
      o.stop(t + 0.3);
    },
    /** a soft bell from the score's key (D minor pentatonic), one per thing that appears */
    chime(step = 0, at = 0) {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime + at;
      const scale = [0, 3, 5, 7, 10];
      const semis = scale[step % 5] + 12 * Math.floor(step / 5);
      const f = 587.33 * Math.pow(2, semis / 12); // D5
      for (const [mul, type, peak] of [
        [1, "sine", 0.09],
        [2.01, "sine", 0.025],
        [3.0, "triangle", 0.012],
      ] as [number, OscillatorType, number][]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = f * mul;
        const g = c.createGain();
        env(g, t, peak, 0.004, 1.4 / mul);
        o.connect(g).connect(master!);
        o.start(t);
        o.stop(t + 1.6);
      }
    },
    /** a low rumble under the silent opening, swelling toward the score's entrance */
    rumble(seconds: number) {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime;
      const n = noise(c, seconds + 1);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(70, t);
      lp.frequency.linearRampToValueAtTime(160, t + seconds);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + seconds * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.9);
      n.connect(lp).connect(g).connect(master!);
      n.start(t);
    },
    /** a slow-motion footstep: a soft low thud with a little grit on top */
    step(k = 1) {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      const g = c.createGain();
      env(g, t, 0.32 * k, 0.008, 0.45);
      o.connect(g).connect(master!);
      o.start(t);
      o.stop(t + 0.6);
      const n = noise(c, 0.25);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const ng = c.createGain();
      env(ng, t, 0.06 * k, 0.004, 0.18);
      n.connect(lp).connect(ng).connect(master!);
      n.start(t);
    },
    /** an electric crack for the lightning */
    zap(k = 1) {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime;
      const n = noise(c, 0.3);
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2400;
      const g = c.createGain();
      env(g, t, 0.07 * k, 0.002, 0.16);
      n.connect(hp).connect(g).connect(master!);
      n.start(t);
    },
    tick() {
      if (!enabled) return;
      const c = ensure();
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = 1800;
      const g = c.createGain();
      env(g, t, 0.04, 0.002, 0.03);
      o.connect(g).connect(master!);
      o.start(t);
      o.stop(t + 0.05);
    },
    dispose() {
      void ctx?.close();
    },
  };
}
