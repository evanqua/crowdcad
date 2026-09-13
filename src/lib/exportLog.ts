import type { Call, Event } from '@/app/types';
import { getCallZoneIds } from '@/lib/zones';
import { isCallResolved } from '@/lib/clinics';

export type ExportVariant = 'summary' | 'detail';
export type AgeMode = 'exact' | 'bucketed';
export type TimeMode = 'exact' | 'rounded';
export type LocationMode = 'exact' | 'zone';

export interface ExportLogOptions {
  variant: ExportVariant;
  ageMode: AgeMode;
  timeMode: TimeMode;
  /** Only used when timeMode === 'rounded'. */
  roundingMinutes: number;
  locationMode: LocationMode;
  includeNotes: boolean;
  /** Assigned team and transport unit, i.e. anything identifying which staff or crew responded. */
  includeTeam: boolean;
}

/** Full detail, nothing anonymized, by default. Each field is dialed down individually via a toggle. */
export const DEFAULT_EXPORT_OPTIONS: ExportLogOptions = {
  variant: 'detail',
  ageMode: 'exact',
  timeMode: 'exact',
  roundingMinutes: 30,
  locationMode: 'exact',
  includeNotes: true,
  includeTeam: true,
};

const AGE_BANDS: { max: number; label: string }[] = [
  { max: 17, label: '<18' },
  { max: 25, label: '18-25' },
  { max: 40, label: '26-40' },
  { max: 60, label: '41-60' },
];

export function bucketAge(age?: string): string {
  const match = age?.match(/^\d+/);
  if (!match) return 'Unknown';
  const years = parseInt(match[0], 10);
  const band = AGE_BANDS.find((b) => years <= b.max);
  return band ? band.label : '61+';
}

export function roundTimestamp(timestamp: number, minutes: number): number {
  const ms = minutes * 60000;
  return Math.round(timestamp / ms) * ms;
}

const pad = (n: number) => n.toString().padStart(2, '0');

export function formatTimestamp(timestamp: number, mode: TimeMode, roundingMinutes: number): string {
  const effective = mode === 'rounded' ? roundTimestamp(timestamp, roundingMinutes) : timestamp;
  const d = new Date(effective);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function resolveLocationLabel(call: Call, event: Event, mode: LocationMode): string {
  if (mode === 'exact') return call.location || '';
  const layers = event.venue?.layers ?? [];
  const zoneIds = getCallZoneIds(call, layers);
  if (zoneIds.length === 0) return 'Unzoned';
  const names = zoneIds
    .map((id) => event.dispatchZones?.find((z) => z.id === id)?.name)
    .filter((name): name is string => !!name);
  return names.length > 0 ? names.join(' / ') : 'Unzoned';
}

/** Matches the transport predicate used by the event summary page's totalTransports calc, so the two exports never disagree on what counts as a transport. */
export function isTransport(call: Call): boolean {
  return (
    call.outcome === 'Transported' ||
    call.outcome === 'Rolled from Clinic' ||
    call.status === 'Rolled from Scene' ||
    !!call.detachedTeams?.some((dt) => dt.reason === 'Rolled from Scene')
  );
}

function callFirstTimestamp(call: Call): number | undefined {
  return call.log && call.log.length > 0 ? call.log[0].timestamp : undefined;
}

export function buildDetailRows(event: Event, options: ExportLogOptions): string[][] {
  const header = ['Call #', 'Date', 'Time', 'Location', 'Chief Complaint', 'Age', 'Gender', 'Outcome', 'Transported'];
  if (options.includeTeam) header.push('Assigned Team', 'Transport Unit');
  if (options.includeNotes) header.push('Notes');

  const rows = event.calls.map((call) => {
    const ts = callFirstTimestamp(call);
    const dateTime = ts !== undefined ? formatTimestamp(ts, options.timeMode, options.roundingMinutes) : '';
    const [date, time] = dateTime.split(' ');

    const age = options.ageMode === 'bucketed' ? bucketAge(call.age) : (call.age || '');

    const row = [
      String(call.order),
      date || '',
      time || '',
      resolveLocationLabel(call, event, options.locationMode),
      call.chiefComplaint || '',
      age,
      call.gender || '',
      call.outcome || call.status || '',
      isTransport(call) ? 'Y' : 'N',
    ];
    if (options.includeTeam) row.push((call.assignedTeam || []).join('; '), call.transportUnit || '');
    if (options.includeNotes) row.push(call.notes || '');
    return row;
  });

  return [header, ...rows];
}

export function buildSummaryRows(event: Event): string[][] {
  const calls = event.calls;
  const total = calls.length;
  const resolved = calls.filter(isCallResolved).length;
  const transports = calls.filter(isTransport).length;

  const rows: string[][] = [
    ['Metric', 'Count'],
    ['Total Calls', String(total)],
    ['Resolved Calls', String(resolved)],
    ['Total Transports', String(transports)],
  ];

  const byOutcome = new Map<string, number>();
  calls.forEach((c) => {
    const key = c.outcome || 'None';
    byOutcome.set(key, (byOutcome.get(key) || 0) + 1);
  });
  rows.push([], ['By Outcome', '']);
  byOutcome.forEach((count, outcome) => rows.push([outcome, String(count)]));

  if (event.dispatchZones && event.dispatchZones.length > 0) {
    const byZone = new Map<string, number>();
    calls.forEach((c) => {
      const label = resolveLocationLabel(c, event, 'zone');
      byZone.set(label, (byZone.get(label) || 0) + 1);
    });
    rows.push([], ['By Zone', '']);
    byZone.forEach((count, zone) => rows.push([zone, String(count)]));
  }

  const byHour = new Map<number, number>();
  calls.forEach((c) => {
    const ts = callFirstTimestamp(c);
    if (ts === undefined) return;
    const hour = new Date(roundTimestamp(ts, 60)).getHours();
    byHour.set(hour, (byHour.get(hour) || 0) + 1);
  });
  if (byHour.size > 0) {
    rows.push([], ['By Hour', '']);
    Array.from(byHour.keys())
      .sort((a, b) => a - b)
      .forEach((hour) => rows.push([`${pad(hour)}:00`, String(byHour.get(hour))]));
  }

  return rows;
}

function escapeCsvField(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\n');
}

export function buildExportFilename(eventName: string, variant: ExportVariant): string {
  const safeName = (eventName || 'Event').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
  const kind = variant === 'summary' ? 'Summary' : 'Log';
  const date = new Date().toISOString().slice(0, 10);
  return `${safeName}_${kind}_${date}.csv`;
}
