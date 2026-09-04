// components/modals/venue/geojsonimport.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import { AlertTriangle, MapPin, Trash2, Upload } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import type { GeoBounds, Post } from "@/app/types";
import { geoJsonToPosts, isGeoJsonFeatureCollection } from "@/lib/markerUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, imageFile: File, posts: Post[], geoBounds: GeoBounds) => void;
};

type CoordinatedPost = { name: string; x: number; y: number };

function isCoordinatedPost(post: Post): post is CoordinatedPost {
  return typeof post === "object" && post !== null && post.x !== null && post.y !== null;
}

export default function GeoJsonImportModal({ isOpen, onClose, onSubmit }: Props) {
  const [name, setName] = React.useState("");
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const [geoJsonFile, setGeoJsonFile] = React.useState<File | null>(null);
  const [parsedPosts, setParsedPosts] = React.useState<Post[] | null>(null);
  const [parsedBounds, setParsedBounds] = React.useState<GeoBounds | null>(null);
  const [skippedCount, setSkippedCount] = React.useState(0);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const geoJsonInputRef = React.useRef<HTMLInputElement>(null);

  const inputClassNames = {
    label: "text-surface-light mb-1",
    inputWrapper: "rounded-2xl px-4 hover:bg-surface-deep",
    input:
      "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
  } as const;

  React.useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleGeoJsonFile = async (file: File | null) => {
    setGeoJsonFile(file);
    setParsedPosts(null);
    setParsedBounds(null);
    setSkippedCount(0);
    setParseError(null);

    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!isGeoJsonFeatureCollection(json)) {
        setParseError("File is not a valid GeoJSON FeatureCollection");
        return;
      }
      const { posts, geoBounds, skipped } = geoJsonToPosts(json);
      if (posts.length === 0) {
        setParseError(
          "No usable point features found — each needs a name and Point geometry"
        );
        return;
      }
      setParsedPosts(posts);
      setParsedBounds(geoBounds);
      setSkippedCount(skipped);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Failed to parse GeoJSON file");
    }
  };

  const reset = () => {
    setName("");
    setImageFile(null);
    setGeoJsonFile(null);
    setParsedPosts(null);
    setParsedBounds(null);
    setSkippedCount(0);
    setParseError(null);
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleSubmit = () => {
    if (!name.trim() || !imageFile || !parsedPosts || !parsedBounds) return;
    onSubmit(name.trim(), imageFile, parsedPosts, parsedBounds);
    onClose();
    reset();
  };

  const canSubmit = !!name.trim() && !!imageFile && !!parsedPosts && !!parsedBounds;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      placement="center"
      backdrop="opaque"
      hideCloseButton
      radius="lg"
      size="2xl"
      classNames={{
        base: "rounded-2xl bg-surface-deepest text-surface-light",
        header: "pb-0",
        body: "py-4",
        footer: "pt-0",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="text-2xl font-bold text-surface">
              Import GIS Map
            </ModalHeader>

            <ModalBody>
              <Input
                label="Layer name"
                labelPlacement="outside-top"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={name}
                onValueChange={setName}
                aria-label="Layer name"
              />

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                data-testid="geojson-import-image-input"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={geoJsonInputRef}
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                className="hidden"
                data-testid="geojson-import-file-input"
                onChange={(e) => handleGeoJsonFile(e.target.files?.[0] ?? null)}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-light">
                    Background Image
                  </label>
                  {imageFile ? (
                    <div className="flex items-center gap-2 rounded-xl border border-default bg-surface-deep p-2">
                      <Upload className="ml-2 h-5 w-5 flex-shrink-0 text-accent" />
                      <span className="truncate text-sm text-surface-light">{imageFile.name}</span>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => setImageFile(null)}
                        className="ml-auto h-10 w-10 min-w-10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-default text-surface-light/70 transition hover:border-status-blue/50 hover:text-status-blue"
                    >
                      <Upload className="h-8 w-8" />
                      <p className="text-xs font-medium">Flattened map image</p>
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-light">
                    GeoJSON Points
                  </label>
                  {geoJsonFile ? (
                    <div className="flex items-center gap-2 rounded-xl border border-default bg-surface-deep p-2">
                      <MapPin className="ml-2 h-5 w-5 flex-shrink-0 text-accent" />
                      <span className="truncate text-sm text-surface-light">{geoJsonFile.name}</span>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => handleGeoJsonFile(null)}
                        className="ml-auto h-10 w-10 min-w-10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => geoJsonInputRef.current?.click()}
                      className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border border-default text-surface-light/70 transition hover:border-status-blue/50 hover:text-status-blue"
                    >
                      <MapPin className="h-8 w-8" />
                      <p className="text-xs font-medium">.geojson file</p>
                    </button>
                  )}
                </div>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 rounded-xl border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {parsedPosts && parsedBounds && (
                <div className="space-y-2">
                  <p className="text-xs text-surface-light/70">
                    {parsedPosts.length} point{parsedPosts.length === 1 ? "" : "s"} placed
                    {skippedCount > 0
                      ? ` · ${skippedCount} skipped (missing name or not a point)`
                      : ""}
                  </p>
                  {imagePreviewUrl && (
                    <div className="max-h-72 overflow-y-auto rounded-xl border border-default bg-surface-deep">
                      <div className="relative inline-block w-full">
                        <Image
                          src={imagePreviewUrl}
                          alt="Background map preview"
                          width={1200}
                          height={900}
                          unoptimized
                          className="block"
                          style={{ display: "block", width: "100%", height: "auto" }}
                        />
                        <div className="pointer-events-none absolute inset-0">
                          {parsedPosts.filter(isCoordinatedPost).map((post, idx) => (
                            <div
                              key={idx}
                              title={post.name}
                              style={{ left: `calc(${post.x}% - 8px)`, top: `calc(${post.y}% - 8px)` }}
                              className="absolute flex h-4 w-4 items-center justify-center rounded-full border-2 border-accent bg-accent/30"
                            >
                              <MapPin className="h-2.5 w-2.5 text-accent" strokeWidth={3} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-surface-light/50">
                    Check that markers line up with their real locations before importing — if they
                    look off, the GeoJSON&apos;s bbox likely doesn&apos;t match this image&apos;s extent.
                  </p>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onPress={handleSubmit}
                className="flex-1 bg-accent hover:bg-accent/90 text-surface-light"
                isDisabled={!canSubmit}
              >
                Import Layer
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
