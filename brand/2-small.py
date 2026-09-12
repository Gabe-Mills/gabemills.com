from PIL import Image, ImageFilter
import numpy as np

base = Image.open("/home/claude/gm/mark-full.png").convert("RGBA")
a = np.asarray(base).astype(np.float32) / 255.0
lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
al = a[..., 3]

# A second cut, for small sizes only.
#
# The full mark is a piece of rendered metal: thin specular outlines, dark
# bevels, a wide tonal range. All of that is detail, and detail is the first
# thing to die under a 5x downscale — at 32px the letterforms turn to an orange
# smudge. This variant trades the metal for legibility: alpha is pushed toward
# binary so the strokes stay solid, and the fill is compressed into the top of
# the ramp so the whole mark sits at accent brightness instead of averaging
# down to mud.
solid = np.clip((al - 0.16) / 0.34, 0, 1)          # harder edge, thicker stroke
fill = np.clip(0.52 + lum * 0.85, 0, 1)            # compress into the bright end

STOPS = [
    (0.00, (0x8A, 0x3A, 0x14)),
    (0.55, (0xE4, 0x69, 0x2C)),
    (0.80, (0xFF, 0xB1, 0x5E)),
    (1.00, (0xFF, 0xE4, 0xC2)),
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

rgb = ramp(fill)
img = Image.fromarray(
    (np.clip(np.dstack([rgb, solid[..., None]]), 0, 1) * 255).astype(np.uint8), "RGBA"
)
img.save("/home/claude/gm/mark-small.png")

# side by side at the sizes that actually matter
BG = (8, 6, 5)
sheet = Image.new("RGB", (760, 320), BG)
y = 30
for label, src in (("full", base), ("small", img)):
    x = 40
    for h in (24, 32, 40, 56, 80):
        w = round(src.width * h / src.height)
        r = src.resize((w, h), Image.LANCZOS)
        sheet.paste(r, (x, y + (80 - h) // 2), r)
        x += w + 34
    y += 130
sheet.resize((1520, 640), Image.LANCZOS).save("/mnt/user-data/outputs/gm-small.png")
print("ok", img.size)
