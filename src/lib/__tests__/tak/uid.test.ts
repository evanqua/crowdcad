import { describe, expect, it } from 'vitest';

import {
  CROWDCAD_UID_PREFIX,
  callUid,
  isCrowdcadUid,
  postUid,
  slugify,
  supervisorUid,
  teamUid,
} from '@/lib/tak/uid';

describe('slugify', () => {
  it('lowercases and collapses non-alphanumerics to a single dash', () => {
    expect(slugify('Team Alpha')).toBe('team-alpha');
    expect(slugify('Gate #4 / North')).toBe('gate-4-north');
    expect(slugify('A___B---C')).toBe('a-b-c');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --Alpha--  ')).toBe('alpha');
    expect(slugify('***')).toBe('unknown');
  });

  it('handles unicode input by collapsing to the fallback when nothing alphanumeric-ASCII survives', () => {
    // Non-ASCII letters are treated as non-alphanumeric by the [a-z0-9]
    // collapse, so a purely-unicode name falls back to 'unknown' rather than
    // producing an empty/mangled slug.
    expect(slugify('北京')).toBe('unknown');
    expect(slugify('Café Team')).toBe('caf-team');
  });

  it('returns the fallback for empty, whitespace-only, or missing input', () => {
    expect(slugify('')).toBe('unknown');
    expect(slugify('   ')).toBe('unknown');
    expect(slugify(undefined)).toBe('unknown');
    expect(slugify(null)).toBe('unknown');
  });
});

describe('UID builders determinism', () => {
  it('teamUid is deterministic for the same input', () => {
    expect(teamUid('evt1', 'Team Alpha')).toBe(teamUid('evt1', 'Team Alpha'));
  });

  it('produces the documented shape for each builder', () => {
    expect(teamUid('evt1', 'Team Alpha')).toBe('crowdcad.evt1.team.team-alpha');
    expect(supervisorUid('evt1', 'Team Alpha')).toBe('crowdcad.evt1.sup.team-alpha');
    expect(postUid('evt1', 'layer-1', 'Gate 4')).toBe('crowdcad.evt1.post.layer-1.gate-4');
    expect(callUid('evt1', 'call-42')).toBe('crowdcad.evt1.call.call-42');
  });

  it('never produces a malformed UID for empty/missing name segments', () => {
    expect(teamUid('evt1', '')).toBe('crowdcad.evt1.team.unknown');
    expect(postUid('evt1', '', '')).toBe('crowdcad.evt1.post.unknown.unknown');
  });

  it('different teams produce different UIDs', () => {
    expect(teamUid('evt1', 'Team Alpha')).not.toBe(teamUid('evt1', 'Team Bravo'));
  });

  it('the same team in different events produces different UIDs', () => {
    expect(teamUid('evt1', 'Team Alpha')).not.toBe(teamUid('evt2', 'Team Alpha'));
  });
});

describe('isCrowdcadUid', () => {
  it('is true for the output of all four builders', () => {
    expect(isCrowdcadUid(teamUid('evt1', 'Alpha'))).toBe(true);
    expect(isCrowdcadUid(supervisorUid('evt1', 'Alpha'))).toBe(true);
    expect(isCrowdcadUid(postUid('evt1', 'layer-1', 'Gate 4'))).toBe(true);
    expect(isCrowdcadUid(callUid('evt1', 'call-42'))).toBe(true);
  });

  it('is false for a foreign (e.g. ATAK device-generated) UID', () => {
    expect(isCrowdcadUid('ANDROID-359999999999999')).toBe(false);
    expect(isCrowdcadUid('S-1-5-21-1234-CIV')).toBe(false);
    expect(isCrowdcadUid('')).toBe(false);
  });

  it('agrees with the exported prefix constant', () => {
    expect(CROWDCAD_UID_PREFIX).toBe('crowdcad.');
    expect(isCrowdcadUid(`${CROWDCAD_UID_PREFIX}anything`)).toBe(true);
  });
});
