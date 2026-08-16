import { describe, expect, it } from 'vitest';

import type { Call } from '@/app/types';
import { buildCotXml } from '@/lib/tak/cot';
import { applyRedaction } from '@/lib/tak/redaction';
import { COT_TYPE_CALL } from '@/lib/tak/types';
import type { CotEvent } from '@/lib/tak/types';

// Distinctive PHI sentinel strings. If any of these ever shows up in
// redacted, serialized output, that's a PHI leak.
const AGE_SENTINEL = 'PHI_AGE_57_SENTINEL';
const GENDER_SENTINEL = 'PHI_GENDER_FEMALE_SENTINEL';
const NOTES_SENTINEL = 'PHI_NOTES_COMBATIVE_PATIENT_SENTINEL';
const LOG_SENTINEL = 'PHI_LOG_ENTRY_ADMINISTERED_NARCAN_SENTINEL';
const CHIEF_COMPLAINT_SENTINEL = 'CHIEF_COMPLAINT_CHEST_PAIN_SENTINEL';

const realisticCall: Call = {
  id: 'call-42',
  order: 3,
  status: 'On Scene',
  location: 'Gate 4',
  assignedTeam: ['Team Alpha'],
  chiefComplaint: CHIEF_COMPLAINT_SENTINEL,
  age: AGE_SENTINEL,
  gender: GENDER_SENTINEL,
  notes: NOTES_SENTINEL,
  log: [{ timestamp: 0, message: LOG_SENTINEL }],
};

/**
 * Simulate the worst-case upstream mapping bug this module has to defend
 * against: something dumps the ENTIRE call — including PHI fields — into
 * the CoT `remarks` string. If applyRedaction ever forwarded `remarks`
 * through unchanged (a denylist-style implementation might), every one of
 * these sentinels would end up in the broadcast output. `chiefComplaint` is
 * carried separately via the allowlisted `detail.chiefComplaint` field,
 * which is the ONLY route by which clinical content is meant to reach the
 * output, and only in 'full' mode.
 */
function makeInputCotEvent(call: Call): CotEvent {
  return {
    uid: `crowdcad.evt1.call.${call.id}`,
    type: COT_TYPE_CALL,
    how: 'm-g',
    time: 1000,
    start: 1000,
    stale: 2000,
    point: { lat: 39.18082, lon: -86.52552, ce: 10 },
    detail: {
      callsign: `Call ${call.order}`,
      chiefComplaint: call.chiefComplaint,
      remarks: [
        `chiefComplaint=${call.chiefComplaint}`,
        `age=${call.age}`,
        `gender=${call.gender}`,
        `notes=${call.notes}`,
        `log=${call.log?.map((l) => l.message).join(',')}`,
      ].join(' | '),
    },
  };
}

function serialized(cot: CotEvent | null): string {
  if (cot === null) return '';
  return buildCotXml(cot);
}

describe('applyRedaction PHI safety (allowlist enforcement)', () => {
  const input = makeInputCotEvent(realisticCall);

  it('off mode: returns null — nothing about the call leaves the system', () => {
    const result = applyRedaction(input, 'off');
    expect(result).toBeNull();
  });

  for (const mode of ['off', 'location-only', 'full'] as const) {
    it(`${mode} mode: age, gender, notes, and log sentinels never appear in serialized output`, () => {
      const result = applyRedaction(input, mode);
      const xml = serialized(result);

      expect(xml).not.toContain(AGE_SENTINEL);
      expect(xml).not.toContain(GENDER_SENTINEL);
      expect(xml).not.toContain(NOTES_SENTINEL);
      expect(xml).not.toContain(LOG_SENTINEL);
    });
  }

  it('location-only mode: excludes chief complaint entirely', () => {
    const result = applyRedaction(input, 'location-only');
    expect(result).not.toBeNull();
    const xml = serialized(result);

    expect(xml).not.toContain(CHIEF_COMPLAINT_SENTINEL);
    // Still a marker at the location, with a bare, non-clinical identifier.
    expect(result?.point).toEqual(input.point);
    expect(result?.detail?.remarks).toBeTruthy();
    expect(result?.detail?.remarks).not.toContain('|');
  });

  it('full mode: includes chief complaint', () => {
    const result = applyRedaction(input, 'full');
    expect(result).not.toBeNull();
    const xml = serialized(result);

    expect(xml).toContain(CHIEF_COMPLAINT_SENTINEL);
  });

  it('never forwards the input remarks blob, even in full mode', () => {
    // The input's `detail.remarks` is the simulated "dumped everything"
    // string containing the age/gender/notes/log key=value pairs. Full mode
    // must not simply pass it through.
    const result = applyRedaction(input, 'full');
    expect(result?.detail?.remarks).not.toBe(input.detail?.remarks);
    expect(result?.detail?.remarks).not.toContain('age=');
    expect(result?.detail?.remarks).not.toContain('gender=');
    expect(result?.detail?.remarks).not.toContain('notes=');
    expect(result?.detail?.remarks).not.toContain('log=');
  });

  it('emits a callsign so the marker is not labelled with its raw UID', () => {
    // A CoT event with no <contact callsign> renders in TAK as its bare uid.
    // That is unreadable on a map and needlessly discloses internal ids to
    // every federated partner.
    for (const mode of ['location-only', 'full'] as const) {
      expect(applyRedaction(input, mode)?.detail?.callsign).toBeTruthy();
    }
  });

  it('never puts clinical text in the callsign, even in full mode', () => {
    // The callsign is a permanent map label and appears in contact lists;
    // remarks require opening the marker. Full mode permits the chief
    // complaint in remarks ONLY — it must never become the icon's label.
    const result = applyRedaction(input, 'full');
    expect(result?.detail?.callsign).not.toContain(CHIEF_COMPLAINT_SENTINEL);
    expect(result?.detail?.callsign).not.toContain(AGE_SENTINEL);
    expect(result?.detail?.callsign).not.toContain(GENDER_SENTINEL);
    expect(result?.detail?.callsign).not.toContain(NOTES_SENTINEL);
    expect(result?.detail?.callsign).not.toContain(LOG_SENTINEL);
  });

  it('does not mutate the input CotEvent', () => {
    const before = JSON.parse(JSON.stringify(input));
    applyRedaction(input, 'off');
    applyRedaction(input, 'location-only');
    applyRedaction(input, 'full');
    expect(input).toEqual(before);
  });

  it('does not mutate the input point object', () => {
    const result = applyRedaction(input, 'full');
    expect(result?.point).not.toBe(input.point);
  });
});
