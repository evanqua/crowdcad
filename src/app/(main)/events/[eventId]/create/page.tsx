'use client';

import { useRouter, useParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { Event, Venue, Staff, Supervisor, Post, Equipment, EventEquipment } from '@/app/types';
import { authService, dbService } from '@/lib/services';
import Image from 'next/image';
import { Button, Card, ScrollShadow } from '@heroui/react';
import { parseDate, getLocalTimeZone, today } from '@internationalized/date';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { syncClinicsFromVenue } from '@/lib/clinics';
import MapZoomControls from '@/components/ui/map-zoom-controls';
import MapPanSurface from '@/components/ui/map-pan-surface';
import { useScheduleGeneration } from '@/hooks/useScheduleGeneration';
import { scheduleTimesToWindow } from '@/lib/scheduleUtils';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useCertifications } from '@/hooks/useCertifications';
import MetadataSection from '@/components/event-create/MetadataSection';
import TeamStaffingSection from '@/components/event-create/TeamStaffingSection';
import SupervisorStaffingSection from '@/components/event-create/SupervisorStaffingSection';
import PostingScheduleSection from '@/components/event-create/PostingScheduleSection';
import { EquipmentSelectionSection, PostsSelectionSection } from '@/components/event-create/PostsEquipmentSection';
import { WizardShell, type WizardStep } from '@/components/wizard';
import { stripUndefined } from '@/lib/utils';
import AddTeamModal, { TeamDraft } from '@/components/modals/event/addteammodal';
import AddSupervisorModal from '@/components/modals/event/addsupervisormodal';
import BulkImportModal from '@/components/modals/event/bulkimportmodal';
import LoadingScreen from '@/components/ui/loading-screen';

// Helper to get post name regardless of type
const getPostName = (post: Post): string => {
  return typeof post === 'string' ? post : post.name;
};


export default function EventCreation() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.eventId as string | undefined;

  const { certifications } = useCertifications();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<Partial<Event> & { eventEquipment: EventEquipment[] }>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    venue: {} as Venue,
    staff: [],
    supervisor: [],
    postingTimes: [],
    userId: '',
    calls: [],
    eventPosts: [],
    eventEquipment: [],
    surgeLimitPercent: 70,
  });

  const STEP_ORDER = ['basics', 'teams', 'equipment', 'postschedule', 'review'] as const;
  const [currentStepId, setCurrentStepId] = useState<string>('basics');
  const [currentLayer, setCurrentLayer] = useState(0);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null);
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [bulkImportMode, setBulkImportMode] = useState<'team' | 'supervisor' | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const submittedRef = useRef(false);

  const {
    scale,
    position,
    isPanning,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useZoomPan(imgRef, imgContainerRef, { minScale: 0.5, maxScale: 3 });

  const {
    scheduleFrom,
    setScheduleFrom,
    scheduleTo,
    setScheduleTo,
    scheduleBy,
    setScheduleBy,
    postingTimes,
  } = useScheduleGeneration({ initialBy: '480' });

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number; text: string } | null>(null);
  const [samName, setSamName] = useState('');
  const [samMemberName, setSamMemberName] = useState('');
  const [samCert, setSamCert] = useState('');
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});
  const [openSupervisors, setOpenSupervisors] = useState<Record<number, boolean>>({});
  const [postsEnabled, setPostsEnabled] = useState(false);
  const [lastSelectedPostIndex, setLastSelectedPostIndex] = useState<number | null>(null);
  const [scheduleChips, setScheduleChips] = useState<{ id: string; time: string; editable: boolean }[]>([]);
  const [editingChipId, setEditingChipId] = useState<string | null>(null);
  const [editingChipValue, setEditingChipValue] = useState('');

  // Recompute container size on resize
  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Generate schedule chips based on time range and interval
  useEffect(() => {
    const times = postingTimes;
    if (times.length === 0) {
      setScheduleChips([]);
      setEventData(prev => ({ ...prev, postingTimes: [] }));
      return;
    }

    const chips = times.map((timeStr) => ({
      id: crypto.randomUUID(),
      time: timeStr,
      editable: false,
    }));

    setScheduleChips(chips);
    setEventData(prev => ({ ...prev, postingTimes: times }));
  }, [postingTimes]);

  // Keep the event's own start/end — used for reporting (the summary
  // page's analytics window) independent of whether auto-posting is
  // enabled — in sync with the Schedule section's From/To fields.
  useEffect(() => {
    const { start, end } = scheduleTimesToWindow(eventData.date || new Date().toISOString(), scheduleFrom, scheduleTo);
    setEventData(prev => ({ ...prev, scheduleStart: start, scheduleEnd: end }));
  }, [scheduleFrom, scheduleTo, eventData.date]);

  // Default post selection to "all posts" the first time the venue's posts
  // become known, instead of starting from none — only runs once per page
  // load, and only if nothing has already been selected.
  const postsSeededRef = useRef(false);
  useEffect(() => {
    if (postsSeededRef.current) return;
    const venue = eventData.venue;
    if (!venue?.name || !venue?.layers?.length) return;
    postsSeededRef.current = true;
    if ((eventData.eventPosts || []).length > 0) return;
    const allVenuePosts = venue.layers.flatMap(layer => layer.posts || []);
    if (allVenuePosts.length === 0) return;
    setEventData(prev => ({ ...prev, eventPosts: allVenuePosts }));
  }, [eventData.venue, eventData.eventPosts]);

  // Autosave postingTimes to the draft event document when they change.
  // Debounced to avoid excessive writes while the user is adjusting inputs.
  useEffect(() => {
    if (!eventId) return;
    const times = eventData.postingTimes || [];
    const timeout = setTimeout(async () => {
      try {
        await dbService.updateDocument('events', eventId, stripUndefined({ postingTimes: times }) as Record<string, unknown>);
        // eslint-disable-next-line no-console
        console.log('Autosaved postingTimes to draft:', { eventId, postingTimes: times });
      } catch (err) {
        console.error('Failed to autosave postingTimes:', err);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [eventId, eventData.postingTimes]);

  type FirestoreTimestamp = { seconds: number; nanoseconds: number };

  useEffect(() => {
    if (eventId) {
          
      const fetchEvent = async () => {
        try {
          const docSnap = await dbService.getDocument<Event>('events', eventId);

          if (docSnap.exists && docSnap.data) {
            const data = docSnap.data;
            
            
            let dateString = '';
            if (typeof data.date === 'string') {
              const d = new Date(data.date);
              dateString = isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
            } else if (
              typeof data.date === 'object' &&
              data.date !== null &&
              'seconds' in data.date &&
              typeof (data.date as FirestoreTimestamp).seconds === 'number'
            ) {
              const ts = data.date as FirestoreTimestamp;
              const d = new Date(ts.seconds * 1000);
              dateString = d.toISOString().split('T')[0];
            }
            
            // Migrate old venue format to new format with layers
            let venue = data.venue;
            if (venue && !venue.layers) {
              
              // Convert old format to new format
              venue = {
                ...venue,
                layers: [{
                  id: crypto.randomUUID(),
                  name: 'Main Floor',
                  posts: venue.posts || [],
                  mapUrl: venue.mapUrl,
                }]
              };
            }
            
            // Ensure eventEquipment is initialized and venue structure is preserved
            const updatedData = { 
              ...data, 
              date: dateString,
              eventEquipment: data.eventEquipment || [],
              venue: venue || {} as Venue
            };
            
            
            
            setEventData(updatedData);
          } else {
            console.error('Event document does not exist!');
          }
        } catch (error) {
          console.error('Error fetching event:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchEvent();
    } else {
        const createDraft = async () => {
        setLoading(true);
        const user = authService.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }
          // Ensure postingTimes are computed and included in the draft at creation time
          const times = postingTimes;

          const draft = {
            ...eventData,
            postingTimes: times.length > 0 ? times : eventData.postingTimes,
            userId: user.uid,
            date: new Date(eventData.date!).toISOString(),
            createdAt: new Date().toISOString(),
            status: 'draft',
          };
        const newId = await dbService.addDocument('events', stripUndefined(draft));
        setEventData(prev => ({ ...prev, userId: user.uid }));
        router.replace(`/events/${newId}/create`);
        setLoading(false);
      };
      createDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup effect - disabled to prevent deleting events during page reloads
  // The venue selection page handles cleanup of old abandoned drafts
  // useEffect(() => {
  //   return () => {
  //     if (!submittedRef.current && eventId) {
  //       const docRef = doc(db, 'events', eventId);
  //       getDoc(docRef).then(docSnap => {
  //         if (docSnap.exists()) {
  //           const data = docSnap.data() as Partial<Event> | undefined;
  //           if (data?.status === 'draft') {
  //             deleteDoc(docRef);
  //           }
  //         }
  //       });
  //     }
  //   };
  // }, [eventId]);

  const handleSaveTeam = (team: TeamDraft, editIdx: number | null) => {
    const members = team.members.map(
      m => `${m.name} [${m.cert}]${m.lead ? " (Lead)" : ""}`
    );
    setEventData(prev => {
      if (editIdx !== null) {
        const staff = [...(prev.staff || [])];
        staff[editIdx] = { ...staff[editIdx], team: team.name, members };
        return { ...prev, staff };
      }
      const newStaff: Staff = {
        team: team.name,
        location: "No Post",
        status: "On Break",
        members,
      };
      return { ...prev, staff: [...(prev.staff || []), newStaff] };
    });
  };

  // Reverses the "Name [CERT] (Lead)" string format handleSaveTeam writes,
  // so an existing Staff record can prefill AddTeamModal for editing.
  const parseTeamForEdit = (team: Staff): TeamDraft => ({
    name: team.team,
    members: team.members.map((m) => {
      const match = m.match(/^(.*) \[(.*)\](?: \(Lead\))?$/);
      const lead = / \(Lead\)$/.test(m);
      if (!match) return { name: m, cert: '', lead };
      return { name: match[1], cert: match[2], lead };
    }),
  });

  const handleAddSamUnit = () => {
    if (!samName.trim() || !samCert) return;
    const newSupervisor: Supervisor = {
      team: samName.trim(),
      location: 'Roaming',
      status: 'On Break',
      member: samMemberName.trim() ? `${samMemberName.trim()} [${samCert}]` : `${samName.trim()} [${samCert}]`,
    };
    setEventData(prev => ({
      ...prev,
      supervisor: [...(prev.supervisor || []), newSupervisor]
    }));
    setSamName('');
    setSamMemberName('');
    setSamCert('');
    setIsSupervisorModalOpen(false);
  };

  const handleBulkImport = (staff: Staff[], supervisors: Supervisor[]) => {
    setEventData(prev => ({
      ...prev,
      staff: staff.length > 0 ? [...(prev.staff || []), ...staff] : prev.staff,
      supervisor: supervisors.length > 0 ? [...(prev.supervisor || []), ...supervisors] : prev.supervisor,
    }));
    setBulkImportMode(null);
  };

  const handleSubmit = async () => {
    submittedRef.current = true;
    try {
      const user = authService.currentUser;
      if (!user) {
        alert('You must be logged in to create an event.');
        return;
      }
      const dateValue = new Date(eventData.date!);
      if (isNaN(dateValue.getTime())) {
        alert('Invalid event date');
        return;
      }

      // Compute postingTimes right before save in case state hasn't flushed.
      const computedTimes = postingTimes;
      console.log('handleSubmit computed postingTimes:', computedTimes, 'eventData.postingTimes:', eventData.postingTimes);

      // Populate clinics from venue-designated clinic posts right before save.
      const computedClinics = syncClinicsFromVenue(eventData.venue, eventData.clinics);

      let eventDocId = eventId;
      if (eventDocId) {
        try {
          const docSnap2 = await dbService.getDocument('events', eventDocId);
          if (docSnap2.exists) {
            await dbService.updateDocument('events', eventDocId, stripUndefined({
              ...eventData,
              postingTimes: computedTimes.length > 0 ? computedTimes : eventData.postingTimes,
              clinics: computedClinics,
              userId: user.uid,
              date: dateValue.toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'active',
            }) as Record<string, unknown>);
            // eslint-disable-next-line no-console
            console.log('Event updated:', { eventId: eventDocId, postingTimes: eventData.postingTimes || [] });
          } else {
            eventDocId = await dbService.addDocument('events', stripUndefined({
              ...eventData,
              postingTimes: computedTimes.length > 0 ? computedTimes : eventData.postingTimes,
              clinics: computedClinics,
              userId: user.uid,
              date: dateValue.toISOString(),
              createdAt: new Date().toISOString(),
              status: 'active',
            }));
            // eslint-disable-next-line no-console
            console.log('Event created (branch new):', { eventId: eventDocId, postingTimes: eventData.postingTimes || [] });
          }
        } catch (error) {
          console.error('Error checking/updating document:', error);
          eventDocId = await dbService.addDocument('events', stripUndefined({
            ...eventData,
            clinics: computedClinics,
            userId: user.uid,
            date: dateValue.toISOString(),
            createdAt: new Date().toISOString(),
            status: 'active',
          }));
          // eslint-disable-next-line no-console
          console.log('Event created (catch):', { eventId: eventDocId, postingTimes: eventData.postingTimes || [] });
        }
      } else {
        eventDocId = await dbService.addDocument('events', stripUndefined({
          ...eventData,
          clinics: computedClinics,
          userId: user.uid,
          date: dateValue.toISOString(),
          createdAt: new Date().toISOString(),
          status: 'active',
        }));
        // eslint-disable-next-line no-console
        console.log('Event created (no eventId):', { eventId: eventDocId, postingTimes: eventData.postingTimes || [] });
      }
      router.push(`/events/${eventDocId}/dispatch`);
    } catch (error) {
      console.error('Creation failed:', error);
      alert(`Creation failed: ${(error as Error).message}`);
    }
  };


  const renderMarkers = () => {
    type CoordinatedPost = {
      name: string;
      x: number;
      y: number;
    };

    return currentLayerPosts
      .filter((post): post is CoordinatedPost =>
        typeof post === 'object' &&
        post !== null &&
        'name' in post &&
        typeof post.x === 'number' &&
        typeof post.y === 'number' &&
        post.x !== null &&
        post.y !== null
      )
      .map((post, idx) => {
        const left = `calc(${post.x}% - 12px)`;
        const top = `calc(${post.y}% - 12px)`;
        const isHover = hoverId === idx;

        return (
          <React.Fragment key={idx}>
            <div
              style={{ left, top }}
              className={`absolute z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                isHover
                  ? 'border-accent bg-accent/30 scale-110'
                  : 'border-accent bg-accent/20 hover:scale-110'
              }`}
                onMouseEnter={() => {
                  setHoverId(idx);
                  const img = imgRef.current;
                  if (img && typeof post.x === 'number' && typeof post.y === 'number') {
                    const rect = img.getBoundingClientRect();
                    const xPx = rect.left + (post.x / 100) * rect.width;
                    const yPx = rect.top + (post.y / 100) * rect.height;
                    setTooltip({ left: Math.round(xPx - 50), top: Math.round(yPx - 40), text: post.name });
                  }
                }}
                onMouseLeave={() => {
                  setHoverId((cur) => (cur === idx ? null : cur));
                  setTooltip(null);
                }}
            >
              <svg className="h-4 w-4 text-accent" fill="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            {/* tooltip rendered globally to avoid being clipped by overflow */}
          </React.Fragment>
        );
      });
  };



  useEffect(() => {
    if (eventData.venue && Object.keys(eventData.venue).length > 0) {
    }
  }, [eventData.venue]);

  // Debug effect to find overflow source
  // (debugging useEffect removed)

  if (loading) return <LoadingScreen label="Loading event data…" />;
  
  const hasVenue = Boolean(eventData.venue?.name && eventData.venue?.layers?.length);
  const hasMap = hasVenue && Boolean(eventData.venue?.layers?.[currentLayer]?.mapUrl);
  const allPosts = hasVenue ? (eventData.venue?.layers?.flatMap(layer => layer.posts || []) || []) : [];
  const currentLayerPosts = hasVenue ? (eventData.venue?.layers?.[currentLayer]?.posts || []) : [];
  const flattenedPosts = hasVenue ? (eventData.venue?.layers?.flatMap(layer => (layer.posts || []).map(p => ({ post: p, layerName: layer.name }))) || []) : [];

  

  const inputClassNames = {
    label: 'text-surface-light font-medium',
    inputWrapper: 'rounded-large px-4',
    input: 'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0',
  };

  const selectClassNames = {
    label: 'text-surface-light font-medium',
    input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
    inputWrapper: 'rounded-large px-4 pr-6 shadow-none group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0',
  };

  const handleDeleteTeam = (idx: number) => {
    setEventData(prev => ({
      ...prev,
      staff: (prev.staff || []).filter((_, i) => i !== idx),
    }));
  };

  const handleDeleteSupervisor = (idx: number) => {
    setEventData(prev => ({
      ...prev,
      supervisor: (prev.supervisor || []).filter((_, i) => i !== idx),
    }));
  };

  const handleZoomIn = () => {
    zoomIn(0.25);
  };

  const handleZoomOut = () => {
    zoomOut(0.25);
  };

  const handleResetZoom = () => {
    resetZoom();
  };

  // Convert date string to CalendarDate
  const getCalendarDate = () => {
    if (eventData.date) {
      try {
        return parseDate(eventData.date);
      } catch {
        return today(getLocalTimeZone());
      }
    }
    return today(getLocalTimeZone());
  };

  const basicsStep = (
    <div className="px-6 pt-4 h-full">
      <MetadataSection
        eventData={eventData}
        setEventData={setEventData}
        getCalendarDate={getCalendarDate}
        scheduleFrom={scheduleFrom}
        setScheduleFrom={setScheduleFrom}
        scheduleTo={scheduleTo}
        setScheduleTo={setScheduleTo}
        inputClassNames={inputClassNames}
      />
    </div>
  );

  const teamsSupervisorsStep = (
    <div className="flex h-full px-6 pt-4">
      <div className="flex-1 min-w-0">
        <TeamStaffingSection
          staff={eventData.staff || []}
          openTeams={openTeams}
          setOpenTeams={setOpenTeams}
          onDeleteTeam={handleDeleteTeam}
          onEditTeam={(idx) => {
            setEditingTeamIndex(idx);
            setIsTeamModalOpen(true);
          }}
          onAddTeam={() => {
            setEditingTeamIndex(null);
            setIsTeamModalOpen(true);
          }}
          onUploadCSV={() => setBulkImportMode('team')}
        />
      </div>
      <div className="w-px bg-surface-liner mx-2 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <SupervisorStaffingSection
          supervisors={eventData.supervisor || []}
          openSupervisors={openSupervisors}
          setOpenSupervisors={setOpenSupervisors}
          onDeleteSupervisor={handleDeleteSupervisor}
          onUploadCSV={() => setBulkImportMode('supervisor')}
          onAddSupervisor={() => setIsSupervisorModalOpen(true)}
        />
      </div>
    </div>
  );

  const equipmentStep = (
    <div className="flex flex-col h-full overflow-hidden px-6 pt-4">
      <div className="flex-shrink-0 pb-3 flex items-center justify-between">
        <h3 className="text-surface-light font-semibold text-lg">Equipment</h3>
      </div>
      <EquipmentSelectionSection
        hasVenue={hasVenue}
        eventData={eventData as Partial<Event> & { venue: Venue; eventEquipment: EventEquipment[] }}
        setEventData={setEventData as React.Dispatch<React.SetStateAction<Partial<Event> & { venue: Venue; eventEquipment: EventEquipment[] }>>}
        selectClassNames={selectClassNames}
        allPosts={allPosts}
        getPostName={getPostName}
      />
    </div>
  );

  const postScheduleStep = (
    <div className="px-6 pt-4 h-full min-h-0 flex flex-col">
      <ScrollShadow className="space-y-4 pr-2 scrollbar-hide flex-1 min-h-0" hideScrollBar style={{ overflow: 'auto' }}>
        <PostsSelectionSection
          hasVenue={hasVenue}
          postsEnabled={postsEnabled}
          setPostsEnabled={setPostsEnabled}
          flattenedPosts={flattenedPosts}
          allPosts={allPosts}
          getPostName={getPostName}
          eventData={eventData as Partial<Event> & { venue: Venue; eventEquipment: EventEquipment[] }}
          setEventData={setEventData as React.Dispatch<React.SetStateAction<Partial<Event> & { venue: Venue; eventEquipment: EventEquipment[] }>>}
          lastSelectedPostIndex={lastSelectedPostIndex}
          setLastSelectedPostIndex={setLastSelectedPostIndex}
          selectClassNames={selectClassNames}
        />
        <PostingScheduleSection
          postsEnabled={postsEnabled}
          scheduleBy={scheduleBy}
          setScheduleBy={setScheduleBy}
          scheduleChips={scheduleChips}
          setScheduleChips={setScheduleChips}
          editingChipId={editingChipId}
          setEditingChipId={setEditingChipId}
          editingChipValue={editingChipValue}
          setEditingChipValue={setEditingChipValue}
          setPostingTimes={(updater) =>
            setEventData((prev) => ({
              ...prev,
              postingTimes: updater(prev.postingTimes || []),
            }))
          }
          inputClassNames={inputClassNames}
        />
      </ScrollShadow>
    </div>
  );

  const reviewStep = (
    <div className="px-6 pt-4 h-full max-w-md">
      <Card isBlurred className="border-2 border-default-200 bg-transparent p-5 space-y-4">
        <div>
          <span className="text-xs text-surface-faint">Event name</span>
          <p className="text-surface-light font-medium">{eventData.name?.trim() || '(untitled)'}</p>
        </div>
        <div>
          <span className="text-xs text-surface-faint">Surge limit</span>
          <p className="text-surface-light">{eventData.surgeLimitPercent ?? 70}%</p>
        </div>
        <div>
          <span className="text-xs text-surface-faint">Teams</span>
          <p className="text-surface-light">{(eventData.staff || []).length} team{(eventData.staff || []).length === 1 ? '' : 's'}</p>
        </div>
        <div>
          <span className="text-xs text-surface-faint">Supervisors</span>
          <p className="text-surface-light">{(eventData.supervisor || []).length} supervisor{(eventData.supervisor || []).length === 1 ? '' : 's'}</p>
        </div>
        <div>
          <span className="text-xs text-surface-faint">Equipment</span>
          <p className="text-surface-light">{eventData.eventEquipment.length} item{eventData.eventEquipment.length === 1 ? '' : 's'}</p>
        </div>
        <div>
          <span className="text-xs text-surface-faint">Post schedule</span>
          <p className="text-surface-light">
            {postsEnabled
              ? `${(eventData.eventPosts || []).length} post${(eventData.eventPosts || []).length === 1 ? '' : 's'} · ${scheduleChips.length} repost time${scheduleChips.length === 1 ? '' : 's'}`
              : 'Not enabled'}
          </p>
        </div>
      </Card>
      <Button
        onPress={handleSubmit}
        size="md"
        radius="lg"
        className="mt-4 bg-accent hover:bg-accent/90 text-surface-light"
      >
        Create Event
      </Button>
    </div>
  );

  const steps: WizardStep[] = [
    { id: 'basics', label: 'Event Configuration', component: basicsStep, isComplete: true },
    { id: 'teams', label: 'Staff Assignments', component: teamsSupervisorsStep, isComplete: true },
    { id: 'equipment', label: 'Equipment', component: equipmentStep, isComplete: true },
    { id: 'postschedule', label: 'Post schedule', component: postScheduleStep, isComplete: true },
    { id: 'review', label: 'Review', component: reviewStep, isComplete: true },
  ];

  const showMapPanel = currentStepId === 'equipment' || currentStepId === 'postschedule';
  const showMapColumn = showMapPanel && hasMap;

  const stepIdx = STEP_ORDER.indexOf(currentStepId as (typeof STEP_ORDER)[number]);
  const isFirstStep = stepIdx <= 0;
  const isLastStep = stepIdx === STEP_ORDER.length - 1;
  const goNext = () => {
    if (stepIdx >= 0 && stepIdx < STEP_ORDER.length - 1) setCurrentStepId(STEP_ORDER[stepIdx + 1]);
  };
  const goBack = () => {
    if (stepIdx > 0) setCurrentStepId(STEP_ORDER[stepIdx - 1]);
  };

  const backButton = !isFirstStep && (
    <Button variant="flat" size="sm" onPress={goBack} className="px-6">
      Back
    </Button>
  );

  const continueButton = !isLastStep && (
    <Button
      size="sm"
      onPress={goNext}
      className="px-6 bg-accent hover:bg-accent/90 text-surface-light"
    >
      Continue
    </Button>
  );

  const leftPanelContent = (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden py-4">
        <WizardShell
          steps={steps}
          currentStepId={currentStepId}
          onStepChange={setCurrentStepId}
          className="flex-1 min-h-0 px-6"
        />
      </div>

      {showMapColumn ? (
        <div className="flex px-6 pt-4 pb-4 flex-shrink-0">{backButton}</div>
      ) : (
        <div className="flex items-center justify-between px-6 pt-4 pb-4 flex-shrink-0">
          <div>{backButton}</div>
          <div>{continueButton}</div>
        </div>
      )}
    </div>
  );

  const rightPanelContent = (
    <div className="flex flex-col h-full relative px-6 pt-2 pb-4 overflow-hidden">
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center flex-shrink-0">
          {hasVenue && <h2 className="text-surface-light text-xl font-semibold">{eventData.venue?.name}</h2>}
        </div>

        {/* Map — this panel only renders when showMapColumn is true, which already
            requires hasMap, so there's no "no map" fallback to render here. */}
        <div className="w-full flex flex-col gap-3 flex-1 min-h-0">
          <div className="relative w-full overflow-hidden rounded-2xl">
            <MapPanSurface
              containerRef={imgContainerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                cursor: isPanning ? 'grabbing' : 'grab',
                maxHeight: 'calc(100vh - 215px)',
              }}
            >
              <div
                className="relative"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                }}
              >
                <Image
                  ref={imgRef}
                  src={eventData.venue?.layers?.[currentLayer]?.mapUrl || ''}
                  alt={`${eventData.venue?.layers?.[currentLayer]?.name || 'Venue'} map`}
                  width={1200}
                  height={800}
                  className="w-full h-auto"
                  unoptimized
                  onLoad={(e) => {
                    const t = e.currentTarget as HTMLImageElement;
                    if (t && t.naturalWidth && t.naturalHeight) {
                      setNaturalSize({ width: t.naturalWidth, height: t.naturalHeight });
                    }
                  }}
                />
                {renderMarkers()}
              </div>
            </MapPanSurface>

            <MapZoomControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onReset={handleResetZoom}
              buttonClassName="bg-surface-deepest/90 backdrop-blur"
              resetButtonClassName="bg-surface-deepest/90 backdrop-blur"
            />
          </div>

          {/* Bottom Control Bar */}
          <Card
            isBlurred
            className="border-2 border-default-200 bg-transparent w-full px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-surface-light">Layer:</span>
                <span className="text-sm font-medium text-surface-light">
                  {eventData.venue?.layers?.[currentLayer]?.name || 'Main Floor'}
                </span>
              </div>
              {eventData.venue?.layers && eventData.venue.layers.length > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    isIconOnly
                    size="sm"
                    radius="full"
                    variant="flat"
                    onPress={() => setCurrentLayer(prev => Math.max(0, prev - 1))}
                    isDisabled={currentLayer === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-surface-light">
                    {currentLayer + 1} / {eventData.venue.layers.length}
                  </span>
                  <Button
                    isIconOnly
                    size="sm"
                    radius="full"
                    variant="flat"
                    onPress={() => setCurrentLayer(prev => Math.min((eventData.venue?.layers?.length || 1) - 1, prev + 1))}
                    isDisabled={currentLayer === (eventData.venue?.layers?.length || 1) - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-4 flex-shrink-0">{continueButton}</div>
    </div>
  );

  return (
    <main className="relative bg-surface-deepest text-surface-light h-[calc(100dvh-3.5rem)] overflow-hidden leading-none">
      <div className="relative z-10 max-w-[1200px] mx-auto h-full overflow-hidden">
        <div className="h-full overflow-hidden">
          <div className="flex h-full overflow-hidden">
            {showMapColumn ? (
              <>
                <div className="w-1/3 h-full flex-shrink-0 border-r border-surface-liner overflow-hidden">
                  {leftPanelContent}
                </div>
                <div className="w-2/3 h-full flex-shrink-0 overflow-hidden">
                  {rightPanelContent}
                </div>
              </>
            ) : (
              <div className="w-full h-full overflow-hidden">
                {leftPanelContent}
              </div>
            )}
          </div>
        </div>
      </div>
      {tooltip && (
        <div
          style={{ left: tooltip.left, top: tooltip.top }}
          className="pointer-events-none fixed z-50 rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-surface-light shadow-lg border border-default whitespace-nowrap"
        >
          {tooltip.text}
        </div>
      )}

      {/* Modals */}
      <AddTeamModal
        isOpen={isTeamModalOpen}
        onClose={() => {
          setIsTeamModalOpen(false);
          setEditingTeamIndex(null);
        }}
        mode={editingTeamIndex !== null ? 'edit' : 'create'}
        titleOverride={editingTeamIndex !== null ? 'Edit Team' : 'Add New Team'}
        submitLabelOverride={editingTeamIndex !== null ? 'Save Changes' : undefined}
        existingTeamNames={(eventData.staff || [])
          .map(s => s.team)
          .filter((_, i) => i !== editingTeamIndex)}
        initialTeam={editingTeamIndex !== null ? parseTeamForEdit((eventData.staff || [])[editingTeamIndex]) : undefined}
        onSave={(team) => handleSaveTeam(team, editingTeamIndex)}
        roles={certifications.map(name => ({ name, fullName: name }))}
      />

      <AddSupervisorModal
        isOpen={isSupervisorModalOpen}
        onClose={() => setIsSupervisorModalOpen(false)}
        mode="create"
        onSubmit={handleAddSamUnit}
        titleOverride="Add New Supervisor"
        submitLabelOverride="Add Supervisor"
        teamName={samName}
        setTeamName={setSamName}
        memberName={samMemberName}
        setMemberName={setSamMemberName}
        memberCert={samCert}
        setMemberCert={setSamCert}
        roles={certifications.map(name => ({ name, fullName: name }))}
      />

      <BulkImportModal
        isOpen={bulkImportMode !== null}
        onClose={() => setBulkImportMode(null)}
        mode={bulkImportMode || 'team'}
        roles={certifications.map(name => ({ name, fullName: name }))}
        existingTeamNames={
          bulkImportMode === 'supervisor'
            ? (eventData.supervisor || []).map(s => s.team)
            : (eventData.staff || []).map(s => s.team)
        }
        onImport={handleBulkImport}
      />
    </main>
  );
}
