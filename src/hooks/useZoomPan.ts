import React, { useState } from 'react';
import { clampScale } from '@/lib/zoomPanUtils';

type Position = { x: number; y: number };

type Options = {
  minScale?: number;
  maxScale?: number;
  disablePan?: () => boolean;
};

export function useZoomPan(options: Options = {}) {
  const { minScale = 1, maxScale = 5, disablePan } = options;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disablePan?.()) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Unclamped, matching the pan behavior of VenueMapWithPosts (the dispatch
  // page's own venue map, and event creation's map panel) — a bounded clamp
  // here left almost no drag range at the default scale (minScale defaults
  // to 1, at which the image already fits its container, so maxX/maxY were
  // ~0), which read as the map barely dragging at all.
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setPosition({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const zoomIn = (step: number) => {
    setScale((prev) => clampScale(prev + step, minScale, maxScale));
  };

  const zoomOut = (step: number) => {
    setScale((prev) => clampScale(prev - step, minScale, maxScale));
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return {
    scale,
    setScale,
    position,
    setPosition,
    isPanning,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}
