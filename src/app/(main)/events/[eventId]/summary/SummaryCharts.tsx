'use client';

import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { STATUS_COLORS_HEX } from '@/lib/colorTokens';
import type { TeamStatusBreakdown, AvailabilityPoint } from '@/lib/analyticsUtils';
import { GRID_WRAPPER, GRID_CELL } from './summaryGrid';

type Interaction = { sessionId: string; startTime: string; duration: number; clicks: number; keystrokes: number };

// Recharts' Tooltip defaults to a white content box, unreadable against
// this app's dark theme — everything else on these charts stays default,
// but the tooltip needs at least a themed background/text to be legible.
const TOOLTIP_CONTENT_STYLE = {
  background: 'hsl(var(--surface-bg-0))',
  border: '1px solid hsl(var(--surface-border))',
  borderRadius: 8,
};
const TOOLTIP_LABEL_STYLE = { color: 'hsl(var(--surface-text-strong))' };
const TOOLTIP_ITEM_STYLE = { color: 'hsl(var(--surface-text-strong))' };

export default function SummaryCharts({
  teamStatusBreakdown = [] as TeamStatusBreakdown[],
  availabilitySeries = [] as AvailabilityPoint[],
  interactionTimeline = [] as Interaction[],
}: {
  teamStatusBreakdown?: TeamStatusBreakdown[];
  availabilitySeries?: AvailabilityPoint[];
  interactionTimeline?: Interaction[];
}) {
  return (
    <>
      <div className={GRID_WRAPPER}>
        <div className={`${GRID_CELL} p-6`}>
          <h2 className="text-xl font-semibold mb-4">Total Team Availability</h2>
          <div className="w-full h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              {/* One bar per 10 minutes of the event (see teamAvailabilitySeries)
                  — interval={5} skips 5 of every 6 ticks so the x-axis still
                  only labels the top of each hour. */}
              <BarChart data={availabilitySeries} margin={{ top: 8, right: 16, left: 12, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={5} />
                <YAxis allowDecimals={false} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  formatter={(value) => {
                    const normalized = Array.isArray(value) ? value[0] : value;
                    return [`${Number(normalized ?? 0)}%`, 'Avg. teams available'];
                  }}
                />
                <Bar dataKey="availability" name="Teams available" fill={STATUS_COLORS_HEX.green} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${GRID_CELL} p-6`}>
          <h2 className="text-xl font-semibold mb-4">Team Status Breakdown</h2>
          <div className="w-full h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={teamStatusBreakdown} margin={{ top: 8, right: 16, left: 12, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team" />
                <YAxis yAxisId="pct" allowDecimals={false} unit="%" domain={[0, 100]} />
                <YAxis yAxisId="calls" orientation="right" allowDecimals={false} />
                {/* No itemStyle color override here (unlike the other
                    tooltips) — Recharts colors each row by its series'
                    own fill/stroke by default, so leaving it unset makes
                    each status's tooltip text match its bar color. */}
                <Tooltip
                  contentStyle={TOOLTIP_CONTENT_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(value, name, entry) =>
                    entry?.dataKey === 'calls' ? [value, name] : [`${value}%`, name]
                  }
                />
                <Legend />
                <Bar yAxisId="pct" stackId="status" dataKey="available" name="Available" fill={STATUS_COLORS_HEX.green} isAnimationActive={false} />
                <Bar yAxisId="pct" stackId="status" dataKey="onBreak" name="On Break" fill={STATUS_COLORS_HEX.blue} isAnimationActive={false} />
                <Bar yAxisId="pct" stackId="status" dataKey="inClinic" name="In Clinic" fill={STATUS_COLORS_HEX.orange} isAnimationActive={false} />
                <Bar yAxisId="pct" stackId="status" dataKey="onCalls" name="On Calls" fill={STATUS_COLORS_HEX.red} isAnimationActive={false} />
                <Line yAxisId="calls" dataKey="calls" name="Calls attached" stroke="currentColor" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {interactionTimeline && interactionTimeline.length > 0 && (
        <div className={`grid grid-cols-1 lg:grid-cols-2 ${GRID_WRAPPER}`}>
          <div className={`${GRID_CELL} p-6`}>
            <h2 className="text-xl font-semibold mb-4">Session Activity</h2>
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={interactionTimeline} margin={{ top: 8, right: 16, left: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sessionId" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                  <Legend />
                  <Bar dataKey="clicks" name="Mouse Clicks" fill="#8884d8" isAnimationActive={false} />
                  <Bar dataKey="keystrokes" name="Keystrokes" fill="#82ca9d" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${GRID_CELL} p-6`}>
            <h2 className="text-xl font-semibold mb-4">Session Durations</h2>
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={interactionTimeline} margin={{ top: 8, right: 16, left: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="startTime" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    formatter={(value) => {
                      const normalized = Array.isArray(value) ? value[0] : value;
                      return [`${Number(normalized ?? 0).toFixed(1)} min`, 'Duration'];
                    }}
                  />
                  <Line type="monotone" dataKey="duration" name="Duration" stroke="#8884d8" strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
