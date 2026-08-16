"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, Input, ScrollShadow } from '@heroui/react';
import { AlertTriangle, CheckCircle2, Crosshair, Trash2 } from 'lucide-react';
import type { ControlPoint, Georeference } from '@/app/types';
import { solveGeoreference } from '@/lib/geoUtils';

interface GeoreferenceSectionProps {
  controlPoints: ControlPoint[];
  onUpdatePoint: (index: number, patch: Partial<ControlPoint>) => void;
  onRemovePoint: (index: number) => void;
  onClearAll: () => void;
}

interface GeoreferenceStatus {
  tone: 'muted' | 'ok' | 'warn';
  message: string;
}

function describeGeoreferenceStatus(controlPoints: ControlPoint[]): GeoreferenceStatus {
  if (controlPoints.length < 2) {
    return { tone: 'muted', message: 'Not georeferenced — place at least 2 points' };
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
    return {
      tone: 'ok',
      message: 'Georeferenced — similarity fit (rotation + uniform scale, no shear)',
    };
  }

  return {
    tone: 'ok',
    message: `Georeferenced — least-squares affine fit (${controlPoints.length} points)`,
  };
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
        <div className="grid grid-cols-2 gap-2">
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
  onUpdatePoint,
  onRemovePoint,
  onClearAll,
}: GeoreferenceSectionProps) {
  const status = describeGeoreferenceStatus(controlPoints);

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
            : 'border-surface-liner text-surface-faint'
        }`}
      >
        {status.tone === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
        {status.tone === 'warn' && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
        {status.tone === 'muted' && <Crosshair className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
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
