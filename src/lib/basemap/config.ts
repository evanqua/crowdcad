// Basemap configuration — TAK plan §8.B.
//
// The basemap is OPTIONAL AND OFF BY DEFAULT. This module is the single place
// that decides whether one is available, and it answers `null` unless a tile
// archive has been explicitly configured.
//
// That default is not timidity, it is the requirement from §8.B: "the basemap
// must degrade to nothing". Stadium connectivity is a premise of this project
// rather than an edge case, so a map that breaks the existing venue raster when
// tiles are unreachable is strictly worse than no basemap at all. Every caller
// therefore has to handle `null`, and the type system makes them.
//
// Nothing here imports maplibre-gl. This module stays pure and synchronously
// testable; the ~200KB renderer is dynamically imported at the one component
// that actually draws (see BasemapView), so a deployment with no basemap
// configured never pays for the dependency at all.

/** Everything the renderer needs to draw a basemap, once one is configured. */
export interface BasemapConfig {
  /**
   * URL of the PMTiles archive. Served from our own origin by default
   * (`/basemap/venue.pmtiles`, produced by scripts/fetch-basemap.sh) so the
   * whole basemap works on a venue LAN with no internet.
   */
  pmtilesUrl: string;
  /** MapLibre glyph range template. Labels do not render at all without it. */
  glyphsUrl: string;
  /** Sprite sheet base URL for POI icons. */
  spriteUrl: string;
  /**
   * Attribution string. ODbL requires it and §9 Licensing says so; it is part
   * of the config rather than a component constant so that pointing at a
   * non-OSM archive cannot silently keep crediting OpenStreetMap.
   */
  attribution: string;
}

/**
 * Default asset locations, matching what scripts/fetch-basemap.sh writes into
 * public/basemap/. Overridable individually for a deployment that serves tiles
 * from a CDN or a venue-local file server.
 */
const DEFAULT_GLYPHS = '/basemap/fonts/{fontstack}/{range}.pbf';
const DEFAULT_SPRITE = '/basemap/sprites/light';
const DEFAULT_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap</a>';

/**
 * The raw environment this module reads. Injectable so tests do not have to
 * mutate process.env, but note the caveat on readBasemapConfig: in the browser
 * these are build-time literals, not a runtime lookup.
 */
export interface BasemapEnv {
  pmtilesUrl?: string;
  glyphsUrl?: string;
  spriteUrl?: string;
  attribution?: string;
}

/** Treats undefined, empty, and whitespace-only alike — an env var set to the
 *  empty string in a .env file is a deployment saying "no", not "yes, at ''". */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Reads the ambient basemap configuration.
 *
 * Returns `null` when no tile archive is configured, which is the default and
 * the documented degrade-to-nothing path — callers must render the raster-only
 * map in that case, with no error state.
 *
 * The `process.env.NEXT_PUBLIC_*` references below are deliberately written out
 * in full rather than looked up dynamically: Next.js inlines these at build
 * time by textual substitution, so `process.env[someVariable]` would silently
 * evaluate to undefined in the browser bundle.
 */
export function basemapEnvFromProcess(): BasemapEnv {
  return {
    pmtilesUrl: process.env.NEXT_PUBLIC_BASEMAP_PMTILES_URL,
    glyphsUrl: process.env.NEXT_PUBLIC_BASEMAP_GLYPHS_URL,
    spriteUrl: process.env.NEXT_PUBLIC_BASEMAP_SPRITE_URL,
    attribution: process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION,
  };
}

/**
 * Resolve a config from an environment, or `null` if no basemap is configured.
 *
 * Only `pmtilesUrl` is load-bearing: without an archive there is nothing to
 * draw, and every other field has a working default that points at what
 * scripts/fetch-basemap.sh produces.
 */
export function readBasemapConfig(env: BasemapEnv = basemapEnvFromProcess()): BasemapConfig | null {
  const pmtilesUrl = clean(env.pmtilesUrl);
  if (!pmtilesUrl) return null;

  return {
    pmtilesUrl,
    glyphsUrl: clean(env.glyphsUrl) ?? DEFAULT_GLYPHS,
    spriteUrl: clean(env.spriteUrl) ?? DEFAULT_SPRITE,
    attribution: clean(env.attribution) ?? DEFAULT_ATTRIBUTION,
  };
}

/** Convenience predicate for UI that only needs to know whether to offer the
 *  basemap view toggle at all. */
export function isBasemapConfigured(env?: BasemapEnv): boolean {
  return readBasemapConfig(env) !== null;
}

/**
 * The name MapLibre knows the vector source by. Shared between the style
 * builder and any code that needs to address the source after load, so the two
 * cannot drift apart.
 */
export const BASEMAP_SOURCE_ID = 'protomaps';

/** The id of the raster overlay source/layer for the venue image (§8.C). */
export const VENUE_RASTER_SOURCE_ID = 'venue-raster';
export const VENUE_RASTER_LAYER_ID = 'venue-raster-layer';
