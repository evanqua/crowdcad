// Pure helpers for the venue editor's "Set default view" control (TAK plan
// §8 follow-up). Split out of page.client.tsx because this repo has no
// component-test harness (see core/CLAUDE.md) — pure extraction is the
// established way to get anything under test at all.

import type { BasemapCamera } from '@/app/types';

/**
 * Prepares a live-read `BasemapCamera` for storage on `Venue.basemapCamera`.
 *
 * Firestore rejects `undefined` at any depth, so `bearing`/`pitch` must be
 * OMITTED rather than set to `undefined` when the reported camera is
 * north-up/flat — same pattern `buildGeoreferenceForSave` uses in
 * page.client.tsx for `label`/`updatedBy`. `updatedAt` is always stamped
 * fresh here rather than trusted from the input, since it records when THIS
 * capture happened, not whenever the camera object was constructed.
 */
export function sanitizeBasemapCameraForSave(
  camera: BasemapCamera,
  now: number = Date.now()
): BasemapCamera {
  const result: BasemapCamera = {
    center: { lat: camera.center.lat, lon: camera.center.lon },
    zoom: camera.zoom,
    updatedAt: now,
  };
  if (camera.bearing !== undefined) result.bearing = camera.bearing;
  if (camera.pitch !== undefined) result.pitch = camera.pitch;
  return result;
}
