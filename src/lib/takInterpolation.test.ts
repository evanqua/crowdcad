/**
 * takInterpolation.test.ts — pin down how the live marker moves between fixes.
 *
 * Run with:  npm run test:unit
 *
 * Runs under vitest via `npm run test:unit`. That is deliberate: the repo's
 * only other test runner is Playwright, and none of the behaviour below is
 * reachable from a browser test without a phone on a FreeTAKServer walking
 * across a real campus.
 *
 * Every case here is one that looks, on screen, exactly like a GPS problem. A
 * marker that slides through a building, drifts across the map on reconnect,
 * crawls and then sprints, or vanishes entirely all read as "the feed is
 * flaky". They are not; they are geometry, and geometry can be checked in a
 * second without leaving the desk.
 */

import { describe, expect, it } from 'vitest';

import type { TakPosition, TakPathPoint } from '@/app/types';
import {
  buildRoute,
  distance,
  easeOut,
  pointAlongRoute,
  tweenDurationMs,
  type TakPoint,
} from './takInterpolation';

/** A position at map percentages `x`,`y`, optionally carrying a trail. */
function pos(x: number, y: number, path?: TakPathPoint[]): TakPosition {
  return { lat: 0, lon: 0, x, y, onMap: true, timestamp: 0, ...(path ? { path } : {}) };
}

describe('building the route', () => {
  it('the first fix snaps, because there is nowhere to travel from', () => {
    expect(buildRoute(null, pos(10, 20))).toEqual([{ x: 10, y: 20 }]);
  });

  it('with no trail, the route is a straight line from here to there', () => {
    expect(buildRoute({ x: 0, y: 0 }, pos(10, 0))).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('the trail is walked in time order, whatever order it arrives in', () => {
    const route = buildRoute(
      { x: 0, y: 0 },
      pos(10, 10, [
        { x: 10, y: 0, t: 2 },
        { x: 5, y: 0, t: 1 },
      ]),
    );
    expect(route).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it('a corner is rounded rather than cut', () => {
    // This is the whole point of sending a trail. Without it the marker tweens
    // along the chord, straight through whatever the unit walked around.
    const route = buildRoute({ x: 0, y: 0 }, pos(10, 10, [{ x: 10, y: 0, t: 1 }]));
    const midpoint = pointAlongRoute(route, 0.5);
    expect(midpoint, 'halfway along the route is the corner').toEqual({ x: 10, y: 0 });

    const chord = pointAlongRoute([{ x: 0, y: 0 }, { x: 10, y: 10 }], 0.5);
    expect(distance(midpoint, chord) > 5, 'and it is nowhere near the straight line').toBeTruthy();
  });

  it('a jump too large to be movement snaps instead of sliding', () => {
    // A reconnecting device, a re-bound callsign, or a unit returning from
    // off-map. Easing across a quarter of the campus would draw a confident,
    // smooth journey that never happened.
    expect(buildRoute({ x: 0, y: 0 }, pos(90, 90))).toEqual([{ x: 90, y: 90 }]);
  });

  it('a stationary unit produces nothing to animate', () => {
    const route = buildRoute(
      { x: 5, y: 5 },
      pos(5, 5, [
        { x: 5, y: 5, t: 1 },
        { x: 5.001, y: 5, t: 2 },
      ]),
    );
    expect(route.length, 'GPS wander must not become perpetual motion').toBe(1);
  });

  it('repeated trail points collapse', () => {
    const route = buildRoute(
      { x: 0, y: 0 },
      pos(10, 0, [
        { x: 5, y: 0, t: 1 },
        { x: 5, y: 0, t: 2 },
        { x: 5, y: 0, t: 3 },
      ]),
    );
    expect(route).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
  });

  it('unusable trail points are dropped, never defaulted', () => {
    // A NaN reaching the CSS transform removes the marker from the page, which
    // is indistinguishable from the unit having gone off-map.
    const route = buildRoute(
      { x: 0, y: 0 },
      pos(10, 0, [
        { x: NaN, y: 0, t: 1 },
        { x: 5, y: 0, t: 2 },
      ]),
    );
    expect(route).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
  });

  it('a position with no projection yields no route', () => {
    const offMap: TakPosition = { lat: 0, lon: 0, x: null, y: null, onMap: false, timestamp: 0 };
    expect(buildRoute({ x: 1, y: 1 }, offMap)).toEqual([]);
  });
});

describe('walking the route', () => {
  it('progress is by distance travelled, not by waypoint count', () => {
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
    expect(Math.abs(midpoint.x - 50) < 0.5, `expected ~50, got ${midpoint.x}`).toBeTruthy();
  });

  it('the marker never runs past the newest reported position', () => {
    const route: TakPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(pointAlongRoute(route, -5)).toEqual({ x: 0, y: 0 });
    expect(pointAlongRoute(route, 5), 'no extrapolation').toEqual({ x: 10, y: 0 });
  });

  it('a zero-length route resolves to its endpoint rather than NaN', () => {
    expect(pointAlongRoute([{ x: 3, y: 4 }, { x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4 });
    expect(pointAlongRoute([{ x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4 });
  });
});

describe('pacing', () => {
  it('the tween is paced by the observed gap between fixes', () => {
    expect(tweenDurationMs(1000), 'a 1 s feed animates over 1 s').toBe(1000);
    expect(tweenDurationMs(50), 'floored where animation stops being visible').toBe(150);
    expect(tweenDurationMs(0), 'the first fix has no gap to measure').toBe(150);
    expect(tweenDurationMs(NaN)).toBe(150);
  });

  it('a dead feed does not keep the marker gliding', () => {
    // Capped, so a marker cannot spend a minute confidently travelling on the
    // strength of one position — which is precisely when a dispatcher needs to
    // see that it has stopped.
    expect(tweenDurationMs(60_000)).toBe(3000);
  });

  it('the easing decelerates into the fix, and is pinned at both ends', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5) > 0.5, 'most of the distance is covered early').toBeTruthy();

    let previous = -1;
    for (let i = 0; i <= 20; i += 1) {
      const value = easeOut(i / 20);
      expect(value >= previous, 'the marker never moves backwards').toBeTruthy();
      previous = value;
    }
  });
});
