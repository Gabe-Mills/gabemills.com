# The GM mark

`gm-source.png` is Gabe's monogram as he supplied it: rendered chrome with an
electric-blue rim light on black, 1536×1024. **Nothing on the site uses it
directly.** Every asset in `public/` is derived from it by the three scripts
here, in order:

```
python3 1-mark.py    # source  -> mark-full.png   (ember, transparent)
python3 2-small.py   # full    -> mark-small.png  (legibility cut for ≤40px)
python3 3-assets.py  # both    -> public/ assets
```

Requires `pillow` and `numpy`. Paths inside the scripts are absolute; they write
to `out/`, and `3-assets.py` is what produces the files that get copied into
`public/`.

## Why it is recoloured

The mark is cold steel and electric blue. The site is ember on near-black, with
a locked palette (see DESIGN.md). Gabe's call was to recolour rather than accept
a cold accent in a warm page, so `1-mark.py` throws the hue away entirely —
luminance only — and rebuilds the colour from an ember ramp that mirrors the
wordmark's own gradient: deep ember in shadow, `#E4692C` and `#FFB15E` through
the mid-tones, near-white at the specular highlights.

A flat tint was the wrong tool. It caps the highlights at the accent colour, and
the metal stops reading as metal.

Alpha comes from luminance too, so the black ground clears completely and the
rim glow fades out instead of ending on a hard box edge. The consequence worth
knowing: **the mark's dark facets are semi-transparent.** On this page that is
invisible and correct — they show near-black page through near-black bevel. On
a light background the mark would fall apart, which is exactly why every icon
ships on its own dark tile rather than transparent.

## Why there are two cuts

`mark-full` is the metal: thin specular outlines, dark bevels, wide tonal range.
All of that is detail, and detail is the first thing to die under a 5× downscale
— at 32px it turns to an orange smudge.

`mark-small` trades the metal for legibility. Alpha is pushed toward binary so
the strokes stay solid, and the fill is compressed into the top of the ramp so
the whole mark sits at accent brightness instead of averaging down to mud. It is
used in the nav pill and the 32px favicon; everything larger uses the full cut.

## What ships

| file | from | used by |
|---|---|---|
| `public/logo-gm.webp` (510×300) | full | hero crest, and inlined into the OG card |
| `public/logo-gm-nav.webp` (184×108) | small | nav pill, shown at 19px |
| `public/favicon-32.png` | small | browser tab |
| `public/icon-192.png` | full | Android / PWA |
| `public/apple-touch-icon.png` (180, square) | full | iOS home screen — iOS applies its own mask, so this one ships unrounded |

`public/favicon.svg` was deleted; nothing references it any more.

## If the mark ever changes

Replace `gm-source.png`, re-run the three scripts, copy `out/` into `public/`,
and re-run `~/.gmshots/ogshot.mjs` — the OG card inlines the mark as a data URI
and will not pick up a new one on its own.
