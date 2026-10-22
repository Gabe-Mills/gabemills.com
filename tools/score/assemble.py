"""Build score-intro.wav and score-loop.wav (48 kHz float) from the Bandroom renders.
Level-matched to the full preview render; loop at -16 LUFS; sum of (intro + loop from hitAt) <= -1 dBTP."""
import json, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy import signal

B = "/Users/gabemills/Developer/Projects/Active/bandroom/out"
OUT = sys.argv[1]
SR = 48000
SPB = 60 / 86
BAR = 4 * SPB
HIT = 2 * BAR  # 5.5814 s nominal
INTRO_LEN = HIT + 9.0
FADE = 4.0
SUB_DB = float(sys.argv[2]) if len(sys.argv) > 2 else -12.0
RISER_DB = float(sys.argv[3]) if len(sys.argv) > 3 else -26.0

meter = pyln.Meter(SR)
full, _ = sf.read(f"{B}/gmh-full/master.wav")
intro, _ = sf.read(f"{B}/gmh-intro/master.wav")
loop, _ = sf.read(f"{B}/gmh-loop/master.wav")
L = lambda x: meter.integrated_loudness(x)
seg = lambda x, a, b: x[int(a * SR):int(b * SR)]

# relative levels taken from the full preview (same content, mastered together)
build_full, build_intro = L(seg(full, 0.2, 5.4)), L(seg(intro, 0.2, 5.4))
bed_full, bed_loop = L(seg(full, 18 * BAR, 34 * BAR)), L(loop)
loop_gain = -16.0 - bed_loop
intro_gain = (build_full - build_intro) + (-16.0 - bed_full)

# --- hybrid layers: sub-drop boom at the hit, filtered-noise swell into it ---
n = int(INTRO_LEN * SR)
t = np.arange(n) / SR
hit_onset = 5.582  # measured transient in the Bandroom render
tt = t - hit_onset
sub = np.zeros(n)
m = tt >= 0
f = 34 + 22 * np.exp(-tt[m] / 0.35)  # 56 Hz -> 34 Hz
phase = 2 * np.pi * np.cumsum(f) / SR
env = (1 - np.exp(-tt[m] / 0.004)) * np.exp(-tt[m] / 0.9)
sub[m] = np.sin(phase) * env
rng = np.random.default_rng(7)
noise = rng.standard_normal((n, 2))
r0 = hit_onset - 2 * BAR + 0.3
rm = (t >= r0) & (t < hit_onset - 0.01)
p = np.clip((t - r0) / (hit_onset - r0), 0, 1)
riser = np.zeros((n, 2))
# sweep a band-pass upward by processing in short blocks
blk = 2048
for i in range(0, n, blk):
    if not rm[i:i + blk].any():
        continue
    pc = p[i]
    fc = 300 * (8000 / 300) ** pc
    b, a = signal.butter(2, [fc / 1.6 / (SR / 2), min(fc * 1.6, 20000) / (SR / 2)], "band")
    riser[i:i + blk] = signal.lfilter(b, a, noise[i:i + blk], axis=0)
riser *= (p ** 3)[:, None] * rm[:, None]
riser[rm] *= 1.0
# tiny release so the swell cuts cleanly into the hit
cut = int((hit_onset - 0.01) * SR)
riser[cut - 240:cut] *= np.linspace(1, 0, 240)[:, None]


def db(x):
    return 10 ** (x / 20)


x = np.zeros((n, 2))
x[:min(n, len(intro))] = intro[:n]
x *= db(intro_gain)
# lift the build a little (+2 dB) so the tension reads after the overlap-safety trim; back to 0 dB just before the hit
BUILD_LIFT = 2.0
g = np.interp(t, [0, hit_onset - 0.12, hit_onset - 0.02], [BUILD_LIFT, BUILD_LIFT, 0.0])
x *= db(g)[:, None]
x += sub[:, None] * db(SUB_DB)
x += riser / (np.abs(riser).max() + 1e-9) * db(RISER_DB)
# fade the ring-out (equal-power tail) to exact silence at the end
fl = int(FADE * SR)
x[-fl:] *= np.cos(np.linspace(0, np.pi / 2, fl))[:, None]

y = loop * db(loop_gain)


def tp(z):
    up = signal.resample_poly(z, 4, 1, axis=0)
    return 20 * np.log10(np.abs(up).max())


# sum as the browser will play it: loop starts at hitAt
loop_start = HIT
s = x.copy()
k0 = int(loop_start * SR)
ln = len(y)
for k in range(k0, n, ln):
    seglen = min(ln, n - k)
    s[k:k + seglen] += y[:seglen]
info = {
    "build_full": build_full, "build_intro": build_intro, "bed_full": bed_full, "bed_loop": bed_loop,
    "intro_gain": intro_gain, "loop_gain": loop_gain,
    "intro_tp": tp(x), "loop_tp": tp(y), "sum_tp": tp(s),
    "intro_lufs": L(x), "loop_lufs": L(y), "sum_lufs_first_15s": L(s),
}
# if the overlap would exceed -1 dBTP, pull the intro down until it does not
red = 0.0
while tp(x * db(-red) + (s - x)) > -1.0 and red < 6:
    red += 0.25
x *= db(-red)
s = x + (s - x * db(red)) if red else s
info["intro_reduction"] = red
info["intro_tp_final"] = tp(x)
info["sum_tp_final"] = tp(s)
info["intro_lufs_final"] = L(x)
sf.write(f"{OUT}/score-intro.wav", x.astype(np.float32), SR, subtype="FLOAT")
sf.write(f"{OUT}/score-loop.wav", y.astype(np.float32), SR, subtype="FLOAT")
sf.write(f"{OUT}/preview-sum.wav", s.astype(np.float32), SR, subtype="FLOAT")
print(json.dumps({k: round(v, 2) for k, v in info.items()}, indent=1))
