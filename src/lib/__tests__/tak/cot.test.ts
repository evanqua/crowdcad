import { describe, expect, it } from 'vitest';

import { buildCotXml, escapeXml, formatCotTime, parseCotXml } from '@/lib/tak/cot';
import { COT_UNKNOWN, COT_TYPE_TEAM } from '@/lib/tak/types';
import type { CotEvent } from '@/lib/tak/types';

function makeEvent(overrides: Partial<CotEvent> = {}): CotEvent {
  return {
    uid: 'crowdcad.evt1.team.alpha',
    type: COT_TYPE_TEAM,
    how: 'm-g',
    time: Date.UTC(2026, 0, 1, 12, 0, 0, 0),
    start: Date.UTC(2026, 0, 1, 12, 0, 0, 0),
    stale: Date.UTC(2026, 0, 1, 12, 5, 0, 0),
    point: {
      lat: 39.18082,
      lon: -86.52552,
      hae: 210.5,
      ce: 12,
      le: 15,
    },
    detail: {
      callsign: 'ICEMS-Team 3',
      groupName: 'Cyan',
      groupRole: 'Team Member',
      remarks: 'Status: On Scene | Post: Gate 4',
      geopointsrc: 'GPS',
      altsrc: 'GPS',
    },
    ...overrides,
  };
}

describe('formatCotTime', () => {
  it('formats as ISO-8601 UTC with milliseconds and a trailing Z', () => {
    const ms = Date.UTC(2026, 7, 15, 3, 4, 5, 6);
    expect(formatCotTime(ms)).toBe('2026-08-15T03:04:05.006Z');
    expect(formatCotTime(ms)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`< > & " '`)).toBe('&lt; &gt; &amp; &quot; &apos;');
  });

  it('escapes ampersand first, without double-escaping', () => {
    // If '&' were escaped after '<', the '&' introduced by escaping '<'
    // would itself get re-escaped into '&amp;lt;'.
    expect(escapeXml('<')).toBe('&lt;');
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
    expect(escapeXml('&')).toBe('&amp;');
  });

  it('strips XML-1.0-illegal control characters', () => {
    const withControls = 'Gate\x00 4\x0B\x1Fend';
    expect(escapeXml(withControls)).toBe('Gate 4end');
  });

  it('leaves emoji and unicode untouched', () => {
    expect(escapeXml('Gate 4 🚑')).toBe('Gate 4 🚑');
  });
});

describe('buildCotXml / parseCotXml round trip', () => {
  it('preserves every field for a fully-populated event', () => {
    const original = makeEvent();
    const xml = buildCotXml(original);
    const parsed = parseCotXml(xml);

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(original);
  });

  it('round-trips an event with no detail and no how', () => {
    const original = makeEvent({ how: undefined, detail: undefined });
    const xml = buildCotXml(original);
    const parsed = parseCotXml(xml);

    expect(parsed).not.toBeNull();
    expect(parsed?.how).toBeUndefined();
    expect(parsed?.detail).toBeUndefined();
    expect(parsed?.uid).toBe(original.uid);
    expect(parsed?.point).toEqual(original.point);
  });

  it('round-trips a partially-populated detail block', () => {
    const original = makeEvent({
      detail: { remarks: 'Call 7' },
    });
    const xml = buildCotXml(original);
    const parsed = parseCotXml(xml);

    expect(parsed?.detail).toEqual({ remarks: 'Call 7' });
  });

  it('escapes hostile callsigns and post names on the way out and unescapes them on the way back in', () => {
    const hostile = `<Team> & "Post" 'name' 🚑`;
    const original = makeEvent({
      detail: { callsign: hostile, remarks: hostile },
    });
    const xml = buildCotXml(original);

    // Raw special characters must not appear unescaped in the XML.
    expect(xml).not.toContain(`callsign="${hostile}"`);
    expect(xml).toContain('&lt;Team&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;Post&quot;');
    expect(xml).toContain('&apos;name&apos;');
    expect(xml).toContain('🚑');

    const parsed = parseCotXml(xml);
    expect(parsed?.detail?.callsign).toBe(hostile);
    expect(parsed?.detail?.remarks).toBe(hostile);
  });
});

describe('buildCotXml COT_UNKNOWN sentinels', () => {
  it('emits COT_UNKNOWN (never 0) for missing hae/ce/le', () => {
    const event = makeEvent({
      point: { lat: 1, lon: 2 }, // hae, ce, le all omitted
    });
    const xml = buildCotXml(event);

    expect(xml).toContain(`hae="${COT_UNKNOWN}"`);
    expect(xml).toContain(`ce="${COT_UNKNOWN}"`);
    expect(xml).toContain(`le="${COT_UNKNOWN}"`);
    expect(xml).not.toContain('hae="0"');
    expect(xml).not.toContain('ce="0"');
    expect(xml).not.toContain('le="0"');
  });

  it('preserves an explicit 0 as a real measured value, not as "unknown"', () => {
    const event = makeEvent({
      point: { lat: 1, lon: 2, hae: 0, ce: 0, le: 0 },
    });
    const xml = buildCotXml(event);

    expect(xml).toContain('hae="0"');
    expect(xml).toContain('ce="0"');
    expect(xml).toContain('le="0"');

    const parsed = parseCotXml(xml);
    expect(parsed?.point.hae).toBe(0);
    expect(parsed?.point.ce).toBe(0);
    expect(parsed?.point.le).toBe(0);
  });
});

describe('parseCotXml malformed input', () => {
  it('returns null for empty input', () => {
    expect(parseCotXml('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseCotXml('not xml at all')).toBeNull();
  });

  it('returns null for truncated XML', () => {
    const xml = buildCotXml(makeEvent());
    expect(parseCotXml(xml.slice(0, 40))).toBeNull();
  });

  it('returns null when the event is missing uid', () => {
    const xml = buildCotXml(makeEvent()).replace(/ uid="[^"]*"/, '');
    expect(parseCotXml(xml)).toBeNull();
  });

  it('returns null when the event is missing type', () => {
    const xml = buildCotXml(makeEvent()).replace(/ type="[^"]*"/, '');
    expect(parseCotXml(xml)).toBeNull();
  });

  it('returns null when time/start/stale are missing', () => {
    const xml = buildCotXml(makeEvent()).replace(/ stale="[^"]*"/, '');
    expect(parseCotXml(xml)).toBeNull();
  });

  it('returns null when point lat/lon are missing', () => {
    const xml = buildCotXml(makeEvent()).replace(/<point[^/]*\/>/, '<point hae="1" ce="2" le="3"/>');
    expect(parseCotXml(xml)).toBeNull();
  });

  it('never throws on malformed input', () => {
    const inputs = ['<event', '<event>', '<point lat="x" lon="y"/>', '<<<>>>', '{}'];
    for (const input of inputs) {
      expect(() => parseCotXml(input)).not.toThrow();
    }
  });
});
