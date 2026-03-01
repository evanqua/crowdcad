// components/EditVenueModal.tsx

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

import { getAuth } from 'firebase/auth';
import { db } from '@/app/firebase';
import {
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  type StorageReference,
} from 'firebase/storage';

import type { Post, Venue, Equipment, EquipmentStatus } from '@/app/types';
import LoadingScreen from '@/components/ui/loading-screen';

interface Props {
  venueId: string;
  onClose: () => void;
  onSaved?: () => void;
}

type CoordinatePost = { name: string; x: number; y: number };

export default function EditVenueModal({ venueId, onClose, onSaved }: Props) {
  // Firebase
  const auth = useMemo(() => getAuth(), []);
  const storage = useMemo(() => getStorage(), []);
  const userId = auth.currentUser?.uid;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgWrapperRef = useRef<HTMLDivElement | null>(null);

  // Local state mirrors CreateVenueModal structure
  const [venueData, setVenueData] = useState<{
    name: string;
    equipment: Equipment[];
    posts: Post[];
    mapUrl?: string | null;
  }>({
    name: '',
    equipment: [],
    posts: [],
    mapUrl: undefined,
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Inputs
  const [equipmentInput, setEquipmentInput] = useState('');
  const [postsInput, setPostsInput] = useState('');
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Drag/hover state for markers
  const [, setDraggingIdx] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load venue data
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const refDoc = doc(db, 'venues', venueId);
        const snap = await getDoc(refDoc);
        if (!snap.exists()) {
          alert('Venue not found');
          onClose();
          return;
        }
        if (!isMounted) return;
        const data = snap.data() as Venue;

        setVenueData({
          name: data.name ?? '',
          equipment: Array.isArray(data.equipment) ? data.equipment as Equipment[] : [],
          posts: Array.isArray(data.posts) ? data.posts as Post[] : [],
          mapUrl: data.mapUrl ?? null,
        });

        // Show existing map as preview
        setPreviewUrl(data.mapUrl ?? null);
      } catch (e) {
        console.error('Error loading venue:', e);
        alert('Failed to load venue');
        onClose();
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [venueId, onClose]);

  // Update preview when a new map file is selected
  useEffect(() => {
    if (mapFile) {
      const url = URL.createObjectURL(mapFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    // if no new file, preview the current venue map
    setPreviewUrl(venueData.mapUrl || null);
  }, [mapFile, venueData.mapUrl]);

  // Capture the actual node rendered by Next/Image
  const bindImgElement = () => {
    if (!imgWrapperRef.current) return;
    const imgEl = imgWrapperRef.current.querySelector('img');
    if (imgEl) imgRef.current = imgEl as HTMLImageElement;
  };

  // File name from mapFile or mapUrl
  const mapFileName = useMemo(() => {
    if (mapFile?.name) return mapFile.name;
    if (venueData.mapUrl) {
      try {
        const u = new URL(venueData.mapUrl);
        const last = u.pathname.split('/').pop() || '';
        return decodeURIComponent(last);
      } catch {
        const s = venueData.mapUrl.split('?')[0];
        return decodeURIComponent(s.substring(s.lastIndexOf('/') + 1));
      }
    }
    return '';
  }, [mapFile, venueData.mapUrl]);

  // Controlled form change
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const { name, value } = e.target;
    setVenueData((prev) => ({ ...prev, [name]: value }));
  };

  // Equipment management
  const addEquipment = () => {
    const name = equipmentInput.trim();
    if (!name) return;
    const newItem: Equipment = {
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

  // Posts: allow text-only when no image or when user prefers text
  const addTextPost = () => {
    const val = postsInput.trim();
    if (!val) return;
    setVenueData((prev) => ({ ...prev, posts: [...prev.posts, val] }));
    setPostsInput('');
  };

  const removePost = (index: number) => {
    setVenueData((prev) => ({
      ...prev,
      posts: prev.posts.filter((_, i) => i !== index),
    }));
  };

  const renamePost = (idx: number) => {
    const p = venueData.posts[idx];
    if (typeof p === 'string') return;
    const next = window.prompt('Edit post name:', p.name);
    if (next == null) return;
    setVenueData((prev) => {
      const copy = [...prev.posts];
      const cur = copy[idx];
      if (typeof cur === 'string') return prev;
      copy[idx] = { ...cur, name: next.trim() || cur.name };
      return { ...prev, posts: copy };
    });
  };

  // Click on image to add coordinate post (matching CreateVenueModal)
  const handleImageClick: React.MouseEventHandler<HTMLImageElement> = (evt) => {
    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const xPercent = ((evt.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((evt.clientY - rect.top) / rect.height) * 100;

    const postName = window.prompt('Enter post location name:');
    if (!postName) return;

    const newPost: CoordinatePost = {
      name: postName.trim(),
      x: Math.max(0, Math.min(100, xPercent)),
      y: Math.max(0, Math.min(100, yPercent)),
    };

    setVenueData((prev) => ({ ...prev, posts: [...prev.posts, newPost] }));
  };

  // Drag markers (matching CreateVenueModal)
  const onMarkerMouseDown =
    (idx: number) => (evt: React.MouseEvent) => {
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
          const copy = [...prev.posts];
          const cur = copy[idx];
          if (typeof cur === 'string') return prev;
          copy[idx] = { ...cur, x, y };
          return { ...prev, posts: copy };
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
    return venueData.posts
      .filter((p): p is CoordinatePost => typeof p === 'object' && p !== null && 'x' in p && 'y' in p)
      .map((post, idx) => {
        const left = `calc(${post.x}% - 8px)`;
        const top = `calc(${post.y}% - 8px)`;
        const isHover = hoverId === idx;

        return (
          <div
            key={`marker-${idx}`}
            className="pointer-events-none absolute"
            style={{ left, top }}
          >
            <button
              type="button"
              className="pointer-events-auto h-4 w-4 rounded-full border-2 border-white bg-status-blue shadow cursor-move"
              title={post.name}
              onMouseEnter={() => setHoverId(idx)}
              onMouseLeave={() => setHoverId((cur) => (cur === idx ? null : cur))}
              onMouseDown={onMarkerMouseDown(idx)}
              onDoubleClick={() => renamePost(idx)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                renamePost(idx);
              }}
            />
            {isHover && (
              <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/80 px-2 py-1 text-xs text-white shadow">
                {post.name}
              </div>
            )}
          </div>
        );
      });
  };

  // Robust upload with retry
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

  // Save (update existing venue)
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    if (!userId) {
      alert('You must be logged in to save changes');
      return;
    }
    if (!venueData.name.trim()) {
      alert('Please enter a venue name');
      return;
    }

    setIsSaving(true);
    try {
      let mapUrl = venueData.mapUrl ?? null;

      if (mapFile && mapFile.size > 0) {
        const storageRef = ref(storage, `venue_maps/${Date.now()}_${mapFile.name}`);
        mapUrl = await uploadWithRetry(storageRef, mapFile);
      }

      const updates: Partial<Venue> = {
        name: venueData.name.trim(),
        equipment: venueData.equipment,
        posts: venueData.posts,
        mapUrl: mapUrl ?? undefined,
        ...(userId ? { userId } : {}),
      };

      await updateDoc(doc(db, 'venues', venueId), updates);

      onSaved?.();
      onClose();
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
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="rounded-lg bg-surface-deepest p-8">
          <LoadingScreen variant="section" label="Loading venue…" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      tabIndex={-1}
    >
      <div
        className="mx-4 w-full max-w-6xl rounded-2xl bg-surface-deepest text-white shadow-2xl"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Hidden file input for map upload/replace */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setMapFile(e.target.files?.[0] ?? null)}
        />

        {/* Header (sticky) */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface-deepest/95 px-6 py-3 backdrop-blur">
          <h2 className="text-lg font-semibold">Edit Venue</h2>
          <button
            onClick={onClose}
            className="rounded py-1 text-white hover:text-status-blue"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-5">
          {/* Left column: Controls (2/5) */}
          <form onSubmit={handleSubmit} className="md:col-span-2 flex flex-col gap-4">
            {/* Venue name */}
            <label className="text-sm text-gray-300">
              Venue Name
              <input
                type="text"
                name="name"
                value={venueData.name}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border border-surface-faint bg-surface-deepest px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-status-blue"
                placeholder="Main Stage"
              />
            </label>

            {/* Equipment */}
            <div>
              <div className="mb-2 text-sm text-gray-300">Add Equipment</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={equipmentInput}
                  onChange={(e) => setEquipmentInput(e.target.value)}
                  className="flex-1 text-sm rounded-md border border-surface-faint bg-surface-deepest px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-status-blue"
                  placeholder="Gurney 1"
                />
                <button
                  type="button"
                  onClick={addEquipment}
                  className="rounded bg-status-blue px-3 py-2 text-white font-bold hover:bg-status-blue/90"
                >
                  ╋
                </button>
              </div>

              {venueData.equipment.length > 0 && (
                <div className="mt-3">
                  <div className="mb-2 text-sm text-gray-300">Current Equipment</div>
                  <div className="flex flex-wrap gap-2">
                    {venueData.equipment.map((item, idx) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-deep px-2 text-sm"
                        title={item.name}
                      >
                        <span className="whitespace-nowrap">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => removeEquipment(idx)}
                          aria-label={`Remove ${item.name}`}
                          className="grid h-5 w-3 place-items-center rounded-full text-surface-light/80 hover:text-accent"
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Text-only posts if no map */}
            {!previewUrl && (
              <div>
                <div className="mb-2 text-sm text-gray-300">Add Post Locations</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={postsInput}
                    onChange={(e) => setPostsInput(e.target.value)}
                    className="flex-1 text-sm border border-surface-faint rounded-md bg-surface-deepest px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-status-blue"
                    placeholder="Stage Right Pit"
                  />
                  <button
                    type="button"
                    onClick={addTextPost}
                    className="rounded bg-status-blue px-3 py-2 font-bold text-white hover:bg-status-blue/90"
                  >
                    ╋
                  </button>
                </div>
              </div>
            )}

            {/* Current Posts (pill tags) */}
            {venueData.posts.length > 0 && (
              <div>
                <div className="mb-2 text-sm text-gray-300">Current Posts</div>
                <div className="flex flex-wrap gap-2">
                  {venueData.posts.map((post, idx) => {
                    const label = typeof post === 'string' ? post : post.name;
                    
                    // 1. Narrowing check: Determine if coordinates are definitely numbers.
                    const hasCoordinates = 
                      typeof post === 'object' && 
                      post !== null && 
                      post.x !== null && 
                      post.y !== null;

                    // 2. Safe Key Generation: Use type assertion/casting within the safe block
                    const postKey = hasCoordinates
                      ? // We can now safely cast post.x and post.y to number because of the check above.
                        `p-${idx}-${post.name}-${Math.round(post.x as number)}-${Math.round(post.y as number)}`
                      : // Fallback key
                        `t-${idx}-${label}`; 

                    return (
                      <span
                        key={postKey} // Use the new safe key
                        className={`inline-flex items-center gap-1 rounded-full px-2 text-sm ${
                          hasCoordinates ? 'bg-status-blue/20 text-status-blue' : 'bg-surface-deep'
                        }`}
                        title={label}
                      >
                        <button
                          type="button"
                          className="whitespace-nowrap hover:underline"
                          onClick={() => typeof post !== 'string' && renamePost(idx)}
                          title={typeof post !== 'string' ? 'Rename' : undefined}
                        >
                          {label}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePost(idx)}
                          aria-label={`Remove ${label}`}
                          className="grid h-5 w-3 place-items-center rounded-full text-surface-light/80 hover:text-accent"
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded bg-status-blue px-4 py-2 text-white hover:bg-status-blue/90 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Right column: Map (3/5) */}
          <div className="md:col-span-3">
            {previewUrl ? (
              <div>
                <p className="mb-2 text-sm text-white/80">
                  Click on the image to add a post at that location.
                </p>

                {/* Click-capture layer wraps Image + markers */}
                <div className="relative inline-block w-full">
                  <div ref={imgWrapperRef} onLoad={bindImgElement}>
                    <Image
                      src={previewUrl}
                      alt="Venue map"
                      width={1600}
                      height={1000}
                      onClick={handleImageClick}
                      className="w-full h-auto rounded-lg cursor-crosshair select-none"
                      draggable={false}
                    />
                  </div>
                  {renderMarkers()}
                </div>

                {/* File name + Replace */}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="truncate text-sm text-surface-light/90">
                    {mapFileName || 'Current map'}
                  </div>
                  <button
                    type="button"
                    className="rounded bg-surface-deep px-3 py-1 text-sm hover:bg-surface/80"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace Map
                  </button>
                </div>
              </div>
            ) : (
              // No map: big square "+" button spanning map area
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-surface-faint text-surface-light/70 transition hover:border-status-blue/70 hover:text-status-blue"
                title="Upload a venue map"
              >
                <span className="text-6xl leading-none">+</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}