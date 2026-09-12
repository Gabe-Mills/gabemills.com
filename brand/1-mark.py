from PIL import Image
import numpy as np

SRC = "/root/.claude/uploads/dc592936-36c2-5e02-a530-640f3dd75a95/cc4d85d7-image.png"
OUT = "/home/claude/gm"

a = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32) / 255.0
# Perceptual luminance. The source is chrome (neutral) with a blue rim light;
# taking luminance discards the hue outright, which is what we want — the ember
# comes back from the ramp below rather than from a hue rotation, so the metal
# keeps its full tonal range instead of turning into orange-tinted grey.
lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

# Trim on the SOLID letterforms (0.45), not on any visible pixel: the rim glow
# reaches the full width of the source, so a low threshold "trims" to the
# original frame and the mark ends up floating in a sea of dead space.
solid = lum > 0.45
ys, xs = np.where(solid)
pad = 62  # enough glow to keep the rim light, not enough to read as a box
y0, y1 = max(0, ys.min() - pad), min(lum.shape[0], ys.max() + 1 + pad)
x0, x1 = max(0, xs.min() - pad), min(lum.shape[1], xs.max() + 1 + pad)
lum = lum[y0:y1, x0:x1]

STOPS = [
    (0.00, (0x0A, 0x04, 0x02)),
    (0.22, (0x6B, 0x22, 0x0A)),
    (0.48, (0xE4, 0x69, 0x2C)),
    (0.72, (0xFF, 0xB1, 0x5E)),
    (0.88, (0xFF, 0xD9, 0xA8)),
    (1.00, (0xFF, 0xF6, 0xEA)),
]

def ramp(l):
    out = np.zeros(l.shape + (3,), np.float32)
    for i in range(len(STOPS) - 1):
        p0, c0 = STOPS[i]
        p1, c1 = STOPS[i + 1]
        m = (l >= p0) & (l <= p1)
        t = np.zeros_like(l)
        t[m] = (l[m] - p0) / (p1 - p0)
        for ch in range(3):
            out[..., ch][m] = c0[ch] + (c1[ch] - c0[ch]) * t[m]
    return out / 255.0

rgb = ramp(np.clip(lum, 0, 1))
alpha = np.clip((lum - 0.030) / 0.970, 0, 1) ** 0.88
img = Image.fromarray(
    (np.clip(np.dstack([rgb, alpha[..., None]]), 0, 1) * 255).astype(np.uint8), "RGBA"
)
img.save(f"{OUT}/mark-full.png")
print("mark", img.size)

# --- preview sheet: the sizes it will actually be used at, on the real ground
BG = (8, 6, 5)
sheet = Image.new("RGB", (1200, 460), BG)
x = 40
for h in (32, 48, 96, 180):
    w = round(img.width * h / img.height)
    sheet.paste(img.resize((w, h), Image.LANCZOS), (x, 40), img.resize((w, h), Image.LANCZOS))
    x += w + 40
sheet.paste(img.resize((round(img.width * 300 / img.height), 300), Image.LANCZOS), (40, 130),
            img.resize((round(img.width * 300 / img.height), 300), Image.LANCZOS))
sheet.save(f"{OUT}/preview.png")
print("preview ok")
