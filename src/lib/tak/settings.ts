// Defaults, merge semantics, and skip-reason presentation for TakPublishSettings.
//
// This module backs the §1.4 event-settings UI. It is pure — no I/O, no clock,
// no randomness — so the UI and eventToCotEvents() can both call it and always
// agree on what an unset field means.
//
// Import-boundary note: like the rest of src/lib/tak/, this file must run
// unmodified in a browser, a serverless function, and a standalone Node
// sidecar. Imports are limited to `@/app/types` (type-only) and siblings under
// src/lib/tak/ (mapping.ts is itself pure — see its own header — so importing
// its value/type exports here does not widen the boundary). No firebase, no
// next, no DOM, no Node built-ins, no new npm dependencies.

import type { TakPublishSettings } from '@/app/types';

import { DEFAULT_STALE_SECONDS, type MappingSkip, type MappingSkipReason } from './mapping';

/**
 * Safe, PHI-conscious defaults for a brand-new event.
 *
 * `enabled: false` — publishing is opt-in per event, never on by default.
 * `publishCalls: 'off'` — calls carry the only PHI-adjacent field
 * (`chiefComplaint`); leaving them off by default means a deployer must make
 * a deliberate, informed choice before any clinical text can leave the
 * system (plan §8).
 *
 * `publishIntervalSeconds: 30` paired with `staleSeconds: DEFAULT_STALE_SECONDS`
 * (120s, a 4x margin) mirrors the pairing documented at
 * `DEFAULT_STALE_SECONDS` in mapping.ts (plan §6.2/§7.4): a couple of missed
 * publishes in a row shouldn't make a stationary team vanish off the map.
 */
export const DEFAULT_TAK_PUBLISH_SETTINGS: TakPublishSettings = {
  enabled: false,
  publishTeams: true,
  publishSupervisors: true,
  publishPosts: true,
  publishCalls: 'off',
  callsignPrefix: undefined,
  cotGroup: undefined,
  staleSeconds: DEFAULT_STALE_SECONDS,
  publishIntervalSeconds: 30,
};

/**
 * Merge a partial/absent stored settings value over the defaults above.
 *
 * Uses `??`, never `||` — an operator who has deliberately turned
 * `publishTeams` off (a real, meaningful `false`) must not have that choice
 * silently reverted to the default `true` because `false` is falsy. Only
 * `undefined`/`null` (i.e. "this field was never set") falls through to the
 * default.
 *
 * The UI (this file's caller) and `eventToCotEvents` (mapping.ts) both read
 * settings through this function, so an event that has never touched TAK
 * settings and one that has explicitly saved the defaults behave identically.
 */
export function withTakDefaults(settings: TakPublishSettings | undefined): TakPublishSettings {
  return {
    enabled: settings?.enabled ?? DEFAULT_TAK_PUBLISH_SETTINGS.enabled,
    publishTeams: settings?.publishTeams ?? DEFAULT_TAK_PUBLISH_SETTINGS.publishTeams,
    publishSupervisors: settings?.publishSupervisors ?? DEFAULT_TAK_PUBLISH_SETTINGS.publishSupervisors,
    publishPosts: settings?.publishPosts ?? DEFAULT_TAK_PUBLISH_SETTINGS.publishPosts,
    publishCalls: settings?.publishCalls ?? DEFAULT_TAK_PUBLISH_SETTINGS.publishCalls,
    callsignPrefix: settings?.callsignPrefix ?? DEFAULT_TAK_PUBLISH_SETTINGS.callsignPrefix,
    cotGroup: settings?.cotGroup ?? DEFAULT_TAK_PUBLISH_SETTINGS.cotGroup,
    staleSeconds: settings?.staleSeconds ?? DEFAULT_TAK_PUBLISH_SETTINGS.staleSeconds,
    publishIntervalSeconds:
      settings?.publishIntervalSeconds ?? DEFAULT_TAK_PUBLISH_SETTINGS.publishIntervalSeconds,
  };
}

export interface SkipReasonDescription {
  /** Short, operator-facing label for a settings-panel banner or list row. */
  label: string;
  /** Banner/row tone. 'danger' is reserved for reasons that are actively
   *  misleading if ignored, not merely "nothing was drawn" (plan §11). */
  tone: 'info' | 'warn' | 'danger';
}

// Every MappingSkipReason must have an entry here. This is a `Record` keyed
// by the full union, not a switch with a default case — TypeScript will
// refuse to compile this file if a new reason is added to MappingSkipReason
// (mapping.ts) and left undescribed here, which is the point: a skip reason
// with no human description would render as a blank or "[object Object]" row
// in the settings-panel diagnostics preview, defeating the reason the skip
// records exist (plan §0.3(11)).
const SKIP_REASON_DESCRIPTIONS: Record<MappingSkipReason, SkipReasonDescription> = {
  // Normal, expected production shapes — nothing is wrong, just not (yet)
  // configured or applicable.
  'publishing-disabled': { label: 'TAK publishing is turned off', tone: 'info' },
  'layer-not-georeferenced': { label: 'Map layer is not georeferenced yet', tone: 'info' },
  'post-not-placed': { label: 'Post is not placed on the map', tone: 'info' },
  'call-redacted': { label: 'Call is not published (call publishing is off)', tone: 'info' },

  // A position genuinely could not be resolved — worth a second look, but not
  // itself evidence of bad data.
  'position-unresolved': { label: 'No GPS fix and no locatable assigned post', tone: 'warn' },

  // The georeference fit exists but is measurably too inaccurate to trust.
  // Publishing this would put a marker in a confidently wrong place on a
  // partner's map — actively dangerous, not cosmetic (plan §11).
  'layer-fit-unacceptable': { label: 'Georeference fit is too inaccurate to publish', tone: 'danger' },
};

/** Human-readable label + banner tone for one skip reason. */
export function describeSkipReason(reason: MappingSkipReason): SkipReasonDescription {
  return SKIP_REASON_DESCRIPTIONS[reason];
}

export interface SkipSummary {
  reason: MappingSkipReason;
  label: string;
  tone: 'info' | 'warn' | 'danger';
  count: number;
  /** Subject names (team, post, layer, or call identifiers), in the order
   *  they were skipped, for compact "3 skipped: Team 3, Team 5, Team 9"
   *  rendering. */
  subjects: string[];
}

/**
 * Group skip records by reason for compact rendering in the diagnostics
 * preview.
 *
 * Groups are ordered by first appearance in `skips` (stable, not alphabetical
 * or severity-sorted), so re-running the same mapping call always produces
 * the same group order — important for a UI an operator will glance at
 * repeatedly while debugging "why isn't Team 3 showing up."
 */
export function summarizeSkips(skips: MappingSkip[]): SkipSummary[] {
  const order: MappingSkipReason[] = [];
  const subjectsByReason = new Map<MappingSkipReason, string[]>();

  for (const skip of skips) {
    let subjects = subjectsByReason.get(skip.reason);
    if (!subjects) {
      subjects = [];
      subjectsByReason.set(skip.reason, subjects);
      order.push(skip.reason);
    }
    subjects.push(skip.subject);
  }

  return order.map((reason) => {
    const { label, tone } = describeSkipReason(reason);
    const subjects = subjectsByReason.get(reason) ?? [];
    return { reason, label, tone, count: subjects.length, subjects };
  });
}
