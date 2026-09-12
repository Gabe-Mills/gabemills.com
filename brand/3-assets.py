from PIL import Image, ImageDraw, ImageFilter
import numpy as np, os

OUT = "/home/claude/gm/out"
os.makedirs(OUT, exist_ok=True)
full = Image.open("mark-full.png").convert("RGBA")
small = Image.open("mark-small.png").convert("RGBA")

def fit(src, h):
    return src.resize((round(src.width * h / src.height), h), Image.LANCZOS)

# --- on-page marks -----------------------------------------------------------
# Sized for 3x of their largest on-page use, not for the source resolution.
# The hero shows it at ~86px tall, the nav at 30px.
fit(full, 300).save(f"{OUT}/logo-gm.png")           # hero
fit(small, 108).save(f"{OUT}/logo-gm-nav.png")      # nav pill

# --- icon tile ----------------------------------------------------------------
# The mark is ember on dark, and a browser tab can be either. Without its own
# ground it disappears on a light tab strip, so every icon ships on a tile.
def tile(size, mark, inset=0.80, radius=None):
    t = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    r = radius if radius is not None else round(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=(12, 9, 7, 255))

    # a breath of ember behind the mark, so the tile isn't a flat black square
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    c, rad = size / 2, size * 0.38
    gd.ellipse([c - rad, c - rad, c + rad, c + rad], fill=(120, 45, 14, 150))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.16))
    t.alpha_composite(glow)

    m = fit(mark, max(1, round(size * inset / (mark.width / mark.height))))
    if m.width > size * inset:
        m = m.resize((round(size * inset), round(m.height * size * inset / m.width)), Image.LANCZOS)
    t.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))

    # keep the rounding crisp after compositing
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    t.putalpha(Image.composite(t.getchannel("A"), Image.new("L", (size, size), 0), mask))
    return t

tile(32, small, 0.86).save(f"{OUT}/favicon-32.png")
tile(192, full, 0.80).save(f"{OUT}/icon-192.png")
# iOS applies its own mask, so the touch icon ships square with no rounding
tile(180, full, 0.78, radius=0).convert("RGB").save(f"{OUT}/apple-touch-icon.png")

for f in sorted(os.listdir(OUT)):
    p = f"{OUT}/{f}"
    print(f, Image.open(p).size, f"{os.path.getsize(p)/1024:.0f}KB")

# contact sheet for review, at true size on the real page ground
sheet = Image.new("RGB", (620, 260), (8, 6, 5))
sheet.paste(Image.open(f"{OUT}/favicon-32.png"), (40, 40), Image.open(f"{OUT}/favicon-32.png"))
sheet.paste(Image.open(f"{OUT}/icon-192.png").resize((180,180), Image.LANCZOS), (110, 40),
            Image.open(f"{OUT}/icon-192.png").resize((180,180), Image.LANCZOS))
nav = fit(small, 30); sheet.paste(nav, (330, 45), nav)
hero = fit(full, 86);  sheet.paste(hero, (330, 110), hero)
sheet.resize((1240, 520), Image.LANCZOS).save("/mnt/user-data/outputs/gm-assets.png")
