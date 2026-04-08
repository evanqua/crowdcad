export function clampScale(nextScale: number, minScale: number, maxScale: number): number {
  return Math.min(maxScale, Math.max(minScale, nextScale));
}

export function clampPanPosition(params: {
  newX: number;
  newY: number;
  imgWidth: number;
  imgHeight: number;
  containerWidth: number;
  containerHeight: number;
  scale: number;
}): { x: number; y: number } {
  const { newX, newY, imgWidth, imgHeight, containerWidth, containerHeight } = params;

  const maxX = Math.max(0, imgWidth - containerWidth);
  const maxY = Math.max(0, imgHeight - containerHeight);

  return {
    x: Math.min(0, Math.max(-maxX, newX)),
    y: Math.min(0, Math.max(-maxY, newY)),
  };
}
