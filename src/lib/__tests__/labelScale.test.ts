import { describe, expect, it } from 'vitest';

import {
  declutterLabels,
  edgeBadgeObstacles,
  EDGE_BADGE_MIN_SPACING_PX,
  EDGE_BADGE_SIZE_PX,
  estimateLabelBox,
  labelScreenScale,
  layoutEdgeBadges,
  LABEL_SCALE_EXPONENT,
  markerCounterScale,
  MAX_LABEL_SCREEN_SCALE,
  MIN_LABEL_SCREEN_SCALE,
  rectsOverlap,
  staggerOffsetPx,
  type LabelBox,
  type Rect,
} from '@/lib/labelScale';

// A sample of scales spanning (and slightly exceeding) the map's real zoom
// range (0.5x - 8x from venuemapmodal's MIN_MAP_SCALE / MAX_MAP_SCALE).
const SAMPLE_SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8];

describe('labelScreenScale / markerCounterScale: identity at mapScale = 1', () => {
  it('both return exactly 1 at mapScale = 1, for the default exponent', () => {
    expect(labelScreenScale(1)).toBe(1);
    expect(markerCounterScale(1)).toBe(1);
  });

  it('both return exactly 1 at mapScale = 1, across every exponent', () => {
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      expect(labelScreenScale(1, k)).toBe(1);
      expect(markerCounterScale(1, k)).toBe(1);
    }
  });
});

describe('labelScreenScale / markerCounterScale: exponent = 1 reproduces the OLD dispatch-map behaviour', () => {
  it('markerCounterScale(s, 1) === 1 / s (net screen scale constant at 1) for s in the unclamped range', () => {
    for (const s of SAMPLE_SCALES) {
      expect(labelScreenScale(s, 1)).toBeCloseTo(1, 9);
      expect(markerCounterScale(s, 1)).toBeCloseTo(1 / s, 9);
    }
  });
});

describe('labelScreenScale / markerCounterScale: exponent = 0 reproduces the OLD editor behaviour', () => {
  it('markerCounterScale(s, 0) === 1 and screen scale === s, within the clamp window', () => {
    // Restrict to scales inside [MIN_LABEL_SCREEN_SCALE, MAX_LABEL_SCREEN_SCALE]
    // so the clamp never fires and "screen scale === s" holds exactly.
    for (const s of [0.9, 1, 1.5, 2, 2.2]) {
      expect(labelScreenScale(s, 0)).toBeCloseTo(s, 9);
      expect(markerCounterScale(s, 0)).toBeCloseTo(1, 9);
    }
  });
});

describe('labelScreenScale: default exponent (0.5) gives net screen size = sqrt(mapScale) within the clamp window', () => {
  it('mapScale 4 -> 2', () => {
    expect(labelScreenScale(4)).toBeCloseTo(2, 9);
  });

  it('matches sqrt(mapScale) for other in-window scales', () => {
    for (const s of [1, 1.5, 2, 3]) {
      expect(labelScreenScale(s)).toBeCloseTo(Math.sqrt(s), 9);
    }
  });
});

describe('labelScreenScale / markerCounterScale: invariant markerCounterScale(s) * s === labelScreenScale(s)', () => {
  it('holds across many scales and exponents', () => {
    for (const s of [...SAMPLE_SCALES, 0.6, 1.25, 7]) {
      for (const k of [0, 0.25, LABEL_SCALE_EXPONENT, 0.75, 1]) {
        expect(markerCounterScale(s, k) * s).toBeCloseTo(labelScreenScale(s, k), 9);
      }
    }
  });
});

describe('labelScreenScale: clamps apply to the NET screen scale', () => {
  it('mapScale 8 with the default exponent is capped at MAX_LABEL_SCREEN_SCALE', () => {
    // Raw would be 8 ** 0.5 ≈ 2.83, above MAX_LABEL_SCREEN_SCALE (2.25).
    expect(Math.sqrt(8)).toBeGreaterThan(MAX_LABEL_SCREEN_SCALE);
    expect(labelScreenScale(8)).toBeCloseTo(MAX_LABEL_SCREEN_SCALE, 9);
  });

  it('mapScale 0.5 with the default exponent is floored at MIN_LABEL_SCREEN_SCALE', () => {
    // Raw would be 0.5 ** 0.5 ≈ 0.707, below MIN_LABEL_SCREEN_SCALE (0.85).
    expect(Math.sqrt(0.5)).toBeLessThan(MIN_LABEL_SCREEN_SCALE);
    expect(labelScreenScale(0.5)).toBeCloseTo(MIN_LABEL_SCREEN_SCALE, 9);
  });

  it('markerCounterScale reflects the same clamped net scale', () => {
    expect(markerCounterScale(8)).toBeCloseTo(MAX_LABEL_SCREEN_SCALE / 8, 9);
    expect(markerCounterScale(0.5)).toBeCloseTo(MIN_LABEL_SCREEN_SCALE / 0.5, 9);
  });
});

describe('labelScreenScale: monotonic non-decreasing in mapScale', () => {
  it('default exponent', () => {
    let prev = -Infinity;
    for (const s of SAMPLE_SCALES) {
      const v = labelScreenScale(s);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('holds for exponents 0 and 1 too', () => {
    for (const k of [0, 1]) {
      let prev = -Infinity;
      for (const s of SAMPLE_SCALES) {
        const v = labelScreenScale(s, k);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });
});

describe('labelScreenScale / markerCounterScale: garbage input is treated as scale 1', () => {
  const garbageInputs = [0, -3, NaN, Infinity, -Infinity];

  it('labelScreenScale never yields a non-finite or zero result, and equals the scale-1 value', () => {
    const atOne = labelScreenScale(1);
    for (const bad of garbageInputs) {
      const v = labelScreenScale(bad);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).not.toBe(0);
      expect(v).toBeCloseTo(atOne, 9);
    }
  });

  it('markerCounterScale never yields a non-finite or zero result, and equals the scale-1 value', () => {
    const atOne = markerCounterScale(1);
    for (const bad of garbageInputs) {
      const v = markerCounterScale(bad);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).not.toBe(0);
      expect(v).toBeCloseTo(atOne, 9);
    }
  });
});

describe('labelScreenScale / markerCounterScale: exponent outside 0..1 is clamped into range', () => {
  it('exponent below 0 behaves like exponent 0', () => {
    for (const s of [1.5, 4]) {
      expect(labelScreenScale(s, -1)).toBeCloseTo(labelScreenScale(s, 0), 9);
      expect(markerCounterScale(s, -5)).toBeCloseTo(markerCounterScale(s, 0), 9);
    }
  });

  it('exponent above 1 behaves like exponent 1', () => {
    for (const s of [1.5, 4]) {
      expect(labelScreenScale(s, 2)).toBeCloseTo(labelScreenScale(s, 1), 9);
      expect(markerCounterScale(s, 10)).toBeCloseTo(markerCounterScale(s, 1), 9);
    }
  });
});

describe('staggerOffsetPx', () => {
  it('tracks markerCounterScale: staggerOffsetPx(b, s) === b * markerCounterScale(s)', () => {
    for (const base of [4, 10, 16]) {
      for (const s of SAMPLE_SCALES) {
        expect(staggerOffsetPx(base, s)).toBeCloseTo(base * markerCounterScale(s), 9);
      }
    }
  });

  it('tracks markerCounterScale for a non-default exponent too', () => {
    expect(staggerOffsetPx(10, 4, 1)).toBeCloseTo(10 * markerCounterScale(4, 1), 9);
  });

  it('zero base stays zero, even for garbage scale', () => {
    expect(staggerOffsetPx(0, 4)).toBe(0);
    expect(staggerOffsetPx(0, NaN)).toBe(0);
    expect(staggerOffsetPx(0, -1)).toBe(0);
  });
});

describe('rectsOverlap', () => {
  const base: Rect = { x: 0, y: 0, width: 10, height: 10 };

  it('clearly overlapping rects', () => {
    const other: Rect = { x: 5, y: 5, width: 10, height: 10 };
    expect(rectsOverlap(base, other)).toBe(true);
  });

  it('clearly disjoint rects', () => {
    const other: Rect = { x: 100, y: 100, width: 10, height: 10 };
    expect(rectsOverlap(base, other)).toBe(false);
  });

  it('touching edges are NOT an overlap', () => {
    const rightNeighbor: Rect = { x: 10, y: 0, width: 10, height: 10 };
    expect(rectsOverlap(base, rightNeighbor)).toBe(false);

    const belowNeighbor: Rect = { x: 0, y: 10, width: 10, height: 10 };
    expect(rectsOverlap(base, belowNeighbor)).toBe(false);
  });

  it('containment counts as overlap', () => {
    const inner: Rect = { x: 2, y: 2, width: 3, height: 3 };
    expect(rectsOverlap(base, inner)).toBe(true);
  });

  it('is symmetric', () => {
    const pairs: [Rect, Rect][] = [
      [base, { x: 5, y: 5, width: 10, height: 10 }],
      [base, { x: 100, y: 100, width: 10, height: 10 }],
      [base, { x: 10, y: 0, width: 10, height: 10 }],
      [base, { x: 2, y: 2, width: 3, height: 3 }],
    ];
    for (const [a, b] of pairs) {
      expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a));
    }
  });
});

describe('declutterLabels', () => {
  function box(overrides: Partial<LabelBox> & Pick<LabelBox, 'id'>): LabelBox {
    return {
      centerX: 0,
      centerY: 0,
      width: 20,
      height: 10,
      priority: 0,
      ...overrides,
    };
  }

  it('returns a decision for every input id, including gated-out ones', () => {
    const labels: LabelBox[] = [
      box({ id: 'visible-1', centerX: 0, centerY: 0 }),
      box({ id: 'gated', centerX: 0, centerY: 0, minScale: 100 }),
      box({ id: 'hidden-by-collision', centerX: 0, centerY: 0, priority: -1 }),
    ];
    const result = declutterLabels(labels, 1);
    expect(result.size).toBe(labels.length);
    for (const label of labels) {
      expect(result.has(label.id)).toBe(true);
    }
  });

  it('non-overlapping labels are all visible', () => {
    const labels: LabelBox[] = [
      box({ id: 'a', centerX: 0, centerY: 0 }),
      box({ id: 'b', centerX: 1000, centerY: 0 }),
      box({ id: 'c', centerX: 0, centerY: 1000 }),
    ];
    const result = declutterLabels(labels, 1);
    expect(result.get('a')).toBe(true);
    expect(result.get('b')).toBe(true);
    expect(result.get('c')).toBe(true);
  });

  it('of two overlapping labels, the higher-priority one wins', () => {
    const labels: LabelBox[] = [
      box({ id: 'low', centerX: 0, centerY: 0, priority: 1 }),
      box({ id: 'high', centerX: 2, centerY: 0, priority: 5 }),
    ];
    const result = declutterLabels(labels, 1);
    expect(result.get('high')).toBe(true);
    expect(result.get('low')).toBe(false);
  });

  it('ties on priority break deterministically by id (ascending id wins), regardless of input order', () => {
    const a = box({ id: 'a-label', centerX: 0, centerY: 0, priority: 3 });
    const b = box({ id: 'b-label', centerX: 2, centerY: 0, priority: 3 });

    const forward = declutterLabels([a, b], 1);
    const reversed = declutterLabels([b, a], 1);

    expect(forward.get('a-label')).toBe(true);
    expect(forward.get('b-label')).toBe(false);
    expect(reversed.get('a-label')).toBe(true);
    expect(reversed.get('b-label')).toBe(false);
  });

  it('a label whose minScale exceeds the current mapScale is hidden regardless of priority, and does not block another label from its space', () => {
    const gated = box({ id: 'gated', centerX: 0, centerY: 0, priority: 100, minScale: 2 });
    const other = box({ id: 'other', centerX: 2, centerY: 0, priority: 1 });

    const result = declutterLabels([gated, other], 1);
    expect(result.get('gated')).toBe(false);
    // The gated label never entered the collision pass, so it must not have
    // reserved its space and blocked `other`.
    expect(result.get('other')).toBe(true);
  });

  it('the same label becomes visible once mapScale reaches minScale', () => {
    const gated = box({ id: 'gated', centerX: 0, centerY: 0, priority: 1, minScale: 2 });

    expect(declutterLabels([gated], 1.9).get('gated')).toBe(false);
    expect(declutterLabels([gated], 2).get('gated')).toBe(true);
    expect(declutterLabels([gated], 3).get('gated')).toBe(true);
  });

  it('obstacles are never hidden (they carry no id / visibility entry) and DO hide a colliding label', () => {
    const obstacle: Rect = { x: -5, y: -5, width: 10, height: 10 };
    const colliding = box({ id: 'colliding', centerX: 0, centerY: 0, priority: 100 });
    const clear = box({ id: 'clear', centerX: 1000, centerY: 1000, priority: 1 });

    const result = declutterLabels([colliding, clear], 1, { obstacles: [obstacle] });
    expect(result.get('colliding')).toBe(false);
    expect(result.get('clear')).toBe(true);
    // Only the two labels get entries — the obstacle itself is not addressable.
    expect(result.size).toBe(2);
  });

  it('empty input returns an empty map', () => {
    const result = declutterLabels([], 1);
    expect(result.size).toBe(0);
  });
});

describe('estimateLabelBox', () => {
  it('grows with text length', () => {
    const short = estimateLabelBox('abc', 14);
    const long = estimateLabelBox('a much longer label string', 14);
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.height).toBeCloseTo(short.height, 9);
  });

  it('grows with font size', () => {
    const small = estimateLabelBox('label', 12);
    const large = estimateLabelBox('label', 24);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.height).toBeGreaterThan(small.height);
  });

  it('is non-empty even for empty text (padding still counts)', () => {
    const { width, height } = estimateLabelBox('', 12);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});

describe('layoutEdgeBadges', () => {
  const rect: Rect = { x: 0, y: 0, width: 1000, height: 1000 };

  it('a single badge sits exactly at its edge point mapped into the rect', () => {
    const positions = layoutEdgeBadges([{ id: 'a', edge: { x: 50, y: 0 } }], rect, 1);
    const pos = positions.get('a');
    expect(pos).toBeDefined();
    expect(pos!.left).toBeCloseTo(500, 9);
    expect(pos!.top).toBeCloseTo(0, 9);
  });

  it('two badges on the SAME side within spacing get pushed apart to at least the min spacing, other axis unchanged', () => {
    // Top side: x=50 and x=51 -> 500px and 510px apart, 10px < 30px spacing.
    const positions = layoutEdgeBadges(
      [
        { id: 'a', edge: { x: 50, y: 0 } },
        { id: 'b', edge: { x: 51, y: 0 } },
      ],
      rect,
      1
    );
    const a = positions.get('a')!;
    const b = positions.get('b')!;
    expect(a.top).toBeCloseTo(0, 9);
    expect(b.top).toBeCloseTo(0, 9);
    expect(b.left - a.left).toBeGreaterThanOrEqual(EDGE_BADGE_MIN_SPACING_PX / 1 - 1e-9);
    expect(a.left).toBeCloseTo(500, 9);
    expect(b.left).toBeCloseTo(530, 9);
  });

  it('badges on DIFFERENT sides do not push each other', () => {
    const positions = layoutEdgeBadges(
      [
        { id: 'top-badge', edge: { x: 50, y: 0 } },
        { id: 'left-badge', edge: { x: 0, y: 50 } },
      ],
      rect,
      1
    );
    const top = positions.get('top-badge')!;
    const left = positions.get('left-badge')!;
    expect(top.left).toBeCloseTo(500, 9);
    expect(top.top).toBeCloseTo(0, 9);
    expect(left.left).toBeCloseTo(0, 9);
    expect(left.top).toBeCloseTo(500, 9);
  });

  it('fan spacing shrinks as mapScale grows', () => {
    const specs = [
      { id: 'a', edge: { x: 50, y: 0 } },
      { id: 'b', edge: { x: 51, y: 0 } },
    ];
    const atScale1 = layoutEdgeBadges(specs, rect, 1);
    const atScale2 = layoutEdgeBadges(specs, rect, 2);

    const gapAtScale1 = atScale1.get('b')!.left - atScale1.get('a')!.left;
    const gapAtScale2 = atScale2.get('b')!.left - atScale2.get('a')!.left;

    expect(gapAtScale1).toBeCloseTo(EDGE_BADGE_MIN_SPACING_PX / 1, 9);
    expect(gapAtScale2).toBeCloseTo(EDGE_BADGE_MIN_SPACING_PX / 2, 9);
    expect(gapAtScale2).toBeLessThan(gapAtScale1);
  });

  it('classifies y=0 as top, y=100 as bottom, x=0 as left (mid-y), x=100 as right (mid-y)', () => {
    const positions = layoutEdgeBadges(
      [
        { id: 'top', edge: { x: 50, y: 0 } },
        { id: 'bottom', edge: { x: 50, y: 100 } },
        { id: 'left', edge: { x: 0, y: 50 } },
        { id: 'right', edge: { x: 100, y: 50 } },
      ],
      rect,
      1
    );
    // Infer classification from which axis is fixed vs free is not directly
    // observable for a single badge per side, but the mapped position alone
    // confirms each point landed where its named side implies.
    expect(positions.get('top')).toEqual({ left: 500, top: 0 });
    expect(positions.get('bottom')).toEqual({ left: 500, top: 1000 });
    expect(positions.get('left')).toEqual({ left: 0, top: 500 });
    expect(positions.get('right')).toEqual({ left: 1000, top: 500 });
  });

  // The doc comment above the side-classification block states a corner
  // (x and y both on a boundary) "resolves to the vertical edge" (left/right).
  // The implementation checks `y` first (top/bottom) and only falls back to
  // `x` (left/right) when y is NOT on a boundary, so a true corner is
  // classified 'top' or 'bottom' — the opposite of what the comment claims.
  // See the bug reported at the end of this file; this test is intentionally
  // skipped rather than asserting the (currently false) documented contract.
  it('a corner resolves to the horizontal edge and fans along x', () => {
    // The y checks run first, so a point on two boundaries at once is
    // classified top/bottom rather than left/right. Pinned here because it is
    // a tie-break nothing else in the code makes obvious, and because the
    // module's comment used to claim the opposite.
    const positions = layoutEdgeBadges(
      [
        { id: 'a', edge: { x: 0, y: 0 } },
        { id: 'b', edge: { x: 0, y: 0 } },
      ],
      rect,
      1
    );
    const a = positions.get('a')!;
    const b = positions.get('b')!;
    expect(a.top).toBeCloseTo(b.top, 9);
    expect(Math.abs(b.left - a.left)).toBeGreaterThanOrEqual(
      EDGE_BADGE_MIN_SPACING_PX - 1e-9
    );
  });

  it('returns a position for every input id', () => {
    const specs = [
      { id: 'x1', edge: { x: 10, y: 0 } },
      { id: 'x2', edge: { x: 90, y: 0 } },
      { id: 'x3', edge: { x: 0, y: 50 } },
    ];
    const positions = layoutEdgeBadges(specs, rect, 1);
    expect(positions.size).toBe(specs.length);
    for (const spec of specs) {
      expect(positions.has(spec.id)).toBe(true);
    }
  });
});

describe('edgeBadgeObstacles', () => {
  it('produces one obstacle per position, centred on it', () => {
    const positions = new Map([
      ['a', { left: 100, top: 200 }],
      ['b', { left: 300, top: 400 }],
    ]);
    const obstacles = edgeBadgeObstacles(positions, 1);
    expect(obstacles).toHaveLength(2);

    const size = EDGE_BADGE_SIZE_PX / 1;
    const [a, b] = obstacles;
    expect(a.x).toBeCloseTo(100 - size / 2, 9);
    expect(a.y).toBeCloseTo(200 - size / 2, 9);
    expect(a.width).toBeCloseTo(size, 9);
    expect(a.height).toBeCloseTo(size, 9);
    expect(b.x).toBeCloseTo(300 - size / 2, 9);
    expect(b.y).toBeCloseTo(400 - size / 2, 9);
  });

  it('footprint shrinks as mapScale grows', () => {
    const positions = new Map([['a', { left: 0, top: 0 }]]);
    const atScale1 = edgeBadgeObstacles(positions, 1)[0];
    const atScale2 = edgeBadgeObstacles(positions, 2)[0];
    expect(atScale2.width).toBeLessThan(atScale1.width);
    expect(atScale2.height).toBeLessThan(atScale1.height);
    expect(atScale2.width).toBeCloseTo(EDGE_BADGE_SIZE_PX / 2, 9);
  });
});

describe('MIN_LABEL_SCREEN_SCALE / MAX_LABEL_SCREEN_SCALE sanity', () => {
  it('min is below 1, max is above 1 (both clamps can actually fire around the 1x baseline)', () => {
    expect(MIN_LABEL_SCREEN_SCALE).toBeLessThan(1);
    expect(MAX_LABEL_SCREEN_SCALE).toBeGreaterThan(1);
  });
});
