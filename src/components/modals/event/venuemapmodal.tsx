'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { MapPin, ShieldPlus, Briefcase, HousePlus, ArrowBigDown } from 'lucide-react';
import { Post, Staff, Equipment, Layer, Call, Clinic } from '@/app/types';
import { isClinicPost, getTransportingLabel } from '@/lib/clinics';

function StatusTimer({ since }: { since: number }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    setElapsed(Math.floor((Date.now() - since) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - since) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [since]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return (
    <span>
      {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}

function isPostObject(post: unknown): post is { name: string; x: number; y: number } {
  return (
    typeof post === "object" &&
    post !== null &&
    "name" in post &&
    "x" in post &&
    "y" in post
  );
}

interface ImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PostMarkerProps {
  post: Post;
  rect: ImageRect;
  staff: Staff[];
  scale: number;
  /** True when this post was just navigated to (e.g. via the Map tab's location search) — draws a brief attention ring around it. */
  isSelected?: boolean;
}

function PostMarker({ post, rect, scale, isSelected }: PostMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);
  if (!isPostObject(post)) return null;

  const { x, y, width, height } = rect;
  const left = x + (post.x / 100) * width;
  const top = y + (post.y / 100) * height;

  // Check if this is a clinic location
  const isClinic = isClinicPost(post);
  const Icon = isClinic ? HousePlus : MapPin;
  const iconSize = isClinic ? 26 : 22;
  const emphasis = (hovered ? 1.15 : 1) / scale;

  const handleMouseEnter = () => {
    setHovered(true);
    if (markerRef.current) {
      const rect = markerRef.current.getBoundingClientRect();
      const yPos = Math.max(10, rect.top);
      setTooltipPos({ x: rect.right + 10, y: yPos });
    }
  };

  return (
    <div
      ref={markerRef}
      style={{
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        // Counter-scale against the map's ambient zoom so the pin stays a
        // constant on-screen size instead of growing/shrinking with it —
        // the position offset above still tracks the zoomed map correctly
        // since it's computed pre-scale, same as every other marker here.
        transform: `translate(-50%, -50%) scale(${emphasis})`,
        transformOrigin: 'center center',
        // A selected post's attention arrow needs to clear every other
        // marker on the map regardless of DOM order, not just sit above its
        // own immediate neighbors.
        zIndex: isSelected ? 999 : 12,
        cursor: "pointer",
        transition: 'transform 0.15s ease-out',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      {isSelected && (
        // Centering (-translate-x-1/2) and the bounce both animate `transform`,
        // so they can't share one element — Tailwind's animate-bounce keyframes
        // only set translateY and would silently replace the centering
        // translateX for the whole time it runs. The wrapper centers; only the
        // icon inside it bounces.
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '100%', marginBottom: 6 }}>
          <ArrowBigDown
            className="animate-bounce"
            size={40}
            strokeWidth={1.5}
            fill="#f97316"
            stroke="white"
            style={{ filter: 'drop-shadow(0 1px 3px rgb(0 0 0 / 0.6))' }}
          />
        </div>
      )}
      <Icon
        size={iconSize}
        strokeWidth={1.5}
        stroke="white"
        fill="hsl(var(--map-marker))"
        style={{ filter: 'drop-shadow(0 1px 3px rgb(0 0 0 / 0.6))' }}
      />

      {/* Hover tooltip with fixed positioning using portal */}
      {hovered && typeof window !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          <div className="rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg whitespace-nowrap">
            {post.name}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function getEquipmentIcon(equipment: Equipment) {
  const name = equipment.name.toLowerCase();
  
  // Specific equipment type icons
  if (name.includes('wheelchair')) {
    // Using a custom wheelchair SVG path since we don't have hugeicons in lucide
    return 'wheelchair';
  }
  if (name.includes('gurney') || name.includes('stretcher')) {
    return 'stretcher';
  }
  if (name.includes('aed')) {
    return 'aed';
  }
  
  return 'briefcase'; // Default medical briefcase
}

// 'wheelchair'/'stretcher' are separate raster assets (not lucide icons), so
// unlike every other marker on the map they can't take a fill/stroke prop —
// recoloring them to match would mean editing those SVG files directly.
// They keep their original white-on-transparent look, just with the same
// drop-shadow as everything else for contrast against the map image.
function EquipmentIcon({ type, size = 22 }: { type: string; size?: number }) {
  const dropShadow = { filter: 'drop-shadow(0 1px 3px rgb(0 0 0 / 0.6))' };
  if (type === 'wheelchair') {
    return <Image src="/map/wheelchair.svg" alt="Wheelchair" width={size} height={size} draggable={false} style={dropShadow} />;
  }
  if (type === 'stretcher') {
    return <Image src="/map/gurney.svg" alt="Gurney" width={size} height={size} draggable={false} style={dropShadow} />;
  }
  // 'aed' and the default case share the same filled + white-outlined
  // treatment as the post pin and every other lucide-based marker.
  return <Briefcase size={size} strokeWidth={1.5} stroke="white" fill="#e2c93d" style={dropShadow} />;
}

function getContainedImageRect(containerW: number, containerH: number, naturalW: number, naturalH: number) {
  if (!containerW || !containerH || !naturalW || !naturalH) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const containerAR = containerW / containerH;
  const imageAR = naturalW / naturalH;

  if (imageAR > containerAR) {
    const width = containerW;
    const height = width / imageAR;
    const x = 0;
    const y = (containerH - height) / 2;
    return { x, y, width, height };
  } else {
    const height = containerH;
    const width = height * imageAR;
    const x = (containerW - width) / 2;
    const y = 0;
    return { x, y, width, height };
  }
}

// Equipment marker - static display only
interface EquipmentMarkerProps {
  equipment: Equipment;
  post: Post;
  rect: ImageRect;
  scale: number;
}

function EquipmentMarker({
  equipment,
  post,
  rect,
  scale,
}: EquipmentMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);

  const postIsValid = isPostObject(post);
  if (!postIsValid) return null;

  // Position equipment marker
  const left = rect.x + (post.x / 100) * rect.width - 15;
  const top = rect.y + (post.y / 100) * rect.height + 15;

  const iconType = getEquipmentIcon(equipment);

  const handleMouseEnter = () => {
    setHovered(true);
    if (markerRef.current) {
      const rect = markerRef.current.getBoundingClientRect();
      const yPos = Math.max(10, rect.top);
      setTooltipPos({ x: rect.right + 10, y: yPos });
    }
  };

  return (
    <div
      ref={markerRef}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        // Counter-scale against ambient map zoom so the icon stays a
        // constant on-screen size, same treatment as PostMarker/TeamMarker.
        transform: `translate(-50%, -50%) scale(${1 / scale})`,
        transformOrigin: 'center center',
        zIndex: 15,
        cursor: 'pointer',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <EquipmentIcon type={iconType} />
      {/* Hover tooltip with fixed positioning using portal */}
      {hovered && typeof window !== 'undefined' && createPortal(
        <div 
          style={{ 
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          <div className="rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg whitespace-nowrap">
            <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: 4 }}>
              {equipment.name}
            </div>
            <div><strong>Status:</strong> {equipment.status}</div>
            <div><strong>Assigned Team:</strong> {equipment.assignedTeam || 'None'}</div>
            <div><strong>Location:</strong> {equipment.location || 'Unknown'}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function getTeamMarkerColors(team: Staff) {
  let color = '#2300a1ff';
  const outline = '2px solid white';

  if (team.status === 'Available') {
    color = '#4cb600ff';
  } else if (team.status === 'On Break') {
    color = 'grey';
  } else if (
    team.status === 'En Route' ||
    team.status === 'On Scene' ||
    team.status === 'Transporting'
  ) {
    color = 'red';
  }

  // if (team.sam) {
  //   outline = '2px solid red';
  // }

  return { color, outline };
}

// function getTeamMarkerText(team: Staff) {
//   if (team.sam && /^SAM\d+$/.test(team.team)) {
//     const number = team.team.replace('SAM', '');
//     return `S${number}`;
//   }
//   return team.team.slice(-1);
// }

interface TeamMarkerProps {
  team: Staff;
  post: Post;
  rect: ImageRect;
  teamTimers: { [team: string]: number };
  calls: Call[];
  clinics: Clinic[];
  scale: number;
}

function TeamMarker({
  team,
  post,
  rect,
  teamTimers,
  calls,
  clinics,
  scale,
}: TeamMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);

  const postIsValid = isPostObject(post);
  if (!postIsValid) return null;

  // Stagger team marker 8px right and 8px up from post center
  const left = rect.x + (post.x / 100) * rect.width + 16;
  const top = rect.y + (post.y / 100) * rect.height - 16;

  const { color } = getTeamMarkerColors(team);

  const activeCall = calls.find(c =>
    c.assignedTeam?.includes(team.team) && !['Resolved', 'Delivered', 'Refusal', 'NMM'].includes(c.status)
  );
  const statusLabel = team.status === 'Transporting'
    ? getTransportingLabel((key) => key, clinics, activeCall?.clinicId)
    : (team.status || 'Unknown');

  const handleMouseEnter = () => {
    setHovered(true);
    if (markerRef.current) {
      const rect = markerRef.current.getBoundingClientRect();
      // Add 10px buffer from top of screen to prevent clipping
      const yPos = Math.max(10, rect.top);
      setTooltipPos({ x: rect.right + 10, y: yPos });
    }
  };

  return (
    <div
      ref={markerRef}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        // Counter-scale against ambient map zoom so the icon stays a
        // constant on-screen size, same treatment as PostMarker/EquipmentMarker.
        transform: `translate(-50%, -50%) scale(${1 / scale})`,
        transformOrigin: 'center center',
        zIndex: 25,
        cursor: 'pointer',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <ShieldPlus
        size={26}
        strokeWidth={1.5}
        stroke="white"
        fill={color}
        style={{ filter: 'drop-shadow(0 1px 3px rgb(0 0 0 / 0.6))' }}
      />
      {/* Hover card with fixed positioning using portal */}
      {hovered && typeof window !== 'undefined' && createPortal(
        <div 
          style={{ 
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          <div className="rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg whitespace-nowrap">
            <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: 4 }}>
              {team.team}
            </div>
            <div><strong>Status:</strong> {statusLabel}</div>
            <div><strong>Post:</strong> {team.location || 'Unassigned'}</div>
            <div><strong>Status Timer:</strong> {
              typeof teamTimers[team.team] === 'number'
                ? <StatusTimer since={teamTimers[team.team]} />
                : <span>00:00</span>
            }</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export interface VenueMapWithPostsProps {
  layers: Layer[];
  currentLayer: number;
  staff: Staff[];
  equipment?: Equipment[];
  teamTimers: { [team: string]: number };
  calls?: Call[];
  clinics?: Clinic[];
  onNaturalSize?: (w: number, h: number) => void;
  isOpen?: boolean;
  scale: number;
  position: { x: number; y: number };
  isPanning: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  imgRef: React.RefObject<HTMLImageElement | null>;
  /** Overrides the image container's default rounded-2xl corners — for a
   *  caller (e.g. event creation) whose map merges flush with UI beneath it. */
  imageRadiusClassName?: string;
  /** Name of a post on the current layer to draw a brief attention ring around — e.g. the dispatch Map tab's location search jumping to a result. */
  selectedPostName?: string | null;
}

export function VenueMapWithPosts({
  layers,
  currentLayer,
  staff,
  equipment = [],
  teamTimers,
  calls = [],
  clinics = [],
  onNaturalSize,
  isOpen,
  imageRadiusClassName = 'rounded-2xl',
  scale,
  position,
  isPanning,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  imgRef,
  selectedPostName,
}: VenueMapWithPostsProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgContainerRef = useRef<HTMLDivElement | null>(null);

  const mapUrl = layers[currentLayer]?.mapUrl || '';
  const posts = layers[currentLayer]?.posts || [];

  // Update container size when component mounts and on resize
  useEffect(() => {
    function updateContainerSize() {
      if (containerRef.current) {
        const newSize = {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        };
        setContainerSize(newSize);
      }
    }
    
    const updateWithDelay = () => {
      updateContainerSize();
      requestAnimationFrame(() => {
        updateContainerSize();
        setTimeout(updateContainerSize, 10);
        setTimeout(updateContainerSize, 50);
      });
    };
    
    updateWithDelay();
    
    window.addEventListener("resize", updateContainerSize);
    return () => window.removeEventListener("resize", updateContainerSize);
  }, []);

  // Re-measure container when modal opens (for initial render)
  useEffect(() => {
    if (!isOpen) return;
    
    const measureContainer = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    const timers = [
      setTimeout(measureContainer, 0),
      setTimeout(measureContainer, 10),
      setTimeout(measureContainer, 50),
      setTimeout(measureContainer, 100),
    ];
    
    return () => timers.forEach(clearTimeout);
  }, [isOpen, mapUrl]);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
    onNaturalSize?.(img.naturalWidth, img.naturalHeight);
    
    const measureAfterImageLoad = () => {
      if (containerRef.current) {
        const newSize = {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        };
        setContainerSize(newSize);
      }
    };
    
    measureAfterImageLoad();
    
    requestAnimationFrame(() => {
      measureAfterImageLoad();
      setTimeout(measureAfterImageLoad, 10);
      setTimeout(measureAfterImageLoad, 50);
    });
  }

  const rect = getContainedImageRect(
    containerSize.width,
    containerSize.height,
    naturalSize.width,
    naturalSize.height
  );

  const shouldRenderMarkers = imageLoaded && 
    rect.width > 0 && 
    rect.height > 0 && 
    containerSize.width > 0 && 
    containerSize.height > 0 &&
    naturalSize.width > 0 && 
    naturalSize.height > 0;

  useEffect(() => {
    if (shouldRenderMarkers && containerRef.current) {
      const measureOnce = () => {
        if (containerRef.current) {
          setContainerSize({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };
      
      setTimeout(measureOnce, 5);
    }
  }, [shouldRenderMarkers]);

  return (
    <div 
      className="relative h-full w-full"
      style={{
        height: '100%',
        width: '100%',
      }}
    >
      <div
        ref={imgContainerRef}
        className={`relative overflow-hidden h-full w-full ${imageRadiusClassName}`}
        onWheel={onWheel}
        style={{
          cursor: isPanning ? 'grabbing' : 'grab',
          height: '100%',
          width: '100%',
        }}
      >
      <div
        ref={containerRef}
        className="relative"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.1s ease-out',
          width: '100%',
          height: '100%',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <Image
          ref={imgRef}
          src={mapUrl}
          alt="Venue Map"
          width={1200}
          height={800}
          style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
          unoptimized
          onLoad={handleImageLoad}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
        {shouldRenderMarkers && (
          <>
            {posts.map((post, i) => (
              <PostMarker
                key={i}
                post={post}
                rect={rect}
                staff={staff}
                scale={scale}
                isSelected={!!selectedPostName && typeof post === 'object' && post !== null && post.name === selectedPostName}
              />
            ))}
            {equipment.map((equip) => {
              const postObj = posts.find(p => (typeof p === "string" ? p : p.name) === equip.location);
              if (!postObj || typeof postObj === "string") {
                return null;
              }

              return (
                <EquipmentMarker
                  key={equip.id}
                  equipment={equip}
                  post={postObj}
                  rect={rect}
                  scale={scale}
                />
              );
            })}
            {staff.map((team) => {
              const postObj = posts.find(p => (typeof p === "string" ? p : p.name) === team.location);
              if (!postObj || typeof postObj === "string") return null;

              return (
                <TeamMarker
                  key={team.team}
                  team={team}
                  post={postObj}
                  rect={rect}
                  teamTimers={teamTimers}
                  calls={calls}
                  clinics={clinics}
                  scale={scale}
                />
              );
            })}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
