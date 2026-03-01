'use client';
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Modal, ModalContent, ModalBody, Button, Card, Tooltip } from '@heroui/react';
import { ZoomIn, ZoomOut, RotateCcw, MapPin, Cross, ShieldPlus, Briefcase, HousePlus } from 'lucide-react';
import { Post, Staff, Equipment, Layer } from '@/app/types';

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
}

function PostMarker({ post, rect }: PostMarkerProps) {
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
        transform: "translate(-50%, -50%)",
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
          <div className="rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap">
            {post.name}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function getEquipmentMarkerColors(equipment: Equipment) {
  let color = '#8B5CF6'; // Purple for default
  const outline = '2px solid white';

  switch (equipment.status) {
    case 'Available':
      color = '#10B981'; // Green
      break;
    case 'En Route to Call':
      color = '#F59E0B'; // Amber
      break;
    case 'Transporting Patient':
      color = '#EF4444'; // Red
      break;
    case 'Out of Service':
      color = '#6B7280'; // Gray
      break;
  }

  return { color, outline };
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
      <img 
        src="/map/wheelchair.svg" 
        alt="Wheelchair" 
        className={className}
        style={{ width: '100%', height: '100%' }}
        draggable={false}
      />
    );
  }
  if (type === 'stretcher') {
    return (
      <img 
        src="/map/gurney.svg" 
        alt="Gurney" 
        className={className}
        style={{ width: '100%', height: '100%' }}
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
}

function EquipmentMarker({
  equipment,
  post,
  rect,
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
        transform: 'translate(-50%, -50%)',
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
        <EquipmentIcon type={iconType} className="h-4 w-4 text-white" />
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
          <div className="rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap">
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
}

function TeamMarker({
  team,
  post,
  rect,
  teamTimers,
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
        transform: 'translate(-50%, -50%)',
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
        <ShieldPlus className="h-6 w-6 text-white" strokeWidth={2.5} />
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
          <div className="rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-white shadow-lg whitespace-nowrap">
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
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  imgRef: React.RefObject<HTMLImageElement | null>;
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
  onWheel,
  imgRef,
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
        className="relative overflow-hidden h-full w-full rounded-2xl"
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

  // Zoom handlers
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle wheel (prevent default scrolling)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    const img = imgRef.current;
    const container = imgContainerRef.current;
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

    const maxX = Math.max(0, (imgWidth - containerRect.width) / scale);
    const maxY = Math.max(0, (imgHeight - containerRect.height) / scale);

    setPosition({
      x: Math.min(0, Math.max(-maxX, newX)),
      y: Math.min(0, Math.max(-maxY, newY)),
    });
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
                onWheel={handleWheel}
                imgRef={imgRef}
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
                  <span className="text-sm text-white font-medium">
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
                      className="text-white"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-white">
                      {layers[currentLayer]?.name || `Layer ${currentLayer + 1}`}
                    </span>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setCurrentLayer(prev => Math.min(layers.length - 1, prev + 1))}
                      isDisabled={currentLayer === layers.length - 1}
                      className="text-white"
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
      `}</style>
    </Modal>
  );
}