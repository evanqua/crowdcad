'use client';

import React from 'react';
import { MapPin, HousePlus } from 'lucide-react';

// The single post/incident marker pin rendered on a venue map — extracted
// from VenueManagementPageClient's inline renderMarkers() so it's one
// component shared by every map that shows markers (venue management's own
// Locations/Map steps today; anywhere else that needs the same pin, like
// the marketing site's features-page demo, going forward). Editing this
// file is the one place to change how a marker looks or behaves anywhere
// it's used.
export interface VenueMapMarkerProps {
  x: number; // percent, left edge of the map image
  y: number; // percent, top edge of the map image
  name?: string;
  isClinic?: boolean;
  isHover?: boolean;
  isPending?: boolean;
  isDragging?: boolean;
  /** Pin diameter in px. Icon scales proportionally (2/3 of this). Defaults to 24, matching the original inline h-6 w-6 marker. */
  size?: number;
  showTooltip?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function VenueMapMarker({
  x,
  y,
  name,
  isClinic,
  isHover,
  isPending,
  isDragging,
  size = 24,
  showTooltip = true,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onClick,
}: VenueMapMarkerProps) {
  const iconSize = Math.round(size * (2 / 3));

  return (
    <>
      <div
        style={{ left: `calc(${x}% - ${size / 2}px)`, top: `calc(${y}% - ${size / 2}px)`, width: size, height: size }}
        className={`absolute z-10 flex cursor-grab items-center justify-center rounded-full border-2 transition-all ${
          isPending
            ? 'border-status-blue bg-status-blue/20 scale-125'
            : isHover || isDragging
            ? 'border-accent bg-accent/30 scale-110'
            : 'border-accent bg-accent/20 hover:scale-110'
        } ${isDragging ? 'cursor-grabbing scale-110' : ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onClick={onClick}
      >
        {isClinic ? (
          <HousePlus className="text-accent" strokeWidth={2.5} style={{ width: iconSize, height: iconSize }} />
        ) : (
          <MapPin className="text-accent" strokeWidth={2.5} style={{ width: iconSize, height: iconSize }} />
        )}
      </div>
      {showTooltip && isHover && !isPending && name && (
        <div
          style={{ left: `calc(${x}% - 50px)`, top: `calc(${y}% - 40px)` }}
          className="pointer-events-none absolute z-20 rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg border border-default whitespace-nowrap"
        >
          {name}
        </div>
      )}
    </>
  );
}
