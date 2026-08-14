/**
 * takInterpolation.test.ts — pin down how the live marker moves between fixes.
 *
 * Run with:  npm run test:unit
 *
 * Node 24 strips the types itself, so this needs no test framework, no
 * transform and no config. That is deliberate: the repo's only test runner is
 * Playwright, and none of the behaviour below is reachable from a browser test
 * without a phone on a FreeTAKServer walking across a real campus.
 *
 * Every case here is one that looks, on screen, exactly like a GPS problem. A
 * marker that slides through a building, drifts across the map on reconnect,
 * crawls and then sprints, or vanishes entirely all read as "the feed is
 * flaky". They are not; they are geometry, and geometry can be checked in a
 * second without leaving the desk.
 */

import assert from 'node:assert';
import type { TakPosition, TakPathPoint } from '@/app/types';
import {
  buildRoute,
  distance,
  easeOut,
  pointAlongRoute,
  tweenDurationMs,
  type TakPoint,
} from './takInterpolation.ts';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

/** A position at map percentages `x`,`y`, optionally carrying a trail. */
function pos(x: number, y: number, path?: TakPathPoint[]): TakPosition {
  return { lat: 0, lon: 0, x, y, onMap: true, timestamp: 0, ...(path ? { path } : {}) };
}

// --- building the route ------------------------------------------------------

test('the first fix snaps, because there is nowhere to travel from', () => {
  assert.deepStrictEqual(buildRoute(null, pos(10, 20)), [{ x: 10, y: 20 }]);
});

test('with no trail, the route is a straight line from here to there', () => {
  assert.deepStrictEqual(buildRoute({ x: 0, y: 0 }, pos(10, 0)), [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ]);
});

test('the trail is walked in time order, whatever order it arrives in', () => {
  const route = buildRoute(
    { x: 0, y: 0 },
    pos(10, 10, [
      { x: 10, y: 0, t: 2 },
      { x: 5, y: 0, t: 1 },
    ]),
  );
  assert.deepStrictEqual(route, [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]);
});

test('a corner is rounded rather than cut', () => {
  // This is the whole point of sending a trail. Without it the marker tweens
  // along the chord, straight through whatever the unit walked around.
  const route = buildRoute({ x: 0, y: 0 }, pos(10, 10, [{ x: 10, y: 0, t: 1 }]));
  const midpoint = pointAlongRoute(route, 0.5);
  assert.deepStrictEqual(midpoint, { x: 10, y: 0 }, 'halfway along the route is the corner');

  const chord = pointAlongRoute([{ x: 0, y: 0 }, { x: 10, y: 10 }], 0.5);
  assert.ok(distance(midpoint, chord) > 5, 'and it is nowhere near the straight line');
});

test('a jump too large to be movement snaps instead of sliding', () => {
  // A reconnecting device, a re-bound callsign, or a unit returning from
  // off-map. Easing across a quarter of the campus would draw a confident,
  // smooth journey that never happened.
  assert.deepStrictEqual(buildRoute({ x: 0, y: 0 }, pos(90, 90)), [{ x: 90, y: 90 }]);
});

test('a stationary unit produces nothing to animate', () => {
  const route = buildRoute(
    { x: 5, y: 5 },
    pos(5, 5, [
      { x: 5, y: 5, t: 1 },
      { x: 5.001, y: 5, t: 2 },
    ]),
  );
  assert.strictEqual(route.length, 1, 'GPS wander must not become perpetual motion');
});

test('repeated trail points collapse', () => {
  const route = buildRoute(
    { x: 0, y: 0 },
    pos(10, 0, [
      { x: 5, y: 0, t: 1 },
      { x: 5, y: 0, t: 2 },
      { x: 5, y: 0, t: 3 },
    ]),
  );
  assert.deepStrictEqual(route, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
});

test('unusable trail points are dropped, never defaulted', () => {
  // A NaN reaching the CSS transform removes the marker from the page, which
  // is indistinguishable from the unit having gone off-map.
  const route = buildRoute(
    { x: 0, y: 0 },
    pos(10, 0, [
      { x: NaN, y: 0, t: 1 },
      { x: 5, y: 0, t: 2 },
    ]),
  );
  assert.deepStrictEqual(route, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
});

test('a position with no projection yields no route', () => {
  const offMap: TakPosition = { lat: 0, lon: 0, x: null, y: null, onMap: false, timestamp: 0 };
  assert.deepStrictEqual(buildRoute({ x: 1, y: 1 }, offMap), []);
});

// --- walking the route -------------------------------------------------------

test('progress is by distance travelled, not by waypoint count', () => {
  // Four fixes bunched at the start and then one long leg — a unit that paused
  // and then moved off. Advancing a waypoint per equal slice of time would
  // crawl through the cluster and then sprint across the gap.
  const route: TakPoint[] = [
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.2, y: 0 },
    { x: 0.3, y: 0 },
    { x: 100, y: 0 },
  ];
  const midpoint = pointAlongRoute(route, 0.5);
  assert.ok(Math.abs(midpoint.x - 50) < 0.5, `expected ~50, got ${midpoint.x}`);
});

test('the marker never runs past the newest reported position', () => {
  const route: TakPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  assert.deepStrictEqual(pointAlongRoute(route, -5), { x: 0, y: 0 });
  assert.deepStrictEqual(pointAlongRoute(route, 5), { x: 10, y: 0 }, 'no extrapolation');
});

test('a zero-length route resolves to its endpoint rather than NaN', () => {
  assert.deepStrictEqual(pointAlongRoute([{ x: 3, y: 4 }, { x: 3, y: 4 }], 0.5), { x: 3, y: 4 });
  assert.deepStrictEqual(pointAlongRoute([{ x: 3, y: 4 }], 0.5), { x: 3, y: 4 });
});

// --- pacing ------------------------------------------------------------------

test('the tween is paced by the observed gap between fixes', () => {
  assert.strictEqual(tweenDurationMs(1000), 1000, 'a 1 s feed animates over 1 s');
  assert.strictEqual(tweenDurationMs(50), 150, 'floored where animation stops being visible');
  assert.strictEqual(tweenDurationMs(0), 150, 'the first fix has no gap to measure');
  assert.strictEqual(tweenDurationMs(NaN), 150);
});

test('a dead feed does not keep the marker gliding', () => {
  // Capped, so a marker cannot spend a minute confidently travelling on the
  // strength of one position — which is precisely when a dispatcher needs to
  // see that it has stopped.
  assert.strictEqual(tweenDurationMs(60_000), 3000);
});

test('the easing decelerates into the fix, and is pinned at both ends', () => {
  assert.strictEqual(easeOut(0), 0);
  assert.strictEqual(easeOut(1), 1);
  assert.ok(easeOut(0.5) > 0.5, 'most of the distance is covered early');

  let previous = -1;
  for (let i = 0; i <= 20; i += 1) {
    const value = easeOut(i / 20);
    assert.ok(value >= previous, 'the marker never moves backwards');
    previous = value;
  }
});

console.log(`\n${passed} passed${process.exitCode ? ', with failures above' : ''}`);
