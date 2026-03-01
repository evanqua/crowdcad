'use client';

import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/firebase';
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Event, Venue, Staff, Supervisor, Post, Equipment, EventEquipment } from '@/app/types';
import { getAuth } from 'firebase/auth';
import Image from 'next/image';
import { Tabs, Tab, Input, DatePicker, Select, SelectItem, Checkbox, Button, Card, ScrollShadow, Chip, TimeInput } from '@heroui/react';
import { parseDate, getLocalTimeZone, today, Time } from '@internationalized/date';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { DiagonalStreaksFixed } from "@/components/ui/diagonal-streaks-fixed";
import { stripUndefined } from '@/lib/utils';
import AddTeamModal from '@/components/modals/event/addteammodal';
import AddSupervisorModal from '@/components/modals/event/addsupervisormodal';
import LoadingScreen from '@/components/ui/loading-screen';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

const LICENSES = ['CPR', 'EMT-B', 'EMT-A', 'EMT-P', 'RN', 'MD/DO'];

// Helper to check if Post is an object with name property
const isPostObject = (post: Post): post is { name: string; x: number | null; y: number | null } => {
  return typeof post === 'object' && post !== null && 'name' in post;
};

// Helper to get post name regardless of type
const getPostName = (post: Post): string => {
  return typeof post === 'string' ? post : post.name;
};


export default function EventCreation() {
  const router = useRouter();
  const params = useParams();
  const eventId = params?.eventId as string | undefined;

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

  const [selectedTab, setSelectedTab] = useState<'teams' | 'supervisors' | 'posts' | 'equipment'>('teams');
  const [currentLayer, setCurrentLayer] = useState(0);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const submittedRef = useRef(false);

  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number; text: string } | null>(null);

  const [teamName, setTeamName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberCert, setMemberCert] = useState('');
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [currentMembers, setCurrentMembers] = useState<{ name: string; cert: string; lead: boolean }[]>([]);
  const [samName, setSamName] = useState('');
  const [samMemberName, setSamMemberName] = useState('');
  const [samCert, setSamCert] = useState('');
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});
  const [openSupervisors, setOpenSupervisors] = useState<Record<number, boolean>>({});
  const [postsEnabled, setPostsEnabled] = useState(true);
  const [lastSelectedPostIndex, setLastSelectedPostIndex] = useState<number | null>(null);
  const [scheduleFrom, setScheduleFrom] = useState<Time>(new Time(16, 0));
  const [scheduleTo, setScheduleTo] = useState<Time>(new Time(23, 59));
  const [scheduleBy, setScheduleBy] = useState('75');
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
    const intervalMinutes = parseInt(scheduleBy) || 0;
    if (intervalMinutes <= 0) {
      setScheduleChips([]);
      setEventData(prev => ({ ...prev, postingTimes: [] }));
      return;
    }

    const fromMinutes = scheduleFrom.hour * 60 + scheduleFrom.minute;
    const toMinutes = scheduleTo.hour * 60 + scheduleTo.minute;

    // Allow ranges that span midnight. If `to` is <= `from`, treat `to` as next day.
    const MINUTES_IN_DAY = 24 * 60;
    let endMinutes = toMinutes;
    if (toMinutes <= fromMinutes) {
      endMinutes = toMinutes + MINUTES_IN_DAY;
    }

    const chips: { id: string; time: string; editable: boolean }[] = [];
    const times: string[] = [];

    // Safety cap to avoid accidental infinite loops when intervalMinutes is tiny.
    const maxIterations = Math.ceil((endMinutes - fromMinutes) / Math.max(1, intervalMinutes)) + 2;
    let iterations = 0;

    for (let minutes = fromMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
      if (++iterations > maxIterations) break;
      const mod = minutes % MINUTES_IN_DAY;
      const hours = Math.floor(mod / 60);
      const mins = mod % 60;
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      chips.push({ id: crypto.randomUUID(), time: timeStr, editable: false });
      times.push(timeStr);
    }

    setScheduleChips(chips);
    setEventData(prev => ({ ...prev, postingTimes: times }));
  }, [scheduleFrom, scheduleTo, scheduleBy]);

  // Autosave postingTimes to the draft event document when they change.
  // Debounced to avoid excessive writes while the user is adjusting inputs.
  useEffect(() => {
    if (!eventId) return;
    const times = eventData.postingTimes || [];
    const timeout = setTimeout(async () => {
      try {
        const docRef = doc(db, 'events', eventId);
        await updateDoc(docRef, stripUndefined({ postingTimes: times }));
        // eslint-disable-next-line no-console
        console.log('Autosaved postingTimes to draft:', { eventId, postingTimes: times });
      } catch (err) {
        // eslint-disable-next-line no-console
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
          const docRef = doc(db, 'events', eventId);
          const docSnap = await getDoc(docRef);
          
          
          if (docSnap.exists()) {
            const data = docSnap.data() as Event;
            
            
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
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }
          // Ensure postingTimes are computed and included in the draft at creation time
          const intervalMinutes = parseInt(scheduleBy) || 0;
          const times: string[] = [];
          if (intervalMinutes > 0) {
            const fromMinutes = scheduleFrom.hour * 60 + scheduleFrom.minute;
            const toMinutes = scheduleTo.hour * 60 + scheduleTo.minute;
            const MINUTES_IN_DAY = 24 * 60;
            let endMinutes = toMinutes;
            if (toMinutes <= fromMinutes) {
              endMinutes = toMinutes + MINUTES_IN_DAY;
            }

            // Safety cap
            const maxIterations = Math.ceil((endMinutes - fromMinutes) / Math.max(1, intervalMinutes)) + 2;
            let iterations = 0;
            for (let minutes = fromMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
              if (++iterations > maxIterations) break;
              const mod = minutes % MINUTES_IN_DAY;
              const hours = Math.floor(mod / 60);
              const mins = mod % 60;
              const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
              times.push(timeStr);
            }
          }

          const draft = {
            ...eventData,
            postingTimes: times.length > 0 ? times : eventData.postingTimes,
            userId: user.uid,
            date: new Date(eventData.date!).toISOString(),
            createdAt: new Date().toISOString(),
            status: 'draft',
          };
        const docRef = await addDoc(collection(db, 'events'), stripUndefined(draft));
        setEventData(prev => ({ ...prev, userId: user.uid }));
        router.replace(`/events/${docRef.id}/create`);
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
    };
    setEventData(prev => ({ ...prev, staff: [...(prev.staff || []), newStaff] }));
    setTeamName("");
    setCurrentMembers([]);
    setIsTeamModalOpen(false);
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

  const addMember = () => {
    if (memberName.trim() && memberCert) {
      setCurrentMembers(prev => [...prev, { name: memberName.trim(), cert: memberCert, lead: isTeamLead }]);
      setMemberName('');
      setMemberCert('');
      setIsTeamLead(false);
    }
  };

  const removeMember = (index: number) => {
    setCurrentMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    submittedRef.current = true;
    try {
      const auth = getAuth();
      const user = auth.currentUser;
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
      const computePostingTimes = (): string[] => {
        const intervalMinutes = parseInt(scheduleBy) || 0;
        const times: string[] = [];
        if (intervalMinutes <= 0) return times;

        const fromMinutes = scheduleFrom.hour * 60 + scheduleFrom.minute;
        const toMinutes = scheduleTo.hour * 60 + scheduleTo.minute;
        const MINUTES_IN_DAY = 24 * 60;
        let endMinutes = toMinutes;
        if (toMinutes <= fromMinutes) {
          endMinutes = toMinutes + MINUTES_IN_DAY;
        }

        const maxIterations = Math.ceil((endMinutes - fromMinutes) / Math.max(1, intervalMinutes)) + 2;
        let iterations = 0;
        for (let minutes = fromMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
          if (++iterations > maxIterations) break;
          const mod = minutes % MINUTES_IN_DAY;
          const hours = Math.floor(mod / 60);
          const mins = mod % 60;
          const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          times.push(timeStr);
        }
        return times;
      };

      const computedTimes = computePostingTimes();
      // eslint-disable-next-line no-console
      console.log('handleSubmit computed postingTimes:', computedTimes, 'eventData.postingTimes:', eventData.postingTimes);

      let eventDocId = eventId;
      if (eventDocId) {
        try {
          const docRef = doc(db, 'events', eventDocId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            await updateDoc(docRef, stripUndefined({
              ...eventData,
              postingTimes: computedTimes.length > 0 ? computedTimes : eventData.postingTimes,
              userId: user.uid,
              date: dateValue.toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'active',
            }));
            // eslint-disable-next-line no-console
            console.log('Event updated:', { eventId: eventDocId, postingTimes: eventData.postingTimes || [] });
          } else {
            const newDocRef = await addDoc(collection(db, 'events'), stripUndefined({
              ...eventData,
              postingTimes: computedTimes.length > 0 ? computedTimes : eventData.postingTimes,
              userId: user.uid,
              date: dateValue.toISOString(),
              createdAt: new Date().toISOString(),
              status: 'active',
            }));
            eventDocId = newDocRef.id;
            // eslint-disable-next-line no-console
            console.log('Event created (branch new):', { eventId: eventDocId, postingTimes: eventData.postingTimes || [] });
          }
        } catch (error) {
          console.error('Error checking/updating document:', error);
          const newDocRef = await addDoc(collection(db, 'events'), stripUndefined({
            ...eventData,
            userId: user.uid,
            date: dateValue.toISOString(),
            createdAt: new Date().toISOString(),
            status: 'active',
          }));
          eventDocId = newDocRef.id;
          // eslint-disable-next-line no-console
          console.log('Event created (catch):', { eventId: eventDocId, postingTimes: eventData.postingTimes || [] });
        }
      } else {
        const docRef = await addDoc(collection(db, 'events'), stripUndefined({
          ...eventData,
          userId: user.uid,
          date: dateValue.toISOString(),
          createdAt: new Date().toISOString(),
          status: 'active',
        }));
        eventDocId = docRef.id;
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
  
  const hasVenue = eventData.venue && eventData.venue.name;
  const hasMap = hasVenue && Boolean(eventData.venue?.layers?.[currentLayer]?.mapUrl);
  const allPosts = hasVenue ? (eventData.venue?.layers?.flatMap(layer => layer.posts || []) || []) : [];
  const currentLayerPosts = hasVenue ? (eventData.venue?.layers?.[currentLayer]?.posts || []) : [];
  const flattenedPosts = hasVenue ? (eventData.venue?.layers?.flatMap(layer => (layer.posts || []).map(p => ({ post: p, layerName: layer.name }))) || []) : [];

  

  const inputClassNames = {
    label: 'text-white font-medium',
    inputWrapper: 'rounded-2xl px-4',
    input: 'text-white outline-none focus:outline-none data-[focus=true]:outline-none',
  };

  const selectClassNames = {
    label: 'text-white font-medium',
    input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
    inputWrapper: 'rounded-2xl px-4 pr-6',
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

  // Zoom handlers
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle wheel (prevent default scrolling)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;

    const img = imgRef.current;
    const container = imgContainerRef.current;
    if (!img || !container) {
      setPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const imgWidth = img.offsetWidth * scale;
    const imgHeight = img.offsetHeight * scale;

    const newX = e.clientX - panStart.x;
    const newY = e.clientY - panStart.y;

    const maxX = Math.max(0, (imgWidth - containerRect.width) / scale);
    const maxY = Math.max(0, (imgHeight - containerRect.height) / scale);

    setPosition({
      x: Math.min(0, Math.max(-maxX, newX)),
      y: Math.min(0, Math.max(-maxY, newY)),
    });
  };

  // Handle pan end
  const handleMouseUp = () => {
    setIsPanning(false);
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
    <main className="relative bg-surface-deepest text-white h-[calc(100vh-3rem)] overflow-hidden leading-none">
      <DiagonalStreaksFixed />
      <div className="relative z-10 max-w-[1200px] mx-auto h-full overflow-hidden">
        <div className="h-full overflow-hidden">
          <div className="flex h-full overflow-hidden">
            <PanelGroup direction="horizontal">
              <Panel defaultSize={40} minSize={30} maxSize={60}>
                <div className="flex flex-col h-full relative overflow-hidden">
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-4 pb-0">
                    {/* Event Name and Date (side-by-side) */}
                    <div className="flex items-end gap-4">
                      <div style={{ flex: 4 }}>
                        <Input
                          label="Event Name"
                          labelPlacement="outside"
                          placeholder="Enter event name"
                          value={eventData.name || ''}
                          onValueChange={(value) => setEventData(prev => ({ ...prev, name: value }))}
                          classNames={inputClassNames}
                          size="lg"
                        />
                      </div>
                      <div style={{ flex: 3 }}>
                        <DatePicker
                          label="Event Date"
                          labelPlacement="outside"
                          value={getCalendarDate()}
                          onChange={(date) => {
                            if (date) {
                              setEventData(prev => ({ ...prev, date: date.toString() }));
                            }
                          }}
                          classNames={inputClassNames}
                          size="lg"
                        />
                      </div>
                    </div>

                    {/* Tabs with blurred background - extends to bottom */}
                    <Card
                      isBlurred
                      className="flex-1 flex flex-col mt-4 overflow-hidden"
                      style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)' }}
                    >
                    <Tabs
                      selectedKey={selectedTab}
                      onSelectionChange={(key) => setSelectedTab(key as typeof selectedTab)}
                      className="flex-1 flex flex-col h-full"
                      classNames={{
                        tabList: 'p-1 flex-shrink-0',
                        tab: 'text-white data-[selected=true]:text-white',
                        panel: 'pt-0 flex-1 flex flex-col overflow-hidden',
                      }}
                    >
                      <Tab key="teams" title="Teams" className="flex flex-col h-full">
                        {/* Teams header with add button (sticky at top) */}
                        <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between">
                          <h3 className="text-white font-semibold text-lg">Teams</h3>
                          <Button
                            isIconOnly
                            size="sm"
                            onPress={() => setIsTeamModalOpen(true)}
                            className="min-w-8 w-8 h-8"
                            style={{ backgroundColor: '#27272a' }}
                          >
                            <Plus className="h-4 w-4 text-white" />
                          </Button>
                        </div>

                        {/* Teams list (scrollable) */}
                        <div className="px-4 py-3">
                          <ScrollShadow className="space-y-2 pr-2 scrollbar-hide" hideScrollBar style={{ minHeight: 'calc(100vh - 334px)', maxHeight: 'calc(100vh - 334px)', overflow: 'auto' }}>
                            {(eventData.staff || []).map((staff, idx) => (
                              <div key={idx} className="rounded-2xl p-3" style={{ backgroundColor: '#27272a' }}>
                                <div
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => setOpenTeams(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                >
                                  <span className="text-white font-medium">{staff.team}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteTeam(idx); }}
                                      className="p-1 rounded bg-transparent"
                                      aria-label="Delete team"
                                    >
                                      <Trash2 className="h-4 w-4 text-white" />
                                    </button>
                                  </div>
                                </div>
                                {openTeams[idx] && (
                                  <ul className="mt-2 list-disc list-inside text-sm text-gray-300">
                                    {staff.members.map((member, mIdx) => (
                                      <li key={mIdx}>{member}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </ScrollShadow>
                        </div>
                      </Tab>

                      <Tab key="supervisors" title="Supervisors" className="flex flex-col h-full">
                        {/* Supervisors header with add button (sticky at top) */}
                        <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between">
                          <h3 className="text-white font-semibold text-lg">Supervisors</h3>
                          <Button
                            isIconOnly
                            size="sm"
                            onPress={() => setIsSupervisorModalOpen(true)}
                            className="min-w-8 w-8 h-8"
                            style={{ backgroundColor: '#27272a' }}
                          >
                            <Plus className="h-4 w-4 text-white" />
                          </Button>
                        </div>

                        {/* Supervisors list (scrollable) */}
                        <div className="px-4 py-3">
                          <ScrollShadow className="space-y-2 pr-2 scrollbar-hide" hideScrollBar style={{ minHeight: 'calc(100vh - 334px)', maxHeight: 'calc(100vh - 334px)', overflow: 'auto' }}>
                            {(eventData.supervisor || []).map((supervisor, idx) => (
                              <div key={idx} className="rounded-2xl p-3" style={{ backgroundColor: '#27272a' }}>
                                <div
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => setOpenSupervisors(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                >
                                  <span className="text-white font-medium">{supervisor.team}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteSupervisor(idx); }}
                                      className="p-1 rounded bg-transparent"
                                      aria-label="Delete supervisor"
                                    >
                                      <Trash2 className="h-4 w-4 text-white" />
                                    </button>
                                  </div>
                                </div>
                                {openSupervisors[idx] && (
                                  <ul className="mt-2 list-disc list-inside text-sm text-gray-300">
                                    <li>{supervisor.member}</li>
                                  </ul>
                                )}
                              </div>
                            ))}
                          </ScrollShadow>
                        </div>
                      </Tab>

                      <Tab key="posts" title="Posts" className="flex flex-col h-full">
                        <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between">
                          <h3 className="text-white font-semibold text-lg">Posts</h3>
                          <Checkbox
                            isSelected={postsEnabled}
                            onValueChange={setPostsEnabled}
                            size="sm"
                          >
                            <span className="text-sm text-white">Enable Posts</span>
                          </Checkbox>
                        </div>

                        <div className="px-4 py-3">
                          <ScrollShadow className="space-y-4 pr-2 scrollbar-hide" hideScrollBar style={{ minHeight: 'calc(100vh - 334px)', maxHeight: 'calc(100vh - 334px)', overflow: 'auto' }}>
                            {hasVenue && (
                              <>
                                <div className={`space-y-3 ${!postsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                                  <Select
                                    label="Select Posts"
                                    labelPlacement="outside"
                                    placeholder="Choose posts for this event"
                                    selectionMode="multiple"
                                    // Controlled selection via eventData.eventPosts
                                    selectedKeys={new Set((eventData.eventPosts || []).map(p => getPostName(p)))}
                                    // We'll manage selection via click handlers to support shift-range
                                    isDisabled={!postsEnabled}
                                    classNames={selectClassNames}
                                    size="lg"
                                    disabledKeys={[]}
                                  >
                                    {flattenedPosts.map(({ post, layerName }, idx) => {
                                      const postName = getPostName(post);
                                      return (
                                        <SelectItem
                                          key={postName}
                                          textValue={postName}
                                          onClick={(e: React.MouseEvent) => {
                                            // Use native MouseEvent to detect shiftKey
                                            const me = e as React.MouseEvent;
                                            // Prevent the Select component from toggling selection itself; we'll control state
                                            me.preventDefault();
                                            me.stopPropagation();
                                            // Range selection when shift is held
                                            if (me.shiftKey && lastSelectedPostIndex !== null) {
                                              const start = Math.min(lastSelectedPostIndex, idx);
                                              const end = Math.max(lastSelectedPostIndex, idx);
                                              const namesInRange = flattenedPosts.slice(start, end + 1).map(fp => getPostName(fp.post));
                                              const uniqueNames = Array.from(new Set([...(eventData.eventPosts || []).map(p => getPostName(p)), ...namesInRange]));
                                              const newPosts = uniqueNames.map(name => allPosts.find(p => getPostName(p) === name)!).filter(Boolean);
                                              setEventData(prev => ({ ...prev, eventPosts: newPosts }));
                                              setLastSelectedPostIndex(idx);
                                              return;
                                            }

                                            const selectedSet = new Set((eventData.eventPosts || []).map(p => getPostName(p)));

                                            // Shift+click: add the range between last and current to selection
                                            if (me.shiftKey && lastSelectedPostIndex !== null) {
                                              const start = Math.min(lastSelectedPostIndex, idx);
                                              const end = Math.max(lastSelectedPostIndex, idx);
                                              const namesInRange = flattenedPosts.slice(start, end + 1).map(fp => getPostName(fp.post));
                                              for (const n of namesInRange) selectedSet.add(n);
                                              const newPosts = Array.from(selectedSet).map(name => allPosts.find(p => getPostName(p) === name)!).filter(Boolean);
                                              setEventData(prev => ({ ...prev, eventPosts: newPosts }));
                                              setLastSelectedPostIndex(idx);
                                              return;
                                            }

                                            // Ctrl/Cmd click: toggle single item
                                            if (me.ctrlKey || me.metaKey) {
                                              if (selectedSet.has(postName)) selectedSet.delete(postName);
                                              else selectedSet.add(postName);
                                              const newPosts = Array.from(selectedSet).map(name => allPosts.find(p => getPostName(p) === name)!).filter(Boolean);
                                              setEventData(prev => ({ ...prev, eventPosts: newPosts }));
                                              setLastSelectedPostIndex(idx);
                                              return;
                                            }

                                            // Default click: toggle single item (preserve other selections)
                                            if (selectedSet.has(postName)) selectedSet.delete(postName);
                                            else selectedSet.add(postName);
                                            const newPosts = Array.from(selectedSet).map(name => allPosts.find(p => getPostName(p) === name)!).filter(Boolean);
                                            setEventData(prev => ({ ...prev, eventPosts: newPosts }));
                                            setLastSelectedPostIndex(idx);
                                          }}
                                        >
                                          {postName} ({layerName})
                                        </SelectItem>
                                      );
                                    })}
                                  </Select>

                                  {(eventData.eventPosts || []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {(eventData.eventPosts || []).map((post, idx) => {
                                        const postName = getPostName(post);
                                        return (
                                          <Chip
                                            key={idx}
                                            onClose={() => {
                                              setEventData(prev => ({
                                                ...prev,
                                                eventPosts: (prev.eventPosts || []).filter((_, i) => i !== idx)
                                              }));
                                            }}
                                            variant="flat"
                                            style={{ backgroundColor: '#3eb1fd33', color: '#3eb1fd' }}
                                          >
                                            {postName}
                                          </Chip>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                <div className={`space-y-3 mt-6 ${!postsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                                  <h3 className="text-white font-semibold text-lg">Schedule</h3>
                                  
                                  <div className="grid grid-cols-3 gap-3">
                                    <TimeInput
                                      label="From"
                                      labelPlacement="inside"
                                      value={scheduleFrom}
                                      onChange={(value) => value && setScheduleFrom(value)}
                                      hourCycle={24}
                                      isDisabled={!postsEnabled}
                                      classNames={inputClassNames}
                                      size="md"
                                    />
                                    <TimeInput
                                      label="To"
                                      labelPlacement="inside"
                                      value={scheduleTo}
                                      onChange={(value) => value && setScheduleTo(value)}
                                      hourCycle={24}
                                      isDisabled={!postsEnabled}
                                      classNames={inputClassNames}
                                      size="md"
                                    />
                                    <Input
                                      label="By"
                                      labelPlacement="inside"
                                      placeholder="75"
                                      value={scheduleBy}
                                      onValueChange={setScheduleBy}
                                      type="number"
                                      min="1"
                                      endContent="min"
                                      isDisabled={!postsEnabled}
                                      classNames={inputClassNames}
                                      size="md"
                                    />
                                  </div>

                                  {scheduleChips.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                      {scheduleChips.map((chip) => (
                                        <Chip
                                          key={chip.id}
                                          onClose={() => {
                                            const timeToRemove = chip.time;
                                            setScheduleChips(prev => prev.filter(c => c.id !== chip.id));
                                            setEventData(prev => ({
                                              ...prev,
                                              postingTimes: (prev.postingTimes || []).filter(t => t !== timeToRemove)
                                            }));
                                          }}
                                          variant="flat"
                                          style={{ backgroundColor: '#3eb1fd33', color: '#3eb1fd' }}
                                          onClick={() => {
                                            setEditingChipId(chip.id);
                                            setEditingChipValue(chip.time);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          {editingChipId === chip.id ? (
                                            <input
                                              type="text"
                                              value={editingChipValue}
                                              onChange={(e) => setEditingChipValue(e.target.value)}
                                              onBlur={() => {
                                                const oldTime = scheduleChips.find(c => c.id === chip.id)?.time;
                                                setScheduleChips(prev => prev.map(c => 
                                                  c.id === chip.id ? { ...c, time: editingChipValue } : c
                                                ));
                                                if (oldTime) {
                                                  setEventData(prev => ({
                                                    ...prev,
                                                    postingTimes: (prev.postingTimes || []).map(t => t === oldTime ? editingChipValue : t)
                                                  }));
                                                }
                                                setEditingChipId(null);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  const oldTime = scheduleChips.find(c => c.id === chip.id)?.time;
                                                  setScheduleChips(prev => prev.map(c => 
                                                    c.id === chip.id ? { ...c, time: editingChipValue } : c
                                                  ));
                                                  if (oldTime) {
                                                    setEventData(prev => ({
                                                      ...prev,
                                                      postingTimes: (prev.postingTimes || []).map(t => t === oldTime ? editingChipValue : t)
                                                    }));
                                                  }
                                                  setEditingChipId(null);
                                                }
                                              }}
                                              autoFocus
                                              className="bg-transparent outline-none w-16 text-center"
                                            />
                                          ) : (
                                            chip.time
                                          )}
                                        </Chip>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </ScrollShadow>
                        </div>
                      </Tab>


                      <Tab key="equipment" title="Equipment" className="flex flex-col h-full">
                        <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between">
                          <h3 className="text-white font-semibold text-lg">Equipment</h3>
                          <div />
                        </div>

                        <div className="flex-1 px-4 py-3">
                          {hasVenue && (
                            <ScrollShadow className="space-y-2 pr-2 scrollbar-hide" hideScrollBar style={{ minHeight: 'calc(100vh - 334px)', maxHeight: 'calc(100vh - 334px)', overflow: 'auto' }}>
                              {eventData.venue?.equipment?.map(equip => {
                                const selectedEquip = eventData.eventEquipment.find(e => e.id === equip.id);
                                const isSelected = !!selectedEquip;
                                return (
                                  <div key={equip.id} className="rounded-2xl p-3" style={{ backgroundColor: '#27272a' }}>
                                    <div className="flex items-center gap-3">
                                      <Checkbox
                                        isSelected={isSelected}
                                        onValueChange={(checked) => {
                                          if (checked) {
                                            setEventData(prev => ({ 
                                              ...prev, 
                                              eventEquipment: [...prev.eventEquipment, { ...equip, defaultLocation: undefined }] 
                                            }));
                                          } else {
                                            setEventData(prev => ({ 
                                              ...prev, 
                                              eventEquipment: prev.eventEquipment.filter(e => e.id !== equip.id) 
                                            }));
                                          }
                                        }}
                                      />
                                      <span className="text-white font-medium flex-shrink-0">{equip.name}</span>
                                      {isSelected && (
                                        <Select
                                          placeholder="Select Default Location"
                                          selectedKeys={selectedEquip?.defaultLocation ? [selectedEquip.defaultLocation] : []}
                                          onSelectionChange={(keys) => {
                                            const locName = Array.from(keys)[0] as string;
                                            setEventData(prev => ({
                                              ...prev,
                                              eventEquipment: prev.eventEquipment.map(e =>
                                                e.id === equip.id ? { ...e, defaultLocation: locName } : e
                                              ),
                                            }));
                                          }}
                                          classNames={{
                                            ...selectClassNames,
                                            base: 'max-w-[200px]',
                                          }}
                                          size="sm"
                                          className="ml-auto"
                                        >
                                          {allPosts.map(post => {
                                            const postName = getPostName(post);
                                            return (
                                              <SelectItem key={postName}>
                                                {postName}
                                              </SelectItem>
                                            );
                                          })}
                                        </Select>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </ScrollShadow>
                          )}
                        </div>
                      </Tab>
                    </Tabs>
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
                    <div className="flex flex-col h-full relative px-6 pt-2 pb-0 overflow-hidden">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-shrink-0">
                          <div>
                            {hasVenue && <h2 className="text-white text-xl font-semibold">{eventData.venue?.name}</h2>}
                          </div>
                          <div>
                            <Button
                              onPress={handleSubmit}
                              size="md"
                              radius="lg"
                              className="bg-accent hover:bg-accent/90 text-white"
                            >
                              Create Event
                            </Button>
                          </div>
                        </div>

                {/* Map */}
                {hasMap ? (
                  <div className="w-full flex flex-col gap-3">
                    <div className="relative w-full overflow-hidden rounded-2xl">
                        <div
                          ref={imgContainerRef}
                          className="relative overflow-auto scrollbar-hide"
                          onWheel={handleWheel}
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
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
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
                      </div>

                      {/* Zoom Controls */}
                      <div className="absolute top-3 right-3 flex flex-row gap-1 z-20">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          onPress={handleZoomIn}
                          className="bg-surface-deepest/90 backdrop-blur"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          onPress={handleZoomOut}
                          className="bg-surface-deepest/90 backdrop-blur"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          onPress={handleResetZoom}
                          className="bg-surface-deepest/90 backdrop-blur"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Bottom Control Bar */}
                    <Card
                      isBlurred
                      className="border-2 border-default-200 bg-transparent w-full px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-surface-light">Layer:</span>
                          <span className="text-sm font-medium text-white">
                            {eventData.venue?.layers?.[currentLayer]?.name || 'Main Floor'}
                          </span>
                        </div>
                        {eventData.venue?.layers && eventData.venue.layers.length > 1 && (
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
                              {currentLayer + 1} / {eventData.venue.layers.length}
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
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
                ) : (
                  <div className="bg-surface-deep rounded-2xl p-8 text-center text-gray-400">
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
              className="pointer-events-none fixed z-50 rounded-md bg-surface-deepest/95 px-2 py-1 text-xs text-white shadow-lg border border-default whitespace-nowrap"
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
        memberName={memberName}
        setMemberName={setMemberName}
        memberCert={memberCert}
        setMemberCert={setMemberCert}
        isTeamLead={isTeamLead}
        setIsTeamLead={setIsTeamLead}
        addMember={addMember}
        currentMembers={currentMembers}
        removeMember={removeMember}
        LICENSES={LICENSES}
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
        LICENSES={LICENSES}
      />
    </main>
  );
}
