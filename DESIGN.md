# DESIGN.md — gabemills.com

Locked 11 Sep 2026. Every colour, size, and duration in the codebase should trace back to this
file. If a number can't be justified from here, it was guessed.

## Reference lock

**Hybrid: "Molten Glass" hero over an "Ember Lattice" body.** Both directions were built as
full specimens before this was chosen; this file is the winner's token set.

- **Hero (Molten Glass)** — the background is a *heat field*: contour isolines that bunch and
  bend toward a hot centre. Surfaces on top are genuinely thick glass: heavy blur, a refracted
  rim that runs warm on one edge and cool on the other, an inner caustic along the top edge.
  Display type is the serif, set large.
- **Body (Ember Lattice)** — the background is *structure*: a wireframe icosphere you can see
  through, still orbiting. Surfaces are smoked and backlit — opaque dark panels with one bright
  ember edge-light down a single side, and **no blur**, because blur under body copy is a
  readability fight that never ends.

The transition between them is the point, not a seam: the hero's contour field fades out at its
lower edge and the wire lattice emerges underneath it. "Systems emerging from the dark", literally.

### Rejected, and why
- **Blueprint Furnace** (isometric drafting lines, corner brackets, dimension ticks) — the most
  distinctive of the three and the strongest fit for a peer audience. Rejected only in favour of
  the hybrid. Worth revisiting if the site ever wants to read more tool than showpiece.
- **Aceternity component library** — connected and checked. Deliberately unused: those effects
  ship on thousands of sites, so building on them moves this site toward the average.
- Refero and Mobbin were not available, so no real design systems or shipped screens informed
  this. It is hand-built, which is a limitation worth knowing about, not a virtue.

## Colour

Ground and neutrals are cast warm — every neutral is rotated toward the ember hue at low
saturation, so the greys belong to this palette rather than to a framework default.

```
ground        #080605   hsl(16 32% 3.2%)    page base, never pure black
surface       #120D0C                       smoked panel body (opaque)
surface-2     #1A1413                       raised panel / chip fill
hairline      rgba(255,255,255,0.07)         panel borders
ink           #F3EEE8   warm off-white       primary text
dim           #9C8D86   warm grey            secondary text (4.9:1 on surface)

accent        #E4692C   ember                the one accent, <10% of surface area
edge          #FFB15E   lit ember            edge-lights and hot contour lines only
hot           #FFC46B   flame highlight      hero glass rim, gradient stops
```

Hero-only additions (Molten Glass):
```
glass-fill    linear-gradient(152deg, rgba(60,30,20,0.62), rgba(22,11,8,0.52) 58%, rgba(38,18,12,0.58))
glass-rim     linear-gradient(140deg, rgba(255,214,170,0.72), rgba(255,120,50,0.28) 30%,
                               rgba(120,170,255,0.22) 62%, rgba(255,200,150,0.5))
```
The cool stop at 62% is the refraction — it is the only cool colour in the palette and it exists
to make the glass read as glass. Do not add more.

Semantic state colours are hue-rotated from the accent, not stock greens and reds. Status dots
report a fact rather than solicit a click, so they sit outside the 10% accent budget.

## Type

Two families, contrasting strongly — a high-contrast serif against a geometric sans — which is
the one case where pairing beats a single family. Mono is for labels and data only.

```
display   Instrument Serif 400    hero wordmark + hero lede (italic)
heading   Inter 600/700           section and card headings
body      Inter 400               prose
label     JetBrains Mono 400/500  eyebrows, chips, status, measurements
```

Scale — ratio 1.25 from a 16px base, rounded to half-pixels:
```
hero      clamp(40px, 11.5cqw, 116px)   line-height 0.90   tracking -0.02em   (serif)
h2        31px / 1.12 / -0.025em
h3        25px / 1.2  / -0.02em
body-lg   19px / 1.5
body      16px / 1.6  / 0
small     15px / 1.6
label     11px / 1.3  / +0.18em uppercase
label-sm  10px / 1.3  / +0.14em uppercase
```

Rules that are easy to violate and always visible:
- Tracking tightens as size grows; the serif hero sits at -0.02em, never at 0.
- Uppercase mono gets +0.14em to +0.34em at *any* size. Sentence-case 11px labels get +0.02em
  only — never caps tracking on sentence case.
- Prose containers cap at 65ch. Nothing runs full width.
- `font-variant-numeric: tabular-nums` on every version number, measurement, and metric.

## Space

4px base. Rhythm matters more than the base: space within a group is roughly a third of the space
to the next group.

```
group rhythm     8 / 24 / 64
section padding  py 56px → 80px at md
container        max-width 1040px, side padding 20px → 40px
panel padding    18px at 320px → 28px at 720px (scales with container, never fixed)
radius scale     20 (hero glass) / 14 (smoked panel) / 8 (chip) / 100px (pill)
```

## Depth

Dark mode inverts the usual ranking: the **hairline border and the lighter surface fill** carry
elevation, and the shadow only separates the panel from the background. Alphas are 3–5× their
light-mode equivalents, because a 10% shadow on a near-black ground is invisible.

```css
/* smoked panel — body */
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.05),
  0 1px 2px -1px rgba(3,2,2,0.75),
  0 8px 20px -5px rgba(3,2,2,0.55),
  0 30px 56px -16px rgba(3,2,2,0.40);

/* molten glass — hero only */
backdrop-filter: blur(26px) saturate(1.35);
box-shadow:
  inset 0 1px 0 rgba(255,231,200,0.30),   /* caustic */
  inset 0 0 34px rgba(255,140,60,0.10),
  0 1px 2px -1px rgba(6,3,2,0.70),
  0 10px 26px -6px rgba(6,3,2,0.55),
  0 34px 64px -18px rgba(6,3,2,0.45);
```

Edge-light (the C signature): a 2px vertical bar inset from one side, inset 14% top and bottom,
`linear-gradient(180deg, transparent, #FFB15E 38%, #E4692C 62%, transparent)` with an
18px/2px ember bloom. One side per panel. Never both.

## Motion

```
--ease-cine  cubic-bezier(0.22, 1, 0.36, 1)     default
--ease-soft  cubic-bezier(0.16, 1, 0.30, 1)     hover nudges
enter 260ms · exit 180ms                         asymmetric on purpose
list stagger 40ms, capped at 400ms total
contour drift  ~40s loop        lattice rotation  120s loop
```

Transform and opacity only. `prefers-reduced-motion: reduce` collapses everything to opacity
fades, freezes the contour field to a single drawn frame, and stops the lattice — already honored
in `index.css` and `CoreScene.tsx`; keep it that way.

## Components

```
Hero background    ContourField.tsx    canvas isolines, fades out at lower edge
Body background    CoreScene.tsx       wireframe icosphere + orbit rings (three.js, existing)
Hero surfaces      .glass-molten       thick blur + chromatic rim + caustic
Body surfaces      .glass-smoked       opaque + hairline + one edge-light
Cards              real screenshots, 16:10, object-top
```

## Non-negotiables carried from the last pass

- Body copy never sits on the planet's bright side. The reading ground stays.
- The pinned scroll sequence is desktop-only.
- Real screenshots, never placeholder chrome.
- The mobile nav never scrolls horizontally; the Build action is always on screen.

---

## Calibration after the first render

These values changed after looking at the built page. They are the real numbers now —
the ones above them in this file were the prediction.

**The contour field needed a much tighter heat gaussian.** At `exp(-((f-0.54)*2.6)²)` the
lines spread evenly across the whole canvas and the field read as wood grain, not as heat with
a source. Now:

```
heat       exp(-((f - 0.56) * 4.3)²)     was *2.6 — too wide
amplitude  h*0.014 + heat*h*0.15         was h*0.022 + heat*h*0.13
alpha      0.022 + heat*0.50             was 0.06 + heat*0.40 — cold lines must nearly vanish
lineWidth  0.55 + heat*1.35              was 0.70 + heat*0.90
```

The principle: one gaussian drives amplitude, brightness *and* stroke weight together. Cold
regions have to genuinely recede or there is no focal point.

**Thick glass needs area.** `.glass-molten` on a 40px-tall pill looked like a plain dark
outline — 26px of blur and a refracted rim are invisible at that scale. Pills now use a
lighter recipe, and `.glass-molten` is reserved for surfaces big enough to show it:

```css
/* pill-scale glass */
background: rgba(255,220,180,0.07);
border: 1px solid rgba(255,220,180,0.24);   /* → 0.55 on hover */
backdrop-filter: blur(10px);
```

**The reading ground dropped from 0.96 to 0.90.** At 0.96 it completely hid the wire lattice,
which *is* the body direction — the page looked like the previous version with new panels.

**Added `WireMotif.tsx`.** The WebGL lattice lives behind the reading ground where its contrast
can't be guaranteed, so the same form is also drawn as flat SVG art and placed in the body
section headers — right edge on Builds, left edge on How I Work, so the two don't mirror. This
carries the structure language at a brightness that is controlled rather than composited.

**Added the ember spine.** Each case study's copy column gets the edge-light gradient as a 2px
vertical rule, so the panel language extends onto bare text and each build reads as one object.
Always on the left, including when the column flips, where it doubles as the divider.

**Also fixed while looking:** a local radial scrim behind the hero type block
(`46% 34% at 50% 43%`, rgba(8,5,4,0.78) → transparent at 82%). The contour field is at its
densest exactly where the wordmark sits, and lines crossing the letter counters read as noise
no matter how bright the type is.

---

## Revision: visual index (11 Sep 2026, later)

The page is now a **visual index**. All prose was removed on request. Measured visible word
count: **28 words, identical on desktop and mobile** (down from 148 on desktop mid-revision).
Those 28 are the nav, the eyebrow, the wordmark, the scroll cue, three project names with their
hosts, the GitHub handle, and the footer.

### What went
`CaseStudies`, `HowIWork`, `WorkWithMe` and `StatusStrip` are retired to the timestamped backup
folder under `retired-prose-sections/`. The hero lost its positioning line and both CTAs. The
footer lost the email and the build list. The nav lost its section links and the mailto pill.

**There is no contact path on the site any more — GitHub is the only outbound personal link.**
That was the explicit instruction. The markup is commented rather than deleted, so restoring the
hire path is a small edit, not a rebuild.

### What replaced it
```
VisualIndex.tsx   three screenshot tiles, unequal widths and vertical offsets,
                  per-tile scroll parallax; caption below the image, never on it
GitHubCard.tsx    static avatar (captured at build time, not fetched at runtime),
                  official GitHub mark, handle, arrow
ProjectModule     stripped to pure image — no name, no host, no summary, no chips
```

### Two decisions worth keeping
**The reading ground is gone.** It existed at 90% opacity to keep body copy legible over the
lattice. With no body copy left there is nothing to protect, so the lattice is now fully visible
— which is the first time the Ember Lattice direction is actually doing what it was chosen for.

**Captions sit below the image, not on it.** The first attempt overlaid each name on its
screenshot, which put "Fuji Afterglow" directly on top of the screenshot's own "Fuji Afterglow"
and read as a doubling bug. These are screenshots of text-heavy sites; there is no reliably quiet
region to caption into, and no amount of scrim fixes that.

**The flying cards carry no text at all.** Naming them in the pinned sequence *and* in the index
below recreated the original site's core flaw — the same three links stated more than once. The
sequence is atmosphere; the index is the label.

### Known trade-off
A visitor now learns what these three things look like and nothing about what they are or who
built them. That is the accepted cost of the direction, recorded here so it is a decision rather
than an oversight.

---

## Revision: Constellation background (11 Sep 2026, later still)

One background for the whole page: `ConstellationField.tsx`. Layered sheets of connected nodes
receding to an off-centre vanishing point, flying past the camera forever.

**It replaces four separate layers** — the hero's contour heat field, the WebGL core, the
atmosphere fog, and the wire motifs in the section headers. All four are retired to the backup
folder under `retired-backgrounds/`.

### three.js is out of the bundle
Nothing imports it any more, so Vite stopped shipping it. The `three` entry was also removed from
`manualChunks` in `vite.config.ts` because it emitted an empty 0-byte chunk. The package is still
in `package.json` — uninstall it once you're sure the old `CoreScene` isn't coming back.

```
before   1,163 KB raw / ~271 KB gzipped   (three 474 KB was the largest single asset)
after      436 KB raw / ~140 KB gzipped
```

### Parameters
```
FOCAL 340 · NEAR 74 · FAR 2500 · REF_Z 700
RATE 0.105/s, scaled up to 3.2x by scroll progress
shells   18 desktop / 16 tablet / 14 phone
per shell 22 / 19 / 17
EXTENT   (w * REF_Z) / (2 * FOCAL)     — derived, never a constant
LINK_W   EXTENT * 0.40
```

### The four decisions that make it work
**Discrete shells, not a point cloud.** The first attempt scattered nodes freely in z and linked
any pair close on screen *and* close in depth. The arithmetic kills it: spread over the full depth
range, the chance a screen-neighbour is also a depth-neighbour works out under one link per node,
so it rendered as a plain starfield with no mesh. Nodes sharing a z make each shell a coherent
sheet, and flying through sheet after sheet is what reads as infinite layers.

**Fixed world extent per shell, not frustum-scaled.** Under perspective a fixed extent compresses
far shells into a tight mesh near the vanishing point and spreads near ones past the screen edge.
That difference in apparent density between layers *is* the depth cue. Seeding each shell to fill
the screen gives every layer identical density and the stack reads as mush.

**Extent derived from viewport width.** As a constant (840) it looked right at 1440px and nearly
empty at 375px — only shells past z≈1500 fell inside a phone's frustum and every nearer layer
spread off screen. Deriving it from width keeps density identical at any size.

**Band-pass depth, not a near-is-brightest ramp.** Sheets dissolve both at the back and as they
sweep past the camera (`nearFade = min(1, (z - NEAR) / (NEAR * 2.4))`). A pure ramp let the
closest shell throw enormous hard lines across the whole frame and flattened everything behind it.

### Measured
61 fps at 1440x900 and at 375x812. Links are batched into one `stroke()` per shell rather than one
per line, and halo gradients are drawn only for hot nodes on shells with `fog > 0.45`.

### Still true
A local radial scrim sits behind the hero type block. That is the third background in a row to
need one — whatever the field is, a dense pattern directly behind the wordmark puts lines through
the letter counters and the mono labels. Assume the next one needs it too.

---

## Revision: Constellation, cooler pass (11 Sep 2026)

Same shell architecture, five additions. Each one is about the field being *alive*, not about
adding effects — scattered unrelated effects is what makes a page read as generated.

**Additive compositing.** Links and nodes draw with `globalCompositeOperation = "lighter"`, so
overlapping sheets build up luminance instead of painting over one another. This is the single
biggest difference between "flat strokes on black" and something that looks lit. Alphas are
roughly half their normal-blend values or it blows out — link alpha `0.03 + fog*0.26`, node alpha
`0.08 + fog*0.6`. Ground fill, bloom and vignette stay on `source-over`; the composite mode is
switched back before the vignette so it can actually darken.

**Cursor gravity.** Nodes lean toward the pointer and the nearest wire themselves to it. Pull is
`fall² * 33 * reach`, where `reach = 0.25 + fog*0.75` — near sheets react hard, far ones barely
move. That depth scaling is what makes it read as dimensional rather than as a flat canvas trick.
Listeners are registered for **both** `pointermove` and `mousemove`: some embedded and automated
contexts only deliver the latter, and losing the interaction silently is worse than one redundant
listener.

**Signal pulses.** Bright packets travel along links, spawned inside the link loop at p≈0.0016 per
link per frame on sheets with `fog > 0.4`, capped at 26 live. Each stores its shell's `gen`
counter and is dropped when that shell recycles, so a packet can never jump to a newly seeded
node. Head is a radial gradient, tail a short bright segment, brightness `sin(t*π)` so it fades in
and out across its run.

**Bokeh near plane.** Sheets closer than `NEAR * 3.4` render nodes as soft radial gradients
instead of hard dots, so the foreground goes out of focus like a real lens. Cheap because near
sheets have most of their points off screen — off-viewport points are skipped before the gradient
is built.

**Radial motion streaks.** Scroll velocity is derived from the frame-to-frame delta of
`progressRef`, smoothed and clamped at 2.4. Above a threshold, nodes stretch along their vector
*out from the vanishing point* — the correct blur direction for forward travel, which is why it
reads as speed rather than as a filter.

Plus a slow bloom breath (`0.86 + 0.14 sin(t*0.18)`) so a still screenshot and the live page feel
like the same object.

### Measured
61 fps at 1440x900 and 375x812, no console errors. Links remain one batched `stroke()` per sheet.
Bundle unchanged at ~436 KB raw / ~140 KB gzipped — all of this is arithmetic, not payload.

---

## Revision: GitHub leads (11 Sep 2026)

**Order changed.** GitHub now sits above the site previews. The code leads; the three websites
are supporting evidence beneath it. Their tiles shrank accordingly — container `max-w-3xl`,
widths 50/42/46%, rendering at 323–384px against roughly 1090px before — so they read as a
scattered gallery strip over the field rather than as the main event.

### The GitHub section
Real data, captured from the API with `gh` on 11 Sep 2026 and **baked into
`src/data/github.ts`**, not fetched at runtime: the unauthenticated GitHub API allows 60
requests/hour per IP, and this is now the only content section on the page — a rate-limited fetch
would render the site broken. To refresh:

```
gh api users/Gabe-Mills --jq '{login,name,public_repos,company,blog}'
gh api "users/Gabe-Mills/repos?per_page=100&sort=updated"
for r in $(gh api "users/Gabe-Mills/repos?per_page=100" --jq '.[].name'); do
  gh api "repos/Gabe-Mills/$r/languages"; done
```

The tagline is **Gabe's own words**, lifted from his profile README repo description — not
copy I wrote.

**Deliberately absent:** follower count and star counts. They are 0 and 1. Putting them on screen
would undersell the work rather than support it. Language composition is the honest signal.

### The language chart
A stacked composition bar of real byte counts summed across every public repo (764 KB, 4 repos).

Colours are the **validated dark-mode categorical slots in fixed order** — blue, orange, aqua,
yellow, magenta, green, violet — assigned to languages in size order with "Other" pinned last.
They are *not* the site's ember accent, and that is not an oversight: a categorical scale needs
separable hues, and seven warm ones fail CVD separation outright. Verified with the palette
validator against the smoked-panel surface `#120D0C`:

```
Lightness band      PASS   all 7 inside L 0.48–0.67
Chroma floor        PASS   all 7 >= 0.1
CVD separation      PASS   worst adjacent ΔE 8.4 protan · 8.7 tritan
Normal-vision floor PASS   worst adjacent ΔE 19.3
Contrast vs surface PASS   all 7 >= 3:1
```

An orange-first ordering (to lead with the site's own hue) also passed the hard gates but dropped
worst-adjacent tritan separation from 8.7 to 4.0, so the reference ordering was kept. Ordering is
the CVD-safety mechanism here, not cosmetics.

Other requirements met: 2px surface gaps between segments and rounded outer ends; a legend that
doubles as the table view, carrying name and percentage so identity never depends on colour alone;
`tabular-nums` on every figure; text on text tokens with the coloured swatch carrying identity;
hover dims the other segments and their legend rows together; `role="img"` with an aria-label
listing every language and share.

### Background, cooler again
**Multi-hop cascades.** A packet that reaches a node queues a hop, and the next frame's link loop
finds that node a neighbour to continue to — so signals trace real multi-segment paths across the
mesh. Reusing the loop that already computes adjacency means no adjacency table is stored or kept
in sync, and generation counters stop a hop crossing into a recycled shell.

**Click shockwaves.** A ring expands from the pointer at 0.62 × the long edge per second, shoving
nodes within an 11%-of-viewport band outward, scaled by each sheet's depth. Also bound to
`pointerdown`, which makes it the one interaction that works on a phone.

**Chromatic bokeh.** Out-of-focus near nodes render as offset warm and cool lobes ~3px apart, the
way a fast lens fringes a bright point. Additive blending fuses the cores back to near-white.

61 fps at 1440×900 and 375×812, no console errors.
