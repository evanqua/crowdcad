/**
 * Tests for basemap configuration — the single gate for whether a basemap exists.
 *
 * This module's "returns null by default" contract is load-bearing: the whole
 * offline-degradation requirement (§8.B) rests on it. These tests guard that
 * the default is off, not incidental coverage of edge cases. Every call site
 * must handle `null` and render the raster-only map in that case.
 */

import { describe, expect, it } from 'vitest';

import {
  BASEMAP_SOURCE_ID,
  BasemapConfig,
  BasemapEnv,
  isBasemapConfigured,
  readBasemapConfig,
  VENUE_RASTER_LAYER_ID,
  VENUE_RASTER_SOURCE_ID,
} from '@/lib/basemap/config';

describe('readBasemapConfig / isBasemapConfigured', () => {
  describe('the default is off — degrade-to-nothing contract', () => {
    it('returns null for an empty env object (no basemap configured)', () => {
      const env: BasemapEnv = {};
      expect(readBasemapConfig(env)).toBeNull();
    });

    it('returns false from isBasemapConfigured for an empty env', () => {
      const env: BasemapEnv = {};
      expect(isBasemapConfigured(env)).toBe(false);
    });
  });

  describe('empty and whitespace-only pmtilesUrl are "off"', () => {
    it('returns null when pmtilesUrl is an empty string', () => {
      const env: BasemapEnv = { pmtilesUrl: '' };
      expect(readBasemapConfig(env)).toBeNull();
    });

    it('returns null when pmtilesUrl is whitespace-only', () => {
      const env: BasemapEnv = { pmtilesUrl: '   ' };
      expect(readBasemapConfig(env)).toBeNull();
    });

    it('returns null when pmtilesUrl is explicitly undefined', () => {
      const env: BasemapEnv = { pmtilesUrl: undefined };
      expect(readBasemapConfig(env)).toBeNull();
    });

    it('returns false from isBasemapConfigured when pmtilesUrl is empty', () => {
      const env: BasemapEnv = { pmtilesUrl: '' };
      expect(isBasemapConfigured(env)).toBe(false);
    });

    it('returns false from isBasemapConfigured when pmtilesUrl is whitespace-only', () => {
      const env: BasemapEnv = { pmtilesUrl: '   ' };
      expect(isBasemapConfigured(env)).toBe(false);
    });
  });

  describe('a configured archive returns a full config with defaults', () => {
    it('returns a non-null config given only pmtilesUrl', () => {
      const env: BasemapEnv = { pmtilesUrl: '/basemap/tiles.pmtiles' };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
    });

    it('populates every field when pmtilesUrl is the only input', () => {
      const env: BasemapEnv = { pmtilesUrl: '/basemap/tiles.pmtiles' };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.pmtilesUrl).toBe('/basemap/tiles.pmtiles');
      expect(result.glyphsUrl).toBeDefined();
      expect(result.spriteUrl).toBeDefined();
      expect(result.attribution).toBeDefined();
    });

    it('uses the default glyphsUrl template containing {fontstack} and {range}', () => {
      const env: BasemapEnv = { pmtilesUrl: '/basemap/tiles.pmtiles' };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.glyphsUrl).toContain('{fontstack}');
      expect(result.glyphsUrl).toContain('{range}');
    });

    it('uses the default spriteUrl', () => {
      const env: BasemapEnv = { pmtilesUrl: '/basemap/tiles.pmtiles' };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.spriteUrl).toBe('/basemap/sprites/light');
    });

    it('uses the default attribution string mentioning OpenStreetMap', () => {
      const env: BasemapEnv = { pmtilesUrl: '/basemap/tiles.pmtiles' };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.attribution).toContain('OpenStreetMap');
    });

    it('returns true from isBasemapConfigured when pmtilesUrl is set', () => {
      const env: BasemapEnv = { pmtilesUrl: '/basemap/tiles.pmtiles' };
      expect(isBasemapConfigured(env)).toBe(true);
    });
  });

  describe('optional fields override defaults independently', () => {
    it('overrides glyphsUrl alone, leaving others default', () => {
      const customGlyphsUrl = 'https://cdn.example.com/fonts/{fontstack}/{range}.pbf';
      const env: BasemapEnv = {
        pmtilesUrl: '/basemap/tiles.pmtiles',
        glyphsUrl: customGlyphsUrl,
      };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.glyphsUrl).toBe(customGlyphsUrl);
      expect(result.spriteUrl).toBe('/basemap/sprites/light'); // default
      expect(result.attribution).toContain('OpenStreetMap'); // default
    });

    it('overrides spriteUrl alone, leaving others default', () => {
      const customSpriteUrl = 'https://cdn.example.com/sprites/dark';
      const env: BasemapEnv = {
        pmtilesUrl: '/basemap/tiles.pmtiles',
        spriteUrl: customSpriteUrl,
      };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.spriteUrl).toBe(customSpriteUrl);
      expect(result.glyphsUrl).toContain('{fontstack}'); // default
      expect(result.attribution).toContain('OpenStreetMap'); // default
    });

    it('overrides attribution alone, leaving others default', () => {
      const customAttribution =
        '<a href="https://example.com" target="_blank">Custom Map</a>';
      const env: BasemapEnv = {
        pmtilesUrl: '/basemap/tiles.pmtiles',
        attribution: customAttribution,
      };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.attribution).toBe(customAttribution);
      expect(result.spriteUrl).toBe('/basemap/sprites/light'); // default
      expect(result.glyphsUrl).toContain('{fontstack}'); // default
    });
  });

  describe('whitespace trimming and fallback to defaults for optional fields', () => {
    it('trims leading/trailing whitespace from pmtilesUrl', () => {
      const env: BasemapEnv = { pmtilesUrl: '  /basemap/tiles.pmtiles  ' };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.pmtilesUrl).toBe('/basemap/tiles.pmtiles');
    });

    it('trims leading/trailing whitespace from glyphsUrl and uses it', () => {
      const customGlyphsUrl = '  https://cdn.example.com/fonts/{fontstack}/{range}.pbf  ';
      const env: BasemapEnv = {
        pmtilesUrl: '/basemap/tiles.pmtiles',
        glyphsUrl: customGlyphsUrl,
      };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.glyphsUrl).toBe('https://cdn.example.com/fonts/{fontstack}/{range}.pbf');
    });

    it(
      'uses default attribution when the provided value is whitespace-only (prevents silent licensing loss)',
      () => {
        const env: BasemapEnv = {
          pmtilesUrl: '/basemap/tiles.pmtiles',
          attribution: '   ',
        };
        const result = readBasemapConfig(env);
        expect(result).not.toBeNull();
        if (!result) return;

        // Must fall back to default, not become empty string
        expect(result.attribution).toContain('OpenStreetMap');
        expect(result.attribution).not.toBe('');
      }
    );

    it('uses default spriteUrl when the provided value is whitespace-only', () => {
      const env: BasemapEnv = {
        pmtilesUrl: '/basemap/tiles.pmtiles',
        spriteUrl: '   ',
      };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.spriteUrl).toBe('/basemap/sprites/light');
    });

    it('uses default glyphsUrl when the provided value is whitespace-only', () => {
      const env: BasemapEnv = {
        pmtilesUrl: '/basemap/tiles.pmtiles',
        glyphsUrl: '\t\n  ',
      };
      const result = readBasemapConfig(env);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.glyphsUrl).toContain('{fontstack}');
      expect(result.glyphsUrl).toContain('{range}');
    });
  });

  describe('constants are stable strings', () => {
    it('BASEMAP_SOURCE_ID is the expected protomaps identifier', () => {
      expect(BASEMAP_SOURCE_ID).toBe('protomaps');
    });

    it('VENUE_RASTER_SOURCE_ID is distinct from BASEMAP_SOURCE_ID', () => {
      expect(VENUE_RASTER_SOURCE_ID).not.toBe(BASEMAP_SOURCE_ID);
    });

    it('VENUE_RASTER_LAYER_ID is distinct from both source IDs', () => {
      expect(VENUE_RASTER_LAYER_ID).not.toBe(BASEMAP_SOURCE_ID);
      expect(VENUE_RASTER_LAYER_ID).not.toBe(VENUE_RASTER_SOURCE_ID);
    });

    it('VENUE_RASTER_SOURCE_ID is the venue-raster identifier', () => {
      expect(VENUE_RASTER_SOURCE_ID).toBe('venue-raster');
    });

    it('VENUE_RASTER_LAYER_ID is the venue-raster-layer identifier', () => {
      expect(VENUE_RASTER_LAYER_ID).toBe('venue-raster-layer');
    });
  });

  describe('isBasemapConfigured agrees with readBasemapConfig', () => {
    it('both return false/null when pmtilesUrl is missing', () => {
      const env: BasemapEnv = {};
      expect(isBasemapConfigured(env)).toBe(false);
      expect(readBasemapConfig(env)).toBeNull();
    });

    it('both return true/non-null when pmtilesUrl is set', () => {
      const env: BasemapEnv = { pmtilesUrl: '/basemap/tiles.pmtiles' };
      expect(isBasemapConfigured(env)).toBe(true);
      expect(readBasemapConfig(env)).not.toBeNull();
    });

    it('both treat empty pmtilesUrl as unconfigured', () => {
      const env: BasemapEnv = { pmtilesUrl: '' };
      expect(isBasemapConfigured(env)).toBe(false);
      expect(readBasemapConfig(env)).toBeNull();
    });

    it('both treat whitespace-only pmtilesUrl as unconfigured', () => {
      const env: BasemapEnv = { pmtilesUrl: '  ' };
      expect(isBasemapConfigured(env)).toBe(false);
      expect(readBasemapConfig(env)).toBeNull();
    });
  });
});
