// app/venues/management/page.client.tsx

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useauth';
import { dbService, storageService } from '@/lib/services';
import type { Post, Venue, Equipment, EquipmentStatus, Layer } from '@/app/types';
import { isPointWithinRect, pixelToPercent } from '@/lib/markerUtils';
import { hasDuplicateClinicName, isClinicPost } from '@/lib/clinics';
import { stripUndefined } from '@/lib/utils';
import { uploadWithRetry } from '@/lib/uploadUtils';
import { useZoomPan } from '@/hooks/useZoomPan';
import { MAP_CHECKER_BG } from '@/lib/mapStyles';
import NewLayerModal from '@/components/modals/venue/newlayer';
import LocationEditModal from '@/components/modals/venue/locationedit';
import EquipmentManagementSection from '@/components/venue-management/EquipmentManagementSection';
import LayerControlBar from '@/components/venue-management/LayerControlBar';
import MarkerModeToggleButton from '@/components/venue-management/MarkerModeToggleButton';
import PendingMarkerDialog from '@/components/venue-management/PendingMarkerDialog';
import MarkerPlacementInstruction from '@/components/venue-management/MarkerPlacementInstruction';
import MapZoomControls from '@/components/ui/map-zoom-controls';
import MapPanSurface from '@/components/ui/map-pan-surface';
import { VenueMapWithPosts } from '@/components/modals/event/venuemapmodal';
import { WizardShell, StepProgress, type WizardStep } from '@/components/wizard';
import {
  Button,
  Input,
  Card,
  ScrollShadow,
} from '@heroui/react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Upload,
  Trash2,
  Edit2,
  MapPinned,
  HousePlus,
} from 'lucide-react';


// Props: none required for this page

interface EquipmentWithLocation extends Equipment {
  locationId?: string;
}

export default function VenueManagementPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const venueId = searchParams.get('venueId');
  // Firebase
  const { user } = useAuth();
  const userId = user?.uid;


  // Local state
  const [venueData, setVenueData] = useState<{
    name: string;
    equipment: EquipmentWithLocation[];
    layers: Layer[];
  }>({
    name: '',
    equipment: [],
    layers: [{ id: crypto.randomUUID(), name: 'Floor 1', posts: [], mapUrl: undefined }],
  });

  const [currentLayer, setCurrentLayer] = useState(0);

  const [isUploading, setIsUploading] = useState(false);

  // Marker placement mode
  const [isAddMarkerMode, setIsAddMarkerMode] = useState(false);

  // Active marker being named
  const [pendingMarker, setPendingMarker] = useState<{
    x: number;
    y: number;
    layerIdx: number;
    postIdx: number;
  } | null>(null);
  const [markerNameInput, setMarkerNameInput] = useState('');
  const [markerIsClinicInput, setMarkerIsClinicInput] = useState(false);

  // Inputs
  const [equipmentInput, setEquipmentInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  // File upload (optional map)
  const [mapFile, setMapFile] = useState<File | null>(null);

  // Image preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Refs for image geometry
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgContainerRef = useRef<HTMLDivElement | null>(null);
  const markerInputRef = useRef<HTMLInputElement | null>(null);

  // Hidden file input for map upload/replace
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    scale,
    position,
    isPanning,
    setScale,
    setPosition,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useZoomPan({
    minScale: 1,
    maxScale: 5,
    disablePan: () => isAddMarkerMode || draggingIdx !== null,
  });

  // Separate pan/zoom state for the read-only map panel shown on the
  // Equipment and Review steps (mirrors the event creation page's own map
  // panel exactly, including its "simple unclamped pan" behavior) — kept
  // independent of the interactive editing map's own zoom/pan above so
  // switching steps never carries marker-placement mode or drag state into
  // a plain reference view.
  const readOnlyImgRef = useRef<HTMLImageElement | null>(null);
  const [readOnlyScale, setReadOnlyScale] = useState(1);
  const [readOnlyPosition, setReadOnlyPosition] = useState({ x: 0, y: 0 });
  const [readOnlyIsPanning, setReadOnlyIsPanning] = useState(false);
  const [readOnlyPanStart, setReadOnlyPanStart] = useState({ x: 0, y: 0 });
  const handleReadOnlyZoomIn = () => setReadOnlyScale((prev) => Math.min(prev + 0.25, 3));
  const handleReadOnlyZoomOut = () => setReadOnlyScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleReadOnlyResetZoom = () => {
    setReadOnlyScale(1);
    setReadOnlyPosition({ x: 0, y: 0 });
  };
  const handleReadOnlyWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleReadOnlyMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setReadOnlyIsPanning(true);
    setReadOnlyPanStart({ x: e.clientX - readOnlyPosition.x, y: e.clientY - readOnlyPosition.y });
  };
  const handleReadOnlyMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!readOnlyIsPanning) return;
    setReadOnlyPosition({ x: e.clientX - readOnlyPanStart.x, y: e.clientY - readOnlyPanStart.y });
  };
  const handleReadOnlyMouseUp = () => setReadOnlyIsPanning(false);

  // Drag/hover
  const [pendingLayer, setPendingLayer] = useState<number | null>(null);

  // Drag/hover
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  // Image aspect ratio
  const [, setAspectRatio] = useState(1);

  // New layer modal
  const [isNewLayerModalOpen, setIsNewLayerModalOpen] = useState(false);

  // Location edit modal
  const [isLocationEditModalOpen, setIsLocationEditModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<{ layerIdx: number; postIdx: number } | null>(null);

  // Equipment editing state
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [equipmentEditInput, setEquipmentEditInput] = useState('');

  const STEP_ORDER = ['basics', 'map', 'locations', 'equipment', 'review'] as const;
  const [currentStepId, setCurrentStepId] = useState<string>('basics');


  // Update preview when a new map file is selected
  useEffect(() => {
    if (mapFile && pendingLayer === currentLayer) {
      const url = URL.createObjectURL(mapFile);
      setPreviewUrl(url);
      // Reset zoom/pan when new image loads
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(venueData.layers[currentLayer]?.mapUrl || null);
    }
  }, [mapFile, pendingLayer, currentLayer, venueData.layers, setPosition, setScale]);

  // Auto-focus marker name input when pending marker is set
  useEffect(() => {
    if (pendingMarker && markerInputRef.current) {
      markerInputRef.current.focus();
    }
  }, [pendingMarker]);

  // Load venue data if editing
  useEffect(() => {
    if (venueId && userId) {
      const loadVenue = async () => {
        try {
          const venueDoc = await dbService.getDocument<Venue & { layers?: Layer[] }>('venues', venueId);
          if (venueDoc.exists && venueDoc.data) {
            const venue = venueDoc.data;
            let layers: Layer[];
            if (venue.layers && venue.layers.length > 0) {
              layers = venue.layers;
            } else {
              // Backward compatibility: create single layer from old format
              layers = [{
                id: crypto.randomUUID(),
                name: 'Main',
                posts: venue.posts || [],
                mapUrl: venue.mapUrl,
              }];
            }
            setVenueData({
              name: venue.name,
              equipment: venue.equipment || [],
              layers,
            });
            setCurrentLayer(0);
          }
        } catch (error) {
          console.error('Error loading venue:', error);
          alert('Failed to load venue data');
        }
      };
      loadVenue();
    }
  }, [venueId, userId]);

  // File name from mapFile or mapUrl
  const mapFileName = useMemo(() => {
    if (mapFile?.name && pendingLayer === currentLayer) return mapFile.name;
    const currentMapUrl = venueData.layers[currentLayer]?.mapUrl;
    if (currentMapUrl) {
      try {
        const u = new URL(currentMapUrl);
        const filename = u.pathname.split('/').pop() || '';
        const parts = filename.split('_');
        if (parts.length > 1) {
          return decodeURIComponent(parts.slice(1).join('_'));
        } else {
          return decodeURIComponent(filename);
        }
      } catch {
        const s = currentMapUrl.split('?')[0];
        const filename = s.substring(s.lastIndexOf('/') + 1);
        const parts = filename.split('_');
        if (parts.length > 1) {
          return decodeURIComponent(parts.slice(1).join('_'));
        } else {
          return decodeURIComponent(filename);
        }
      }
    }
    return '';
  }, [mapFile, pendingLayer, currentLayer, venueData.layers]);

  // Controlled input change
  const handleChange = (value: string) => {
    setVenueData((prev) => ({ ...prev, name: value }));
  };

  // All posts from all layers
  const allPosts = venueData.layers.flatMap((layer, layerIdx) =>
    layer.posts.map((post, postIdx) => ({ post, layerIdx, postIdx, layerName: layer.name }))
  );

  // Location names offered as an equipment item's default location — the
  // same location the event builder pre-fills from when that item is added
  // to an event, and can still be adjusted from there.
  const locationOptions = Array.from(
    new Set(allPosts.map((item) => (typeof item.post === 'string' ? item.post : item.post.name)).filter(Boolean))
  );

  // Equipment
  const addEquipment = () => {
    const name = equipmentInput.trim();
    if (!name) return;
    const newItem: EquipmentWithLocation = {
      id: crypto.randomUUID(),
      name,
      status: 'Available' as EquipmentStatus,
    };
    setVenueData((prev) => ({ ...prev, equipment: [...prev.equipment, newItem] }));
    setEquipmentInput('');
  };

  const removeEquipment = (index: number) => {
    setVenueData((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index),
    }));
  };

  const startEditEquipment = (index: number) => {
    setEditingEquipmentIndex(index);
    setEquipmentEditInput(venueData.equipment[index].name);
  };

  const saveEquipmentEdit = () => {
    if (editingEquipmentIndex === null) return;
    const newName = equipmentEditInput.trim();
    if (!newName) return;
    setVenueData((prev) => {
      const updated = [...prev.equipment];
      updated[editingEquipmentIndex] = { ...updated[editingEquipmentIndex], name: newName };
      return { ...prev, equipment: updated };
    });
    setEditingEquipmentIndex(null);
    setEquipmentEditInput('');
  };

  const cancelEquipmentEdit = () => {
    setEditingEquipmentIndex(null);
    setEquipmentEditInput('');
  };

  const setEquipmentLocation = (index: number, location: string | undefined) => {
    setVenueData((prev) => {
      const updated = [...prev.equipment];
      updated[index] = { ...updated[index], location };
      return { ...prev, equipment: updated };
    });
  };

  // Add location without map
  const addTextLocation = () => {
    const val = locationInput.trim();
    if (!val) return;
    const newPost: Post = {
      name: val,
      x: null,
      y: null,
    };
    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      newLayers[currentLayer] = {
        ...newLayers[currentLayer],
        posts: [...newLayers[currentLayer].posts, newPost],
      };
      return { ...prev, layers: newLayers };
    });
    setLocationInput('');
  };

  // Handle map click for marker placement
  const handleImageClick = (evt: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddMarkerMode || isPanning) return;

    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();

    if (!isPointWithinRect(evt.clientX, evt.clientY, rect)) {
      return;
    }

    const { x, y } = pixelToPercent(evt.clientX, evt.clientY, rect);

    // Create temporary marker
    const newPost: Post = {
      name: '',
      x,
      y,
    };

    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      newLayers[currentLayer] = {
        ...newLayers[currentLayer],
        posts: [...newLayers[currentLayer].posts, newPost],
      };
      return { ...prev, layers: newLayers };
    });
    setPendingMarker({ x, y, layerIdx: currentLayer, postIdx: venueData.layers[currentLayer].posts.length });
    setMarkerNameInput('');
    setMarkerIsClinicInput(false);
  };

  // Confirm marker name
  const confirmMarkerName = () => {
    if (!pendingMarker) return;

    const name = markerNameInput.trim();
    if (!name) {
      // Remove the marker if no name provided
      removePost(pendingMarker.layerIdx, pendingMarker.postIdx);
      setPendingMarker(null);
      setMarkerNameInput('');
      setMarkerIsClinicInput(false);
      return;
    }

    if (markerIsClinicInput && hasDuplicateClinicName(name, allPosts, { layerIdx: pendingMarker.layerIdx, postIdx: pendingMarker.postIdx })) {
      alert('Another clinic already uses this name. Give each clinic a unique name.');
      return;
    }

    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      const copy = [...newLayers[pendingMarker.layerIdx].posts];
      const currentPost = copy[pendingMarker.postIdx];
      if (typeof currentPost !== 'string') {
        const clinicId = markerIsClinicInput ? (currentPost.clinicId || crypto.randomUUID()) : currentPost.clinicId;
        copy[pendingMarker.postIdx] = {
          ...currentPost,
          name,
          isClinic: markerIsClinicInput,
          ...(clinicId ? { clinicId } : {}),
        };
      }
      newLayers[pendingMarker.layerIdx] = { ...newLayers[pendingMarker.layerIdx], posts: copy };
      return { ...prev, layers: newLayers };
    });

    setPendingMarker(null);
    setMarkerNameInput('');
    setMarkerIsClinicInput(false);
  };

  // Cancel marker placement
  const cancelMarkerName = () => {
    if (pendingMarker) {
      removePost(pendingMarker.layerIdx, pendingMarker.postIdx);
    }
    setPendingMarker(null);
    setMarkerNameInput('');
    setMarkerIsClinicInput(false);
  };

  const removePost = (layerIdx: number, postIdx: number) => {
    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      newLayers[layerIdx] = {
        ...newLayers[layerIdx],
        posts: newLayers[layerIdx].posts.filter((_, i) => i !== postIdx),
      };
      return { ...prev, layers: newLayers };
    });
  };

  const renamePost = (layerIdx: number, postIdx: number) => {
    setEditingLocation({ layerIdx, postIdx });
    setIsLocationEditModalOpen(true);
  };

  const handleEditLocation = (name: string, newLayerIdx: number, isClinic: boolean) => {
    if (!editingLocation) return;
    const { layerIdx, postIdx } = editingLocation;

    if (isClinic && hasDuplicateClinicName(name, allPosts, { layerIdx, postIdx })) {
      alert('Another clinic already uses this name. Give each clinic a unique name.');
      return;
    }

    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      const post = newLayers[layerIdx].posts[postIdx];
      if (typeof post === 'string') return prev;
      const clinicId = isClinic ? (post.clinicId || crypto.randomUUID()) : post.clinicId;
      const clinicIdField = clinicId ? { clinicId } : {};
      if (newLayerIdx !== layerIdx) {
        // Move to new layer
        const newPost = { ...post, name, isClinic, ...clinicIdField };
        newLayers[layerIdx].posts.splice(postIdx, 1);
        newLayers[newLayerIdx].posts.push(newPost);
      } else {
        // Same layer, just rename
        newLayers[layerIdx].posts[postIdx] = { ...post, name, isClinic, ...clinicIdField };
      }
      return { ...prev, layers: newLayers };
    });
    setEditingLocation(null);
  };

  const updateLayerName = (name: string) => {
    setVenueData(prev => {
      const newLayers = [...prev.layers];
      newLayers[currentLayer] = { ...newLayers[currentLayer], name };
      return { ...prev, layers: newLayers };
    });
  };

  // Drag markers
  const onMarkerMouseDown =
    (idx: number) => (evt: React.MouseEvent<HTMLDivElement>) => {
      if (pendingMarker) return;

      evt.preventDefault();
      evt.stopPropagation();
      setDraggingIdx(idx);

      const img = imgRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();

      const onMove = (e: MouseEvent) => {
        const { x, y } = pixelToPercent(e.clientX, e.clientY, rect);

        setVenueData((prev) => {
          const newLayers = [...prev.layers];
          const copy = [...newLayers[currentLayer].posts];
          const cur = copy[idx];
          if (typeof cur === 'string') return prev;
          copy[idx] = { ...cur, x, y };
          newLayers[currentLayer] = { ...newLayers[currentLayer], posts: copy };
          return { ...prev, layers: newLayers };
        });
      };

      const onUp = () => {
        setDraggingIdx(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

  const renderMarkers = () => {
    type CoordinatedPost = {
      name: string;
      x: number;
      y: number;
      isClinic?: boolean;
    };

    return venueData.layers[currentLayer].posts
      .filter((post): post is CoordinatedPost =>
        typeof post === 'object' &&
        post !== null &&
        'name' in post &&
        typeof post.x === 'number' &&
        typeof post.y === 'number' &&
        post.x !== null &&
        post.y !== null
      )
      .map((post, idx) => {
        const left = `calc(${post.x}% - 12px)`;
        const top = `calc(${post.y}% - 12px)`;
        const isHover = hoverId === idx;
        const isPending = pendingMarker?.layerIdx === currentLayer && pendingMarker?.postIdx === idx;

        return (
          <React.Fragment key={idx}>
            <div
              style={{ left, top }}
              className={`absolute z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded-full border-2 transition-all ${
                isPending
                  ? 'border-status-blue bg-status-blue/20 scale-125'
                  : isHover || draggingIdx === idx
                  ? 'border-accent bg-accent/30 scale-110'
                  : 'border-accent bg-accent/20 hover:scale-110'
              } ${draggingIdx === idx ? 'cursor-grabbing scale-110' : ''}`}
              onMouseEnter={() => setHoverId(idx)}
              onMouseLeave={() => setHoverId((cur) => (cur === idx ? null : cur))}
              onMouseDown={onMarkerMouseDown(idx)}
              onClick={(e) => {
                if (isPending) return;
                e.preventDefault();
                e.stopPropagation();
                renamePost(currentLayer, idx);
              }}
            >
              {post.isClinic ? (
                <HousePlus className="h-4 w-4 text-accent" strokeWidth={2.5} />
              ) : (
                <MapPin className="h-4 w-4 text-accent" strokeWidth={2.5} />
              )}
            </div>
            {isHover && !isPending && post.name && (
              <div
                style={{ left: `calc(${post.x}% - 50px)`, top: `calc(${post.y}% - 40px)` }}
                className="pointer-events-none absolute z-20 rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg border border-default whitespace-nowrap"
              >
                {post.name}
              </div>
            )}
          </React.Fragment>
        );
      });
  };

  // Create venue
  const handleSubmit = async (e?: React.FormEvent, options?: { createEvent?: boolean }) => {
    e?.preventDefault();

    if (!userId) {
      alert('You must be logged in to save the venue');
      return;
    }

    if (!venueData.name.trim()) {
      alert('Please enter a venue name');
      return;
    }

    if (pendingMarker) {
      alert('Please finish naming the marker or cancel it before saving');
      return;
    }

    setIsUploading(true);
    try {
      let newMapUrl: string | undefined;

      if (mapFile && mapFile.size > 0) {
        newMapUrl = await storageService.uploadFile(`venue_maps/${Date.now()}_${mapFile.name}`, mapFile);
      }

      const equipmentToSave = venueData.equipment.map(({ ...rest }) => rest);

      // Update current layer's mapUrl if new map uploaded
      const updatedLayers = venueData.layers.map((layer, idx) => {
        const layerData = idx === (pendingLayer ?? currentLayer) && newMapUrl ? { ...layer, mapUrl: newMapUrl } : layer;
        // Remove undefined properties from each layer
        const filteredLayer: Record<string, unknown> = {};
        Object.entries(layerData).forEach(([key, value]) => {
          if (value !== undefined) {
            filteredLayer[key] = value;
          }
        });
        return filteredLayer;
      });

      const dataToSave: Record<string, unknown> = {
        name: venueData.name.trim(),
        equipment: equipmentToSave,
        layers: updatedLayers,
        posts: allPosts.map(item => item.post),
        userId,
      };

      // Only add mapUrl if it exists
      if (venueData.layers?.[0]?.mapUrl) {
        dataToSave.mapUrl = venueData.layers[0].mapUrl;
      }

      const sanitizedDataToSave = stripUndefined(dataToSave);

      let savedVenueId: string;
      if (venueId) {
        await dbService.updateDocument('venues', venueId, sanitizedDataToSave);
        savedVenueId = venueId;
      } else {
        savedVenueId = await dbService.addDocument('venues', sanitizedDataToSave);
      }

      if (options?.createEvent) {
        const savedVenue = { id: savedVenueId, ...sanitizedDataToSave } as Venue;
        const newEvent = {
          name: '',
          date: new Date(),
          venue: savedVenue,
          postingTimes: [],
          staff: [],
          supervisor: [],
          userId,
          calls: [],
          eventPosts: [],
          eventEquipment: [],
          status: 'draft',
          createdAt: new Date().toISOString(),
        };
        const newEventId = await dbService.addDocument('events', stripUndefined(newEvent));
        router.push(`/events/${newEventId}/create`);
      } else {
        router.push('/venues/selection');
      }
    } catch (error: unknown) {
      console.error('Error saving venue:', error);
      const message =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Unknown error';
      alert(
        message.includes('storage/unauthorized')
          ? 'Save failed: Check storage permissions'
          : `Save failed: ${message}`
      );
    } finally {
      setIsUploading(false);
      setMapFile(null);
      setPendingLayer(null);
    }
  };

  // Handle adding new layer
  const handleAddLayer = async (name: string, file: File) => {
    setIsUploading(true);
    try {
      const mapUrl = await storageService.uploadFile(`venue_maps/${Date.now()}_${file.name}`, file);
      const newLayer: Layer = {
        id: crypto.randomUUID(),
        name,
        mapUrl,
        posts: [],
      };
      const newLayers = [...venueData.layers, newLayer];
      setVenueData(prev => ({
        ...prev,
        layers: newLayers,
      }));
      setCurrentLayer(newLayers.length - 1);
    } catch (error) {
      console.error('Error adding layer:', error);
      alert('Failed to add layer');
    } finally {
      setIsUploading(false);
    }
    setIsNewLayerModalOpen(false);
  };

  // Handle deleting layer
  const deleteLayer = () => {
    if (venueData.layers.length <= 1) {
      alert('Cannot delete the last layer');
      return;
    }
    const confirmDelete = window.confirm('Are you sure you want to delete this layer?');
    if (!confirmDelete) return;
    setVenueData(prev => {
      const newLayers = prev.layers.filter((_, i) => i !== currentLayer);
      return { ...prev, layers: newLayers };
    });
    setCurrentLayer(Math.max(0, currentLayer - 1));
  };

  const hasMapForStep = Boolean(previewUrl);
  // A just-uploaded map isn't in venueData.layers yet — it only becomes a
  // real mapUrl there once the venue is saved (handleSubmit uploads it and
  // patches this layer in). The interactive map already shows it via
  // previewUrl (a local object URL); the read-only panel reads mapUrl
  // straight off the layers array, so without this override it would show
  // nothing for the current layer until the venue is actually saved.
  const layersForMapDisplay = previewUrl
    ? venueData.layers.map((layer, idx) => (idx === currentLayer ? { ...layer, mapUrl: previewUrl } : layer))
    : venueData.layers;
  // The Map step always renders full-width (header + its own interactive
  // map), never the half-split every other map-showing step uses.
  const showMapPanel = currentStepId !== 'basics' && currentStepId !== 'map';
  const showMapColumn = showMapPanel && hasMapForStep;
  // The interactive editor (place/drag markers) only applies to Locations
  // (placing a location directly on the map); Equipment and Review just
  // need a plain reference view, matching event creation's read-only map
  // panel exactly. The Map step renders its own dedicated interactive map
  // below, outside this left/right split entirely.
  const isInteractiveMapStep = currentStepId === 'locations';

  // The map/floor-controls header for the Map step: floor name top-left,
  // Add Markers top-right.
  const mapStepHeader = (
    <div className="mb-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-surface-light">
          Venue Map
        </label>
        <Input
          value={venueData.layers[currentLayer].name}
          onValueChange={updateLayerName}
          variant="flat"
          size="md"
          classNames={{
            input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
            inputWrapper: 'rounded-large px-4 pr-6 hover:bg-surface-deep',
          }}
          placeholder="Layer name"
        />
      </div>
      {previewUrl && (
        <div className="flex gap-2">
          <MarkerModeToggleButton
            isAddMarkerMode={isAddMarkerMode}
            onToggle={() => setIsAddMarkerMode(!isAddMarkerMode)}
          />
        </div>
      )}
    </div>
  );

  // Upload prompt shown full-width whenever the current step would show a
  // map but none exists yet for this layer.
  const mapUploadPrompt = (
    <div className="rounded-sm relative flex flex-col items-center justify-start w-full h-full">
      <Card className="rounded-sm bg-default/40 w-full h-full px-3 py-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-full w-full flex-col items-center justify-center gap-3 text-surface-light/70 transition hover:text-status-blue rounded-sm"
        >
          <Upload className="h-12 w-12" />
          <div className="text-center">
            <p className="text-sm font-medium">Upload Venue Map</p>
            <p className="mt-1 text-xs text-surface-light/50">
              Optional - Click to select an image
            </p>
          </div>
        </button>
      </Card>
    </div>
  );

  // Interactive map panel (place/drag markers) for the Map and Locations
  // steps — same checkerboard/sharp-corner/merged-bar treatment as the
  // read-only panel below, so both read as the same surface.
  const interactiveMapPanel = (
    <div className="flex flex-col h-full">
      <div className="relative w-full flex-1 min-h-0 overflow-hidden rounded-t-sm" style={MAP_CHECKER_BG}>
        <MapPanSurface
          containerRef={imgContainerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            cursor: isAddMarkerMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
            height: '100%',
          }}
        >
          <div
            className="relative inline-block"
            onClick={handleImageClick}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transformOrigin: 'left top',
              transition: isPanning ? 'none' : 'transform 0.1s',
            }}
          >
            <Image
              ref={(node) => {
                if (node) {
                  const img = node as unknown as HTMLImageElement;
                  imgRef.current = img;
                }
              }}
              src={previewUrl || ''}
              alt="Venue map"
              width={1200}
              height={900}
              className="block"
              style={{
                display: 'block',
                width: 'auto',
                height: 'auto',
                maxWidth: '100%'
              }}
              unoptimized
              onLoad={(e) => {
                const ratio = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
                setAspectRatio(ratio);
              }}
            />
            <div className="absolute inset-0 pointer-events-none">
              <div className="relative w-full h-full pointer-events-auto">
                {renderMarkers()}
              </div>
            </div>
          </div>
        </MapPanSurface>

        {pendingMarker && (
          <PendingMarkerDialog
            markerNameInput={markerNameInput}
            markerInputRef={markerInputRef}
            setMarkerNameInput={setMarkerNameInput}
            markerIsClinicInput={markerIsClinicInput}
            setMarkerIsClinicInput={setMarkerIsClinicInput}
            onConfirm={confirmMarkerName}
            onCancel={cancelMarkerName}
          />
        )}

        {/* Zoom Controls - Top Right */}
        <MapZoomControls
          onZoomIn={() => zoomIn(0.5)}
          onZoomOut={() => zoomOut(0.5)}
          onReset={resetZoom}
          buttonClassName="bg-surface-deepest/95"
          resetButtonClassName="bg-surface-deepest/95 text-xs px-2"
        />

        {/* Instructions overlay - Top Left */}
        {isAddMarkerMode && !pendingMarker && <MarkerPlacementInstruction />}
      </div>

      <LayerControlBar
        mapFileName={mapFileName}
        onReplaceMap={() => fileInputRef.current?.click()}
        currentLayer={currentLayer}
        totalLayers={venueData.layers.length}
        currentLayerName={venueData.layers?.[currentLayer]?.name || 'Layer'}
        onPreviousLayer={() => setCurrentLayer(currentLayer - 1)}
        onNextLayer={() => setCurrentLayer(currentLayer + 1)}
        onDeleteLayer={deleteLayer}
        onAddLayer={() => setIsNewLayerModalOpen(true)}
      />
    </div>
  );

  // Read-only map panel for the Equipment and Review steps — same
  // VenueMapWithPosts rendering (proper post/equipment icons) and pan/zoom
  // behavior as the event creation page's own map panel.
  const readOnlyMapPanel = (
    <div className="flex flex-col h-full">
      <div className="relative w-full flex-1 min-h-0 overflow-hidden rounded-t-sm" style={MAP_CHECKER_BG}>
        <VenueMapWithPosts
          layers={layersForMapDisplay}
          currentLayer={currentLayer}
          staff={[]}
          equipment={venueData.equipment}
          teamTimers={{}}
          scale={readOnlyScale}
          position={readOnlyPosition}
          isPanning={readOnlyIsPanning}
          onMouseDown={handleReadOnlyMouseDown}
          onMouseMove={handleReadOnlyMouseMove}
          onMouseUp={handleReadOnlyMouseUp}
          onWheel={handleReadOnlyWheel}
          imgRef={readOnlyImgRef}
          imageRadiusClassName="rounded-none"
        />
        <MapZoomControls
          onZoomIn={handleReadOnlyZoomIn}
          onZoomOut={handleReadOnlyZoomOut}
          onReset={handleReadOnlyResetZoom}
          buttonClassName="bg-surface-deepest/90 backdrop-blur"
          resetButtonClassName="bg-surface-deepest/90 backdrop-blur"
        />
      </div>

      <Card radius="none" className="rounded-b-sm bg-default/40 w-full px-3 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-surface-light">
            {venueData.layers?.[currentLayer]?.name || 'Main Floor'}
          </span>
          {venueData.layers.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                size="sm"
                radius="full"
                variant="flat"
                onPress={() => setCurrentLayer((prev) => Math.max(0, prev - 1))}
                isDisabled={currentLayer === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-surface-light">
                {currentLayer + 1} / {venueData.layers.length}
              </span>
              <Button
                isIconOnly
                size="sm"
                radius="full"
                variant="flat"
                onPress={() => setCurrentLayer((prev) => Math.min(venueData.layers.length - 1, prev + 1))}
                isDisabled={currentLayer === venueData.layers.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const rightPanelContent = isInteractiveMapStep ? interactiveMapPanel : readOnlyMapPanel;

  const basicsStep = (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md">
        <Input
          label="Venue Name"
          placeholder="e.g., Convention Center Hall A"
          value={venueData.name}
          onValueChange={handleChange}
          isRequired
          labelPlacement="outside"
          variant="flat"
          classNames={{
            label: 'text-surface-light font-medium',
            inputWrapper: 'rounded-large px-4 hover:bg-surface-deep',
            input: 'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none',
          }}
        />
      </div>
    </div>
  );

  const mapFloorsStep = (
    <div className="flex flex-col h-full">
      {mapStepHeader}
      <div className="flex-1 min-h-0">{hasMapForStep ? interactiveMapPanel : mapUploadPrompt}</div>
    </div>
  );

  const locationsStep = (
    <div className="flex flex-col h-full">
      <label className="mb-2 block text-sm font-medium text-surface-light flex-shrink-0">
        Locations
      </label>
      <div className="flex gap-2 flex-shrink-0">
        <Input
          placeholder="e.g., Main Entrance"
          value={locationInput}
          onValueChange={setLocationInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTextLocation();
            }
          }}
          variant="flat"
          classNames={{
            input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
            inputWrapper: 'rounded-large px-4 hover:bg-surface-deep',
          }}
        />
        <Button
          isIconOnly
          onPress={addTextLocation}
          className="flex-shrink-0 bg-accent hover:bg-accent/90 text-surface-light"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {allPosts.length > 0 && (
        <ScrollShadow className="mt-3 space-y-2 pr-2 flex-1 min-h-0 scrollbar-hide">
          {allPosts.map((item, idx) => {
            const post = item.post;
            const label = typeof post === 'string' ? post : post.name;
            const hasCoordinates = typeof post === 'object' && post.x !== null && post.y !== null;
            const isPending = pendingMarker?.layerIdx === item.layerIdx && pendingMarker?.postIdx === item.postIdx;

            return (
              <div key={idx} className="rounded-sm bg-default/40">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isClinicPost(post) ? (
                      <HousePlus className="h-4 w-4 flex-shrink-0 text-accent" />
                    ) : hasCoordinates ? (
                      <MapPinned className="h-4 w-4 flex-shrink-0 text-accent" />
                    ) : (
                      <MapPin className="h-4 w-4 flex-shrink-0 text-surface-light" />
                    )}
                    <span className={`text-sm truncate ${isPending ? 'text-status-blue italic' : 'text-surface-light'}`}>
                      {label}
                    </span>
                    {item.layerName && (
                      <span className="text-xs text-surface-light">({item.layerName})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {typeof post !== 'string' && (
                      <Button
                        isIconOnly
                        size="sm"
                        radius="full"
                        variant="light"
                        onPress={() => renamePost(item.layerIdx, item.postIdx)}
                        className="min-w-6 w-6 h-6"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      radius="full"
                      variant="light"
                      color="danger"
                      onPress={() => removePost(item.layerIdx, item.postIdx)}
                      className="min-w-6 w-6 h-6"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </ScrollShadow>
      )}
    </div>
  );

  const equipmentStep = (
    <div className="h-full flex flex-col">
      <EquipmentManagementSection
        equipmentInput={equipmentInput}
        setEquipmentInput={setEquipmentInput}
        addEquipment={addEquipment}
        equipment={venueData.equipment}
        editingEquipmentIndex={editingEquipmentIndex}
        equipmentEditInput={equipmentEditInput}
        setEquipmentEditInput={setEquipmentEditInput}
        saveEquipmentEdit={saveEquipmentEdit}
        cancelEquipmentEdit={cancelEquipmentEdit}
        startEditEquipment={startEditEquipment}
        removeEquipment={removeEquipment}
        locationOptions={locationOptions}
        onSetLocation={setEquipmentLocation}
      />
    </div>
  );

  const floorsWithMap = venueData.layers.filter((l) => !!l.mapUrl).length + (mapFile ? 1 : 0);
  const reviewStep = (
    <div className="h-full space-y-4">
      <div>
        <span className="text-xs text-surface-faint">Venue name</span>
        <p className="text-surface-light font-medium">{venueData.name.trim() || '(untitled)'}</p>
      </div>
      <div>
        <span className="text-xs text-surface-faint">Floors</span>
        <p className="text-surface-light">
          {venueData.layers.length} floor{venueData.layers.length === 1 ? '' : 's'}
          {floorsWithMap > 0 ? ` · ${floorsWithMap} with a map` : ''}
        </p>
      </div>
      <div>
        <span className="text-xs text-surface-faint">Locations</span>
        <p className="text-surface-light">{allPosts.length} location{allPosts.length === 1 ? '' : 's'}</p>
      </div>
      <div>
        <span className="text-xs text-surface-faint">Equipment</span>
        <p className="text-surface-light">{venueData.equipment.length} item{venueData.equipment.length === 1 ? '' : 's'}</p>
      </div>
    </div>
  );

  const hasName = !!venueData.name.trim();
  const steps: WizardStep[] = [
    { id: 'basics', label: 'Venue Configuration', component: basicsStep, isComplete: hasName },
    { id: 'map', label: 'Map', component: mapFloorsStep, isComplete: hasName },
    { id: 'locations', label: 'Locations', component: locationsStep, isComplete: hasName },
    { id: 'equipment', label: 'Equipment', component: equipmentStep, isComplete: hasName },
    { id: 'review', label: 'Review', component: reviewStep, isComplete: hasName },
  ];

  const stepIdx = STEP_ORDER.indexOf(currentStepId as (typeof STEP_ORDER)[number]);
  const isFirstStep = stepIdx <= 0;
  const isLastStep = stepIdx === STEP_ORDER.length - 1;
  const goNext = () => {
    if (stepIdx >= 0 && stepIdx < STEP_ORDER.length - 1) setCurrentStepId(STEP_ORDER[stepIdx + 1]);
  };
  const goBack = () => {
    if (stepIdx > 0) setCurrentStepId(STEP_ORDER[stepIdx - 1]);
  };

  // Bottom-left slot: Cancel only ever shows on the first step; every other
  // step gets Back in that same corner instead.
  const leftFooterButton = isFirstStep ? (
    <Button variant="bordered" size="md" onPress={() => router.push('/venues/selection')} className="px-6">
      Cancel
    </Button>
  ) : (
    <Button variant="flat" size="md" onPress={goBack} className="px-6">
      Back
    </Button>
  );

  // Bottom-right slot: Continue on every step but the last, where it
  // becomes the save actions instead.
  const rightFooterButtons = !isLastStep ? (
    <Button
      size="md"
      onPress={goNext}
      isDisabled={currentStepId === 'basics' && !hasName}
      className="px-6 bg-accent hover:bg-accent/90 text-surface-light"
    >
      Continue
    </Button>
  ) : (
    <div className="flex gap-2">
      <Button
        onPress={() => handleSubmit(undefined, { createEvent: true })}
        isLoading={isUploading}
        isDisabled={!hasName}
        variant="bordered"
        size="md"
        className="px-6"
      >
        Save & Start Event
      </Button>
      <Button
        onPress={() => handleSubmit()}
        isLoading={isUploading}
        isDisabled={!hasName}
        size="md"
        className="px-6 bg-accent hover:bg-accent/90 text-surface-light"
      >
        {isUploading ? (venueId ? 'Updating...' : 'Creating...') : (venueId ? 'Update Venue' : 'Create Venue')}
      </Button>
    </div>
  );

  const leftPanelContent = (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden pt-2 pb-4 px-6">
        <WizardShell
          steps={steps}
          currentStepId={currentStepId}
          onStepChange={setCurrentStepId}
          hideProgress
          className="flex-1 min-h-0"
        />
      </div>

      {showMapColumn ? (
        <div className="flex px-6 pt-4 pb-4 flex-shrink-0">{leftFooterButton}</div>
      ) : (
        <div className="flex items-center justify-between px-6 pt-4 pb-4 flex-shrink-0">
          <div>{leftFooterButton}</div>
          <div>{rightFooterButtons}</div>
        </div>
      )}
    </div>
  );

  const rightPanel = (
    <div className="flex flex-col h-full relative px-6 pt-4 pb-4 overflow-hidden">
      <div className="flex-1 min-h-0">{rightPanelContent}</div>
      <div className="flex justify-end pt-4 flex-shrink-0">{rightFooterButtons}</div>
    </div>
  );

  return (
    <main className="relative bg-surface-deepest text-surface-light h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="map-file-input"
        onChange={(e) => {
          setMapFile(e.target.files?.[0] ?? null);
          setPendingLayer(currentLayer);
        }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto h-full overflow-hidden flex flex-col w-full">
        <div className="px-6 pt-4 flex-shrink-0">
          <StepProgress steps={steps} currentStepId={currentStepId} onStepChange={setCurrentStepId} />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="flex h-full overflow-hidden">
            {showMapColumn ? (
              <>
                <div className="w-1/2 h-full flex-shrink-0 overflow-hidden">{leftPanelContent}</div>
                <div className="w-1/2 h-full flex-shrink-0 overflow-hidden">{rightPanel}</div>
              </>
            ) : (
              <div className="w-full h-full overflow-hidden">{leftPanelContent}</div>
            )}
          </div>
        </div>
      </div>

      <NewLayerModal
        isOpen={isNewLayerModalOpen}
        onClose={() => setIsNewLayerModalOpen(false)}
        onSubmit={handleAddLayer}
      />

      <LocationEditModal
        isOpen={isLocationEditModalOpen}
        onClose={() => setIsLocationEditModalOpen(false)}
        onSubmit={handleEditLocation}
        initialName={
          editingLocation
            ? (() => {
                const p = venueData.layers[editingLocation.layerIdx].posts[editingLocation.postIdx];
                return typeof p === 'string' ? p : (p && 'name' in p ? p.name : '');
              })()
            : ''
        }
        initialLayerIdx={editingLocation?.layerIdx || 0}
        initialIsClinic={
          editingLocation
            ? (() => {
                const p = venueData.layers[editingLocation.layerIdx].posts[editingLocation.postIdx];
                return typeof p === 'string' ? false : !!p?.isClinic;
              })()
            : false
        }
        layers={venueData.layers}
      />
    </main>
  );
}
