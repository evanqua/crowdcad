'use client';

import React from 'react';

export interface InsightStatItem {
  key: string;
  label: string;
  count: number;
  colorClass?: string;
}

/**
 * Inline row of label:value stats used in place of the old single
 * "Total Calls: N" / "Total Patients: N" line above the Calls/Clinic tables.
 * Items sit on one line at tab-label size, separated by a vertical divider
 * rather than individually boxed.
 */
export function TrackingInsightsRow({ items }: { items: InsightStatItem[] }) {
  return (
    <div className="flex items-center flex-wrap divide-x divide-surface-liner" data-testid="tracking-insights-row">
      {items.map(item => (
        <div key={item.key} className="flex items-baseline gap-1.5 px-3 first:pl-0 text-[15px] sm:text-base font-semibold whitespace-nowrap">
          <span className="text-surface-faint">{item.label}:</span>
          <span className={`tabular-nums ${item.colorClass || 'text-surface-light'}`}>{item.count}</span>
        </div>
      ))}
    </div>
  );
}
