import type { GeoBounds, Post } from '@/app/types';

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function isPointWithinRect(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

export function pixelToPercent(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): { x: number; y: number } {
  const xPercent = ((clientX - rect.left) / rect.width) * 100;
  const yPercent = ((clientY - rect.top) / rect.height) * 100;

  return {
    x: clampPercent(xPercent),
    y: clampPercent(yPercent),
  };
}

export interface GeoJsonPointFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties?: {
    name?: string;
    isClinic?: boolean;
    [key: string]: unknown;
  } | null;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  bbox?: [number, number, number, number]; // [west, south, east, north]
  features: GeoJsonPointFeature[];
}

function isPointFeature(feature: unknown): feature is GeoJsonPointFeature {
  if (typeof feature !== 'object' || feature === null) return false;
  const f = feature as Record<string, unknown>;
  if (f.type !== 'Feature') return false;
  const geometry = f.geometry as Record<string, unknown> | undefined;
  if (!geometry || geometry.type !== 'Point') return false;
  const coords = geometry.coordinates;
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  );
}

export function isGeoJsonFeatureCollection(
  value: unknown
): value is GeoJsonFeatureCollection {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.type === 'FeatureCollection' && Array.isArray(v.features);
}

/**
 * Derives a geographic bounding box for a FeatureCollection: prefers the
 * standard top-level `bbox` member, falling back to the min/max extent of
 * the collection's own points when `bbox` is absent.
 */
export function deriveGeoBounds(
  collection: GeoJsonFeatureCollection
): GeoBounds | null {
  if (collection.bbox && collection.bbox.length === 4) {
    const [west, south, east, north] = collection.bbox;
    return { north, south, east, west };
  }

  const points = collection.features.filter(isPointFeature);
  if (points.length === 0) return null;

  const lngs = points.map((f) => f.geometry.coordinates[0]);
  const lats = points.map((f) => f.geometry.coordinates[1]);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

export function latLngToPercent(
  lat: number,
  lng: number,
  bounds: GeoBounds
): { x: number; y: number } {
  const lngSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;

  if (lngSpan === 0 || latSpan === 0) {
    throw new Error('Invalid geoBounds: north/south or east/west span is zero');
  }

  const xPercent = ((lng - bounds.west) / lngSpan) * 100;
  const yPercent = ((bounds.north - lat) / latSpan) * 100;

  return {
    x: clampPercent(xPercent),
    y: clampPercent(yPercent),
  };
}

export interface GeoJsonImportResult {
  posts: Post[];
  geoBounds: GeoBounds;
  skipped: number;
}

/**
 * Converts a GeoJSON FeatureCollection of Point features into Posts placed
 * on the existing percent-of-image marker system, using `bounds` (or the
 * collection's own bbox/extent) to georeference lat/lng into x/y percent.
 * Non-Point features, or Point features missing a usable name, are skipped
 * and counted rather than throwing, since a single bad feature shouldn't
 * block importing the rest.
 */
export function geoJsonToPosts(
  collection: GeoJsonFeatureCollection,
  bounds?: GeoBounds
): GeoJsonImportResult {
  const geoBounds = bounds ?? deriveGeoBounds(collection);
  if (!geoBounds) {
    throw new Error(
      'Could not determine geographic bounds: GeoJSON has no bbox and no usable point features'
    );
  }

  const posts: Post[] = [];
  let skipped = 0;

  for (const feature of collection.features) {
    if (!isPointFeature(feature)) {
      skipped += 1;
      continue;
    }

    const name = feature.properties?.name;
    if (typeof name !== 'string' || name.trim() === '') {
      skipped += 1;
      continue;
    }

    const [lng, lat] = feature.geometry.coordinates;
    const { x, y } = latLngToPercent(lat, lng, geoBounds);

    posts.push({
      name,
      x,
      y,
      isClinic: Boolean(feature.properties?.isClinic),
      lat,
      lng,
    });
  }

  return { posts, geoBounds, skipped };
}
