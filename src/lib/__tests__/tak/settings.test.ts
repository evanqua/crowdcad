import { describe, expect, it } from 'vitest';

import type { TakPublishSettings } from '@/app/types';
import { DEFAULT_STALE_SECONDS, type MappingSkip, type MappingSkipReason } from '@/lib/tak/mapping';
import {
  DEFAULT_TAK_PUBLISH_SETTINGS,
  describeSkipReason,
  summarizeSkips,
  withTakDefaults,
} from '@/lib/tak/settings';

// Every reason mapping.ts can produce. Kept as a literal list (rather than
// derived from the type) so this test file independently pins the exact set
// SKIP_REASON_DESCRIPTIONS must cover — if mapping.ts adds a reason and this
// list is not updated, TypeScript's excess/missing-key checking on the
// `Record<MappingSkipReason, ...>` in settings.ts already fails the build; this
// test additionally fails at runtime if someone widens the reason type without
// updating settings.ts.
const ALL_SKIP_REASONS: MappingSkipReason[] = [
  'publishing-disabled',
  'layer-not-georeferenced',
  'layer-fit-unacceptable',
  'post-not-placed',
  'position-unresolved',
  'call-redacted',
];

function skip(overrides: Partial<MappingSkip> & Pick<MappingSkip, 'reason' | 'subject'>): MappingSkip {
  return { ...overrides };
}

describe('DEFAULT_TAK_PUBLISH_SETTINGS', () => {
  it('defaults publishing to off', () => {
    expect(DEFAULT_TAK_PUBLISH_SETTINGS.enabled).toBe(false);
  });

  it('defaults call publishing to off (PHI-safe)', () => {
    expect(DEFAULT_TAK_PUBLISH_SETTINGS.publishCalls).toBe('off');
  });

  it('defaults teams, supervisors, and posts to on', () => {
    expect(DEFAULT_TAK_PUBLISH_SETTINGS.publishTeams).toBe(true);
    expect(DEFAULT_TAK_PUBLISH_SETTINGS.publishSupervisors).toBe(true);
    expect(DEFAULT_TAK_PUBLISH_SETTINGS.publishPosts).toBe(true);
  });

  it('pairs staleSeconds with the mapping module default so the two never drift apart', () => {
    expect(DEFAULT_TAK_PUBLISH_SETTINGS.staleSeconds).toBe(DEFAULT_STALE_SECONDS);
  });

  it('sets a sane publish interval', () => {
    expect(DEFAULT_TAK_PUBLISH_SETTINGS.publishIntervalSeconds).toBe(30);
  });
});

describe('withTakDefaults', () => {
  it('fills in every field for an undefined settings value', () => {
    expect(withTakDefaults(undefined)).toEqual(DEFAULT_TAK_PUBLISH_SETTINGS);
  });

  it('preserves an explicitly-set false, rather than falling back to the true default', () => {
    const stored: TakPublishSettings = {
      enabled: true,
      publishTeams: false, // explicit false — must survive
      publishSupervisors: false, // explicit false — must survive
      publishPosts: true,
      publishCalls: 'off',
    };
    const merged = withTakDefaults(stored);
    expect(merged.publishTeams).toBe(false);
    expect(merged.publishSupervisors).toBe(false);
  });

  it('preserves enabled: false explicitly (not just as the default)', () => {
    const stored: TakPublishSettings = {
      enabled: false,
      publishTeams: true,
      publishSupervisors: true,
      publishPosts: true,
      publishCalls: 'full',
    };
    const merged = withTakDefaults(stored);
    expect(merged.enabled).toBe(false);
    expect(merged.publishCalls).toBe('full');
  });

  it('fills in only the missing optional fields on a partial-shaped stored value', () => {
    const stored: TakPublishSettings = {
      enabled: true,
      publishTeams: true,
      publishSupervisors: true,
      publishPosts: true,
      publishCalls: 'location-only',
      callsignPrefix: 'ICEMS',
      // cotGroup, staleSeconds, publishIntervalSeconds intentionally absent
    };
    const merged = withTakDefaults(stored);
    expect(merged.callsignPrefix).toBe('ICEMS');
    expect(merged.cotGroup).toBe(DEFAULT_TAK_PUBLISH_SETTINGS.cotGroup);
    expect(merged.staleSeconds).toBe(DEFAULT_TAK_PUBLISH_SETTINGS.staleSeconds);
    expect(merged.publishIntervalSeconds).toBe(DEFAULT_TAK_PUBLISH_SETTINGS.publishIntervalSeconds);
  });
});

describe('describeSkipReason', () => {
  it('describes every MappingSkipReason member', () => {
    for (const reason of ALL_SKIP_REASONS) {
      const description = describeSkipReason(reason);
      expect(description).toBeDefined();
      expect(description.label.length).toBeGreaterThan(0);
      expect(['info', 'warn', 'danger']).toContain(description.tone);
    }
  });

  it('rates normal production shapes as info', () => {
    expect(describeSkipReason('post-not-placed').tone).toBe('info');
    expect(describeSkipReason('layer-not-georeferenced').tone).toBe('info');
    expect(describeSkipReason('publishing-disabled').tone).toBe('info');
    expect(describeSkipReason('call-redacted').tone).toBe('info');
  });

  it('rates an unresolved position as warn', () => {
    expect(describeSkipReason('position-unresolved').tone).toBe('warn');
  });

  it('rates an unacceptable georeference fit as danger — this one is actively misleading, not cosmetic', () => {
    expect(describeSkipReason('layer-fit-unacceptable').tone).toBe('danger');
  });
});

describe('summarizeSkips', () => {
  it('returns an empty array for no skips', () => {
    expect(summarizeSkips([])).toEqual([]);
  });

  it('groups skips by reason and counts them', () => {
    const skips: MappingSkip[] = [
      skip({ reason: 'position-unresolved', subject: 'Team 3' }),
      skip({ reason: 'position-unresolved', subject: 'Team 5' }),
      skip({ reason: 'post-not-placed', subject: 'Gate 9' }),
    ];
    const summary = summarizeSkips(skips);
    expect(summary).toHaveLength(2);

    const positionGroup = summary.find((g) => g.reason === 'position-unresolved');
    expect(positionGroup?.count).toBe(2);
    expect(positionGroup?.subjects).toEqual(['Team 3', 'Team 5']);
    expect(positionGroup?.label).toBe(describeSkipReason('position-unresolved').label);
    expect(positionGroup?.tone).toBe('warn');

    const postGroup = summary.find((g) => g.reason === 'post-not-placed');
    expect(postGroup?.count).toBe(1);
    expect(postGroup?.subjects).toEqual(['Gate 9']);
  });

  it('orders groups by first appearance, stably, regardless of input order', () => {
    const skipsA: MappingSkip[] = [
      skip({ reason: 'call-redacted', subject: 'call-1' }),
      skip({ reason: 'position-unresolved', subject: 'Team 3' }),
      skip({ reason: 'call-redacted', subject: 'call-2' }),
    ];
    const summaryA = summarizeSkips(skipsA);
    expect(summaryA.map((g) => g.reason)).toEqual(['call-redacted', 'position-unresolved']);

    const skipsB: MappingSkip[] = [
      skip({ reason: 'position-unresolved', subject: 'Team 3' }),
      skip({ reason: 'call-redacted', subject: 'call-1' }),
      skip({ reason: 'call-redacted', subject: 'call-2' }),
    ];
    const summaryB = summarizeSkips(skipsB);
    expect(summaryB.map((g) => g.reason)).toEqual(['position-unresolved', 'call-redacted']);
  });

  it('preserves subject names within a group in input order', () => {
    const skips: MappingSkip[] = [
      skip({ reason: 'layer-fit-unacceptable', subject: 'Concourse', detail: 'off by 40.0 m (limit 25 m)' }),
      skip({ reason: 'layer-fit-unacceptable', subject: 'Field Level', detail: 'off by 30.0 m (limit 25 m)' }),
    ];
    const summary = summarizeSkips(skips);
    expect(summary[0].subjects).toEqual(['Concourse', 'Field Level']);
  });
});
