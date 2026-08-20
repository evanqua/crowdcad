/**
 * Tests for BasemapView's initial-camera precedence chain — TAK plan §8.I.
 *
 * The bug this module fixes: a venue with no georeferenced raster AND no
 * located markers used to leave MapLibre at its built-in world view, which
 * is blank for a venue-sized PMTiles extract. `resolveInitialCamera` adds a
 * fourth, last-resort level (the archive's own coverage bounds) so the map
 * always opens somewhere tiles exist -- these tests pin the four-level
 * precedence order, the header-bounds validation that guards that fallback,
 * and the out-of-coverage detection used for `onCoverageWarning`.
 */

import { describe, expect, it } from 'vitest';

import {
  type ArchiveCoverage,
  coverageToPoints,
  isOutsideCoverage,
  parseArchiveCoverage,
  resolveInitialCamera,
  sanitizeBasemapCameraForSave,
} from '@/lib/basemap/camera';

import type { BasemapCamera } from '@/app/types';

const BERKELEY_COVERAGE: ArchiveCoverage = {
  minLon: -122.3,
  minLat: 37.845,
  maxLon: -122.23,
  maxLat: 37.895,
};

describe('parseArchiveCoverage', () => {
  it('returns null for a null/undefined header', () => {
    expect(parseArchiveCoverage(null)).toBeNull();
    expect(parseArchiveCoverage(undefined)).toBeNull();
  });

  it('returns null when any bounds field is missing', () => {
    expect(parseArchiveCoverage({ minLon: -122.3, minLat: 37.845, maxLon: -122.23 })).toBeNull();
  });

  it('returns null when a field is non-finite (NaN/Infinity)', () => {
    expect(
      parseArchiveCoverage({ minLon: NaN, minLat: 37.845, maxLon: -122.23, maxLat: 37.895 })
    ).toBeNull();
    expect(
      parseArchiveCoverage({
        minLon: -122.3,
        minLat: 37.845,
        maxLon: Infinity,
        maxLat: 37.895,
      })
    ).toBeNull();
  });

  it('returns null when a field is the wrong type', () => {
    expect(
      parseArchiveCoverage({
        minLon: '-122.3' as unknown as number,
        minLat: 37.845,
        maxLon: -122.23,
        maxLat: 37.895,
      })
    ).toBeNull();
  });

  it('returns null for degenerate bounds (min >= max on either axis)', () => {
    expect(
      parseArchiveCoverage({ minLon: -122.2, minLat: 37.845, maxLon: -122.3, maxLat: 37.895 })
    ).toBeNull(); // minLon > maxLon
    expect(
      parseArchiveCoverage({ minLon: -122.3, minLat: 37.9, maxLon: -122.23, maxLat: 37.845 })
    ).toBeNull(); // minLat > maxLat
    expect(
      parseArchiveCoverage({ minLon: -122.3, minLat: 37.845, maxLon: -122.3, maxLat: 37.895 })
    ).toBeNull(); // minLon === maxLon
  });

  it('returns null for out-of-range lon/lat', () => {
    expect(
      parseArchiveCoverage({ minLon: -200, minLat: 37.845, maxLon: -122.23, maxLat: 37.895 })
    ).toBeNull();
    expect(
      parseArchiveCoverage({ minLon: -122.3, minLat: -95, maxLon: -122.23, maxLat: 37.895 })
    ).toBeNull();
  });

  it('returns null for world-sized bounds', () => {
    expect(
      parseArchiveCoverage({ minLon: -180, minLat: -85.06, maxLon: 180, maxLat: 85.06 })
    ).toBeNull();
  });

  it('accepts a genuinely large but still local archive (not treated as world-sized)', () => {
    // Roughly a contiguous-US-sized extract: well under both thresholds.
    const result = parseArchiveCoverage({ minLon: -125, minLat: 24, maxLon: -66, maxLat: 49 });
    expect(result).toEqual({ minLon: -125, minLat: 24, maxLon: -66, maxLat: 49 });
  });

  it('returns a normalized ArchiveCoverage for a valid small extract', () => {
    expect(parseArchiveCoverage(BERKELEY_COVERAGE)).toEqual(BERKELEY_COVERAGE);
  });

  it('ignores extra fields on the header object', () => {
    const result = parseArchiveCoverage({
      ...BERKELEY_COVERAGE,
      centerLon: -122.27,
      centerLat: 37.87,
      centerZoom: 14,
    } as unknown as ArchiveCoverage);
    expect(result).toEqual(BERKELEY_COVERAGE);
  });
});

describe('coverageToPoints', () => {
  it('returns the min and max corners in [lon, lat] order', () => {
    expect(coverageToPoints(BERKELEY_COVERAGE)).toEqual([
      [-122.3, 37.845],
      [-122.23, 37.895],
    ]);
  });
});

describe('isOutsideCoverage', () => {
  it('returns false for a point inside the coverage', () => {
    expect(isOutsideCoverage({ lat: 37.87, lon: -122.27 }, BERKELEY_COVERAGE)).toBe(false);
  });

  it('returns false for a point exactly on the boundary', () => {
    expect(isOutsideCoverage({ lat: 37.845, lon: -122.3 }, BERKELEY_COVERAGE)).toBe(false);
    expect(isOutsideCoverage({ lat: 37.895, lon: -122.23 }, BERKELEY_COVERAGE)).toBe(false);
  });

  it('returns true for a point outside on longitude', () => {
    expect(isOutsideCoverage({ lat: 37.87, lon: -122.5 }, BERKELEY_COVERAGE)).toBe(true);
  });

  it('returns true for a point outside on latitude', () => {
    expect(isOutsideCoverage({ lat: 38.5, lon: -122.27 }, BERKELEY_COVERAGE)).toBe(true);
  });

  it('returns true for a point on a different continent entirely', () => {
    // Antarctica -- the exact failure mode a swapped lat/lon would produce.
    expect(isOutsideCoverage({ lat: -75, lon: 20 }, BERKELEY_COVERAGE)).toBe(true);
  });
});

describe('resolveInitialCamera — four-level precedence', () => {
  it('level 1: prefers an explicit initialCamera over everything else', () => {
    const result = resolveInitialCamera({
      initialCamera: { center: { lat: 37.87, lon: -122.27 }, zoom: 15, bearing: 30, pitch: 45 },
      geometryPoints: [[-122.26, 37.86]],
      archiveCoverage: BERKELEY_COVERAGE,
    });
    expect(result).toEqual({
      source: 'prop',
      center: [-122.27, 37.87], // lat/lon -> [lon, lat]
      zoom: 15,
      bearing: 30,
      pitch: 45,
      venueCentre: { lat: 37.87, lon: -122.27 },
    });
  });

  it('level 1: omits bearing/pitch when not provided, rather than passing undefined', () => {
    const result = resolveInitialCamera({
      initialCamera: { center: { lat: 37.87, lon: -122.27 }, zoom: 15 },
      geometryPoints: [],
      archiveCoverage: null,
    });
    expect(result.source).toBe('prop');
    expect('bearing' in result).toBe(false);
    expect('pitch' in result).toBe(false);
  });

  it('level 2/3: falls through to geometry points (raster corners or markers) when no initialCamera', () => {
    const points: [number, number][] = [
      [-122.26, 37.86],
      [-122.27, 37.87],
    ];
    const result = resolveInitialCamera({
      initialCamera: null,
      geometryPoints: points,
      archiveCoverage: BERKELEY_COVERAGE,
    });
    expect(result.source).toBe('geometry');
    if (result.source !== 'geometry') return;
    expect(result.points).toEqual(points);
    expect(result.venueCentre.lon).toBeCloseTo(-122.265, 10);
    expect(result.venueCentre.lat).toBeCloseTo(37.865, 10);
  });

  it('level 4: falls through to archive coverage when no initialCamera and no geometry points', () => {
    const result = resolveInitialCamera({
      initialCamera: undefined,
      geometryPoints: [],
      archiveCoverage: BERKELEY_COVERAGE,
    });
    expect(result).toEqual({
      source: 'archiveCoverage',
      points: coverageToPoints(BERKELEY_COVERAGE),
    });
  });

  it('resolves to "none" when nothing is available at any level', () => {
    const result = resolveInitialCamera({
      initialCamera: null,
      geometryPoints: [],
      archiveCoverage: null,
    });
    expect(result).toEqual({ source: 'none' });
  });

  it('a single geometry point still resolves (zero-size bounds, valid for LngLatBounds)', () => {
    const result = resolveInitialCamera({
      initialCamera: null,
      geometryPoints: [[-122.27, 37.87]],
      archiveCoverage: null,
    });
    expect(result).toEqual({
      source: 'geometry',
      points: [[-122.27, 37.87]],
      venueCentre: { lon: -122.27, lat: 37.87 },
    });
  });
});

describe('sanitizeBasemapCameraForSave', () => {
  it('omits bearing/pitch entirely when the camera is north-up and flat', () => {
    const camera: BasemapCamera = { center: { lat: 37.8719, lon: -122.2585 }, zoom: 15 };
    const result = sanitizeBasemapCameraForSave(camera, 1000);

    expect(result).toEqual({
      center: { lat: 37.8719, lon: -122.2585 },
      zoom: 15,
      updatedAt: 1000,
    });
    expect('bearing' in result).toBe(false);
    expect('pitch' in result).toBe(false);
  });

  it('carries bearing/pitch through when present', () => {
    const camera: BasemapCamera = {
      center: { lat: 37.8719, lon: -122.2585 },
      zoom: 16.5,
      bearing: 45,
      pitch: 30,
    };
    const result = sanitizeBasemapCameraForSave(camera, 2000);

    expect(result).toEqual({
      center: { lat: 37.8719, lon: -122.2585 },
      zoom: 16.5,
      bearing: 45,
      pitch: 30,
      updatedAt: 2000,
    });
  });

  it('always stamps updatedAt fresh, ignoring any updatedAt already on the input', () => {
    const camera: BasemapCamera = {
      center: { lat: 0, lon: 0 },
      zoom: 10,
      updatedAt: 1,
    };
    const result = sanitizeBasemapCameraForSave(camera, 999);
    expect(result.updatedAt).toBe(999);
  });

  it('keeps zero bearing/pitch (0 is a real value, not "unset")', () => {
    const camera: BasemapCamera = { center: { lat: 0, lon: 0 }, zoom: 10, bearing: 0, pitch: 0 };
    const result = sanitizeBasemapCameraForSave(camera, 5);
    expect(result.bearing).toBe(0);
    expect(result.pitch).toBe(0);
  });
});
