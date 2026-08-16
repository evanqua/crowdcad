import type { ControlPoint, Georeference, Layer, Post } from '@/app/types';

// Pure math for converting between venue-map image coordinates (percentages
// of image width/height, 0-100) and real-world lat/lon, given a set of
// user-placed ControlPoints on a Georeference.
//
// lat/lon is NOT a Euclidean plane: a degree of longitude covers less ground
// than a degree of latitude by a factor of cos(latitude). To fit a linear
// (similarity or affine) transform between image-percentage space and
// geographic space, we first project lat/lon into a local tangent-plane
// frame (u, v) centered on the mean control point, which is isotropic
// (equal ground distance per unit in both axes). This is a flat-earth
// approximation that is accurate at venue scale (up to a few kilometers)
// and breaks down at large scale or near the poles.

export interface GeoTransform {
  a: number;
  b: number;
  c: number; // (x%, y%) -> u  =>  u = a*x + b*y + c
  d: number;
  e: number;
  f: number; // (x%, y%) -> v  =>  v = d*x + e*y + f
  lat0: number;
  lon0: number;
  cosLat0: number; // local tangent-plane origin
}

/**
 * Project a lat/lon into the local isotropic tangent-plane frame (u, v)
 * centered on (lat0, lon0). u grows east, v grows north, both in "degrees
 * of latitude"-equivalent units.
 */
function toLocalPlane(
  lat: number,
  lon: number,
  lat0: number,
  lon0: number,
  cosLat0: number
): { u: number; v: number } {
  return {
    u: (lon - lon0) * cosLat0,
    v: lat - lat0,
  };
}

/**
 * Inverse of toLocalPlane: recover lat/lon from local-plane (u, v).
 */
function fromLocalPlane(
  u: number,
  v: number,
  lat0: number,
  lon0: number,
  cosLat0: number
): { lat: number; lon: number } {
  return {
    lat: lat0 + v,
    lon: lon0 + u / cosLat0,
  };
}

/** Determinant of a 3x3 matrix given as row-major flat array. */
function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

/**
 * Solve the 3x3 normal-equations system M * coeffs = target via Cramer's
 * rule. Returns null if M is singular (|det| < 1e-12).
 */
function solve3x3(m: number[][], target: number[]): number[] | null {
  const d = det3(m);
  if (Math.abs(d) < 1e-12) {
    return null;
  }

  const coeffs: number[] = [];
  for (let col = 0; col < 3; col++) {
    const mCopy = m.map((row) => row.slice());
    for (let row = 0; row < 3; row++) {
      mCopy[row][col] = target[row];
    }
    coeffs.push(det3(mCopy) / d);
  }
  return coeffs;
}

/**
 * Solve for the GeoTransform that maps image-percentage coordinates to
 * local tangent-plane coordinates (and back to lat/lon), given a
 * Georeference's control points.
 *
 * - Fewer than 2 control points (or no georeference at all): null.
 * - Exactly 2 points: an anti-similarity ("conjugate") transform —
 *   reflection + rotation + uniform scale + translation, 4 DOF, no shear —
 *   solved directly via complex numbers. This orientation-reversing form is
 *   required because image-percentage space (x east, y DOWN the image) and
 *   geographic space (lat increases UP) have opposite handedness; a plain
 *   orientation-preserving similarity cannot represent that and would
 *   silently substitute a 90-degree rotation instead of a reflection.
 * - 3 or more points: a full least-squares affine transform (6 DOF,
 *   includes shear / anisotropic scale), solved via normal equations. This
 *   general form naturally captures either orientation, so it needs no
 *   special-casing.
 */
export function solveGeoreference(georef: Georeference | undefined): GeoTransform | null {
  if (!georef || !georef.controlPoints || georef.controlPoints.length < 2) {
    return null;
  }

  const points = georef.controlPoints;

  // Local tangent-plane origin: mean lat/lon of the control points.
  let latSum = 0;
  let lonSum = 0;
  for (const p of points) {
    latSum += p.lat;
    lonSum += p.lon;
  }
  const lat0 = latSum / points.length;
  const lon0 = lonSum / points.length;
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);

  if (Math.abs(cosLat0) < 1e-12) {
    // Near the poles the tangent-plane approximation degenerates.
    return null;
  }

  const local = points.map((p) => ({
    ...toLocalPlane(p.lat, p.lon, lat0, lon0, cosLat0),
    x: p.x,
    y: p.y,
  }));

  if (points.length === 2) {
    return solveSimilarity(local, lat0, lon0, cosLat0);
  }

  return solveAffine(local, lat0, lon0, cosLat0);
}

function solveSimilarity(
  local: { x: number; y: number; u: number; v: number }[],
  lat0: number,
  lon0: number,
  cosLat0: number
): GeoTransform | null {
  const [p1l, p2l] = local;

  // p = x + i*y (image-percentage space), q = u + i*v (local tangent plane)
  const p1x = p1l.x;
  const p1y = p1l.y;
  const p2x = p2l.x;
  const p2y = p2l.y;

  const dpx = p2x - p1x;
  const dpy = p2y - p1y;
  const pMagSq = dpx * dpx + dpy * dpy;

  if (pMagSq < 1e-9 * 1e-9) {
    // Coincident control points — cannot determine rotation/scale.
    return null;
  }

  const q1u = p1l.u;
  const q1v = p1l.v;
  const q2u = p2l.u;
  const q2v = p2l.v;

  const dqu = q2u - q1u;
  const dqv = q2v - q1v;

  // Image-percentage space is orientation-REVERSING relative to geographic
  // space: x increases east while y increases DOWN the image, but latitude
  // increases UP. A plain similarity q = z*p + w only represents
  // orientation-PRESERVING maps (det > 0) and cannot express this, so we
  // solve the anti-similarity (conjugate) form instead:
  //   q = z * conj(p) + w
  // whose linear part has determinant -(zRe^2 + zIm^2) < 0 — a reflection
  // composed with rotation + uniform scale. Still 4 DOF, still exactly
  // determined by 2 points.
  //   z = dq / conj(dp), where conj(dp) = dpx - i*dpy
  //   (division by complex number w: z = dq * conj(w) / |w|^2, and here
  //   conj(w) = conj(conj(dp)) = dp, so z = dq * dp / |dp|^2)
  const zRe = (dqu * dpx - dqv * dpy) / pMagSq;
  const zIm = (dqu * dpy + dqv * dpx) / pMagSq;

  // w = q1 - z*conj(p1)
  // z*conj(p1) = (zRe + i*zIm) * (p1x - i*p1y)
  //            Re = zRe*p1x + zIm*p1y
  //            Im = zIm*p1x - zRe*p1y
  const zConjP1Re = zRe * p1x + zIm * p1y;
  const zConjP1Im = zIm * p1x - zRe * p1y;
  const wRe = q1u - zConjP1Re;
  const wIm = q1v - zConjP1Im;

  return {
    a: zRe,
    b: zIm,
    c: wRe,
    d: zIm,
    e: -zRe,
    f: wIm,
    lat0,
    lon0,
    cosLat0,
  };
}

function solveAffine(
  local: { x: number; y: number; u: number; v: number }[],
  lat0: number,
  lon0: number,
  cosLat0: number
): GeoTransform | null {
  // Normal equations for least-squares fit of [x_i, y_i, 1] * coeffs = target_i
  // M^T M * coeffs = M^T target
  let sxx = 0;
  let sxy = 0;
  let sx = 0;
  let syy = 0;
  let sy = 0;
  let sN = 0;
  let sxu = 0;
  let syu = 0;
  let su = 0;
  let sxv = 0;
  let syv = 0;
  let sv = 0;

  for (const p of local) {
    sxx += p.x * p.x;
    sxy += p.x * p.y;
    sx += p.x;
    syy += p.y * p.y;
    sy += p.y;
    sN += 1;
    sxu += p.x * p.u;
    syu += p.y * p.u;
    su += p.u;
    sxv += p.x * p.v;
    syv += p.y * p.v;
    sv += p.v;
  }

  const mtm = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, sN],
  ];

  const abc = solve3x3(mtm, [sxu, syu, su]);
  const def = solve3x3(mtm, [sxv, syv, sv]);

  if (!abc || !def) {
    // Degenerate: control points are collinear or coincident.
    return null;
  }

  const [a, b, c] = abc;
  const [d, e, f] = def;

  return { a, b, c, d, e, f, lat0, lon0, cosLat0 };
}

/**
 * Convert an image-percentage (x, y) coordinate into a lat/lon, using a
 * previously solved GeoTransform. Results are not clamped to 0-100 in
 * image space or to any geographic bound — a real position can legitimately
 * fall outside the map image.
 */
export function pixelToLatLon(t: GeoTransform, x: number, y: number): { lat: number; lon: number } {
  const u = t.a * x + t.b * y + t.c;
  const v = t.d * x + t.e * y + t.f;
  return fromLocalPlane(u, v, t.lat0, t.lon0, t.cosLat0);
}

/**
 * Convert a lat/lon into an image-percentage (x, y) coordinate, using a
 * previously solved GeoTransform. This inverts the 2x2 linear part
 * [[a,b],[d,e]] plus translation (c,f).
 *
 * solveGeoreference already rejects transforms whose linear part is
 * singular, but as a defensive guard, if the 2x2 determinant is still
 * ~0 (|det| < 1e-12) this returns { x: NaN, y: NaN } rather than dividing
 * by (near) zero.
 */
export function latLonToPixel(t: GeoTransform, lat: number, lon: number): { x: number; y: number } {
  const { u, v } = toLocalPlane(lat, lon, t.lat0, t.lon0, t.cosLat0);

  const det = t.a * t.e - t.b * t.d;
  if (Math.abs(det) < 1e-12) {
    return { x: NaN, y: NaN };
  }

  const uc = u - t.c;
  const vf = v - t.f;

  const x = (uc * t.e - t.b * vf) / det;
  const y = (t.a * vf - uc * t.d) / det;

  return { x, y };
}

/**
 * Ground distance, in metres, represented by one degree of latitude — and,
 * by construction of the local tangent-plane frame (see toLocalPlane), one
 * unit of the u/v axes too. This is the standard WGS84 mean (1 deg lat ~=
 * 111.32 km); like the rest of this module's flat-earth tangent-plane model,
 * it is a venue-scale approximation and does not account for the small
 * latitude-dependent variation in true meridional arc length.
 */
export const METRES_PER_DEGREE_LATITUDE = 111320;

/**
 * The largest georeferenceResiduals().maxMetres considered acceptable for
 * publishing geospatial data (post locations, exports, etc.) derived from a
 * georeference. Beyond this threshold, a "successfully georeferenced" UI
 * state would be actively misleading: everything computed from the
 * transform could be tens of metres from its real position while looking
 * exactly as authoritative as a tight fit. A bad georeference that LOOKS
 * trustworthy is worse than one that visibly failed to solve at all, so
 * callers should treat residuals above this as a hard warning, not a soft
 * one.
 */
export const MAX_ACCEPTABLE_RESIDUAL_METRES = 25;

export interface GeoreferenceResiduals {
  /** Per control point, in original order: distance in metres between the
   *  operator-entered lat/lon and where the fitted transform actually puts
   *  that point's (x%, y%). */
  perPoint: number[];
  maxMetres: number;
  rmsMetres: number;
}

/**
 * Measures how well the fitted GeoTransform actually reproduces the control
 * points it was fit from, in metres.
 *
 * This distinction is the whole reason the readout matters:
 *
 * - With exactly 2 control points, solveGeoreference fits its 4-DOF
 *   anti-similarity transform directly from those 2 points — a determined
 *   system, not a least-squares one, so the fit passes through both points
 *   exactly. Residuals here are ~0 up to floating-point noise. This function
 *   still computes and reports them (rather than special-casing them away)
 *   so callers don't need their own 2-vs-3+ branch just to know that.
 * - With 3+ control points, solveGeoreference fits a 6-DOF least-squares
 *   affine transform to an overdetermined system, which generally does NOT
 *   pass through every point exactly. A large residual there means the
 *   control points aren't consistent with a single affine map — an operator
 *   mistyped a lat/lon, or the venue map isn't a clean affine projection
 *   across the span the points cover. Without surfacing this number, a bad
 *   multi-point fit looks identical in the UI to a good one.
 *
 * Distances are measured in the SAME local tangent-plane frame the solver
 * fits in (see toLocalPlane and the module doc comment above), for
 * consistency with what the transform is actually optimizing: both the
 * fitted and the operator-entered positions are projected to (u, v) using
 * the transform's own lat0/lon0/cosLat0, the Euclidean distance between them
 * is taken in degree-equivalent units, then scaled to metres via
 * METRES_PER_DEGREE_LATITUDE.
 *
 * Returns null under the same conditions as solveGeoreference: fewer than 2
 * control points, coincident/collinear points, or a near-polar origin.
 */
export function georeferenceResiduals(
  georef: Georeference | undefined
): GeoreferenceResiduals | null {
  const transform = solveGeoreference(georef);
  if (!transform || !georef?.controlPoints) {
    return null;
  }

  const perPoint = georef.controlPoints.map((p) => {
    const fitted = pixelToLatLon(transform, p.x, p.y);
    const entered = toLocalPlane(p.lat, p.lon, transform.lat0, transform.lon0, transform.cosLat0);
    const fittedLocal = toLocalPlane(
      fitted.lat,
      fitted.lon,
      transform.lat0,
      transform.lon0,
      transform.cosLat0
    );
    const du = fittedLocal.u - entered.u;
    const dv = fittedLocal.v - entered.v;
    return Math.sqrt(du * du + dv * dv) * METRES_PER_DEGREE_LATITUDE;
  });

  const maxMetres = perPoint.reduce((max, d) => Math.max(max, d), 0);
  const sumSquares = perPoint.reduce((sum, d) => sum + d * d, 0);
  const rmsMetres = Math.sqrt(sumSquares / perPoint.length);

  return { perPoint, maxMetres, rmsMetres };
}

// --- Derive-on-read Post accessors -----------------------------------------
//
// A Post's lat/lon is intentionally never stored: it is always recomputed
// from the post's (x%, y%) plus the layer's current Georeference. This means
// recalibrating a layer's control points (or editing a post's percentage
// position) instantly and correctly changes every derived lat/lon, with no
// migration/backfill step and no risk of a stored value drifting out of sync
// with the control points that produced it. The cost is recomputing
// solveGeoreference on read, which is why layerPostsLatLon exists to amortize
// that solve across an entire layer's posts instead of once per post.

/**
 * Returns a Post's display name, regardless of which of the two historical
 * shapes it is: a bare legacy string, or an object with a `name` field.
 */
export function postName(post: Post): string {
  return typeof post === 'string' ? post : post.name;
}

/**
 * Returns a Post's image-percentage coordinates, or null when they are not
 * usable. A Post's coordinates are derived-on-read inputs, not a guarantee:
 * legacy string posts carry no coordinates at all, and even object-form
 * posts may have x and/or y set to null (never placed on the map) or to a
 * non-finite number. Centralizing that validation here means every caller
 * (postLatLon, layerPostsLatLon, and any future consumer) treats "no usable
 * position" identically instead of re-deriving the same null checks.
 */
export function postPercent(post: Post): { x: number; y: number } | null {
  if (typeof post === 'string') {
    return null;
  }
  const { x, y } = post;
  if (x === null || x === undefined || y === null || y === undefined) {
    return null;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

/**
 * Derives a single Post's lat/lon from the layer's current georeference.
 * Nothing is ever stored: this recomputes the transform (via
 * solveGeoreference) on every call, so a recalibrated georeference is
 * reflected immediately. Returns null whenever a result can't be produced —
 * missing/degenerate georeference, or a post with no usable percentage
 * position — rather than throwing, since both legacy string posts and
 * unplaced posts are expected, live production shapes.
 *
 * When deriving lat/lon for every post in a layer, prefer
 * layerPostsLatLon — it solves the georeference once instead of once per
 * post.
 */
export function postLatLon(layer: Layer, post: Post): { lat: number; lon: number } | null {
  const transform = solveGeoreference(layer.georeference);
  if (!transform) {
    return null;
  }
  const percent = postPercent(post);
  if (!percent) {
    return null;
  }
  return pixelToLatLon(transform, percent.x, percent.y);
}

/**
 * Derives lat/lon for every post in a layer in one pass. This exists
 * alongside postLatLon specifically to solve the layer's georeference ONCE
 * (solveGeoreference is not free — it fits a similarity or least-squares
 * affine transform) and reuse it for every post, rather than re-solving on
 * each post as a naive `layer.posts.map(p => postLatLon(layer, p))` would.
 *
 * Always returns one entry per post, in original order — including posts
 * that can't be located (`latLon: null`), and even when the layer has no
 * usable georeference at all (every entry gets `latLon: null`, but posts are
 * never dropped from the result). `layer.posts` is treated defensively as an
 * empty array when undefined/null.
 */
export function layerPostsLatLon(
  layer: Layer
): Array<{ post: Post; name: string; latLon: { lat: number; lon: number } | null }> {
  const posts = layer.posts ?? [];
  const transform = solveGeoreference(layer.georeference);

  return posts.map((post) => {
    if (!transform) {
      return { post, name: postName(post), latLon: null };
    }
    const percent = postPercent(post);
    return {
      post,
      name: postName(post),
      latLon: percent ? pixelToLatLon(transform, percent.x, percent.y) : null,
    };
  });
}
