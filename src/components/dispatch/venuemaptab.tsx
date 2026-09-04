'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, AutocompleteItem, Button } from '@heroui/react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Layer, Staff, Equipment, Call, Clinic, Post } from '@/app/types';
import { useZoomPan } from '@/hooks/useZoomPan';
import { MAP_CHECKER_BG } from '@/lib/mapStyles';
import MapZoomControls from '@/components/ui/map-zoom-controls';
import { VenueMapWithPosts } from '@/components/modals/event/venuemapmodal';

interface VenueMapTabProps {
  layers: Layer[];
  staff: Staff[];
  equipment: Equipment[];
  teamTimers: { [team: string]: number };
  calls: Call[];
  clinics: Clinic[];
}

function isCoordinatedPost(post: Post): post is { name: string; x: number; y: number } {
  return typeof post === 'object' && post !== null && typeof post.name === 'string' && typeof post.x === 'number';
}

interface SearchItem {
  key: string;
  label: string;
  layerIdx: number;
  postName: string;
}

// The dispatch board's own venue map — the Map tab beside Calls/Clinic,
// occupying the whole panel below the tab strip. Replaces the old
// click-to-open VenueMapModal so the map, layer navigation, and location
// search are always one click away instead of a full-screen overlay.
export default function VenueMapTab({ layers, staff, equipment, teamTimers, calls, clinics }: VenueMapTabProps) {
  const [currentLayer, setCurrentLayer] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [selectedPostName, setSelectedPostName] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const {
    scale,
    position,
    isPanning,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useZoomPan({ minScale: 0.5, maxScale: 3 });

  // Clamp in case the venue's layer count shrank out from under an already-selected index.
  const safeCurrentLayer = Math.min(currentLayer, Math.max(0, layers.length - 1));
  const currentLayerData = layers[safeCurrentLayer];

  // The attention ring on a search result fades on its own rather than
  // sticking around until something else clears it.
  useEffect(() => {
    if (!selectedPostName) return;
    const timeout = setTimeout(() => setSelectedPostName(null), 4000);
    return () => clearTimeout(timeout);
  }, [selectedPostName]);

  const searchItems = useMemo(() => {
    const items: SearchItem[] = [];
    layers.forEach((layer, layerIdx) => {
      (layer.posts || []).forEach((post) => {
        if (!isCoordinatedPost(post)) return;
        items.push({
          key: `${layerIdx}::${post.name}`,
          label: layers.length > 1 ? `${post.name} (${layer.name})` : post.name,
          layerIdx,
          postName: post.name,
        });
      });
    });
    return items;
  }, [layers]);

  const goToLayer = (idx: number) => {
    setCurrentLayer(idx);
    setSelectedPostName(null);
    resetZoom();
  };

  const handleSelectLocation = (key: React.Key | null) => {
    if (!key) return;
    const item = searchItems.find((i) => i.key === key);
    if (!item) return;
    setCurrentLayer(item.layerIdx);
    setSelectedPostName(item.postName);
    resetZoom();
    setSearchInput('');
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        {layers.length > 1 ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              isIconOnly
              size="sm"
              radius="full"
              variant="flat"
              isDisabled={safeCurrentLayer <= 0}
              onPress={() => goToLayer(safeCurrentLayer - 1)}
              aria-label="Previous layer"
              title="Previous layer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[110px] truncate text-center text-sm font-medium text-surface-light">
              {currentLayerData?.name || 'Venue Map'}
            </span>
            <Button
              isIconOnly
              size="sm"
              radius="full"
              variant="flat"
              isDisabled={safeCurrentLayer >= layers.length - 1}
              onPress={() => goToLayer(safeCurrentLayer + 1)}
              aria-label="Next layer"
              title="Next layer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span className="shrink-0 text-sm font-medium text-surface-light">
            {currentLayerData?.name || 'Venue Map'}
          </span>
        )}

        <div className="ml-auto w-full max-w-xs">
          <Autocomplete
            aria-label="Search locations"
            placeholder="Find a location..."
            size="sm"
            startContent={<Search className="h-4 w-4 text-surface-faint" />}
            inputValue={searchInput}
            onInputChange={setSearchInput}
            onSelectionChange={handleSelectLocation}
            classNames={{
              base: 'min-w-0 data-[focus-visible=true]:outline-none data-[focus=true]:outline-none',
            }}
            inputProps={{
              classNames: {
                inputWrapper:
                  'bg-surface-deep text-surface-light border border-surface-liner rounded-full group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 data-[focus-visible=true]:ring-0 data-[focus-visible=true]:ring-offset-0 focus-within:ring-0 focus:ring-0',
                input: 'bg-surface-deep text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none',
              },
            }}
          >
            {searchItems.map((item) => (
              <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>
            ))}
          </Autocomplete>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg" style={MAP_CHECKER_BG}>
        <VenueMapWithPosts
          layers={layers}
          currentLayer={safeCurrentLayer}
          staff={staff}
          equipment={equipment}
          teamTimers={teamTimers}
          calls={calls}
          clinics={clinics}
          scale={scale}
          position={position}
          isPanning={isPanning}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          imgRef={imgRef}
          imageRadiusClassName="rounded-lg"
          selectedPostName={selectedPostName}
        />
        <MapZoomControls onZoomIn={() => zoomIn(0.25)} onZoomOut={() => zoomOut(0.25)} onReset={resetZoom} />
      </div>
    </div>
  );
}
