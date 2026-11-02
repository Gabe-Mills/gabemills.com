# Engraved scroll intro — contract (read before touching anything)

A scroll-driven prologue at the top of gabemills.com (branch `intro-engraved`). It uses the
engraved-woodcut technique from the VESPRO prototype (`~/Developer/Projects/Active/vespro`, see its
CONTRACT.md and `shots/full_story.jpg`) and the site's own palette. Five beats, each with its
own set, and **no motif repeats across beats**. After the last beat the canvas fades to the site
ground and the existing hero (GM mark + GABE MILLS) scrolls in. **Don't put the name or logo in
the intro.** The hero is the reveal.

Reference look: VESPRO shots in `~/Developer/Projects/Active/vespro/shots/` (full_story.jpg, play/*).
Original reference reel frames: `~/Developer/Projects/Active/insta-skills/posts/DfFzpXTR9AY/sheets/`.

## Palette (DESIGN.md) — the ink pass owns colour
| slot | colour | use |
| --- | --- | --- |
| `PAL.NEUTRAL` | paper `#F1E9DE` / ink `#080605` | most surfaces |
| `PAL.EMBER` (= RED) | `#E4692C` | the woodcut "red": skies, floors, big fills |
| `PAL.GLOW` (= ACCENT) | `#FFB15E` | light: beams, screens, LEDs, sparks |
| `PAL.HOT` | `#FFC46B` | rare highlights |
| `PAL.DIM` | `#9C8D86` | metal / secondary |
| `PAL.OXBLOOD` | `#5E2312` | deep ember shadows |
| `PAL.PAPER_FLAT` | paper, never hatched | panel borders |

For big flat colour fills use shade 0.75–0.9. Use shade below 0.3 only for real shadow. `angle:-1` on curved props, ≈π/2 on columns and racks, 0 on floors.

## Rendering (unchanged from VESPRO)
Scenes write the G-buffer via `inkMaterial`, `flatMaterial` and `cardMaterial` (src/intro/core/gbuffer.js), or a custom ShaderMaterial ending in `gl_FragColor = gbuf(shade, pal, angle, hatch)` using `GBUF_GLSL`. **Never output real colour.** No lights, no MeshStandardMaterial, no blending (alpha-test or dither only). `cardMaterial` maps pure red pixels to EMBER and pure yellow to GLOW, so the VESPRO art palette works as-is. Art lives in `public/intro/art/` and loads with `ctx.tex('art/<file>.png')`. Any image works as a card: photos and screenshots become engravings, because luminance drives shade.

## Scroll scene contract (`src/intro/scenes/<name>.js`) — different from VESPRO
```js
export function create(ctx) {
  // ctx: { THREE, gsap, engine, tex, cardPlane, makePanel, inkMaterial, flatMaterial, cardMaterial,
  //        PAL, COLORS, GBUF_GLSL, overlay, reduced, pointer {nx, ny}, flavour (fixed: GLOW) }
  return {
    scene, camera,
    enter() {},            // became the active scene (reset transient state)
    progress(p, dt) {},    // EVERY FRAME, p = smoothed scroll progress 0..1 through this beat
    update(dt, time) {},   // engine calls this every frame too: ambient-only motion (boil, flicker, drift)
    pointer(nx, ny) {},    // optional parallax, small
    exit() {}, dispose() {},
  };
}
```
- **progress(p) must be a pure function of p.** Scrolling back up rewinds. Precompute paths; no "finish" promises, no one-shot tweens tied to thresholds that can't reverse. The fluid sim is the one exception, since it's ambient. Its splats are driven by scroll movement.
- Pace it: p 0→0.15 establish, 0.15→0.85 the action, 0.85→1 resolve into something that wipes well. The wipe covers the edges automatically.
- Captions are DOM, bottom-left, and handled by the story. Keep the lower-left ~480×140 px reasonably calm.
- Nothing allocates per frame. Dispose everything. With `ctx.reduced`, the intro isn't mounted at all.
- Phones: portrait 390×844 must frame the subject (check `camera.aspect` and pull back or re-frame). 60 fps target on a MacBook. Keep draw calls sensible.

## Beats (src/intro/beats.js)
| id | scene | caption | owner |
| --- | --- | --- | --- |
| line | hand.js (+ lib/fluid.js) | Every build starts with one line. | scene agent A |
| cloud | racks.js | By day: GPU cloud at Massed Compute. | scene agent B |
| apps | devices.js | By night: native Apple apps. | scene agent C |
| motion | rise.js | And creative tech that moves. | scene agent D |
| open | shatter.js (+ lib/fracture.js) | Then the walls come down. | scene agent E |

Edit ONLY your files (your scene, any new `src/intro/scenes/lib/<yourname>-*.js`, and art you add under `public/intro/art/`). Lead owns core/, story.js, beats.js, index.js, intro.css and the React side. Request changes in your report. Don't commit. Don't touch other site files.

No logos or trademarks (no Apple logo, no Massed Compute logo), and no invented claims or numbers.

## Verify
```bash
cd ~/Desktop/Coding/Projects/gabemills.com && npx vite --port <PORT> --strictPort &
cd ~/Developer/Projects/Active/vespro && node scripts/intro-shot.mjs <PORT> <beatId> <p> [t] [WxH]
#   e.g. node scripts/intro-shot.mjs 5402 cloud 0.5 ; ... cloud 0.5 1.4 390x844   -> shots/intro/
```
Shoot p = 0, 0.25, 0.5, 0.75, 1.0 on desktop, plus 0.5 at 390x844. LOOK at them. Check that scrubbing p back and forth gives identical frames (rewind). At the end, `npm run build` must pass in the site repo, there must be no console errors, and stop your server.

---
## Showcase beats (added 2 Nov 2026)
After `open`, the story continues with `cover` (the name, anchor #top) and one beat per project
(`work-prism`, `work-leland`, `work-ricochet`, `work-gcoolers`; anchor #work on the first). Gabe asked for
the showcase to "look so much cooler and work with the animated scroll animation like the rest of the site".
- Scene modules get `create(ctx, beat)`. Beat fields include `project` (an id in src/data/projects.ts).
- Use `scenes/lib/project-frame.js` (lead-owned; read it): `makeProjectFrame(ctx, project, {width, index,
  total, side})` gives the engraved framed print (`frame.print`, add it to your scene), the DOM develop layer
  (the real loop video shows through widening hatch lines) and the project card (DOM, side 'left'|'right').
  Call `frame.update(p, camera, { develop, cardIn })` at the END of progress(p), after the camera is set.
  `cardCurve(p)` and `smooth()` are exported. The reference implementation is `scenes/project-prism.js` as first written.
- Layout: the card takes ~34vw on its side on desktop (left for odd indices, right for even); on phones
  (<760 px) it sits at the bottom, roughly the lower 42% of the screen. Frame the print on the OTHER side
  (desktop) or in the upper half (phone), with no overlap. Keep the print roughly facing the camera while
  develop > 0 (the DOM layer is an axis-aligned rect).
- Choreography (pure function of p): 0→0.3 the camera travels through YOUR themed engraved set toward the
  print; 0.35→0.65 it settles and the print develops (develop 0→1); the card is in roughly 0.35→0.9; 0.85→1
  the camera moves on or the set does something for the wipe (develop back toward 0 is fine).
- Each project has its OWN set themed to what it is. Don't reuse intro motifs (no columns, racks,
  hands, desks/devices, light-beam levitation, fractures).
