'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Card, ScrollShadow, Chip } from '@heroui/react';
import LoadingScreen from '@/components/ui/loading-screen';
import { DiagonalStreaksFixed } from '@/components/ui/diagonal-streaks-fixed';
import { getLiteEvent, type LiteEventDraft } from '@/lib/liteEventStore';
import type { Post } from '@/app/types';

const getPostName = (post: Post) => (typeof post === 'string' ? post : post.name);

export default function LiteDispatchPage() {
  const params = useParams();
  const router = useRouter();
  const localEventId = String(params?.localEventId ?? '');

  const [loading, setLoading] = useState(true);
  const [eventDraft, setEventDraft] = useState<LiteEventDraft | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!localEventId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const event = await getLiteEvent(localEventId);
      if (cancelled) return;

      setEventDraft(event);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [localEventId]);

  const eventPosts = useMemo(
    () => (eventDraft?.eventPosts ?? []).map((post) => getPostName(post)),
    [eventDraft?.eventPosts]
  );

  if (loading) {
    return <LoadingScreen label="Loading Lite dispatch…" />;
  }

  if (!eventDraft) {
    return (
      <main className="relative bg-surface-deepest text-white min-h-[100dvh] px-6 py-10">
        <DiagonalStreaksFixed />
        <div className="relative z-10 max-w-[900px] mx-auto">
          <Card isBlurred className="p-6 bg-transparent border border-default-200">
            <h1 className="text-2xl font-semibold mb-2">Lite event not found</h1>
            <p className="text-surface-light mb-6">
              This local event may have been removed from browser storage.
            </p>
            <div className="flex gap-3">
              <Button
                className="bg-accent hover:bg-accent/90 text-white"
                onPress={() => router.push('/lite/create')}
              >
                Create New Lite Event
              </Button>
              <Button
                variant="bordered"
                onPress={() => router.push(`/lite/create?eventId=${localEventId}`)}
              >
                Return to Setup
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="relative bg-surface-deepest text-white min-h-[100dvh] px-6 py-8 overflow-hidden">
      <DiagonalStreaksFixed />

      <div className="relative z-10 max-w-[1100px] mx-auto h-full flex flex-col gap-4">
        <Card isBlurred className="p-5 bg-transparent border border-default-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{eventDraft.name || 'Untitled Lite Event'}</h1>
              <p className="text-surface-light mt-1">
                Date: {eventDraft.date} · Event ID: {eventDraft.id}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="bordered" onPress={() => router.push(`/lite/create?eventId=${eventDraft.id}`)}>
                Edit Setup
              </Button>
              <Button className="bg-accent hover:bg-accent/90 text-white" onPress={() => router.push('/lite')}>
                Back to Lite Home
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          <Card isBlurred className="p-4 bg-transparent border border-default-200 min-h-0">
            <h2 className="text-lg font-semibold mb-3">Staffing</h2>
            <ScrollShadow hideScrollBar className="pr-2 h-[40dvh] md:h-[52dvh]">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-surface-light mb-2">Teams ({eventDraft.staff.length})</p>
                  {eventDraft.staff.length === 0 ? (
                    <p className="text-sm text-surface-light/70">No teams added.</p>
                  ) : (
                    <div className="space-y-2">
                      {eventDraft.staff.map((team, index) => (
                        <div key={`${team.team}_${index}`} className="rounded-xl bg-surface-deep px-3 py-2">
                          <p className="font-medium">{team.team}</p>
                          <p className="text-xs text-surface-light">{team.members.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-surface-light mb-2">Supervisors ({eventDraft.supervisor.length})</p>
                  {eventDraft.supervisor.length === 0 ? (
                    <p className="text-sm text-surface-light/70">No supervisors added.</p>
                  ) : (
                    <div className="space-y-2">
                      {eventDraft.supervisor.map((supervisor, index) => (
                        <div key={`${supervisor.team}_${index}`} className="rounded-xl bg-surface-deep px-3 py-2">
                          <p className="font-medium">{supervisor.team}</p>
                          <p className="text-xs text-surface-light">{supervisor.member}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollShadow>
          </Card>

          <Card isBlurred className="p-4 bg-transparent border border-default-200 min-h-0">
            <h2 className="text-lg font-semibold mb-3">Posts, Schedule, Equipment</h2>
            <ScrollShadow hideScrollBar className="pr-2 h-[40dvh] md:h-[52dvh]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-surface-light mb-2">Selected Posts ({eventPosts.length})</p>
                  {eventPosts.length === 0 ? (
                    <p className="text-sm text-surface-light/70">No posts selected.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {eventPosts.map((post) => (
                        <Chip key={post} variant="flat" style={{ backgroundColor: '#3eb1fd33', color: '#3eb1fd' }}>
                          {post}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-surface-light mb-2">Posting Schedule ({eventDraft.postingTimes.length})</p>
                  {eventDraft.postingTimes.length === 0 ? (
                    <p className="text-sm text-surface-light/70">No schedule times configured.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {eventDraft.postingTimes.map((time) => (
                        <Chip key={time} variant="flat" style={{ backgroundColor: '#22c55e33', color: '#22c55e' }}>
                          {time}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-surface-light mb-2">Event Equipment ({eventDraft.eventEquipment.length})</p>
                  {eventDraft.eventEquipment.length === 0 ? (
                    <p className="text-sm text-surface-light/70">No equipment selected.</p>
                  ) : (
                    <div className="space-y-2">
                      {eventDraft.eventEquipment.map((equipment) => (
                        <div key={equipment.id} className="rounded-xl bg-surface-deep px-3 py-2 text-sm">
                          <span>{equipment.name}</span>
                          {equipment.defaultLocation && (
                            <span className="text-surface-light ml-2">· {equipment.defaultLocation}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollShadow>
          </Card>
        </div>
      </div>
    </main>
  );
}
