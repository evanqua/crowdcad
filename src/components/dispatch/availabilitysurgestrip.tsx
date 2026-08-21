'use client';

import React, { useMemo } from 'react';
import type { Event } from '@/app/types';
import { getTeamAvailabilitySummary, getSurgeLimitPercent } from '@/lib/teamAvailability';
import { useDispatchTerms } from '@/lib/dispatchVocabulary/context';

// Must stay in sync with tailwind.config.js `status.green` / `status.red`.
// Used raw (not as Tailwind classes) because the strip needs a continuous
// interpolation between the two, not one of the discrete STATUS_COLORS entries.
const STATUS_GREEN = { r: 0x98, g: 0xc3, b: 0x79 };
const STATUS_RED = { r: 0xe5, g: 0x6a, b: 0x6a };

function surgeColor(positionPercent: number, surgeLimitPercent: number): string {
  if (positionPercent <= surgeLimitPercent) {
    return `rgb(${STATUS_GREEN.r} ${STATUS_GREEN.g} ${STATUS_GREEN.b})`;
  }
  const span = Math.max(1, 100 - surgeLimitPercent);
  const t = Math.min(1, (positionPercent - surgeLimitPercent) / span);
  const r = Math.round(STATUS_GREEN.r + (STATUS_RED.r - STATUS_GREEN.r) * t);
  const g = Math.round(STATUS_GREEN.g + (STATUS_RED.g - STATUS_GREEN.g) * t);
  const b = Math.round(STATUS_GREEN.b + (STATUS_RED.b - STATUS_GREEN.b) * t);
  return `rgb(${r} ${g} ${b})`;
}

const BAR_COUNT = 14;

type Props = { event: Event };

function CountPill({ colorClass, count, label }: { colorClass: string; count: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${count} ${label}`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorClass}`} />
      <span className="text-sm text-surface-light tabular-nums">{count}</span>
    </div>
  );
}

export default function AvailabilitySurgeStrip({ event }: Props) {
  const { t } = useDispatchTerms();
  const summary = useMemo(() => getTeamAvailabilitySummary(event), [event]);
  const surgeLimitPercent = useMemo(() => getSurgeLimitPercent(event), [event]);
  const percentColor = surgeColor(summary.percentOnCalls, surgeLimitPercent);

  return (
    <div
      className="w-full flex items-center justify-between gap-4 pl-2 pr-3 py-2 border-b border-surface-liner"
      data-testid="availability-surge-strip"
    >
      <div className="flex items-center gap-3 shrink-0">
        <CountPill colorClass="bg-status-green" count={summary.available} label={t('Available')} />
        <CountPill colorClass="bg-status-blue" count={summary.onBreakOrClinic} label={t('On Break/Clinic')} />
        <CountPill colorClass="bg-status-red" count={summary.onCalls} label={t('On Calls')} />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold tabular-nums" style={{ color: percentColor }}>
          {summary.percentOnCalls}%
        </span>
        <div className="flex items-center gap-[3px] h-5" aria-hidden="true">
          {Array.from({ length: BAR_COUNT }, (_, i) => {
            const positionPercent = ((i + 1) / BAR_COUNT) * 100;
            const lit = positionPercent <= summary.percentOnCalls;
            return (
              <div
                key={i}
                className="w-[4px] h-full rounded-sm transition-opacity duration-300"
                style={{
                  backgroundColor: surgeColor(positionPercent, surgeLimitPercent),
                  opacity: lit ? 1 : 0.25,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
