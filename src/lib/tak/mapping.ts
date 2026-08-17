// CrowdCAD dispatch state -> CoT events. The heart of the TAK integration.
//
// This module is a PURE function of (Event, Venue, TakPublishSettings, now).
// It performs no I/O, reads no clock, and generates no randomness: `now` is
// passed in so the same inputs always produce byte-identical output, which is
// what makes the whole thing testable and what makes republishing idempotent.
//
// Import-boundary note: like the rest of src/lib/tak/, this file must run
// unmodified in a browser, a serverless function, and a standalone Node
// sidecar. The only imports permitted are @/app/types, @/lib/geoUtils,
// @/lib/statusColors, and siblings. No firebase, no next, no DOM, no Node
// built-ins, no new npm dependencies.
//
// -------------------------------------------------------------------------
// READ THIS BEFORE WIRING THIS MODULE TO A NETWORK
//
// The CoT type codes this module emits are still UNVERIFIED — see the warning
// block in ./types.ts. Producing a CotEvent is not the same as broadcasting
// it, so this module builds them regardless; what it will not do is let a
// caller broadcast them without knowing. Every MappingResult carries
// `typeCodesVerified`, mirrored from COT_TYPE_CODES_VERIFIED. The feed route
// (plan §1.3) and the bridge (§2) MUST consult it and refuse to transmit to a
// shared/partner TAK server while it is false. A wrong type code renders as a
// confusing or alarming symbol on someone else's map, and there is no way to
// unsend a CoT marker.
// -------------------------------------------------------------------------

import type {
  Call,
  Event,
  Layer,
  Staff,
  Supervisor,
  TakPublishSettings,
  Venue,
} from '@/app/types';
import {
  MAX_ACCEPTABLE_RESIDUAL_METRES,
  georeferenceResiduals,
  layerPostsLatLon,
  postName,
} from '@/lib/geoUtils';
import { deriveTeamVisualStatus } from '@/lib/statusColors';

import { applyRedaction } from './redaction';
import {
  COT_TYPE_CALL,
  COT_TYPE_CODES_VERIFIED,
  COT_TYPE_POST,
  COT_TYPE_SUPERVISOR,
  COT_TYPE_TEAM,
  COT_UNKNOWN,
  type CotDetail,
  type CotEvent,
} from './types';
import { callUid, postUid, slugify, supervisorUid, teamUid } from './uid';

/** CoT default staleness, in seconds, when the event doesn't configure one.
 *  Paired with a 30 s publish interval (plan §7.4) this is a 4x margin, so two
 *  dropped publishes in a row don't make a stationary team vanish off the map. */
export const DEFAULT_STALE_SECONDS = 120;

/** `how` for a position that came from a real GNSS fix on a real device. */
const HOW_MACHINE_GPS = 'm-g';
/** `how` for a position a human placed by hand — which is what a post-derived
 *  team position actually is: a human dropped that post on the venue map and a
 *  human typed the control points that georeference it. Claiming 'm-g' here
 *  would tell every TAK client the marker is a live GPS fix when it is a
 *  building-scale estimate of where someone was last assigned. */
const HOW_HUMAN_ENTERED = 'h-e';

export type MappingSkipReason =
  /** settings.enabled is false — nothing is published at all. */
  | 'publishing-disabled'
  /** The layer has no georeference (or a degenerate one), so no post on it can
   *  be located. Normal for a venue mid-calibration. */
  | 'layer-not-georeferenced'
  /** The layer IS georeferenced, but the fit is worse than
   *  MAX_ACCEPTABLE_RESIDUAL_METRES. Publishing it would put markers in
   *  confidently wrong places, which plan §11 rates as actively dangerous. */
  | 'layer-fit-unacceptable'
  /** A legacy string post, or an object post never placed on the map. Normal. */
  | 'post-not-placed'
  /** No live GPS fix and no locatable assigned post. Nothing to draw. */
  | 'position-unresolved'
  /** publishCalls is 'off', or applyRedaction returned null. */
  | 'call-redacted';

export interface MappingSkip {
  reason: MappingSkipReason;
  /** What was skipped: a layer name, team name, post name, or call id. */
  subject: string;
  /** Human-readable detail, for surfacing in the event-settings UI. Present
   *  where a bare reason code would leave the operator guessing — notably the
   *  measured error on 'layer-fit-unacceptable'. */
  detail?: string;
}

export interface MappingResult {
  events: CotEvent[];
  /** Everything deliberately NOT emitted, and why. This is the operator's
   *  feedback loop: "my team isn't showing up in TAK" must be answerable
   *  without a debugger. Do not drop these on the floor at the call site. */
  skipped: MappingSkip[];
  /** Mirrors COT_TYPE_CODES_VERIFIED. See the warning at the top of this file:
   *  callers that transmit are obliged to check this. */
  typeCodesVerified: boolean;
}

/** A post resolved to a real position, plus how well we trust that position. */
interface LocatedPost {
  lat: number;
  lon: number;
  layerId: string;
  layerName: string;
  /** Circular error in metres: the georeference fit's own max residual. A post
   *  is only as well-located as the transform that placed it. */
  ce: number;
}

function joinRemarks(parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.length > 0).join(' | ');
}

/**
 * Index every locatable post in the venue by slugified name.
 *
 * Keyed on the slug rather than the raw string so that a team assigned to
 * "Gate 4" still matches a post named "gate 4" or "Gate  4" — dispatchers type
 * these by hand and near-misses are the common case, not the exotic one.
 *
 * Layers are processed in order and the FIRST locatable post to claim a slug
 * wins. Duplicate post names across layers are genuinely ambiguous (a "Medical
 * Tent" on both the concourse and the field level are different places), and
 * this module has no basis for picking between them; picking deterministically
 * and documenting it beats picking randomly.
 */
function indexPosts(
  layers: Layer[],
  skipped: MappingSkip[]
): Map<string, LocatedPost> {
  const index = new Map<string, LocatedPost>();

  for (const layer of layers) {
    const residuals = georeferenceResiduals(layer.georeference);
    if (!residuals) {
      skipped.push({
        reason: 'layer-not-georeferenced',
        subject: layer.name,
        detail: 'No usable georeference — place at least 2 control points.',
      });
      continue;
    }
    if (residuals.maxMetres > MAX_ACCEPTABLE_RESIDUAL_METRES) {
      skipped.push({
        reason: 'layer-fit-unacceptable',
        subject: layer.name,
        detail:
          `Georeference fit is off by up to ${residuals.maxMetres.toFixed(1)} m ` +
          `(limit ${MAX_ACCEPTABLE_RESIDUAL_METRES} m). Recheck the control points.`,
      });
      continue;
    }

    for (const entry of layerPostsLatLon(layer)) {
      if (!entry.latLon) {
        skipped.push({
          reason: 'post-not-placed',
          subject: entry.name,
          detail: `Not placed on layer "${layer.name}".`,
        });
        continue;
      }
      const key = slugify(entry.name);
      if (index.has(key)) continue;
      index.set(key, {
        lat: entry.latLon.lat,
        lon: entry.latLon.lon,
        layerId: layer.id,
        layerName: layer.name,
        ce: residuals.maxMetres,
      });
    }
  }

  return index;
}

/** Resolve where to draw a team/supervisor marker.
 *
 *  Live GPS wins. Falling back to the assigned post is a deliberate, useful
 *  default rather than a consolation prize: it means a fleet carrying no GPS
 *  devices at all still produces a real, correct-to-the-building picture in
 *  TAK, which is the situation most volunteer services are actually in. */
function resolvePosition(
  member: Staff | Supervisor,
  posts: Map<string, LocatedPost>
): { lat: number; lon: number; ce: number; how: string; geopointsrc: string; post?: LocatedPost } | null {
  // `tak` is the single live-position field (see the note at the bottom of
  // src/app/types.ts). It is populated client-side from the `tak_positions`
  // collection, so it is present exactly when the bridge has heard from a
  // device bound to this member.
  //
  // `onMap: false` is deliberately NOT treated as "no fix". It means only that
  // the position falls outside the venue map image, which is a limitation of
  // drawing on a picture — TAK has real basemaps and can place the marker
  // perfectly well. Publishing where the unit demonstrably is beats falling
  // back to the post we merely assigned them to.
  const fix = member.tak;
  if (fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lon)) {
    return {
      lat: fix.lat,
      lon: fix.lon,
      ce: fix.accuracy !== undefined && Number.isFinite(fix.accuracy) ? fix.accuracy : COT_UNKNOWN,
      how: HOW_MACHINE_GPS,
      geopointsrc: 'GPS',
    };
  }

  const post = posts.get(slugify(member.location));
  if (post) {
    return {
      lat: post.lat,
      lon: post.lon,
      ce: post.ce,
      how: HOW_HUMAN_ENTERED,
      geopointsrc: 'USER',
      post,
    };
  }

  return null;
}

function buildMemberEvent(
  uid: string,
  type: string,
  member: Staff | Supervisor,
  statusText: string,
  posts: Map<string, LocatedPost>,
  settings: TakPublishSettings,
  now: number,
  staleAt: number,
  groupRole: string
): CotEvent | null {
  const resolved = resolvePosition(member, posts);
  if (!resolved) return null;

  const detail: CotDetail = {
    callsign: `${settings.callsignPrefix ?? ''}${member.team}`,
    groupName: settings.cotGroup,
    groupRole,
    geopointsrc: resolved.geopointsrc,
    remarks: joinRemarks([
      `Status: ${statusText}`,
      member.location ? `Post: ${member.location}` : undefined,
      resolved.post ? `Level: ${resolved.post.layerName}` : undefined,
    ]),
  };

  return {
    uid,
    type,
    how: resolved.how,
    time: now,
    start: now,
    stale: staleAt,
    point: {
      lat: resolved.lat,
      lon: resolved.lon,
      hae: COT_UNKNOWN,
      ce: resolved.ce,
      le: COT_UNKNOWN,
    },
    detail,
  };
}

function buildCallEvent(
  call: Call,
  eventId: string,
  posts: Map<string, LocatedPost>,
  settings: TakPublishSettings,
  now: number,
  staleAt: number
): CotEvent | null {
  // Resolve the call's position using this precedence order:
  // 1. A dispatcher-placed pin (call.position) — use lat/lon directly.
  // 2. Otherwise match the call's location string against a named post.
  // 3. Otherwise no position is available.
  //
  // This means a call with a pin publishes even if its location doesn't match
  // any post, and the pin coordinate takes precedence if both exist.
  let position: { lat: number; lon: number; ce: number } | null = null;

  if (call.position) {
    // A placed pin has no accuracy radius to report. It came from somebody
    // clicking a map, so its error is real but unquantified — unlike a GPS fix,
    // which arrives with a circular error the device actually measured.
    // COT_UNKNOWN says "not known", which is the truth; a 0 would claim
    // certainty the pin has not earned, and inventing a radius would be a
    // precision claim with nothing behind it.
    position = {
      lat: call.position.lat,
      lon: call.position.lon,
      ce: COT_UNKNOWN,
    };
  } else {
    const post = posts.get(slugify(call.location));
    if (post) {
      position = {
        lat: post.lat,
        lon: post.lon,
        ce: post.ce,
      };
    }
  }

  if (!position) return null;

  // Built pre-redaction, then handed to applyRedaction, which rebuilds the
  // output from its own allowlist. chiefComplaint is set here because that is
  // the field the allowlist knows how to gate; it is NOT pre-merged into
  // remarks, since applyRedaction discards input remarks wholesale by design.
  const unredacted: CotEvent = {
    uid: callUid(eventId, call.id),
    type: COT_TYPE_CALL,
    how: HOW_HUMAN_ENTERED,
    time: now,
    start: now,
    stale: staleAt,
    point: {
      lat: position.lat,
      lon: position.lon,
      hae: COT_UNKNOWN,
      ce: position.ce,
      le: COT_UNKNOWN,
    },
    detail: {
      callsign: `Call ${call.order}`,
      chiefComplaint: call.chiefComplaint,
    },
  };

  return applyRedaction(unredacted, settings.publishCalls);
}

/**
 * Map one CrowdCAD event to the set of CoT markers that represent it.
 *
 * Deterministic: identical inputs produce identical output, and every UID is
 * derived from stable identifiers (see ./uid.ts), so republishing on a timer
 * UPDATES markers in place rather than littering the map with duplicates.
 *
 * Nothing here throws. Every unpublishable shape — an uncalibrated layer, an
 * unplaced post, a team with no resolvable position — is a normal, expected
 * production state, and is reported through `skipped` instead.
 */
export function eventToCotEvents(
  event: Event,
  venue: Venue,
  settings: TakPublishSettings,
  now: number
): MappingResult {
  const skipped: MappingSkip[] = [];
  const base = { skipped, typeCodesVerified: COT_TYPE_CODES_VERIFIED };

  if (!settings.enabled) {
    skipped.push({
      reason: 'publishing-disabled',
      subject: event.name,
      detail: 'TAK publishing is turned off for this event.',
    });
    return { events: [], ...base };
  }

  const staleAt = now + (settings.staleSeconds ?? DEFAULT_STALE_SECONDS) * 1000;
  const posts = indexPosts(venue.layers ?? [], skipped);
  const events: CotEvent[] = [];

  // Posts. Emitted from the same index the team fallback uses, so a post can
  // never be drawn in one place as a marker and used as a different place for
  // a team standing on it.
  if (settings.publishPosts) {
    for (const layer of venue.layers ?? []) {
      const residuals = georeferenceResiduals(layer.georeference);
      if (!residuals || residuals.maxMetres > MAX_ACCEPTABLE_RESIDUAL_METRES) {
        // Already recorded in skipped by indexPosts — don't double-report.
        continue;
      }
      for (const entry of layerPostsLatLon(layer)) {
        if (!entry.latLon) continue; // already recorded by indexPosts
        events.push({
          uid: postUid(event.id, layer.id, entry.name),
          type: COT_TYPE_POST,
          how: HOW_HUMAN_ENTERED,
          time: now,
          start: now,
          stale: staleAt,
          point: {
            lat: entry.latLon.lat,
            lon: entry.latLon.lon,
            hae: COT_UNKNOWN,
            ce: residuals.maxMetres,
            le: COT_UNKNOWN,
          },
          detail: {
            callsign: `${settings.callsignPrefix ?? ''}${postName(entry.post)}`,
            groupName: settings.cotGroup,
            geopointsrc: 'USER',
            remarks: joinRemarks([`Post: ${entry.name}`, `Level: ${layer.name}`]),
          },
        });
      }
    }
  }

  if (settings.publishTeams) {
    for (const staff of event.staff ?? []) {
      const cot = buildMemberEvent(
        teamUid(event.id, staff.team),
        COT_TYPE_TEAM,
        staff,
        deriveTeamVisualStatus(staff.status, event, staff.team),
        posts,
        settings,
        now,
        staleAt,
        'Team Member'
      );
      if (cot) {
        events.push(cot);
      } else {
        skipped.push({
          reason: 'position-unresolved',
          subject: staff.team,
          detail: staff.location
            ? `No GPS fix, and post "${staff.location}" is not placed on a georeferenced layer.`
            : 'No GPS fix and no assigned post.',
        });
      }
    }
  }

  if (settings.publishSupervisors) {
    for (const sup of event.supervisor ?? []) {
      const cot = buildMemberEvent(
        supervisorUid(event.id, sup.team),
        COT_TYPE_SUPERVISOR,
        sup,
        deriveTeamVisualStatus(sup.status, event, sup.team),
        posts,
        settings,
        now,
        staleAt,
        'Team Lead'
      );
      if (cot) {
        events.push(cot);
      } else {
        skipped.push({
          reason: 'position-unresolved',
          subject: sup.team,
          detail: sup.location
            ? `No GPS fix, and post "${sup.location}" is not placed on a georeferenced layer.`
            : 'No GPS fix and no assigned post.',
        });
      }
    }
  }

  for (const call of event.calls ?? []) {
    if (settings.publishCalls === 'off') {
      skipped.push({
        reason: 'call-redacted',
        subject: call.id,
        detail: 'Call publishing is set to "off".',
      });
      continue;
    }
    const cot = buildCallEvent(call, event.id, posts, settings, now, staleAt);
    if (cot) {
      events.push(cot);
    } else {
      skipped.push({
        reason: 'position-unresolved',
        subject: call.id,
        detail: `Call has no placed pin and location "${call.location}" is not a placed post on a georeferenced layer.`,
      });
    }
  }

  return { events, ...base };
}
