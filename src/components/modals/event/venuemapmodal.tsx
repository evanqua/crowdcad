'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Modal, ModalContent, ModalBody, Button, Card } from '@heroui/react';
import { ZoomIn, ZoomOut, RotateCcw, MapPin, ShieldPlus, Briefcase, HousePlus } from 'lucide-react';
import { Post, Staff, Equipment, Layer, TakPosition } from '@/app/types';
import { getStatusColor } from '@/lib/statusColors';
import { useTakTween } from '@/hooks/useTakTween';

// A campus-sized venue map is mostly empty space at 1x, so zoom has to go far
// enough to separate two posts a few hundred metres apart. Steps are
// multiplicative: additive steps feel fast when zoomed out and glacial when in.
const MIN_MAP_SCALE = 0.5;
const MAX_MAP_SCALE = 8;
const ZOOM_STEP = 1.5;

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

// A fix nobody has updated in over a minute is not "live" anymore, regardless
// of how confident the last reading was.
const TAK_STALE_MS = 60_000;

// The live-position dot deliberately does NOT use the team's status colour.
// Most statuses (Available, Assigned, Pending, ...) map to the default palette,
// whose text colour is near-white -- invisible as a 10px dot on a light map
// image. A fixed high-contrast cyan also reads as "this is the GPS fix", which
// is a different kind of thing from the post/assignment markers around it.
const TAK_LIVE_COLOR = '#22d3ee';

// How often the tooltip re-reads the clock while it is open. The marker's
// staleness fade only needs to be roughly right, but the age readout is the
// one number that says whether the whole TAK pipeline is alive, and rounding
// it to the nearest ten seconds makes a healthy one-second feed and a stalled
// bridge display the same value for most of a minute.
const TAK_AGE_TICK_MS = 500;
const TAK_STALENESS_TICK_MS = 10_000;

function formatTakAge(ms: number): string {
  const seconds = Math.max(0, ms / 1000);
  // One decimal while the fix is fresh. The difference between 0.4 s and 4 s of
  // latency is the difference between "working" and "something is buffering",
  // and whole seconds cannot show it.
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  return `${totalHours}h`;
}

interface PostMarkerProps {
  post: Post;
  rect: ImageRect;
  staff: Staff[];
  mapScale: number;
}

function PostMarker({ post, rect, mapScale }: PostMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);
  if (!isPostObject(post)) return null;

  const { x, y, width, height } = rect;
  const left = x + (post.x / 100) * width;
  const top = y + (post.y / 100) * height;
  
  // Check if this is a clinic location
  const isClinic = post.name.toLowerCase().includes('clinic');
  const Icon = isClinic ? HousePlus : MapPin;
  const size = isClinic ? 'h-5 w-5' : 'h-4 w-4';
  const containerSize = isClinic ? 'h-7 w-7' : 'h-6 w-6';

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
        transform: `translate(-50%, -50%) scale(${1 / mapScale})`,
        zIndex: 12,
        cursor: "pointer",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      className={`flex ${containerSize} items-center justify-center rounded-full border-2 transition-all border-accent bg-accent/20 hover:scale-110`}
    >
      <Icon className={`${size} text-accent`} strokeWidth={2.5} />

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

function EquipmentIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'wheelchair') {
    return (
      <Image
        src="/map/wheelchair.svg"
        alt="Wheelchair"
        width={24}
        height={24}
        className={className}
        draggable={false}
      />
    );
  }
  if (type === 'stretcher') {
    return (
      <Image
        src="/map/gurney.svg"
        alt="Gurney"
        width={24}
        height={24}
        className={className}
        draggable={false}
      />
    );
  }
  if (type === 'aed') {
    return <Briefcase className={className} strokeWidth={2.5} />;
  }
  return <Briefcase className={className} strokeWidth={2.5} />;
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
  mapScale: number;
}

function EquipmentMarker({
  equipment,
  post,
  rect,
  mapScale,
}: EquipmentMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);

  const postIsValid = isPostObject(post);
  if (!postIsValid) return null;

  // Position equipment marker
  // The stagger offset is applied in map-container pixels, so it has to shrink
  // with zoom to keep a constant on-screen gap from the post marker.
  const left = rect.x + (post.x / 100) * rect.width - 15 / mapScale;
  const top = rect.y + (post.y / 100) * rect.height + 15 / mapScale;

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
        transform: `translate(-50%, -50%) scale(${1 / mapScale})`,
        zIndex: 15,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Static orange circle background (same style as team bobbing ring at smallest) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#e2c93d',
          opacity: 0.6,
          zIndex: 0,
        }}
      />
      {/* Equipment icon */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        }}
      >
        <EquipmentIcon type={iconType} className="h-4 w-4 text-surface-light" />
      </div>
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
  mapScale: number;
}

function TeamMarker({
  team,
  post,
  rect,
  teamTimers,
  mapScale,
}: TeamMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);

  const postIsValid = isPostObject(post);
  if (!postIsValid) return null;

  // Stagger team marker 8px right and 8px up from post center
  const left = rect.x + (post.x / 100) * rect.width + 16 / mapScale;
  const top = rect.y + (post.y / 100) * rect.height - 16 / mapScale;

  const { color } = getTeamMarkerColors(team);

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
        transform: `translate(-50%, -50%) scale(${1 / mapScale})`,
        zIndex: 25,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Bobbing ring animation */}
      <div
        className="cc-team-bob-ring"
        style={{
          backgroundColor: color,
        }}
      />
      {/* Team icon without circle wrapper */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        }}
      >
        <ShieldPlus className="h-6 w-6 text-surface-light" strokeWidth={2.5} />
      </div>
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
            <div><strong>Status:</strong> {team.status || 'Unknown'}</div>
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

// Live GPS marker sourced from a team's `tak` field, distinct from PostMarker
// (which shows where a post is defined) and TeamMarker (which shows the post
// a team is currently assigned to). This shows where the unit actually is.
interface TakMarkerProps {
  team: Staff;
  rect: ImageRect;
  mapScale: number;
}

function TakMarker({ team, rect, mapScale }: TakMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);

  // Staleness depends on wall-clock time, not just on new tak data arriving,
  // so re-render periodically to let the marker fade and the tooltip's
  // "Xs ago" advance even when the event document hasn't changed.
  //
  // Twice a second while the tooltip is open, because the age readout is then
  // being used to diagnose the feed and needs to move like a clock; back to
  // every ten seconds when it is closed, which is all the fade needs and keeps
  // idle markers off the render path.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const period = hovered ? TAK_AGE_TICK_MS : TAK_STALENESS_TICK_MS;
    const interval = setInterval(() => setNow(Date.now()), period);
    return () => clearInterval(interval);
  }, [hovered]);

  const tak: TakPosition | undefined = team.tak;

  // Tween between fixes, in map percentages. Positions land about once a second
  // and used to be written straight to left/top, so the dot teleported on every
  // update; this walks it there, through the intermediate fixes on `tak.path`
  // when the bridge sent any. Called before the early return below because it
  // is a hook — a team whose device drops off the feed must not change how many
  // hooks this component runs.
  const tweened = useTakTween(tak);

  if (!tak || tak.x == null || tak.y == null || tak.onMap === false) return null;

  const { x, y, width, height } = rect;
  // Fall back to the reported position for the frame before the first tween
  // commits, so the marker never renders at the origin.
  const drawn = tweened ?? { x: tak.x, y: tak.y };
  const left = x + (drawn.x / 100) * width;
  const top = y + (drawn.y / 100) * height;

  const ageMs = now - tak.timestamp;
  const isStale = ageMs > TAK_STALE_MS;

  const handleMouseEnter = () => {
    setHovered(true);
    if (markerRef.current) {
      const r = markerRef.current.getBoundingClientRect();
      const yPos = Math.max(10, r.top);
      setTooltipPos({ x: r.right + 10, y: yPos });
    }
  };

  return (
    <div
      ref={markerRef}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        transform: `translate(-50%, -50%) scale(${1 / mapScale})`,
        zIndex: 30,
        cursor: 'pointer',
        opacity: isStale ? 0.35 : 1,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center"
    >
      {/* Pulsing halo signals "live"; a stale fix drops opacity and stops pulsing above */}
      {!isStale && (
        <div className="cc-tak-pulse-ring" style={{ backgroundColor: TAK_LIVE_COLOR }} />
      )}
      <div
        className="cc-tak-dot"
        style={{
          backgroundColor: TAK_LIVE_COLOR,
          border: '2px solid rgba(255,255,255,0.95)',
          // Dark halo so the dot stays legible over pale areas of the map image
          boxShadow: '0 0 0 1px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.5)',
        }}
      />

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
            {/* Status colour lives in the tooltip rather than on the dot: over a
                dark panel it actually reads, and the dot needs to stay legible
                over the map image regardless of status. */}
            <div
              className={getStatusColor(team.status).textClass}
              style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: 4 }}
            >
              {team.team}
            </div>
            <div><strong>Status:</strong> {team.status}</div>
            {tak.callsign && <div><strong>Callsign:</strong> {tak.callsign}</div>}
            {/* The one number that says whether the feed is alive. A healthy
                pipeline sits near a second; anything growing without bound
                means the bridge, the server or the phone has stopped, and
                naming it "stale" saves working that out from the fade. */}
            <div className={isStale ? 'text-status-orange' : undefined}>
              <strong>Fix:</strong> {formatTakAge(ageMs)} ago{isStale ? ' (stale)' : ''}
            </div>
            {typeof tak.accuracy === 'number' && <div><strong>Accuracy:</strong> ±{Math.round(tak.accuracy)}m</div>}
            {tak.nearestPost && <div><strong>Nearest Post:</strong> {tak.nearestPost}</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface VenueMapWithPostsProps {
  layers: Layer[];
  currentLayer: number;
  staff: Staff[];
  equipment?: Equipment[];
  teamTimers: { [team: string]: number };
  onNaturalSize?: (w: number, h: number) => void;
  isOpen?: boolean;
  scale: number;
  position: { x: number; y: number };
  isPanning: boolean;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  imgRef: React.RefObject<HTMLImageElement | null>;
  // Owned by the parent: it needs the viewport box to clamp panning and to
  // anchor wheel zoom, and it attaches its own non-passive wheel listener here.
  imgContainerRef: React.RefObject<HTMLDivElement | null>;
}

function VenueMapWithPosts({
  layers,
  currentLayer,
  staff,
  equipment = [],
  teamTimers,
  onNaturalSize,
  isOpen,
  scale,
  position,
  isPanning,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  imgRef,
  imgContainerRef,
}: VenueMapWithPostsProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        className="relative overflow-hidden h-full w-full rounded-2xl"
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
                mapScale={scale}
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
                  mapScale={scale}
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
                  mapScale={scale}
                />
              );
            })}
            {staff
              .filter((team) => team.tak && team.tak.x != null && team.tak.y != null && team.tak.onMap !== false)
              .map((team) => (
                <TakMarker key={`tak-${team.team}`} team={team} rect={rect} mapScale={scale} />
              ))}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

interface VenueMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  staff: Staff[];
  equipment?: Equipment[];
  teamTimers: { [team: string]: number };
}

export default function VenueMapModal({
  isOpen,
  onClose,
  layers,
  staff,
  equipment = [],
  teamTimers,
}: VenueMapModalProps) {
  const [currentLayer, setCurrentLayer] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [modalHeight, setModalHeight] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  // Calculate modal height (90% of viewport for maximum visibility)
  useEffect(() => {
    const calculateHeight = () => {
      const viewportHeight = window.innerHeight;
      const maxHeight = viewportHeight * 0.75; // 90% of viewport height
      setModalHeight(maxHeight);
    };
    
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsPanning(false);
    }
  }, [isOpen]);

  // Keep the map from being dragged off screen: the image may be panned until
  // one of its edges reaches the viewport edge, and locks to centre whenever it
  // is smaller than the viewport. `position` is applied before `scale` in the
  // transform, so it is in unscaled screen pixels.
  const clampPosition = useCallback((pos: { x: number; y: number }, s: number) => {
    const container = imgContainerRef.current;
    const img = imgRef.current;
    if (!container || !img) return pos;

    const { width: cw, height: ch } = container.getBoundingClientRect();
    const image = getContainedImageRect(cw, ch, img.naturalWidth, img.naturalHeight);
    if (!image.width || !image.height) return pos;

    const maxX = Math.max(0, (image.width * s - cw) / 2);
    const maxY = Math.max(0, (image.height * s - ch) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, pos.x)),
      y: Math.min(maxY, Math.max(-maxY, pos.y)),
    };
  }, []);

  // Zoom about a fixed point, so the map grows around what you are looking at
  // rather than around the middle of the modal. The container is transformed
  // about its centre, so a point p (measured from that centre, unscaled) lands
  // at position + scale * p; holding that landing point still across a scale
  // change gives the new translation. `anchor` is also measured from the
  // centre, so the zoom buttons pass null and get centre-anchored zoom.
  const zoomAbout = (nextScale: number, anchor: { x: number; y: number } | null) => {
    const next = Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, nextScale));
    if (next === scale) return;

    const nextPosition = anchor
      ? {
          x: anchor.x - (next / scale) * (anchor.x - position.x),
          y: anchor.y - (next / scale) * (anchor.y - position.y),
        }
      : position;

    setScale(next);
    setPosition(clampPosition(nextPosition, next));
  };

  const handleZoomIn = () => zoomAbout(scale * ZOOM_STEP, null);
  const handleZoomOut = () => zoomAbout(scale / ZOOM_STEP, null);

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Wheel zooms the map rather than scrolling the modal. This is attached
  // natively rather than through onWheel because React registers wheel
  // listeners as passive, where preventDefault() is ignored. deltaMode varies
  // by browser and device (pixels, lines, pages), so the per-event factor is
  // clamped rather than trusting deltaY's magnitude.
  useEffect(() => {
    const viewport = imgContainerRef.current;
    if (!viewport || !isOpen) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const anchor = {
        x: e.clientX - (rect.left + rect.width / 2),
        y: e.clientY - (rect.top + rect.height / 2),
      };
      const factor = Math.min(1.5, Math.max(1 / 1.5, Math.exp(-e.deltaY * 0.002)));
      zoomAbout(scale * factor, anchor);
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  });

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    setPosition(
      clampPosition({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }, scale)
    );
  };

  // Handle pan end
  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const mapFileName = layers[currentLayer]?.mapUrl 
    ? (() => {
        try {
          const url = layers[currentLayer].mapUrl!;
          const u = new URL(url);
          const filename = u.pathname.split('/').pop() || '';
          const parts = filename.split('_');
          if (parts.length > 1) {
            return decodeURIComponent(parts.slice(1).join('_'));
          } else {
            return decodeURIComponent(filename);
          }
        } catch {
          const url = layers[currentLayer].mapUrl!;
          const s = url.split('?')[0];
          const filename = s.substring(s.lastIndexOf('/') + 1);
          const parts = filename.split('_');
          if (parts.length > 1) {
            return decodeURIComponent(parts.slice(1).join('_'));
          } else {
            return decodeURIComponent(filename);
          }
        }
      })()
    : '';

  // Bottom bar height ~60px (kept as note for future layout adjustments)

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="3xl"
      placement="center"
      hideCloseButton={true}
      classNames={{
        base: "bg-surface-deepest",
        backdrop: "bg-black/60",
      }}
      style={{
        height: modalHeight > 0 ? `${modalHeight}px` : '85vh',
        maxHeight: modalHeight > 0 ? `${modalHeight}px` : '85vh',
      }}
    >
      <ModalContent style={{ 
        height: modalHeight > 0 ? `${modalHeight}px` : '85vh',
        maxHeight: modalHeight > 0 ? `${modalHeight}px` : '85vh' 
      }}>
        <ModalBody className="p-6 flex flex-col" style={{ height: '100%' }}>
          <div className="flex flex-col gap-3" style={{ height: '100%' }}>
            <div className="relative w-full overflow-visible rounded-xl flex-1" style={{ minHeight: 0 }}>
              <VenueMapWithPosts
                layers={layers}
                currentLayer={currentLayer}
                staff={staff}
                equipment={equipment}
                teamTimers={teamTimers}
                isOpen={isOpen}
                scale={scale}
                position={position}
                isPanning={isPanning}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                imgRef={imgRef}
                imgContainerRef={imgContainerRef}
              />

              {/* Zoom Controls */}
              <div className="absolute top-3 right-3 flex flex-row gap-1 z-20">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={handleZoomIn}
                  className="bg-surface-deepest/90 backdrop-blur"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={handleZoomOut}
                  className="bg-surface-deepest/90 backdrop-blur"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  onPress={handleResetZoom}
                  className="bg-surface-deepest/90 backdrop-blur"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Bottom Control Bar */}
            <Card
              isBlurred
              className="border border-default-200 bg-transparent w-full px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-surface-light font-medium">
                    {mapFileName || 'No map'}
                  </span>
                </div>
                {layers && layers.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setCurrentLayer(prev => Math.max(0, prev - 1))}
                      isDisabled={currentLayer === 0}
                      className="text-surface-light"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-surface-light">
                      {layers[currentLayer]?.name || `Layer ${currentLayer + 1}`}
                    </span>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setCurrentLayer(prev => Math.min(layers.length - 1, prev + 1))}
                      isDisabled={currentLayer === layers.length - 1}
                      className="text-surface-light"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </ModalBody>
      </ModalContent>
      <style jsx global>{`
        @keyframes ccTeamBob {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 0.4;
          }
        }
        .cc-team-bob-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          animation: ccTeamBob 2s ease-in-out infinite;
          will-change: transform, opacity;
        }
        @keyframes ccTakPulse {
          0% {
            transform: translate(-50%, -50%) scale(0.6);
            opacity: 0.55;
          }
          70%,
          100% {
            transform: translate(-50%, -50%) scale(1.8);
            opacity: 0;
          }
        }
        .cc-tak-pulse-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          animation: ccTakPulse 1.8s ease-out infinite;
          will-change: transform, opacity;
        }
        .cc-tak-dot {
          position: relative;
          z-index: 1;
          width: 13px;
          height: 13px;
          border-radius: 50%;
        }
      `}</style>
    </Modal>
  );
}