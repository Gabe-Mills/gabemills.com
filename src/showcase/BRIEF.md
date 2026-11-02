# Showcase brief (read before touching anything)

gabemills.com, branch `intro-engraved`. This becomes Gabe's NEW portfolio: the engraved scroll
intro (`src/intro`, see `src/intro/CONTRACT.md`) and then this showcase, which must present
**everything the original site shows**, drawn as engraved comic pages in the intro's palette.
The intro ends by fading to the ground colour `#080605`, and the Cover starts on that ground.

## Direction (fixed)
Engraved woodcut comic, matching the intro's frames (see `~/Developer/Projects/Active/vespro/shots/intro/scroll_sheet.jpg`
and `scroll_m_sheet.jpg`). It's a comic book's pages: paper panels with ink borders, a paper gutter ring
and a hard ember offset shadow on the dark ground. Narration boxes, stamped labels, tones drawn with
hatching (never gradients or blur). Instrument Serif for display, JetBrains Mono for labels, Inter for body.
Colours: ground `#080605`, paper `#F1E9DE`, ember `#E4692C`, lit ember `#FFB15E`, hot `#FFC46B`, dim `#9C8D86`.
Shared classes are in `src/showcase/showcase.css`: `.sc-panel(--ink|--ember)`, `.sc-hatch*`,
`.sc-kicker`, `.sc-title`, `.sc-caption`, `.sc-chip`, `.sc-btn(--paper)`, `.sc-reveal` + `useReveal()`.
Use them, and add section-specific CSS in your own `<Name>.css`. Tailwind is available too.
Motion: ink-in reveals, scroll-scrubbed where it matters. Nothing bouncy, no blur. Respect
prefers-reduced-motion. 60 fps. It must work from 360 px phones to 1920 px.

## Content inventory: all of it must appear somewhere (read from src/data, never retype)
- Identity: GM mark `/logo-gm.webp`, "GABE MILLS", positioning "GPU cloud · native Apple apps · creative tech",
  "Currently Massed Compute" (link https://massedcompute.com) + "NVIDIA GPU cloud — recipes, marketplace, design".
  Links: GitHub https://github.com/Gabe-Mills, LinkedIn https://www.linkedin.com/in/gabemillsmc/. → **Cover**
- Projects (`src/data/projects.ts`, all 3, every field: module, title, tag, role, status, summary, problem,
  outcome, stack[], blurb, url/host, shot/shotAlt). → **Work**
- GitHub (`src/data/github.ts`: profile handle/tagline/org/since, avatar `/github-avatar.png`, 4 repos with
  language + topics, the language breakdown by bytes, major + "other"). → **GitHub**
- Stack (`src/data/stack.ts`: 5 groups, every chip, chip accents, the gpu-benchmark link, stackCount). → **Stack**
- Footer (wordmark + Online). → BackCover (done by the lead)
No invented claims, numbers, testimonials or logos. No email address (removed on request).

## Engraved images
`public/showcase/engraved/` is produced by the engrave agent from the site's own images through the intro's
ink shader: `gcoolers.webp`, `leland.webp`, `afterglow.webp` (16:10, 1600 w), `avatar.webp` (square), plus
`*-m.webp` phone sizes. Use them with the originals (`/screenshots/shot-*.jpg`) for an "engraving develops
into the real screenshot" effect. Until they exist, reference the paths anyway and let the colour image show.

## Ownership — edit ONLY your files
| owner | files |
| --- | --- |
| lead | Showcase.tsx, showcase.css, useReveal.ts, BackCover.tsx, App.tsx, src/intro/* |
| engrave agent | tools/engrave/*, public/showcase/engraved/* |
| cover agent | src/showcase/Cover.tsx, Cover.css |
| work agent | src/showcase/Work.tsx, Work.css |
| github+stack agent | src/showcase/GitHub.tsx, GitHub.css, Stack.tsx, Stack.css |
Put requests for shared files in your final report. Don't commit or switch branches. Don't edit src/data or the old components.

## Verify
```bash
cd ~/Desktop/Coding/Projects/gabemills.com && npx vite --port <PORT> --strictPort &
```
Screenshot your section with Playwright (playwright-core lives in ~/Developer/Projects/Active/vespro; write a small script there in scripts/ that
loads `http://localhost:<PORT>/`, scrolls `document.querySelector('<your section selector>')` into view, waits, and screenshots).
Use the system Chrome: executablePath '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'. Shoot 1440x900
and 390x844, LOOK at the shots, and iterate. `npx tsc -b` and `npm run build` must pass, with no console errors. Stop your server.

---
# v2 — CALM PASS (supersedes the direction above where they conflict)

Gabe's feedback on v1 (2 Nov 2026): "the end feels very wonky, looks bad and too cluttered." The intro
stays loud; the showcase must be quiet and confident, so the work is the loudest thing on the page.

**Remove everywhere:** ember offset shadows, paper gutter rings, hatch-filled panel interiors, stamped chips,
giant outlined numbers, issue badges, spine text, "Contents" strips, kicker overload, letter-by-letter or
clip-wipe text reveals, anything rotated or overlapping.

**Keep:** the dark ground `#080605`, paper text `#F1E9DE`, ember `#E4692C` as the ONE accent (under 10% of the
area: links, a rule, an index number), Instrument Serif headlines, JetBrains Mono for small labels, Inter
for body, hairline dividers (1px rgba(241,233,222,.12)), and the **engraved images**. Engraved → real is the
signature, so it carries the visual weight.

**Layout:** a 12-column grid, max width 1200, left-aligned, generous whitespace (sections 160–200 px apart on
desktop), one idea per screen, nothing dense. Motion: a simple once reveal (opacity 0→1, translateY 16→0 over
0.8 s, ease-out); the image develop effect is the only scroll-scrubbed thing. Reduced motion means no motion.

**Sections:**
- Cover (id="top"): centred like the original hero. GM mark, a big "GABE MILLS" (subtle engraved hatch in
  the letters is fine), the positioning line, the Currently Massed Compute line, and GitHub / LinkedIn as quiet
  text-style buttons. No portrait, no contents, no badges. It fades up out of the intro's dark ground.
- Work (id="work"): VERTICAL, no pin. One project per ~viewport: a large 16:10 image (engraved print
  develops into the real screenshot, or its loop video, as it crosses the centre), then index "01" in ember,
  the title, a one-line blurb, a meta row (tag · role · status), Problem / Outcome as two short columns of
  body text, the stack as a plain mono list, and "Visit host ↗". Alternate the image left/right on desktop
  if it helps the rhythm, but keep it clean. Read all projects from projects.ts (there will be 4).
- GitHub (id="github"): one row with a small engraved avatar, handle, tagline, org and since. The repos as a
  clean 2×2 list with hairlines (name, description, language dot, topics as plain mono text). The language
  bar as a thin hatched bar with a quiet legend.
- Stack (id="stack"): 5 groups as columns of plain mono text (one item per line or ·-separated), the GPU
  items in ember, and the gpu-benchmark link. No chips.
- Back cover: one quiet row.
