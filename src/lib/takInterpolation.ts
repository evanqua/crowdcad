import type { TakPosition, TakPathPoint } from '@/app/types';

/**
 * Geometry for animating a live TAK marker between position fixes.
 *
 * The problem this solves
 * ----------------------
 * A position arrives roughly once a second and the marker is drawn from raw
 * `left`/`top` pixels, so every update is a DOM teleport. Even with a perfect
 * one-second pipeline the dot hops, and a hopping dot reads as a broken feed —
 * during Phase 1 it was genuinely difficult to tell "the bridge is dropping
 * fixes" apart from "the marker never animates", because both look like this.
 *
 * So the marker is tweened between fixes instead. Two facts shape how:
 *
 * 1. **Positions carry a `path`.** The bridge sends the intermediate fixes it
 *    received since the last write, so the route between two positions is
 *    usually known rather than guessed. Following it means a unit rounding a
 *    corner rounds the corner, instead of cutting the chord across the building
 *    on it.
 *
 * 2. **Everything here is in map percentages**, the same units as `Post.x`/`y`,
 *    never pixels. Pan and zoom change the pixel rect continuously; tweening in
 *    pixels would make the marker lurch every time the dispatcher dragged the
 *    map. Percentages are invariant under both, so the conversion to pixels
 *    happens once, at render.
 *
 * The functions are pure and frame-independent — no clock, no rAF, no React —
 * so the awkward cases (a route of one point, a zero-length route, a fraction
 * past the end) are settled here rather than inside an animation callback.
 */

export interface TakPoint {
  x: number;
  y: number;
}

/**
 * Below this, two fixes are the same place and tweening between them is
 * meaningless. In map percentages: 0.01% of a campus-scale map is a few
 * centimetres of ground, far under GPS resolution.
 */
const EPSILON = 0.01;

/**
 * A jump this large is not movement. Reconnecting devices, a re-bound callsign,
 * and a unit that was off-map and came back all produce one, and easing across
 * it would draw a smooth journey the unit never made — a more convincing lie
 * than the teleport it replaced. 25% of the map's width is far beyond what
 * anything can cover in one update interval.
 */
const SNAP_DISTANCE = 25;

/** Shortest tween. Below this the animation is not perceptible anyway. */
const MIN_TWEEN_MS = 150;

/**
 * Longest tween. A tween outliving its data is the failure mode to avoid here:
 * the marker would keep gliding confidently long after the feed went quiet,
 * which is exactly when a dispatcher most needs to see that it has stopped.
 * Past this, the marker arrives and waits for the truth.
 */
const MAX_TWEEN_MS = 3000;

/**
 * How long to spend animating to a new fix, given the gap since the previous
 * one arrived.
 *
 * Pacing off the *observed* gap rather than a fixed duration is what keeps the
 * motion continuous: the marker takes about as long to travel as the feed takes
 * to produce the next position, so it arrives just as the next one lands and
 * never sits still between updates or lags further behind with each one.
 */
export function tweenDurationMs(gapMs: number): number {
  if (!Number.isFinite(gapMs) || gapMs <= 0) return MIN_TWEEN_MS;
  return Math.min(MAX_TWEEN_MS, Math.max(MIN_TWEEN_MS, gapMs));
}

/**
 * The waypoints to animate through to reach `tak`, starting from `from`.
 *
 * Returns the destination alone when there is nothing to animate — no previous
 * position, or a jump too large to be movement — which the caller reads as
 * "snap". Duplicate and near-duplicate consecutive points are dropped: a
 * stationary phone's path is a cluster of identical fixes, and leaving them in
 * would spend most of the tween's time budget standing still.
 */
export function buildRoute(from: TakPoint | null, tak: TakPosition): TakPoint[] {
  if (tak.x == null || tak.y == null) return [];
  const destination: TakPoint = { x: tak.x, y: tak.y };
  if (!from) return [destination];
  if (distance(from, destination) > SNAP_DISTANCE) return [destination];

  const route: TakPoint[] = [from];
  for (const point of sortPath(tak.path)) {
    const previous = route[route.length - 1];
    if (distance(previous, point) < EPSILON) continue;
    route.push({ x: point.x, y: point.y });
  }
  const last = route[route.length - 1];
  if (distance(last, destination) >= EPSILON) route.push(destination);

  // Nothing moved: the unit is where it already was.
  return route.length > 1 ? route : [destination];
}

/**
 * Path points in chronological order, defensively.
 *
 * The bridge writes them in order, but they arrive as untyped JSON from a
 * database, and a path that plays backwards would send the marker on a visible
 * round trip. Points with unusable coordinates are dropped rather than
 * defaulted — a NaN reaching the transform silently removes the marker from the
 * page, and there is no way to tell that apart from the unit going off-map.
 */
function sortPath(path: TakPathPoint[] | undefined): TakPathPoint[] {
  if (!Array.isArray(path) || path.length === 0) return [];
  return path
    .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

export function distance(a: TakPoint, b: TakPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * The point `fraction` of the way along `route`, measured by distance travelled
 * rather than by waypoint count.
 *
 * By arc length, not by index, because the waypoints are not evenly spaced: a
 * unit that pauses produces a cluster of fixes in one spot, and advancing one
 * waypoint per equal slice of time would crawl through the cluster and then
 * sprint across the gap after it. Constant speed is both smoother and closer to
 * what the unit did.
 *
 * `fraction` is clamped, so a caller that overruns its own animation window
 * lands exactly on the destination instead of extrapolating past it.
 */
export function pointAlongRoute(route: TakPoint[], fraction: number): TakPoint {
  if (route.length === 0) return { x: 0, y: 0 };
  if (route.length === 1) return route[0];

  const clamped = Math.min(1, Math.max(0, fraction));

  let total = 0;
  for (let i = 1; i < route.length; i += 1) total += distance(route[i - 1], route[i]);
  // Every waypoint is the same place; there is no direction to move in.
  if (total < EPSILON) return route[route.length - 1];

  let travelled = clamped * total;
  for (let i = 1; i < route.length; i += 1) {
    const segment = distance(route[i - 1], route[i]);
    if (travelled <= segment || i === route.length - 1) {
      const along = segment > 0 ? Math.min(1, travelled / segment) : 1;
      return {
        x: route[i - 1].x + (route[i].x - route[i - 1].x) * along,
        y: route[i - 1].y + (route[i].y - route[i - 1].y) * along,
      };
    }
    travelled -= segment;
  }
  return route[route.length - 1];
}

/**
 * Ease-out, so the marker decelerates into each fix.
 *
 * Linear motion between fixes looks mechanical and, worse, makes the marker
 * appear to change speed abruptly at every waypoint the route passes through.
 * Easing out also means the visible error is largest early in the tween, when
 * the fix is freshest and the guess is best, and smallest at the end, where the
 * marker is sitting on a position that was actually reported.
 */
export function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) * (1 - clamped);
}
