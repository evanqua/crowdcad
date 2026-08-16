import type { TakCallPublishMode } from '@/app/types';

import type { CotEvent } from './types';

// This is the PHI boundary. Everything downstream of applyRedaction()
// (buildCotXml, then the network) is a BROADCAST: every connected TAK
// client, every federated partner server, and every server admin sees it,
// with no per-recipient access control. There is no way to "unsend" a
// published CoT marker. Get this wrong and PHI leaves the building.
//
// CRITICAL DESIGN RULE: this module is an ALLOWLIST of permitted output
// fields, not a denylist of forbidden input fields. Every function below
// builds a brand-new output CotEvent field-by-field, naming exactly what is
// allowed through. Nothing is ever produced by cloning/spreading the input
// and then deleting the fields we don't want.
//
// Why this matters: a denylist ("copy everything, then strip age/gender/
// notes/log") silently leaks the *next* field someone adds to `Call` — or
// any field a future, careless CrowdCAD->CoT mapping stuffs into
// `detail.remarks` as a convenience "dump everything" string. An allowlist
// fails CLOSED instead: a field that isn't explicitly named here never
// reaches the output, no matter how it arrived on the input `cot` object.
//
// Concretely: this module NEVER forwards `cot.detail.remarks` from the
// input. Remarks in the output are always rebuilt from scratch, using only
// the specific allowlisted pieces named below (a call identifier, and, in
// 'full' mode only, `detail.chiefComplaint`). If upstream code ever dumps
// age/gender/notes/log into the input's `remarks` (by bug or by a future
// mapping change), that string is discarded here, not laundered through.

/**
 * Derive a bare, non-clinical call identifier for the marker. Prefers an
 * explicit callsign if the caller supplied one (expected to be something
 * like "Call 7", never clinical text); otherwise falls back to the trailing
 * segment of the CoT uid, which is itself derived from the call's id (see
 * src/lib/tak/uid.ts) and carries no PHI.
 */
function deriveCallIdentifier(cot: CotEvent): string {
  const callsign = cot.detail?.callsign?.trim();
  if (callsign) return callsign;

  const uidTail = cot.uid.split('.').pop();
  return uidTail && uidTail.length > 0 ? uidTail : cot.uid;
}

/**
 * Redact a call CotEvent per the event's configured TakCallPublishMode.
 *
 * - 'off': nothing about a call leaves the system. Returns null.
 * - 'location-only': a marker at the location and nothing clinical. Remarks
 *   are reduced to the bare call identifier.
 * - 'full': permits the call's chief complaint, and ONLY the chief
 *   complaint, in addition to the bare identifier. age, gender, notes, and
 *   log are never read by this function at all, let alone emitted.
 *
 * Returns a new object; the input `cot` (and its nested `point`/`detail`)
 * is never mutated.
 */
export function applyRedaction(cot: CotEvent, mode: TakCallPublishMode): CotEvent | null {
  if (mode === 'off') return null;

  // Allowlisted structural fields: identity, timing, and location. None of
  // these carry clinical content — they're safe to carry through unchanged
  // in every mode that publishes anything at all.
  const redacted: CotEvent = {
    uid: cot.uid,
    type: cot.type,
    how: cot.how,
    time: cot.time,
    start: cot.start,
    stale: cot.stale,
    point: { ...cot.point },
  };

  const identifier = deriveCallIdentifier(cot);

  // `callsign` carries the SAME allowlisted value that already goes into
  // `remarks` below — no additional information leaves the system by emitting
  // it twice. It is emitted because a CoT event with no <contact callsign>
  // renders in TAK as its bare UID ("crowdcad.evt1.call.abc123"), which is
  // both unreadable on a map and a needless disclosure of internal ids to
  // every federated partner. Whatever is safe to put in remarks is safe here;
  // whatever is not safe here was already unsafe in remarks. Keep the two
  // fields fed from the one `identifier` so they can never diverge.
  if (mode === 'location-only') {
    redacted.detail = { callsign: identifier, remarks: identifier };
    return redacted;
  }

  // mode === 'full'. The ONLY additional field permitted through is
  // `detail.chiefComplaint` — named explicitly here, not "everything except
  // the fields we know are bad".
  // Note that the chief complaint goes into `remarks` ONLY, never into
  // `callsign`. A callsign is a map label rendered permanently next to the
  // icon and shown in contact lists; remarks require opening the marker. Even
  // in 'full' mode, clinical text belongs behind that one extra tap.
  const chiefComplaint = cot.detail?.chiefComplaint?.trim();
  redacted.detail = {
    callsign: identifier,
    remarks: chiefComplaint ? `${identifier}: ${chiefComplaint}` : identifier,
  };
  return redacted;
}
