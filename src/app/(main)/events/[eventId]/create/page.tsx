'use client';

import { useRouter, useParams } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { Event, Venue, Layer, Staff, Supervisor, Post, Equipment, EventEquipment } from '@/app/types';
import { authService, dbService } from '@/lib/services';
import Image from 'next/image';
import { Tabs, Tab, Button, Card, ScrollShadow } from '@heroui/react';
import { parseDate, getLocalTimeZone, today } from '@internationalized/date';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DiagonalStreaksFixed } from "@/components/ui/diagonal-streaks-fixed";
import MapZoomControls from '@/components/ui/map-zoom-controls';
import MapPanSurface from '@/components/ui/map-pan-surface';
import { useScheduleGeneration } from '@/hooks/useScheduleGeneration';
import { useTeamForm } from '@/hooks/useTeamForm';
import { useZoomPan } from '@/hooks/useZoomPan';
import { useCertifications } from '@/hooks/useCertifications';
import MetadataSection from '@/components/event-create/MetadataSection';
import TeamStaffingSection from '@/components/event-create/TeamStaffingSection';
import SupervisorStaffingSection from '@/components/event-create/SupervisorStaffingSection';
import PostingScheduleSection from '@/components/event-create/PostingScheduleSection';
import { EquipmentSelectionSection, PostsSelectionSection } from '@/components/event-create/PostsEquipmentSection';
import TakSection from '@/components/event-create/TakSection';
import { stripUndefined } from '@/lib/utils';
import AddTeamModal from '@/components/modals/event/addteammodal';
import AddSupervisorModal from '@/components/modals/event/addsupervisormodal';
import BulkImportModal from '@/components/modals/event/bulkimportmodal';
import LoadingScreen from '@/components/ui/loading-screen';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

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
  });

  const [selectedTab, setSelectedTab] = useState<'teams' | 'supervisors' | 'posts' | 'equipment' | 'tak'>('teams');
  const [currentLayer, setCurrentLayer] = useState(0);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
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
    teamName,
    setTeamName,
    memberName,
    setMemberName,
    memberCert,
    setMemberCert,
    isTeamLead,
    setIsTeamLead,
    currentMembers,
    setCurrentMembers,
    addMember,
    removeMember,
    reset: resetTeamForm,
  } = useTeamForm();

  const [takCallsign, setTakCallsign] = useState('');
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [editTeamOriginalName, setEditTeamOriginalName] = useState<string | null>(null);

  const {
    scheduleFrom,
    setScheduleFrom,
    scheduleTo,
    setScheduleTo,
    scheduleBy,
    setScheduleBy,
    postingTimes,
  } = useScheduleGeneration();

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number; text: string } | null>(null);
  const [samName, setSamName] = useState('');
  const [samMemberName, setSamMemberName] = useState('');
  const [samCert, setSamCert] = useState('');
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});
  const [openSupervisors, setOpenSupervisors] = useState<Record<number, boolean>>({});
  const [postsEnabled, setPostsEnabled] = useState(true);
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
            
            // Migrate old venue format to new format with layers.
            // The length check is load-bearing: `layers: []` is an empty array,
            // which is truthy, so `!venue.layers` is false and a venue saved
            // with no layers would skip this migration on every load — keeping
            // its posts stranded on the legacy top-level `posts` field forever.
            let venue = data.venue;
            if (venue && (!venue.layers || venue.layers.length === 0)) {
              
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

  const handleAddTeam = () => {
    if (!teamName.trim()) {
      alert("Please enter a team name.");
      return;
    }
    if (currentMembers.length === 0) {
      alert("A team must have at least one member before saving.");
      return;
    }
    const duplicate = eventData.staff?.some(
      staff => staff.team.toLowerCase() === teamName.trim().toLowerCase()
    );
    if (duplicate) {
      alert("Team name already used. Please choose a different name.");
      return;
    }
    const members = currentMembers.map(
      m => `${m.name} [${m.cert}]${m.lead ? " (Lead)" : ""}`
    );
    const newStaff: Staff = {
      team: teamName.trim(),
      location: "No Post",
      status: "On Break",
      members,
      ...(takCallsign.trim() ? { takCallsign: takCallsign.trim() } : {}),
    };
    setEventData(prev => ({ ...prev, staff: [...(prev.staff || []), newStaff] }));
    resetTeamForm();
    setTakCallsign('');
    setIsTeamModalOpen(false);
  };

  const handleEditTeam = (idx: number) => {
    const staff = (eventData.staff || [])[idx];
    if (!staff) return;

    setTeamName(staff.team);
    setTakCallsign(staff.takCallsign || '');
    const parsedMembers = (staff.members || []).map((m) => {
      const lead = m.includes('(Lead)');
      const nameCertMatch = m.match(/^(.+?)\s\[(.+?)\]/);
      const name = nameCertMatch ? nameCertMatch[1].trim() : m.trim();
      const cert = nameCertMatch ? nameCertMatch[2].trim() : '';
      return { name, cert, lead };
    });
    setCurrentMembers(parsedMembers);
    setMemberName('');
    setMemberCert('');
    setIsTeamLead(false);
    setEditTeamOriginalName(staff.team);
    setIsEditTeamModalOpen(true);
  };

  const handleSaveEditedTeam = () => {
    if (!teamName.trim() || currentMembers.length === 0 || !editTeamOriginalName) {
      alert('Please enter a team name and add at least one member.');
      return;
    }

    const newName = teamName.trim();
    const oldName = editTeamOriginalName;

    const duplicate = (eventData.staff || []).some(
      staff => staff.team !== oldName && staff.team.toLowerCase() === newName.toLowerCase()
    );
    if (duplicate) {
      alert(`A team with the name "${newName}" already exists. Please choose a different name.`);
      return;
    }

    const members = currentMembers.map(
      m => `${m.name} [${m.cert}]${m.lead ? " (Lead)" : ""}`
    );
    const trimmedCallsign = takCallsign.trim();

    // Event creation has no calls/detached-teams/post-assignments yet — the team's
    // own entry in `staff` is the only place the team name is keyed by, so renaming
    // it here is the entire propagation surface (unlike the dispatch page, which
    // also has to rewrite calls[].assignedTeam and calls[].detachedTeams).
    setEventData(prev => ({
      ...prev,
      staff: (prev.staff || []).map(s => {
        if (s.team !== oldName) return s;
        const { takCallsign: _prevCallsign, ...rest } = s;
        return {
          ...rest,
          ...(trimmedCallsign ? { takCallsign: trimmedCallsign } : {}),
          team: newName,
          members,
        };
      }),
    }));

    resetTeamForm();
    setTakCallsign('');
    setEditTeamOriginalName(null);
    setIsEditTeamModalOpen(false);
  };

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

      let eventDocId = eventId;
      if (eventDocId) {
        try {
          const docSnap2 = await dbService.getDocument('events', eventDocId);
          if (docSnap2.exists) {
            await dbService.updateDocument('events', eventDocId, stripUndefined({
              ...eventData,
              postingTimes: computedTimes.length > 0 ? computedTimes : eventData.postingTimes,
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
  
  const hasVenue = Boolean(eventData.venue?.name);

  // A venue may carry its posts on the legacy top-level `posts` field with
  // `layers: []`. Deriving markers straight off `venue.layers` renders nothing
  // in that case, which reads as "this venue has no posts" rather than as a
  // format difference. Normalize to a single synthesized layer first — the same
  // shape the dispatch map builds in `events/[eventId]/dispatch/page.tsx`.
  const effectiveLayers: Layer[] = eventData.venue?.layers?.length
    ? eventData.venue.layers
    : hasVenue
      ? [{
          id: eventData.venue?.id || 'layer-1',
          name: 'Main Floor',
          posts: eventData.venue?.posts || eventData.eventPosts || [],
          mapUrl: eventData.venue?.mapUrl,
        }]
      : [];

  const hasMap = hasVenue && Boolean(effectiveLayers[currentLayer]?.mapUrl);
  const allPosts = effectiveLayers.flatMap(layer => layer.posts || []);
  const currentLayerPosts = effectiveLayers[currentLayer]?.posts || [];
  const flattenedPosts = effectiveLayers.flatMap(layer => (layer.posts || []).map(p => ({ post: p, layerName: layer.name })));

  

  const inputClassNames = {
    label: 'text-surface-light font-medium',
    inputWrapper: 'rounded-2xl px-4',
    input: 'text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0',
  };

  const selectClassNames = {
    label: 'text-surface-light font-medium',
    input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
    inputWrapper: 'rounded-2xl px-4 pr-6 shadow-none group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0',
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

  return (
    <main className="relative bg-surface-deepest text-surface-light h-[calc(100dvh-3.5rem)] overflow-hidden leading-none">
      <DiagonalStreaksFixed />
      <div className="relative z-10 max-w-[1200px] mx-auto h-full overflow-hidden">
        <div className="h-full overflow-hidden">
          <div className="flex h-full overflow-hidden">
            <PanelGroup direction="horizontal">
              <Panel defaultSize={40} minSize={30} maxSize={60}>
                <div className="flex flex-col h-full relative overflow-hidden">
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-4 pb-4 flex-1 flex flex-col min-h-0">
                    {/* Event Name and Date (side-by-side) */}
                    <MetadataSection
                      eventData={eventData}
                      setEventData={setEventData}
                      getCalendarDate={getCalendarDate}
                      inputClassNames={inputClassNames}
                    />

                    {/* Tabs with blurred background - extends to bottom */}
                    <Card
                      isBlurred
                      className="flex-1 flex flex-col mt-4 overflow-hidden"
                      style={{ backgroundColor: 'hsl(var(--surface-bg-2) / 0.5)' }}
                    >
                    <Tabs
                      selectedKey={selectedTab}
                      onSelectionChange={(key) => setSelectedTab(key as typeof selectedTab)}
                      fullWidth
                      className="w-full flex-shrink-0"
                      classNames={{
                        tabList: 'p-1 w-full flex-shrink-0',
                        tab: 'text-surface-light data-[selected=true]:text-surface-light',
                        panel: 'hidden',
                      }}
                    >
                      <Tab key="teams" title="Teams" />
                      <Tab key="supervisors" title="Supervisors" />
                      <Tab key="posts" title="Posts" />
                      <Tab key="equipment" title="Equipment" />
                      <Tab key="tak" title="TAK" />
                    </Tabs>

                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      {selectedTab === 'teams' && (
                        <TeamStaffingSection
                          staff={eventData.staff || []}
                          openTeams={openTeams}
                          setOpenTeams={setOpenTeams}
                          onDeleteTeam={handleDeleteTeam}
                          onEditTeam={handleEditTeam}
                          onAddTeam={() => setIsTeamModalOpen(true)}
                          onUploadCSV={() => setBulkImportMode('team')}
                        />
                      )}

                      {selectedTab === 'supervisors' && (
                        <SupervisorStaffingSection
                          supervisors={eventData.supervisor || []}
                          openSupervisors={openSupervisors}
                          setOpenSupervisors={setOpenSupervisors}
                          onDeleteSupervisor={handleDeleteSupervisor}
                          onUploadCSV={() => setBulkImportMode('supervisor')}
                          onAddSupervisor={() => setIsSupervisorModalOpen(true)}
                        />
                      )}

                      {selectedTab === 'posts' && (
                        <div className="px-4 py-3 flex-1 min-h-0 flex flex-col">
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
                              scheduleFrom={scheduleFrom}
                              setScheduleFrom={setScheduleFrom}
                              scheduleTo={scheduleTo}
                              setScheduleTo={setScheduleTo}
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
                      )}

                      {selectedTab === 'equipment' && (
                        <div className="flex flex-col h-full overflow-hidden">
                          <div className="flex-shrink-0 px-4 pt-3 flex items-center justify-between">
                            <h3 className="text-surface-light font-semibold text-lg">Equipment</h3>
                            <div className="w-8 h-8" />
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
                      )}

                      {selectedTab === 'tak' && (
                        <div className="px-4 py-3 flex-1 min-h-0 flex flex-col">
                          <ScrollShadow className="pr-2 scrollbar-hide flex-1 min-h-0" hideScrollBar style={{ overflow: 'auto' }}>
                            <TakSection
                              settings={eventData.tak}
                              onChange={(next) => setEventData((prev) => ({ ...prev, tak: next }))}
                              event={eventData as Event}
                              venue={hasVenue ? (eventData.venue as Venue) : null}
                            />
                          </ScrollShadow>
                        </div>
                      )}
                    </div>
                    </Card>

                    {/* Submit Button removed from left column (moved to right header) */}
                        </div>
                      </div>
                    </div>
                  </Panel>
                  <PanelResizeHandle className="w-1 bg-surface-liner transition-colors cursor-col-resize flex items-center justify-center group">
                    <div className="w-0.5 h-8 bg-surface-light/30 rounded-full transition-colors" />
                  </PanelResizeHandle>
                  <Panel defaultSize={60} minSize={40}>
                    <div className="flex flex-col h-full relative px-6 pt-2 pb-4 overflow-hidden">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-shrink-0">
                          <div>
                            {hasVenue && <h2 className="text-surface-light text-xl font-semibold">{eventData.venue?.name}</h2>}
                          </div>
                          <div>
                            <Button
                              onPress={handleSubmit}
                              size="md"
                              radius="lg"
                              className="bg-accent hover:bg-accent/90 text-surface-light"
                            >
                              Create Event
                            </Button>
                          </div>
                        </div>

                {/* Map */}
                {hasMap ? (
                  <div className="w-full flex flex-col gap-3">
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
                            src={effectiveLayers[currentLayer]?.mapUrl || ''}
                            alt={`${effectiveLayers[currentLayer]?.name || 'Venue'} map`}
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
                            {effectiveLayers[currentLayer]?.name || 'Main Floor'}
                          </span>
                        </div>
                        {effectiveLayers.length > 1 && (
                          <div className="flex items-center gap-2">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              onPress={() => setCurrentLayer(prev => Math.max(0, prev - 1))}
                              isDisabled={currentLayer === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-surface-light">
                              {currentLayer + 1} / {effectiveLayers.length}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              onPress={() => setCurrentLayer(prev => Math.min(effectiveLayers.length - 1, prev + 1))}
                              isDisabled={currentLayer === effectiveLayers.length - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="bg-surface-deep rounded-2xl p-8 text-center text-surface-faint">
                    No map available
                  </div>
                )}
                      </div>
                    </div>
                  </Panel>
                </PanelGroup>
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
        onClose={() => setIsTeamModalOpen(false)}
        mode="create"
        onSubmit={handleAddTeam}
        titleOverride="Add New Team"
        submitLabelOverride="Add Team"
        teamName={teamName}
        setTeamName={setTeamName}
        takCallsign={takCallsign}
        setTakCallsign={setTakCallsign}
        memberName={memberName}
        setMemberName={setMemberName}
        memberCert={memberCert}
        setMemberCert={setMemberCert}
        isTeamLead={isTeamLead}
        setIsTeamLead={setIsTeamLead}
        addMember={addMember}
        currentMembers={currentMembers}
        removeMember={removeMember}
        roles={certifications.map(name => ({ name, fullName: name }))}
      />

      <AddTeamModal
        isOpen={isEditTeamModalOpen}
        onClose={() => setIsEditTeamModalOpen(false)}
        mode="edit"
        onSubmit={handleSaveEditedTeam}
        teamName={teamName}
        setTeamName={setTeamName}
        takCallsign={takCallsign}
        setTakCallsign={setTakCallsign}
        memberName={memberName}
        setMemberName={setMemberName}
        memberCert={memberCert}
        setMemberCert={setMemberCert}
        isTeamLead={isTeamLead}
        setIsTeamLead={setIsTeamLead}
        addMember={addMember}
        currentMembers={currentMembers}
        removeMember={removeMember}
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
