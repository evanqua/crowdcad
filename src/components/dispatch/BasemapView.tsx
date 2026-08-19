'use client';

// BasemapView -- renders a real-world MapLibre GL basemap (roads, buildings,
// labels) underneath the venue's georeferenced raster overlay. TAK plan §8.
//
// ---------------------------------------------------------------------------
// Contract #1: degrade to nothing (§8.B), not to an error state
// ---------------------------------------------------------------------------
// This component's single most important behaviour is what it does when it
// CAN'T draw a basemap: it calls `onUnavailable(reason)` and renders `null`.
// Never a broken-map placeholder, never a grey box, never an error banner --
// the caller's job on `onUnavailable` is to fall back to the venue's existing
// raster-only map, and a half-drawn MapLibre canvas sitting on top of that
// fallback would be strictly worse than nothing. Every failure path in this
// file -- missing config, a rejected dynamic import, a 404'd pmtiles archive,
// any MapLibre `error` event -- funnels through the same `reportUnavailable`
// + teardown pair for exactly this reason. See the doc comment on
// `readBasemapConfig` in `lib/basemap/config.ts` for why the default,
// zero-config state is "no basemap" rather than "broken basemap": stadium
// connectivity is a premise of this project, not an edge case.
//
// ---------------------------------------------------------------------------
// Contract #2: the one-way coordinate boundary (§8.C)
// ---------------------------------------------------------------------------
// Every marker on this map is placed with `marker.setLngLat([lon, lat])` from
// a lat/lon this component was HANDED -- by `layerPostsLatLon`, by
// `team.tak`, by `call.position`, by the `deviceLocation` prop. Nothing in
// this file ever asks MapLibre to convert a pixel or an image-percentage
// into a coordinate, and nothing here re-derives a percentage from what
// MapLibre draws. `geoUtils.ts` is the sole authority for pixel <-> latlon
// conversion; this component is a pure consumer of its output on one side
// (drawing) and a pure producer of raw coordinates on the other (the
// placement click handler, which hands `e.lngLat` straight to `onMapClick`
// with no massaging). Breaking this boundary in either direction is how a
// coordinate silently drifts from what a phone actually reported.
//
// ---------------------------------------------------------------------------
// Why maplibre-gl is never imported at module scope
// ---------------------------------------------------------------------------
// maplibre-gl is this project's first heavy client dependency (~200KB
// gzipped). A deployment that never sets NEXT_PUBLIC_BASEMAP_PMTILES_URL
// (`readBasemapConfig() === null`, the documented default) must not pay for
// it at all -- not in the initial bundle, not lazily on a route that never
// renders this component. So `maplibre-gl`, its CSS, and `pmtiles` are only
// ever reached via `await import(...)` inside an effect that has already
// confirmed a basemap is configured. Every top-level import of `maplibre-gl`
// in this file is `import type`, which TypeScript erases entirely at
// compile time -- it costs nothing at runtime and exists purely so the
// handful of local variables that hold a live map/marker/module reference
// can be typed.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  Marker as MapLibreMarker,
} from 'maplibre-gl';
import type { CornerCoordinates } from '@/lib/basemap/style';
import { readBasemapConfig } from '@/lib/basemap/config';
import { buildBasemapStyle } from '@/lib/basemap/style';
import {
  layerImageCorners,
  layerPostsLatLon,
  METRES_PER_DEGREE_LATITUDE,
  solveGeoreference,
} from '@/lib/geoUtils';
import { deriveTeamVisualStatus, getStatusColor } from '@/lib/statusColors';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import type { Call, Equipment, Event, Layer, Staff } from '@/app/types';

/** The `maplibre-gl` module namespace, as returned by the dynamic import.
 *  Named separately from the `Map` class type above so call sites reading
 *  "the loaded library" vs. "a map instance" stay visually distinct. */
type MapLibreGlModule = typeof import('maplibre-gl');

export interface BasemapViewProps {
  /** The venue layer currently being viewed. Its `georeference` (if any)
   *  determines whether the venue raster overlays the basemap, and its
   *  `posts` are drawn as markers. */
  layer: Layer;
  /** Roster for the current event. Team positions are read from each
   *  member's `tak` field (a team's live GPS fix) -- not from `location`,
   *  which is a post name with no inherent coordinate. */
  staff: Staff[];
  /** Drawn only for items whose `location` matches a named post on `layer`
   *  that itself has a derivable lat/lon; every other item is skipped
   *  silently (§8.C -- there is no percent-space fallback here). */
  equipment?: Equipment[];
  /** Drawn for calls with a `position` on this layer. */
  calls?: Call[];
  /** 'dark' matches the app's dark dispatch surfaces; 'light' matches most
   *  venue-map screenshots, which tend to be light. */
  theme?: 'light' | 'dark';
  /** When true, clicking the map calls `onMapClick` with the clicked
   *  coordinate and the cursor becomes a crosshair. When false, clicks do
   *  nothing -- this is a deliberate armed/disarmed gate, not a permanent
   *  handler. */
  isPlacementArmed?: boolean;
  onMapClick?: (coord: { lat: number; lon: number }) => void;
  /** An unconfirmed pin -- e.g. mid-placement in Quick Call's "drop a pin"
   *  flow -- drawn with the same neutral styling `venuemapmodal.tsx` uses
   *  for a `Call`-less draft marker. */
  draftPin?: { lat: number; lon: number } | null;
  selectedCallId?: string | null;
  onSelectCall?: (callId: string) => void;
  /** The operator's own device position (browser Geolocation), drawn as a
   *  "you are here" dot plus a to-scale accuracy circle -- never a fixed-
   *  pixel halo, which would invent precision a GPS fix does not have. */
  deviceLocation?: { lat: number; lon: number; accuracy: number } | null;
  /** Called exactly once per failure reason (first failure wins) whenever
   *  this component cannot render a basemap for any reason -- see the
   *  degrade-to-nothing contract in the file header. The component always
   *  renders `null` in this state; callers do not need to inspect the
   *  reason to decide whether to fall back, only to log/report it. */
  onUnavailable?: (reason: string) => void;
  className?: string;
}

// --- pmtiles protocol registration, StrictMode-safe -------------------------
//
// `maplibregl.addProtocol('pmtiles', ...)` mutates a registry that is GLOBAL
// to the page, not scoped to one Map instance -- see pmtiles' own doc comment
// ("Must be added once globally") on its `Protocol` class. That is a problem
// in dev: `next.config.js` sets `reactStrictMode: true`, so every effect in
// this component runs mount -> cleanup -> mount once, synthetically, on
// first render. A naive `addProtocol` in the mount half and `removeProtocol`
// in the cleanup half would register the protocol, immediately deregister it,
// and then leave the SECOND (real, persisting) mount believing registration
// already happened -- or double-register and trigger whatever pmtiles does
// on a duplicate `add`.
//
// A module-level refcount closes that gap: each mounted BasemapView (StrictMode
// phantom or real) increments on the way in and decrements on the way out:
// only the transition 0->1 constructs a Protocol and calls `addProtocol`, and
// only the transition 1->0 calls `removeProtocol`. `pmtilesReadyPromise` -- a
// single in-flight promise shared by every concurrent caller -- exists so that
// if a second BasemapView mounts while the first is still awaiting `import
// ('pmtiles')`, the second caller awaits the SAME registration rather than
// racing to add its own (or, in the boolean-flag version of this refcount
// this file used to have during review, skipping registration entirely
// because it saw the count already at 1 without the protocol actually being
// registered yet).
let pmtilesRefCount = 0;
let pmtilesReadyPromise: Promise<void> | null = null;

async function registerPmtilesProtocol(mgl: MapLibreGlModule): Promise<void> {
  pmtilesRefCount += 1;
  if (!pmtilesReadyPromise) {
    pmtilesReadyPromise = (async () => {
      const { Protocol } = await import('pmtiles');
      const protocol = new Protocol();
      mgl.addProtocol('pmtiles', protocol.tile);
    })();
  }
  await pmtilesReadyPromise;
}

function unregisterPmtilesProtocol(mgl: MapLibreGlModule | null): void {
  pmtilesRefCount = Math.max(0, pmtilesRefCount - 1);
  if (pmtilesRefCount === 0) {
    pmtilesReadyPromise = null;
    mgl?.removeProtocol('pmtiles');
  }
}

// --- marker DOM construction -------------------------------------------------
//
// Each marker is a hand-built `HTMLDivElement`, not a mounted React tree.
// MapLibre's `Marker` takes a plain element and repositions it itself (via a
// CSS transform recomputed on every map move); layering a React root inside
// that element would mean managing two overlapping lifecycles -- React's and
// MapLibre's -- for content that never needs React's diffing, since a marker
// is fully rebuilt from scratch on every data change anyway (see the marker
// effect below). Tailwind utility classes work identically whether applied
// via JSX `className` or `element.className = ...`, so the visual result
// matches the rest of the dispatch UI for a fraction of the bookkeeping.
//
// Icon path data below is lucide-react's own (map-pin, shield-plus,
// phone-call, package, navigation -- copied from
// node_modules/lucide-react/dist/esm/icons/*.js at the versions this repo
// pins), reproduced statically so markers keep the same icon family as
// `venuemapmodal.tsx`'s PostMarker/TeamMarker/CallMarker/EquipmentMarker
// without pulling lucide-react's React components into a non-React render
// path.
type MarkerIconKey = 'post' | 'team' | 'call' | 'equipment' | 'device';

const MARKER_ICON_PATHS: Record<MarkerIconKey, string> = {
  post:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  team:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/><path d="M12 9v6"/>',
  call:
    '<path d="M13 2a9 9 0 0 1 9 9"/><path d="M13 6a5 5 0 0 1 5 5"/><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  equipment:
    '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  device: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
};

interface MarkerColorClasses {
  border: string;
  fill: string;
  text: string;
}

/** Matches the "rounded-full border-2, colour-classed icon" look shared by
 *  PostMarker/TeamMarker/CallMarker in venuemapmodal.tsx. */
function createIconMarkerElement(
  icon: MarkerIconKey,
  colors: MarkerColorClasses,
  sizePx = 28
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = cn(
    'flex items-center justify-center rounded-full border-2 shadow-lg transition-transform hover:scale-110',
    colors.border,
    colors.fill
  );
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:58%;height:58%" class="${cn('h-4 w-4', colors.text)}">${MARKER_ICON_PATHS[icon]}</svg>`;
  return el;
}

/** Escapes text dropped into a marker/popup's `innerHTML` -- team names,
 *  call complaints and post names are all dispatcher- or caller-authored
 *  free text, not app-controlled strings, so this is a real XSS boundary
 *  rather than a formality. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function popupShell(inner: string): string {
  return `<div class="rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg whitespace-nowrap">${inner}</div>`;
}

function popupTitle(text: string, colorClass?: string): string {
  return `<div class="${colorClass ?? ''}" style="font-weight:bold;font-size:15px;margin-bottom:4px">${escapeHtml(text)}</div>`;
}

/** Hover-to-show / mouseleave-to-hide popup, the basemap-view equivalent of
 *  the fixed-position hover cards in venuemapmodal.tsx's marker components.
 *  Deliberately its own `Popup` instance controlled by plain mouseenter/
 *  mouseleave rather than `marker.setPopup(...).togglePopup()`: toggle-based
 *  state can desync under rapid enter/leave (e.g. a fast pan under the
 *  cursor), where "create on enter, remove on leave" cannot. */
function attachHoverPopup(
  mgl: MapLibreGlModule,
  map: MapLibreMap,
  marker: MapLibreMarker,
  el: HTMLElement,
  html: string
): void {
  let popup: InstanceType<MapLibreGlModule['Popup']> | null = null;
  el.addEventListener('mouseenter', () => {
    popup = new mgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      className: 'cc-basemap-popup',
    })
      .setLngLat(marker.getLngLat())
      .setHTML(html)
      .addTo(map);
  });
  el.addEventListener('mouseleave', () => {
    popup?.remove();
    popup = null;
  });
}

// --- device-location accuracy circle ----------------------------------------
//
// A GeoJSON polygon approximating a circle of `accuracyMetres` radius, real
// ground metres, around (lat, lon). Longitude is corrected by cos(latitude)
// -- the same tangent-plane approximation geoUtils.ts documents and uses
// throughout (see its module doc comment and `toLocalPlane`) -- so the shape
// reads as a true circle rather than an ellipse squashed by however far this
// venue sits from the equator. This lives here rather than in geoUtils.ts
// because it is rendering-specific GeoJSON construction, not a pixel<->latlon
// transform; geoUtils.ts stays free of any renderer-shaped output (see
// layerImageCorners's doc comment making the same distinction for the raster
// overlay).
const DEVICE_ACCURACY_SOURCE_ID = 'basemap-device-accuracy';
const DEVICE_ACCURACY_FILL_LAYER_ID = 'basemap-device-accuracy-fill';
const DEVICE_ACCURACY_LINE_LAYER_ID = 'basemap-device-accuracy-line';

// MapLibre paint properties are WebGL uniforms, not CSS -- they take a
// literal colour string, never a CSS custom property or Tailwind class. That
// makes this the one place in the file that cannot honour "design tokens
// only": this hex is `tailwind.config.js`'s `colors.accent.DEFAULT`,
// transcribed rather than invented, for exactly the reason `lib/basemap/
// style.ts`'s own BACKDROP constants already carry raw hex -- see that
// file's module doc comment for the same trade-off made in the same place.
const ACCENT_HEX = '#3eb1fd';

function buildAccuracyCircleGeoJSON(
  lat: number,
  lon: number,
  accuracyMetres: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const dLat = accuracyMetres / METRES_PER_DEGREE_LATITUDE;
  const dLon = accuracyMetres / (METRES_PER_DEGREE_LATITUDE * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

/** Adds the accuracy source/layers on first use, or updates their data on
 *  every call after -- `setData` rather than remove+re-add, because a live
 *  GPS watch can update this every second or two and repeatedly tearing
 *  down/rebuilding the layer would flicker it and fight any in-flight style
 *  reload. Passing `feature: null` clears the circle (device location lost)
 *  without removing the layer, so a later fix can resume via `setData` alone. */
function upsertDeviceAccuracyLayer(
  map: MapLibreMap,
  feature: GeoJSON.Feature<GeoJSON.Polygon> | null
): void {
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  const existing = map.getSource(DEVICE_ACCURACY_SOURCE_ID) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(feature ?? empty);
    return;
  }
  if (!feature) return; // nothing to add yet, and nothing to clear
  map.addSource(DEVICE_ACCURACY_SOURCE_ID, { type: 'geojson', data: feature });
  map.addLayer({
    id: DEVICE_ACCURACY_FILL_LAYER_ID,
    type: 'fill',
    source: DEVICE_ACCURACY_SOURCE_ID,
    paint: { 'fill-color': ACCENT_HEX, 'fill-opacity': 0.15 },
  });
  map.addLayer({
    id: DEVICE_ACCURACY_LINE_LAYER_ID,
    type: 'line',
    source: DEVICE_ACCURACY_SOURCE_ID,
    paint: { 'line-color': ACCENT_HEX, 'line-width': 1.5, 'line-opacity': 0.5 },
  });
}

/** Runs `fn` once the style is ready to accept `addSource`/`addLayer` calls
 *  -- either immediately, or deferred to the map's `load` event. Needed
 *  because the device-location effect can fire before the initial style
 *  finishes loading (a fast Geolocation fix racing a slow tile fetch). */
function whenStyleReady(map: MapLibreMap, fn: () => void): void {
  if (map.isStyleLoaded()) {
    fn();
  } else {
    map.once('load', fn);
  }
}

function styleSignature(
  theme: 'light' | 'dark',
  raster: { url: string; coordinates: CornerCoordinates } | undefined
): string {
  return JSON.stringify([theme, raster?.url, raster?.coordinates]);
}

export default function BasemapView({
  layer,
  staff,
  equipment,
  calls,
  theme = 'dark',
  isPlacementArmed = false,
  onMapClick,
  draftPin,
  selectedCallId,
  onSelectCall,
  deviceLocation,
  onUnavailable,
  className,
}: BasemapViewProps) {
  // Memoized so an omitted `calls`/`equipment` prop doesn't hand the marker
  // effect below a fresh `[]` identity every render, which would defeat its
  // dependency array and rebuild every marker on every parent re-render.
  const safeCalls = useMemo(() => calls ?? [], [calls]);
  const safeEquipment = useMemo(() => equipment ?? [], [equipment]);

  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // config is a pure, synchronous read of build-time env vars (see
  // readBasemapConfig's doc comment) -- memoized so its identity is stable
  // across renders and effects that key off it don't spuriously re-run.
  const config = useMemo(() => readBasemapConfig(), []);

  const [unavailableReason, setUnavailableReason] = useState<string | null>(() =>
    config ? null : 'basemap not configured (NEXT_PUBLIC_BASEMAP_PMTILES_URL is unset)'
  );
  const [runtime, setRuntime] = useState<{ map: MapLibreMap; mgl: MapLibreGlModule } | null>(null);

  // Latest-value refs for props read from inside long-lived event listeners
  // (map click, marker click) so those listeners never need to be torn down
  // and re-attached just because a parent re-rendered with a new function
  // identity for a prop whose VALUE hasn't meaningfully changed.
  const onMapClickRef = useRef(onMapClick);
  const onSelectCallRef = useRef(onSelectCall);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onSelectCallRef.current = onSelectCall;
    onUnavailableRef.current = onUnavailable;
  });

  // First reason wins: once a mount attempt is known to be doomed, a second
  // failure racing in behind it (another tile 404 after the map was already
  // torn down, say) should not overwrite the original diagnosis.
  const reportUnavailable = useCallback((reason: string) => {
    setUnavailableReason((prev) => prev ?? reason);
  }, []);

  useEffect(() => {
    if (unavailableReason) {
      onUnavailableRef.current?.(unavailableReason);
    }
  }, [unavailableReason]);

  // The venue raster overlay -- present only when the layer both has a map
  // image AND a solvable georeference. `raster === undefined` is a normal,
  // expected state (an uncalibrated layer, or one with no image at all): the
  // basemap still renders, just without the overlay -- see the file header
  // and TAK plan §8.F. `solveGeoreference` is not free (it fits a transform
  // from the layer's control points), so it is solved once here and reused
  // by both the initial-mount style and the style-rebuild effect below.
  const raster = useMemo(() => {
    const transform = solveGeoreference(layer.georeference);
    if (!transform || !layer.mapUrl) return undefined;
    return { url: layer.mapUrl, coordinates: layerImageCorners(transform).coordinates };
  }, [layer.georeference, layer.mapUrl]);

  const lastStyleSigRef = useRef<string | null>(null);
  const lastAccuracyFeatureRef = useRef<GeoJSON.Feature<GeoJSON.Polygon> | null>(null);

  // --- mount: dynamic-import maplibre-gl + pmtiles, build the map once -----
  useEffect(() => {
    if (!config) return; // nothing to mount; the render-null path plus the
    // notification effect above already cover telling the caller why.

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let mgl: MapLibreGlModule | null = null;

    const teardown = () => {
      cancelled = true;
      if (map) {
        try {
          map.remove();
        } catch {
          // Already torn down (e.g. StrictMode's synthetic double-cleanup
          // racing a real unmount) -- nothing further to do.
        }
        map = null;
      }
      if (mgl) {
        unregisterPmtilesProtocol(mgl);
        mgl = null;
      }
      setRuntime(null);
    };

    (async () => {
      if (typeof window === 'undefined') {
        reportUnavailable('window is undefined (non-browser environment)');
        return;
      }

      let loadedMgl: MapLibreGlModule;
      try {
        loadedMgl = await import('maplibre-gl');
        // MapLibre ships its control/marker/popup layout CSS as a separate
        // file from the JS; without it, controls render unstyled and markers
        // mis-position. Imported dynamically alongside the JS itself so a
        // deployment with no basemap configured (the early `if (!config)
        // return` above) never fetches either.
        await import('maplibre-gl/dist/maplibre-gl.css');
      } catch (err) {
        reportUnavailable(`maplibre-gl failed to load: ${String(err)}`);
        return;
      }
      if (cancelled || !containerRef.current) return;

      try {
        await registerPmtilesProtocol(loadedMgl);
      } catch (err) {
        reportUnavailable(`pmtiles protocol failed to load: ${String(err)}`);
        return;
      }
      if (cancelled || !containerRef.current) {
        // This mount attempt is being abandoned (StrictMode's synthetic
        // cleanup already ran, or the component unmounted mid-import). We
        // took a protocol refcount above that nobody else will release, so
        // release it ourselves rather than leaking a permanent registration.
        unregisterPmtilesProtocol(loadedMgl);
        return;
      }

      let initialStyle;
      try {
        initialStyle = buildBasemapStyle({ config, theme, raster });
      } catch (err) {
        unregisterPmtilesProtocol(loadedMgl);
        reportUnavailable(`failed to build basemap style: ${String(err)}`);
        return;
      }
      lastStyleSigRef.current = styleSignature(theme, raster);

      // Initial camera only -- see prop doc comments and requirement #5.
      // Re-fitting on every data update would yank the view out from under a
      // dispatcher who has since panned/zoomed to look at something specific.
      //
      // Deliberately computed here and passed to the CONSTRUCTOR rather than
      // fitted inside a `once('load')` handler. MapLibre only fires `load`
      // once `style.loaded()` is true, and that requires every source to
      // report loaded -- which never happens while the map sits at its
      // built-in world view, because the venue-sized pmtiles extract has no
      // tiles out there to finish loading. Fitting on `load` therefore
      // deadlocked: the camera needed the event, and the event needed a
      // camera pointed somewhere the tiles exist. Bounds passed at
      // construction are pure transform math that needs no tiles at all, so
      // the map opens already framed on the venue -- which also removes the
      // world-view flash the old path showed on every open.
      const initialPoints: [number, number][] = raster
        ? raster.coordinates
        : collectMarkerLngLats(layer, staff, safeCalls);
      let initialBounds: InstanceType<MapLibreGlModule['LngLatBounds']> | undefined;
      if (initialPoints.length > 0) {
        const bounds = new loadedMgl.LngLatBounds();
        for (const point of initialPoints) bounds.extend(point);
        initialBounds = bounds;
      }
      // Otherwise: no raster and no located markers at all -- leave MapLibre
      // at its built-in default view rather than crash or invent a center. An
      // empty venue is a legitimate state.

      const createdMap = new loadedMgl.Map({
        container: containerRef.current,
        style: initialStyle,
        // ODbL requires attribution (§9 Licensing) -- `compact: true` keeps
        // it as a small collapsible control rather than a permanent banner,
        // but it must never be turned off entirely.
        attributionControl: { compact: true },
        ...(initialBounds
          ? { bounds: initialBounds, fitBoundsOptions: { padding: 48, maxZoom: 18 } }
          : {}),
      });

      createdMap.addControl(new loadedMgl.NavigationControl({ visualizePitch: true }));
      createdMap.addControl(new loadedMgl.ScaleControl());

      createdMap.on('error', (e) => {
        // MapLibre fires this for any failed source/tile/style/glyph load --
        // a 404'd pmtiles archive is exactly this. Requirement is
        // degrade-to-nothing (see file header), so the first error this map
        // instance sees is treated as fatal for the whole mount.
        const message = e?.error?.message ?? 'unknown MapLibre error';
        reportUnavailable(`MapLibre error: ${message}`);
        teardown();
      });

      // Re-apply the device-accuracy layer after any style reload -- both
      // the initial load and every subsequent `setStyle` (theme/raster
      // change, see the style-rebuild effect) wipe non-style-spec sources
      // and layers, which includes this one.
      createdMap.on('style.load', () => {
        if (lastAccuracyFeatureRef.current) {
          whenStyleReady(createdMap, () =>
            upsertDeviceAccuracyLayer(createdMap, lastAccuracyFeatureRef.current)
          );
        }
      });

      map = createdMap;
      mgl = loadedMgl;
      setRuntime({ map: createdMap, mgl: loadedMgl });
    })();

    return () => {
      teardown();
    };
    // Intentionally mount-once (keyed only on `config`, which is referentially
    // stable): `theme`/`raster`/`layer`/`staff`/`calls` are read here only for
    // the INITIAL style and INITIAL camera fit. Later changes to any of them
    // are handled by the dedicated effects below, which react to `runtime`
    // once it exists rather than re-running this whole mount sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // --- style rebuild on theme / raster change ------------------------------
  useEffect(() => {
    if (!runtime || !config) return;
    const sig = styleSignature(theme, raster);
    if (lastStyleSigRef.current === sig) return; // matches what's already applied (including the initial mount's style)
    lastStyleSigRef.current = sig;
    runtime.map.setStyle(buildBasemapStyle({ config, theme, raster }));
  }, [runtime, config, theme, raster]);

  // --- resize -----------------------------------------------------------
  // This view lives inside a modal that changes size (open/close animation,
  // window resize); MapLibre does not observe its container, so a stale
  // canvas size is otherwise the default.
  useEffect(() => {
    if (!runtime || !containerRef.current) return;
    const target = containerRef.current;
    const observer = new ResizeObserver(() => runtime.map.resize());
    observer.observe(target);
    return () => observer.disconnect();
  }, [runtime]);

  // --- placement click -> coordinate ---------------------------------------
  useEffect(() => {
    if (!runtime) return;
    const { map } = runtime;
    const canvas = map.getCanvas();
    canvas.style.cursor = isPlacementArmed ? 'crosshair' : '';
    if (!isPlacementArmed) return;

    const handleClick = (e: MapMouseEvent) => {
      onMapClickRef.current?.({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
      canvas.style.cursor = '';
    };
  }, [runtime, isPlacementArmed]);

  // --- posts / teams / calls / equipment markers ---------------------------
  useEffect(() => {
    if (!runtime) return;
    const { map, mgl } = runtime;
    const built: MapLibreMarker[] = [];

    const postEntries = layerPostsLatLon(layer);
    for (const { name, latLon } of postEntries) {
      if (!latLon) continue;
      const el = createIconMarkerElement('post', {
        border: 'border-accent',
        fill: 'bg-accent/20',
        text: 'text-accent',
      });
      const marker = new mgl.Marker({ element: el }).setLngLat([latLon.lon, latLon.lat]).addTo(map);
      attachHoverPopup(mgl, map, marker, el, popupShell(popupTitle(name, 'text-accent')));
      built.push(marker);
    }

    for (const member of staff) {
      const tak = member.tak;
      if (!tak || tak.onMap !== true || typeof tak.lat !== 'number' || typeof tak.lon !== 'number') {
        continue;
      }
      // deriveTeamVisualStatus wants an Event to check active-call/equipment-run
      // state, but reads only `.calls` -- BasemapView is handed `calls`
      // directly rather than a full Event, so this narrow shape stands in for
      // the one field the function actually touches.
      const eventShim = { calls: safeCalls } as Event;
      const visualStatus = deriveTeamVisualStatus(member.status, eventShim, member.team);
      const statusColor = getStatusColor(visualStatus);
      const el = createIconMarkerElement('team', {
        border: statusColor.borderClass,
        fill: statusColor.fillClass,
        text: statusColor.textClass,
      });
      const marker = new mgl.Marker({ element: el }).setLngLat([tak.lon, tak.lat]).addTo(map);
      attachHoverPopup(
        mgl,
        map,
        marker,
        el,
        popupShell(
          popupTitle(member.team, statusColor.textClass) +
            `<div><strong>Status:</strong> ${escapeHtml(member.status || 'Unknown')}</div>` +
            `<div><strong>Post:</strong> ${escapeHtml(member.location || 'Unassigned')}</div>`
        )
      );
      built.push(marker);
    }

    for (const call of safeCalls) {
      const position = call.position;
      if (!position || position.layerId !== layer.id) continue;
      const statusColor = getStatusColor(call.status);
      const el = createIconMarkerElement(
        'call',
        {
          border: statusColor.borderClass,
          fill: statusColor.fillClass,
          text: statusColor.textClass,
        },
        30
      );
      if (call.id === selectedCallId) {
        el.classList.add('ring-2', 'ring-accent', 'ring-offset-2', 'ring-offset-surface-deepest');
      }
      if (onSelectCallRef.current) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectCallRef.current?.(call.id);
        });
      }
      const marker = new mgl.Marker({ element: el }).setLngLat([position.lon, position.lat]).addTo(map);
      attachHoverPopup(
        mgl,
        map,
        marker,
        el,
        popupShell(
          popupTitle(`Call #${call.order}`, statusColor.textClass) +
            `<div><strong>Status:</strong> ${escapeHtml(call.status || 'Unknown')}</div>` +
            (call.location ? `<div><strong>Location:</strong> ${escapeHtml(call.location)}</div>` : '') +
            (call.chiefComplaint
              ? `<div><strong>Complaint:</strong> ${escapeHtml(call.chiefComplaint)}</div>`
              : '')
        )
      );
      built.push(marker);
    }

    // Equipment has no coordinate of its own -- only a `location` string,
    // matched against a post name exactly the way venuemapmodal.tsx's
    // EquipmentMarker placement does (`posts.find(p => p.name === equip.
    // location)`). No match, or a match with no derivable lat/lon (layer
    // not calibrated), means this item is skipped silently rather than
    // drawn at a guessed position -- per requirement #6.
    for (const item of safeEquipment) {
      if (!item.location) continue;
      const match = postEntries.find((p) => p.name === item.location);
      if (!match?.latLon) continue;
      const el = createIconMarkerElement('equipment', {
        border: 'border-status-card-yellow',
        fill: 'bg-status-card-yellow/20',
        text: 'text-status-orange',
      });
      const marker = new mgl.Marker({ element: el })
        .setLngLat([match.latLon.lon, match.latLon.lat])
        .addTo(map);
      attachHoverPopup(
        mgl,
        map,
        marker,
        el,
        popupShell(
          popupTitle(item.name) +
            `<div><strong>Status:</strong> ${escapeHtml(item.status)}</div>` +
            `<div><strong>Location:</strong> ${escapeHtml(item.location || 'Unknown')}</div>`
        )
      );
      built.push(marker);
    }

    return () => {
      for (const marker of built) marker.remove();
    };
  }, [runtime, layer, staff, safeEquipment, safeCalls, selectedCallId]);

  // --- draft pin (unconfirmed placement) ------------------------------------
  useEffect(() => {
    if (!runtime || !draftPin) return;
    const { map, mgl } = runtime;
    // Neutral styling matching venuemapmodal.tsx's CallMarker when `call` is
    // null -- getStatusColor(undefined) is the same DEFAULT_STATUS_COLOR
    // that draws there, so a draft pin looks the same in both views.
    const neutral = getStatusColor(undefined);
    const el = createIconMarkerElement(
      'call',
      { border: neutral.borderClass, fill: neutral.fillClass, text: neutral.textClass },
      30
    );
    el.style.opacity = '0.9';
    const marker = new mgl.Marker({ element: el }).setLngLat([draftPin.lon, draftPin.lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [runtime, draftPin]);

  // --- device location dot + accuracy circle --------------------------------
  useEffect(() => {
    if (!runtime) return;
    const { map, mgl } = runtime;

    if (!deviceLocation) {
      lastAccuracyFeatureRef.current = null;
      whenStyleReady(map, () => upsertDeviceAccuracyLayer(map, null));
      return;
    }

    const el = document.createElement('div');
    el.className = 'relative flex items-center justify-center';
    el.style.width = '20px';
    el.style.height = '20px';
    el.title = `You are here (±${Math.round(deviceLocation.accuracy)}m)`;

    // A confident-looking dot for a ±40m fix is exactly the invented
    // precision this codebase's TAK docs repeatedly warn against (see
    // TakPosition.accuracy's usage in venuemapmodal.tsx) -- the pulse ring
    // signals "device position," the accuracy circle (below, in real
    // ground metres) is what actually communicates how much to trust it.
    if (!reducedMotion.enabled) {
      const ring = document.createElement('div');
      ring.className = 'cc-basemap-device-pulse absolute rounded-full bg-accent';
      el.appendChild(ring);
    }
    const dot = document.createElement('div');
    dot.className = 'relative h-3 w-3 rounded-full bg-accent border-2 border-white shadow-md';
    el.appendChild(dot);

    const marker = new mgl.Marker({ element: el })
      .setLngLat([deviceLocation.lon, deviceLocation.lat])
      .addTo(map);

    const feature = buildAccuracyCircleGeoJSON(
      deviceLocation.lat,
      deviceLocation.lon,
      deviceLocation.accuracy
    );
    lastAccuracyFeatureRef.current = feature;
    whenStyleReady(map, () => upsertDeviceAccuracyLayer(map, feature));

    return () => {
      marker.remove();
    };
  }, [runtime, deviceLocation, reducedMotion.enabled]);

  if (unavailableReason) {
    return null;
  }

  return (
    <div className={cn('relative h-full w-full', className)}>
      {/* MapLibre owns everything inside this node once it mounts -- it must
          stay a childless leaf on the React side so React's reconciliation
          never fights MapLibre's own DOM writes to it.

          Sized with `h-full w-full` rather than `absolute inset-0`: MapLibre's
          own stylesheet declares `.maplibregl-map { position: relative }`, and
          because that CSS arrives via the dynamic `import(...)` below it is
          appended AFTER Tailwind's. At equal specificity the later rule wins,
          so `absolute` loses to MapLibre's `relative`, `inset-0` stops
          applying, and the container collapses to zero height -- a blank map
          with no error, since MapLibre reports nothing wrong about being
          asked to render into a 0px box. Explicit height does not depend on
          winning that cascade fight. */}
      <div ref={containerRef} className="h-full w-full" />
      <style jsx global>{`
        @keyframes ccBasemapDevicePulse {
          0% {
            transform: scale(0.6);
            opacity: 0.55;
          }
          70%,
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
        .cc-basemap-device-pulse {
          left: 50%;
          top: 50%;
          width: 20px;
          height: 20px;
          margin-left: -10px;
          margin-top: -10px;
          animation: ccBasemapDevicePulse 1.8s ease-out infinite;
          will-change: transform, opacity;
        }
        /* Strip MapLibre's default white popup chrome so only the
           app-styled inner card (see popupShell) shows -- scoped to this
           component's own popups via className so any other MapLibre usage
           elsewhere on the page keeps the library default. */
        .cc-basemap-popup .maplibregl-popup-content {
          background: transparent;
          box-shadow: none;
          padding: 0;
          border-radius: 0;
        }
        .cc-basemap-popup .maplibregl-popup-tip {
          display: none;
        }
      `}</style>
    </div>
  );
}

/** Every drawable lat/lon this component knows about for `layer`, used only
 *  to fit the initial camera when there's no georeferenced raster to fit to
 *  instead (requirement #5). Equipment is deliberately excluded: its
 *  position is always a post's position (see the marker effect above), so
 *  including it here would only duplicate points the post loop already
 *  contributes. */
function collectMarkerLngLats(layer: Layer, staff: Staff[], calls: Call[]): [number, number][] {
  const points: [number, number][] = [];
  for (const { latLon } of layerPostsLatLon(layer)) {
    if (latLon) points.push([latLon.lon, latLon.lat]);
  }
  for (const member of staff) {
    const tak = member.tak;
    if (tak && tak.onMap === true && typeof tak.lat === 'number' && typeof tak.lon === 'number') {
      points.push([tak.lon, tak.lat]);
    }
  }
  for (const call of calls) {
    if (call.position && call.position.layerId === layer.id) {
      points.push([call.position.lon, call.position.lat]);
    }
  }
  return points;
}
