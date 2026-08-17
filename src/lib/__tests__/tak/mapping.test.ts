import { describe, expect, it } from 'vitest';

import type { Call, Event, Layer, Staff, Supervisor, TakPublishSettings, Venue } from '@/app/types';
import { MAX_ACCEPTABLE_RESIDUAL_METRES } from '@/lib/geoUtils';
import { buildCotXml } from '@/lib/tak/cot';
import { DEFAULT_STALE_SECONDS, eventToCotEvents } from '@/lib/tak/mapping';
import { COT_TYPE_CODES_VERIFIED, COT_TYPE_POST, COT_TYPE_TEAM, COT_UNKNOWN } from '@/lib/tak/types';

const NOW = 1_760_000_000_000;

/**
 * Spreading a `Partial<T>` over a complete `T` widens every overridable field
 * to `| undefined` as far as TypeScript is concerned, even though the base
 * always supplies a value at runtime. This one narrow helper keeps the
 * fixture factories below readable instead of sprinkling a cast through each.
 */
function withOverrides<T extends object>(base: T, overrides: Partial<T>): T {
  return { ...base, ...overrides } as T;
}

// A clean, exactly-solvable 2-point georeference. The anti-similarity solver
// is determined (not least-squares) at 2 points, so this fit passes through
// both control points exactly and its residuals are floating-point noise —
// which keeps these tests about mapping, not about solver tolerance.
function georeferencedLayer(overrides: Partial<Layer> = {}): Layer {
  return withOverrides<Layer>({
    id: 'layer-concourse',
    name: 'Concourse',
    posts: [
      { name: 'Gate 4', x: 0, y: 0 },
      { name: 'Aid Station', x: 100, y: 100 },
      { name: 'Never Placed', x: null, y: null },
      'Legacy String Post',
    ],
    georeference: {
      controlPoints: [
        { x: 0, y: 0, lat: 39.18, lon: -86.53 },
        { x: 100, y: 100, lat: 39.19, lon: -86.52 },
      ],
      version: 1,
      updatedAt: NOW,
    },
  }, overrides);
}

function venue(layers: Layer[]): Venue {
  return { id: 'venue-1', name: 'Test Venue', equipment: [], layers, userId: 'u1' };
}

function event(overrides: Partial<Event> = {}): Event {
  return withOverrides<Event>({
    id: 'evt1',
    userId: 'u1',
    name: 'Test Event',
    date: '2026-08-16',
    venue: venue([georeferencedLayer()]),
    postingTimes: [],
    staff: [],
    supervisor: [],
    calls: [],
    eventPosts: [],
    eventEquipment: [],
  }, overrides);
}

function settings(overrides: Partial<TakPublishSettings> = {}): TakPublishSettings {
  return withOverrides<TakPublishSettings>({
    enabled: true,
    publishTeams: true,
    publishSupervisors: true,
    publishPosts: true,
    publishCalls: 'off',
  }, overrides);
}

function team(overrides: Partial<Staff> = {}): Staff {
  return withOverrides<Staff>({
    team: 'Team 3',
    location: 'Gate 4',
    status: 'Available',
    members: ['Alice'],
  }, overrides);
}

function supervisor(overrides: Partial<Supervisor> = {}): Supervisor {
  return withOverrides<Supervisor>({
    team: 'Sup 1',
    location: 'Gate 4',
    status: 'Available',
    member: 'Bob',
  }, overrides);
}

describe('eventToCotEvents — gating', () => {
  it('emits nothing and says why when publishing is disabled', () => {
    const result = eventToCotEvents(event(), venue([georeferencedLayer()]), settings({ enabled: false }), NOW);

    expect(result.events).toEqual([]);
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ reason: 'publishing-disabled' })
    );
  });

  it('propagates the unverified-type-code flag onto every result', () => {
    const result = eventToCotEvents(event(), venue([georeferencedLayer()]), settings(), NOW);
    expect(result.typeCodesVerified).toBe(COT_TYPE_CODES_VERIFIED);
  });

  it('honours each publish toggle independently', () => {
    const e = event({ staff: [team()] });
    const onlyPosts = eventToCotEvents(
      e,
      venue([georeferencedLayer()]),
      settings({ publishTeams: false, publishSupervisors: false }),
      NOW
    );
    expect(onlyPosts.events.every((c) => c.type === COT_TYPE_POST)).toBe(true);

    const onlyTeams = eventToCotEvents(
      e,
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishSupervisors: false }),
      NOW
    );
    expect(onlyTeams.events).toHaveLength(1);
    expect(onlyTeams.events[0].type).toBe(COT_TYPE_TEAM);
  });
});

describe('eventToCotEvents — georeference safety', () => {
  it('refuses a layer whose fit is worse than the acceptable residual, and reports the measured error', () => {
    // Four control points that cannot be reconciled by any single affine map:
    // three describe a consistent frame, the fourth is grossly mistyped. This
    // is the realistic failure — an operator fat-fingers one latitude — and it
    // must not silently place markers in confidently wrong locations.
    const bad = georeferencedLayer({
      georeference: {
        controlPoints: [
          { x: 0, y: 0, lat: 39.18, lon: -86.53 },
          { x: 100, y: 0, lat: 39.18, lon: -86.52 },
          { x: 0, y: 100, lat: 39.19, lon: -86.53 },
          { x: 100, y: 100, lat: 39.5, lon: -86.1 },
        ],
        version: 1,
        updatedAt: NOW,
      },
    });

    const result = eventToCotEvents(
      event({ venue: venue([bad]), staff: [team()] }),
      venue([bad]),
      settings(),
      NOW
    );

    expect(result.events).toEqual([]);
    const skip = result.skipped.find((s) => s.reason === 'layer-fit-unacceptable');
    expect(skip).toBeDefined();
    expect(skip?.detail).toMatch(/off by up to [\d.]+ m/);
    expect(skip?.detail).toContain(`limit ${MAX_ACCEPTABLE_RESIDUAL_METRES} m`);
  });

  it('skips an ungeoreferenced layer without throwing', () => {
    const plain = georeferencedLayer({ georeference: undefined });
    const result = eventToCotEvents(
      event({ venue: venue([plain]) }),
      venue([plain]),
      settings(),
      NOW
    );

    expect(result.events).toEqual([]);
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ reason: 'layer-not-georeferenced', subject: 'Concourse' })
    );
  });

  it('reports unplaced and legacy-string posts instead of dropping them silently', () => {
    const result = eventToCotEvents(event(), venue([georeferencedLayer()]), settings(), NOW);
    const unplaced = result.skipped.filter((s) => s.reason === 'post-not-placed');
    expect(unplaced.map((s) => s.subject).sort()).toEqual(['Legacy String Post', 'Never Placed']);
  });

  it('carries the georeference fit error into the marker as circular error', () => {
    const result = eventToCotEvents(event(), venue([georeferencedLayer()]), settings(), NOW);
    const gate = result.events.find((c) => c.detail?.callsign === 'Gate 4');
    // A post is only as well-located as the transform that placed it, so `ce`
    // must be the fit's own residual — never the "unknown" sentinel and never 0
    // by accident.
    expect(gate?.point.ce).toBeGreaterThanOrEqual(0);
    expect(gate?.point.ce).toBeLessThanOrEqual(MAX_ACCEPTABLE_RESIDUAL_METRES);
  });
});

describe('eventToCotEvents — team positions', () => {
  it('prefers a live GPS fix and marks it machine-derived', () => {
    const withFix = team({
      tak: { lat: 39.1855, lon: -86.5255, x: 50, y: 50, onMap: true, accuracy: 6, timestamp: NOW },
    });
    const result = eventToCotEvents(
      event({ staff: [withFix] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false }),
      NOW
    );

    const cot = result.events[0];
    expect(cot.point.lat).toBeCloseTo(39.1855, 6);
    expect(cot.point.ce).toBe(6);
    expect(cot.how).toBe('m-g');
    expect(cot.detail?.geopointsrc).toBe('GPS');
  });

  it('reports an unknown ce rather than 0 when the fix carries no accuracy', () => {
    // `accuracy` is optional on TakPosition. Substituting 0 would advertise a
    // perfect fix to every TAK client; COT_UNKNOWN says "we do not know".
    const noAccuracy = team({
      tak: { lat: 39.1855, lon: -86.5255, x: 50, y: 50, onMap: true, timestamp: NOW },
    });
    const result = eventToCotEvents(
      event({ staff: [noAccuracy] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false }),
      NOW
    );

    expect(result.events[0].point.ce).toBe(COT_UNKNOWN);
  });

  it('still publishes a fix that falls outside the venue map image', () => {
    // onMap:false is a limitation of drawing on a picture, not doubt about the
    // position. TAK has real basemaps. Falling back to the assigned post here
    // would broadcast a location we know to be wrong.
    const offMap = team({
      tak: { lat: 39.2000, lon: -86.5300, x: null, y: null, onMap: false, accuracy: 8, timestamp: NOW },
    });
    const result = eventToCotEvents(
      event({ staff: [offMap] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false }),
      NOW
    );

    const cot = result.events[0];
    expect(cot.point.lat).toBeCloseTo(39.2, 6);
    expect(cot.how).toBe('m-g');
    expect(result.skipped.find((s) => s.reason === 'position-unresolved')).toBeUndefined();
  });

  it('falls back to the assigned post and does NOT claim the result is a GPS fix', () => {
    const result = eventToCotEvents(
      event({ staff: [team()] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false }),
      NOW
    );

    const cot = result.events[0];
    // Same coordinates as the Gate 4 control point...
    expect(cot.point.lat).toBeCloseTo(39.18, 4);
    // ...but provenance must say a human put it there, not a satellite.
    expect(cot.how).toBe('h-e');
    expect(cot.detail?.geopointsrc).toBe('USER');
  });

  it('matches an assigned post case- and whitespace-insensitively', () => {
    const sloppy = team({ location: 'gate  4' });
    const result = eventToCotEvents(
      event({ staff: [sloppy] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false }),
      NOW
    );
    expect(result.events).toHaveLength(1);
  });

  it('reports a team it cannot locate rather than emitting a marker at 0,0', () => {
    const lost = team({ location: 'Nowhere In Particular' });
    const result = eventToCotEvents(
      event({ staff: [lost] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false }),
      NOW
    );

    expect(result.events).toEqual([]);
    const skip = result.skipped.find((s) => s.reason === 'position-unresolved');
    expect(skip?.subject).toBe('Team 3');
    expect(skip?.detail).toContain('Nowhere In Particular');
  });

  it('publishes the DERIVED status, so TAK and the dispatch board cannot disagree', () => {
    // The team's stored status is 'Available', but it is assigned to an open
    // call — deriveTeamVisualStatus resolves that to 'En Route', and that is
    // what the dispatch board shows. TAK must show the same thing.
    const e = event({
      staff: [team()],
      calls: [
        {
          id: 'c1',
          order: 1,
          status: 'On Scene',
          location: 'Gate 4',
          assignedTeam: ['Team 3'],
          chiefComplaint: 'x',
        },
      ],
    });
    const result = eventToCotEvents(e, venue([georeferencedLayer()]), settings({ publishPosts: false }), NOW);
    expect(result.events[0].detail?.remarks).toContain('Status: En Route');
  });

  it('applies the callsign prefix and the CoT group', () => {
    const result = eventToCotEvents(
      event({ staff: [team()] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, callsignPrefix: 'ICEMS-', cotGroup: 'Cyan' }),
      NOW
    );
    expect(result.events[0].detail?.callsign).toBe('ICEMS-Team 3');
    expect(result.events[0].detail?.groupName).toBe('Cyan');
    expect(result.events[0].detail?.groupRole).toBe('Team Member');
  });

  it('distinguishes supervisors from teams by role and UID, not by coordinates', () => {
    const e = event({
      staff: [team()],
      supervisor: [supervisor()],
    });
    const result = eventToCotEvents(e, venue([georeferencedLayer()]), settings({ publishPosts: false }), NOW);

    const sup = result.events.find((c) => c.uid.includes('.sup.'));
    expect(sup?.detail?.groupRole).toBe('Team Lead');
    expect(result.events.find((c) => c.uid.includes('.team.'))?.detail?.groupRole).toBe('Team Member');
  });
});

describe('eventToCotEvents — calls and PHI', () => {
  const phiCall: Call = {
    id: 'call-42',
    order: 7,
    status: 'On Scene',
    location: 'Gate 4',
    assignedTeam: ['Team 3'],
    chiefComplaint: 'CHIEF_COMPLAINT_SENTINEL',
    age: 'AGE_SENTINEL',
    gender: 'GENDER_SENTINEL',
    notes: 'NOTES_SENTINEL',
    log: [{ timestamp: NOW, message: 'LOG_SENTINEL' }],
  };

  it("emits no call marker at all when publishCalls is 'off'", () => {
    const result = eventToCotEvents(
      event({ calls: [phiCall] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'off' }),
      NOW
    );
    expect(result.events).toEqual([]);
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ reason: 'call-redacted', subject: 'call-42' })
    );
  });

  it('never leaks age, gender, notes, or log into serialized output in ANY mode', () => {
    for (const mode of ['location-only', 'full'] as const) {
      const result = eventToCotEvents(
        event({ calls: [phiCall] }),
        venue([georeferencedLayer()]),
        settings({ publishPosts: false, publishTeams: false, publishCalls: mode }),
        NOW
      );
      const xml = result.events.map(buildCotXml).join('\n');

      expect(xml).not.toContain('AGE_SENTINEL');
      expect(xml).not.toContain('GENDER_SENTINEL');
      expect(xml).not.toContain('NOTES_SENTINEL');
      expect(xml).not.toContain('LOG_SENTINEL');
    }
  });

  it("withholds the chief complaint in 'location-only' and permits it in 'full'", () => {
    const locationOnly = eventToCotEvents(
      event({ calls: [phiCall] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'location-only' }),
      NOW
    );
    expect(buildCotXml(locationOnly.events[0])).not.toContain('CHIEF_COMPLAINT_SENTINEL');

    const full = eventToCotEvents(
      event({ calls: [phiCall] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'full' }),
      NOW
    );
    expect(buildCotXml(full.events[0])).toContain('CHIEF_COMPLAINT_SENTINEL');
  });

  it('keeps clinical text out of the callsign even in full mode', () => {
    // The callsign is a permanent map label; remarks require opening the
    // marker. Even when the chief complaint is permitted, it must not be the
    // thing rendered next to the icon.
    const full = eventToCotEvents(
      event({ calls: [phiCall] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'full' }),
      NOW
    );
    expect(full.events[0].detail?.callsign).toBe('Call 7');
    expect(full.events[0].detail?.callsign).not.toContain('CHIEF_COMPLAINT_SENTINEL');
  });
});

describe('eventToCotEvents — call positions', () => {
  it("publishes a call with a placed pin at that pin's lat/lon, not at a matching post", () => {
    // Deliberately make the post coordinates different from the pin to verify
    // precedence. If the test passes with position being ignored, this would
    // fail because the post is at (39.18, -86.53) and we assert the call is
    // published at (39.19, -86.52).
    const callWithPin: Call = {
      id: 'call-with-pin',
      order: 1,
      status: 'Open',
      location: 'Gate 4',
      assignedTeam: [],
      chiefComplaint: 'Test Call',
      position: {
        lat: 39.19,
        lon: -86.52,
        x: 50,
        y: 50,
        source: 'manual',
        placedAt: NOW,
      },
    };

    const result = eventToCotEvents(
      event({ calls: [callWithPin] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'full' }),
      NOW
    );

    expect(result.events).toHaveLength(1);
    const cot = result.events[0];
    expect(cot.point.lat).toBeCloseTo(39.19, 6);
    expect(cot.point.lon).toBeCloseTo(-86.52, 6);
    // Dispatcher-placed pins have no meaningful accuracy, so ce should be unknown.
    expect(cot.point.ce).toBe(COT_UNKNOWN);
  });

  it('publishes a call with a placed pin even when location matches no post', () => {
    const callWithPinNoPost: Call = {
      id: 'call-pin-no-post',
      order: 2,
      status: 'Open',
      location: 'Nowhere In Particular',
      assignedTeam: [],
      chiefComplaint: 'Test Call',
      position: {
        lat: 39.185,
        lon: -86.525,
        x: 50,
        y: 50,
        source: 'manual',
        placedAt: NOW,
      },
    };

    const result = eventToCotEvents(
      event({ calls: [callWithPinNoPost] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'full' }),
      NOW
    );

    expect(result.events).toHaveLength(1);
    // The call should publish; no position-unresolved skip for this call.
    expect(result.skipped.find((s) => s.reason === 'position-unresolved' && s.subject === 'call-pin-no-post')).toBeUndefined();
    const cot = result.events[0];
    expect(cot.point.lat).toBeCloseTo(39.185, 6);
    expect(cot.point.lon).toBeCloseTo(-86.525, 6);
  });

  it('still resolves a call with no pin by matching its location to a post (regression)', () => {
    const callNoPin: Call = {
      id: 'call-no-pin',
      order: 3,
      status: 'Open',
      location: 'Gate 4',
      assignedTeam: [],
      chiefComplaint: 'Test Call',
    };

    const result = eventToCotEvents(
      event({ calls: [callNoPin] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'full' }),
      NOW
    );

    expect(result.events).toHaveLength(1);
    const cot = result.events[0];
    // Should resolve to Gate 4's position from the georeference.
    expect(cot.point.lat).toBeCloseTo(39.18, 4);
    expect(cot.point.lon).toBeCloseTo(-86.53, 4);
    // Post-derived positions carry the georeference fit's accuracy.
    expect(cot.point.ce).toBeGreaterThanOrEqual(0);
    expect(cot.point.ce).toBeLessThanOrEqual(1);
  });

  it('skips a call with neither a pin nor a matching post', () => {
    const callNoPinNoPost: Call = {
      id: 'call-no-pin-no-post',
      order: 4,
      status: 'Open',
      location: 'Nowhere',
      assignedTeam: [],
      chiefComplaint: 'Test Call',
    };

    const result = eventToCotEvents(
      event({ calls: [callNoPinNoPost] }),
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, publishTeams: false, publishCalls: 'full' }),
      NOW
    );

    expect(result.events).toEqual([]);
    const skip = result.skipped.find((s) => s.reason === 'position-unresolved');
    expect(skip).toBeDefined();
    expect(skip?.subject).toBe('call-no-pin-no-post');
    expect(skip?.detail).toContain('no placed pin');
  });
});

describe('eventToCotEvents — determinism and staleness', () => {
  it('is a pure function of its inputs', () => {
    const e = event({ staff: [team()] });
    const a = eventToCotEvents(e, venue([georeferencedLayer()]), settings(), NOW);
    const b = eventToCotEvents(e, venue([georeferencedLayer()]), settings(), NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces stable UIDs across publishes so markers update instead of duplicating', () => {
    const e = event({ staff: [team()] });
    const first = eventToCotEvents(e, venue([georeferencedLayer()]), settings(), NOW);
    const later = eventToCotEvents(e, venue([georeferencedLayer()]), settings(), NOW + 60_000);
    expect(first.events.map((c) => c.uid)).toEqual(later.events.map((c) => c.uid));
    // ...while the timestamps genuinely advance.
    expect(later.events[0].time).toBe(NOW + 60_000);
  });

  it('defaults staleness to a multiple of the publish interval, and honours an override', () => {
    const e = event({ staff: [team()] });
    const dflt = eventToCotEvents(e, venue([georeferencedLayer()]), settings({ publishPosts: false }), NOW);
    expect(dflt.events[0].stale).toBe(NOW + DEFAULT_STALE_SECONDS * 1000);

    const custom = eventToCotEvents(
      e,
      venue([georeferencedLayer()]),
      settings({ publishPosts: false, staleSeconds: 300 }),
      NOW
    );
    expect(custom.events[0].stale).toBe(NOW + 300_000);
  });

  it('round-trips every emitted event through the CoT serializer', () => {
    const e = event({
      staff: [team()],
      supervisor: [supervisor({ location: 'Aid Station' })],
    });
    const result = eventToCotEvents(e, venue([georeferencedLayer()]), settings(), NOW);
    expect(result.events.length).toBeGreaterThan(0);
    for (const cot of result.events) {
      const xml = buildCotXml(cot);
      expect(xml).toContain(`uid="${cot.uid}"`);
      expect(xml).not.toContain('undefined');
    }
  });
});
