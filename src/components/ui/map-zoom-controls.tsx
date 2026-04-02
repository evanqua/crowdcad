"use client";

import React from 'react';
import { Button, ButtonGroup } from '@heroui/react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface MapZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
  buttonClassName?: string;
  resetButtonClassName?: string;
}

export default function MapZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  className = 'absolute top-3 right-3 flex flex-row gap-1 z-20',
  buttonClassName = 'bg-surface-deepest/95',
  resetButtonClassName = 'bg-surface-deepest/95 text-xs px-2',
}: MapZoomControlsProps) {
  return (
    <div className={className}>
      <ButtonGroup>
        <Button isIconOnly size="sm" variant="flat" onPress={onZoomIn} className={buttonClassName} aria-label="Zoom in" title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button isIconOnly size="sm" variant="flat" onPress={onZoomOut} className={buttonClassName} aria-label="Zoom out" title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
      </ButtonGroup>
      <Button size="sm" variant="flat" onPress={onReset} className={resetButtonClassName} aria-label="Reset zoom" title="Reset zoom">
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
