// Deterministic, namespaced CoT UID builders.
//
// UIDs are derived purely from stable identifiers (eventId, team name, call
// id, ...), never randomly generated. This matters for two reasons:
//
//   1. Idempotent republishing: republishing the same team/post/call always
//      produces the same UID, so a TAK client/server treats it as an UPDATE
//      to an existing marker rather than a brand-new one. Without this,
//      every publish tick would litter the map with duplicate markers.
//   2. Echo suppression: every CrowdCAD-originated UID is namespaced under
//      CROWDCAD_UID_PREFIX. This is MANDATORY — if the bridge also listens
//      for incoming CoT (e.g. field-client position reports) from the same
//      TAK server/feed it publishes to, it WILL see its own published
//      markers come back. Without an isCrowdcadUid() check to filter those
//      out, the bridge re-ingests its own output in a loop.

export const CROWDCAD_UID_PREFIX = 'crowdcad.';

/**
 * Lowercase, collapse runs of non-alphanumeric characters to a single '-',
 * and trim leading/trailing '-'. Never returns an empty string — empty or
 * undefined input (or input that is entirely non-alphanumeric) falls back to
 * 'unknown', because a UID with an empty segment would be malformed (e.g.
 * 'crowdcad.evt1.team.' with a dangling separator) and CoT UIDs must always
 * be well-formed.
 */
export function slugify(s: string | undefined | null): string {
  if (!s) return 'unknown';
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'unknown';
}

export function teamUid(eventId: string, team: string): string {
  return `${CROWDCAD_UID_PREFIX}${eventId}.team.${slugify(team)}`;
}

export function supervisorUid(eventId: string, team: string): string {
  return `${CROWDCAD_UID_PREFIX}${eventId}.sup.${slugify(team)}`;
}

export function postUid(eventId: string, layerId: string, postName: string): string {
  return `${CROWDCAD_UID_PREFIX}${eventId}.post.${slugify(layerId)}.${slugify(postName)}`;
}

export function callUid(eventId: string, callId: string): string {
  return `${CROWDCAD_UID_PREFIX}${eventId}.call.${slugify(callId)}`;
}

/**
 * True for any UID produced by the builders above. Used for echo
 * suppression — see the module comment for why this check is mandatory.
 */
export function isCrowdcadUid(uid: string): boolean {
  return uid.startsWith(CROWDCAD_UID_PREFIX);
}
