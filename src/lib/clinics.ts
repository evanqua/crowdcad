import type { Call, Clinic, Post, Venue } from '@/app/types';

export const DEFAULT_CLINICS: Clinic[] = [{ id: 'clinic', name: 'Clinic' }];

/** Resolves an event's clinics, falling back to a single default "Clinic" for events/venues with no clinic-flagged posts. */
export function getEventClinics(clinics: Clinic[] | undefined): Clinic[] {
  return clinics && clinics.length > 0 ? clinics : DEFAULT_CLINICS;
}

type ClinicPost = Extract<Post, object> & { isClinic: true };

export function isClinicPost(post: Post): post is ClinicPost {
  return typeof post === 'object' && post !== null && post.isClinic === true;
}

/** Minimal shape accepted by getVenuePosts — matches both Venue and LiteVenueSetup. */
type PostsSource = { posts?: Post[]; layers?: { posts: Post[] }[] };

/**
 * Flattens a venue's posts, preferring the flattened `venue.posts` cache
 * (written by venue-management on save) and falling back to layer posts
 * for venues that haven't been re-saved since layers were introduced.
 */
export function getVenuePosts(venue: PostsSource | Venue | undefined | null): Post[] {
  if (!venue) return [];
  if (venue.posts && venue.posts.length > 0) return venue.posts;
  return (venue.layers || []).flatMap(layer => layer.posts || []);
}

/**
 * Additively merges clinic-flagged venue posts into an event's existing
 * clinics list, matched by the post's stable `clinicId`. Never removes an
 * entry whose backing post disappeared, so existing calls' `clinicId`
 * references are never orphaned.
 */
export function syncClinicsFromVenue(
  venue: PostsSource | Venue | undefined | null,
  existingClinics: Clinic[] | undefined
): Clinic[] {
  const clinicPosts = getVenuePosts(venue).filter(isClinicPost).filter(p => !!p.clinicId);

  const byId = new Map((existingClinics || []).map(c => [c.id, c]));

  for (const post of clinicPosts) {
    const id = post.clinicId!;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { id, name: post.name });
    } else if (existing.name !== post.name) {
      byId.set(id, { ...existing, name: post.name });
    }
  }

  return Array.from(byId.values());
}

/**
 * True if `name` matches another clinic-flagged post in `allPosts`
 * (case-insensitive), excluding the post currently being edited. Two
 * clinics sharing a name would render two identically-labeled dispatch
 * tabs, so this is scoped to clinic-flagged posts only — regular posts
 * may still share names.
 */
export function hasDuplicateClinicName(
  name: string,
  allPosts: { post: Post; layerIdx: number; postIdx: number }[],
  exclude?: { layerIdx: number; postIdx: number }
): boolean {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return false;
  return allPosts.some(({ post, layerIdx, postIdx }) => {
    if (exclude && layerIdx === exclude.layerIdx && postIdx === exclude.postIdx) return false;
    if (!isClinicPost(post)) return false;
    return post.name.trim().toLowerCase() === trimmed;
  });
}

/**
 * True once a clinic call has a terminal outcome (Discharged, AMA, Rolled
 * from Clinic, Transported). "Pending Transport" is deliberately excluded —
 * it's a waiting-room status like "In Clinic", not a resolution, so a call
 * marked Pending Transport stays in the active/unresolved list.
 */
export function isClinicCallResolved(call: Call): boolean {
  return call.status === 'Delivered' && !!call.outcome && call.outcome !== 'Pending Transport';
}

/**
 * Resolves a clinic's display name by id, but only when more than one
 * clinic exists — single-clinic events have nothing worth naming.
 */
export function getClinicName(clinics: Clinic[], clinicId: string | undefined): string | undefined {
  if (clinics.length <= 1) return undefined;
  return clinics.find(c => c.id === clinicId)?.name;
}

/** A status pill's display text, and whether its status icon should still render alongside it. */
export type DestinationLabel = { text: string; showIcon: boolean };

/**
 * Shared by getTransportingLabel/getDeliveredLabel: both terms already read
 * as "X to" (see dispatchVocabulary label overrides), so the clinic name is
 * appended directly rather than through a separately-translated "to" (which
 * would double up — "Transporting to to Main Clinic"). Only decorates with a
 * destination when more than one clinic exists and the clinicId resolves —
 * single-clinic events keep the plain label. The resolved clinic name is
 * user-authored text and is never passed through `t()`.
 *
 * Once a real clinic name is shown, the status icon is suppressed
 * (`showIcon: false`) — the icon exists to stand in for an unnamed,
 * single-clinic destination, and reads as redundant clutter once the actual
 * destination is spelled out in text.
 */
function getDestinationLabel(
  t: (key: string) => string,
  termKey: string,
  clinics: Clinic[],
  clinicId: string | undefined
): DestinationLabel {
  const label = t(termKey);
  const clinicName = getClinicName(clinics, clinicId);
  return clinicName ? { text: `${label} ${clinicName}`, showIcon: false } : { text: label, showIcon: true };
}

/** Status pill label for a team that's Transporting. See getDestinationLabel. */
export function getTransportingLabel(
  t: (key: string) => string,
  clinics: Clinic[],
  clinicId: string | undefined
): DestinationLabel {
  return getDestinationLabel(t, 'Transporting', clinics, clinicId);
}

/** Status pill label for a team/call resolved as Delivered. Same destination decoration rules as getTransportingLabel. */
export function getDeliveredLabel(
  t: (key: string) => string,
  clinics: Clinic[],
  clinicId: string | undefined
): DestinationLabel {
  return getDestinationLabel(t, 'Delivered', clinics, clinicId);
}
