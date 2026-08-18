import type { Layer } from '@/app/types';
import { metresBetween, pixelToLatLon, solveGeoreference } from '@/lib/geoUtils';

// Pure geometry for "off-map edge indicators": when a marker's position —
// a team's TakPosition with onMap: false, or a Call.position whose x/y
// (re-derived from the layer's CURRENT georeference by resolveCallPinPercent
// in callPositionUtils.ts) now falls outside the image after a
// recalibration — sits outside the venue map image, this computes where to
// draw a "this way, N metres" badge at the image edge instead of just
// letting the marker vanish.
//
// Scope: this is about being off the IMAGE (percent outside [0,100]). A
// marker that is on the image but scrolled out of the viewport by zoom/pan
// is a different problem — it needs viewport state (scroll offset, zoom
// level) that this module deliberately knows nothing about — and is out of
// scope here.
//
// The one hard rule this module exists to enforce: it computes where to draw
// the BADGE, never a substitute for the marker's real position. Per the
// onMap: false convention documented in this repo's CLAUDE.md ("off-map
// fixes are recorded onMap: false rather than clamped, so the UI hides the
// marker instead of drawing it somewhere the unit demonstrably is not"),
// clamping the underlying x/y into the image would tell exactly that lie in
// pixel form. Nothing in this module writes back to a CallPosition or
// TakPosition — `edge` is a drawing coordinate only, computed fresh on every
// call, same derive-on-read discipline geoUtils.ts uses for Post/CallPosition.

export interface OffMapGeo {
  /** True compass bearing from the image centre to the target, degrees
   *  clockwise from north, normalised to [0, 360). */
  bearingDeg: number;
  /** 16-point compass abbreviation of bearingDeg, e.g. 'N', 'NNE', 'SW'. */
  compass: string;
  /** Ground distance from the image centre to the target, metres. */
  distanceMetres: number;
}

export interface OffMapIndicator {
  /** Where to DRAW the badge: the point on the image boundary (the [0,100]
   *  square) where the ray from the image centre to the target crosses out.
   *  This is a drawing position only and must never be written back to a
   *  CallPosition or TakPosition. */
  edge: { x: number; y: number };
  /** Rotation for the arrow, degrees clockwise from screen-up. Always
   *  available, because direction on the image plane needs no georeference. */
  screenAngleDeg: number;
  /** Real-world bearing and distance, or null when the layer has no solvable
   *  georeference. */
  geo: OffMapGeo | null;
}

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
];

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 16-point compass abbreviation nearest a bearing in [0, 360). */
function compassFromBearing(bearingDeg: number): string {
  const index = Math.round(bearingDeg / 22.5) % COMPASS_POINTS.length;
  return COMPASS_POINTS[index];
}

/**
 * Ray/rectangle intersection: from the image centre (50, 50), in direction
 * (dx, dy), against the boundary of the [0, 100] percent-space square.
 * (dx, dy) is never (0, 0) here — offMapIndicator only calls this once it
 * has confirmed the target is off the image, so at least one of x/y is
 * already outside [0, 100] and the centre-relative delta is nonzero.
 *
 * Computed in raw percentage space (not aspect-corrected): this answers
 * "where does the ray cross the edge of the percent-space square", which is
 * exactly the space the badge gets drawn in. The aspect correction that
 * screenAngleDeg needs is a different question (which direction, in real
 * screen proportions, does the ray point) and would corrupt this one if
 * applied here.
 *
 * Guards dx === 0 / dy === 0 explicitly rather than letting a division by
 * zero fall through to a JS-native Infinity, so an exactly-horizontal or
 * exactly-vertical ray is handled by the same code path as every other
 * direction instead of relying on IEEE 754 semantics to happen to work out.
 */
function edgeIntersection(dx: number, dy: number): { x: number; y: number } {
  let tX: number;
  if (dx > 0) {
    tX = (100 - 50) / dx;
  } else if (dx < 0) {
    tX = (0 - 50) / dx;
  } else {
    tX = Infinity; // vertical ray: never crosses a left/right edge
  }

  let tY: number;
  if (dy > 0) {
    tY = (100 - 50) / dy;
  } else if (dy < 0) {
    tY = (0 - 50) / dy;
  } else {
    tY = Infinity; // horizontal ray: never crosses a top/bottom edge
  }

  // The ray exits the square at whichever pair of parallel edges it reaches
  // first (the smaller of the two parametric distances).
  const t = Math.min(tX, tY);
  return { x: 50 + t * dx, y: 50 + t * dy };
}

/**
 * Given a marker's image-percentage position (which may lie outside
 * [0, 100] — see resolveCallPinPercent in callPositionUtils.ts and
 * TakPosition.onMap in app/types.ts, the two live sources of such a
 * position), computes where and how to draw an off-map edge indicator for
 * it. Returns null when the point is ON the image (x and y both within
 * [0, 100] inclusive) — callers get one function that answers both "is this
 * off-map" and "if so, where do I point", rather than needing a separate
 * on-map predicate before calling this.
 *
 * `imageAspect` (imageWidthPx / imageHeightPx) is mandatory, not optional,
 * because percent space is NOT isotropic: on a 2:1 map, 1% of width covers
 * twice the ground/screen distance of 1% of height. Computing the arrow's
 * angle directly from raw percentage deltas — skipping this correction —
 * points the arrow visibly wrong on any non-square map, so dx is scaled by
 * imageAspect before the atan2 that produces screenAngleDeg. `edge` is
 * deliberately NOT aspect-corrected (see edgeIntersection's doc comment):
 * only the angle needs it.
 *
 * screenAngleDeg and geo.bearingDeg are two different numbers and neither is
 * derived from the other. screenAngleDeg is direction on the image plane —
 * what the arrow icon must be rotated to, and it needs no georeference at
 * all. geo.bearingDeg is direction relative to true north — what a text
 * label should say. A georeference can rotate the image relative to north
 * (see the anti-similarity/affine solvers in geoUtils.ts), so the two only
 * coincide by accident; a north-up, unrotated map is the special case, not
 * the general one.
 *
 * geo is null when solveGeoreference can't solve the layer's georeference:
 * "40% of an unknown-scale image" is not a distance, so this refuses to
 * invent one from percentages. Direction on the image plane is still real
 * without any georeference at all, so screenAngleDeg is always returned.
 *
 * Distance is measured from the image centre's lat/lon (pixelToLatLon at
 * (50, 50)) to the target's lat/lon (pixelToLatLon at the given, possibly
 * out-of-range, percent) via metresBetween — the same tangent-plane
 * approach used everywhere else in geoUtils.ts, not a second projection.
 * Bearing is computed from the same two lat/lon points, using the transform's
 * own cosLat0 to scale the longitude delta into the same isotropic frame —
 * again the toLocalPlane formula, not a re-derivation of it.
 */
export function offMapIndicator(
  layer: Layer,
  percent: { x: number; y: number },
  imageAspect: number
): OffMapIndicator | null {
  const { x, y } = percent;
  if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
    return null;
  }

  const dx = x - 50;
  const dy = y - 50;

  const edge = edgeIntersection(dx, dy);

  // Screen-up is -y in percent space (y grows downward). atan2(dxScaled,
  // -dyScaled) therefore gives 0 for "straight up", 90 for "straight right",
  // matching "degrees clockwise from screen-up".
  const screenAngleDeg = normalizeDeg(radToDeg(Math.atan2(dx * imageAspect, -dy)));

  const transform = solveGeoreference(layer.georeference);
  let geo: OffMapGeo | null = null;
  if (transform) {
    const centre = pixelToLatLon(transform, 50, 50);
    // pixelToLatLon is not clamped (see its doc comment) — it happily
    // resolves a percent point outside [0,100] to the real lat/lon that
    // point represents, which is exactly what's needed here.
    const target = pixelToLatLon(transform, x, y);
    const distanceMetres = metresBetween(transform, centre.lat, centre.lon, target.lat, target.lon);

    // Same formula as geoUtils.ts's toLocalPlane, applied to the DIFFERENCE
    // between two points that share the transform's own tangent-plane
    // origin — lat0/lon0 cancel out of a difference, leaving just the
    // cosLat0 scaling. du = east component, dv = north component; a compass
    // bearing measured clockwise from north is atan2(east, north).
    const du = (target.lon - centre.lon) * transform.cosLat0;
    const dv = target.lat - centre.lat;
    const bearingDeg = normalizeDeg(radToDeg(Math.atan2(du, dv)));

    geo = { bearingDeg, compass: compassFromBearing(bearingDeg), distanceMetres };
  }

  return { edge, screenAngleDeg, geo };
}
