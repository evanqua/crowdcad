import { describe, expect, it } from 'vitest';

import type { BasemapCamera } from '@/app/types';
import { sanitizeBasemapCameraForSave } from '@/lib/basemapCameraUtils';

describe('sanitizeBasemapCameraForSave', () => {
  it('omits bearing/pitch entirely when the camera is north-up and flat', () => {
    const camera: BasemapCamera = { center: { lat: 37.8719, lon: -122.2585 }, zoom: 15 };
    const result = sanitizeBasemapCameraForSave(camera, 1000);

    expect(result).toEqual({
      center: { lat: 37.8719, lon: -122.2585 },
      zoom: 15,
      updatedAt: 1000,
    });
    expect('bearing' in result).toBe(false);
    expect('pitch' in result).toBe(false);
  });

  it('carries bearing/pitch through when present', () => {
    const camera: BasemapCamera = {
      center: { lat: 37.8719, lon: -122.2585 },
      zoom: 16.5,
      bearing: 45,
      pitch: 30,
    };
    const result = sanitizeBasemapCameraForSave(camera, 2000);

    expect(result).toEqual({
      center: { lat: 37.8719, lon: -122.2585 },
      zoom: 16.5,
      bearing: 45,
      pitch: 30,
      updatedAt: 2000,
    });
  });

  it('always stamps updatedAt fresh, ignoring any updatedAt already on the input', () => {
    const camera: BasemapCamera = {
      center: { lat: 0, lon: 0 },
      zoom: 10,
      updatedAt: 1,
    };
    const result = sanitizeBasemapCameraForSave(camera, 999);
    expect(result.updatedAt).toBe(999);
  });

  it('keeps zero bearing/pitch (0 is a real value, not "unset")', () => {
    const camera: BasemapCamera = { center: { lat: 0, lon: 0 }, zoom: 10, bearing: 0, pitch: 0 };
    const result = sanitizeBasemapCameraForSave(camera, 5);
    expect(result.bearing).toBe(0);
    expect(result.pitch).toBe(0);
  });
});
