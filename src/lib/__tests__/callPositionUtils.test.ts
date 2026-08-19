import { describe, expect, it } from 'vitest';

import type { ControlPoint, Georeference, Layer } from '@/app/types';
import { latLonToPixel, pixelToLatLon, solveGeoreference } from '@/lib/geoUtils';
import {
  buildCallPinLogEntry,
  callPinStaleness,
  formatHHMM,
  isLayerCalibrated,
  placeCallPin,
  placeCallPinFromLatLon,
  resolveCallPinPercent,
} from '@/lib/callPositionUtils';

const BASE_LAT = 37.87;
const BASE_LON = -122.27;

function makeGeoref(controlPoints: ControlPoint[], version = 1): Georeference {
  return { controlPoints, version, updatedAt: 0 };
}

function makeLayer(georeference?: Georeference): Layer {
  return {
    id: 'layer-1',
    name: 'Main',
    mapUrl: 'https://example.com/map.png',
    posts: [],
    georeference,
  };
}

const TWO_POINTS: ControlPoint[] = [
  { x: 10, y: 20, lat: BASE_LAT, lon: BASE_LON, label: 'NW' },
  { x: 90, y: 80, lat: BASE_LAT - 0.002, lon: BASE_LON + 0.002, label: 'SE' },
];

describe('placeCallPin', () => {
  it('refuses on a layer with no georeference at all', () => {
    const layer = makeLayer(undefined);
    const result = placeCallPin(layer, { x: 50, y: 50 }, { source: 'manual', placedAt: 1000 });
    expect(result).toEqual({ ok: false, reason: 'uncalibrated' });
  });

  it('refuses on a layer with fewer than 2 control points', () => {
    const layer = makeLayer(makeGeoref([TWO_POINTS[0]]));
    const result = placeCallPin(layer, { x: 50, y: 50 }, { source: 'manual', placedAt: 1000 });
    expect(result).toEqual({ ok: false, reason: 'uncalibrated' });
  });

  it('refuses on degenerate (coincident) control points', () => {
    const layer = makeLayer(
      makeGeoref([
        { x: 10, y: 20, lat: BASE_LAT, lon: BASE_LON },
        { x: 10, y: 20, lat: BASE_LAT, lon: BASE_LON },
      ])
    );
    const result = placeCallPin(layer, { x: 50, y: 50 }, { source: 'manual', placedAt: 1000 });
    expect(result).toEqual({ ok: false, reason: 'uncalibrated' });
  });

  it('derives lat/lon matching pixelToLatLon on a calibrated layer, and stamps the transform version', () => {
    const georef = makeGeoref(TWO_POINTS, 3);
    const layer = makeLayer(georef);
    const transform = solveGeoreference(georef);
    expect(transform).not.toBeNull();

    const result = placeCallPin(layer, { x: 40, y: 55 }, {
      source: 'manual',
      placedAt: 5000,
      placedBy: 'user-1',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = pixelToLatLon(transform!, 40, 55);
    expect(result.position.lat).toBeCloseTo(expected.lat, 10);
    expect(result.position.lon).toBeCloseTo(expected.lon, 10);
    expect(result.position.x).toBe(40);
    expect(result.position.y).toBe(55);
    expect(result.position.layerId).toBe('layer-1');
    expect(result.position.georeferenceVersion).toBe(3);
    expect(result.position.source).toBe('manual');
    expect(result.position.placedAt).toBe(5000);
    expect(result.position.placedBy).toBe('user-1');
  });

  it('omits placedBy entirely when not supplied, rather than writing it as undefined', () => {
    const layer = makeLayer(makeGeoref(TWO_POINTS));
    const result = placeCallPin(layer, { x: 40, y: 55 }, { source: 'manual', placedAt: 5000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('placedBy' in result.position).toBe(false);
  });
});

describe('resolveCallPinPercent', () => {
  it('returns null when the position belongs to a different layer', () => {
    const layer = makeLayer(makeGeoref(TWO_POINTS));
    const position = {
      lat: BASE_LAT,
      lon: BASE_LON,
      x: 10,
      y: 20,
      layerId: 'some-other-layer',
      source: 'manual' as const,
      placedAt: 0,
    };
    expect(resolveCallPinPercent(layer, position)).toBeNull();
  });

  it('re-derives x/y from the CURRENT transform rather than trusting stamped x/y', () => {
    const georef = makeGeoref(TWO_POINTS, 1);
    const layer = makeLayer(georef);
    const transform = solveGeoreference(georef)!;
    const { lat, lon } = pixelToLatLon(transform, 40, 55);

    // Stamped x/y deliberately wrong (as if computed under an old transform)
    // to prove the function re-derives rather than passing them through.
    const position = {
      lat,
      lon,
      x: 1,
      y: 1,
      layerId: 'layer-1',
      georeferenceVersion: 1,
      source: 'manual' as const,
      placedAt: 0,
    };

    const percent = resolveCallPinPercent(layer, position);
    expect(percent).not.toBeNull();
    expect(percent!.x).toBeCloseTo(40, 6);
    expect(percent!.y).toBeCloseTo(55, 6);
  });

  it('falls back to stamped x/y when the layer currently has no usable georeference', () => {
    const layer = makeLayer(undefined);
    const position = {
      lat: BASE_LAT,
      lon: BASE_LON,
      x: 33,
      y: 66,
      layerId: 'layer-1',
      source: 'manual' as const,
      placedAt: 0,
    };
    expect(resolveCallPinPercent(layer, position)).toEqual({ x: 33, y: 66 });
  });

  it('returns null when there is no transform AND no stamped x/y to fall back on', () => {
    const layer = makeLayer(undefined);
    const position = {
      lat: BASE_LAT,
      lon: BASE_LON,
      x: null,
      y: null,
      layerId: 'layer-1',
      source: 'tak' as const,
      placedAt: 0,
    };
    expect(resolveCallPinPercent(layer, position)).toBeNull();
  });
});

describe('callPinStaleness', () => {
  it('is fresh when the stamped version matches the layer', () => {
    const georef = makeGeoref(TWO_POINTS, 2);
    const layer = makeLayer(georef);
    const position = {
      lat: BASE_LAT,
      lon: BASE_LON,
      x: 40,
      y: 55,
      layerId: 'layer-1',
      georeferenceVersion: 2,
      source: 'manual' as const,
      placedAt: 0,
    };
    expect(callPinStaleness(layer, position)).toBe('fresh');
  });

  it('is stale after the layer is recalibrated to a new version', () => {
    const georef = makeGeoref(TWO_POINTS, 5);
    const layer = makeLayer(georef);
    const position = {
      lat: BASE_LAT,
      lon: BASE_LON,
      x: 40,
      y: 55,
      layerId: 'layer-1',
      georeferenceVersion: 2,
      source: 'manual' as const,
      placedAt: 0,
    };
    expect(callPinStaleness(layer, position)).toBe('stale');
  });
});

describe('isLayerCalibrated', () => {
  it('is false with no georeference', () => {
    expect(isLayerCalibrated(makeLayer(undefined))).toBe(false);
  });

  it('is false with fewer than 2 control points', () => {
    expect(isLayerCalibrated(makeLayer(makeGeoref([TWO_POINTS[0]])))).toBe(false);
  });

  it('is true with 2 valid, non-degenerate control points', () => {
    expect(isLayerCalibrated(makeLayer(makeGeoref(TWO_POINTS)))).toBe(true);
  });
});

describe('formatHHMM', () => {
  it('zero-pads hours and minutes', () => {
    const ts = new Date(2026, 0, 1, 5, 3, 0).getTime();
    expect(formatHHMM(ts)).toBe('0503');
  });
});

describe('buildCallPinLogEntry', () => {
  it('formats a placed entry', () => {
    const ts = new Date(2026, 0, 1, 14, 30, 0).getTime();
    const entry = buildCallPinLogEntry('placed', ts);
    expect(entry.timestamp).toBe(ts);
    expect(entry.message).toBe('1430 - Pin dropped on map.');
  });

  it('formats a moved entry', () => {
    const ts = new Date(2026, 0, 1, 9, 5, 0).getTime();
    const entry = buildCallPinLogEntry('moved', ts);
    expect(entry.message).toBe('0905 - Pin moved on map.');
  });

  // Removal is logged for the same reason placement is: without it, a call
  // that had a coordinate and lost one is indistinguishable from a call that
  // never had one.
  it('formats a cleared entry', () => {
    const ts = new Date(2026, 0, 1, 23, 59, 0).getTime();
    const entry = buildCallPinLogEntry('cleared', ts);
    expect(entry.message).toBe('2359 - Pin removed from map.');
  });

  it('gives each kind a distinct message', () => {
    const ts = new Date(2026, 0, 1, 12, 0, 0).getTime();
    const messages = (['placed', 'moved', 'cleared'] as const).map(
      (k) => buildCallPinLogEntry(k, ts).message
    );
    expect(new Set(messages).size).toBe(3);
  });
});

describe('placeCallPinFromLatLon', () => {
  it('§8.F behaviour: never refuses on uncalibrated layer, returns position with exact input lat/lon', () => {
    const layer = makeLayer(undefined);
    const result = placeCallPinFromLatLon(
      layer,
      { lat: 37.88, lon: -122.26 },
      { source: 'tak', placedAt: 2000 }
    );
    expect(result.lat).toBe(37.88);
    expect(result.lon).toBe(-122.26);
  });

  it('x/y are null (not undefined) when there is no transform', () => {
    const layer = makeLayer(undefined);
    const result = placeCallPinFromLatLon(
      layer,
      { lat: BASE_LAT, lon: BASE_LON },
      { source: 'tak', placedAt: 1000 }
    );
    expect(result.x).toBe(null);
    expect(result.y).toBe(null);
    expect('x' in result).toBe(true);
    expect('y' in result).toBe(true);
  });

  it('georeferenceVersion is undefined when there is no transform', () => {
    const layer = makeLayer(undefined);
    const result = placeCallPinFromLatLon(
      layer,
      { lat: BASE_LAT, lon: BASE_LON },
      { source: 'manual', placedAt: 1000 }
    );
    expect(result.georeferenceVersion).toBeUndefined();
  });

  it('does not report pin as stale after recalibration when placed from lat/lon on uncalibrated layer', () => {
    // Place pin on uncalibrated layer
    const uncalibratedLayer = makeLayer(undefined);
    const position = placeCallPinFromLatLon(
      uncalibratedLayer,
      { lat: BASE_LAT, lon: BASE_LON },
      { source: 'tak', placedAt: 1000 }
    );

    // The pin's georeferenceVersion is undefined
    expect(position.georeferenceVersion).toBeUndefined();

    // Now layer gains a georeference (v1)
    const calibratedLayer = makeLayer(makeGeoref(TWO_POINTS, 1));

    // Check staleness: should be 'unknown' (not 'stale'), because unstamped
    // version never claimed to be part of any calibration
    const staleness = callPinStaleness(calibratedLayer, position);
    expect(staleness).toBe('unknown');
    expect(staleness).not.toBe('stale');
  });

  it('x/y are derived and round-trip when the layer is calibrated', () => {
    const georef = makeGeoref(TWO_POINTS, 1);
    const layer = makeLayer(georef);
    const transform = solveGeoreference(georef)!;

    // Start with a percent point
    const origPercent = { x: 35.5, y: 72.3 };

    // Convert to lat/lon using the transform
    const { lat, lon } = pixelToLatLon(transform, origPercent.x, origPercent.y);

    // Place a pin from that lat/lon
    const result = placeCallPinFromLatLon(layer, { lat, lon }, {
      source: 'manual',
      placedAt: 3000,
    });

    // x/y should come back to the original within floating-point tolerance
    expect(result.x).not.toBeNull();
    expect(result.y).not.toBeNull();
    expect(result.x!).toBeCloseTo(origPercent.x, 9);
    expect(result.y!).toBeCloseTo(origPercent.y, 9);
  });

  it('stamps georeferenceVersion when the layer is calibrated', () => {
    const georef = makeGeoref(TWO_POINTS, 4);
    const layer = makeLayer(georef);
    const result = placeCallPinFromLatLon(
      layer,
      { lat: BASE_LAT, lon: BASE_LON },
      { source: 'manual', placedAt: 1000 }
    );
    expect(result.georeferenceVersion).toBe(4);
  });

  it('succeeds for coordinates outside the raster', () => {
    const georef = makeGeoref(TWO_POINTS, 1);
    const layer = makeLayer(georef);

    // A coordinate far from the control points (likely outside the image bounds)
    const farLat = 40.0;
    const farLon = -120.0;

    const result = placeCallPinFromLatLon(layer, { lat: farLat, lon: farLon }, {
      source: 'manual',
      placedAt: 5000,
    });

    // Position is returned with exact lat/lon
    expect(result.lat).toBe(farLat);
    expect(result.lon).toBe(farLon);
    // x/y may be outside 0-100, but should still be numbers (not null)
    expect(result.x).not.toBeNull();
    expect(result.y).not.toBeNull();
    expect(typeof result.x).toBe('number');
    expect(typeof result.y).toBe('number');
  });

  it('passes through layerId, source, and placedAt', () => {
    const layer = makeLayer(makeGeoref(TWO_POINTS));
    const result = placeCallPinFromLatLon(
      layer,
      { lat: 37.88, lon: -122.26 },
      { source: 'tak', placedAt: 7777 }
    );
    expect(result.layerId).toBe('layer-1');
    expect(result.source).toBe('tak');
    expect(result.placedAt).toBe(7777);
  });

  it('includes placedBy when supplied', () => {
    const layer = makeLayer(makeGeoref(TWO_POINTS));
    const result = placeCallPinFromLatLon(
      layer,
      { lat: BASE_LAT, lon: BASE_LON },
      { source: 'manual', placedAt: 1000, placedBy: 'user-42' }
    );
    expect(result.placedBy).toBe('user-42');
  });

  it('omits placedBy entirely when not supplied', () => {
    const layer = makeLayer(makeGeoref(TWO_POINTS));
    const result = placeCallPinFromLatLon(
      layer,
      { lat: BASE_LAT, lon: BASE_LON },
      { source: 'manual', placedAt: 1000 }
    );
    expect('placedBy' in result).toBe(false);
  });

  it('handles single control point (uncalibrated) correctly', () => {
    const layer = makeLayer(makeGeoref([TWO_POINTS[0]]));
    const result = placeCallPinFromLatLon(
      layer,
      { lat: BASE_LAT + 0.001, lon: BASE_LON + 0.001 },
      { source: 'manual', placedAt: 2000 }
    );
    // Should still return a valid position with exact lat/lon
    expect(result.lat).toBe(BASE_LAT + 0.001);
    expect(result.lon).toBe(BASE_LON + 0.001);
    // And no x/y should be derived
    expect(result.x).toBeNull();
    expect(result.y).toBeNull();
    expect(result.georeferenceVersion).toBeUndefined();
  });
});

// Sanity check that resolveCallPinPercent and placeCallPin round-trip: a pin
// placed at some percent, then immediately resolved back against the same
// (unchanged) layer, redraws at the same spot it was placed.
describe('placeCallPin -> resolveCallPinPercent round trip', () => {
  it('round-trips within floating point tolerance', () => {
    const georef = makeGeoref(TWO_POINTS, 1);
    const layer = makeLayer(georef);
    const placed = placeCallPin(layer, { x: 23.4, y: 61.2 }, { source: 'manual', placedAt: 0 });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const percent = resolveCallPinPercent(layer, placed.position);
    expect(percent).not.toBeNull();
    expect(percent!.x).toBeCloseTo(23.4, 6);
    expect(percent!.y).toBeCloseTo(61.2, 6);

    // And latLonToPixel directly agrees, as a cross-check against geoUtils.
    const transform = solveGeoreference(georef)!;
    const direct = latLonToPixel(transform, placed.position.lat, placed.position.lon);
    expect(percent!.x).toBeCloseTo(direct.x, 10);
    expect(percent!.y).toBeCloseTo(direct.y, 10);
  });
});
