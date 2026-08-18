'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Modal, ModalContent, ModalBody, Button, Card, Select, SelectItem } from '@heroui/react';
import { ZoomIn, ZoomOut, RotateCcw, MapPin, ShieldPlus, Briefcase, HousePlus, PhoneCall, AlertTriangle, X, ArrowUp } from 'lucide-react';
import { Post, Staff, Equipment, Layer, TakPosition, Call, CallPosition, Event } from '@/app/types';
import { getStatusColor } from '@/lib/statusColors';
import { useTakTween } from '@/hooks/useTakTween';
import { useAuth } from '@/hooks/useauth';
import {
  buildCallPinLogEntry,
  callPinStaleness,
  isLayerCalibrated,
  placeCallPin,
  resolveCallPinPercent,
  type PercentPoint,
} from '@/lib/callPositionUtils';
import { offMapIndicator, type OffMapIndicator } from '@/lib/offMapUtils';
import {
  declutterLabels,
  edgeBadgeObstacles,
  estimateLabelBox,
  layoutEdgeBadges,
  markerCounterScale,
  staggerOffsetPx,
  SECONDARY_LABEL_MIN_SCALE,
  type LabelBox,
} from '@/lib/labelScale';
import { isPointWithinRect, pixelToPercent } from '@/lib/markerUtils';
import { cn } from '@/lib/utils';
import MarkerModeToggleButton from '@/components/venue-management/MarkerModeToggleButton';
import MarkerPlacementInstruction from '@/components/venue-management/MarkerPlacementInstruction';

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

// Base font size of a persistent map label, in the marker's OWN pixels. Every
// marker wrapper is already scaled by markerCounterScale(mapScale), so a label
// drawn at this size inside one lands on screen at
// LABEL_FONT_BASE_PX * labelScreenScale(mapScale) -- square-root-of-zoom
// growth, without this component having to know the zoom at all.
const LABEL_FONT_BASE_PX = 12;

// Half-heights of each marker's own box, in the same pre-zoom pixels. Used by
// the parent to predict where a label will land so it can decide collisions
// before the label exists to measure. Kept next to the markers themselves
// because they are the thing that changes if a marker is resized.
const POST_MARKER_HALF_PX = 12;
const CLINIC_MARKER_HALF_PX = 14;
const TAK_MARKER_HALF_PX = 8;
const CALL_MARKER_HALF_PX = 14;
const LABEL_GAP_PX = 3;

/**
 * A persistent name drawn under a marker, as distinct from the hover tooltip
 * next to it. The tooltip answers "what is this, in detail, right now"; the
 * label answers "what am I looking at" without requiring a hover, which is
 * what a map is supposed to do and what a screenshot's baked-in names cannot
 * do once you zoom.
 *
 * aria-hidden on purpose: whether this draws is a *visual* decluttering
 * decision that changes with zoom, and a screen reader must not lose a post's
 * name because two labels happened to overlap. The marker itself carries the
 * name in an aria-label at every zoom instead.
 */
function MapLabel({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: '50%',
        top: '100%',
        transform: `translate(-50%, ${LABEL_GAP_PX}px)`,
        fontSize: `${LABEL_FONT_BASE_PX}px`,
        lineHeight: 1.35,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
      className={cn(
        'rounded bg-surface-deepest/80 px-1.5 py-0.5 font-semibold text-surface-light shadow-sm',
        className
      )}
    >
      {text}
    </div>
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

// Whole metres below 1km ("420 m") and one decimal km above ("1.4 km") -- the
// same threshold most map UIs use, and precise enough to be actionable on
// foot without implying GPS accuracy this system doesn't have.
function formatOffMapDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// One off-map badge's rendering inputs, independent of whether it came from
// a Call pin or a team's TAK fix -- see labelScale.layoutEdgeBadges for why
// the two populations share one layout pass.
interface OffMapBadgeSpec {
  id: string;
  indicator: OffMapIndicator;
  labelText: string;
  ariaLabel: string;
  colorHex?: string;
  borderClassName?: string;
  fillClassName?: string;
  textClassName?: string;
}

// Draws one "this way, N metres" badge at the venue image's boundary. Never
// receives or writes a real CallPosition/TakPosition -- `indicator.edge` is
// pure drawing data from offMapUtils.offMapIndicator, computed fresh every
// render (see that module's doc comment on why clamping the real position
// would be exactly the lie `onMap: false` exists to avoid).
//
// Colour is either a status-derived Tailwind class triple (calls, via
// getStatusColor -- see core/CLAUDE.md on not hardcoding status colour) or
// the existing TAK_LIVE_COLOR hex constant (teams), never a new colour
// invented for this feature.
interface OffMapBadgeProps {
  left: number;
  top: number;
  screenAngleDeg: number;
  mapScale: number;
  labelText: string;
  ariaLabel: string;
  colorHex?: string;
  borderClassName?: string;
  fillClassName?: string;
  textClassName?: string;
}

function OffMapBadge({
  left,
  top,
  screenAngleDeg,
  mapScale,
  labelText,
  ariaLabel,
  colorHex,
  borderClassName,
  fillClassName,
  textClassName,
}: OffMapBadgeProps) {
  const ringStyle: React.CSSProperties | undefined = colorHex
    ? {
        borderColor: colorHex,
        backgroundColor: `${colorHex}33`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }
    : undefined;
  const iconStyle: React.CSSProperties = { transform: `rotate(${screenAngleDeg}deg)` };
  if (colorHex) iconStyle.color = colorHex;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        // Constant on-screen size, unlike the sub-linear map markers below:
        // this badge is viewport chrome pinned to the image boundary, and its
        // bearing arrow and distance readout have to stay legible at 0.5x and
        // at 8x alike. That is the k = 1 endpoint described in labelScale.ts,
        // and it is the one place where it is still the right answer.
        transform: `translate(-50%, -50%) scale(${1 / mapScale})`,
        zIndex: 26,
        pointerEvents: 'none',
      }}
      className="flex flex-col items-center gap-0.5"
      role="img"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full border-2',
          !colorHex && borderClassName,
          !colorHex && fillClassName
        )}
        style={ringStyle}
      >
        <ArrowUp className={cn('h-3.5 w-3.5', !colorHex && textClassName)} style={iconStyle} strokeWidth={2.5} />
      </div>
      <span
        className={cn(
          'rounded bg-surface-deepest/90 px-1 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap',
          !colorHex && textClassName
        )}
        style={colorHex ? { color: colorHex } : undefined}
      >
        {labelText}
      </span>
    </div>
  );
}

interface PostMarkerProps {
  post: Post;
  rect: ImageRect;
  staff: Staff[];
  mapScale: number;
  /**
   * Decided by the parent's declutter pass, not here: whether this label
   * draws depends on every OTHER label on the map, which a single marker
   * cannot see. See labelScale.declutterLabels.
   */
  showLabel?: boolean;
}

function PostMarker({ post, rect, mapScale, showLabel }: PostMarkerProps) {
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
        transform: `translate(-50%, -50%) scale(${markerCounterScale(mapScale)})`,
        zIndex: 12,
        cursor: "pointer",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      role="img"
      aria-label={post.name}
      className={`flex ${containerSize} items-center justify-center rounded-full border-2 transition-all border-accent bg-accent/20 hover:scale-110`}
    >
      <Icon className={`${size} text-accent`} strokeWidth={2.5} />
      {showLabel && <MapLabel text={post.name} />}

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
  const left = rect.x + (post.x / 100) * rect.width - staggerOffsetPx(15, mapScale);
  const top = rect.y + (post.y / 100) * rect.height + staggerOffsetPx(15, mapScale);

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
        transform: `translate(-50%, -50%) scale(${markerCounterScale(mapScale)})`,
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
  const left = rect.x + (post.x / 100) * rect.width + staggerOffsetPx(16, mapScale);
  const top = rect.y + (post.y / 100) * rect.height - staggerOffsetPx(16, mapScale);

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
        transform: `translate(-50%, -50%) scale(${markerCounterScale(mapScale)})`,
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
  showLabel?: boolean;
}

function TakMarker({ team, rect, mapScale, showLabel }: TakMarkerProps) {
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
        transform: `translate(-50%, -50%) scale(${markerCounterScale(mapScale)})`,
        zIndex: 30,
        cursor: 'pointer',
        opacity: isStale ? 0.35 : 1,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      role="img"
      aria-label={`${team.team} live position`}
      className="flex items-center justify-center"
    >
      {/* The live callsign outranks every other label on the map: it is the
          one that answers "where is my unit", which is the question the map
          is open to answer. */}
      {showLabel && (
        <MapLabel text={team.team} className={isStale ? 'opacity-70' : undefined} />
      )}
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

// A call's own pin, distinct from PostMarker (a named post) and TeamMarker /
// TakMarker (where a team is assigned / actually is). Colour comes from
// getStatusColor() -- the SAME lookup every other dispatch surface uses --
// rather than any local class map, per core/CLAUDE.md: status colour lives
// in exactly one place.
interface CallMarkerProps {
  // null denotes the not-yet-created draft pin used by Quick Call's optional
  // "drop a pin" picker (see VenueMapModal's `draftPick` prop): there is no
  // Call to read order/status/location from yet, so the marker renders a
  // neutral, generic version of itself instead of leaving a hole in the type.
  call: Call | null;
  percent: PercentPoint;
  rect: ImageRect;
  mapScale: number;
  isStale: boolean;
  isDraggable: boolean;
  isDragging: boolean;
  onDragStart?: (e: React.MouseEvent<HTMLDivElement>) => void;
  showLabel?: boolean;
}

function CallMarker({
  call,
  percent,
  rect,
  mapScale,
  isStale,
  isDraggable,
  isDragging,
  onDragStart,
  showLabel,
}: CallMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const markerRef = useRef<HTMLDivElement>(null);

  const { x, y, width, height } = rect;
  const left = x + (percent.x / 100) * width;
  const top = y + (percent.y / 100) * height;

  const statusColor = getStatusColor(call?.status);

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
        transform: `translate(-50%, -50%) scale(${markerCounterScale(mapScale)})`,
        zIndex: isDragging ? 40 : 20,
        cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={isDraggable ? onDragStart : undefined}
      // A click that lands on the marker itself is never "click the empty
      // map to place a pin here" -- without this, releasing a drag (a
      // mousedown+mouseup pair on the same element) also fires a click that
      // bubbles up to the map's placement handler and immediately re-places
      // the pin it was just dragged to, at the same spot, as a spurious
      // no-op "moved" log entry.
      onClick={(e) => e.stopPropagation()}
      role="img"
      aria-label={call ? `Call #${call.order}` : 'New call pin'}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110',
        statusColor.borderClass,
        statusColor.fillClass
      )}
    >
      <PhoneCall className={cn('h-4 w-4', statusColor.textClass)} strokeWidth={2.5} />
      {/* Zoom-gated: a call number is detail, and at 1x a campus map crowded
          with them reads as a word cloud. It appears one zoom step in. */}
      {showLabel && call && (
        <MapLabel text={`#${call.order}`} className={statusColor.textClass} />
      )}

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
            {call ? (
              <>
                <div className={statusColor.textClass} style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: 4 }}>
                  Call #{call.order}
                </div>
                <div><strong>Status:</strong> {call.status || 'Unknown'}</div>
                {call.location && <div><strong>Location:</strong> {call.location}</div>}
                {call.chiefComplaint && <div><strong>Complaint:</strong> {call.chiefComplaint}</div>}
              </>
            ) : (
              <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: 4 }}>New call pin</div>
            )}
            {isDraggable && <div className="text-surface-faint">Drag to correct</div>}
            {isStale && (
              <div className="text-status-orange">Layer recalibrated since this pin was placed</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Shown in place of MarkerPlacementInstruction when placement mode is armed
// but the layer being viewed has no usable georeference. This is a refusal,
// not a degraded mode -- see the "Consequence, accepted deliberately"
// paragraph on CallPosition in app/types.ts. Clicking the map while this is
// showing intentionally does nothing; the banner is the whole explanation,
// so there's nothing else to surface per-click.
function UncalibratedLayerNotice({ venueEditHref }: { venueEditHref?: string }) {
  return (
    <div className="absolute left-3 top-3 z-20 max-w-xs rounded-lg border border-status-red/50 bg-surface-deepest/95 px-3 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-red" />
        <p className="text-xs text-status-red">
          This layer isn&apos;t georeferenced, so a call pin here can&apos;t be expressed as a real
          coordinate.{' '}
          {venueEditHref && (
            <a
              href={venueEditHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-status-red/80"
            >
              Add control points in the venue editor
            </a>
          )}
        </p>
      </div>
    </div>
  );
}

// A call pin ready to draw: percent position already resolved against the
// current layer (see resolveCallPinPercent), so VenueMapWithPosts never has
// to know about lat/lon or georeference at all -- that math is entirely the
// parent VenueMapModal's job (via callPositionUtils.ts).
interface ResolvedCallPin {
  call: Call;
  percent: PercentPoint;
  isStale: boolean;
}

interface DraftPinState {
  percent: PercentPoint;
  isDragging: boolean;
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
  // Call pins. Resolution against the current layer (including re-deriving
  // x/y from lat/lon on every render, per resolveCallPinPercent's doc
  // comment) happens in the parent; this component only draws.
  callPins?: ResolvedCallPin[];
  draggingCallId?: string | null;
  onCallMarkerMouseDown?: (callId: string, e: React.MouseEvent<HTMLDivElement>) => void;
  // The single not-yet-committed pin used by Quick Call's optional picker
  // (VenueMapModal's `draftPick` mode). Mutually exclusive with callPins in
  // practice -- draft mode is a different modal instance, not a different
  // call -- but nothing here enforces that; it just draws whatever it's given.
  draftPin?: DraftPinState | null;
  onDraftMarkerMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  // True while a click on the map (as opposed to a marker) should place or
  // move a pin rather than pan. Only affects cursor styling here -- the
  // actual click routing lives in the parent's onMouseDown/onMapClick split.
  isPlacementArmed?: boolean;
  // Fired on a plain click of the map background. Only ever does anything in
  // the parent when placement is armed (or draft mode is active); wiring it
  // unconditionally here is harmless since a click that isn't otherwise
  // meaningful is simply ignored upstream.
  onMapClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
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
  callPins = [],
  draggingCallId = null,
  onCallMarkerMouseDown,
  draftPin = null,
  onDraftMarkerMouseDown,
  isPlacementArmed = false,
  onMapClick,
}: VenueMapWithPostsProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const mapUrl = layers[currentLayer]?.mapUrl || '';
  const posts = layers[currentLayer]?.posts || [];
  const activeLayer = layers[currentLayer];

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

  // Off-map edge indicators (Phase 7.E(1)). `imageAspect` needs the real
  // rendered image's natural size -- before it loads naturalWidth is 0, so
  // this whole block (and offMapIndicator's aspect-dependent math) is gated
  // on shouldRenderMarkers, which already requires naturalSize.width/height
  // > 0. Nothing here reads or writes a CallPosition/TakPosition; it only
  // decides which already-resolved percent points to draw as a badge
  // instead of a marker.
  let onMapCallPins = callPins;
  const offMapBadgeSpecs: OffMapBadgeSpec[] = [];
  if (shouldRenderMarkers && activeLayer) {
    const imageAspect = naturalSize.width / naturalSize.height;
    onMapCallPins = [];

    for (const pin of callPins) {
      // The pin actively being dragged keeps its live CallMarker regardless
      // of where it currently sits -- that marker IS the drag handle
      // (mousedown/mousemove/mouseup all target it), and swapping it for a
      // non-interactive badge mid-drag would strand the interaction added
      // in 4dc00c8. offMapIndicator is only consulted once the drag ends.
      if (draggingCallId === pin.call.id) {
        onMapCallPins.push(pin);
        continue;
      }
      const indicator = offMapIndicator(activeLayer, pin.percent, imageAspect);
      if (!indicator) {
        onMapCallPins.push(pin);
        continue;
      }
      const statusColor = getStatusColor(pin.call.status);
      const geoText = indicator.geo
        ? `${indicator.geo.compass} ${formatOffMapDistance(indicator.geo.distanceMetres)}`
        : null;
      // Identity only -- Call #<order>, the same thing CallMarker's own
      // tooltip leads with -- never chief complaint/age/gender (no PHI in
      // anything drawn or loggable here).
      const identity = `Call #${pin.call.order}`;
      offMapBadgeSpecs.push({
        id: `call-${pin.call.id}`,
        indicator,
        labelText: geoText ? `${identity} ${geoText}` : identity,
        ariaLabel: geoText
          ? `${identity} is off the map, ${geoText}${pin.isStale ? ' (position may be stale after recalibration)' : ''}`
          : `${identity} is off the map, direction shown only -- layer is not calibrated for a distance`,
        borderClassName: statusColor.borderClass,
        fillClassName: statusColor.fillClass,
        textClassName: statusColor.textClass,
      });
    }

    for (const team of staff) {
      const tak = team.tak;
      if (!tak || tak.x == null || tak.y == null || tak.onMap !== false) continue;
      const indicator = offMapIndicator(activeLayer, { x: tak.x, y: tak.y }, imageAspect);
      // onMap: false is the bridge's own call; offMapIndicator re-derives
      // the same fact from the percent it stored. If the two disagree (a
      // stale onMap flag on an otherwise on-image fix), trust the geometry
      // and draw nothing rather than a badge pointing at the image centre.
      if (!indicator) continue;
      const geoText = indicator.geo
        ? `${indicator.geo.compass} ${formatOffMapDistance(indicator.geo.distanceMetres)}`
        : null;
      const identity = team.team;
      offMapBadgeSpecs.push({
        id: `tak-${team.team}`,
        indicator,
        labelText: geoText ? `${identity} ${geoText}` : identity,
        ariaLabel: geoText
          ? `${identity} is off the map, ${geoText}`
          : `${identity} is off the map, direction shown only -- layer is not calibrated for a distance`,
        // Reuses the same TAK_LIVE_COLOR every live GPS dot already uses --
        // this is still "where the unit actually is", just off the image.
        colorHex: TAK_LIVE_COLOR,
      });
    }
  }
  // Badges are laid out first and then enter the label declutter pass below
  // as immovable obstacles, so an off-map call never loses its badge to an
  // ordinary post label. See labelScale.declutterLabels.
  const offMapBadgePositions = layoutEdgeBadges(
    offMapBadgeSpecs.map((spec) => ({ id: spec.id, edge: spec.indicator.edge })),
    rect,
    scale
  );

  // ---- Phase 7.E(3): who gets a label at this zoom -------------------------
  //
  // Three mechanisms, all of them in labelScale.ts so they are unit-testable
  // (this file has no component-test harness):
  //
  //   (a) size    -- every marker is scaled by markerCounterScale(scale), so
  //                  its net on-screen size grows as sqrt(zoom) instead of
  //                  staying frozen (what this map used to do) or growing
  //                  1:1 with the raster (what the venue editor used to do);
  //   (b) collide -- overlapping labels are hidden rather than nudged, so a
  //                  label never ends up pointing at the wrong post;
  //   (c) gate    -- call numbers are secondary detail and only appear above
  //                  SECONDARY_LABEL_MIN_SCALE, so zooming in reveals more of
  //                  the map instead of just magnifying it.
  //
  // Computed here, in the one place that can see every marker at once. A
  // marker cannot decide its own visibility: that depends on its neighbours.
  const labelCounter = markerCounterScale(scale);
  const labelBoxes: LabelBox[] = [];
  if (shouldRenderMarkers) {
    posts.forEach((post, i) => {
      if (!isPostObject(post) || !post.name) return;
      const box = estimateLabelBox(post.name, LABEL_FONT_BASE_PX);
      const halfPx = post.name.toLowerCase().includes('clinic')
        ? CLINIC_MARKER_HALF_PX
        : POST_MARKER_HALF_PX;
      labelBoxes.push({
        id: `post-${i}`,
        centerX: rect.x + (post.x / 100) * rect.width,
        centerY:
          rect.y +
          (post.y / 100) * rect.height +
          (halfPx + LABEL_GAP_PX + box.height / 2) * labelCounter,
        width: box.width * labelCounter,
        height: box.height * labelCounter,
        priority: 10,
      });
    });

    staff.forEach((team) => {
      const t = team.tak;
      if (!t || t.x == null || t.y == null || t.onMap === false) return;
      const box = estimateLabelBox(team.team, LABEL_FONT_BASE_PX);
      labelBoxes.push({
        id: `tak-${team.team}`,
        // The reported fix, not the tweened one: the tween lives inside
        // TakMarker's own hook and is at most a second of travel away. Reading
        // it here would mean re-running the collision pass on every animation
        // frame, and a label that blinks off mid-stride is worse than one
        // that is briefly a few pixels behind its dot.
        centerX: rect.x + (t.x / 100) * rect.width,
        centerY:
          rect.y +
          (t.y / 100) * rect.height +
          (TAK_MARKER_HALF_PX + LABEL_GAP_PX + box.height / 2) * labelCounter,
        width: box.width * labelCounter,
        height: box.height * labelCounter,
        // Outranks posts and calls: a post is where something is defined to
        // be, a live fix is where a responder actually is.
        priority: 30,
      });
    });

    onMapCallPins.forEach(({ call, percent }) => {
      const box = estimateLabelBox(`#${call.order}`, LABEL_FONT_BASE_PX);
      labelBoxes.push({
        id: `call-${call.id}`,
        centerX: rect.x + (percent.x / 100) * rect.width,
        centerY:
          rect.y +
          (percent.y / 100) * rect.height +
          (CALL_MARKER_HALF_PX + LABEL_GAP_PX + box.height / 2) * labelCounter,
        width: box.width * labelCounter,
        height: box.height * labelCounter,
        priority: 20,
        minScale: SECONDARY_LABEL_MIN_SCALE,
      });
    });
  }
  const labelVisible = declutterLabels(labelBoxes, scale, {
    obstacles: edgeBadgeObstacles(offMapBadgePositions, scale),
  });

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
          cursor: isPanning ? 'grabbing' : isPlacementArmed ? 'crosshair' : 'grab',
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
        onClick={onMapClick}
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
                showLabel={labelVisible.get(`post-${i}`) === true}
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
                <TakMarker
                  key={`tak-${team.team}`}
                  team={team}
                  rect={rect}
                  mapScale={scale}
                  showLabel={labelVisible.get(`tak-${team.team}`) === true}
                />
              ))}
            {onMapCallPins.map(({ call, percent, isStale }) => (
              <CallMarker
                key={call.id}
                call={call}
                percent={percent}
                rect={rect}
                mapScale={scale}
                showLabel={labelVisible.get(`call-${call.id}`) === true}
                isStale={isStale}
                isDraggable={!!onCallMarkerMouseDown}
                isDragging={draggingCallId === call.id}
                onDragStart={
                  onCallMarkerMouseDown
                    ? (e) => onCallMarkerMouseDown(call.id, e)
                    : undefined
                }
              />
            ))}
            {offMapBadgeSpecs.map((spec) => {
              const pos = offMapBadgePositions.get(spec.id);
              if (!pos) return null;
              return (
                <OffMapBadge
                  key={spec.id}
                  left={pos.left}
                  top={pos.top}
                  screenAngleDeg={spec.indicator.screenAngleDeg}
                  mapScale={scale}
                  labelText={spec.labelText}
                  ariaLabel={spec.ariaLabel}
                  colorHex={spec.colorHex}
                  borderClassName={spec.borderClassName}
                  fillClassName={spec.fillClassName}
                  textClassName={spec.textClassName}
                />
              );
            })}
            {draftPin && (
              <CallMarker
                call={null}
                percent={draftPin.percent}
                rect={rect}
                mapScale={scale}
                isStale={false}
                isDraggable={!!onDraftMarkerMouseDown}
                isDragging={draftPin.isDragging}
                onDragStart={onDraftMarkerMouseDown}
              />
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

// Wired in only when VenueMapModal is opened as Quick Call's optional
// "drop a pin" picker rather than the normal dispatch map. In that mode
// there is no Call yet to attach a position to -- the picker just hands a
// finished CallPosition back to the caller via onPick when the dispatcher
// presses "Use this pin", and the caller (QuickCallModal's owner) is
// responsible for holding it in local draft state until the call is
// actually submitted. Closing the modal any other way (Cancel, backdrop,
// Escape) is a plain discard: onClose alone, nothing picked.
interface DraftPickConfig {
  initial?: CallPosition | null;
  onPick: (position: CallPosition) => void;
}

interface VenueMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  staff: Staff[];
  equipment?: Equipment[];
  teamTimers: { [team: string]: number };
  // The following four props are all part of one feature (Phase 7.B call
  // pins) and are all optional so existing callers (and the draft-picker
  // mode below) keep working unchanged. Omitting `calls`/`updateEvent`
  // simply means "no call-pinning UI here" -- the modal falls back to being
  // exactly what it was before this feature existed.
  calls?: Call[];
  updateEvent?: (
    updateInput: Partial<Event> | ((current: Event) => Partial<Event>)
  ) => Promise<void>;
  // Used only to build the "Add control points in the venue editor" link in
  // the uncalibrated-layer refusal banner. Cosmetic; omitting it just omits
  // the link and keeps the rest of the banner's explanation.
  venueId?: string;
  draftPick?: DraftPickConfig;
}

export default function VenueMapModal({
  isOpen,
  onClose,
  layers,
  staff,
  equipment = [],
  teamTimers,
  calls = [],
  updateEvent,
  venueId,
  draftPick,
}: VenueMapModalProps) {
  const { user } = useAuth();
  const isDraftMode = !!draftPick;

  const [currentLayer, setCurrentLayer] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [modalHeight, setModalHeight] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  // Call-pin placement state. isPlacementArmed only matters in the normal
  // (non-draft) map: it's the MarkerModeToggleButton-driven "click to place"
  // mode from the venue editor, applied to whichever call is selected below.
  // Draft mode has no separate arm step -- every click places/moves the one
  // draft pin, matching Quick Call's "optional, low-friction" framing.
  const [isPlacementArmed, setIsPlacementArmed] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [draggingCallId, setDraggingCallId] = useState<string | null>(null);
  const [dragPreviewPercent, setDragPreviewPercent] = useState<PercentPoint | null>(null);
  const [draftPosition, setDraftPosition] = useState<CallPosition | null>(null);
  const [isDraftDragging, setIsDraftDragging] = useState(false);
  const [draftDragPreview, setDraftDragPreview] = useState<PercentPoint | null>(null);

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

  // Reset state when modal opens. This also re-seeds draft mode's pin from
  // draftPick.initial (reopening the picker to correct an already-set draft
  // pin should show it, not start blank) and, when that initial pin has a
  // layerId, jumps straight to that layer so the pin is visible immediately
  // rather than only after the dispatcher manually flips layers.
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsPanning(false);
      setIsPlacementArmed(false);
      setSelectedCallId(null);
      setDraggingCallId(null);
      setDragPreviewPercent(null);
      setIsDraftDragging(false);
      setDraftDragPreview(null);

      if (draftPick?.initial) {
        setDraftPosition(draftPick.initial);
        const idx = layers.findIndex((l) => l.id === draftPick.initial!.layerId);
        if (idx >= 0) setCurrentLayer(idx);
      } else {
        setDraftPosition(null);
      }
    }
    // draftPick is a fresh object identity from the caller on every render
    // (it closes over setQuickCall) -- only isOpen itself should re-run
    // this reset, or the effect would fire on every parent re-render while
    // the modal is open and stomp on state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Handle pan start. Gated off while call-pin placement is armed (or, in
  // draft-picker mode, always) so a click-to-place is structurally never
  // also a pan -- the same mode-exclusivity useZoomPan uses for the venue
  // editor's marker/georeference placement (see its `disablePan`), just
  // applied by hand here since this modal predates that hook and has its
  // own pan implementation. A drag that starts on a call marker never
  // reaches this handler at all: CallMarker's onMouseDown calls
  // stopPropagation before this listener would fire.
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPlacementArmed || isDraftMode) return;
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

  const currentLayerObj = layers[currentLayer];
  const currentLayerCalibrated = currentLayerObj ? isLayerCalibrated(currentLayerObj) : false;

  // A plain click on the map background (not on a marker -- CallMarker stops
  // its own click from bubbling here). Does nothing unless placement is
  // armed (or draft mode is active); an unarmed click is just... a click.
  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) return;
    const layer = currentLayerObj;
    if (!layer || !imgRef.current) return;

    const rectEl = imgRef.current.getBoundingClientRect();
    if (!isPointWithinRect(e.clientX, e.clientY, rectEl)) return;
    const percent = pixelToPercent(e.clientX, e.clientY, rectEl);

    if (isDraftMode) {
      const placement = placeCallPin(layer, percent, {
        source: 'manual',
        placedAt: Date.now(),
        placedBy: user?.uid,
      });
      // Refused silently on purpose: the uncalibrated-layer banner is
      // already on screen explaining why (see showPlacementUi below), so
      // there is nothing more useful to say per click.
      if (placement.ok) setDraftPosition(placement.position);
      return;
    }

    if (!isPlacementArmed || !selectedCallId || !updateEvent) return;

    const placement = placeCallPin(layer, percent, {
      source: 'manual',
      placedAt: Date.now(),
      placedBy: user?.uid,
    });
    if (!placement.ok) return;

    const callId = selectedCallId;
    const placedPosition = placement.position;
    await updateEvent((current: Event) => {
      const existing = current.calls.find((c) => c.id === callId);
      const logEntry = buildCallPinLogEntry(existing?.position ? 'moved' : 'placed', placedPosition.placedAt);
      return {
        calls: current.calls.map((c) =>
          c.id === callId ? { ...c, position: placedPosition, log: [...(c.log || []), logEntry] } : c
        ),
      };
    });
  };

  // Re-drag an already-placed call pin to correct it. Deliberately not
  // gated on isPlacementArmed -- dragging an existing pin is a direct
  // manipulation of that pin, independent of whether "click empty map to
  // place a NEW pin" mode happens to be on. Follows the venue editor's
  // onMarkerMouseDown pattern: window-level listeners (so the drag survives
  // leaving the marker/image bounds), live preview in local state only, and
  // exactly one Firestore write on mouseup -- see the write-rate note in
  // TAK_INTEGRATION_PLAN.md 6.2 on why per-mousemove writes are out.
  const handleCallMarkerMouseDown = (callId: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!updateEvent) return;
    const layer = currentLayerObj;
    if (!layer || !imgRef.current) return;

    setDraggingCallId(callId);

    const handleWindowMouseMove = (ev: MouseEvent) => {
      if (!imgRef.current) return;
      const rectEl = imgRef.current.getBoundingClientRect();
      setDragPreviewPercent(pixelToPercent(ev.clientX, ev.clientY, rectEl));
    };

    const handleWindowMouseUp = async (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      setDraggingCallId(null);
      setDragPreviewPercent(null);

      const rectEl = imgRef.current?.getBoundingClientRect();
      if (!rectEl) return;
      // Releasing outside the image abandons the drag, exactly as clicking
      // outside it places nothing (see handleMapClick). pixelToPercent happily
      // returns negative or >100 percentages off the edge, and committing one
      // would put the call somewhere the venue map cannot show it — drawn
      // floating over the modal chrome, since CallMarker has no off-map case
      // yet (that is Phase 7.E(1)). Leaving the pin where it was is the
      // recoverable outcome: the dispatcher can simply drag again.
      if (!isPointWithinRect(ev.clientX, ev.clientY, rectEl)) return;
      const percent = pixelToPercent(ev.clientX, ev.clientY, rectEl);

      const placement = placeCallPin(layer, percent, {
        source: 'manual',
        placedAt: Date.now(),
        placedBy: user?.uid,
      });
      // If the layer somehow lost its georeference mid-drag, leave the pin
      // where it was rather than silently discarding the correction.
      if (!placement.ok) return;

      const placedPosition = placement.position;
      await updateEvent((current: Event) => {
        const logEntry = buildCallPinLogEntry('moved', placedPosition.placedAt);
        return {
          calls: current.calls.map((c) =>
            c.id === callId ? { ...c, position: placedPosition, log: [...(c.log || []), logEntry] } : c
          ),
        };
      });
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  // Same drag pattern as handleCallMarkerMouseDown, but for the single
  // not-yet-committed draft pin: local state only, nothing is written
  // anywhere until the dispatcher presses "Use this pin".
  const handleDraftMarkerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const layer = currentLayerObj;
    if (!layer || !imgRef.current) return;

    setIsDraftDragging(true);

    const handleWindowMouseMove = (ev: MouseEvent) => {
      if (!imgRef.current) return;
      const rectEl = imgRef.current.getBoundingClientRect();
      setDraftDragPreview(pixelToPercent(ev.clientX, ev.clientY, rectEl));
    };

    const handleWindowMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      setIsDraftDragging(false);
      setDraftDragPreview(null);

      const rectEl = imgRef.current?.getBoundingClientRect();
      if (!rectEl) return;
      // Same bound as the committed-pin drag above: off the image, the drag is
      // abandoned and the draft pin stays put.
      if (!isPointWithinRect(ev.clientX, ev.clientY, rectEl)) return;
      const percent = pixelToPercent(ev.clientX, ev.clientY, rectEl);
      const placement = placeCallPin(layer, percent, {
        source: 'manual',
        placedAt: Date.now(),
        placedBy: user?.uid,
      });
      if (placement.ok) setDraftPosition(placement.position);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleClearSelectedCallPin = async () => {
    if (!selectedCallId || !updateEvent) return;
    const callId = selectedCallId;
    await updateEvent((current: Event) => {
      // Only log if there was actually a pin to remove, so a stray click on
      // the clear button does not write a "removed" entry for a call that
      // never had a position.
      const existing = current.calls.find((c) => c.id === callId);
      if (!existing?.position) return {};
      const logEntry = buildCallPinLogEntry('cleared', Date.now());
      return {
        calls: current.calls.map((c) =>
          // position: undefined is the right shape here — removeUndefinedDeep
          // strips the key on the way out and updateEvent replaces the whole
          // calls array, so the field is genuinely gone rather than written
          // as a null.
          c.id === callId ? { ...c, position: undefined, log: [...(c.log || []), logEntry] } : c
        ),
      };
    });
  };

  const handleConfirmDraftPin = () => {
    if (!draftPosition || !draftPick) return;
    draftPick.onPick(draftPosition);
    onClose();
  };

  // Resolved, draw-ready call pins for the current layer. Always re-derived
  // from each call's lat/lon (see resolveCallPinPercent's doc comment)
  // rather than trusting stamped x/y, so pins redraw correctly the instant a
  // layer is recalibrated with no separate migration step. The call actively
  // being dragged instead shows its live drag preview.
  const callPins: ResolvedCallPin[] = [];
  if (!isDraftMode && currentLayerObj) {
    for (const c of calls) {
      if (!c.position) continue;
      const percent =
        draggingCallId === c.id && dragPreviewPercent
          ? dragPreviewPercent
          : resolveCallPinPercent(currentLayerObj, c.position);
      if (!percent) continue;
      callPins.push({ call: c, percent, isStale: callPinStaleness(currentLayerObj, c.position) === 'stale' });
    }
  }

  const draftDisplayPercent = isDraftMode
    ? isDraftDragging && draftDragPreview
      ? draftDragPreview
      : draftPosition && currentLayerObj
        ? resolveCallPinPercent(currentLayerObj, draftPosition)
        : null
    : null;
  const draftPin = draftDisplayPercent ? { percent: draftDisplayPercent, isDragging: isDraftDragging } : null;

  // Whether to show either "click to place" (calibrated) or the refusal
  // banner (uncalibrated) over the map right now.
  const showPlacementUi = isDraftMode || isPlacementArmed;
  const venueEditHref = venueId ? `/venues/management?venueId=${venueId}` : undefined;

  const selectedCall = selectedCallId ? calls.find((c) => c.id === selectedCallId) : undefined;

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
                callPins={callPins}
                draggingCallId={draggingCallId}
                onCallMarkerMouseDown={updateEvent ? handleCallMarkerMouseDown : undefined}
                draftPin={draftPin}
                onDraftMarkerMouseDown={isDraftMode ? handleDraftMarkerMouseDown : undefined}
                isPlacementArmed={showPlacementUi}
                onMapClick={handleMapClick}
              />

              {showPlacementUi && (
                currentLayerCalibrated ? (
                  <MarkerPlacementInstruction />
                ) : (
                  <UncalibratedLayerNotice venueEditHref={venueEditHref} />
                )
              )}

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
              {isDraftMode ? (
                // Draft-picker mode: no call selector (there's exactly one
                // pin, the draft), just confirm/cancel/clear. Nothing here
                // touches Firestore -- see handleConfirmDraftPin.
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-default-200/50 flex-wrap">
                  <span className="text-xs text-surface-faint">
                    {draftPosition
                      ? 'Drag the pin to adjust, or click elsewhere to move it.'
                      : 'Click the map to drop a pin for this call.'}
                  </span>
                  <div className="flex items-center gap-2">
                    {draftPosition && (
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => setDraftPosition(null)}
                        startContent={<X className="h-3.5 w-3.5" />}
                        className="text-surface-light"
                      >
                        Clear
                      </Button>
                    )}
                    <Button size="sm" variant="light" onPress={onClose} className="text-surface-light">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      className="bg-accent hover:bg-accent/90"
                      isDisabled={!draftPosition}
                      onPress={handleConfirmDraftPin}
                    >
                      Use this pin
                    </Button>
                  </div>
                </div>
              ) : (
                updateEvent && calls.length > 0 && (
                  // Normal dispatch mode: pick which call the next placement
                  // click (or the toggle below) applies to. Selecting a call
                  // does not, by itself, do anything -- placement mode must
                  // also be armed, exactly mirroring the venue editor's
                  // "pick a mode, then click" two-step.
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-default-200/50 flex-wrap">
                    <Select
                      size="sm"
                      label="Call"
                      placeholder="Select a call to pin"
                      selectedKeys={selectedCallId ? [selectedCallId] : []}
                      onSelectionChange={(keys) => {
                        const key = Array.from(keys as Set<string>)[0];
                        setSelectedCallId(key ?? null);
                      }}
                      className="max-w-[240px]"
                      aria-label="Select a call to place a pin for"
                    >
                      {calls.map((c) => (
                        <SelectItem
                          key={c.id}
                          textValue={`Call #${c.order} - ${c.location || 'Unknown'}`}
                        >
                          {`#${c.order} - ${c.location || 'Unknown'}${c.position ? ' (pinned)' : ''}`}
                        </SelectItem>
                      ))}
                    </Select>
                    <MarkerModeToggleButton
                      isAddMarkerMode={isPlacementArmed}
                      onToggle={() => setIsPlacementArmed((v) => !v)}
                    />
                    {selectedCall?.position && (
                      <Button
                        size="sm"
                        variant="light"
                        onPress={handleClearSelectedCallPin}
                        startContent={<X className="h-3.5 w-3.5" />}
                        className="text-surface-light"
                      >
                        Clear pin
                      </Button>
                    )}
                  </div>
                )
              )}
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