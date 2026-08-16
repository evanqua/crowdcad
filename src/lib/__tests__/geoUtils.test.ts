import { describe, expect, it } from 'vitest';

import type { ControlPoint, Georeference, Layer, Post } from '@/app/types';
import {
  latLonToPixel,
  layerPostsLatLon,
  pixelToLatLon,
  postLatLon,
  postName,
  postPercent,
  solveGeoreference,
} from '@/lib/geoUtils';

function makeGeoref(controlPoints: ControlPoint[]): Georeference {
  return {
    controlPoints,
    version: 1,
    updatedAt: 0,
  };
}

// Realistic venue-scale coordinates: around lat 37.87, lon -122.27, spans of
// ~0.002 degrees (roughly a few hundred meters).
const BASE_LAT = 37.87;
const BASE_LON = -122.27;

describe('solveGeoreference / pixelToLatLon / latLonToPixel', () => {
  describe('2-point anti-similarity transform (rotated map, not axis-aligned)', () => {
    // These control points are diagonal (not axis-aligned), so the fitted
    // transform includes a non-trivial rotation on top of the mandatory
    // reflection (see "orientation-reversing" tests below). Exercising a
    // rotated map here confirms the reflection fix doesn't break rotation.
    const controlPoints: ControlPoint[] = [
      { x: 10, y: 20, lat: BASE_LAT, lon: BASE_LON, label: 'NW' },
      { x: 90, y: 80, lat: BASE_LAT - 0.002, lon: BASE_LON + 0.002, label: 'SE' },
    ];
    const georef = makeGeoref(controlPoints);

    it('round-trips arbitrary points within 1e-6', () => {
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      const samples: [number, number][] = [
        [10, 20],
        [90, 80],
        [50, 50],
        [0, 0],
        [100, 100],
        [-20, 150], // outside the map image — must not be clamped
      ];

      for (const [x, y] of samples) {
        const { lat, lon } = pixelToLatLon(t, x, y);
        const back = latLonToPixel(t, lat, lon);
        expect(back.x).toBeCloseTo(x, 6);
        expect(back.y).toBeCloseTo(y, 6);
      }
    });

    it('hits control points exactly', () => {
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      for (const cp of controlPoints) {
        const { lat, lon } = pixelToLatLon(t, cp.x, cp.y);
        expect(lat).toBeCloseTo(cp.lat, 9);
        expect(lon).toBeCloseTo(cp.lon, 9);
      }
    });
  });

  describe('2-point north-up axis sanity (bug repro: corners must not swap)', () => {
    // Regression test for a real bug: a plain orientation-preserving
    // similarity (q = z*p + w) cannot represent image->geo mapping because
    // image space is orientation-REVERSING (x east, y DOWN the image) while
    // geo space has lat increasing UP. The old formula silently substituted
    // a 90-degree rotation, swapping the NE/SW corners.
    //
    // The two control points below sit at diagonal (0,0)/(100,100) pixel
    // corners, deliberately chosen so their lat/lon delta forms an exact
    // square in the LOCAL TANGENT-PLANE frame (lonDelta * cosLat0 ==
    // |latDelta|). That constraint matters: the 2-point solver fits a
    // uniform-scale (similarity) transform, which is only capable of
    // reproducing the two OTHER corners (NE/SW, not directly supplied as
    // control points) exactly when the diagonal is a true square post
    // cosLat0-scaling — otherwise a small residual rotation is
    // geometrically unavoidable regardless of the orientation fix. Using a
    // non-square diagonal here would make this assertion fail for reasons
    // unrelated to the orientation bug, so the deltas are picked to isolate
    // exactly the bug this test targets.
    const lat0 = 37.871;
    const cosLat0 = Math.cos((lat0 * Math.PI) / 180);
    const halfLatDelta = 0.001; // NW to SE spans 0.002 of latitude
    const halfLonDelta = halfLatDelta / cosLat0; // matching span in local-plane units

    const NW: ControlPoint = {
      x: 0,
      y: 0,
      lat: lat0 + halfLatDelta,
      lon: -122.2715 - halfLonDelta,
      label: 'NW',
    };
    const SE: ControlPoint = {
      x: 100,
      y: 100,
      lat: lat0 - halfLatDelta,
      lon: -122.2715 + halfLonDelta,
      label: 'SE',
    };
    const georef = makeGeoref([NW, SE]);

    it('places all four image corners at the correct lat/lon', () => {
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      const cases: { pixel: [number, number]; expected: { lat: number; lon: number } }[] = [
        { pixel: [0, 0], expected: { lat: NW.lat, lon: NW.lon } }, // NW
        { pixel: [100, 0], expected: { lat: NW.lat, lon: SE.lon } }, // NE
        { pixel: [0, 100], expected: { lat: SE.lat, lon: NW.lon } }, // SW
        { pixel: [100, 100], expected: { lat: SE.lat, lon: SE.lon } }, // SE
      ];

      for (const { pixel, expected } of cases) {
        const { lat, lon } = pixelToLatLon(t, pixel[0], pixel[1]);
        expect(lat).toBeCloseTo(expected.lat, 9);
        expect(lon).toBeCloseTo(expected.lon, 9);
      }
    });

    it('has a negative linear-part determinant, documenting that image->geo is orientation-reversing by construction', () => {
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      const det = t.a * t.e - t.b * t.d;
      expect(det).toBeLessThan(0);
    });
  });

  describe('4-point least-squares affine transform', () => {
    // Construct points that lie exactly on a single affine transform so the
    // least-squares fit reproduces them perfectly (overdetermined but
    // consistent system).
    // Affine map (in local tangent-plane units per percentage point):
    //   u = 0.00002 * x + 0.000005 * y - 0.001
    //   v = -0.000004 * x + 0.000018 * y + 0.0005
    const lat0 = BASE_LAT;
    const lon0 = BASE_LON;
    const cosLat0 = Math.cos((lat0 * Math.PI) / 180);

    const a = 0.00002;
    const b = 0.000005;
    const c = -0.001;
    const d = -0.000004;
    const e = 0.000018;
    const f = 0.0005;

    function exactLatLon(x: number, y: number): { lat: number; lon: number } {
      const u = a * x + b * y + c;
      const v = d * x + e * y + f;
      return { lat: lat0 + v, lon: lon0 + u / cosLat0 };
    }

    const pixelPoints: [number, number][] = [
      [5, 5],
      [95, 10],
      [50, 90],
      [30, 60],
    ];
    const controlPoints: ControlPoint[] = pixelPoints.map(([x, y], i) => {
      const { lat, lon } = exactLatLon(x, y);
      return { x, y, lat, lon, label: `cp${i}` };
    });
    const georef = makeGeoref(controlPoints);

    it('round-trips arbitrary points within 1e-6', () => {
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      const samples: [number, number][] = [
        [5, 5],
        [95, 10],
        [50, 90],
        [30, 60],
        [0, 0],
        [110, -10],
      ];

      for (const [x, y] of samples) {
        const { lat, lon } = pixelToLatLon(t, x, y);
        const back = latLonToPixel(t, lat, lon);
        expect(back.x).toBeCloseTo(x, 6);
        expect(back.y).toBeCloseTo(y, 6);
      }
    });

    it('hits all control points exactly (perfect least-squares fit)', () => {
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      for (const cp of controlPoints) {
        const { lat, lon } = pixelToLatLon(t, cp.x, cp.y);
        expect(lat).toBeCloseTo(cp.lat, 9);
        expect(lon).toBeCloseTo(cp.lon, 9);
      }
    });
  });

  describe('axis sanity', () => {
    it('increasing y (further down the image) yields decreasing latitude, on an axis-aligned north-up map', () => {
      // Axis-aligned, north-up rectangle: top of the image (y=0) is north
      // (higher latitude), bottom (y=100) is south (lower latitude); left
      // of the image (x=0) is west (lower longitude), right (x=100) is
      // east (higher longitude). Four corners, no rotation/shear, so the
      // affine solver fits this exactly.
      const latN = BASE_LAT + 0.001;
      const latS = BASE_LAT - 0.001;
      const lonW = BASE_LON - 0.001;
      const lonE = BASE_LON + 0.001;

      const controlPoints: ControlPoint[] = [
        { x: 0, y: 0, lat: latN, lon: lonW, label: 'top-left' },
        { x: 100, y: 0, lat: latN, lon: lonE, label: 'top-right' },
        { x: 0, y: 100, lat: latS, lon: lonW, label: 'bottom-left' },
        { x: 100, y: 100, lat: latS, lon: lonE, label: 'bottom-right' },
      ];
      const georef = makeGeoref(controlPoints);
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      const top = pixelToLatLon(t, 50, 10);
      const bottom = pixelToLatLon(t, 50, 90);
      expect(bottom.lat).toBeLessThan(top.lat);

      const left = pixelToLatLon(t, 10, 50);
      const right = pixelToLatLon(t, 90, 50);
      expect(right.lon).toBeGreaterThan(left.lon);
    });
  });

  describe('longitude scaling at high latitude', () => {
    it('round-trips correctly at lat0 = 60, where cos(lat0) materially shrinks longitude degrees', () => {
      const hiLat = 60;
      const lonDelta = 0.01; // known longitude delta between the two control points

      const controlPoints: ControlPoint[] = [
        { x: 0, y: 0, lat: hiLat, lon: -122.27, label: 'A' },
        { x: 100, y: 0, lat: hiLat, lon: -122.27 + lonDelta, label: 'B' },
      ];
      const georef = makeGeoref(controlPoints);
      const t = solveGeoreference(georef);
      expect(t).not.toBeNull();
      if (!t) return;

      // cosLat0 should be meaningfully less than 1 at lat 60.
      expect(t.cosLat0).toBeCloseTo(Math.cos((hiLat * Math.PI) / 180), 12);
      expect(t.cosLat0).toBeLessThan(0.6);

      // Control points must land exactly.
      for (const cp of controlPoints) {
        const { lat, lon } = pixelToLatLon(t, cp.x, cp.y);
        expect(lat).toBeCloseTo(cp.lat, 9);
        expect(lon).toBeCloseTo(cp.lon, 9);
      }

      // Round trip a midpoint.
      const mid = pixelToLatLon(t, 50, 0);
      const back = latLonToPixel(t, mid.lat, mid.lon);
      expect(back.x).toBeCloseTo(50, 6);
      expect(back.y).toBeCloseTo(0, 6);

      // Sanity: the longitude delta between the two control points, in
      // local-plane u units, should equal lonDelta * cos(lat0) — this is
      // exactly the computation that fails if cosLat0 is omitted.
      const uA = t.a * 0 + t.b * 0 + t.c;
      const uB = t.a * 100 + t.b * 0 + t.c;
      expect(uB - uA).toBeCloseTo(lonDelta * t.cosLat0, 9);
    });
  });

  describe('degenerate inputs return null', () => {
    it('returns null for an undefined georeference', () => {
      expect(solveGeoreference(undefined)).toBeNull();
    });

    it('returns null for zero control points', () => {
      expect(solveGeoreference(makeGeoref([]))).toBeNull();
    });

    it('returns null for a single control point', () => {
      expect(
        solveGeoreference(makeGeoref([{ x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON }]))
      ).toBeNull();
    });

    it('returns null for two coincident control points', () => {
      const controlPoints: ControlPoint[] = [
        { x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON, label: 'A' },
        { x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON, label: 'B (same spot)' },
      ];
      expect(solveGeoreference(makeGeoref(controlPoints))).toBeNull();
    });

    it('returns null for three collinear control points', () => {
      // All three points lie on the line x = y in image space, and
      // proportionally along a straight line in lat/lon — degenerate for
      // an affine fit (design matrix is singular).
      const controlPoints: ControlPoint[] = [
        { x: 10, y: 10, lat: BASE_LAT, lon: BASE_LON, label: 'A' },
        { x: 50, y: 50, lat: BASE_LAT - 0.001, lon: BASE_LON + 0.001, label: 'B' },
        { x: 90, y: 90, lat: BASE_LAT - 0.002, lon: BASE_LON + 0.002, label: 'C' },
      ];
      expect(solveGeoreference(makeGeoref(controlPoints))).toBeNull();
    });
  });
});

describe('postName / postPercent / postLatLon / layerPostsLatLon (derive-on-read Post accessors)', () => {
  function makeLayer(overrides: Partial<Layer> = {}): Layer {
    return {
      id: 'layer-1',
      name: 'Main Map',
      posts: [],
      ...overrides,
    };
  }

  // A simple axis-aligned, north-up georeference: top of the image (y=0) is
  // north, bottom (y=100) is south; left (x=0) is west, right (x=100) is
  // east. Reused across postLatLon / layerPostsLatLon tests below.
  const latN = BASE_LAT + 0.001;
  const latS = BASE_LAT - 0.001;
  const lonW = BASE_LON - 0.001;
  const lonE = BASE_LON + 0.001;
  const northUpControlPoints: ControlPoint[] = [
    { x: 0, y: 0, lat: latN, lon: lonW, label: 'top-left' },
    { x: 100, y: 0, lat: latN, lon: lonE, label: 'top-right' },
    { x: 0, y: 100, lat: latS, lon: lonW, label: 'bottom-left' },
    { x: 100, y: 100, lat: latS, lon: lonE, label: 'bottom-right' },
  ];
  const northUpGeoref = makeGeoref(northUpControlPoints);

  describe('postName', () => {
    it('returns the string itself for a legacy string post', () => {
      expect(postName('Gate A')).toBe('Gate A');
    });

    it("returns the object's name field for an object-form post", () => {
      expect(postName({ name: 'Medical Tent 3', x: 50, y: 50 })).toBe('Medical Tent 3');
    });
  });

  describe('postPercent', () => {
    it('returns null for a legacy string post', () => {
      expect(postPercent('Gate A')).toBeNull();
    });

    it('returns null when x is null', () => {
      expect(postPercent({ name: 'P', x: null, y: 50 })).toBeNull();
    });

    it('returns null when y is null', () => {
      expect(postPercent({ name: 'P', x: 50, y: null })).toBeNull();
    });

    it('returns null when both x and y are null', () => {
      expect(postPercent({ name: 'P', x: null, y: null })).toBeNull();
    });

    it('returns null when x is NaN', () => {
      expect(postPercent({ name: 'P', x: NaN, y: 50 })).toBeNull();
    });

    it('returns null when y is Infinity', () => {
      expect(postPercent({ name: 'P', x: 50, y: Infinity })).toBeNull();
    });

    it('returns coordinates for a valid post', () => {
      expect(postPercent({ name: 'P', x: 25, y: 75 })).toEqual({ x: 25, y: 75 });
    });
  });

  describe('postLatLon', () => {
    it('returns null when the layer has no georeference', () => {
      const layer = makeLayer({ posts: [{ name: 'P', x: 50, y: 50 }] });
      expect(postLatLon(layer, layer.posts[0])).toBeNull();
    });

    it('returns null when the georeference has fewer than 2 control points', () => {
      const layer = makeLayer({
        georeference: makeGeoref([{ x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON }]),
        posts: [{ name: 'P', x: 50, y: 50 }],
      });
      expect(postLatLon(layer, layer.posts[0])).toBeNull();
    });

    it('returns null when the georeference is degenerate (coincident control points)', () => {
      const layer = makeLayer({
        georeference: makeGeoref([
          { x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON, label: 'A' },
          { x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON, label: 'B (same spot)' },
        ]),
        posts: [{ name: 'P', x: 50, y: 50 }],
      });
      expect(postLatLon(layer, layer.posts[0])).toBeNull();
    });

    it('returns null for a string post, even with a valid georeference', () => {
      const layer = makeLayer({ georeference: northUpGeoref, posts: ['Gate A'] });
      expect(postLatLon(layer, layer.posts[0])).toBeNull();
    });

    it('returns null for a post with null coordinates, even with a valid georeference', () => {
      const layer = makeLayer({
        georeference: northUpGeoref,
        posts: [{ name: 'P', x: null, y: 50 }],
      });
      expect(postLatLon(layer, layer.posts[0])).toBeNull();
    });

    it('derives the correct lat/lon for a valid post', () => {
      const layer = makeLayer({
        georeference: northUpGeoref,
        posts: [{ name: 'Aid Station', x: 25, y: 75 }],
      });
      const post = layer.posts[0];

      const result = postLatLon(layer, post);
      expect(result).not.toBeNull();
      if (!result) return;

      // Independently computed expectation via the underlying transform.
      const t = solveGeoreference(northUpGeoref);
      expect(t).not.toBeNull();
      if (!t) return;
      const expected = pixelToLatLon(t, 25, 75);
      expect(result.lat).toBeCloseTo(expected.lat, 12);
      expect(result.lon).toBeCloseTo(expected.lon, 12);

      // Absolute sanity property: a post positioned in the upper half of
      // the image (small y) must derive to a latitude north of a post in
      // the lower half (large y), on this north-up map.
      const upperPost: Post = { name: 'Upper', x: 25, y: 10 };
      const lowerPost: Post = { name: 'Lower', x: 25, y: 90 };
      const upperResult = postLatLon(layer, upperPost);
      const lowerResult = postLatLon(layer, lowerPost);
      expect(upperResult).not.toBeNull();
      expect(lowerResult).not.toBeNull();
      if (!upperResult || !lowerResult) return;
      expect(upperResult.lat).toBeGreaterThan(lowerResult.lat);
    });
  });

  describe('layerPostsLatLon', () => {
    it('preserves order and length, matching locatable and non-locatable posts to the right slots', () => {
      const posts: Post[] = [
        'Gate A', // string post — always null
        { name: 'Aid Station', x: 25, y: 75 }, // valid
        { name: 'Unplaced', x: null, y: null }, // null coords
        { name: 'Overlook', x: 90, y: 10 }, // valid
        { name: 'Bad', x: NaN, y: 5 }, // non-finite
      ];
      const layer = makeLayer({ georeference: northUpGeoref, posts });

      const result = layerPostsLatLon(layer);
      expect(result).toHaveLength(posts.length);
      expect(result.map((r) => r.post)).toEqual(posts);
      expect(result.map((r) => r.name)).toEqual([
        'Gate A',
        'Aid Station',
        'Unplaced',
        'Overlook',
        'Bad',
      ]);

      expect(result[0].latLon).toBeNull();
      expect(result[1].latLon).not.toBeNull();
      expect(result[2].latLon).toBeNull();
      expect(result[3].latLon).not.toBeNull();
      expect(result[4].latLon).toBeNull();
    });

    it('returns all-null entries when the layer has no georeference', () => {
      const posts: Post[] = [{ name: 'A', x: 10, y: 10 }, { name: 'B', x: 90, y: 90 }, 'Legacy'];
      const layer = makeLayer({ posts });

      const result = layerPostsLatLon(layer);
      expect(result).toHaveLength(3);
      expect(result.every((r) => r.latLon === null)).toBe(true);
    });

    it('returns an empty array for an empty posts array', () => {
      const layer = makeLayer({ georeference: northUpGeoref, posts: [] });
      expect(layerPostsLatLon(layer)).toEqual([]);
    });

    it('treats undefined/null posts defensively as an empty array', () => {
      const layer = makeLayer({ georeference: northUpGeoref });
      // @ts-expect-error — deliberately simulating malformed live data where
      // posts is missing, to prove the accessor doesn't throw.
      layer.posts = undefined;
      expect(layerPostsLatLon(layer)).toEqual([]);
    });
  });

  describe('recalibration is live (derive-on-read, not stored)', () => {
    it('produces a different lat/lon for the same post after control points change', () => {
      const post: Post = { name: 'Fixed Post', x: 40, y: 60 };

      const layerA = makeLayer({ georeference: northUpGeoref, posts: [post] });
      const resultA = postLatLon(layerA, post);
      expect(resultA).not.toBeNull();

      // A second layer object, same post, DIFFERENT control points —
      // simulating an operator recalibrating the map.
      const shiftedLatN = BASE_LAT + 0.05;
      const shiftedLatS = BASE_LAT + 0.03;
      const shiftedLonW = BASE_LON + 0.05;
      const shiftedLonE = BASE_LON + 0.07;
      const recalibratedGeoref = makeGeoref([
        { x: 0, y: 0, lat: shiftedLatN, lon: shiftedLonW, label: 'top-left' },
        { x: 100, y: 0, lat: shiftedLatN, lon: shiftedLonE, label: 'top-right' },
        { x: 0, y: 100, lat: shiftedLatS, lon: shiftedLonW, label: 'bottom-left' },
        { x: 100, y: 100, lat: shiftedLatS, lon: shiftedLonE, label: 'bottom-right' },
      ]);
      const layerB = makeLayer({ georeference: recalibratedGeoref, posts: [post] });
      const resultB = postLatLon(layerB, post);
      expect(resultB).not.toBeNull();

      if (!resultA || !resultB) return;

      expect(resultB.lat).not.toBeCloseTo(resultA.lat, 3);
      expect(resultB.lon).not.toBeCloseTo(resultA.lon, 3);
    });
  });
});
