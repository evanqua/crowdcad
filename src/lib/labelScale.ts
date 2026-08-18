/**
 * How markers and their labels behave as the venue map zooms.
 *
 * The venue map is a raster image inside a CSS `transform: scale()`. That
 * leaves exactly one decision for anything drawn on top of it, and until now
 * the two surfaces that draw on top made it in opposite directions without
 * either being a decision:
 *
 *   - the dispatch map (`venuemapmodal.tsx`) counter-scaled every marker by
 *     `1 / mapScale`, so markers stayed a constant size on screen while the
 *     image under them grew;
 *   - the venue editor (`venues/management/page.client.tsx`) applied no
 *     counter-scale at all, so markers grew in lockstep with the image.
 *
 * Both are endpoints of one parameter. Writing the applied transform as
 * `mapScale ** -k`, the marker's *net* on-screen size is `mapScale ** (1 - k)`:
 * `k = 1` is the dispatch map's constant size, `k = 0` is the editor's
 * grow-with-the-raster, and anything between is a real map's behaviour, where
 * zooming in mostly reveals detail and only somewhat magnifies it. The default
 * here is `k = 0.5` — net size grows as the square root of zoom.
 *
 * The reason this is a product decision and not a styling one: a screenshot's
 * baked-in place names are frozen. They cannot re-rank, cannot move out of
 * each other's way, and cannot reveal more of themselves as you zoom. The
 * labels CrowdCAD draws *can*, and the three mechanisms below are what makes
 * them behave like map labels rather than like stickers on a photo:
 *
 *   (a) sub-linear scaling      -> `labelScreenScale` / `markerCounterScale`
 *   (b) collision declutter     -> `declutterLabels`
 *   (c) zoom-gated detail       -> `minScale` on a label, `SECONDARY_LABEL_MIN_SCALE`
 *
 * Everything here is pure and unit-tested (`labelScale.test.ts`). There is no
 * component-test harness in this repo, so geometry that is not in a module
 * like this one is geometry that is not covered.
 */

/**
 * The share of the zoom a marker absorbs. 0 = grow with the raster,
 * 1 = constant on-screen size, 0.5 = net square-root growth.
 */
export const LABEL_SCALE_EXPONENT = 0.5;

/**
 * Clamps on the *net on-screen* size multiple, not on the applied transform.
 * Clamping the transform would let the visible result run away at the far
 * ends of the zoom range, which is the thing the clamp exists to prevent.
 *
 * The map's zoom range is 0.5x to 8x (MIN_MAP_SCALE / MAX_MAP_SCALE in
 * venuemapmodal). At k = 0.5 that is a raw net range of 0.71x to 2.83x; the
 * lower clamp keeps a fully zoomed-out marker from dropping below legible,
 * and the upper one keeps a fully zoomed-in marker from swallowing the post
 * it is marking.
 */
export const MIN_LABEL_SCREEN_SCALE = 0.85;
export const MAX_LABEL_SCREEN_SCALE = 2.25;

/**
 * Zoom at or above which secondary labels appear. Below it only primary
 * labels draw, so a zoomed-out map reads as a map rather than as a word
 * cloud. Chosen to sit just above the 1.5x first zoom step, so exactly one
 * click of zoom-in reveals the second tier.
 */
export const SECONDARY_LABEL_MIN_SCALE = 1.6;

function sanitizeScale(mapScale: number): number {
  // A zero, negative or non-finite scale is a bug upstream, but it must not
  // become a division by zero that removes every marker from the map.
  if (!Number.isFinite(mapScale) || mapScale <= 0) return 1;
  return mapScale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The net on-screen size multiple for a marker or label at this zoom:
 * `clamp(mapScale ** (1 - exponent))`. 1 means "the size it is at 1x zoom".
 */
export function labelScreenScale(
  mapScale: number,
  exponent: number = LABEL_SCALE_EXPONENT
): number {
  const safe = sanitizeScale(mapScale);
  const k = clamp(exponent, 0, 1);
  return clamp(safe ** (1 - k), MIN_LABEL_SCREEN_SCALE, MAX_LABEL_SCREEN_SCALE);
}

/**
 * The factor to put in the marker's own `transform: scale(...)`, given that
 * it lives inside a container already scaled by `mapScale`.
 *
 * Derived from `labelScreenScale` rather than computed independently, so the
 * clamps above are guaranteed to describe what is actually on screen.
 */
export function markerCounterScale(
  mapScale: number,
  exponent: number = LABEL_SCALE_EXPONENT
): number {
  const safe = sanitizeScale(mapScale);
  return labelScreenScale(safe, exponent) / safe;
}

/**
 * A pixel offset that should keep a constant *on-screen* gap as the map
 * zooms — the stagger that separates an equipment or team marker from the
 * post marker underneath it.
 *
 * These offsets are expressed in map-container pixels, so they have to be
 * divided by the map scale to hold still on screen. They were previously
 * written as `n / mapScale` at each call site, which was correct only while
 * markers were also `1 / mapScale`; once markers scale sub-linearly the
 * stagger has to track the marker, not the screen, or a zoomed-in marker
 * grows out from under its own offset and overlaps the post again.
 */
export function staggerOffsetPx(
  basePx: number,
  mapScale: number,
  exponent: number = LABEL_SCALE_EXPONENT
): number {
  return basePx * markerCounterScale(mapScale, exponent);
}

// ---------------------------------------------------------------------------
// (b) collision declutter
// ---------------------------------------------------------------------------

export interface Rect {
  /** Left edge, in map-container pixels. */
  x: number;
  /** Top edge, in map-container pixels. */
  y: number;
  width: number;
  height: number;
}

export interface LabelBox {
  id: string;
  /** Label centre, in map-container pixels (the same space as `Rect`). */
  centerX: number;
  centerY: number;
  /** Label size, in map-container pixels at the current zoom. */
  width: number;
  height: number;
  /**
   * Higher wins a collision. Ties break on `id` so the result is stable
   * across renders — a label that flickered on and off as unrelated state
   * changed would be worse than one that never drew.
   */
  priority: number;
  /**
   * Zoom gate: the label does not draw below this map scale. Undefined means
   * "always eligible". This is mechanism (c).
   */
  minScale?: number;
}

function rectOf(box: LabelBox): Rect {
  return {
    x: box.centerX - box.width / 2,
    y: box.centerY - box.height / 2,
    width: box.width,
    height: box.height,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  // Touching edges are not an overlap: two labels sharing a boundary pixel
  // are legible, and treating that as a collision would hide one of a pair
  // of neatly abutting labels for no visible reason.
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

export interface DeclutterOptions {
  /**
   * Boxes that are always drawn and always win — off-map edge badges, which
   * have already been fanned out along the image boundary by
   * `layoutEdgeBadges` and must not then be hidden by an ordinary label.
   *
   * This is what makes the two layout passes one decision instead of two:
   * the badges are laid out first, then enter this pass as immovable
   * obstacles, rather than running in a separate pass that knows nothing
   * about the labels drawn over the map.
   */
  obstacles?: Rect[];
}

/**
 * Decides which labels draw. Greedy by priority: the highest-priority label
 * is always placed, and each subsequent one draws only if it clears every
 * label already placed and every obstacle.
 *
 * Deliberately hides rather than nudges. A post label that has drifted from
 * its post is a label pointing at the wrong place, and on a dispatch map that
 * is worse than no label — the operator can still hover the marker, and can
 * still zoom in, which is exactly what makes the hidden label reappear.
 *
 * Returns a decision for every input id, so a caller can render from the map
 * without a fallback branch.
 */
export function declutterLabels(
  labels: LabelBox[],
  mapScale: number,
  options: DeclutterOptions = {}
): Map<string, boolean> {
  const safe = sanitizeScale(mapScale);
  const visible = new Map<string, boolean>();

  const eligible: LabelBox[] = [];
  for (const label of labels) {
    if (label.minScale != null && safe < label.minScale) {
      visible.set(label.id, false);
      continue;
    }
    visible.set(label.id, false);
    eligible.push(label);
  }

  eligible.sort((a, b) =>
    b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  const placed: Rect[] = options.obstacles ? [...options.obstacles] : [];
  for (const label of eligible) {
    const rect = rectOf(label);
    if (placed.some((other) => rectsOverlap(rect, other))) continue;
    placed.push(rect);
    visible.set(label.id, true);
  }

  return visible;
}

/**
 * Approximate on-screen size of a text label, without measuring the DOM.
 *
 * Layout has to be decided during render, before the label exists to measure,
 * and measuring afterwards would mean a second render pass on every zoom
 * frame. The estimate is deliberately generous in width: over-estimating
 * hides a label that would have just fit, while under-estimating draws two
 * labels on top of each other, and only one of those is recoverable by
 * zooming in.
 */
export function estimateLabelBox(
  text: string,
  fontSizePx: number,
  paddingXPx = 8,
  paddingYPx = 4
): { width: number; height: number } {
  // ~0.62em average advance width covers the app's sans stack for the mixed
  // alphanumeric strings that post and team names actually are.
  const width = text.length * fontSizePx * 0.62 + paddingXPx * 2;
  const height = fontSizePx * 1.35 + paddingYPx * 2;
  return { width, height };
}

// ---------------------------------------------------------------------------
// Off-map edge badges
// ---------------------------------------------------------------------------

/**
 * How close two badge centres can land, in on-screen pixels, before they are
 * fanned apart. Sized a little larger than the badge's own ~24px circle so
 * the fanned result still shows a gap.
 */
export const EDGE_BADGE_MIN_SPACING_PX = 30;

/** Collision footprint of one edge badge, in on-screen pixels. */
export const EDGE_BADGE_SIZE_PX = 28;

export interface EdgeBadgeSpec {
  id: string;
  /** Boundary point in percent of the image, from `offMapIndicator`. */
  edge: { x: number; y: number };
}

/**
 * Lays out every off-map badge for the current image rect, spreading out any
 * that would otherwise land on top of each other.
 *
 * Deliberately does NOT collapse crowded badges into a single "+N" count
 * marker: an off-map call or team is exactly the piece of information a count
 * would hide, and unlike a cluster on a normal map there is no
 * click-to-expand affordance here to recover it. Instead badges landing on
 * the same edge are sorted along that edge and pushed apart just enough to
 * stay legible — every target keeps its own colour, label and aria-label;
 * only its on-screen position moves.
 *
 * Runs on however many off-map targets exist at once (typically a handful),
 * so an O(n log n) sort per edge is not a concern.
 */
export function layoutEdgeBadges(
  specs: EdgeBadgeSpec[],
  rect: Rect,
  mapScale = 1
): Map<string, { left: number; top: number }> {
  const positions = new Map<string, { left: number; top: number }>();

  type Side = 'top' | 'bottom' | 'left' | 'right';
  const bySide: Record<Side, { id: string; left: number; top: number; along: number }[]> = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  };

  // The spacing is a screen-pixel quantity but the positions are in
  // map-container pixels, so it shrinks as the container is scaled up —
  // otherwise badges fan further and further apart the more you zoom in.
  const spacing = EDGE_BADGE_MIN_SPACING_PX / sanitizeScale(mapScale);

  for (const spec of specs) {
    const { x, y } = spec.edge;
    const left = rect.x + (x / 100) * rect.width;
    const top = rect.y + (y / 100) * rect.height;

    // Classify by which boundary this edge point sits on. The y checks come
    // first, so a corner (x and y both on a boundary) resolves to the
    // horizontal edge — top or bottom — and fans out along the x axis.
    //
    // That tie-break is arbitrary but deliberate, and it is carried over
    // unchanged from the venue map's original layout pass so no existing
    // badge moves: it only decides which axis a corner badge fans along, and
    // a venue image is usually wider than it is tall, so the horizontal edge
    // is the one with room. (An earlier version of this comment claimed the
    // opposite, "vertical edge"; the code has always done this.)
    let side: Side;
    if (y <= 0.01) side = 'top';
    else if (y >= 99.99) side = 'bottom';
    else if (x <= 0.01) side = 'left';
    else side = 'right';

    const along = side === 'top' || side === 'bottom' ? left : top;
    bySide[side].push({ id: spec.id, left, top, along });
  }

  (Object.keys(bySide) as Side[]).forEach((side) => {
    const items = bySide[side].sort((a, b) => a.along - b.along);
    let lastAlong = -Infinity;
    for (const item of items) {
      const along = Math.max(item.along, lastAlong + spacing);
      lastAlong = along;
      const left = side === 'top' || side === 'bottom' ? along : item.left;
      const top = side === 'top' || side === 'bottom' ? item.top : along;
      positions.set(item.id, { left, top });
    }
  });

  return positions;
}

/**
 * The laid-out badges as collision obstacles, ready to hand to
 * `declutterLabels`. Footprint is in map-container pixels, so the on-screen
 * badge size is divided by the map scale for the same reason the spacing is.
 */
export function edgeBadgeObstacles(
  positions: Map<string, { left: number; top: number }>,
  mapScale = 1
): Rect[] {
  const size = EDGE_BADGE_SIZE_PX / sanitizeScale(mapScale);
  return Array.from(positions.values()).map((pos) => ({
    x: pos.left - size / 2,
    y: pos.top - size / 2,
    width: size,
    height: size,
  }));
}
