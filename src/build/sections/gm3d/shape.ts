/**
 * Gabe's GM monogram as clean 2D outlines, reconstructed from /logo-gm.webp (510 x 300).
 * There is no vector source, so every number here was measured off the logo (edge map at 3x,
 * then checked side by side against the image). Units are logo pixels, y DOWN.
 *
 *   G   one C-shaped band: a semicircular bowl on the left (outer R 125.5, inner r 74.5, the
 *       inner centre 7 px right so the bowl is a touch heavier on the left, as drawn), a top arm
 *       ending in a slanted cut, and a bottom arm whose end is cut at 45 degrees, parallel to
 *       the chevron it tucks under.
 *   M   one stroke: the G's crossbar (45-degree left end) runs right, drops down a 45-degree
 *       chevron to the V, climbs the wide rising arm to a sharp tip and comes down the tall
 *       right stem. The bar, chevron and M are a single piece, as in the logo.
 */

export type Pt = [number, number];

/** points along a circle (y-down), from angle a0 to a1 in degrees, excluding a0 */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** outer bowl R, inner bowl r, shared centre line y */
const CY = 151.5;
const OUT = { cx: 143, r: 125.5 };
const INN = { cx: 150, r: 74.5 };

export function gmOutlines(arcSegments = 80): Pt[][] {
  const top = CY - OUT.r; // 26
  const bot = CY + OUT.r; // 277
  const itop = CY - INN.r; // 77
  const ibot = CY + INN.r; // 226
  const G: Pt[] = [
    [272, top],
    [OUT.cx, top],
    // outer bowl: top -> left -> bottom (270 deg down to 90 deg, y-down)
    ...arc(OUT.cx, CY, OUT.r, 270, 90, arcSegments),
    [263, bot],
    [263, 260],
    [229, ibot], // the 45-degree cut, parallel to the chevron
    [INN.cx, ibot],
    // inner bowl: bottom -> left -> top
    ...arc(INN.cx, CY, INN.r, 90, 270, Math.round(arcSegments * 0.8)),
    [316, itop],
  ];
  // the crossbar, chevron and M: lines at 45 degrees (x - y = c, x + y = c)
  const M: Pt[] = [
    [130, 133],
    [277, 133],
    [323.5, 179.5], // the notch: x - y = 144 meets x + y = 503
    [483, 20], // the tip of the right stem
    [483, bot],
    [432, bot],
    [432, 166], // rising arm underside x + y = 598 meets the stem
    [331.5, 266.5], // the V: x - y = 65 meets x + y = 598
    [238, 173],
    [167, 173],
  ];
  return [G, M];
}

/** logo-pixel bounds of the outlines (for centring) */
export const GM_BOUNDS = { x0: 17.5, x1: 483, y0: 20, y1: 277 };
