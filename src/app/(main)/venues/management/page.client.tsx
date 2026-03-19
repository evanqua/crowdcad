// app/venues/management/page.client.tsx

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { db } from '@/app/firebase';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  type StorageReference,
} from 'firebase/storage';
import type { Post, Venue, Equipment, EquipmentStatus, Layer } from '@/app/types';
import { DiagonalStreaksFixed } from "@/components/ui/diagonal-streaks-fixed";
import NewLayerModal from '@/components/modals/venue/newlayer';
import LocationEditModal from '@/components/modals/venue/locationedit';
import {
  Button,
  Input,
  ButtonGroup,
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
  MousePointer2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';


// Props: none required for this page

interface EquipmentWithLocation extends Equipment {
  locationId?: string;
}

export default function VenueManagementPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const venueId = searchParams.get('venueId');
  // Firebase
  const auth = useMemo(() => getAuth(), []);
  const storage = useMemo(() => getStorage(), []);
  const userId = auth.currentUser?.uid;

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

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

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
  }, [mapFile, pendingLayer, currentLayer, venueData.layers]);

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
          const venueDoc = await getDoc(doc(db, 'venues', venueId));
          if (venueDoc.exists()) {
            const venue = venueDoc.data() as Venue & { layers?: Layer[] };
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

  // Handle zoom
    // Handle zoom (disabled for wheel/trackpad - use buttons only)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Prevent default scroll behavior but don't zoom
    e.preventDefault();
  };


  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAddMarkerMode || draggingIdx !== null) return;

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

    // Calculate new position
    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;

    // Clamp position to keep image within view
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

  // Handle map click for marker placement
  const handleImageClick = (evt: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddMarkerMode || isPanning) return;

    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();

    // Check if click is within image bounds
    if (
      evt.clientX < rect.left ||
      evt.clientX > rect.right ||
      evt.clientY < rect.top ||
      evt.clientY > rect.bottom
    ) {
      return;
    }

    const xPercent = ((evt.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((evt.clientY - rect.top) / rect.height) * 100;

    const x = Math.max(0, Math.min(100, xPercent));
    const y = Math.max(0, Math.min(100, yPercent));

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
      return;
    }

    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      const copy = [...newLayers[pendingMarker.layerIdx].posts];
      const currentPost = copy[pendingMarker.postIdx];
      if (typeof currentPost !== 'string') {
        copy[pendingMarker.postIdx] = { ...currentPost, name };
      }
      newLayers[pendingMarker.layerIdx] = { ...newLayers[pendingMarker.layerIdx], posts: copy };
      return { ...prev, layers: newLayers };
    });

    setPendingMarker(null);
    setMarkerNameInput('');
  };

  // Cancel marker placement
  const cancelMarkerName = () => {
    if (pendingMarker) {
      removePost(pendingMarker.layerIdx, pendingMarker.postIdx);
    }
    setPendingMarker(null);
    setMarkerNameInput('');
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

  const handleEditLocation = (name: string, newLayerIdx: number) => {
    if (!editingLocation) return;
    const { layerIdx, postIdx } = editingLocation;
    setVenueData((prev) => {
      const newLayers = [...prev.layers];
      const post = newLayers[layerIdx].posts[postIdx];
      if (typeof post === 'string') return prev;
      if (newLayerIdx !== layerIdx) {
        // Move to new layer
        const newPost = { ...post, name };
        newLayers[layerIdx].posts.splice(postIdx, 1);
        newLayers[newLayerIdx].posts.push(newPost);
      } else {
        // Same layer, just rename
        newLayers[layerIdx].posts[postIdx] = { ...post, name };
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
        const nx = ((e.clientX - rect.left) / rect.width) * 100;
        const ny = ((e.clientY - rect.top) / rect.height) * 100;
        const x = Math.max(0, Math.min(100, nx));
        const y = Math.max(0, Math.min(100, ny));

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
              <MapPin className="h-4 w-4 text-accent" strokeWidth={2.5} />
            </div>
            {isHover && !isPending && post.name && (
              <div
                style={{ left: `calc(${post.x}% - 50px)`, top: `calc(${post.y}% - 40px)` }}
                className="pointer-events-none absolute z-20 rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-white shadow-lg border border-default whitespace-nowrap"
              >
                {post.name}
              </div>
            )}
          </React.Fragment>
        );
      });
  };

  // Upload w/ retry
  const uploadWithRetry = async (
    storageRef: StorageReference,
    file: File,
    maxRetries = 3,
    baseDelay = 1200
  ): Promise<string> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await uploadBytes(storageRef, file);
        return await getDownloadURL(storageRef);
      } catch (err: unknown) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? (err as { code?: unknown }).code
            : undefined;

        const isRetryable =
          code === 'storage/retry-limit-exceeded' ||
          code === 'storage/unknown' ||
          code === 'storage/canceled' ||
          code === 'storage/quota-exceeded' ||
          code === 'storage/unauthenticated';

        if (attempt < maxRetries - 1 && isRetryable) {
          const wait = baseDelay * Math.pow(2, attempt);
          await new Promise((res) => setTimeout(res, wait));
          continue;
        }

        throw new Error('Upload failed');
      }
    }
    throw new Error('Max retries exceeded');
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

    setIsUploading(true);
    try {
      let newMapUrl: string | undefined;

      if (mapFile && mapFile.size > 0) {
        const storageRef = ref(storage, `venue_maps/${Date.now()}_${mapFile.name}`);
        newMapUrl = await uploadWithRetry(storageRef, mapFile);
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

      if (venueId) {
        // Update existing venue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateDoc(doc(db, 'venues', venueId), dataToSave as any);
      } else {
        // Create new venue
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await addDoc(collection(db, 'venues'), dataToSave as any);
      }
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
      const storageRef = ref(storage, `venue_maps/${Date.now()}_${file.name}`);
      const mapUrl = await uploadWithRetry(storageRef, file);
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

  return (
    <main className="relative bg-surface-deepest text-white h-[calc(10-0vh-3rem)]">
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
            onChange={(e) => {
              setMapFile(e.target.files?.[0] ?? null);
              setPendingLayer(currentLayer);
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
                        label: 'text-white font-medium',
                        inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
                        input: 'text-white outline-none focus:outline-none data-[focus=true]:outline-none',
                      }}
                    />
                  </div>

                  {/* Locations & Equipment Section with Tabs */}
                  <Tabs className="flex-1 w-full" fullWidth radius="lg" selectedKey={selectedLeftTab} onSelectionChange={(key) => setSelectedLeftTab(key as string)}>
                    <Tab key="locations" title="Locations">
                      <label className="mb-2 block text-sm font-medium text-white">
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
                            input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                            inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
                          }}
                        />
                        <Button
                          isIconOnly
                          onPress={addTextLocation}
                          className="flex-shrink-0 bg-accent hover:bg-accent/90 text-white"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {allPosts.length > 0 && (
                        <ScrollShadow className="mt-3 space-y-2 pr-2 max-h-[calc(100vh-430px)] scrollbar-hide">
                          {allPosts.map((item, idx) => {
                            const post = item.post;
                            const label = typeof post === 'string' ? post : post.name;
                            const hasCoordinates = typeof post === 'object' && post.x !== null && post.y !== null;
                            const isPending = pendingMarker?.layerIdx === item.layerIdx && pendingMarker?.postIdx === item.postIdx;

                            return (
                              <Card
                                key={idx}
                                isBlurred
                                className="border-2 rounded-2xl border-default-200 bg-transparent"
                              >
                                <div className="flex items-center justify-between px-3 py-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {hasCoordinates ? (
                                      <MapPinned className="h-4 w-4 flex-shrink-0 text-accent" />
                                    ) : (
                                      <MapPin className="h-4 w-4 flex-shrink-0 text-surface-light" />
                                    )}
                                    <span className={`text-sm truncate ${isPending ? 'text-status-blue italic' : 'text-white'}`}>
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
                              </Card>
                            );
                          })}
                        </ScrollShadow>
                      )}
                    </Tab>
                    <Tab key="equipment" title="Equipment">
                      <label className="mb-2 block text-sm font-medium text-white">
                        Equipment <span className="text-surface-light text-xs">(Optional)</span>
                      </label>
                      <div className="flex gap-2 mb-3">
                        <Input
                          placeholder="e.g., Gurney 1"
                          value={equipmentInput}
                          onValueChange={setEquipmentInput}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addEquipment();
                            }
                          }}
                          variant="flat"
                          classNames={{
                            input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                            inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
                          }}
                        />
                        <Button
                          isIconOnly
                          onPress={addEquipment}
                          className="flex-shrink-0 bg-accent hover:bg-accent/90 text-white"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {venueData.equipment.length > 0 && (
                        <ScrollShadow className="space-y-2 pr-2 max-h-[calc(100vh-430px)] scrollbar-hide">
                          {venueData.equipment.map((item, idx) => (
                            <Card
                              key={idx}
                              isBlurred
                              className="border-2 rounded-2xl border-default-200 bg-transparent"
                            >
                              <div className="flex items-center justify-between px-3 py-2">
                                {editingEquipmentIndex === idx ? (
                                  <>
                                    <Input
                                      value={equipmentEditInput}
                                      onValueChange={setEquipmentEditInput}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          saveEquipmentEdit();
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          cancelEquipmentEdit();
                                        }
                                      }}
                                      variant="flat"
                                      size="sm"
                                      autoFocus
                                      classNames={{
                                        input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                                        inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep',
                                      }}
                                    />
                                    <div className="flex items-center gap-1 ml-2">
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="success"
                                        onPress={saveEquipmentEdit}
                                        className="min-w-6 w-6 h-6 flex-shrink-0"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={cancelEquipmentEdit}
                                        className="min-w-6 w-6 h-6 flex-shrink-0"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-sm text-white truncate">
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={() => startEditEquipment(idx)}
                                        className="min-w-6 w-6 h-6 flex-shrink-0"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        onPress={() => removeEquipment(idx)}
                                        className="min-w-6 w-6 h-6 flex-shrink-0"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </Card>
                          ))}
                        </ScrollShadow>
                      )}
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
                    className="flex-1 bg-accent hover:bg-accent/90 text-white px-10"
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
                  <label className="text-sm font-medium text-white">
                    Venue Map <span className="text-surface-light text-xs">(Optional)</span>
                  </label>
                  <Input
                    value={venueData.layers[currentLayer].name}
                    onValueChange={updateLayerName}
                    variant="flat"
                    size="md"
                    classNames={{
                      input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                      inputWrapper: 'rounded-2xl px-4 pr-6 hover:bg-surface-deep',
                    }}
                    placeholder="Layer name"
                  />
                </div>
                {previewUrl && (
                  <div className="flex gap-2">
                    <Button
                      size="md"
                      variant={isAddMarkerMode ? 'solid' : 'bordered'}
                      color={isAddMarkerMode ? 'primary' : 'default'}
                      onPress={() => setIsAddMarkerMode(!isAddMarkerMode)}
                      startContent={isAddMarkerMode ? <MousePointer2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                      className={isAddMarkerMode ? 'bg-accent hover:bg-accent/90' : ''}
                    >
                      {isAddMarkerMode ? 'Click to Place' : 'Add Markers'}
                    </Button>
                  </div>
                )}
              </div>

              <div 
                className={`rounded-xl relative flex flex-col items-center justify-start w-full ${previewUrl ? 'max-h-[calc(100vh-180px)]' : 'h-full'}`}
              >
                {previewUrl ? (
                  <div className="w-full flex flex-col gap-3 max-h-full">
                    <div className="relative w-full overflow-hidden rounded-2xl">
                      <div 
                        ref={imgContainerRef}
                        className="relative overflow-auto scrollbar-hide"
                        onWheel={handleWheel}
                        style={{ 
                          cursor: isAddMarkerMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
                          maxHeight: 'calc(100vh - 200px)',
                        }}
                      >
                        <div
                          className="relative inline-block"
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
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
                            </div>
                          </div>
                        </div>
                      </div>

                      {pendingMarker && (
                        <div
                          className="fixed z-30 w-52 rounded-lg border border-status-blue bg-surface-deepest p-3 shadow-xl"
                          style={{
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <p className="mb-2 text-xs font-medium text-white">Name this location:</p>
                          <Input
                            ref={markerInputRef}
                            value={markerNameInput}
                            onValueChange={setMarkerNameInput}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                confirmMarkerName();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelMarkerName();
                              }
                            }}
                            placeholder="Location name"
                            size="sm"
                            variant="bordered"
                            classNames={{
                              input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                              inputWrapper: 'px-4 hover:bg-surface-deep mb-2',
                            }}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={cancelMarkerName}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onPress={confirmMarkerName}
                              className="flex-1 bg-accent hover:bg-accent/90 text-white"
                            >
                              Confirm
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Zoom Controls - Top Right */}
                      <div className="absolute top-3 right-3 flex flex-row gap-1 z-20">
                        <ButtonGroup>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            onPress={() => setScale(prev => Math.min(prev + 0.5, 5))}
                            className="bg-surface-deepest/95"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            onPress={() => setScale(prev => Math.max(prev - 0.5, 1))}
                            className="bg-surface-deepest/95"
                          >
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                        </ButtonGroup>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => {
                            setScale(1);
                            setPosition({ x: 0, y: 0 });
                          }}
                          className="bg-surface-deepest/95 text-xs px-2"
                        >
                          Reset
                        </Button>
                      </div>

                      {/* Instructions overlay - Top Left */}
                      {isAddMarkerMode && !pendingMarker && (
                        <div className="absolute left-3 top-3 rounded-lg border border-status-blue/50 bg-surface-deepest/95 px-3 py-2 z-20 pointer-events-none">
                          <p className="text-xs text-status-blue">
                            Click on the map to place a location marker
                          </p>
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
                    className="border-2 border-default-200 bg-transparent w-full h-full px-3 py-2"
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
        layers={venueData.layers}
      />
    </main>
  );
}
