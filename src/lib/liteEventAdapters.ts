import { Event } from '@/app/types';
import { LiteEventDraft } from '@/lib/liteEventStore';

const LITE_LOCAL_USER_ID = 'lite-local';

export function removeUndefinedDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedDeep(item)) as unknown as T;
  }

  const cleaned = {} as Record<string, unknown>;
  const record = obj as Record<string, unknown>;

  Object.keys(record).forEach((key) => {
    const val = removeUndefinedDeep(record[key]);
    if (val !== undefined) cleaned[key] = val;
  });

  return cleaned as unknown as T;
}

export function normalizeLiteDraftToEvent(draft: LiteEventDraft): Event {
  const eventPosts = draft.eventPosts?.length ? draft.eventPosts : draft.venue.posts;

  return {
    id: draft.id,
    name: draft.name,
    date: draft.date,
    venue: {
      id: `lite-venue-${draft.id}`,
      name: draft.venue.name || 'Lite Venue',
      equipment: draft.venue.equipment || [],
      posts: draft.venue.posts || [],
      layers: [],
      userId: LITE_LOCAL_USER_ID,
      mapUrl: undefined,
    },
    userId: LITE_LOCAL_USER_ID,
    postingTimes: draft.postingTimes || [],
    staff: draft.staff || [],
    supervisor: draft.supervisor || [],
    calls: draft.calls || [],
    status: draft.status,
    createdAt: draft.createdAt,
    eventPosts: eventPosts || [],
    eventEquipment: draft.eventEquipment || [],
    postAssignments: draft.postAssignments || {},
    pendingAssignments: draft.pendingAssignments || {},
  };
}

export function toLiteDraftFromEvent(nextEvent: Event, previousDraft: LiteEventDraft): LiteEventDraft {
  return {
    ...previousDraft,
    id: nextEvent.id || previousDraft.id,
    mode: 'lite',
    name: nextEvent.name ?? previousDraft.name,
    date: nextEvent.date ?? previousDraft.date,
    venue: {
      name: nextEvent.venue?.name ?? previousDraft.venue.name,
      posts: nextEvent.eventPosts ?? nextEvent.venue?.posts ?? previousDraft.venue.posts,
      equipment: nextEvent.venue?.equipment ?? previousDraft.venue.equipment,
    },
    postingTimes: nextEvent.postingTimes || [],
    staff: nextEvent.staff || [],
    supervisor: nextEvent.supervisor || [],
    eventPosts: nextEvent.eventPosts || [],
    eventEquipment: nextEvent.eventEquipment || [],
    calls: nextEvent.calls || [],
    status: nextEvent.status ?? previousDraft.status ?? 'active',
    postAssignments: nextEvent.postAssignments || {},
    pendingAssignments: nextEvent.pendingAssignments || {},
    createdAt:
      typeof nextEvent.createdAt === 'string' ? nextEvent.createdAt : previousDraft.createdAt,
    updatedAt: new Date().toISOString(),
  };
}
