import { describe, expect, it } from 'vitest';

import type { ControlPoint, Georeference, Layer } from '@/app/types';
import { pixelToLatLon, solveGeoreference } from '@/lib/geoUtils';
import { offMapIndicator } from '@/lib/offMapUtils';

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

// Axis-aligned, north-up georeference (same shape as geoUtils.test.ts's
// "axis sanity" fixture): top of the image (y=0) is north, bottom (y=100)
// is south; left (x=0) is west, right (x=100) is east. No rotation, so
// bearingDeg and screenAngleDeg are expected to (nearly) coincide here —
// the rotated-georeference describe block below is what proves they're
// independently computed.
const latN = BASE_LAT + 0.001;
const latS = BASE_LAT - 0.001;
const lonW = BASE_LON - 0.001;
const lonE = BASE_LON + 0.001;
const NORTH_UP_CONTROL_POINTS: ControlPoint[] = [
  { x: 0, y: 0, lat: latN, lon: lonW, label: 'top-left' },
  { x: 100, y: 0, lat: latN, lon: lonE, label: 'top-right' },
  { x: 0, y: 100, lat: latS, lon: lonW, label: 'bottom-left' },
  { x: 100, y: 100, lat: latS, lon: lonE, label: 'bottom-right' },
];
const northUpGeoref = makeGeoref(NORTH_UP_CONTROL_POINTS);

describe('offMapIndicator: on-image points return null', () => {
  const layer = makeLayer(northUpGeoref);

  it('returns null for a point in the middle of the image', () => {
    expect(offMapIndicator(layer, { x: 50, y: 50 }, 1)).toBeNull();
  });

  it('returns null for points exactly on the boundary (inclusive)', () => {
    expect(offMapIndicator(layer, { x: 0, y: 0 }, 1)).toBeNull();
    expect(offMapIndicator(layer, { x: 100, y: 100 }, 1)).toBeNull();
    expect(offMapIndicator(layer, { x: 0, y: 50 }, 1)).toBeNull();
    expect(offMapIndicator(layer, { x: 100, y: 50 }, 1)).toBeNull();
  });
});

describe('offMapIndicator: edge intersection, four sides + a corner (square aspect)', () => {
  const layer = makeLayer(northUpGeoref);

  it('right side: straight right of centre (horizontal ray, dy = 0)', () => {
    const result = offMapIndicator(layer, { x: 150, y: 50 }, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.edge.x).toBeCloseTo(100, 9);
    expect(result.edge.y).toBeCloseTo(50, 9);
    expect(result.screenAngleDeg).toBeCloseTo(90, 9);
  });

  it('left side: straight left of centre (horizontal ray, dy = 0)', () => {
    const result = offMapIndicator(layer, { x: -50, y: 50 }, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.edge.x).toBeCloseTo(0, 9);
    expect(result.edge.y).toBeCloseTo(50, 9);
    expect(result.screenAngleDeg).toBeCloseTo(270, 9);
  });

  it('top side: straight above centre (vertical ray, dx = 0)', () => {
    const result = offMapIndicator(layer, { x: 50, y: -50 }, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.edge.x).toBeCloseTo(50, 9);
    expect(result.edge.y).toBeCloseTo(0, 9);
    expect(result.screenAngleDeg).toBeCloseTo(0, 9);
  });

  it('bottom side: straight below centre (vertical ray, dx = 0)', () => {
    const result = offMapIndicator(layer, { x: 50, y: 150 }, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.edge.x).toBeCloseTo(50, 9);
    expect(result.edge.y).toBeCloseTo(100, 9);
    expect(result.screenAngleDeg).toBeCloseTo(180, 9);
  });

  it('corner: diagonally off bottom-right, ray exits exactly at the (100, 100) corner', () => {
    const result = offMapIndicator(layer, { x: 150, y: 150 }, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.edge.x).toBeCloseTo(100, 9);
    expect(result.edge.y).toBeCloseTo(100, 9);
    expect(result.screenAngleDeg).toBeCloseTo(135, 9);
  });

  it('never clamps the target: geo.distanceMetres reflects the true off-image position, not the edge badge', () => {
    const near = offMapIndicator(layer, { x: 150, y: 50 }, 1);
    const far = offMapIndicator(layer, { x: 500, y: 50 }, 1);
    expect(near?.geo).not.toBeNull();
    expect(far?.geo).not.toBeNull();
    if (!near?.geo || !far?.geo) return;
    // Both share the same edge badge position (ray direction is identical),
    // but the real distance must differ — proof edge is a drawing position
    // only and the underlying target is never clamped into it.
    expect(near.edge).toEqual(far.edge);
    expect(far.geo.distanceMetres).toBeGreaterThan(near.geo.distanceMetres);
  });
});

describe('offMapIndicator: non-square imageAspect correction', () => {
  it('rotates the arrow using aspect-corrected deltas, not raw percent deltas', () => {
    const layer = makeLayer(northUpGeoref);
    const imageAspect = 3; // deliberately non-square (3:1 landscape)
    const percent = { x: 110, y: -10 }; // dx = 60, dy = -60 off centre

    const result = offMapIndicator(layer, percent, imageAspect);
    expect(result).not.toBeNull();
    if (!result) return;

    const dx = 60;
    const dy = -60;
    const correctDeg = (Math.atan2(dx * imageAspect, -dy) * 180) / Math.PI;
    const wrongDegIfAspectDropped = (Math.atan2(dx, -dy) * 180) / Math.PI; // 45

    expect(result.screenAngleDeg).toBeCloseTo(correctDeg, 9);
    expect(wrongDegIfAspectDropped).toBeCloseTo(45, 9);
    // The whole point of the test: these must NOT be close to each other,
    // or the aspect correction could be silently deleted without failing.
    expect(Math.abs(result.screenAngleDeg - wrongDegIfAspectDropped)).toBeGreaterThan(5);
  });

  it('imageAspect = 1 (square) makes screenAngleDeg equal the raw-delta angle', () => {
    const layer = makeLayer(northUpGeoref);
    const percent = { x: 150, y: -50 }; // dx = 100, dy = -100
    const result = offMapIndicator(layer, percent, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.screenAngleDeg).toBeCloseTo(45, 9);
  });
});

describe('offMapIndicator: screenAngleDeg vs geo.bearingDeg are independent (rotated georeference)', () => {
  // Diagonally placed control points (same fixture as geoUtils.test.ts's
  // "2-point anti-similarity transform (rotated map, not axis-aligned)"
  // case): the fitted transform includes a real rotation between image
  // space and true north, so a screen-plane angle and a true-north bearing
  // for the SAME target must differ.
  const rotatedControlPoints: ControlPoint[] = [
    { x: 10, y: 20, lat: BASE_LAT, lon: BASE_LON, label: 'NW' },
    { x: 90, y: 80, lat: BASE_LAT - 0.002, lon: BASE_LON + 0.002, label: 'SE' },
  ];
  const layer = makeLayer(makeGeoref(rotatedControlPoints));

  it('reports a bearingDeg that is not the same number as screenAngleDeg', () => {
    const result = offMapIndicator(layer, { x: 150, y: 50 }, 1); // straight right, screenAngleDeg = 90
    expect(result).not.toBeNull();
    // Asserted, not just narrowed: a bug that made geo always null would
    // otherwise let every assertion below be skipped and the test pass.
    expect(result!.geo).not.toBeNull();
    if (!result || !result.geo) return;

    expect(result.screenAngleDeg).toBeCloseTo(90, 9);
    // The rotation baked into this georeference means true-north bearing for
    // "straight right on the image" is NOT 90 degrees.
    expect(Math.abs(result.geo.bearingDeg - result.screenAngleDeg)).toBeGreaterThan(5);
  });
});

describe('offMapIndicator: geo is null on an uncalibrated layer, screenAngleDeg still valid', () => {
  it('returns geo: null but a finite screenAngleDeg when the layer has no georeference at all', () => {
    const layer = makeLayer(undefined);
    const result = offMapIndicator(layer, { x: 150, y: 50 }, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.geo).toBeNull();
    expect(Number.isFinite(result.screenAngleDeg)).toBe(true);
    expect(result.screenAngleDeg).toBeCloseTo(90, 9);
    expect(result.edge).toEqual({ x: 100, y: 50 });
  });

  it('returns geo: null when the georeference is degenerate (fewer than 2 control points)', () => {
    const layer = makeLayer(makeGeoref([{ x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON }]));
    const result = offMapIndicator(layer, { x: 50, y: -50 }, 1);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.geo).toBeNull();
    expect(Number.isFinite(result.screenAngleDeg)).toBe(true);
  });
});

describe('offMapIndicator: real-world bearing/distance on a north-up calibrated layer', () => {
  const layer = makeLayer(northUpGeoref);
  const transform = solveGeoreference(northUpGeoref);

  it('a target directly above centre bears close to true north', () => {
    const result = offMapIndicator(layer, { x: 50, y: -50 }, 1);
    expect(result).not.toBeNull();
    // Asserted, not just narrowed: a bug that made geo always null would
    // otherwise let every assertion below be skipped and the test pass.
    expect(result!.geo).not.toBeNull();
    if (!result || !result.geo) return;
    expect(result.geo.bearingDeg).toBeCloseTo(0, 0);
    expect(result.geo.compass).toBe('N');
    expect(result.geo.distanceMetres).toBeGreaterThan(0);
  });

  it('a target directly right of centre bears close to true east', () => {
    const result = offMapIndicator(layer, { x: 150, y: 50 }, 1);
    expect(result).not.toBeNull();
    // Asserted, not just narrowed: a bug that made geo always null would
    // otherwise let every assertion below be skipped and the test pass.
    expect(result!.geo).not.toBeNull();
    if (!result || !result.geo) return;
    expect(result.geo.bearingDeg).toBeCloseTo(90, 0);
    expect(result.geo.compass).toBe('E');
  });

  it('distance is measured from the image centre (50, 50), matching pixelToLatLon + metresBetween independently', () => {
    expect(transform).not.toBeNull();
    if (!transform) return;
    const result = offMapIndicator(layer, { x: 50, y: -50 }, 1);
    expect(result).not.toBeNull();
    // Asserted, not just narrowed: a bug that made geo always null would
    // otherwise let every assertion below be skipped and the test pass.
    expect(result!.geo).not.toBeNull();
    if (!result || !result.geo) return;

    const centre = pixelToLatLon(transform, 50, 50);
    const target = pixelToLatLon(transform, 50, -50);
    const du = (target.lon - centre.lon) * transform.cosLat0;
    const dv = target.lat - centre.lat;
    const expectedDistance = Math.sqrt(du * du + dv * dv) * 111320;
    expect(result.geo.distanceMetres).toBeCloseTo(expectedDistance, 4);
  });
});
