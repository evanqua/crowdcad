import React, { useState } from 'react';
import { clampPanPosition, clampScale } from '@/lib/zoomPanUtils';

type Position = { x: number; y: number };

type Options = {
  minScale?: number;
  maxScale?: number;
  disablePan?: () => boolean;
};

export function useZoomPan(
  imgRef: React.RefObject<HTMLImageElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: Options = {}
) {
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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) {
      setPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const imgWidth = img.offsetWidth * scale;
    const imgHeight = img.offsetHeight * scale;

    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;

    setPosition(
      clampPanPosition({
        newX,
        newY,
        imgWidth,
        imgHeight,
        containerWidth: containerRect.width,
        containerHeight: containerRect.height,
        scale,
      })
    );
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
