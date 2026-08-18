import { describe, expect, it } from 'vitest';

import type { ControlPoint, Georeference, Layer, Post } from '@/app/types';
import {
  georeferenceMapMatch,
  georeferenceResiduals,
  georeferenceStaleness,
  latLonToPixel,
  layerPostsLatLon,
  MAX_ACCEPTABLE_RESIDUAL_METRES,
  metresBetween,
  METRES_PER_DEGREE_LATITUDE,
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

    it('stamps the result with the georeference version that produced it', () => {
      const versionedGeoref: Georeference = { ...northUpGeoref, version: 7 };
      const layer = makeLayer({
        georeference: versionedGeoref,
        posts: [{ name: 'Aid Station', x: 25, y: 75 }],
      });

      const result = postLatLon(layer, layer.posts[0]);
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.georeferenceVersion).toBe(7);
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

    it('stamps every located entry with the layer\'s current georeference version', () => {
      const versionedGeoref: Georeference = { ...northUpGeoref, version: 3 };
      const posts: Post[] = [
        { name: 'Aid Station', x: 25, y: 75 },
        { name: 'Overlook', x: 90, y: 10 },
      ];
      const layer = makeLayer({ georeference: versionedGeoref, posts });

      const result = layerPostsLatLon(layer);
      expect(result[0].latLon?.georeferenceVersion).toBe(3);
      expect(result[1].latLon?.georeferenceVersion).toBe(3);
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

describe('georeferenceResiduals', () => {
  it('exports MAX_ACCEPTABLE_RESIDUAL_METRES as 25', () => {
    expect(MAX_ACCEPTABLE_RESIDUAL_METRES).toBe(25);
  });

  it('returns null for an undefined georeference', () => {
    expect(georeferenceResiduals(undefined)).toBeNull();
  });

  it('returns null for a single control point (same condition as solveGeoreference)', () => {
    expect(
      georeferenceResiduals(makeGeoref([{ x: 50, y: 50, lat: BASE_LAT, lon: BASE_LON }]))
    ).toBeNull();
  });

  it('returns null for a degenerate (collinear) control point set', () => {
    // Same three collinear points as the solveGeoreference degenerate test
    // above — the affine design matrix is singular, so there's no fitted
    // transform to measure residuals against.
    const controlPoints: ControlPoint[] = [
      { x: 10, y: 10, lat: BASE_LAT, lon: BASE_LON, label: 'A' },
      { x: 50, y: 50, lat: BASE_LAT - 0.001, lon: BASE_LON + 0.001, label: 'B' },
      { x: 90, y: 90, lat: BASE_LAT - 0.002, lon: BASE_LON + 0.002, label: 'C' },
    ];
    expect(georeferenceResiduals(makeGeoref(controlPoints))).toBeNull();
  });

  describe('exactly 2 control points (anti-similarity fit is exact)', () => {
    // The 2-point solver is a determined 4-DOF system solved directly from
    // the two points, not a least-squares fit over more data than
    // parameters — so by construction it passes through both points
    // exactly. Residuals here should be ~0 up to floating-point noise, not
    // merely "small", which is the whole reason 3+ points is a materially
    // different case worth reporting separately.
    const controlPoints: ControlPoint[] = [
      { x: 10, y: 20, lat: BASE_LAT, lon: BASE_LON, label: 'NW' },
      { x: 90, y: 80, lat: BASE_LAT - 0.002, lon: BASE_LON + 0.002, label: 'SE' },
    ];

    it('reports ~0 residuals for every point, and ~0 max/rms', () => {
      const result = georeferenceResiduals(makeGeoref(controlPoints));
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.perPoint).toHaveLength(2);
      for (const d of result.perPoint) {
        expect(d).toBeCloseTo(0, 6);
      }
      expect(result.maxMetres).toBeCloseTo(0, 6);
      expect(result.rmsMetres).toBeCloseTo(0, 6);
    });
  });

  describe('4+ control points (least-squares affine fit is generally inexact)', () => {
    // Base dataset: 7 points laid out symmetrically (four corners, a dead
    // center, and two off-diagonal points) all placed EXACTLY on a single
    // affine map, so a clean fit would reproduce every one of them with ~0
    // residual (same style as the "4-point least-squares affine transform"
    // dataset above, just with more points).
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
      [95, 5],
      [5, 95],
      [95, 95],
      [50, 50], // center — deliberately mismatched below
      [20, 80],
      [80, 20],
    ];

    it('gives a much larger residual to the one deliberately-mismatched point, at the correct index, and preserves perPoint length/order', () => {
      const perturbedIndex = 4; // pixelPoints[4] = [50, 50], the center point
      const latOffset = 0.02; // deliberately large vs. the ~0 misfit of the consistent points

      const controlPoints: ControlPoint[] = pixelPoints.map(([x, y], i) => {
        const { lat, lon } = exactLatLon(x, y);
        return {
          x,
          y,
          lat: i === perturbedIndex ? lat + latOffset : lat,
          lon,
          label: `cp${i}`,
        };
      });

      const result = georeferenceResiduals(makeGeoref(controlPoints));
      expect(result).not.toBeNull();
      if (!result) return;

      // perPoint tracks control points 1:1, in original order.
      expect(result.perPoint).toHaveLength(controlPoints.length);

      // The perturbed point's residual dominates every other point's by a
      // wide margin, and lands at the SAME index it was placed at (index 4)
      // — verifying georeferenceResiduals doesn't silently reorder or
      // misalign perPoint against controlPoints.
      for (let i = 0; i < pixelPoints.length; i++) {
        if (i === perturbedIndex) continue;
        expect(result.perPoint[perturbedIndex]).toBeGreaterThan(result.perPoint[i] * 5);
      }

      expect(result.maxMetres).toBeCloseTo(result.perPoint[perturbedIndex], 6);
      // rms can never exceed max — max is one of the terms being averaged
      // into it, and the others are non-negative.
      expect(result.rmsMetres).toBeLessThanOrEqual(result.maxMetres);
      // With 6 near-zero points and 1 large one, rms is well below max.
      expect(result.rmsMetres).toBeLessThan(result.maxMetres);
    });

    it('produces a residual close to the analytically-expected ground distance for a known latitude offset', () => {
      // A symmetric 4-corner square — (0,0) (100,0) (0,100) (100,100) — all
      // at the SAME longitude (so the u/longitude fit is exactly consistent:
      // zero residual on that axis for every point) and the SAME latitude,
      // except one corner offset by a known delta.
      //
      // solveAffine fits u and v completely independently (two separate
      // 3x3 normal-equations solves sharing only the x/y design matrix), so
      // perturbing only latitude only perturbs the v-fit. For this square,
      // the design matrix M = X^T X (X's rows are [x, y, 1]) works out to
      //   M = [[20000, 10000, 200], [10000, 20000, 200], [200, 200, 4]]
      // and the least-squares "hat" matrix H = X * M^-1 * X^T has, for this
      // symmetric configuration, H_ii = 0.75 at every corner (equal
      // leverage by symmetry; trace(H) = rank(X) = 3 = 4 * 0.75, which
      // checks out). Because the design includes a constant ("1") column,
      // H's rows each sum to 1 (a target of all-ones is fit exactly), which
      // reduces the residual at a single perturbed point of offset `delta`
      // to exactly `delta * (1 - H_ii)` regardless of the other points'
      // shared latitude value. So the expected residual is
      // `delta * (1 - 0.75) = 0.25 * delta` in latitude-degree-equivalent
      // v-units — converted to metres via METRES_PER_DEGREE_LATITUDE (no
      // cosLat0 factor: this offset is pure latitude/v, not longitude/u).
      const lonSame = BASE_LON;
      const latOffset = 0.001; // degrees of latitude

      const controlPoints: ControlPoint[] = [
        { x: 0, y: 0, lat: lat0, lon: lonSame, label: 'A' },
        { x: 100, y: 0, lat: lat0, lon: lonSame, label: 'B' },
        { x: 0, y: 100, lat: lat0, lon: lonSame, label: 'C' },
        { x: 100, y: 100, lat: lat0 + latOffset, lon: lonSame, label: 'D (offset)' },
      ];

      const result = georeferenceResiduals(makeGeoref(controlPoints));
      expect(result).not.toBeNull();
      if (!result) return;

      const expectedMetres = 0.25 * latOffset * METRES_PER_DEGREE_LATITUDE;
      expect(expectedMetres).toBeCloseTo(27.83, 2);

      expect(result.perPoint[3]).toBeCloseTo(expectedMetres, 4);
      expect(result.maxMetres).toBeCloseTo(expectedMetres, 4);
    });
  });
});

describe('metresBetween', () => {
  const controlPoints: ControlPoint[] = [
    { x: 10, y: 20, lat: BASE_LAT, lon: BASE_LON, label: 'NW' },
    { x: 90, y: 80, lat: BASE_LAT - 0.002, lon: BASE_LON + 0.002, label: 'SE' },
  ];
  const t = solveGeoreference(makeGeoref(controlPoints));

  it('returns 0 for the same point', () => {
    expect(t).not.toBeNull();
    if (!t) return;
    expect(metresBetween(t, BASE_LAT, BASE_LON, BASE_LAT, BASE_LON)).toBeCloseTo(0, 9);
  });

  it('matches latOffset * METRES_PER_DEGREE_LATITUDE for a pure-latitude delta (no cosLat0 involved)', () => {
    expect(t).not.toBeNull();
    if (!t) return;
    const latOffset = 0.001;
    const d = metresBetween(t, BASE_LAT, BASE_LON, BASE_LAT + latOffset, BASE_LON);
    expect(d).toBeCloseTo(latOffset * METRES_PER_DEGREE_LATITUDE, 6);
    expect(d).toBeCloseTo(111.32, 2);
  });

  it('matches lonOffset * cosLat0 * METRES_PER_DEGREE_LATITUDE for a pure-longitude delta', () => {
    expect(t).not.toBeNull();
    if (!t) return;
    const lonOffset = 0.001;
    const d = metresBetween(t, BASE_LAT, BASE_LON, BASE_LAT, BASE_LON + lonOffset);
    expect(d).toBeCloseTo(lonOffset * t.cosLat0 * METRES_PER_DEGREE_LATITUDE, 6);
  });

  it('is symmetric: swapping A and B gives the same distance', () => {
    expect(t).not.toBeNull();
    if (!t) return;
    const a = metresBetween(t, BASE_LAT, BASE_LON, BASE_LAT + 0.002, BASE_LON - 0.001);
    const b = metresBetween(t, BASE_LAT + 0.002, BASE_LON - 0.001, BASE_LAT, BASE_LON);
    expect(a).toBeCloseTo(b, 9);
  });

  it('combines lat and lon deltas via Pythagoras in the local tangent-plane frame', () => {
    expect(t).not.toBeNull();
    if (!t) return;
    // Pick a lat delta and a lon delta whose local-plane (v, u) components
    // form an exact 3-4-5 triangle in degree-equivalent units, so the
    // expected distance is hand-computable: 5 * METRES_PER_DEGREE_LATITUDE.
    const dv = 0.0003; // latitude delta directly in v-units
    const du = 0.0004; // desired u-units; back out the lon delta via cosLat0
    const lonOffset = du / t.cosLat0;
    const d = metresBetween(t, BASE_LAT, BASE_LON, BASE_LAT + dv, BASE_LON + lonOffset);
    expect(d).toBeCloseTo(0.0005 * METRES_PER_DEGREE_LATITUDE, 4);
  });

  it('reproduces georeferenceResiduals\' per-point figures (residuals is now built on top of this)', () => {
    // Regression guard for the georeferenceResiduals refactor: its perPoint
    // values must be unchanged now that they're computed via metresBetween
    // instead of an inline toLocalPlane diff.
    const georef = makeGeoref(controlPoints);
    const residuals = georeferenceResiduals(georef);
    expect(residuals).not.toBeNull();
    if (!residuals || !t) return;
    // 2-point anti-similarity fit passes through both control points
    // exactly, so residuals should be ~0 — confirmed already by the
    // dedicated georeferenceResiduals describe block above; this just
    // checks metresBetween agrees when fed the same fitted/entered pair.
    const fitted = pixelToLatLon(t, controlPoints[0].x, controlPoints[0].y);
    const d = metresBetween(t, fitted.lat, fitted.lon, controlPoints[0].lat, controlPoints[0].lon);
    expect(d).toBeCloseTo(residuals.perPoint[0], 9);
  });
});

describe('georeferenceStaleness', () => {
  it("returns 'fresh' when the stamped version matches the georeference's current version", () => {
    const georef: Georeference = { controlPoints: [], version: 2, updatedAt: 0 };
    expect(georeferenceStaleness(2, georef)).toBe('fresh');
  });

  it("returns 'stale' when the stamped version no longer matches — the operator recalibrated (or replaced the map image) since the coordinate was derived", () => {
    const georef: Georeference = { controlPoints: [], version: 4, updatedAt: 0 };
    expect(georeferenceStaleness(3, georef)).toBe('stale');
  });

  it("returns 'stale' even when the stamped version is NEWER than the current one (defensive: any mismatch is reported, not just 'behind')", () => {
    const georef: Georeference = { controlPoints: [], version: 1, updatedAt: 0 };
    expect(georeferenceStaleness(2, georef)).toBe('stale');
  });

  it("returns 'unknown' when the coordinate carries no stamp at all — a legacy/external value, not a proven mismatch", () => {
    const georef: Georeference = { controlPoints: [], version: 1, updatedAt: 0 };
    expect(georeferenceStaleness(undefined, georef)).toBe('unknown');
  });

  it("returns 'unknown' when there is no current georeference to compare against, even though the stamp itself is present", () => {
    expect(georeferenceStaleness(1, undefined)).toBe('unknown');
  });

  it("returns 'unknown' rather than 'stale', when both the stamp and the current georeference are entirely absent — 'no information' must not present as 'proven wrong'", () => {
    expect(georeferenceStaleness(undefined, undefined)).toBe('unknown');
  });

  it('integrates with postLatLon: a coordinate derived just now is always fresh against the layer it came from', () => {
    const georef: Georeference = {
      controlPoints: [
        { x: 0, y: 0, lat: 37.87, lon: -122.27, label: 'A' },
        { x: 100, y: 100, lat: 37.869, lon: -122.269, label: 'B' },
      ],
      version: 9,
      updatedAt: 0,
    };
    const layer: Layer = { id: 'layer-1', name: 'Main', posts: [], georeference: georef };
    const post: Post = { name: 'Aid Station', x: 50, y: 50 };

    const result = postLatLon(layer, post);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(georeferenceStaleness(result.georeferenceVersion, layer.georeference)).toBe('fresh');

    // Simulate the layer being recalibrated (or its map image swapped —
    // see the version-bump-on-mapUrl-replace fix in
    // venues/management/page.client.tsx) after the coordinate was derived:
    // the SAME stamped value is now stale against the layer's new version.
    const recalibratedLayer: Layer = {
      ...layer,
      georeference: { ...georef, version: 10 },
    };
    expect(georeferenceStaleness(result.georeferenceVersion, recalibratedLayer.georeference)).toBe(
      'stale'
    );
  });
});

describe('georeferenceMapMatch', () => {
  const pointsAt = (mapUrl: string | undefined): Georeference => ({
    controlPoints: [
      { x: 10, y: 10, lat: 37.87, lon: -122.26 },
      { x: 90, y: 90, lat: 37.88, lon: -122.25 },
    ],
    version: 3,
    updatedAt: 0,
    ...(mapUrl ? { calibratedForMapUrl: mapUrl } : {}),
  });

  it("returns 'fresh' when the layer's map image is the one the points were confirmed against", () => {
    const georef = pointsAt('venue_maps/1000_plan.png');
    expect(georeferenceMapMatch('venue_maps/1000_plan.png', georef)).toBe('fresh');
  });

  it("returns 'stale' when the map image was replaced after the points were placed", () => {
    const georef = pointsAt('venue_maps/1000_plan.png');
    expect(georeferenceMapMatch('venue_maps/2000_plan-v2.png', georef)).toBe('stale');
  });

  it("returns 'unknown' for a georeference written before calibratedForMapUrl existed — the entire pre-existing corpus must not be reported as broken", () => {
    const georef = pointsAt(undefined);
    expect(georeferenceMapMatch('venue_maps/1000_plan.png', georef)).toBe('unknown');
  });

  it("returns 'unknown' when the layer has no map image, rather than treating 'no image' as a mismatch", () => {
    const georef = pointsAt('venue_maps/1000_plan.png');
    expect(georeferenceMapMatch(undefined, georef)).toBe('unknown');
  });

  it("returns 'unknown' when there is no georeference at all", () => {
    expect(georeferenceMapMatch('venue_maps/1000_plan.png', undefined)).toBe('unknown');
  });

  it('reports a re-upload of the same file as stale, because uploads are timestamped into their path', () => {
    // venue_maps/{Date.now()}_{name} means byte-identical content lands at a
    // new URL. A false alarm, deliberately: it costs a re-confirmation of
    // points that were already right, which is the safe direction to err in.
    const georef = pointsAt('venue_maps/1000_plan.png');
    expect(georeferenceMapMatch('venue_maps/1755_plan.png', georef)).toBe('stale');
  });

  it('answers a different question from georeferenceStaleness: a layer can be map-stale while a freshly derived coordinate is version-fresh', () => {
    // The two checks are not interchangeable. A coordinate derived right now
    // carries the current version, so georeferenceStaleness says 'fresh' — it
    // only ever compares provenance. Whether the calibration itself still
    // describes the image underneath is what georeferenceMapMatch is for, and
    // it is the question the venue editor's banner had no way to ask before.
    const georef = pointsAt('venue_maps/1000_plan.png');
    const layer: Layer = {
      id: 'layer-1',
      name: 'Main',
      posts: [],
      mapUrl: 'venue_maps/2000_plan-v2.png',
      georeference: georef,
    };
    const result = postLatLon(layer, { name: 'Aid Station', x: 50, y: 50 });
    expect(result).not.toBeNull();
    if (!result) return;

    expect(georeferenceStaleness(result.georeferenceVersion, layer.georeference)).toBe('fresh');
    expect(georeferenceMapMatch(layer.mapUrl, layer.georeference)).toBe('stale');
  });
});
