# agent-build: the page that builds itself (read before touching anything)

Branch `agent-build` of gabemills.com. Gabe chose a FULL SWITCH to the style of reel DfMhyC7Ma31: every
section is constructed live as it scrolls into view, as if a team of AI agents were building it in a
design tool. Teardown + frames: `~/Developer/Projects/Active/insta-skills/posts/DfMhyC7Ma31/`
(TEARDOWN.md, sheets/s_01..10.jpg, zoom_sheet.jpg). Study them.

## The engine (lead-owned: src/build/engine.ts, BuildRoot.tsx, build.css)
Put `data-build="text|media|box|fade"` on elements. The engine writes `--e` (0..1) on each from ITS OWN
scroll position (build starts when its top reaches 96% of the viewport, and takes `data-span` of the
viewport, default 0.42), draws rulers/guides/selection box/W×H chip/typing caret/media placeholder on one
overlay canvas, and sends the cursor swarm (named after Gabe's AI tools) to work on it. Scrolling back
un-builds. Options: `data-delay` (viewport fraction; stagger siblings 0.03–0.08), `data-span`,
`data-mode="load"` (+ delay/span in seconds; the hero only), `data-label` (custom chip text), `data-orbit`
(the finale: the swarm circles it).
- `text` must be a single line or a short block; it clips open left to right (width is fit-content).
  Put it on headlines and short lines, not long paragraphs (use `fade` for body copy).
- `media` for images/videos/cards with a visual: a placeholder is dragged out, then the media fills it.
- `box` for panels/cards/rows: selection box + dimension chip, fades up.
- Keep the build count sane: about 6–14 build elements per screen. Too many = chaos (and cost).
- Never write per-frame styles yourself; let the engine own --e. CSS may read var(--e) inside your element.

## Look (fixed)
Ground #08080A, text #F3EEE8, dim #8E8A86, hairlines rgba(243,238,232,.1), ONE accent: ember #E4692C (lit
#FFB15E), the same as the GM mark. Design-tool chrome is blue (the engine's). Display: Anton, uppercase,
tight, statements ending in a period, key word in ember (`.bp-display em`). Body Inter, labels JetBrains Mono.
Shared classes: .bp-wrap .bp-section .bp-kicker .bp-display .bp-body .bp-link(--ghost). Tailwind is available.
Big, confident, editorial; generous negative space; no clutter (Gabe's past note: "too cluttered, wonky").

## Content: everything the site has, from src/data (never retype; no invented claims or numbers)
- Hero (#top): GM mark /logo-gm.webp, "Hello, I'm" / GABE MILLS, positioning "Software development · native
  Apple apps · creative tech", "Currently software development at Massed Compute ↗" (https://massedcompute.com),
  GitHub https://github.com/Gabe-Mills, LinkedIn https://www.linkedin.com/in/gabemillsmc/.
- Work (#work): projects.ts, all 4, every field; `loop` (1920x1200 webm+mp4 at /showcase/previews/<id>.*) + `shot`.
- Numbers: wall.ts `wallStats` (counted 20 Oct 2026: sites live, 90+ projects built, 27 AI models benchmarked,
  313 commits on GitHub) + `workedWith` names as a marquee (names only, no logos).
- Reel: "FROM IDEA. TO SHIPPED." with a montage of the 4 preview loops.
- GitHub (#github): github.ts profile, avatar, tagline, org, since, 4 repos, language bytes (majors + other).
- Stack (#stack): stack.ts, 5 groups, every item, accents, gpu-benchmark link, stackCount.
- Contact: "LET'S BUILD SOMETHING." + GitHub/LinkedIn (no email: removed on request), the "Online" status,
  finale statement from his tagline "MAKE IT USEFUL. THEN MAKE IT FEEL RIGHT." with data-orbit.

## Ownership: edit ONLY your files
| owner | files |
| --- | --- |
| lead | src/build/engine.ts, BuildRoot.tsx, build.css, BRIEF.md, src/App.tsx |
| hero+contact agent | src/build/sections/Hero.tsx, Contact.tsx, src/build/sections/hero.css, contact.css, public/build/portrait* |
| work+reel agent | src/build/sections/Work.tsx, Reel.tsx, work.css, reel.css, public/build/reel* |
| numbers+github+stack agent | src/build/sections/Numbers.tsx, GitHub.tsx, Stack.tsx, numbers.css, github.css, stack.css |
Request engine changes in your report. Don't commit or switch branches. Don't edit src/data or other components.

## Verify
`cd ~/Desktop/Coding/Projects/gabemills.com && npx vite --port <PORT> --strictPort &`, then from
~/Developer/Projects/Active/vespro: `node scripts/build-shot.mjs <PORT> <sectionId> <frac> [WxH] [waitMs]`, where
frac is where the section's top sits in the viewport (0.9 = just entering, 0.5 = mid-build, 0 = done). Shoot
each section mid-build AND finished at 1440x900 and 390x844, and LOOK. No horizontal overflow; `npx tsc -b` +
`npm run build` pass; no console errors; stop your server. Reduced motion shows the finished page.

---
# v2 (Gabe, 2 Nov 2026): "make scroll animation slower, less text and more animation and better mouse
# building animation, also have a wash color like the main color should be green, metallic green"

**Engine (done by lead, read src/build/engine.ts header):** builds are SLOWER (start as the top enters,
span 0.85 of the viewport). The crew now really builds:
- `text`: a cursor drags out a dashed text box, then the crew types it (CSS reads --m for typing).
- `box`: a marquee marks the landing spot, then the crew GRABS the element and DRAGS it in from the side
  (--dx/--dy/--dr set per element; `data-from="left|right|below"` to choose), drops it with a ripple.
  Use box for cards, rows, panels, badges, buttons, stats: it's the most "building" animation.
- `media`: the corner is pulled out, release click, an upload bar fills, then the media shows.
**Colour (done by lead in build.css):** metallic green wash. Tokens: --accent #3DBE80, --accent-lit #A8F0C8,
--accent-deep #1E6B49, --metal (a brushed gradient). Accent words: `.bp-display em` or `.bp-metal` get the
moving metal sheen. --ember/--glow are now aliases for green. Don't hardcode any orange; check your CSS.

**Your job now: LESS TEXT, MORE ANIMATION.**
- Cut visible copy by about half. Each section's default view: a headline, at most one short line, and
  the visuals. Long copy (problem/outcome, descriptions, labels) moves into reveal-on-hover/tap or a
  details toggle. ALL facts must still be on the page (accessible), just not on screen at once.
- More animation: favour `box` drag-ins and `media` builds over walls of text. Give each section one
  signature motion beyond the engine (scroll-linked parallax, a marquee, counters, a staggered grid of
  drag-ins, a video panel that scales up as you scroll). Transform/opacity only, rAF-free where CSS
  scroll timelines can do it; nothing per-frame that writes layout.
- Pace: about 5–9 build elements per screen, staggered with data-delay so the crew moves between
  them visibly instead of everything building at once. Sections can be taller to give the slower builds room.
- Keep the hero load sequence ~3 s (data-span seconds) and choreographed: the box draws, the name types,
  the portrait drags in, the buttons are dropped.
Verify as before (build-shot.mjs at several fracs, desktop + phone), plus `node scripts/build-perf.mjs
<PORT> 4 1440x900` in ~/Developer/Projects/Active/vespro. Every section p95 must be ≤ 17 ms.

---
# v3 (Gabe, 3 Nov 2026): "remove the grid line that goes over me, make it look more cinematic and dramatic,
# make the arrows at the end do something better, remove the AI dots like connecting and live. lets make this better"

**Remove everywhere:** status dots / pings / "live" / "online" / "connecting" indicators, tick rows, scan lines,
crop marks and corner brackets, and any decorative line or grid that crosses Gabe's portrait. Background grids
must never overlap the hero.

**Cinematic + dramatic (the new bar):**
- Deep blacks (#020504 at the edges), a strong vignette, and ONE key light per section: a green rim/back light or a
  soft volumetric beam (CSS gradient cones with blur ≤ 40px, slow drift). Darkness between sections, so each
  section reads like a shot: it emerges from black and returns to black.
- Scale contrast: huge headlines vs tiny mono labels; fewer, bigger moments; generous negative space.
- Slow camera moves: scroll-linked push-ins (scale 1.06 → 1), depth parallax on 2–3 layers, light sweeps across
  the metallic type, a slow reveal of media from darkness (brightness/contrast up, not a fade to grey).
- Calm UI chrome: no badges, chips or dots competing with the shot.
- Performance budget unchanged: transform/opacity/filter on small elements only; no full-screen animated
  blur or backdrop-filter; looping animations get paused off screen automatically (data-off).

**The ending (lead, engine):** at the finale, the whole cursor crew flies in and FORMS THE GM MONOGRAM, then holds
with a light shimmer. The pointer scatters them and they snap back. Mark the spot with an empty element
`<div data-formation aria-hidden="true">` sized about 420x250 desktop / 300x180 phone, placed where the logo
should appear. The contact owner places it.

---
# v4 (Gabe, 3 Nov 2026): "make it better, better spacing, better animations for the words, etc"

## Kinetic words (lead, src/build/Words.tsx): USE IT for every headline and key line
`<Words as="h2" className="bp-display ..." text={"SELECTED *WORK.*"} />`. Each word rises out of its own
masked line in sequence while the crew types; *starred* words get the metal sheen; "\n" breaks lines; the
element itself is the data-build="text" (don't add another). Optional delay/dur props order and pace it.
Don't hand-roll other headline reveals; consistency is the point. For one-word giant type (e.g. BUILDER,
90+), keep your bespoke effect.

## Spacing: measured by design-master's spacing-audit (583 findings)
`node ~/.claude/skills/design-master/scripts/spacing-audit.mjs http://localhost:<PORT>/` must come back clean
for your sections. The page failed on:
- **8 different left edges** (11–95 px at 1440). Rule: ONE content column. Everything aligns to the .bp-wrap
  left edge (100 px at 1440, 20 px at 390). Only deliberate full-bleed art (BUILDER, the marquee band, the
  reel video) may break it.
- **111 small texts, 106 monospace, 76 tiny tracked capitals.** Rule: minimum text size 14px (labels 13px only
  where truly secondary), body 16–18px Inter. Monospace at most ONE kicker per section plus numerals. Tracked
  capitals only for that kicker, 13px+, tracking ≤ .14em. Turn the rest into normal-case Inter.
- **Headlines over two lines** in Stack card titles: shorten or resize so card titles are one line.
- **1px rules** on stack card footers: remove; use spacing instead of lines.
## Rhythm (8 px scale)
Section padding 160 px desktop / 96 px phone. Kicker → headline 24 px. Headline → content 72 px desktop /
40 px phone. Grid gaps 32 desktop / 20 phone. Card padding 28 / 20. Type scale: H1 clamp(88px,13vw,200px),
H2 clamp(64px,9vw,148px), H3 32–40px, body 17px/1.6, small 14px. Line lengths ≤ 62ch.
