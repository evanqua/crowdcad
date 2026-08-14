'use client';

import { useEffect, useRef, useState } from 'react';
import type { TakPosition } from '@/app/types';
import {
  buildRoute,
  easeOut,
  pointAlongRoute,
  tweenDurationMs,
  type TakPoint,
} from '@/lib/takInterpolation';

/**
 * Animate a live TAK marker between position fixes.
 *
 * Returns the point to draw right now, in map percentages — the same units as
 * `TakPosition.x`/`y`, so the caller converts to pixels exactly as it did
 * before. Returns null when there is nothing to draw.
 *
 * Positions arrive about once a second and used to be applied straight to
 * `left`/`top`, which made every update a teleport. This walks the marker
 * between them instead, through the intermediate fixes on `tak.path` when the
 * bridge sent any, pacing each leg to the observed gap between fixes so the
 * marker arrives about when the next position does.
 *
 * What it deliberately does not do
 * --------------------------------
 * Extrapolate. The marker never moves ahead of a reported position — it only
 * travels between two of them, and stops on the newest. A dot that keeps
 * gliding after the feed dies is worse than one that visibly stops, because
 * "the unit is walking north" and "the pipeline is down" would then look
 * identical, and only one of those is a reason to send someone.
 */
export function useTakTween(tak: TakPosition | undefined): TakPoint | null {
  const [point, setPoint] = useState<TakPoint | null>(null);

  // The drawn position, kept in a ref as well as state: a new fix has to start
  // its route from wherever the marker actually is mid-tween, and reading that
  // from state inside the effect would reintroduce the animation as a
  // dependency and restart it on every frame.
  const renderedRef = useRef<TakPoint | null>(null);
  const lastArrivalRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const x = tak?.x ?? null;
  const y = tak?.y ?? null;
  const timestamp = tak?.timestamp;

  useEffect(() => {
    if (!tak || x == null || y == null) {
      renderedRef.current = null;
      lastArrivalRef.current = null;
      setPoint(null);
      return;
    }

    // Pace off arrival time, not the fix's own timestamp. The timestamp comes
    // from the bridge's clock and this runs on the dispatcher's, so the
    // difference between two of them is meaningful but their absolute values
    // are not comparable — and it is the arrival rate that the animation has to
    // keep up with anyway.
    const arrivedAt = Date.now();
    const previousArrival = lastArrivalRef.current;
    lastArrivalRef.current = arrivedAt;

    const route = buildRoute(renderedRef.current, tak);
    if (route.length === 0) return;

    const settle = (at: TakPoint) => {
      renderedRef.current = at;
      setPoint(at);
    };

    // Snap on the first fix, on a jump too large to be movement, and whenever
    // the viewer has asked for reduced motion. The last is not a courtesy: for
    // a viewer prone to motion sickness a constantly gliding dot is a real
    // problem, and the position is just as legible without the animation.
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (route.length === 1 || reduceMotion) {
      settle(route[route.length - 1]);
      return;
    }

    const duration = tweenDurationMs(previousArrival ? arrivedAt - previousArrival : 0);
    const start =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    const step = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= duration) {
        settle(route[route.length - 1]);
        frameRef.current = null;
        return;
      }
      const at = pointAlongRoute(route, easeOut(elapsed / duration));
      renderedRef.current = at;
      setPoint(at);
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
    // Keyed on the fix itself. `timestamp` identifies a position uniquely, and
    // x/y are here so a re-send of the same timestamp at a new place is not
    // ignored. `tak` is read inside for its path but is a fresh object on every
    // snapshot, so depending on it would restart the tween continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timestamp, x, y]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  return point;
}
