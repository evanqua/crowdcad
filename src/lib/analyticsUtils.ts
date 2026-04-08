import { Event } from '@/app/types';

const TWO_HOURS = 2 * 60 * 60 * 1000;

export type HourlySeriesPoint = {
  ts: number;
  label: string;
  count: number;
};

export function getScheduleWindow(event: Event): { start: number; end: number } {
  const getNum = (v: unknown): number | undefined => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const parsed = Date.parse(v);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };

  const startFields = ['postingStart', 'scheduleStart', 'startTime', 'start'];
  const endFields = ['postingEnd', 'scheduleEnd', 'endTime', 'end'];

  const starts = startFields
    .map((k) => getNum(event[k as keyof Event]))
    .filter(Boolean) as number[];

  const ends = endFields
    .map((k) => getNum(event[k as keyof Event]))
    .filter(Boolean) as number[];

  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const call of event.calls || []) {
    for (const entry of call.log || []) {
      if (typeof entry.timestamp === 'number') {
        if (entry.timestamp < minTs) minTs = entry.timestamp;
        if (entry.timestamp > maxTs) maxTs = entry.timestamp;
      }
    }
  }

  const derivedStart = Number.isFinite(minTs) ? minTs : Date.now();
  const derivedEnd = Number.isFinite(maxTs) ? maxTs : derivedStart + 4 * 60 * 60 * 1000;

  const start = (starts.length ? Math.min(...starts) : derivedStart) - TWO_HOURS;
  const end = (ends.length ? Math.max(...ends) : derivedEnd) + TWO_HOURS;
  return { start, end };
}

export function buildHourlySeries(event: Event, start: number, end: number): HourlySeriesPoint[] {
  const hour = 60 * 60 * 1000;
  const s = Math.floor(start / hour) * hour;
  const e = Math.ceil(end / hour) * hour;
  const buckets: HourlySeriesPoint[] = [];

  const pad2 = (n: number) => String(n).padStart(2, '0');

  for (let t = s; t <= e; t += hour) {
    const d = new Date(t);
    const label = `${pad2(d.getHours())}:00`;
    buckets.push({ ts: t, label, count: 0 });
  }

  for (const call of event.calls || []) {
    const firstTs = (call.log || []).reduce<number | null>((min, entry) => {
      if (typeof entry.timestamp !== 'number') return min;
      return min == null ? entry.timestamp : Math.min(min, entry.timestamp);
    }, null);

    if (firstTs == null || firstTs < s || firstTs > e) continue;
    const idx = Math.floor((firstTs - s) / hour);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
  }

  return buckets;
}

export function callsByTeam(event: Event): { team: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const call of event.calls || []) {
    const assigned = call.assignedTeam ?? [];
    const detached = (call.detachedTeams ?? []).map((d) => d.team);
    const involved = new Set([...assigned, ...detached].filter(Boolean));

    for (const team of involved) counts[team] = (counts[team] ?? 0) + 1;
  }

  return Object.entries(counts).map(([team, count]) => ({ team, count }));
}

export function teamPieData(event: Event): { name: string; value: number }[] {
  return callsByTeam(event).map((d) => ({ name: d.team || 'Unassigned', value: d.count }));
}
