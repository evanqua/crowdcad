'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * A single browser geolocation fix, trimmed to the fields this app actually
 * uses. `accuracy` is the Geolocation API's own 95%-confidence radius in
 * metres — not a guess this hook makes, but the number the device already
 * reports for how much to trust the fix. Callers that persist a fix (see
 * `ControlPoint.accuracy` in `src/app/types.ts`) should carry it forward
 * rather than discard it: a fit built from these points is only ever as
 * honest as the worst fix that went into it.
 */
export interface DeviceLocation {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}

/**
 * - `idle`        — nothing requested yet. The hook never leaves this state
 *                    on its own; see `useDeviceLocation`'s no-auto-prompt rule.
 * - `unsupported`  — `navigator.geolocation` doesn't exist, or the page isn't
 *                    in a secure context. Detected without prompting.
 * - `prompting`    — a request or watch is in flight: either the permission
 *                    dialog is up, or the browser is waiting on the first fix.
 * - `granted`      — at least one fix has been received; `location` is set.
 * - `denied`       — the user (or a prior, sticky decision — see iOS Safari
 *                    note below) refused the permission prompt.
 * - `error`        — the browser attempted a fix and failed for a reason
 *                    other than permission (no signal, timed out, etc).
 */
export type DeviceLocationStatus =
  | 'idle'
  | 'unsupported'
  | 'prompting'
  | 'granted'
  | 'denied'
  | 'error';

export interface UseDeviceLocationResult {
  location: DeviceLocation | null;
  status: DeviceLocationStatus;
  error: string | null;
  /** One-shot request. Safe to call repeatedly. */
  request: () => void;
  /** Continuous watch; call `stop()` (or unmount) to end it. */
  watch: () => void;
  stop: () => void;
}

export interface UseDeviceLocationOptions {
  /**
   * Start a continuous watch as soon as the hook mounts. Defaults to false —
   * see the no-auto-prompt rule on `useDeviceLocation` for why this must be
   * opt-in.
   */
  watchOnMount?: boolean;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
}

// The three GeolocationPositionError.code values, inlined as numbers rather
// than read off the constructor. The constants (`err.PERMISSION_DENIED`
// etc.) only exist on a real browser error instance, so keying this
// function's tests to them would mean fabricating a fake instance with those
// properties attached just to exercise a switch on an integer. The values
// are stable across browsers by spec (they're a numbered enum, not a hash),
// so hardcoding them is the more honest representation of what this
// function actually branches on.
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

/**
 * Maps a GeolocationPositionError.code to the status/message pair the UI
 * should show. Pulled out of the hook body so it can be unit-tested without
 * a browser: constructing a real GeolocationPositionError isn't possible
 * outside one, and mocking the whole Geolocation API just to check a switch
 * statement would test the mock, not the logic.
 */
export function classifyPositionError(code: number): { status: DeviceLocationStatus; message: string } {
  switch (code) {
    case PERMISSION_DENIED:
      return {
        status: 'denied',
        message:
          'Location permission was denied. Re-enable it for this site in your browser settings, then try again — most browsers will not re-prompt automatically once denied.',
      };
    case POSITION_UNAVAILABLE:
      return {
        status: 'error',
        message: 'Your device could not determine a location fix right now. Try again, ideally with a clearer view of the sky.',
      };
    case TIMEOUT:
      return {
        status: 'error',
        message: 'Location request timed out before a fix was found. Try again — this is common indoors or with a weak GPS signal.',
      };
    default:
      return { status: 'error', message: 'Location request failed for an unknown reason.' };
  }
}

/**
 * Why geolocation is unusable right now, or null if it's fine to request.
 *
 * `navigator.geolocation` existing is necessary but not sufficient: browsers
 * also gate it on `window.isSecureContext` (HTTPS, or localhost). This
 * project is plausibly run from a laptop on a venue's LAN serving the app
 * over plain HTTP to a phone on the same network — a completely ordinary
 * deployment for this app, and exactly the case where `getCurrentPosition`
 * silently refuses. Without this check that shows up to an operator as a
 * generic, unactionable "geolocation failed", which for a field operator
 * mid-event is a wasted afternoon, not a bug report. Reporting *why* turns
 * it into "serve this over HTTPS" instead.
 *
 * Pulled out as a pure function (rather than inlined where it's read) so the
 * secure-context branch is unit-testable without faking `window`.
 */
export function getGeolocationUnsupportedReason(hasGeolocation: boolean, isSecureContext: boolean): string | null {
  if (!hasGeolocation) {
    return 'This browser does not support geolocation.';
  }
  if (!isSecureContext) {
    return 'Geolocation requires a secure connection. This page is loaded over plain HTTP, which browsers block from reading device location — reload it over HTTPS (or from localhost) to use this.';
  }
  return null;
}

/** Narrow a raw GeolocationPosition down to the DeviceLocation shape this app stores. */
export function toDeviceLocation(position: GeolocationPosition): DeviceLocation {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

export type AccuracyQuality = 'precise' | 'coarse';

/**
 * Whether a GPS fix's own accuracy radius is good enough to calibrate a
 * georeference against. Shared by `useDeviceLocation` consumers rather than
 * duplicated per call site — the venue editor uses it to decide whether to
 * show the "too coarse to calibrate" warning, and any future consumer of a
 * device fix (e.g. a future "confirm my position" affordance elsewhere)
 * should judge a fix by the same yardstick rather than inventing its own
 * threshold.
 */
export function classifyAccuracyQuality(accuracyMetres: number, thresholdMetres: number): AccuracyQuality {
  return accuracyMetres > thresholdMetres ? 'coarse' : 'precise';
}

/**
 * Wraps the browser Geolocation API for the app's two use cases: a one-shot
 * `request()` (venue editor "Use my location") and a continuous `watch()`
 * (a future live-position affordance). Neither Firebase nor PocketBase is
 * involved — this reads the viewer's own device, which is orthogonal to the
 * `tak_positions` collection that drives the blue dot on the dispatch map
 * (see `useTakPositions.ts`); that's someone else's phone relayed through
 * FreeTAKServer, this is the browser the code is running in.
 *
 * No-auto-prompt rule: this hook NEVER calls `getCurrentPosition` or
 * `watchPosition` on mount unless the caller explicitly passes
 * `watchOnMount: true`. A geolocation permission dialog the user did not
 * ask for is a hostile pattern in general, and on iOS Safari it is
 * specifically costly — a denied prompt is sticky per-origin and the
 * browser will not show it again, so an unwanted auto-prompt can lock a
 * user out of ever granting it later without digging into Settings. Detecting
 * *support* (secure context, API presence) on mount is fine and done eagerly
 * below, since that never touches the permission system.
 */
export function useDeviceLocation(options: UseDeviceLocationOptions = {}): UseDeviceLocationResult {
  const { watchOnMount = false, enableHighAccuracy = true, maximumAge, timeout } = options;

  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Guards state updates racing an unmount (a fix or error arriving after
  // the component using this hook is gone) and the id of an in-flight
  // watchPosition subscription, so stop()/unmount can clearWatch it exactly
  // once.
  const mountedRef = useRef(true);
  const watchIdRef = useRef<number | null>(null);

  const geoOptions = useMemo<PositionOptions>(() => {
    const opts: PositionOptions = { enableHighAccuracy };
    if (maximumAge !== undefined) opts.maximumAge = maximumAge;
    if (timeout !== undefined) opts.timeout = timeout;
    return opts;
  }, [enableHighAccuracy, maximumAge, timeout]);

  const unsupportedReason = useCallback((): string | null => {
    const hasGeolocation = typeof navigator !== 'undefined' && !!navigator.geolocation;
    const isSecureContext = typeof window !== 'undefined' && window.isSecureContext === true;
    return getGeolocationUnsupportedReason(hasGeolocation, isSecureContext);
  }, []);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    if (!mountedRef.current) return;
    setLocation(toDeviceLocation(position));
    setStatus('granted');
    setError(null);
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    if (!mountedRef.current) return;
    const { status: nextStatus, message } = classifyPositionError(err.code);
    setStatus(nextStatus);
    setError(message);
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const request = useCallback(() => {
    const reason = unsupportedReason();
    if (reason) {
      setStatus('unsupported');
      setError(reason);
      return;
    }
    setStatus('prompting');
    setError(null);
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
  }, [unsupportedReason, handleSuccess, handleError, geoOptions]);

  const watch = useCallback(() => {
    const reason = unsupportedReason();
    if (reason) {
      setStatus('unsupported');
      setError(reason);
      return;
    }
    // Restart cleanly on repeat calls rather than layering a second
    // subscription on top of one already running.
    stop();
    setStatus('prompting');
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
  }, [unsupportedReason, stop, handleSuccess, handleError, geoOptions]);

  // Mount-only: detect (not request) support, and honour watchOnMount.
  // Detecting support never touches the permission system, so it's exempt
  // from the no-auto-prompt rule above; starting a watch here is exactly the
  // opt-in the rule describes.
  useEffect(() => {
    mountedRef.current = true;
    const reason = unsupportedReason();
    if (reason) {
      setStatus('unsupported');
      setError(reason);
    } else if (watchOnMount) {
      watch();
    }
    return () => {
      mountedRef.current = false;
      stop();
    };
    // Deliberately mount-only: re-running this on every geoOptions change
    // would restart an active watch out from under the caller whenever an
    // unrelated re-render produced a new options object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, status, error, request, watch, stop };
}
