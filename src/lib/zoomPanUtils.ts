export function clampScale(nextScale: number, minScale: number, maxScale: number): number {
  return Math.min(maxScale, Math.max(minScale, nextScale));
}
