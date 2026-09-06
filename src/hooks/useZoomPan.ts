import React, { useRef, useState } from 'react';
import { clampScale } from '@/lib/zoomPanUtils';

type Position = { x: number; y: number };

type Options = {
  minScale?: number;
  maxScale?: number;
  disablePan?: () => boolean;
};

function touchDistance(touches: React.TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

export function useZoomPan(options: Options = {}) {
  const { minScale = 1, maxScale = 5, disablePan } = options;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });

  // Pinch bookkeeping: written at gesture start, read back on each move of
  // the same gesture. A ref rather than state since nothing needs to
  // re-render when it changes.
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Plain scroll is left alone rather than zooming — ctrl/cmd+scroll (or a
    // trackpad pinch, which browsers report as a wheel event with ctrlKey
    // set regardless of platform) is the convention this matches, the same
    // one Figma/Google Maps use, so an ordinary two-finger scroll doesn't
    // hijack zoom by accident.
    if (!e.ctrlKey && !e.metaKey) return;
    // Multiplicative rather than additive so the same handler feels right
    // whether deltaY arrives as a trackpad's small per-frame pixels or a
    // mouse wheel's larger per-notch jumps.
    const zoomFactor = Math.exp(-e.deltaY * 0.0025);
    setScale((prev) => clampScale(prev * zoomFactor, minScale, maxScale));
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

  // Touch counterpart of the mouse handlers above: one finger drags to pan,
  // two fingers pinch to zoom. Relies on the element these are attached to
  // having `touch-action: none` — without it the browser's own native
  // scroll/pinch handling fights this, and React's touch listeners are
  // passive by default anyway, so calling preventDefault() here wouldn't
  // reliably stop it.
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinchRef.current = { distance: touchDistance(e.touches), scale };
      setIsPanning(false);
      return;
    }
    if (e.touches.length === 1) {
      pinchRef.current = null;
      if (disablePan?.()) return;
      setIsPanning(true);
      const touch = e.touches[0];
      setPanStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const { distance, scale: startScale } = pinchRef.current;
      const nextScale = clampScale(startScale * (touchDistance(e.touches) / distance), minScale, maxScale);
      setScale(nextScale);
      return;
    }
    if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) setIsPanning(false);
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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}
