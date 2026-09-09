import type { Zone } from '@/app/types';

/** Preset palette offered when drawing a new zone — distinct, legible against both the checkerboard background and a typical venue map image. */
export const ZONE_COLOR_PALETTE: string[] = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

/** Cycles through the palette so each newly drawn zone defaults to a color distinct from the ones before it — the naming dialog still lets the user override via swatches. */
export function getNextZoneColor(existingZones: Zone[]): string {
  return ZONE_COLOR_PALETTE[existingZones.length % ZONE_COLOR_PALETTE.length];
}
