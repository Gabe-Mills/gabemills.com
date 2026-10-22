/**
 * The home wall's score (T737): an intro that builds to the ignition hit, then a
 * bed that loops forever. Both are decoded up front so ENTER can start them on
 * the same clock as the film — the hit is written to land on the frame Gabe
 * steps onto the plinth (score.json `hitAt`, 5.581 s at 86 bpm).
 *
 * If the files aren't there, everything here quietly does nothing.
 */
interface ScoreInfo {
  bpm: number;
  hitAt: number;
  loopStartAt: number;
  loopSeconds: number;
}

/** the score sits under everything; it was mastered loud (-14 LUFS), so it plays well below unity */
const VOLUME = 0.32;

export function createMusic(getContext: () => AudioContext, getOut: () => AudioNode) {
  let info: ScoreInfo | null = null;
  let intro: AudioBuffer | null = null;
  let loop: AudioBuffer | null = null;
  let gain: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let bins: Uint8Array<ArrayBuffer> | null = null;
  let level = 0;
  // the AudioContext time at which film time 0 happened, so the scene can follow the beat
  let filmZero = -1;
  let sources: AudioBufferSourceNode[] = [];
  let volume = 0;
  let ready: Promise<void> | null = null;

  const load = () => {
    if (ready) return ready;
    ready = (async () => {
      try {
        const res = await fetch("/wall/score.json");
        if (!res.ok) return;
        info = (await res.json()) as ScoreInfo;
        // decode on an offline context so nothing touches real audio before the visitor's click
        const off = new OfflineAudioContext(2, 1, 48000);
        const get = async (url: string) => off.decodeAudioData(await (await fetch(url)).arrayBuffer());
        [intro, loop] = await Promise.all([get("/wall/score-intro.mp3"), get("/wall/score-loop.mp3")]);
      } catch {
        info = null;
      }
    })();
    return ready;
  };

  const stopAll = () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    sources = [];
  };

  return {
    get hitAt() {
      return info?.hitAt ?? 5.581;
    },
    /** fetch + decode in the background; call as soon as there's an AudioContext */
    preload: load,
    /**
     * Start the score as if `filmTime` seconds of the film have already played
     * (0 on ENTER; more if decoding finished late, or after a skip).
     */
    async start(filmTime: number, on: boolean) {
      const asked = performance.now();
      await load();
      // the film kept running while we waited for the decode
      filmTime += (performance.now() - asked) / 1000;
      if (!info || !intro || !loop) return;
      const ctx = getContext();
      stopAll();
      if (!gain) {
        gain = ctx.createGain();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        bins = new Uint8Array(analyser.frequencyBinCount);
        gain.connect(analyser);
        analyser.connect(getOut());
      }
      volume = on ? VOLUME : 0;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      const now = ctx.currentTime + 0.03;
      const elapsed = filmTime + 0.03;
      filmZero = now - elapsed;
      if (elapsed < intro.duration) {
        const a = ctx.createBufferSource();
        a.buffer = intro;
        a.connect(gain);
        a.start(now, elapsed);
        sources.push(a);
      }
      const b = ctx.createBufferSource();
      b.buffer = loop;
      b.loop = true;
      b.connect(gain);
      if (elapsed < info.loopStartAt) b.start(now + (info.loopStartAt - elapsed));
      else b.start(now, (elapsed - info.loopStartAt) % loop.duration);
      sources.push(b);
    },
    /** 0..1 loudness of what's playing right now, weighted to the low end (drums, brass, the hit) */
    level() {
      if (!analyser || !bins) return 0;
      analyser.getByteFrequencyData(bins);
      let sum = 0;
      const n = 40; // ~0-3.7 kHz at 48 kHz / 512
      for (let i = 1; i < n; i++) sum += bins[i] * (i < 8 ? 1.6 : 1);
      const raw = Math.min(1, sum / (n * 255 * 0.9));
      level += (raw - level) * (raw > level ? 0.5 : 0.12);
      return level;
    },
    /** beats since film time 0 at the score's tempo (fractional), or -1 before it plays */
    beat() {
      if (!info || filmZero < 0) return -1;
      return ((getContext().currentTime - filmZero) * info.bpm) / 60;
    },
    get bpm() {
      return info?.bpm ?? 86;
    },
    setOn(on: boolean) {
      volume = on ? VOLUME : 0;
      if (!gain) return;
      const ctx = getContext();
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.35);
    },
    /** duck under a focused screen, then come back */
    duck(amount: number) {
      if (!gain) return;
      const ctx = getContext();
      gain.gain.setTargetAtTime(volume * (1 - amount), ctx.currentTime, 0.4);
    },
    dispose() {
      stopAll();
    },
  };
}
