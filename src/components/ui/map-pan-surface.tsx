"use client";

import React from 'react';

interface MapPanSurfaceProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Touch counterpart of the mouse handlers above — one finger pans, two
   *  fingers pinch to zoom. Optional since not every caller wires up
   *  useZoomPan's touch handlers. */
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function MapPanSurface({
  containerRef,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  className = 'relative overflow-auto scrollbar-hide',
  style,
  children,
}: MapPanSurfaceProps) {
  return (
    <div
      ref={containerRef}
      className={className}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave ?? onMouseUp}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: onTouchStart ? 'none' : undefined, ...style }}
    >
      {children}
    </div>
  );
}
