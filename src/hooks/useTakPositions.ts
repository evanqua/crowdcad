'use client';

import { useEffect, useMemo, useState } from 'react';
import { dbService } from '@/lib/services';
import type { QueryConstraint } from '@/lib/services';
import type { Staff, Supervisor, TakPosition, TakPositionRecord } from '@/app/types';

/**
 * Live TAK positions for one event, straight from the `tak_positions`
 * collection.
 *
 * Positions deliberately do not live on the `events` record any more. Teams are
 * a JSON array inside a single event, so storing a position there forced a
 * read-modify-write of the whole record on every GPS fix, racing the
 * dispatcher's browser with no transaction and no version token to catch the
 * lost update. Their own collection splits the writers by ownership — humans
 * edit `events`, the bridge writes `tak_positions` — so neither can clobber the
 * other, and a write per second stops being dangerous.
 *
 * The map still reads `team.tak`; `mergeTakPositions` puts it back there in
 * memory, so nothing downstream had to change.
 */

/** Trim + lowercase, matching how the bridge normalises callsigns. */
function norm(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Index positions by callsign. The newest fix wins on a duplicate, which only
 * happens if two rows somehow exist for one callsign.
 */
function indexByCallsign(records: TakPositionRecord[]): Map<string, TakPositionRecord> {
  const byCallsign = new Map<string, TakPositionRecord>();
  for (const record of records) {
    const key = norm(record.callsign);
    if (!key) continue;
    const existing = byCallsign.get(key);
    if (!existing || (record.timestamp ?? 0) >= (existing.timestamp ?? 0)) {
      byCallsign.set(key, record);
    }
  }
  return byCallsign;
}

/**
 * Find the position belonging to a team, in the same fail-closed order the
 * bridge documents:
 *
 *   1. `takCallsign` on the team — the authoritative, dispatcher-owned binding
 *   2. the bridge's `--bind` alias, recorded on the position as `boundTeam`
 *   3. an exact team-name match, for the common case where the device callsign
 *      simply is the team name
 *
 * Anything unmatched returns undefined and is never drawn. Guessing here would
 * put a responder somewhere they are not, which is worse than showing nobody.
 */
function findPosition(
  teamName: string,
  takCallsign: string | undefined,
  byCallsign: Map<string, TakPositionRecord>,
  byBoundTeam: Map<string, TakPositionRecord>,
): TakPositionRecord | undefined {
  const bound = norm(takCallsign);
  if (bound) return byCallsign.get(bound);

  const team = norm(teamName);
  if (!team) return undefined;
  return byBoundTeam.get(team) ?? byCallsign.get(team);
}

/** Strip the record-only fields so what lands on `team.tak` is a TakPosition. */
function toTakPosition(record: TakPositionRecord): TakPosition {
  return {
    lat: record.lat,
    lon: record.lon,
    x: record.x,
    y: record.y,
    onMap: record.onMap,
    timestamp: record.timestamp,
    callsign: record.callsign,
    ...(record.accuracy !== undefined && record.accuracy !== null
      ? { accuracy: record.accuracy }
      : {}),
    ...(record.staleAt !== undefined && record.staleAt !== null
      ? { staleAt: record.staleAt }
      : {}),
    ...(record.nearestPost ? { nearestPost: record.nearestPost } : {}),
  };
}

export interface TakPositionIndex {
  /** Every position reported for this event, keyed by normalised callsign. */
  byCallsign: Map<string, TakPositionRecord>;
  /** Positions carrying a `--bind` alias, keyed by normalised team name. */
  byBoundTeam: Map<string, TakPositionRecord>;
  /** True once the first snapshot has arrived, successfully or not. */
  loaded: boolean;
}

const EMPTY_INDEX: TakPositionIndex = {
  byCallsign: new Map(),
  byBoundTeam: new Map(),
  loaded: false,
};

/**
 * Subscribe to live positions for one event.
 *
 * Pass a falsy `eventId` (lite mode, or before the event loads) and this stays
 * inert — no subscription, no requests.
 */
export function useTakPositions(eventId: string | undefined | null): TakPositionIndex {
  const [records, setRecords] = useState<TakPositionRecord[] | null>(null);

  useEffect(() => {
    if (!eventId) {
      setRecords(null);
      return;
    }

    let cancelled = false;
    const constraints: QueryConstraint[] = [{ field: 'eventId', op: '==', value: eventId }];

    const unsubscribe = dbService.subscribeToQuery<TakPositionRecord>(
      'tak_positions',
      constraints,
      (snapshots) => {
        if (cancelled) return;
        const next: TakPositionRecord[] = [];
        for (const snapshot of snapshots) {
          if (snapshot.data) next.push({ ...snapshot.data, id: snapshot.id });
        }
        setRecords(next);
      },
      () => {
        // A missing collection is the normal state on the Firebase backend and
        // before setup-pocketbase.js has run. Treat it as "no positions" rather
        // than breaking the dispatch board over an optional feature.
        if (!cancelled) setRecords([]);
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [eventId]);

  return useMemo(() => {
    if (records === null) return EMPTY_INDEX;

    const byCallsign = indexByCallsign(records);
    const byBoundTeam = new Map<string, TakPositionRecord>();
    for (const record of records) {
      const key = norm(record.boundTeam);
      if (key) byBoundTeam.set(key, record);
    }
    return { byCallsign, byBoundTeam, loaded: true };
  }, [records]);
}

/**
 * Merge live positions onto a staff array, so the map can go on reading
 * `team.tak` without knowing where positions are stored.
 *
 * Returns the original array untouched when there is nothing to merge, which
 * keeps referential equality stable for memoised children.
 */
export function mergeTakPositions(staff: Staff[], index: TakPositionIndex): Staff[] {
  if (!index.loaded || index.byCallsign.size === 0) return staff;

  let changed = false;
  const merged = staff.map((team) => {
    const record = findPosition(team.team, team.takCallsign, index.byCallsign, index.byBoundTeam);
    if (!record) {
      // Drop any position left on an old event record — that field is no
      // longer written, so a value still sitting there is indefinitely old.
      if (team.tak) {
        changed = true;
        const rest = { ...team };
        delete rest.tak;
        return rest;
      }
      return team;
    }
    changed = true;
    return { ...team, tak: toTakPosition(record) };
  });

  return changed ? merged : staff;
}

/**
 * Same merge for supervisors. `Supervisor` gained `takCallsign` alongside
 * `Staff`; matching falls back to the team name when it is unset.
 */
export function mergeSupervisorTakPositions(
  supervisors: Supervisor[],
  index: TakPositionIndex,
): Supervisor[] {
  if (!index.loaded || index.byCallsign.size === 0) return supervisors;

  let changed = false;
  const merged = supervisors.map((supervisor) => {
    const record = findPosition(
      supervisor.team,
      supervisor.takCallsign,
      index.byCallsign,
      index.byBoundTeam,
    );
    if (!record) {
      if (supervisor.tak) {
        changed = true;
        const rest = { ...supervisor };
        delete rest.tak;
        return rest;
      }
      return supervisor;
    }
    changed = true;
    return { ...supervisor, tak: toTakPosition(record) };
  });

  return changed ? merged : supervisors;
}
