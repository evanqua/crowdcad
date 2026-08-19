// Initial-camera precedence resolution for BasemapView — TAK plan §8.I.
//
// BasemapView needs to decide, ONCE, where to point the camera before the
// map is constructed (see BasemapView's own header comment on why this must
// happen at construction and not in a `load` handler). There are four
// candidate sources, in priority order:
//
//   1. `Venue.basemapCamera` (an operator's saved opening view) — an explicit
//      choice always wins over anything this file could infer.
//   2/3. the georeferenced raster's corners, or (no raster) every located
//      marker on the layer — "frame what's actually on this venue." These
//      two arrive here already resolved into one `geometryPoints` array by
//      BasemapView, because by the time a camera is being picked they are
//      handled identically: extend an LngLatBounds to fit these points.
//   4. the PMTiles archive's own coverage bounds — the last resort for a
//      brand-new venue with no image, no georeference and no located staff/
//      calls: better to open somewhere the archive actually has tiles than
//      at MapLibre's built-in world view, which is blank for a venue-sized
//      extract.
//
// This module is pure and synchronous — no maplibre-gl, no pmtiles, no
// network — so the precedence chain and the coverage math are unit-testable
// without a browser, the same trade-off `lib/basemap/config.ts` documents
// for itself. BasemapView is the only caller; it supplies inputs it has
// already computed or fetched (raster/marker points, a parsed archive
// header) and turns the result into MapLibre constructor options.

/** The subset of a PMTiles v4 `Header` this module cares about. Deliberately
 *  NOT `import type { Header } from 'pmtiles'` — keeping this module free of
 *  the pmtiles dependency (like config.ts stays free of maplibre-gl) means it
 *  costs nothing to import from a test and can't be broken by a pmtiles
 *  type-shape change that only touches fields this file never reads. Field
 *  names verified against node_modules/pmtiles/dist/esm/index.d.ts (v4.5.0)
 *  — `Header` there declares `minLon`/`minLat`/`maxLon`/`maxLat` as required
 *  `number`s alongside `centerLon`/`centerLat`/`centerZoom`, which this
 *  module doesn't need. */
export interface ArchiveCoverage {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** Mirrors `BasemapCamera` from `@/app/types.ts`, restated here rather than
 *  imported so this module has zero dependency on the app's domain types —
 *  see the module doc comment. Structurally identical (`BasemapCamera` also
 *  carries an optional `updatedAt` this module never reads), so a
 *  `BasemapCamera` is a valid argument with no conversion at the call site. */
export interface CameraProp {
  center: { lat: number; lon: number };
  zoom: number;
  bearing?: number;
  pitch?: number;
}

/**
 * Validates and normalizes a PMTiles header's bounds fields into an
 * `ArchiveCoverage`, or `null` if they can't be used as a fallback camera.
 *
 * Rejects three shapes of bad input, all folding to the same "no fallback"
 * result — callers already have a well-tested path for "no bounds at all"
 * (BasemapView's pre-existing behaviour), so a header this function can't
 * trust degrades to that path rather than to a broken or misleading camera:
 *  - missing/non-finite fields (an archive built by a tool that omits them,
 *    or a network response that wasn't a real header at all);
 *  - degenerate or out-of-range bounds (`min >= max` on either axis, or a
 *    lon/lat outside valid Earth coordinates) — a corrupt or malformed
 *    header;
 *  - world-sized bounds — an archive that covers (approximately) the whole
 *    globe, where "fit to coverage" would fit to the same blank world view
 *    this fallback exists to avoid. The threshold is deliberately loose
 *    (>350deg of longitude / >170deg of latitude) so a genuinely large but
 *    still local archive (a whole US extract, say) is NOT treated as
 *    world-sized.
 */
export function parseArchiveCoverage(
  header: Partial<ArchiveCoverage> | null | undefined
): ArchiveCoverage | null {
  if (!header) return null;
  const { minLon, minLat, maxLon, maxLat } = header;
  if (
    typeof minLon !== 'number' ||
    typeof minLat !== 'number' ||
    typeof maxLon !== 'number' ||
    typeof maxLat !== 'number' ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }
  if (minLon >= maxLon || minLat >= maxLat) return null;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) return null;
  if (maxLon - minLon > 350 || maxLat - minLat > 170) return null;
  return { minLon, minLat, maxLon, maxLat };
}

/** The two opposite corners of `coverage`, in MapLibre's `[lon, lat]` point
 *  order — sufficient to seed an `LngLatBounds` via repeated `.extend()`,
 *  the same mechanism BasemapView already uses for raster corners and
 *  marker points. */
export function coverageToPoints(coverage: ArchiveCoverage): [number, number][] {
  return [
    [coverage.minLon, coverage.minLat],
    [coverage.maxLon, coverage.maxLat],
  ];
}

/** True when `point` sits outside `coverage` on either axis — the trigger
 *  for BasemapView's `onCoverageWarning`. */
export function isOutsideCoverage(
  point: { lat: number; lon: number },
  coverage: ArchiveCoverage
): boolean {
  return (
    point.lon < coverage.minLon ||
    point.lon > coverage.maxLon ||
    point.lat < coverage.minLat ||
    point.lat > coverage.maxLat
  );
}

function centroid(points: [number, number][]): { lat: number; lon: number } {
  let lonSum = 0;
  let latSum = 0;
  for (const [lon, lat] of points) {
    lonSum += lon;
    latSum += lat;
  }
  return { lon: lonSum / points.length, lat: latSum / points.length };
}

/** The resolved initial camera — one of BasemapView's four precedence
 *  levels. `venueCentre` is carried only on the two levels that describe an
 *  actual venue location (as opposed to the archive's own coverage, which
 *  cannot be "outside" itself): BasemapView uses it, when present, to decide
 *  whether to fire `onCoverageWarning`. */
export type ResolvedInitialCamera =
  | {
      source: 'prop';
      center: [number, number];
      zoom: number;
      bearing?: number;
      pitch?: number;
      venueCentre: { lat: number; lon: number };
    }
  | { source: 'geometry'; points: [number, number][]; venueCentre: { lat: number; lon: number } }
  | { source: 'archiveCoverage'; points: [number, number][] }
  | { source: 'none' };

/**
 * The four-level precedence chain (TAK plan §8.I). See the module doc
 * comment for what each level means; this function only orders them.
 */
export function resolveInitialCamera(input: {
  initialCamera?: CameraProp | null;
  geometryPoints: [number, number][];
  archiveCoverage?: ArchiveCoverage | null;
}): ResolvedInitialCamera {
  const { initialCamera, geometryPoints, archiveCoverage } = input;

  if (initialCamera) {
    return {
      source: 'prop',
      // lat/lon -> [lon, lat]: MapLibre's point order, not the app's.
      center: [initialCamera.center.lon, initialCamera.center.lat],
      zoom: initialCamera.zoom,
      ...(initialCamera.bearing !== undefined ? { bearing: initialCamera.bearing } : {}),
      ...(initialCamera.pitch !== undefined ? { pitch: initialCamera.pitch } : {}),
      venueCentre: initialCamera.center,
    };
  }

  if (geometryPoints.length > 0) {
    return { source: 'geometry', points: geometryPoints, venueCentre: centroid(geometryPoints) };
  }

  if (archiveCoverage) {
    return { source: 'archiveCoverage', points: coverageToPoints(archiveCoverage) };
  }

  return { source: 'none' };
}
