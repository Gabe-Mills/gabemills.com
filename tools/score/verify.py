import sys, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy import signal
D = sys.argv[1]
SR = 48000


def lag(a, b, max_lag=4000):
    a = a.mean(1)[: SR * 4]; b = b.mean(1)[: SR * 4]
    c = signal.correlate(b, a, mode="full", method="fft")
    mid = len(a) - 1
    w = c[mid - max_lag: mid + max_lag + 1]
    return int(np.argmax(w) - max_lag)


def tp(z):
    return 20 * np.log10(np.abs(signal.resample_poly(z, 4, 1, axis=0)).max())


meter = pyln.Meter(SR)
src_i, _ = sf.read(f"{D}/score-intro.wav")
for dec in ("ff", "at"):
    x, _ = sf.read(f"{D}/score-intro.{dec}.wav")
    print(f"intro[{dec}] lag_vs_source={lag(src_i, x)} samples, lufs={meter.integrated_loudness(x):.2f}, tp={tp(x):.2f}")
    m = x.mean(1)
    for t in np.arange(5.576, 5.592, 0.001):
        s = m[int(t * SR):int((t + 0.001) * SR)]
        print(f"{t:.3f}:{20*np.log10(np.abs(s).max()+1e-9):.1f}", end=" ")
    print()

src_l, _ = sf.read(f"{D}/score-loop.wav")
for dec in ("ff", "at"):
    y, _ = sf.read(f"{D}/score-loop.{dec}.wav")
    print(f"loop[{dec}] n={len(y)} lag_vs_source={lag(src_l, y)} lufs={meter.integrated_loudness(y):.2f} tp={tp(y):.2f}")
    head, tail = y[: int(0.02 * SR)], y[-int(0.02 * SR):]
    rms = lambda z: 20 * np.log10(np.sqrt((z ** 2).mean()) + 1e-12)
    print(f"  first20ms rms={rms(head):.1f} dB  last20ms rms={rms(tail):.1f} dB  first sample={y[0]}  last sample={y[-1]}")
    # seam: concatenate twice and compare the sample step across the seam with typical steps nearby
    yy = np.concatenate([y, y])
    k = len(y)
    d = np.abs(np.diff(yy, axis=0)).max(1)
    near = d[k - 2400:k + 2400]
    print(f"  seam step={d[k-1]:.5f}  median step +-50ms={np.median(near):.5f}  p99={np.percentile(near,99):.5f}  max={near.max():.5f}")
    # high-pass click detector (>5 kHz energy in 1 ms windows around seam vs elsewhere)
    b, a = signal.butter(4, 5000 / (SR / 2), "high")
    hp = signal.filtfilt(b, a, yy.mean(1))
    win = lambda c: np.sqrt((hp[c - 24:c + 24] ** 2).mean())
    ref = np.array([win(c) for c in range(k - 24000, k + 24000, 48) if abs(c - k) > 96])
    print(f"  HF energy at seam={20*np.log10(win(k)+1e-12):.1f} dB vs median {20*np.log10(np.median(ref)+1e-12):.1f}, p99 {20*np.log10(np.percentile(ref,99)+1e-12):.1f}")
    # level continuity: short-term RMS 200 ms before vs after seam
    print(f"  rms 200ms before seam={rms(y[-9600:]):.1f}  after={rms(y[:9600]):.1f}")
