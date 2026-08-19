// Builds the MapLibre style document for the basemap view — TAK plan §8.A/§8.C.
//
// Layer order here is the whole design, so it is worth stating plainly:
//
//   1. Protomaps base layers   (land, water, roads, buildings)
//   2. the venue raster        (the PNG operators already know, georeferenced)
//   3. Protomaps LABEL layers  (street and place names)
//
// Labels go ON TOP of the venue raster deliberately. Putting the raster over
// everything would bury exactly the context the basemap was added for — a
// dispatcher who can see the venue image but not the name of the street it sits
// on has gained nothing. Since the raster is usually a map screenshot itself,
// its own baked-in labels and these will sometimes both be visible; that is
// still strictly more legible than a raster that hides the live ones, and it is
// the reason the raster layer carries an adjustable opacity.
//
// §8.C's one-way boundary is enforced by what this module does NOT do: it
// accepts corner coordinates that geoUtils computed and hands them to MapLibre.
// It never asks MapLibre to convert an image percentage into a coordinate.

import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';
import {
  BASEMAP_SOURCE_ID,
  VENUE_RASTER_LAYER_ID,
  VENUE_RASTER_SOURCE_ID,
  type BasemapConfig,
} from './config';

/** Corner coordinates in MapLibre ImageSource order: tl, tr, br, bl, [lon, lat].
 *  Produced by geoUtils.layerImageCorners — never constructed here. */
export type CornerCoordinates = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

export interface BuildStyleOptions {
  config: BasemapConfig;
  /** 'dark' follows the app's dark surface palette; 'light' matches most
   *  venue-map screenshots, which are light. */
  theme: 'light' | 'dark';
  /** Omit to render the basemap with no venue overlay — the correct behaviour
   *  for a layer that has no map image, or no georeference to place it with. */
  raster?: {
    url: string;
    coordinates: CornerCoordinates;
  };
}

/**
 * Split the Protomaps layer list into "everything below labels" and "labels".
 *
 * `layers(..., { labelsOnly: true })` returns exactly the label subset, so the
 * base subset is the full list minus those ids. Deriving it by subtraction
 * rather than by pattern-matching layer names means a Protomaps release that
 * renames or adds a label layer cannot quietly leave a label stranded
 * underneath the raster.
 */
function splitLayers(theme: 'light' | 'dark'): {
  base: LayerSpecification[];
  labels: LayerSpecification[];
} {
  const flavor = namedFlavor(theme);
  const all = layers(BASEMAP_SOURCE_ID, flavor, { lang: 'en' });
  const labels = layers(BASEMAP_SOURCE_ID, flavor, { lang: 'en', labelsOnly: true });
  const labelIds = new Set(labels.map((l) => l.id));
  return {
    base: all.filter((l) => !labelIds.has(l.id)),
    labels,
  };
}

/**
 * Resolve a possibly-root-relative asset URL to an absolute one.
 *
 * MapLibre validates the style's `sprite` field against the style spec and
 * rejects anything that is not absolute ("Invalid sprite URL ..., must be
 * absolute"), so `/basemap/sprites/light` — the natural way to write a
 * same-origin path, and what config.ts defaults to — fails style validation
 * before a single tile is requested. The defaults deliberately stay relative
 * because config.ts is SSR-safe and must not touch `window`; absolutising
 * happens here instead, which only ever runs in the browser from BasemapView.
 *
 * Left untouched when there is no `window` (so this stays safe to call from a
 * test or a server render) or when the URL already carries a scheme.
 */
function absoluteUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return url;
  // Deliberately string concatenation rather than `new URL(url, origin)`: the
  // glyphs value is a TEMPLATE carrying `{fontstack}` and `{range}`, and URL()
  // percent-encodes the braces to %7B/%7D. MapLibre substitutes into the raw
  // template string, so after encoding the placeholders no longer match, and
  // every label silently fails to load while the map itself looks fine.
  const base = window.location.origin;
  return url.startsWith('/') ? base + url : `${base}/${url}`;
}

/** Background colour under the tiles, matched to the app's surface palette so a
 *  slow tile load does not flash white in a dark dispatch room. */
const BACKDROP: Record<'light' | 'dark', string> = {
  light: '#f8f9fa',
  dark: '#0b0d0f',
};

export function buildBasemapStyle({
  config,
  theme,
  raster,
}: BuildStyleOptions): StyleSpecification {
  const { base, labels } = splitLayers(theme);

  const style: StyleSpecification = {
    version: 8,
    glyphs: absoluteUrl(config.glyphsUrl),
    sprite: absoluteUrl(config.spriteUrl),
    sources: {
      [BASEMAP_SOURCE_ID]: {
        type: 'vector',
        // The pmtiles:// scheme is resolved by the protocol handler registered
        // in BasemapView. Registering it is a hard prerequisite: without it
        // MapLibre treats this as an unknown scheme and the source never loads.
        url: `pmtiles://${absoluteUrl(config.pmtilesUrl)}`,
        attribution: config.attribution,
      },
    },
    layers: [
      {
        id: 'backdrop',
        type: 'background',
        paint: { 'background-color': BACKDROP[theme] },
      },
      ...base,
    ],
  };

  if (raster) {
    style.sources[VENUE_RASTER_SOURCE_ID] = {
      type: 'image',
      url: raster.url,
      coordinates: raster.coordinates,
    };
    style.layers.push({
      id: VENUE_RASTER_LAYER_ID,
      type: 'raster',
      source: VENUE_RASTER_SOURCE_ID,
      paint: {
        'raster-opacity': 0.85,
        // Nearest-neighbour would alias badly on a screenshot-derived raster
        // being stretched across a rotated affine placement.
        'raster-resampling': 'linear',
        'raster-fade-duration': 0,
      },
    });
  }

  style.layers.push(...labels);

  return style;
}
