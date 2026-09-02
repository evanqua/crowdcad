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
        <div key={item.key} className="flex items-baseline gap-1 px-3 first:pl-0 text-[15px] sm:text-base font-semibold whitespace-nowrap">
          {/* Trailing space is a real text character, not just the flex gap, so
              "Label: value" reads correctly as one accessible/selectable string
              (and matches literal "Label: N" text assertions in E2E tests). The
              gap adds visual breathing room on top of that character — relying
              on the single space alone read as too cramped next to the count. */}
          <span className="text-surface-faint">{item.label}: </span>
          <span className={`tabular-nums ${item.colorClass || 'text-surface-light'}`}>{item.count}</span>
        </div>
      ))}
    </div>
  );
}
