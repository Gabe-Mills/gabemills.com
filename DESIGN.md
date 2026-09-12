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

---

## Revision: repo public, data refreshed, more air (11 Sep 2026)

**The project is now a git repo**, pushed public to `github.com/Gabe-Mills/gabemills.com`.
Checked before publishing: no hardcoded secrets anywhere — every credential in `support/`
(Discord bot token, Supabase keys, Apple auth) is read from a Cloudflare env binding.
`.gitignore` excludes `node_modules`, `.next` (436MB of abandoned Next.js build cache), `dist`,
`.wrangler`, the `_backup-src-*` and `_unused-screenshots` working folders, and `.claude`
(a third-party skill bundle, not site code). 66 files tracked.

**That push invalidated the site's own data**, which is worth noting as a pattern: publishing the
repo moved the public repo count 4 → 5 and changed the language mix enough to matter —
TypeScript 28% → 36%, and JavaScript overtook both Astro and Swift. Baked data has to be
refreshed whenever the repo list changes.

### Every language now appears
He asked for everything that's on the GitHub profile, so all **11** languages are named. The bar
still has only **8 segments**, and that split is the design, not a shortcut:

- 7 languages get their own validated slot; the remaining 4 (Shell, C, HTML, Ruby — 3.2% combined)
  share the eighth, "Other".
- All 4 are then itemised by name and percentage in a row beneath the legend, so nothing is hidden.
- Eight is the hard ceiling: the validated palette has eight slots and a ninth hue cannot be
  invented without breaking colourblind separation. Re-validated at 8 slots against `#120D0C` —
  all five checks pass, worst adjacent CVD ΔE 8.4 protan / 8.7 tritan, normal-vision 19.3.

### Spacing opened up
```
sections      py-16 md:py-24  →  py-24 md:py-36
hero          pb-20 pt-32     →  pb-28 pt-36   (md:min-h 88vh → 92vh)
GitHub card   p-5 sm:p-7      →  p-6 sm:p-9
legend        gap-y-2.5       →  gap-y-3.5, gap-x-6 → gap-x-8
repo list     gap-2.5         →  gap-3.5, rows px-4 py-3 → px-5 py-4
tile stack    gap-10 md:12    →  gap-20 md:28
footer        py-10           →  py-16
scroll-mt     24              →  28  (anchor offsets follow the new rhythm)
```
Page height 5,935 → 6,621 desktop and 2,398 → 3,038 mobile. The tiles themselves stayed small —
more space between them, not bigger previews.

---

## Revision: the stack groups (11 Sep 2026)

A new `#stack` section between GitHub and the site previews, carrying the five badge groups from
his profile README (`github.com/Gabe-Mills/Gabe-Mills`) — **same groups, same order, same items,
nothing added or dropped**. Verified in the DOM against the README: 12 / 18 / 8 / 27 / 10 = **75
chips**.

```
Languages                  12
Libraries & tools          18
AI I use every day          8
Models we've actually run  27   · links to Massed-Compute/gpu-benchmark
Devices                    10
```

Source of truth is `src/data/stack.ts`. Refresh it from:
`gh api repos/Gabe-Mills/Gabe-Mills/contents/README.md --jq .content | base64 -d`

### Colour
The README's badges default to `#C4783A`, which is already almost exactly this site's ember — so
the default chip needed no translation at all. Only the items he gave explicit brand colours carry
a coloured dot:

```
Anthropic  #D97757   Claude, Claude Code
OpenAI     #412991   ChatGPT, Codex, gpt-oss
NVIDIA     #76B900   CUDA, Nemotron, L40S, A100, A6000, H100, H200, Blackwell
Google AI  #8E75B2   Gemini
GLM        #1A73E8
neutral    #8A8A8A   Cursor, Grok, Ollama — the README used #000, unusable on a dark ground
```

If every chip were coloured none of them would mean anything; keeping the default ember is what
makes the Anthropic / OpenAI / NVIDIA groupings legible at a glance. The `#000` badges were the one
place the README couldn't be followed literally — pure black is invisible on `#060404`.

### Note on the two language lists
There are now two, and they answer different questions, so both are correct:
- **Language composition** (GitHub section) — measured byte counts from public repos, 11 languages.
- **Languages** (stack section) — what he lists on his profile, 12 languages. Includes C++ and C#,
  which appear in no public repo.

The chart's own subtitle scopes it ("983 KB across 5 repos"), so the difference reads as intended
rather than as a contradiction. Don't "reconcile" them by editing either one.

### Page height
7,689 desktop / 4,578 mobile, 61 fps, no horizontal overflow. This is the longest the page has
been — a consequence of adding 75 labels to a site that was 28 words a few hours ago, which is
worth being deliberate about if more gets added.

---

## Fix: the tile gap was a real bug (11 Sep 2026)

The preview tiles were nearly touching at narrow widths, and it wasn't a spacing value — it was
a breakpoint bug. `lift` was applied as an inline `style={{ marginTop: l.lift }}`, so the `-80px`
and `-56px` stagger offsets ran at **every** width. Below `md`, where the tiles are full-width and
stacked, those negatives simply cancelled the flex gap.

`lift` is now a Tailwind class (`md:-mt-16`, `md:-mt-10`), so the stagger exists only where the
asymmetric layout does. Measured after:

```
width   tile widths        gap between boxes
1440    399 / 338 / 369    64, 88   (md stagger intentionally tightens these)
1000    399 / 338 / 369    64, 88
 700    660 / 660 / 660    96, 96   ← was 0 and 24
 375    335 / 335 / 335    96, 96
```

**The lesson worth keeping:** an inline style has no breakpoint. Anything that should only apply
at one size has to be a class, or it silently fights the responsive layout at every other size.

## Chips became bubbles

```
padding    px-2.5 py-1.5  →  px-4 py-2.5     (height 27px → 41px)
row gap    gap-2          →  gap-2.5 sm:gap-3 (8px → 12px)
label      11.5px         →  12.5px
dot        1.5 → 2 units, plus a 7px coloured bloom
group pad  p-6 sm:p-9     →  p-7 sm:p-10
```

The inner top highlight (`inset 0 1px 0 rgba(255,255,255,0.07)`) is what makes a pill read as a
bubble rather than an outlined rectangle with round ends — same trick as the smoked panels, at a
smaller scale.

---

## Revision: unboxed — bubbles float on the field (11 Sep 2026)

The GitHub and stack sections no longer sit in a card. Both `glass-smoked` panels are gone
(verified: 0 panels remain in `#github` and `#stack`); everything floats directly on the
constellation and swells when you touch it.

### Why unboxing works here
**Each bubble carries its own fill.** At chip scale the bubble *is* the panel — it brings the
local contrast the wrapping card used to provide. That's the whole reason this is viable, and it's
also the constraint: the fill can never go fully transparent, however light the design wants to
feel, or the labels lose their ground and the lattice reads straight through them.

`Bubble.tsx` is the single shared component, so hover behaviour, fill, border and the inner
highlight can't drift between the three places bubbles appear.

### Growth is a spring, not a duration
`type: "spring", stiffness: 420, damping: 22, mass: 0.6` — measured 97.8×46 → 106.5×50.1 on hover,
about 1.089×. A bubble easing linearly to a new size reads as a rectangle being scaled; the
overshoot is what sells it as physical. Large bubbles (repos) grow less, 1.035×, because the same
ratio on a big object looks like a layout jump rather than a swell. Everything collapses to no
transform under `prefers-reduced-motion`.

### The `.on-field` text rule
With the panels gone, headings and small labels sit on a background made of glowing lines, and a
field like that will cross any 10px mono label. `.on-field` in `index.css` applies a double
shadow — tight for edge definition, wide for a local pool of dark — which buys legibility without
painting a visible plate behind the text.

**Every piece of text that is no longer on a panel needs this class.** That now includes the
section headings, the handle, the tagline, the KB figure and the group counts.

### The one thing that could not be unboxed
**The language bar stays a single solid object.** It's a chart: segment widths are only comparable
if they sit flush against one another, so it can't be broken into floating pieces without
destroying the thing it measures. Its legend did become bubbles, which still satisfies the
table-view requirement — each one carries the swatch, the name and the percentage.

### Measured
```
width   height   overflowX   stack chips   github bubbles   bar segments
1440     7,731       0            75             16              8
 700     4,768       0            75             16              8
 375     5,338       0            75             16              8
```
No console errors at any width.

---

## Fix: the screenshots were a scale problem, not a quality problem (12 Sep 2026)

The previews looked mushy, and the instinct was to make the images "better". The sources were
already 1600×1000 against a ~380px tile — far more resolution than needed. The real cause was
**scale**: a whole 1440px-wide page squeezed into 380px is a 3.8× reduction, so 13px body text
rendered at **3.4px**. No amount of image quality fixes that.

**Capture at a narrower viewport instead.** At 1000px it's a 2.6× reduction and the hero headlines
survive at roughly 12–15px, which is the only reason to show a screenshot at all.

```
capture   1000 × 750 at DPR 2  →  2000 × 1500  →  downscaled to 1500 × 1125, JPEG q92
```
q92, not q80 — these are text-heavy shots and JPEG artefacts land straight on the glyph edges.

### Why 4:3 and not 16:10
The image box is not the container. The container is `aspect-[16/10]`, but the img carries an
overscan for the parallax, so its box is `1.6 / overscan`. At the old `h-[120%]` that made the box
**1.33**, and 16:10 sources inside a 1.33 box meant `object-cover` cropped the *sides* — which is
what clipped "Leland Plays Piano" to "eland Plays Piano".

Now: sources are 4:3, overscan is `h-[112%]` (box 1.43), so cover trims top and bottom instead —
harmless, since the content is top-aligned. The parallax range was cut to ±13–19px to stay inside
the smaller overscan; exceed it and a bare edge shows.

**The rule:** whenever the overscan or the source aspect changes, the other has to change with it,
and the parallax range has to fit inside whatever overscan remains.

### Framing
`gcoolers` is captured at scroll 330 rather than the top. The top of that page is just a wordmark
on black — nearly empty at tile size. Scroll 330 catches the install buttons, the brew command and
the live TUI dashboard with its temperature bars, which is what the product actually looks like.
`leland` and `afterglow` are captured at the top; both lead with a large serif headline that
survives the reduction.

### Not generated
These stay real screenshots. Each tile names a host and links to it, so a generated image in that
slot would be a fabricated picture of a real, identifiable site. Generated imagery is fine for
things that don't stand in for something real — an OG card, background art — but not here.

---

## The stack stops being a list: `BubbleField` (12 Sep 2026)

Brief: *"the bubbles of what i do … have like physics and rush to a point around the middle."*

`flex flex-wrap gap-3` was a grid pretending to be loose — rows, gutters, a ragged right edge.
Each group is now a solver. Every pill is a body: it falls toward a point in the middle of the
band, collides with its neighbours instead of overlapping them, gets shoved aside by the cursor,
and never fully stops.

### The forces
| force | value | why |
|---|---|---|
| pull to centre | `K_IN = 0.0026`/frame | the "point around the middle" |
| vertical multiplier | `K_Y = 1.7` | flattens the blob so it reads wide, not round |
| entrance boost | `×4.4 → ×1` over `1150ms`, eased | this is the *rush* |
| damping | `0.885 → 0.907` | loose during the rush, settled after |
| wander | `±0.019 / ±0.013` per axis | a frozen cluster stops reading as physical |
| cursor | `132px`, `(1-d/r)² × 2.7 × invMass` | light pills scatter, wide ones barely move |

### Two decisions that carry the whole thing

**Rectangle separation, not circles.** A 160px pill inside its bounding circle leaves a hole the
size of another pill on each side. Pairs are separated along the axis of *least* overlap, weighted
by inverse mass (`invMass = 1 / (w·h / 3400)`), so wide pills shove narrow ones and the cluster
packs like pills rather than spraying like marbles.

**Two render passes, in this order.** Pass one is the real `flex-wrap` list, so the browser
measures each pill at its intrinsic width; pass two pins those measurements and goes absolute.
Measuring *after* going absolute gives shrink-to-fit against a different containing block — pills
come out a few pixels narrow.

### Calibration, in the order the numbers were wrong
- `K_Y = 3.1` squeezed a ten-pill group into a single row wider than the container; the walls then
  forced pills through each other. → `1.7`.
- Box height from *total area* needed a clamp, and on a 375px screen the clamp saturated: the
  27-pill group hit its 520px ceiling with **16 overlaps**. The browser's own wrap height, measured
  in pass one, is the honest answer to "how much room do these need". → `H = max(200, flowH × 1.88)`.
- `×1.65` left the dense group 11px of total slack — pressed against both walls, which is exactly
  where relaxation stops converging. → `×1.88`.
- `ITER = 6` still lost one pill in a confined group: separating one pair pushes into the next, and
  the cycle needs iterations to unwind. → `10`. (27 bodies is 351 pairs; 10 passes is nothing.)
- The starting ring is *necessarily* overlapped — 27 pills spaced around one ellipse have to be — so
  for one frame before the solver ran you saw a stack of pills on top of each other. The field now
  holds `opacity: 0` until the IntersectionObserver starts it, and fades in across the rush.
- `pb-28 md:pb-40` on the section stacked on top of the ~45px of slack each field now carries below
  its cluster, leaving half a screen of nothing before the first tile. → `pb-16 md:pb-24`.

### Where it does not run
- **`prefers-reduced-motion`** — pass one *is* the render. Verified: 0 absolutely-positioned
  children, all 75 chips present, nothing left at opacity 0.
- **Below 620px** — a phone has no cursor, so half the interaction is gone, and 27 pills two to a
  row need a metre of scroll to jostle in. Narrow screens keep the wrap.
- **Off screen** — an IntersectionObserver (`rootMargin: 120px`) starts and stops each rAF loop, so
  only the fields you can see cost anything.

### Asymmetry
`BIAS = [-0.07, 0.06, -0.05, 0.04, -0.06]` moves each attractor off centre by a fraction of the
field width. Five blobs on one axis read as one component repeated five times; drifting the point
they collapse toward is the same move the project tiles make with width and offset. Past about
`0.1` a cluster starts leaning on a wall.

### Verified
`1440 / 1000 / 700`: **60fps**, 0 overlaps, 0 bodies outside their box, no console errors, no
horizontal overflow. `375`: falls back to the wrap.

---

## Screenshots, second pass: framing, not resolution (12 Sep 2026)

Brief: the gcoolers *intro* shot with the graph in it, and Leland's *landing* view.

`gcoolers.com` has no `<svg>`, `<canvas>` or `<img>` on the page — the "graph" is the HISTORY
sparkline inside the hero's ASCII TUI panel (`.hero-live`, ~290px tall, sitting below the fold at
750px). The old scroll-330 capture caught the install buttons and the top of the TUI but cut the
graph off. The capture script now measures the band from `.hero-tag` to `.hero-live` and centres
*that* in the frame — scroll resolves to **114** rather than being hardcoded, so it survives copy
changes on that page.

### Geometry changed with it
```
capture   1200 × 840 at DPR 2  →  2400 × 1680  →  downscaled to 1500 × 1050, JPEG q92
```
1200/840 = **1.4286**, which is exactly the tile's image box (`aspect-[16/10]` ÷ `h-[112%]`
overscan). At 4:3 the sources were being trimmed top and bottom by `object-cover`; at 1.4286 the
whole capture survives. The rule from the last pass still holds: **overscan, source aspect and
parallax range move together.**

`leland` and `afterglow` stay at scroll 0 — both lead with the thing you see on arrival, which is
what was asked for. Leland's hero is 652px of a 840px frame at this width; the remaining band shows
the top of the photo strip, which reads as the page continuing rather than as dead space.

`shotAlt` for gcoolers was rewritten — it still described the install section.

---

## The physics field is out. The stack is a typographic index. (12 Sep 2026)

Gabe, on the section shipped an hour earlier: *"i dont like the way the bubble look works, i
dont like that whole section redo that."*

He was right, and the diagnosis is worth keeping because it invalidates three attempts at once —
the boxed card, the flex-wrap of pills, and the physics field. **The content is 75 short strings.
Wrapping each one in a bordered, filled, backdrop-blurred container makes 75 pieces of furniture,
and they compete with the constellation for the whole height of the section.** Making the
furniture float, cluster and jostle made it *more* prominent, not less. The problem was never the
arrangement of the containers; it was that there were containers.

So the words are set as words. Group label, a hairline that fades to the right, and a run of terms
flowing like prose. Nothing else.

### What survived from the pills
The **brand colour**, which is the only information those little dots were carrying. An item with
an explicit accent wears it as its text colour; everything else is warm white
(`rgba(255,242,234,0.7)`). The coloured terms punctuate the run the way the coloured dots
punctuated the grid — CUDA green, Claude orange, GLM blue — and there are few enough of them that
they read as emphasis rather than decoration.

### Three things that had to be got right

**Brand colours are not text colours.** OpenAI's `#412991` is fine as an 8px dot with a border
around it and nearly invisible as a word on near-black. `legible()` blends each accent toward the
page's warm white in 12% steps until it clears a relative-luminance floor of `0.2`, and stops.
Only OpenAI's purple actually moves (`#412991 → #8d79b5`); NVIDIA's green, Anthropic's orange and
Google's lavender already clear it and come back untouched. A flat 40% tint would have washed all
four to the same pastel and the distinctions would have stopped meaning anything.

**The separator.** Left as a free-floating `·` between terms, a wrap started lines with
"· HTML · CSS". Binding term-and-dot together with `whitespace-nowrap` fixed that and introduced a
much worse bug: with no whitespace text node anywhere in the list, **there were no soft-wrap
opportunities at all** and the run ran straight off the right edge of the page. The answer is
typographic, not structural: a no-break space glues the dot to the word before it, and an ordinary
space after the dot is the line's only break point. A wrap now leaves the dot at the end of the
line it belongs to.

**`display: inline`, not `inline-block`.** An inline-block is an atomic inline, and Chrome breaks
between it and a following no-break space — which put a stray dot at the start of the line after
"Muse Glimmer" even with the nbsp in place. As a plain inline box the normal text-breaking rules
apply. That rules out `transform` for the hover lift, so the lift is `position: relative; bottom`,
which does work on an inline box.

Two smaller ones: `word-spacing: 0.2em` on the list gives the dots room, and has to be reset to
`normal` on each term or it pulls "Claude Code" and "Muse Glimmer" apart until they read as two
entries each. And Cursor, Grok and Ollama lost their grey accent — the README gave them `#000`,
which was substituted with a grey when it was only a dot, but a grey *word* in a run of white ones
reads as "lesser", which is not what a black brand mark means.

### Motion
None. No entrance, no drift, no scroll reveal — the terms are simply there. Only the term under
the cursor responds: it takes its colour, gains a halo, and lifts 2px. Hover and keyboard focus
are the same CSS rule; `prefers-reduced-motion` drops the lift and keeps the colour.

Stripping the panels off was always in service of the constellation. This is the version that lets
it be the only thing alive on the page.

### Verified
`1440 / 1000 / 700 / 375`: 75 terms in 5 groups, **0 orphaned separators**, 0 terms wider than
their list, no horizontal overflow, no console errors. Type scales `clamp(18px, 2.05vw, 25px)`.

`BubbleField.tsx` is deleted. `Bubble.tsx` stays — the GitHub section still uses it for the
language legend, where a chip is genuinely a key to the bar directly above it rather than a
container around a word.

---

## Making it work as a portfolio, not just as a page (12 Sep 2026)

The site had been optimised for one thing — looking good in the first screenshot — and it had got
there. What it could not do was **argue for Gabe**. A stranger landed on a wordmark and a starfield
and had no way to learn what he does, whether he built the things in the tiles, or how to reach
him. Four changes, all of them information rather than decoration.

### 1. Two lines under the wordmark
```
GPU CLOUD · NATIVE APPLE APPS · CREATIVE TECH
CURRENTLY  Massed Compute ↗  NVIDIA GPU cloud — recipes, marketplace, design
```
Mono, 11–13px, well below the serif. The "no text, all visual" direction from 11 Sep stands for the
*body* of the page; it cannot stand for the one sentence that says who this is. A portfolio has
about three seconds to answer "what does this person do" before the reader decides how hard to
look, and the answer was previously 13px grey, halfway down, inside the GitHub card.

Both lines are lifted from Gabe's own profile README, so the site and the GitHub page say the same
thing rather than two slightly different things.

**Massed Compute is a "currently" line, not a fourth tile.** It's the most serious work on the
page and it was invisible — but it's a job, not a personal build, and putting it in the project row
would have implied he built the company's site. The line is honest about what it is and lands in
the first three seconds, which is where it does the most good.

### 2. The tiles say what he did
Each tile was a screenshot, a name and a host. Nobody could tell whether he built the thing or
skinned it. `role` and `status` were already in `projects.ts` and had never been rendered; a new
`blurb` field carries one present-tense line each. (`summary` stays, unused by the tile — it is two
sentences written for a case-study layout that no longer exists, and at tile width it wraps to five
lines nobody reads.)

```
Gcoolers
gcoolers.com · Author and maintainer · v3.06 · MIT
Fan curves and live temperatures for Apple Silicon, entirely in user space.
```

### 3. A held slot for LinkedIn
Gabe has no profile yet and asked for the slot to be built. `LINKEDIN_URL` at the top of
`Navbar.tsx` is an empty string; the button — icon, label, sizing, hover, focus ring — renders only
when it isn't. **The live site never carries a dead link, and turning it on is one line.**

Still open: there is no contact path on the site at all. GitHub is the only outbound personal link,
which is where a client who likes the work has to give up. Flagged twice now.

### 4. Effects, in the site's own language

**The cursor's light pool over the index.** The term under the pointer goes fully hot, its
neighbours warm in proportion to distance, and the pool travels with the cursor — the constellation's
own cursor gravity, applied to type. A plain `:hover` lights one word and leaves seventy-four inert,
which on a page whose entire background reacts to the pointer makes the type read as a deader layer.

| | |
|---|---|
| reach | `178px` |
| falloff | `(1 - d/r) ^ 1.75` — the exponent is what gives the pool a soft edge rather than a disc |
| smoothing | a `140ms linear` CSS transition on the derived properties, not a JS lerp |
| cost | one custom property per term; ~7 of 75 terms are non-zero at any moment |

The loop writes exactly one number per term — `--w`, 0 to 1 — and every colour, glow and offset
derives from it in CSS. Centres are measured once, on `fonts.ready`, and on resize; never in the
loop. It runs only while the pointer is inside the section, and not at all on a device that fails
`(hover: hover) and (pointer: fine)`.

Two details worth keeping: the CSS transition is what supplies the trailing smoothness, so there is
no easing code at all; and `:focus-visible` needs `--w: 1 !important` to beat the inline value the
loop writes every frame — an author `!important` is the only thing that outranks an inline
declaration.

**Heat through the wordmark, once.** The background is three copies of the resting palette side by
side (`background-size: 300%`) with a saturated `#FF8A3C` core built into the middle one, and the
sweep is `background-position` travelling `0% → 100%` over 1.8s after a 0.75s delay. It ends *on*
the last third, so the resting appearance is the animation's own final keyframe and cannot drift
out of sync with it.

One element, one animation, no duplicated text node — which matters, because the wordmark breaks
into two lines on narrow screens and any `content: attr()` overlay would flatten it to one. The
bloom is a `text-shadow` rather than a `drop-shadow` filter because **framer-motion owns `filter`
on that element** (it animates the entrance blur) and would clobber it; `text-shadow` paints the
glyph silhouette even under a transparent fill, so it works with `background-clip: text`.

Direction of travel is the easy thing to get backwards: increasing `background-position` slides the
window right across the image, so a feature in the middle of the image enters at the left edge and
exits right. Left-to-right sweep means `0% → 100%` with the resting palette at the **end**.

### Verified
`1440 / 375`, plus `prefers-reduced-motion`: 60fps with the pointer live in the field, no console
errors, no horizontal overflow at any width. Reduced motion reports `animation-name: none` on the
wordmark and still rests on the correct third. The nav reports zero links without an `href`.

---

## LinkedIn is live, and the separator trap bit a second time (12 Sep 2026)

`LINKEDIN_URL` in `Navbar.tsx` is now `https://www.linkedin.com/in/gabemillsmc/` and the button it
was holding a slot for renders. The site finally has a contact path that isn't "go to GitHub and
hope for an email". The conditional stays exactly as it was — empty the string and the button
disappears cleanly rather than serving a dead link.

Bar measures 267px with all three pills and fits at a 320px viewport, so no responsive work was
needed.

### The bug worth recording
Adding the hero's positioning line, I wrapped each discipline in `whitespace-nowrap` and separated
them with margin-spaced dots. **Margins make visual space but no soft-wrap opportunity**, so with
no whitespace text node anywhere in the line the whole thing became unbreakable and ran off both
edges at 375px — rendering as "CLOUD · NATIVE APPLE APPS · CREATIVE T".

This is the identical mistake made in the stack index two hours earlier, and the fix is the same
one: **a no-break space glues the dot to the phrase before it, an ordinary space after the dot is
the only break point.** Inner nbsp inside each phrase (`GPU cloud`) keeps the disciplines
whole, so 375 now breaks between them, never through one.

### Why the check didn't catch it
The verifier tested `documentElement.scrollWidth > clientWidth`. The hero is `overflow-hidden`, so
a line running off its edge is *clipped*, not scrolled — the page reported no overflow while text
was visibly missing. **A page-level overflow check cannot see inside a clipping container.**

`nav.mjs` now walks `getClientRects()` on every text run in the hero, the tiles and the index and
compares each box against the viewport directly. That catches clipped text, which is the failure
mode that actually happens on a page built out of `overflow-hidden` sections.

### Verified
`1440 / 700 / 375 / 320`: zero clipped text runs, three nav links all with an `href`, nav bar inside
the viewport at every width, no console errors.

**Unverified, and can't be from here:** LinkedIn serves bots an auth wall, so the profile URL was
taken as given rather than fetched. Worth opening once in a logged-out browser.
