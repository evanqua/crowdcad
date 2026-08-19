import type { CallLogEntry, CallPosition, Layer, PositionSource } from '@/app/types';
import { georeferenceStaleness, latLonToPixel, pixelToLatLon, solveGeoreference } from '@/lib/geoUtils';

// Pure helpers for turning a click on the venue map (image-percentage space)
// into a Call.position (lat/lon space) and back, plus the small bits of
// string formatting shared between "pin placed" and "pin moved" log entries.
//
// Deliberately does NOT live in geoUtils.ts (a different, actively-edited
// module) or components/modals/event/venuemapmodal.tsx (already large) --
// see the doc comment on CallPosition in app/types.ts for why lat/lon is the
// system of record here and x/y are derived-for-drawing, the mirror image of
// how Post is handled.

export interface PercentPoint {
  x: number;
  y: number;
}

export type CallPinPlacement =
  | { ok: true; position: CallPosition }
  | { ok: false; reason: 'uncalibrated' };

/**
 * Turn a click, expressed as image-percentage coordinates on `layer`, into a
 * `CallPosition`. Refuses (`ok: false`) when the layer has no usable
 * georeference -- see the "Consequence, accepted deliberately" paragraph on
 * `CallPosition` in app/types.ts. There is deliberately no percent-only
 * fallback: a call position that cannot be expressed as lat/lon cannot be
 * published to TAK, handed to a partner agency, or compared against a team's
 * GPS fix, so a click on an uncalibrated layer produces nothing rather than a
 * coordinate that only looks like one.
 */
export function placeCallPin(
  layer: Layer,
  percent: PercentPoint,
  opts: { source: PositionSource; placedAt: number; placedBy?: string }
): CallPinPlacement {
  const transform = solveGeoreference(layer.georeference);
  if (!transform) {
    return { ok: false, reason: 'uncalibrated' };
  }

  const { lat, lon } = pixelToLatLon(transform, percent.x, percent.y);

  const position: CallPosition = {
    lat,
    lon,
    x: percent.x,
    y: percent.y,
    layerId: layer.id,
    georeferenceVersion: transform.version,
    source: opts.source,
    placedAt: opts.placedAt,
  };
  if (opts.placedBy) {
    position.placedBy = opts.placedBy;
  }
  return { ok: true, position };
}

/**
 * Turn a click that ALREADY carries a real coordinate into a `CallPosition`.
 *
 * This is the basemap-view counterpart of `placeCallPin`, and the whole of TAK
 * plan §8.F in one function. On the raster map a click is a percentage of an
 * image, so it needs a georeference to mean anything and `placeCallPin`
 * correctly refuses without one. On a real basemap a click is
 * `map.unproject(...)` — a lat/lon by construction, produced by the renderer's
 * own projection with no venue calibration involved anywhere. There is
 * therefore nothing to refuse, and this function never returns `ok: false`.
 *
 * That is the distinction the product had been getting wrong: it gated
 * *dropping a pin* on the same boolean that gates *overlaying the raster*.
 * Those are two different capabilities. An uncalibrated layer genuinely cannot
 * show its image in the right place on the world — but it can absolutely carry
 * a call at a known coordinate, and demanding control points first was asking
 * the dispatcher to calibrate a picture in order to record a fact that never
 * depended on the picture.
 *
 * `x`/`y` are still populated when a transform happens to exist, because they
 * are what the raster view draws from (see `resolveCallPinPercent`) and a pin
 * dropped on the basemap should appear on the raster too when the operator
 * switches back. With no transform they are `null` — the same value the type
 * already uses for "this pin is real but not drawable on this image" (see
 * CallPosition's doc comment on `x`). lat/lon is the system of record;
 * derived-for-drawing fields are allowed to be absent rather than invented.
 *
 * `georeferenceVersion` is likewise stamped only when a calibration was
 * actually involved. Stamping a version onto a coordinate the calibration
 * played no part in producing would make `callPinStaleness` answer a question
 * nobody asked — it would report the pin as "stale" after a recalibration that
 * could not possibly have moved it.
 */
export function placeCallPinFromLatLon(
  layer: Layer,
  coord: { lat: number; lon: number },
  opts: { source: PositionSource; placedAt: number; placedBy?: string }
): CallPosition {
  const transform = solveGeoreference(layer.georeference);

  const position: CallPosition = {
    lat: coord.lat,
    lon: coord.lon,
    x: null,
    y: null,
    layerId: layer.id,
    source: opts.source,
    placedAt: opts.placedAt,
  };

  if (transform) {
    const { x, y } = latLonToPixel(transform, coord.lat, coord.lon);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      position.x = x;
      position.y = y;
    }
    position.georeferenceVersion = transform.version;
  }

  if (opts.placedBy) {
    position.placedBy = opts.placedBy;
  }
  return position;
}

/**
 * Whether `layer` currently has enough of a georeference to place a call pin
 * on it at all. Exposed separately from `placeCallPin` so UI (the "click to
 * place" banner vs. the uncalibrated-layer refusal banner) can decide what to
 * show *before* the dispatcher clicks, rather than only finding out on click.
 *
 * Note the scope: this answers "can a click on the RASTER become a
 * coordinate", which is the only place the question arises. It is not a
 * precondition for pin-dropping in general — see `placeCallPinFromLatLon` and
 * §8.F. Callers gating UI on this must also check which view they are in, or
 * they will reproduce the refusal in the one view where it makes no sense.
 */
export function isLayerCalibrated(layer: Layer): boolean {
  return solveGeoreference(layer.georeference) !== null;
}

/**
 * Resolve where a stored `CallPosition` should be drawn on `layer`, in
 * image-percentage coordinates.
 *
 * lat/lon is the system of record (see CallPosition's doc comment), so this
 * always prefers re-deriving x/y from the layer's CURRENT georeference over
 * trusting the position's stamped x/y -- exactly the "derive on read"
 * discipline geoUtils.ts already applies to Post (see postLatLon there), just
 * running in the opposite direction. That means a pin redraws in its correct
 * place immediately after a recalibration, with no migration step, and the
 * stamped x/y is never silently trusted past the calibration that produced
 * it.
 *
 * Returns null when the position belongs to a different layer (nothing to
 * draw here), or when neither a fresh re-derivation nor the stamped x/y is
 * available -- e.g. the layer's georeference was removed entirely after the
 * pin was placed. Falls back to the stamped x/y only when the current
 * transform can't be solved at all: a possibly-stale dot is better than the
 * pin vanishing the instant someone starts editing control points.
 */
export function resolveCallPinPercent(layer: Layer, position: CallPosition): PercentPoint | null {
  if (position.layerId !== layer.id) {
    return null;
  }

  const transform = solveGeoreference(layer.georeference);
  if (transform) {
    const { x, y } = latLonToPixel(transform, position.lat, position.lon);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x, y };
    }
  }

  if (position.x != null && position.y != null) {
    return { x: position.x, y: position.y };
  }

  return null;
}

/**
 * Whether a stored CallPosition's stamped georeferenceVersion still matches
 * the layer it's drawn on. Thin re-export of geoUtils.georeferenceStaleness
 * spelled out for this call site so callers don't need to know CallPosition
 * and GeoTransform happen to share a field name.
 */
export function callPinStaleness(layer: Layer, position: CallPosition) {
  return georeferenceStaleness(position.georeferenceVersion, layer.georeference);
}

/** Zero-padded 24h clock, matching the `${hhmm} - ...` convention every other
 *  Call/Staff log entry in this codebase uses (see calltracking.tsx,
 *  quickcallmodal.tsx). */
export function formatHHMM(timestamp: number): string {
  const d = new Date(timestamp);
  return d.getHours().toString().padStart(2, '0') + d.getMinutes().toString().padStart(2, '0');
}

/**
 * Builds the Call.log entry for a pin placement or a re-drag correction.
 * Position is operationally significant call state, so both get logged the
 * same way any other dispatcher edit to a call does.
 */
export function buildCallPinLogEntry(
  kind: 'placed' | 'moved' | 'cleared',
  timestamp: number
): CallLogEntry {
  const hhmm = formatHHMM(timestamp);
  // 'cleared' is logged for the same reason the other two are: a call that had
  // a coordinate and now has none has lost operational information, and the
  // absence of a pin is indistinguishable from never having had one unless the
  // removal is on the record.
  const message =
    kind === 'placed'
      ? 'Pin dropped on map.'
      : kind === 'moved'
        ? 'Pin moved on map.'
        : 'Pin removed from map.';
  return { timestamp, message: `${hhmm} - ${message}` };
}
