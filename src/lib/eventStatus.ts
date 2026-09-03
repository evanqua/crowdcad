import type { Event } from '@/app/types';

const HOUR_MS = 60 * 60 * 1000;

const toTimestamp = (value: string | number | undefined | null): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const ts = typeof value === 'number' ? value : Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

/**
 * The event's own designated end (event setup's End Time), mirroring the
 * field-resolution order `analyticsUtils.getScheduleWindow` uses for the
 * summary page's reporting window.
 */
export function getEventEndTime(
  event: Pick<Event, 'postingEnd' | 'scheduleEnd' | 'endTime' | 'end'>
): number | null {
  const endFields: (string | number | undefined)[] = [
    event.postingEnd,
    event.scheduleEnd,
    event.endTime,
    event.end,
  ];
  for (const value of endFields) {
    const ts = toTimestamp(value);
    if (ts !== null) return ts;
  }
  return null;
}

/**
 * Most recent timestamp across every dispatch log entry recorded for the
 * event (call, team, and supervisor logs) — the "any dispatch information
 * logs" signal used to auto-end an event nobody remembered to end manually.
 */
export function getLastActivityTimestamp(
  event: Pick<Event, 'calls' | 'staff' | 'supervisor' | 'createdAt'>
): number | null {
  let latest: number | null = null;
  const consider = (ts: number | undefined) => {
    if (typeof ts === 'number' && (latest === null || ts > latest)) latest = ts;
  };

  (event.calls || []).forEach((call) => (call.log || []).forEach((entry) => consider(entry.timestamp)));
  (event.staff || []).forEach((staff) => (staff.log || []).forEach((entry) => consider(entry.timestamp)));
  (event.supervisor || []).forEach((sup) => (sup.log || []).forEach((entry) => consider(entry.timestamp)));

  if (latest === null) {
    const created = toTimestamp(event.createdAt);
    if (created !== null) latest = created;
  }

  return latest;
}

/**
 * The true end of the reporting window for an event, no matter how old or
 * forgotten it is: whichever comes later of the event's own designated end
 * time and one hour past the last dispatch log entry recorded for it — the
 * same backstop `isEventEnded` uses, so charts/stats never cut off activity
 * that ran past a stale scheduled end, and never stay unbounded for an
 * event nobody remembered to end. An explicitly-ended event uses the moment
 * it was actually ended instead, a deliberate stop rather than an inferred one.
 */
export function getEffectiveEndTime(event: Event): number | null {
  if (event.ended && typeof event.endedAt === 'number') {
    return event.endedAt;
  }

  const designatedEnd = getEventEndTime(event);
  const lastActivity = getLastActivityTimestamp(event);
  const activityBackstop = lastActivity !== null ? lastActivity + HOUR_MS : null;

  if (designatedEnd === null) return activityBackstop;
  if (activityBackstop === null) return designatedEnd;
  return Math.max(designatedEnd, activityBackstop);
}

/**
 * Whether data collection should be considered stopped for this event:
 * either a dispatcher explicitly ended it, or its designated end time has
 * passed and an hour has gone by with no dispatch activity logged since —
 * a backup for events nobody remembers to end manually.
 */
export function isEventEnded(event: Event, now: number = Date.now()): boolean {
  if (event.ended) return true;

  const endTime = getEventEndTime(event);
  if (endTime === null || now < endTime) return false;

  const lastActivity = getLastActivityTimestamp(event) ?? endTime;
  return now - lastActivity >= HOUR_MS;
}
