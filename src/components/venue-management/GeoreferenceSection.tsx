"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Input, ScrollShadow, Tooltip } from '@heroui/react';
import { AlertTriangle, CheckCircle2, Crosshair, LocateFixed, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { ControlPoint, Georeference } from '@/app/types';
import { MAX_ACCEPTABLE_RESIDUAL_METRES, georeferenceResiduals, solveGeoreference } from '@/lib/geoUtils';
import { classifyAccuracyQuality, getGeolocationUnsupportedReason, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { cn } from '@/lib/utils';

interface GeoreferenceSectionProps {
  controlPoints: ControlPoint[];
  // Whether the control points below were solved against an image that is
  // no longer the one on screen (the map was replaced this session but not
  // yet saved). Deliberately a single precomputed boolean rather than, say,
  // handing this component the Georeference plus the raw pending-map state
  // (staged File, pendingLayer index, current layer index) and letting it
  // work out "does that pending file belong to this layer" itself: the
  // caller already has to make that same judgment call for
  // buildGeoreferenceForSave, and a second, independently-written version of
  // the same "which layer does the pending replacement apply to" check
  // in this file could quietly drift from the one that decides what
  // actually gets persisted. A boolean has no such second guess to get
  // wrong — it's already the verdict.
  needsReconfirmation: boolean;
  onUpdatePoint: (index: number, patch: Partial<ControlPoint>) => void;
  onRemovePoint: (index: number) => void;
  onClearAll: () => void;
}

interface GeoreferenceStatus {
  tone: 'muted' | 'ok' | 'warn' | 'stale';
  message: string;
}

/**
 * Worst (largest) accuracy radius among the control points that carry one,
 * or null if none do. "Worst" rather than "average" deliberately: a fit is
 * only as trustworthy as its least-trustworthy input, the same reasoning
 * `ControlPoint.accuracy`'s doc comment gives for recording this per-point
 * instead of once for the whole set.
 */
function worstControlPointAccuracy(controlPoints: ControlPoint[]): number | null {
  let worst: number | null = null;
  for (const point of controlPoints) {
    if (point.accuracy === undefined) continue;
    if (worst === null || point.accuracy > worst) worst = point.accuracy;
  }
  return worst;
}

/**
 * Appends a caveat to an already-"ok" status when the fit is built from a
 * coarse GPS fix, without changing its tone. Only called on the 'ok'
 * branches (see call sites) — a degenerate/stale/too-few-points status is
 * already telling the operator something is wrong, and layering a GPS
 * caveat on top of that would bury the more actionable message.
 *
 * Why this can't be inferred from the residual alone: georeferenceResiduals
 * measures how self-consistent the control points are with each other, not
 * how true they are to the ground. Points all seeded from the same ±40 m
 * GPS fix can reproduce each other almost exactly (a tight residual) while
 * being uniformly 40 m off from reality — the fit has no way to see an
 * error shared by all its inputs. Once any point's own GPS accuracy is
 * worse than the residual threshold, that accuracy — not the residual — is
 * the honest bound on the georeference's quality.
 */
function boundByGpsInputIfCoarse(base: GeoreferenceStatus, controlPoints: ControlPoint[]): GeoreferenceStatus {
  const worst = worstControlPointAccuracy(controlPoints);
  if (worst === null || classifyAccuracyQuality(worst, MAX_ACCEPTABLE_RESIDUAL_METRES) !== 'coarse') {
    return base;
  }
  return {
    tone: base.tone,
    message: `${base.message} Bounded by GPS input, not residuals: the coarsest control point fix is only accurate to ±${worst.toFixed(0)} m, so treat this fit as no better than that even though the residuals above look tight.`,
  };
}

function describeGeoreferenceStatus(controlPoints: ControlPoint[], needsReconfirmation: boolean): GeoreferenceStatus {
  if (controlPoints.length < 2) {
    return { tone: 'muted', message: 'Not georeferenced — place at least 2 points' };
  }

  // The map image was swapped out from under these points this session.
  // Their x/y percentages still solve to *a* transform, but it's a
  // transform for pixels in an image that's no longer on screen — a
  // residual or "ok" verdict computed from it isn't a worse number, it's a
  // meaningless one, and printing it invites an operator to judge whether
  // 4.2 m is acceptable for a fit that no longer means anything. Say what
  // happened instead. Checked before solveGeoreference runs at all, so a
  // stale-but-degenerate point set doesn't fall through to the degenerate
  // message below — the actionable fact right now is "re-confirm," not
  // "these happen to be collinear too."
  if (needsReconfirmation) {
    return {
      tone: 'stale',
      message:
        'Map image replaced — these control points were placed on the previous image and need to be re-confirmed. Nudge each point onto its landmark on the new map; there is no need to remove and re-place them.',
    };
  }

  // solveGeoreference only reads controlPoints; version/updatedAt are
  // irrelevant for this live preview and are never persisted from here.
  const georeference: Georeference = {
    controlPoints,
    version: 0,
    updatedAt: 0,
  };
  const transform = solveGeoreference(georeference);

  if (!transform) {
    return {
      tone: 'warn',
      message:
        'These points are degenerate (coincident or collinear) and cannot define a transform — move at least two of them apart.',
    };
  }

  if (controlPoints.length === 2) {
    return boundByGpsInputIfCoarse(
      { tone: 'ok', message: 'Georeferenced — similarity fit (rotation + uniform scale, no shear)' },
      controlPoints
    );
  }

  // For 3+ points the affine fit is least-squares, not exact (see
  // georeferenceResiduals doc comment) — surface the fit error so an
  // operator can tell a tight fit from one where a mistyped control point
  // is quietly dragging the whole transform off.
  const residuals = georeferenceResiduals(georeference);
  if (residuals) {
    const maxMetres = residuals.maxMetres.toFixed(1);
    const rmsMetres = residuals.rmsMetres.toFixed(1);

    if (residuals.maxMetres > MAX_ACCEPTABLE_RESIDUAL_METRES) {
      return {
        tone: 'warn',
        message: `Fit error too large (max ${maxMetres} m) — this georeference is too inaccurate to use for geospatial export. Re-check the control point coordinates.`,
      };
    }

    return boundByGpsInputIfCoarse(
      {
        tone: 'ok',
        message: `Georeferenced — least-squares affine fit (${controlPoints.length} points), max error ${maxMetres} m, RMS ${rmsMetres} m`,
      },
      controlPoints
    );
  }

  return boundByGpsInputIfCoarse(
    { tone: 'ok', message: `Georeferenced — least-squares affine fit (${controlPoints.length} points)` },
    controlPoints
  );
}

interface ControlPointRowProps {
  point: ControlPoint;
  index: number;
  onUpdate: (index: number, patch: Partial<ControlPoint>) => void;
  onRemove: (index: number) => void;
}

function ControlPointRow({ point, index, onUpdate, onRemove }: ControlPointRowProps) {
  const [latText, setLatText] = useState(String(point.lat));
  const [lonText, setLonText] = useState(String(point.lon));
  const [latError, setLatError] = useState<string | null>(null);
  const [lonError, setLonError] = useState<string | null>(null);

  // Tracks the last value we committed upstream, so an external change
  // (e.g. removing a different row shifts this one's point) resyncs the
  // text field, while an echo of our own commit does not clobber what the
  // user is mid-typing (e.g. "1.50" getting reformatted to "1.5").
  const lastCommittedLat = useRef(point.lat);
  const lastCommittedLon = useRef(point.lon);

  // One hook instance per row, rather than one shared instance lifted to
  // GeoreferenceSection or the page: a fix this row requests can only ever
  // land in this row's own `location`/`status`, so there is no "which row
  // is waiting for a fix" bookkeeping to get wrong when another row's
  // button is pressed in between.
  const geo = useDeviceLocation();

  // Identifies the last fix already written into this point, so re-renders
  // (onUpdate is a fresh closure most renders — the parent doesn't memoize
  // it) don't re-fire onUpdate for a fix that was already applied.
  const appliedFixTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (geo.status !== 'granted' || !geo.location) return;
    if (appliedFixTimestampRef.current === geo.location.timestamp) return;
    appliedFixTimestampRef.current = geo.location.timestamp;

    const { lat, lon, accuracy } = geo.location;
    // Resync the text fields the same way an external prop change does
    // (see the lat/lon effects below) — a device fix is exactly that, an
    // update this row didn't type.
    lastCommittedLat.current = lat;
    lastCommittedLon.current = lon;
    setLatText(String(lat));
    setLonText(String(lon));
    setLatError(null);
    setLonError(null);
    onUpdate(index, { lat, lon, accuracy });
  }, [geo.status, geo.location, index, onUpdate]);

  useEffect(() => {
    if (point.lat !== lastCommittedLat.current) {
      setLatText(String(point.lat));
      lastCommittedLat.current = point.lat;
      setLatError(null);
    }
  }, [point.lat]);

  useEffect(() => {
    if (point.lon !== lastCommittedLon.current) {
      setLonText(String(point.lon));
      lastCommittedLon.current = point.lon;
      setLonError(null);
    }
  }, [point.lon]);

  const handleLatChange = (value: string) => {
    setLatText(value);
    const parsed = Number(value);
    if (value.trim() === '' || !Number.isFinite(parsed)) {
      setLatError('Latitude must be a number');
      return;
    }
    if (parsed < -90 || parsed > 90) {
      setLatError('Latitude must be between -90 and 90');
      return;
    }
    setLatError(null);
    lastCommittedLat.current = parsed;
    onUpdate(index, { lat: parsed });
  };

  const handleLonChange = (value: string) => {
    setLonText(value);
    const parsed = Number(value);
    if (value.trim() === '' || !Number.isFinite(parsed)) {
      setLonError('Longitude must be a number');
      return;
    }
    if (parsed < -180 || parsed > 180) {
      setLonError('Longitude must be between -180 and 180');
      return;
    }
    setLonError(null);
    lastCommittedLon.current = parsed;
    onUpdate(index, { lon: parsed });
  };

  const handleUseMyLocation = () => geo.request();

  // Computed directly from navigator/window rather than read off `geo.error`
  // — this is the exact reasoning the hook itself uses to decide the button
  // should be disabled (see getGeolocationUnsupportedReason's doc comment on
  // why plain-HTTP LAN deployments matter here), and it's available even
  // before the hook's mount effect has had a chance to run.
  const unsupportedReason =
    geo.status === 'unsupported'
      ? getGeolocationUnsupportedReason(
          typeof navigator !== 'undefined' && !!navigator.geolocation,
          typeof window !== 'undefined' && window.isSecureContext === true
        )
      : null;

  const accuracyQuality = point.accuracy !== undefined ? classifyAccuracyQuality(point.accuracy, MAX_ACCEPTABLE_RESIDUAL_METRES) : null;

  const locateButtonTooltip =
    geo.status === 'unsupported'
      ? unsupportedReason ?? 'Geolocation is not available in this browser.'
      : geo.status === 'denied'
      ? 'Location permission was denied — re-enable it for this site in your browser settings, then try again.'
      : geo.status === 'prompting'
      ? 'Waiting for a location fix…'
      : 'Use my current device location for this point';

  return (
    <Card isBlurred className="border-2 rounded-2xl border-default-200 bg-transparent">
      <div className="flex flex-col gap-2 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-status-orange bg-status-orange/20 text-[10px] font-semibold text-status-orange">
              {index + 1}
            </span>
            <span className="text-xs text-surface-faint">
              {point.x.toFixed(1)}%, {point.y.toFixed(1)}%
            </span>
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={() => onRemove(index)}
            aria-label={`Remove control point ${index + 1}`}
            className="min-w-6 w-6 h-6"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-start gap-2">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <div>
              <Input
                aria-label={`Control point ${index + 1} latitude`}
                value={latText}
                onValueChange={handleLatChange}
                placeholder="Latitude"
                size="sm"
                variant="flat"
                isInvalid={!!latError}
                classNames={{
                  input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                  inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep',
                }}
              />
              {latError && <p className="mt-1 text-xs text-status-red">{latError}</p>}
            </div>
            <div>
              <Input
                aria-label={`Control point ${index + 1} longitude`}
                value={lonText}
                onValueChange={handleLonChange}
                placeholder="Longitude"
                size="sm"
                variant="flat"
                isInvalid={!!lonError}
                classNames={{
                  input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                  inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep',
                }}
              />
              {lonError && <p className="mt-1 text-xs text-status-red">{lonError}</p>}
            </div>
          </div>
          <Tooltip content={locateButtonTooltip} placement="top">
            {/* span wrapper: HeroUI's Tooltip needs a trigger that still
                receives pointer events when the button inside is disabled,
                otherwise a disabled button (unsupported/prompting) never
                fires the hover that would explain why. */}
            <span className="mt-0.5 inline-block flex-shrink-0">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={handleUseMyLocation}
                isDisabled={geo.status === 'unsupported' || geo.status === 'prompting'}
                aria-label={`Use my current device location for control point ${index + 1}`}
                className="min-w-8 w-8 h-8"
              >
                {geo.status === 'prompting' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LocateFixed className="h-3.5 w-3.5" />
                )}
              </Button>
            </span>
          </Tooltip>
        </div>

        {/* Accuracy readout: only appears once a point has one, which today
            means only a point placed via "Use my location" — hand-entered
            coordinates carry no accuracy figure and should not be made to
            look like they have one. */}
        {point.accuracy !== undefined && (
          <span className={cn('text-xs', accuracyQuality === 'coarse' ? 'text-status-orange' : 'text-surface-faint')}>
            ±{Math.round(point.accuracy)} m accuracy
          </span>
        )}

        {/* Coarse-fix warning: visible, not blocking (see task rationale —
            the operator may have no better option than a coarse fix, and
            this codebase's convention is honest degradation over refusal).
            It must still be impossible to miss, hence full-width and
            icon-led rather than folded into the small accuracy label above. */}
        {accuracyQuality === 'coarse' && point.accuracy !== undefined && (
          <div className="flex items-start gap-1.5 rounded-lg border border-status-orange/50 px-2 py-1.5 text-xs text-status-orange">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>
              This fix is only accurate to ±{Math.round(point.accuracy)} m — too coarse to calibrate against
              (need ≤{MAX_ACCEPTABLE_RESIDUAL_METRES} m). Try again outdoors or away from buildings if you can;
              otherwise this point can still be used, but the georeference will be no more accurate than this fix.
            </span>
          </div>
        )}

        {geo.status === 'denied' && (
          <p className="text-xs text-status-red">
            {geo.error ?? 'Location permission was denied — re-enable it for this site in your browser settings, then try again.'}
          </p>
        )}
        {geo.status === 'error' && (
          <p className="text-xs text-status-red">{geo.error ?? 'Location request failed.'}</p>
        )}

        <Input
          aria-label={`Control point ${index + 1} label`}
          value={point.label ?? ''}
          onValueChange={(value) => onUpdate(index, { label: value })}
          placeholder="Label (optional)"
          size="sm"
          variant="flat"
          classNames={{
            input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
            inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep',
          }}
        />
      </div>
    </Card>
  );
}

export default function GeoreferenceSection({
  controlPoints,
  needsReconfirmation,
  onUpdatePoint,
  onRemovePoint,
  onClearAll,
}: GeoreferenceSectionProps) {
  const status = describeGeoreferenceStatus(controlPoints, needsReconfirmation);

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-sm font-medium text-surface-light">
          Georeference <span className="text-surface-light text-xs">(Optional)</span>
        </label>
        {controlPoints.length > 0 && (
          <Button size="sm" variant="light" color="danger" onPress={onClearAll}>
            Clear all
          </Button>
        )}
      </div>

      <div
        className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
          status.tone === 'ok'
            ? 'border-status-blue/50 text-status-blue'
            : status.tone === 'warn'
            ? 'border-status-red/50 text-status-red'
            : status.tone === 'stale'
            ? 'border-status-orange/50 text-status-orange'
            : 'border-surface-liner text-surface-faint'
        }`}
      >
        {status.tone === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
        {status.tone === 'warn' && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
        {status.tone === 'muted' && <Crosshair className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
        {status.tone === 'stale' && <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
        <span>{status.message}</span>
      </div>

      {controlPoints.length > 0 ? (
        <ScrollShadow className="space-y-2 pr-2 max-h-[calc(100vh-430px)] scrollbar-hide">
          {controlPoints.map((point, idx) => (
            <ControlPointRow
              key={idx}
              point={point}
              index={idx}
              onUpdate={onUpdatePoint}
              onRemove={onRemovePoint}
            />
          ))}
        </ScrollShadow>
      ) : (
        <p className="text-xs text-surface-faint">
          Turn on georeference mode and click the map to place control points.
        </p>
      )}
    </>
  );
}
