import { describe, expect, it } from 'vitest';

import {
  classifyAccuracyQuality,
  classifyPositionError,
  getGeolocationUnsupportedReason,
  toDeviceLocation,
} from '@/hooks/useDeviceLocation';

describe('classifyPositionError', () => {
  it('maps PERMISSION_DENIED (1) to denied, with a message about browser settings', () => {
    const { status, message } = classifyPositionError(1);
    expect(status).toBe('denied');
    expect(message.toLowerCase()).toContain('browser settings');
  });

  it('maps POSITION_UNAVAILABLE (2) to error', () => {
    const { status, message } = classifyPositionError(2);
    expect(status).toBe('error');
    expect(message.length).toBeGreaterThan(0);
  });

  it('maps TIMEOUT (3) to error, with a message distinct from POSITION_UNAVAILABLE', () => {
    const timeout = classifyPositionError(3);
    const unavailable = classifyPositionError(2);
    expect(timeout.status).toBe('error');
    expect(timeout.message).not.toBe(unavailable.message);
  });

  it('falls back to a generic error for an unrecognised code', () => {
    const { status, message } = classifyPositionError(99);
    expect(status).toBe('error');
    expect(message.length).toBeGreaterThan(0);
  });
});

describe('getGeolocationUnsupportedReason', () => {
  it('returns null when the API exists and the context is secure', () => {
    expect(getGeolocationUnsupportedReason(true, true)).toBeNull();
  });

  it('explains missing browser support when navigator.geolocation is absent', () => {
    const reason = getGeolocationUnsupportedReason(false, true);
    expect(reason).not.toBeNull();
    expect(reason?.toLowerCase()).toContain('does not support');
  });

  it('explains the secure-context requirement when the API exists but the context is insecure', () => {
    // The realistic case this exists for: a venue LAN serving the app over
    // plain HTTP to a phone on the same network. The API object can still be
    // present on `navigator` even though the browser will refuse to use it.
    const reason = getGeolocationUnsupportedReason(true, false);
    expect(reason).not.toBeNull();
    expect(reason?.toLowerCase()).toContain('https');
  });

  it('prioritises the missing-API message when both conditions fail', () => {
    const reason = getGeolocationUnsupportedReason(false, false);
    expect(reason?.toLowerCase()).toContain('does not support');
  });
});

describe('toDeviceLocation', () => {
  it('narrows a GeolocationPosition-shaped object to lat/lon/accuracy/timestamp', () => {
    const position = {
      coords: {
        latitude: 37.8712,
        longitude: -122.2727,
        accuracy: 12.5,
      },
      timestamp: 1700000000000,
    } as GeolocationPosition;

    expect(toDeviceLocation(position)).toEqual({
      lat: 37.8712,
      lon: -122.2727,
      accuracy: 12.5,
      timestamp: 1700000000000,
    });
  });
});

describe('classifyAccuracyQuality', () => {
  const THRESHOLD = 25;

  it('classifies a fix at or better than the threshold as precise', () => {
    expect(classifyAccuracyQuality(25, THRESHOLD)).toBe('precise');
    expect(classifyAccuracyQuality(8, THRESHOLD)).toBe('precise');
    expect(classifyAccuracyQuality(0, THRESHOLD)).toBe('precise');
  });

  it('classifies a fix worse than the threshold as coarse', () => {
    expect(classifyAccuracyQuality(25.1, THRESHOLD)).toBe('coarse');
    expect(classifyAccuracyQuality(200, THRESHOLD)).toBe('coarse');
  });
});
