'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie,
  LineChart, Line
} from 'recharts';
import { Card, CardBody } from '@heroui/react';

type HourBucket = { ts: number; label: string; count: number };
type PieSlice = { name: string; value: number };
type Interaction = { sessionId: string; startTime: string; duration: number; clicks: number; keystrokes: number };

export default function SummaryCharts({
  perHourSeries = [] as HourBucket[],
  pieSeries = [] as PieSlice[],
  interactionTimeline = [] as Interaction[],
  THEME = {},
  PIE_COLORS = [],
}: {
  perHourSeries?: HourBucket[];
  pieSeries?: PieSlice[];
  interactionTimeline?: Interaction[];
  THEME?: Record<string, string>;
  PIE_COLORS?: string[];
}) {
  return (
    <>
      <Card isBlurred className="bg-surface-deep/60 border border-default-200">
        <CardBody className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-semibold">Calls per Hour</h2>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-liner, #374151)' }}>
            <div className="w-full h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perHourSeries} margin={{ top: 8, right: 16, left: 12, bottom: 12 }}>
                  <CartesianGrid
                    stroke={THEME.grid}
                    strokeOpacity={0.35}
                    vertical={true}
                    horizontal={true}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: THEME.tickStrong, fontWeight: 600 }}
                    axisLine={{ stroke: THEME.axis }}
                    tickLine={{ stroke: THEME.axis }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: THEME.tickStrong, fontWeight: 600 }}
                    axisLine={{ stroke: THEME.axis }}
                    tickLine={{ stroke: THEME.axis }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: THEME.tooltipBg,
                      border: `1px solid ${THEME.tooltipBorder}`,
                      borderRadius: 12,
                      color: THEME.tooltipText,
                    }}
                    itemStyle={{ color: THEME.tooltipText }}
                    labelStyle={{ color: THEME.tooltipText, fontWeight: 600 }}
                  />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]} fill={THEME.barFill} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card isBlurred className="bg-surface-deep/60 border border-default-200">
        <CardBody className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-semibold">Calls by Team</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-[360px] pl-12">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieSeries}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="65%"
                    outerRadius="100%"
                    paddingAngle={2}
                  >
                    {pieSeries.map((_s: PieSlice, i: number) => (
                      <Cell
                        key={i}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: THEME.tooltipBg,
                      border: `1px solid ${THEME.tooltipBorder}`,
                      borderRadius: 12,
                      color: THEME.tooltipText,
                    }}
                    itemStyle={{ color: THEME.tooltipText }}
                    labelStyle={{ color: THEME.tooltipText, fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="space-y-2 pl-6">
              {pieSeries.map((d: PieSlice, i: number) => (
                <li key={d.name} className="flex items-center gap-2 min-w-0">
                  <span className="inline-block w-3 h-3 rounded shrink-0"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-sm text-surface-light font-semibold truncate">{d.name}</span>
                  <span className="text-surface-faint text-sm tabular-nums ml-2 shrink-0">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>

      {interactionTimeline && interactionTimeline.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card isBlurred className="bg-surface-deep/60 border border-default-200">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold">Session Activity</h2>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-liner, #374151)' }}>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={interactionTimeline} margin={{ top: 8, right: 16, left: 12, bottom: 12 }}>
                      <CartesianGrid strokeOpacity={0.35} />
                      <XAxis dataKey="sessionId" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface-deepest)',
                          border: '1px solid var(--accent)',
                          borderRadius: 12,
                        }}
                      />
                      <Bar dataKey="clicks" name="Mouse Clicks" radius={[4, 4, 0, 0]} fill="var(--accent)" isAnimationActive={false} />
                      <Bar dataKey="keystrokes" name="Keystrokes" radius={[4, 4, 0, 0]} fill="rgba(var(--ripple-accent-rgb), 0.7)" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card isBlurred className="bg-surface-deep/60 border border-default-200">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold mb-4">Session Durations</h2>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-liner, #374151)' }}>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={interactionTimeline} margin={{ top: 8, right: 16, left: 12, bottom: 12 }}>
                      <CartesianGrid strokeOpacity={0.35} />
                      <XAxis dataKey="startTime" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface-deepest)',
                          border: '1px solid var(--accent)',
                          borderRadius: 12,
                        }}
                        formatter={(value: number | string) => [`${Number(value).toFixed(1)} min`, 'Duration']}
                      />
                      <Line type="monotone" dataKey="duration" stroke="var(--accent)" strokeWidth={2} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
} 