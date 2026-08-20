// app/venues/management/page.client.tsx

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useauth';
import { dbService, storageService } from '@/lib/services';
import { markerCounterScale } from '@/lib/labelScale';
import type { Post, Venue, Equipment, EquipmentStatus, Layer, ControlPoint, Georeference, BasemapCamera } from '@/app/types';
import { DiagonalStreaksFixed } from "@/components/ui/diagonal-streaks-fixed";
import { isPointWithinRect, pixelToPercent } from '@/lib/markerUtils';
import { georeferenceMapMatch, layerPostsLatLon, postGeoPosition, postPercentOnLayer } from '@/lib/geoUtils';
import { uploadWithRetry } from '@/lib/uploadUtils';
import { useZoomPan } from '@/hooks/useZoomPan';
import { isBasemapConfigured } from '@/lib/basemap/config';
import { sanitizeBasemapCameraForSave } from '@/lib/basemapCameraUtils';
import BasemapView from '@/components/dispatch/BasemapView';
import NewLayerModal from '@/components/modals/venue/newlayer';
import LocationEditModal from '@/components/modals/venue/locationedit';
import EquipmentManagementSection from '@/components/venue-management/EquipmentManagementSection';
import LayerControlBar from '@/components/venue-management/LayerControlBar';
import MarkerModeToggleButton from '@/components/venue-management/MarkerModeToggleButton';
import PendingMarkerDialog from '@/components/venue-management/PendingMarkerDialog';
import MarkerPlacementInstruction from '@/components/venue-management/MarkerPlacementInstruction';
import GeoreferenceSection from '@/components/venue-management/GeoreferenceSection';
import GeoreferencePointDialog from '@/components/venue-management/GeoreferencePointDialog';
import MapZoomControls from '@/components/ui/map-zoom-controls';
import MapPanSurface from '@/components/ui/map-pan-surface';
import {
  Button,
  Input,
  Card,
  Tabs,
  Tab,
  ScrollShadow,
} from '@heroui/react';
import {
  MapPin,
  Plus,
  Upload,
  Trash2,
  Edit2,
  MapPinned,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  MousePointer2,
  Compass,
  X,
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

// Phase 8 venue-editor follow-up: which of the two map views (raster upload
// vs. the real basemap) is showing right now. Mirrors venuemapmodal.tsx's own
// `MapViewMode`/`VIEW_MODE_STORAGE_KEY`/`isMapViewMode` (search that file for
// `viewMode` before changing this) but keeps its own storage key: the editor's
// default-view logic differs from the modal's (see the state initializer
// below), so conflating the two browser preferences would let one screen's
// choice silently override the other's.
type MapViewMode = 'raster' | 'basemap';
const EDITOR_VIEW_MODE_STORAGE_KEY = 'crowdcad.venueEditor.viewMode';

function isMapViewMode(value: unknown): value is MapViewMode {
  return value === 'raster' || value === 'basemap';
}


// Props: none required for this page

interface EquipmentWithLocation extends Equipment {
  locationId?: string;
}

// Builds the Georeference object to persist for a layer, honoring the two
// Firestore constraints: undefined is rejected at ANY depth (so `label` and
// `updatedBy` must be OMITTED, never set to undefined), and version/updatedAt
// must only advance when the control points actually changed this editing
// session (isDirty) rather than on every unrelated save.
//
// `pointsConfirmed` is narrower than `isDirty` and the two must not be merged.
// `isDirty` means "something invalidating happened" and covers both an operator
// editing the points and the map image being swapped from under them.
// `pointsConfirmed` means specifically "the operator placed or edited these
// points against the image now on screen", which is the only thing that earns
// the right to stamp `calibratedForMapUrl` forward. A map swap must leave the
// old URL behind, or the staleness it creates would be erased by the very save
// that creates it.
function buildGeoreferenceForSave(
  layer: Layer,
  isDirty: boolean,
  pointsConfirmed: boolean,
  userId: string
): Georeference | undefined {
  const georeference = layer.georeference;
  const controlPoints = georeference?.controlPoints ?? [];
  if (controlPoints.length === 0) {
    // No control points -> omit the georeference key entirely.
    return undefined;
  }

  const sanitizedPoints: ControlPoint[] = controlPoints.map((cp) => {
    const trimmedLabel = cp.label?.trim();
    const point: ControlPoint = { x: cp.x, y: cp.y, lat: cp.lat, lon: cp.lon };
    if (trimmedLabel) {
      point.label = trimmedLabel;
    }
    // Carry the GPS fix's accuracy through to the saved record. Without
    // this, a point placed via "Use my location" loses its accuracy figure
    // the moment the venue is saved, and describeGeoreferenceStatus's
    // GPS-bounded-fit caveat (GeoreferenceSection.tsx) would silently stop
    // applying the next time the venue is reopened even though the fit is
    // exactly as GPS-limited as it was in this session.
    if (cp.accuracy !== undefined) {
      point.accuracy = cp.accuracy;
    }
    return point;
  });

  const result: Georeference = {
    controlPoints: sanitizedPoints,
    version: isDirty ? (georeference?.version ?? 0) + 1 : (georeference?.version ?? 1),
    updatedAt: isDirty ? Date.now() : (georeference?.updatedAt ?? Date.now()),
  };

  const updatedBy = isDirty ? userId : georeference?.updatedBy;
  if (updatedBy) {
    result.updatedBy = updatedBy;
  }

  // Advance to the image the points were just confirmed against; otherwise
  // carry the old value forward untouched. Carrying it forward is what makes
  // "the map was replaced and nobody re-checked the points" survive this save
  // and be visible when the venue is reopened — the in-session staged-file
  // signal cannot, because handleSubmit navigates away on success.
  const calibratedForMapUrl = pointsConfirmed
    ? layer.mapUrl
    : georeference?.calibratedForMapUrl;
  if (calibratedForMapUrl) {
    result.calibratedForMapUrl = calibratedForMapUrl;
  }

  return result;
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
    /** Saved opening camera for basemap view. See `BasemapCamera`'s doc
     *  comment in app/types.ts. Absent (never set) is the default for every
     *  venue until an operator explicitly captures one via "Set default
     *  view" — never written as `undefined`, only omitted. */
    basemapCamera?: BasemapCamera;
  }>({
    name: '',
    equipment: [],
    layers: [{ id: crypto.randomUUID(), name: 'Floor 1', posts: [], mapUrl: undefined }],
  });

  const [currentLayer, setCurrentLayer] = useState(0);

  const [isUploading, setIsUploading] = useState(false);

  // Marker placement mode
  const [isAddMarkerMode, setIsAddMarkerMode] = useState(false);

  // Active marker being named. `x`/`y` are the raster path's image-percentage
  // coordinates; a basemap-placed marker has no image pixel space to derive
  // those from, so it carries `null` there instead and `lat`/`lon` (the
  // coordinate-native system of record — see the Post doc comment in
  // app/types.ts) carry the position instead. No use site in this file reads
  // `pendingMarker.x`/`.y` directly (they only key off `layerIdx`/`postIdx`),
  // so widening this to allow `null` is safe everywhere it's consumed.
  const [pendingMarker, setPendingMarker] = useState<{
    x: number | null;
    y: number | null;
    layerIdx: number;
    postIdx: number;
    lat?: number;
    lon?: number;
  } | null>(null);
  const [markerNameInput, setMarkerNameInput] = useState('');
  const [markerIsClinicInput, setMarkerIsClinicInput] = useState(false);

  // Georeference (control point) placement mode — mutually exclusive with
  // marker placement mode.
  const [isGeoreferenceMode, setIsGeoreferenceMode] = useState(false);

  // Control point just clicked on the map, awaiting lat/lon confirmation.
  // Unlike pendingMarker, this is NOT added to the layer's control points
  // until confirmed — cancel simply discards it, no cleanup needed.
  const [pendingGeoPoint, setPendingGeoPoint] = useState<{
    x: number;
    y: number;
    layerIdx: number;
  } | null>(null);
  const [geoLatInput, setGeoLatInput] = useState('');
  const [geoLonInput, setGeoLonInput] = useState('');
  const [geoLabelInput, setGeoLabelInput] = useState('');
  const [geoLatError, setGeoLatError] = useState<string | null>(null);
  const [geoLonError, setGeoLonError] = useState<string | null>(null);
  const geoLatInputRef = useRef<HTMLInputElement | null>(null);

  // Layer ids whose control points were added/edited/removed this editing
  // session. Only these layers get their georeference version/updatedAt
  // bumped on save — an unrelated save (renaming the venue, etc.) must not
  // touch it. Reset on venue load and after a successful save.
  const [georeferenceDirtyLayerIds, setGeoreferenceDirtyLayerIds] = useState<Set<string>>(new Set());

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
  } = useZoomPan(imgRef, imgContainerRef, {
    minScale: 1,
    maxScale: 5,
    disablePan: () => isAddMarkerMode || isGeoreferenceMode || draggingIdx !== null,
  });

  // --- Basemap view (TAK plan §8, venue-editor follow-up) --------------------
  //
  // Which of the two map views is showing right now. Initialized from
  // localStorage exactly like venuemapmodal.tsx's own viewMode state, wrapped
  // in the same try/catch for the same reason (Safari private mode etc.).
  const [viewMode, setViewModeState] = useState<MapViewMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(EDITOR_VIEW_MODE_STORAGE_KEY);
        if (isMapViewMode(stored)) return stored;
      } catch {
        // Fall through to the computed default below.
      }
    }
    // No stored preference: UNLIKE the modal, default to basemap the moment
    // it's configured and the layer on screen has no uploaded image at all --
    // that is the primary case this feature exists for (a campus-scale venue
    // with no raster and nothing to calibrate yet), and showing the upload
    // dropzone with no way past it would strand that flow entirely. A layer
    // that already has an image defaults to it unchanged, so reopening an
    // already-calibrated floor plan isn't surprised by a real-world map.
    const hasMapUrl = !!venueData.layers[currentLayer]?.mapUrl;
    return isBasemapConfigured() && !hasMapUrl ? 'basemap' : 'raster';
  });
  const setViewMode = (mode: MapViewMode) => {
    setViewModeState(mode);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(EDITOR_VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignored -- see the read-side comment above.
    }
  };
  // Set once, permanently, the first time BasemapView reports it can't draw.
  // See venuemapmodal.tsx's identical handleBasemapUnavailable for the full
  // rationale (§8.B degrade-to-nothing); this is the same contract applied to
  // the editor instead of the dispatch map.
  const [basemapFailed, setBasemapFailed] = useState(false);
  const handleBasemapUnavailable = useCallback((reason: string) => {
    console.warn(`[VenueManagementPage] basemap unavailable: ${reason}`);
    setBasemapFailed(true);
    setViewMode('raster');
  }, []);
  // Single source of truth for "is the basemap actually on screen right now"
  // -- see venuemapmodal.tsx's effectiveBasemap for why every render site
  // reads this instead of re-deriving it from the three inputs separately.
  const effectiveBasemap = isBasemapConfigured() && !basemapFailed && viewMode === 'basemap';

  // Live camera as last reported by BasemapView, for "Set default view" below.
  // BasemapView calls this on every `moveend` plus once when the map becomes
  // ready (§10.D). A ref rather than state because re-rendering the whole
  // editor on every pan/zoom, for a value only ever read on button-press,
  // would be pure churn. `hasLiveCamera` mirrors the ref's presence only so
  // the "Set default view" button's disabled state can react to it -- and
  // because BasemapView emits once on mount, it flips true as soon as the map
  // is up, without the operator having to move anything first.
  const liveBasemapCameraRef = useRef<BasemapCamera | null>(null);
  const [hasLiveCamera, setHasLiveCamera] = useState(false);
  const handleBasemapCameraChange = useCallback((camera: BasemapCamera) => {
    liveBasemapCameraRef.current = camera;
    setHasLiveCamera(true);
  }, []);

  // Captures the CURRENT basemap camera as this venue's default opening view.
  // View state only, per §8.C -- this never touches a post/marker position,
  // only Venue.basemapCamera. No-ops if BasemapView hasn't reported a camera
  // yet (see handleBasemapCameraChange above); the button is disabled in
  // that state so this branch should be unreachable in practice.
  const handleSetDefaultView = () => {
    const camera = liveBasemapCameraRef.current;
    if (!camera) return;
    setVenueData((prev) => ({ ...prev, basemapCamera: sanitizeBasemapCameraForSave(camera) }));
  };
  // Firestore rejects `undefined` at any depth -- OMIT the key entirely
  // rather than setting it undefined, matching buildGeoreferenceForSave's
  // own handling of `georeference` above.
  const handleClearDefaultView = () => {
    setVenueData((prev) => {
      const next = { ...prev };
      delete next.basemapCamera;
      return next;
    });
  };

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
  
  const [selectedLeftTab, setSelectedLeftTab] = useState<string>('locations');


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

  // Auto-focus latitude input when a pending georeference point is set
  useEffect(() => {
    if (pendingGeoPoint && geoLatInputRef.current) {
      geoLatInputRef.current.focus();
    }
  }, [pendingGeoPoint]);

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
            setVenueData((prev) => {
              const next: typeof prev = { name: venue.name, equipment: venue.equipment || [], layers };
              if (venue.basemapCamera) next.basemapCamera = venue.basemapCamera;
              return next;
            });
            setCurrentLayer(0);
            setGeoreferenceDirtyLayerIds(new Set());
            // Sync the view-mode default now that we know whether this venue
            // actually has a raster image, but only when the operator hasn't
            // already chosen a preference this browser: the initial state's
            // own guess (computed before any venue data existed, per the
            // viewMode initializer above) assumed "new venue" until this load
            // says otherwise, and is not itself a preference to respect.
            try {
              const stored =
                typeof window !== 'undefined' ? window.localStorage.getItem(EDITOR_VIEW_MODE_STORAGE_KEY) : null;
              if (!isMapViewMode(stored)) {
                const hasMapUrl = !!layers[0]?.mapUrl;
                setViewModeState(isBasemapConfigured() && !hasMapUrl ? 'basemap' : 'raster');
              }
            } catch {
              // Ignored -- worst case the pre-load guess stands.
            }
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

  // Derived lat/lon for every post in EVERY layer. The posts list below is
  // cross-layer (each row is tagged with its layer name), so scoping this to
  // the active layer alone would leave rows from other georeferenced layers
  // silently blank — indistinguishable from "this layer isn't calibrated".
  //
  // layerPostsLatLon solves each layer's georeference ONCE and reuses the
  // transform across that layer's posts, so this is one solve per layer, not
  // one per post. The result is indexed [layerIdx][postIdx], matching the
  // (layerIdx, postIdx) pairs allPosts already carries.
  //
  // This readout is the operator's calibration feedback loop: it is how
  // someone tells a good georeference from a bad one before it silently
  // produces wrong coordinates downstream.
  const layerPostLatLons = useMemo(
    () => venueData.layers.map((layer) => layerPostsLatLon(layer)),
    [venueData.layers]
  );

  // A layer counts as georeferenced once it has enough control points to
  // solve a transform (>= 2) — below that, every post's latLon is null by
  // definition and showing a "not placed" hint on each row would be noise.
  const layerIsGeoreferenced = useMemo(
    () => venueData.layers.map((layer) => (layer.georeference?.controlPoints.length ?? 0) >= 2),
    [venueData.layers]
  );

  // True when the map image on screen for the currently-viewed layer is a
  // staged replacement (picked via file input, not yet uploaded/saved) and
  // that layer already has control points. The control points are still
  // percentages solved against the OLD image (see buildGeoreferenceForSave's
  // mapReplaced handling below) — GeoreferenceSection uses this to refuse to
  // print residuals/an "ok" verdict for a fit that no longer describes the
  // picture underneath it. This mirrors handleSubmit's own `mapReplaced`
  // check (same pendingLayer/mapFile facts) so the live preview and what
  // actually gets persisted never disagree about what counts as "replaced."
  // Gated on having existing points: with none yet, "place at least 2
  // points" is already the whole story and there's nothing stale to flag.
  //
  // Two independent ways to be stale, and both are needed. The staged-file case
  // is the only one visible while the operator is mid-edit, and the only one the
  // persisted record cannot see (nothing is saved yet). The persisted case is
  // the only one visible after a save — handleSubmit navigates away on success,
  // so an operator reopening this venue tomorrow has no staged file to go on,
  // and until calibratedForMapUrl existed they were shown a confident "ok"
  // computed from points placed on a different picture.
  const currentLayerNeedsGeoreferenceReconfirmation = (() => {
    const layer = venueData.layers[currentLayer];
    if ((layer?.georeference?.controlPoints.length ?? 0) === 0) {
      // With no points yet, "place at least 2 points" is already the whole
      // story and there is nothing stale to flag.
      return false;
    }
    const stagedReplacement = pendingLayer === currentLayer && !!mapFile;
    // Only a proven mismatch counts. 'unknown' — a georeference written before
    // calibratedForMapUrl existed — must not be reported as stale; see
    // georeferenceMapMatch.
    const persistedMismatch =
      georeferenceMapMatch(layer?.mapUrl, layer?.georeference) === 'stale';
    return stagedReplacement || persistedMismatch;
  })();

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

  // Handle map click for marker placement / georeference control point placement
  const handleImageClick = (evt: React.MouseEvent<HTMLDivElement>) => {
    if ((!isAddMarkerMode && !isGeoreferenceMode) || isPanning) return;

    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();

    if (!isPointWithinRect(evt.clientX, evt.clientY, rect)) {
      return;
    }

    const { x, y } = pixelToPercent(evt.clientX, evt.clientY, rect);

    if (isGeoreferenceMode) {
      // Georeference control points are NOT written into layer state until
      // the pending-point dialog is confirmed — do not create a Post here.
      setPendingGeoPoint({ x, y, layerIdx: currentLayer });
      setGeoLatInput('');
      setGeoLonInput('');
      setGeoLabelInput('');
      setGeoLatError(null);
      setGeoLonError(null);
      return;
    }

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

  // Coordinate-native counterpart to handleImageClick above, for marker
  // placement on the real basemap (10.C's `Post.lat`/`Post.lon`). There is no
  // raster pixel space here to derive x/y from, so the post is built directly
  // from the clicked lat/lon with x/y explicitly `null` -- never omitted and
  // never `undefined` (Firestore rejects `undefined` at any depth, and posts
  // inside `layer.posts` are written verbatim; see handleSubmit's save path).
  const handleBasemapMapClick = ({ lat, lon }: { lat: number; lon: number }) => {
    // Georeference (control point) mode has no map click handler wired in
    // basemap view -- this should be unreachable -- but stay defensive rather
    // than let a stray click during that mode create a stray Post.
    if (isGeoreferenceMode) return;

    const newPost: Post = { name: '', x: null, y: null, lat, lon };

    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      newLayers[currentLayer] = {
        ...newLayers[currentLayer],
        posts: [...newLayers[currentLayer].posts, newPost],
      };
      return { ...prev, layers: newLayers };
    });
    // Same postIdx computation as the raster path above -- venueData.layers's
    // pre-update length, kept consistent with handleImageClick on purpose.
    setPendingMarker({
      x: null,
      y: null,
      lat,
      lon,
      layerIdx: currentLayer,
      postIdx: venueData.layers[currentLayer].posts.length,
    });
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

    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      const copy = [...newLayers[pendingMarker.layerIdx].posts];
      const currentPost = copy[pendingMarker.postIdx];
      if (typeof currentPost !== 'string') {
        copy[pendingMarker.postIdx] = { ...currentPost, name, isClinic: markerIsClinicInput };
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

  // Mark a layer's georeference as edited this session, so its version only
  // bumps on save if it actually changed (not on an unrelated save).
  const markGeoreferenceDirty = (layerId: string) => {
    setGeoreferenceDirtyLayerIds((prev) => {
      if (prev.has(layerId)) return prev;
      const next = new Set(prev);
      next.add(layerId);
      return next;
    });
  };

  // The inverse: a layer's points are no longer "confirmed against the image on
  // screen" once a different image is staged for it. Clearing the flag does not
  // lose the version bump — handleSubmit's `mapReplaced` branch still supplies
  // one — it only stops the swap from being mistaken for the operator having
  // re-checked the points, which is the claim `calibratedForMapUrl` records.
  const clearGeoreferenceConfirmed = (layerId: string) => {
    setGeoreferenceDirtyLayerIds((prev) => {
      if (!prev.has(layerId)) return prev;
      const next = new Set(prev);
      next.delete(layerId);
      return next;
    });
  };

  const addControlPoint = (layerIdx: number, point: ControlPoint) => {
    const layerId = venueData.layers[layerIdx].id;
    setVenueData((prev) => {
      const layer = prev.layers[layerIdx];
      const existingPoints = layer.georeference?.controlPoints ?? [];
      const newLayers = [...prev.layers];
      newLayers[layerIdx] = {
        ...layer,
        georeference: {
          controlPoints: [...existingPoints, point],
          version: layer.georeference?.version ?? 0,
          updatedAt: layer.georeference?.updatedAt ?? Date.now(),
          ...(layer.georeference?.updatedBy ? { updatedBy: layer.georeference.updatedBy } : {}),
        },
      };
      return { ...prev, layers: newLayers };
    });
    markGeoreferenceDirty(layerId);
  };

  const updateControlPoint = (index: number, patch: Partial<ControlPoint>) => {
    const layerId = venueData.layers[currentLayer].id;
    setVenueData((prev) => {
      const layer = prev.layers[currentLayer];
      const georeference = layer.georeference;
      if (!georeference || index < 0 || index >= georeference.controlPoints.length) return prev;
      const newLayers = [...prev.layers];
      newLayers[currentLayer] = {
        ...layer,
        georeference: {
          ...georeference,
          controlPoints: georeference.controlPoints.map((p, i) => (i === index ? { ...p, ...patch } : p)),
        },
      };
      return { ...prev, layers: newLayers };
    });
    markGeoreferenceDirty(layerId);
  };

  const removeControlPoint = (index: number) => {
    const layerId = venueData.layers[currentLayer].id;
    setVenueData((prev) => {
      const layer = prev.layers[currentLayer];
      const georeference = layer.georeference;
      if (!georeference) return prev;
      const newLayers = [...prev.layers];
      newLayers[currentLayer] = {
        ...layer,
        georeference: {
          ...georeference,
          controlPoints: georeference.controlPoints.filter((_, i) => i !== index),
        },
      };
      return { ...prev, layers: newLayers };
    });
    markGeoreferenceDirty(layerId);
  };

  const clearControlPoints = () => {
    const layerId = venueData.layers[currentLayer].id;
    setVenueData((prev) => {
      const layer = prev.layers[currentLayer];
      const georeference = layer.georeference;
      if (!georeference || georeference.controlPoints.length === 0) return prev;
      const newLayers = [...prev.layers];
      newLayers[currentLayer] = {
        ...layer,
        georeference: {
          ...georeference,
          controlPoints: [],
        },
      };
      return { ...prev, layers: newLayers };
    });
    markGeoreferenceDirty(layerId);
  };

  // Confirm the pending georeference point: validate lat/lon, then add it
  // to the current layer's control points.
  const confirmGeoPoint = () => {
    if (!pendingGeoPoint) return;

    const latValue = Number(geoLatInput);
    const lonValue = Number(geoLonInput);
    let hasError = false;

    if (geoLatInput.trim() === '' || !Number.isFinite(latValue)) {
      setGeoLatError('Latitude must be a number');
      hasError = true;
    } else if (latValue < -90 || latValue > 90) {
      setGeoLatError('Latitude must be between -90 and 90');
      hasError = true;
    } else {
      setGeoLatError(null);
    }

    if (geoLonInput.trim() === '' || !Number.isFinite(lonValue)) {
      setGeoLonError('Longitude must be a number');
      hasError = true;
    } else if (lonValue < -180 || lonValue > 180) {
      setGeoLonError('Longitude must be between -180 and 180');
      hasError = true;
    } else {
      setGeoLonError(null);
    }

    if (hasError) return;

    const trimmedLabel = geoLabelInput.trim();
    const newPoint: ControlPoint = trimmedLabel
      ? { x: pendingGeoPoint.x, y: pendingGeoPoint.y, lat: latValue, lon: lonValue, label: trimmedLabel }
      : { x: pendingGeoPoint.x, y: pendingGeoPoint.y, lat: latValue, lon: lonValue };

    addControlPoint(pendingGeoPoint.layerIdx, newPoint);

    setPendingGeoPoint(null);
    setGeoLatInput('');
    setGeoLonInput('');
    setGeoLabelInput('');
    setGeoLatError(null);
    setGeoLonError(null);
  };

  // Cancel the pending georeference point — it was never added to the
  // layer's control points, so this just discards the dialog state.
  const cancelGeoPoint = () => {
    setPendingGeoPoint(null);
    setGeoLatInput('');
    setGeoLonInput('');
    setGeoLabelInput('');
    setGeoLatError(null);
    setGeoLonError(null);
  };

  const renamePost = (layerIdx: number, postIdx: number) => {
    setEditingLocation({ layerIdx, postIdx });
    setIsLocationEditModalOpen(true);
  };

  const handleEditLocation = (name: string, newLayerIdx: number, isClinic: boolean) => {
    if (!editingLocation) return;
    const { layerIdx, postIdx } = editingLocation;
    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      const post = newLayers[layerIdx].posts[postIdx];
      if (typeof post === 'string') return prev;
      if (newLayerIdx !== layerIdx) {
        // Move to new layer
        const newPost = { ...post, name, isClinic };
        newLayers[layerIdx].posts.splice(postIdx, 1);
        newLayers[newLayerIdx].posts.push(newPost);
      } else {
        // Same layer, just rename
        newLayers[layerIdx].posts[postIdx] = { ...post, name, isClinic };
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

  // Markers here used to carry no counter-scale at all, so they grew in
  // lockstep with the raster: a 24px pin became a 192px pin at 8x. The
  // dispatch map did the exact opposite. Both surfaces now share one law
  // (labelScale.ts): net on-screen size grows as the square root of zoom.
  //
  // Only mechanism (a) of Phase 7.E(3) applies here. Collision declutter and
  // zoom-gating are dispatch-map-only on purpose -- this editor is a
  // placement tool working on a handful of posts at a time, where seeing
  // every marker you have placed matters more than a tidy label layout, and
  // it has no measured pixel rect to do collision in.
  //
  // transformOrigin 'top left' with scale() BEFORE translate() is what keeps
  // the marker centred on its percentage point at any scale: the translate
  // is then expressed in pre-scale units and shrinks with the marker.
  const markerCounter = markerCounterScale(scale);
  const markerScaleStyle: React.CSSProperties = {
    transformOrigin: 'top left',
    transform: `scale(${markerCounter}) translate(-50%, -50%)`,
  };

  // Per-post drawable percent for the CURRENTLY VIEWED layer only, resolved
  // ONCE per render via postPercentOnLayer rather than once per marker --
  // postPercentOnLayer solves the layer's georeference internally, so
  // calling it per marker per render would re-solve the same transform
  // posts.length times on every render. Follows the same "solve once, reuse
  // per post" shape as layerPostLatLons above (which is cross-layer and
  // reports ground position -- this is layer-scoped and reports screen
  // position). Indexed by the ORIGINAL index into layer.posts, matching
  // posts[i] -- never by an index into any filtered array. See renderMarkers
  // below for why that distinction is load-bearing.
  const currentLayerPostPercents = useMemo(() => {
    const layer = venueData.layers[currentLayer];
    if (!layer) return [];
    return layer.posts.map((post) => postPercentOnLayer(layer, post));
  }, [venueData.layers, currentLayer]);

  const renderMarkers = () => {
    const layer = venueData.layers[currentLayer];
    if (!layer) return null;

    return layer.posts
      // Attach the ORIGINAL index (and the resolved percent) to every post
      // BEFORE filtering. Filtering first and then using .map's post-filter
      // idx was a real bug: a text-only location (addTextLocation) or a
      // legacy string post has no x/y and gets dropped by the filter below,
      // which shifts every subsequent post's filtered-array index away from
      // its true index into `layer.posts`. Since hover/drag/rename/pending
      // all key off this index and act on `layer.posts[idx]` (or the
      // full-array-indexed removePost/renamePost), a filtered index made
      // them silently operate on the wrong post whenever a droppable post
      // preceded a real marker in the array. Carrying originalIdx forward
      // instead keeps every consumer pointed at the post actually under the
      // cursor.
      .map((post, originalIdx) => ({
        post,
        originalIdx,
        percent: currentLayerPostPercents[originalIdx] ?? null,
      }))
      .filter(
        (entry): entry is { post: Exclude<Post, string>; originalIdx: number; percent: { x: number; y: number } } =>
          typeof entry.post === 'object' &&
          entry.post !== null &&
          entry.percent !== null
      )
      .map(({ post, originalIdx, percent }) => {
        const isHover = hoverId === originalIdx;
        const isPending =
          pendingMarker?.layerIdx === currentLayer && pendingMarker?.postIdx === originalIdx;
        // A coordinate-native post's on-screen percent is DERIVED from its
        // lat/lon via this layer's georeference (postPercentOnLayer above),
        // not stored. onMarkerMouseDown's drag handler writes a raw x/y
        // percent straight onto the post, which for a coordinate-native post
        // would leave its stored lat/lon and its now-overwritten x/y
        // disagreeing about where it is. Correctly moving one of these means
        // inverse-projecting the drop point back through the georeference
        // into a new lat/lon, which is separate follow-on work -- so for now
        // it still renders, hovers, and is renamable, just not drag-movable.
        const isCoordinateNative = postGeoPosition(post) !== null;

        return (
          <React.Fragment key={originalIdx}>
            <div
              style={{ left: `${percent.x}%`, top: `${percent.y}%`, ...markerScaleStyle }}
              className="absolute z-10"
            >
              <div
                className={`flex h-6 w-6 ${isCoordinateNative ? 'cursor-pointer' : 'cursor-grab'} items-center justify-center rounded-full border-2 transition-all ${
                  isPending
                    ? 'border-status-blue bg-status-blue/20 scale-125'
                    : isHover || draggingIdx === originalIdx
                    ? 'border-accent bg-accent/30 scale-110'
                    : 'border-accent bg-accent/20 hover:scale-110'
                } ${draggingIdx === originalIdx ? 'cursor-grabbing scale-110' : ''}`}
                onMouseEnter={() => setHoverId(originalIdx)}
                onMouseLeave={() => setHoverId((cur) => (cur === originalIdx ? null : cur))}
                onMouseDown={isCoordinateNative ? undefined : onMarkerMouseDown(originalIdx)}
                onClick={(e) => {
                  if (isPending) return;
                  e.preventDefault();
                  e.stopPropagation();
                  renamePost(currentLayer, originalIdx);
                }}
              >
                <MapPin className="h-4 w-4 text-accent" strokeWidth={2.5} />
              </div>
            </div>
            {isHover && !isPending && post.name && (
              <div
                style={{
                  left: `${percent.x}%`,
                  top: `${percent.y}%`,
                  transformOrigin: 'top left',
                  transform: `scale(${markerCounter}) translate(-50%, calc(-100% - 14px))`,
                }}
                className="pointer-events-none absolute z-20 rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg border border-default whitespace-nowrap"
              >
                {post.name}
              </div>
            )}
          </React.Fragment>
        );
      });
  };

  // Render the current layer's georeference control points as map overlays,
  // visually distinct from post markers (numbered, status-orange, no drag).
  const renderControlPointMarkers = () => {
    const controlPoints = venueData.layers[currentLayer]?.georeference?.controlPoints ?? [];

    return controlPoints.map((cp, idx) => (
      <div
        key={idx}
        style={{ left: `${cp.x}%`, top: `${cp.y}%`, ...markerScaleStyle }}
        className="absolute z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-status-orange bg-status-orange/20 text-[10px] font-semibold text-status-orange shadow-sm pointer-events-none"
        title={cp.label ? `Control point ${idx + 1}: ${cp.label}` : `Control point ${idx + 1}`}
      >
        {idx + 1}
      </div>
    ));
  };

  // Create venue
  const handleSubmit = async (e?: React.FormEvent) => {
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

    if (pendingGeoPoint) {
      alert('Please finish naming the control point or cancel it before saving');
      return;
    }

    setIsUploading(true);
    try {
      let newMapUrl: string | undefined;

      if (mapFile && mapFile.size > 0) {
        newMapUrl = await storageService.uploadFile(`venue_maps/${Date.now()}_${mapFile.name}`, mapFile);
      }

      const equipmentToSave = venueData.equipment.map(({ ...rest }) => rest);

      // Update current layer's mapUrl if new map uploaded, and finalize each
      // layer's georeference (bumping version/updatedAt only for layers
      // whose control points actually changed this session, OR whose map
      // image was just replaced out from under existing control points).
      const layersForSave: Layer[] = venueData.layers.map((layer, idx) => {
        const mapReplaced = idx === (pendingLayer ?? currentLayer) && !!newMapUrl;
        const layerWithMap = mapReplaced ? { ...layer, mapUrl: newMapUrl } : layer;
        // A layer's control points are percentages of ITS map image — they
        // carry no reference to which image they were placed on, so nothing
        // stops them from surviving an image swap unchanged and silently
        // wrong. Replacing mapUrl for a layer that already has control
        // points must bump version exactly like an operator editing those
        // points directly would, even though the two cases are making a
        // slightly different claim: editing control points means "the
        // calibration changed"; swapping the image means "the calibration
        // is now wrong, and needs to be redone." Both correctly invalidate
        // any coordinate stamped with the old version (see
        // GeoTransform.version / georeferenceStaleness in geoUtils.ts),
        // which is why one counter can carry both meanings without
        // conflating them.
        //
        // The control points themselves are deliberately left untouched
        // here, not cleared: they are operator-entered work, and a percent
        // coordinate against the old image is still a usable starting point
        // for re-placing them against the new one. Clearing them would trade
        // a recoverable "needs recalibration" state for an unrecoverable
        // one — the version bump alone is what signals staleness.
        const hasExistingControlPoints = (layer.georeference?.controlPoints.length ?? 0) > 0;
        // Choosing a new map file clears this layer from the dirty set (see the
        // file input's onChange), so a set membership here means the points were
        // edited AFTER the currently-staged image was chosen — i.e. confirmed
        // against the picture the operator was actually looking at. Without that
        // reset, "edit points, then swap the image, then save" would stamp
        // calibratedForMapUrl forward onto an image those points never saw.
        const pointsConfirmed = georeferenceDirtyLayerIds.has(layer.id);
        const isDirty = pointsConfirmed || (mapReplaced && hasExistingControlPoints);
        const georeferenceForSave = buildGeoreferenceForSave(
          layerWithMap,
          isDirty,
          pointsConfirmed,
          userId
        );
        const finalizedLayer: Layer = { ...layerWithMap };
        if (georeferenceForSave) {
          finalizedLayer.georeference = georeferenceForSave;
        } else {
          // No control points -> omit the georeference key entirely.
          delete finalizedLayer.georeference;
        }
        return finalizedLayer;
      });

      // Remove undefined properties from each layer — Firestore rejects
      // undefined at any depth. georeference was already deeply sanitized
      // above by buildGeoreferenceForSave; this only strips top-level keys
      // (e.g. a layer with no mapUrl).
      const updatedLayers = layersForSave.map((layer) => {
        const filteredLayer: Record<string, unknown> = {};
        Object.entries(layer).forEach(([key, value]) => {
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

      // Only add basemapCamera if the operator has captured one -- omit the
      // key entirely rather than writing `undefined` (Firestore rejects
      // `undefined` at any depth, same as mapUrl above and georeference in
      // buildGeoreferenceForSave). venueData.basemapCamera is already fully
      // sanitized at capture time by sanitizeBasemapCameraForSave, so no
      // further stripping is needed here.
      if (venueData.basemapCamera) {
        dataToSave.basemapCamera = venueData.basemapCamera;
      }

      if (venueId) {
        await dbService.updateDocument('venues', venueId, dataToSave);
      } else {
        await dbService.addDocument('venues', dataToSave);
      }

      // Sync local state with what was actually persisted (finalized
      // georeference versions, new mapUrl) and clear the dirty set so a
      // subsequent save doesn't double-bump an already-saved version.
      setVenueData((prev) => ({ ...prev, layers: layersForSave }));
      setGeoreferenceDirtyLayerIds(new Set());

      router.push('/venues/selection')
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

  // Marker placement and georeference placement are mutually exclusive map
  // interaction modes — turning one on turns the other off.
  const toggleAddMarkerMode = () => {
    setIsAddMarkerMode((prev) => {
      const next = !prev;
      if (next) setIsGeoreferenceMode(false);
      return next;
    });
  };

  const toggleGeoreferenceMode = () => {
    setIsGeoreferenceMode((prev) => {
      const next = !prev;
      if (next) setIsAddMarkerMode(false);
      return next;
    });
  };

  return (
    <main className="relative bg-surface-deepest text-surface-light h-[calc(100vh-3rem)]">
      <DiagonalStreaksFixed />
      
      <div className="relative z-10 pt-4 max-w-[1200px] mx-auto">
        <div>

          <div className="flex h-[calc(100vh-80px)]">
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
              const layerId = venueData.layers[currentLayer]?.id;
              if (layerId) clearGeoreferenceConfirmed(layerId);
            }}
          />

          <PanelGroup direction="horizontal">
            {/* Left Panel - Resizable */}
            <Panel defaultSize={30} minSize={25} maxSize={50}>
              <div className="flex flex-col h-full relative">
                <div className="flex-1 p-6 pb-12">
                  <div className="space-y-6">

                  {/* Venue Name */}
                  <div>
                    <Input
                      label="Venue Name"
                      placeholder="e.g., Convention Center Hall A"
                      value={venueData.name}
                      onValueChange={handleChange}
                      isRequired
                      labelPlacement={"outside"}
                      variant="flat"
                      classNames={{
                        label: 'text-surface-light font-medium',
                        inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
                        input: 'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none',
                      }}
                    />
                  </div>

                  {/* Locations & Equipment Section with Tabs */}
                  <Tabs className="flex-1 w-full" fullWidth radius="lg" selectedKey={selectedLeftTab} onSelectionChange={(key) => setSelectedLeftTab(key as string)}>
                    <Tab key="locations" title="Locations">
                      <label className="mb-2 block text-sm font-medium text-surface-light">
                        Locations
                      </label>
                      <div className="flex gap-2">
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
                            inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
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
                        <ScrollShadow className="mt-3 space-y-2 pr-2 max-h-[calc(100vh-430px)] scrollbar-hide">
                          {allPosts.map((item, idx) => {
                            const post = item.post;
                            const label = typeof post === 'string' ? post : post.name;
                            // A coordinate-native post (10.C) has x: null, y: null by
                            // design -- postGeoPosition is the accessor for its stored
                            // lat/lon and must be consulted too, or a basemap-placed
                            // post would wrongly read as "not placed".
                            const hasCoordinates =
                              typeof post === 'object' &&
                              ((post.x !== null && post.y !== null) || postGeoPosition(post) !== null);
                            const isPending = pendingMarker?.layerIdx === item.layerIdx && pendingMarker?.postIdx === item.postIdx;

                            const derivedLatLon =
                              layerPostLatLons[item.layerIdx]?.[item.postIdx]?.latLon ?? null;

                            return (
                              <Card
                                key={idx}
                                isBlurred
                                className="border-2 rounded-2xl border-default-200 bg-transparent"
                              >
                                <div className="flex flex-col px-3 py-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {hasCoordinates ? (
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
                                        variant="light"
                                        color="danger"
                                        onPress={() => removePost(item.layerIdx, item.postIdx)}
                                        className="min-w-6 w-6 h-6"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  {derivedLatLon ? (
                                    <p className="pl-6 text-xs text-surface-faint">
                                      {derivedLatLon.lat.toFixed(6)}, {derivedLatLon.lon.toFixed(6)}
                                    </p>
                                  ) : (
                                    // Only worth saying when the layer IS calibrated: then a
                                    // missing coordinate is about this post specifically, not
                                    // about the layer. On an uncalibrated layer every row
                                    // would say it, which is pure noise.
                                    layerIsGeoreferenced[item.layerIdx] && (
                                      <p className="pl-6 text-xs text-surface-faint">not placed on map</p>
                                    )
                                  )}
                                </div>
                              </Card>
                            );
                          })}
                        </ScrollShadow>
                      )}
                    </Tab>
                    <Tab key="equipment" title="Equipment">
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
                      />
                    </Tab>
                    <Tab key="georeference" title="Georeference">
                      <GeoreferenceSection
                        controlPoints={venueData.layers[currentLayer]?.georeference?.controlPoints ?? []}
                        needsReconfirmation={currentLayerNeedsGeoreferenceReconfirmation}
                        onUpdatePoint={updateControlPoint}
                        onRemovePoint={removeControlPoint}
                        onClearAll={clearControlPoints}
                      />
                    </Tab>
                  </Tabs>
                </div>
              </div>

              {/* Action Buttons - Fixed to Bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex gap-3">
                  <Button
                    variant="bordered"
                    onPress={() => router.push('/venues/selection')}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={() => handleSubmit()}
                    isLoading={isUploading}
                    isDisabled={!venueData.name.trim()}
                    className="flex-1 bg-accent hover:bg-accent/90 text-surface-light px-10"
                  >
                    {isUploading ? (venueId ? 'Updating...' : 'Creating...') : (venueId ? 'Update Venue' : 'Create Venue')}
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
          {/* Resize Handle */}
          <PanelResizeHandle className="w-1 bg-surface-liner transition-colors cursor-col-resize flex items-center justify-center group">
            <div className="w-0.5 h-8 bg-surface-light/30 rounded-full transition-colors" />
          </PanelResizeHandle>
          {/* Right Panel - Resizable */}
          <Panel defaultSize={70} minSize={45}>
            <div className="flex flex-col h-full relative px-6 pt-6 pb-[72px] overflow-hidden">
              <div className="mb-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-surface-light">
                    Venue Map <span className="text-surface-light text-xs">(Optional)</span>
                  </label>
                  <Input
                    value={venueData.layers[currentLayer].name}
                    onValueChange={updateLayerName}
                    variant="flat"
                    size="md"
                    classNames={{
                      input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                      inputWrapper: 'rounded-2xl px-4 pr-6 hover:bg-surface-deep',
                    }}
                    placeholder="Layer name"
                  />
                </div>
                {/* "Add Markers" works in EITHER view now (10.E): the raster
                    path still derives x/y from an image-pixel click via
                    handleImageClick, while basemap view hands
                    handleBasemapMapClick a lat/lon directly (10.C's
                    coordinate-native Post shape) and needs no image pixel
                    space at all. "Add Control Point" stays raster-only and
                    deliberately so -- a control point is, by definition, a
                    correspondence between an IMAGE pixel and a ground
                    coordinate, and there is no image to place one on in
                    basemap view. Do not "fix" that; it is correct. */}
                {(previewUrl || effectiveBasemap) && (
                  <div className="flex gap-2">
                    <MarkerModeToggleButton
                      isAddMarkerMode={isAddMarkerMode}
                      onToggle={toggleAddMarkerMode}
                    />
                    {previewUrl && !effectiveBasemap && (
                      <Button
                        size="md"
                        variant={isGeoreferenceMode ? 'solid' : 'bordered'}
                        color={isGeoreferenceMode ? 'primary' : 'default'}
                        onPress={toggleGeoreferenceMode}
                        startContent={
                          isGeoreferenceMode ? (
                            <MousePointer2 className="h-3.5 w-3.5" />
                          ) : (
                            <Crosshair className="h-3.5 w-3.5" />
                          )
                        }
                        className={isGeoreferenceMode ? 'bg-status-orange hover:bg-status-orange/90 text-surface-deepest' : ''}
                      >
                        {isGeoreferenceMode ? 'Click to Place' : 'Add Control Point'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div
                className={`rounded-xl relative flex flex-col items-center justify-start w-full ${(previewUrl || effectiveBasemap) ? 'max-h-[calc(100vh-180px)]' : 'h-full'}`}
              >
                {effectiveBasemap ? (
                  <div className="w-full flex flex-col gap-3 max-h-full">
                    <div
                      className="relative w-full overflow-hidden rounded-2xl"
                      style={{ height: 'calc(100vh - 200px)', minHeight: '360px' }}
                    >
                      {/* venueData.layers always has at least one entry (see
                          the initial state above), but stay defensive rather
                          than hand BasemapView's required `layer` prop a
                          possibly-undefined value -- matches
                          venuemapmodal.tsx's own `currentLayerObj &&` guard. */}
                      {venueData.layers[currentLayer] && (
                        <BasemapView
                          layer={venueData.layers[currentLayer]}
                          staff={[]}
                          theme="dark"
                          initialCamera={venueData.basemapCamera ?? null}
                          onUnavailable={handleBasemapUnavailable}
                          onCameraChange={handleBasemapCameraChange}
                          isPlacementArmed={isAddMarkerMode}
                          onMapClick={handleBasemapMapClick}
                          draftPin={
                            pendingMarker?.lat !== undefined && pendingMarker?.lon !== undefined
                              ? { lat: pendingMarker.lat, lon: pendingMarker.lon }
                              : null
                          }
                          className="h-full w-full"
                        />
                      )}

                      {/* Same pending-marker dialog and placement hint as the
                          raster branch below -- no duplicated state, just
                          rendered from here too now that basemap view can
                          place markers (10.E). PendingMarkerDialog is
                          `position: fixed` and centered, so it doesn't care
                          which branch renders it; MarkerPlacementInstruction
                          is `absolute left-3 top-3` so it needs this
                          relatively-positioned map container as its anchor. */}
                      {pendingMarker && (
                        <PendingMarkerDialog
                          markerNameInput={markerNameInput}
                          markerInputRef={markerInputRef}
                          setMarkerNameInput={setMarkerNameInput}
                          markerIsClinicInput={markerIsClinicInput}
                          setMarkerIsClinicInput={setMarkerIsClinicInput}
                          onConfirm={confirmMarkerName}
                          onCancel={cancelMarkerName}
                          lat={pendingMarker.lat}
                          lon={pendingMarker.lon}
                        />
                      )}
                      {isAddMarkerMode && !pendingMarker && <MarkerPlacementInstruction />}

                      {/* View toggle (mirrors venuemapmodal.tsx's placement
                          rationale: bottom-left is the one corner no other
                          overlay in this panel claims). */}
                      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-surface-liner bg-surface-deepest/90 p-0.5 backdrop-blur">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setViewMode('raster')}
                          className="px-2.5 text-xs bg-transparent text-surface-faint"
                        >
                          Venue image
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setViewMode('basemap')}
                          className="px-2.5 text-xs bg-accent text-accent-foreground"
                        >
                          Map
                        </Button>
                      </div>

                      {/* Set/clear this venue's default basemap framing.
                          Basemap-only: a raster view has no camera to save. */}
                      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
                        {venueData.basemapCamera && (
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={handleClearDefaultView}
                            startContent={<X className="h-3.5 w-3.5" />}
                            className="bg-surface-deepest/90 backdrop-blur text-xs"
                          >
                            Clear default view
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="flat"
                          isDisabled={!hasLiveCamera}
                          onPress={handleSetDefaultView}
                          startContent={<Compass className="h-3.5 w-3.5" />}
                          className="bg-surface-deepest/90 backdrop-blur text-xs"
                          title={
                            hasLiveCamera
                              ? 'Save the current view as this venue\'s default'
                              : 'Waiting on BasemapView to report the current camera'
                          }
                        >
                          Set default view
                        </Button>
                      </div>
                    </div>

                    {/* Bottom Info Bar -- same layer-nav shell as the raster
                        panel below, so switching views mid-edit doesn't also
                        hide the ability to add/rename/delete layers. */}
                    <Card
                      isBlurred
                      className="border-2 border-default-200 bg-transparent w-full px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPinned className="h-4 w-4 text-accent" />
                          <span className="text-xs text-surface-light truncate max-w-[120px]">{mapFileName}</span>
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => fileInputRef.current?.click()}
                            startContent={<Upload className="h-3 w-3" />}
                            className="ml-2"
                          >
                            Replace
                          </Button>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            isDisabled={currentLayer <= 0}
                            onPress={() => setCurrentLayer(currentLayer - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span
                            className="text-xs text-surface-light min-w-[100px] text-center"
                          >
                            {venueData.layers?.[currentLayer]?.name || 'Layer'}
                          </span>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            isDisabled={!venueData.layers || currentLayer >= venueData.layers.length - 1}
                            onPress={() => setCurrentLayer(currentLayer + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={deleteLayer}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            data-testid="add-layer-button"
                            onPress={() => setIsNewLayerModalOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : previewUrl ? (
                  <div className="w-full flex flex-col gap-3 max-h-full">
                    <div className="relative w-full overflow-hidden rounded-2xl">
                      <MapPanSurface
                        containerRef={imgContainerRef}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        style={{ 
                          cursor: isAddMarkerMode || isGeoreferenceMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
                          maxHeight: 'calc(100vh - 200px)',
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
                            src={previewUrl}
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
                              {renderControlPointMarkers()}
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
                          lat={pendingMarker.lat}
                          lon={pendingMarker.lon}
                        />
                      )}

                      {pendingGeoPoint && (
                        <GeoreferencePointDialog
                          latInput={geoLatInput}
                          lonInput={geoLonInput}
                          labelInput={geoLabelInput}
                          latInputRef={geoLatInputRef}
                          setLatInput={setGeoLatInput}
                          setLonInput={setGeoLonInput}
                          setLabelInput={setGeoLabelInput}
                          latError={geoLatError}
                          lonError={geoLonError}
                          onConfirm={confirmGeoPoint}
                          onCancel={cancelGeoPoint}
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
                      {isGeoreferenceMode && !pendingGeoPoint && (
                        <div className="absolute left-3 top-3 rounded-lg border border-status-orange/50 bg-surface-deepest/95 px-3 py-2 z-20 pointer-events-none">
                          <p className="text-xs text-status-orange">
                            Click on the map to place a georeference control point
                          </p>
                        </div>
                      )}

                      {/* View toggle (§8.D-style). Only offered once a
                          basemap is actually configured, and hidden for good
                          the moment one fails -- see handleBasemapUnavailable
                          and venuemapmodal.tsx's identical gate. */}
                      {isBasemapConfigured() && !basemapFailed && (
                        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-surface-liner bg-surface-deepest/90 p-0.5 backdrop-blur">
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => setViewMode('raster')}
                            className="px-2.5 text-xs bg-accent text-accent-foreground"
                          >
                            Venue image
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => setViewMode('basemap')}
                            className="px-2.5 text-xs bg-transparent text-surface-faint"
                          >
                            Map
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bottom Info Bar - Now OUTSIDE and BELOW the image container */}
                    <Card
                      isBlurred
                      className="border-2 border-default-200 bg-transparent w-full px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPinned className="h-4 w-4 text-accent" />
                          <span className="text-xs text-surface-light truncate max-w-[120px]">{mapFileName}</span>
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => fileInputRef.current?.click()}
                            startContent={<Upload className="h-3 w-3" />}
                            className="ml-2"
                          >
                            Replace
                          </Button>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            isDisabled={currentLayer <= 0}
                            onPress={() => setCurrentLayer(currentLayer - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span
                            className="text-xs text-surface-light min-w-[100px] text-center"
                          >
                            {venueData.layers?.[currentLayer]?.name || 'Layer'}
                          </span>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            isDisabled={!venueData.layers || currentLayer >= venueData.layers.length - 1}
                            onPress={() => setCurrentLayer(currentLayer + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={deleteLayer}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            data-testid="add-layer-button"
                            onPress={() => setIsNewLayerModalOpen(true)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                ) : (
                  <Card
                    isBlurred
                    className="border-2 border-default-200 bg-transparent w-full h-full px-3 py-2 relative"
                  >
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-full w-full flex-col items-center justify-center gap-3 text-surface-light/70 transition hover:border-status-blue/50 hover:text-status-blue rounded-xl"
                    >
                      <Upload className="h-12 w-12" />
                      <div className="text-center">
                        <p className="text-sm font-medium">Upload Venue Map</p>
                        <p className="mt-1 text-xs text-surface-light/50">
                          Optional - Click to select an image
                        </p>
                      </div>
                    </button>
                    {/* Reachable here too: this dropzone only renders when the
                        operator explicitly chose "Venue image" with nothing
                        uploaded yet (the no-image default already routes to
                        the basemap panel above -- see the viewMode
                        initializer), and without this they'd have no way back
                        to the map short of a page reload. */}
                    {isBasemapConfigured() && !basemapFailed && (
                      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-surface-liner bg-surface-deepest/90 p-0.5 backdrop-blur">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setViewMode('raster')}
                          className="px-2.5 text-xs bg-accent text-accent-foreground"
                        >
                          Venue image
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setViewMode('basemap')}
                          className="px-2.5 text-xs bg-transparent text-surface-faint"
                        >
                          Map
                        </Button>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </Panel>
          </PanelGroup>
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
