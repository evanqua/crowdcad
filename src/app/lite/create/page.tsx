import React, { Suspense } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  DatePicker,
  Input,
  ScrollShadow,
  Select,
  SelectItem,
  Tab,
  Tabs,
  TimeInput,
} from '@heroui/react';
import { getLocalTimeZone, parseDate, Time, today } from '@internationalized/date';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import type { Post, Staff, Supervisor, Equipment } from '@/app/types';
import LoadingScreen from '@/components/ui/loading-screen';
import { DiagonalStreaksFixed } from '@/components/ui/diagonal-streaks-fixed';
import AddTeamModal from '@/components/modals/event/addteammodal';
import AddSupervisorModal from '@/components/modals/event/addsupervisormodal';
import {
  createDefaultLiteEventDraft,
  generateLiteEventId,
  getLiteEvent,
  type LiteEventDraft,
  saveLiteEvent,
} from '@/lib/liteEventStore';

const LICENSES = ['CPR', 'EMT-B', 'EMT-A', 'EMT-P', 'RN', 'MD/DO'];

type TeamMemberDraft = { name: string; cert: string; lead: boolean };

type ScheduleChip = {
  id: string;
  time: string;
};

const makeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getPostName = (post: Post): string =>
  typeof post === 'string' ? post : post.name;

const setPostName = (post: Post, name: string): Post =>
  typeof post === 'string' ? { name, x: null, y: null } : { ...post, name };

const parseTimeValue = (value: string, fallback: Time): Time => {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  ) {
    return new Time(hour, minute);
  }

  return fallback;
};

const formatTimeValue = (value: Time) =>
  `${value.hour.toString().padStart(2, '0')}:${value.minute.toString().padStart(2, '0')}`;

const buildPostingTimes = (from: Time, to: Time, byMinutesRaw: string): string[] => {
  const byMinutes = Number.parseInt(byMinutesRaw, 10);
  if (!Number.isFinite(byMinutes) || byMinutes <= 0) return [];

  const minutesInDay = 24 * 60;
  const startMinutes = from.hour * 60 + from.minute;
  const toMinutes = to.hour * 60 + to.minute;
  const endMinutes = toMinutes <= startMinutes ? toMinutes + minutesInDay : toMinutes;

  const times: string[] = [];
  const maxIterations = Math.ceil((endMinutes - startMinutes) / Math.max(1, byMinutes)) + 2;
  let iteration = 0;

  for (let value = startMinutes; value <= endMinutes; value += byMinutes) {
    iteration += 1;
    if (iteration > maxIterations) break;

    const normalized = value % minutesInDay;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
  }

  return times;
};

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LiteCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEventId = searchParams.get('eventId');

  const [loading, setLoading] = useState(true);
  const [eventDraft, setEventDraft] = useState<LiteEventDraft | null>(null);

  const [selectedLeftTab, setSelectedLeftTab] = useState<'locations' | 'equipment'>('locations');
  const [selectedRightTab, setSelectedRightTab] = useState<
    'teams' | 'supervisors' | 'posts' | 'equipment'
  >('teams');

  const [locationInput, setLocationInput] = useState('');
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null);
  const [locationEditInput, setLocationEditInput] = useState('');

  const [equipmentInput, setEquipmentInput] = useState('');
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [equipmentEditInput, setEquipmentEditInput] = useState('');

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamModalMode, setTeamModalMode] = useState<'create' | 'edit'>('create');
  const [editingTeamIndex, setEditingTeamIndex] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberCert, setMemberCert] = useState('');
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [currentMembers, setCurrentMembers] = useState<TeamMemberDraft[]>([]);
  const [openTeams, setOpenTeams] = useState<Record<number, boolean>>({});

  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [samName, setSamName] = useState('');
  const [samMemberName, setSamMemberName] = useState('');
  const [samCert, setSamCert] = useState('');
  const [openSupervisors, setOpenSupervisors] = useState<Record<number, boolean>>({});

  const [postsEnabled, setPostsEnabled] = useState(true);

  const [scheduleFrom, setScheduleFrom] = useState<Time>(new Time(16, 0));
  const [scheduleTo, setScheduleTo] = useState<Time>(new Time(23, 59));
  const [scheduleBy, setScheduleBy] = useState('75');
  const [scheduleChips, setScheduleChips] = useState<ScheduleChip[]>([]);
  const [editingChipId, setEditingChipId] = useState<string | null>(null);
  const [editingChipValue, setEditingChipValue] = useState('');

  const initializedScheduleRef = useRef<string | null>(null);

  const allPosts = useMemo(() => eventDraft?.venue.posts ?? [], [eventDraft?.venue.posts]);

  const inputClassNames = {
    label: 'text-white font-medium',
    inputWrapper:
      'rounded-2xl px-4 hover:bg-surface-deep shadow-none group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0',
    input:
      'text-white outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0',
  } as const;

  const selectClassNames = {
    label: 'text-white font-medium',
    input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
    inputWrapper:
      'rounded-2xl px-4 pr-6 hover:bg-surface-deep shadow-none group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0',
  } as const;

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const resolvedEventId = requestedEventId?.trim() || generateLiteEventId();

      if (!requestedEventId) {
        router.replace(`/lite/create?eventId=${resolvedEventId}`);
      }

      let existing = await getLiteEvent(resolvedEventId);

      if (!existing) {
        let seededName = '';
        if (typeof window !== 'undefined') {
          const seedRaw = sessionStorage.getItem(`lite_event_${resolvedEventId}`);
          if (seedRaw) {
            try {
              const parsed = JSON.parse(seedRaw) as { name?: string };
              seededName = parsed?.name?.trim() ?? '';
            } catch {
              seededName = '';
            }
          }
        }

        existing = createDefaultLiteEventDraft(resolvedEventId, seededName);
        await saveLiteEvent(existing);
      }

      if (cancelled) return;
      setEventDraft(existing);
      setLoading(false);
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [requestedEventId, router]);

  useEffect(() => {
    if (!eventDraft) return;

    if (initializedScheduleRef.current === eventDraft.id) return;

    const from = parseTimeValue(eventDraft.scheduleConfig.from, new Time(16, 0));
    const to = parseTimeValue(eventDraft.scheduleConfig.to, new Time(23, 59));

    setScheduleFrom(from);
    setScheduleTo(to);
    setScheduleBy(eventDraft.scheduleConfig.by || '75');

    if (eventDraft.postingTimes.length > 0) {
      setScheduleChips(
        eventDraft.postingTimes.map((time) => ({
          id: makeId(),
          time,
        }))
      );
    } else {
      setScheduleChips([]);
    }

    initializedScheduleRef.current = eventDraft.id;
  }, [eventDraft]);

  useEffect(() => {
    if (!eventDraft) return;

    const timeout = window.setTimeout(() => {
      void saveLiteEvent(eventDraft);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [eventDraft]);

  const updateDraft = (updater: (current: LiteEventDraft) => LiteEventDraft) => {
    setEventDraft((current) => (current ? updater(current) : current));
  };

  const addLocation = () => {
    const name = locationInput.trim();
    if (!name) return;

    updateDraft((current) => {
      const duplicate = current.venue.posts.some(
        (post) => getPostName(post).toLowerCase() === name.toLowerCase()
      );
      if (duplicate) return current;

      const nextPost: Post = { name, x: null, y: null };
      return {
        ...current,
        venue: {
          ...current.venue,
          posts: [...current.venue.posts, nextPost],
        },
      };
    });

    setLocationInput('');
  };

  const removeLocation = (index: number) => {
    updateDraft((current) => {
      const target = current.venue.posts[index];
      if (!target) return current;

      const removedName = getPostName(target);
      return {
        ...current,
        venue: {
          ...current.venue,
          posts: current.venue.posts.filter((_, idx) => idx !== index),
        },
        eventPosts: current.eventPosts.filter((post) => getPostName(post) !== removedName),
        eventEquipment: current.eventEquipment.map((item) =>
          item.defaultLocation === removedName
            ? { ...item, defaultLocation: undefined }
            : item
        ),
      };
    });

    if (editingLocationIndex === index) {
      setEditingLocationIndex(null);
      setLocationEditInput('');
    }
  };

  const startLocationEdit = (index: number) => {
    const post = allPosts[index];
    if (!post) return;
    setEditingLocationIndex(index);
    setLocationEditInput(getPostName(post));
  };

  const saveLocationEdit = () => {
    if (editingLocationIndex === null) return;

    const nextName = locationEditInput.trim();
    if (!nextName) return;

    updateDraft((current) => {
      const existingPost = current.venue.posts[editingLocationIndex];
      if (!existingPost) return current;

      const oldName = getPostName(existingPost);
      const duplicate = current.venue.posts.some(
        (post, idx) => idx !== editingLocationIndex && getPostName(post).toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) return current;

      const nextPosts = [...current.venue.posts];
      nextPosts[editingLocationIndex] = setPostName(existingPost, nextName);

      return {
        ...current,
        venue: {
          ...current.venue,
          posts: nextPosts,
        },
        eventPosts: current.eventPosts.map((post) =>
          getPostName(post) === oldName ? setPostName(post, nextName) : post
        ),
        eventEquipment: current.eventEquipment.map((item) =>
          item.defaultLocation === oldName
            ? { ...item, defaultLocation: nextName }
            : item
        ),
      };
    });

    setEditingLocationIndex(null);
    setLocationEditInput('');
  };

  const cancelLocationEdit = () => {
    setEditingLocationIndex(null);
    setLocationEditInput('');
  };

  const addEquipment = () => {
    const name = equipmentInput.trim();
    if (!name) return;

    updateDraft((current) => {
      const duplicate = current.venue.equipment.some(
        (equipment) => equipment.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate) return current;

      const nextEquipment: Equipment = {
        id: makeId(),
        name,
        status: 'Available',
      };

      return {
        ...current,
        venue: {
          ...current.venue,
          equipment: [...current.venue.equipment, nextEquipment],
        },
      };
    });

    setEquipmentInput('');
  };

  const removeEquipment = (index: number) => {
    updateDraft((current) => {
      const item = current.venue.equipment[index];
      if (!item) return current;

      return {
        ...current,
        venue: {
          ...current.venue,
          equipment: current.venue.equipment.filter((_, idx) => idx !== index),
        },
        eventEquipment: current.eventEquipment.filter((eq) => eq.id !== item.id),
      };
    });

    if (editingEquipmentIndex === index) {
      setEditingEquipmentIndex(null);
      setEquipmentEditInput('');
    }
  };

  const startEquipmentEdit = (index: number) => {
    const item = eventDraft?.venue.equipment[index];
    if (!item) return;

    setEditingEquipmentIndex(index);
    setEquipmentEditInput(item.name);
  };

  const saveEquipmentEdit = () => {
    if (editingEquipmentIndex === null) return;

    const nextName = equipmentEditInput.trim();
    if (!nextName) return;

    updateDraft((current) => {
      const existing = current.venue.equipment[editingEquipmentIndex];
      if (!existing) return current;

      const duplicate = current.venue.equipment.some(
        (equipment, idx) =>
          idx !== editingEquipmentIndex && equipment.name.toLowerCase() === nextName.toLowerCase()
      );
      if (duplicate) return current;

      const nextEquipment = [...current.venue.equipment];
      nextEquipment[editingEquipmentIndex] = { ...existing, name: nextName };

      return {
        ...current,
        venue: {
          ...current.venue,
          equipment: nextEquipment,
        },
        eventEquipment: current.eventEquipment.map((equipment) =>
          equipment.id === existing.id ? { ...equipment, name: nextName } : equipment
        ),
      };
    });

    setEditingEquipmentIndex(null);
    setEquipmentEditInput('');
  };

  const cancelEquipmentEdit = () => {
    setEditingEquipmentIndex(null);
    setEquipmentEditInput('');
  };

  const addMember = () => {
    if (!memberName.trim() || !memberCert) return;

    setCurrentMembers((current) => [
      ...current,
      {
        name: memberName.trim(),
        cert: memberCert,
        lead: isTeamLead,
      },
    ]);

    setMemberName('');
    setMemberCert('');
    setIsTeamLead(false);
  };

  const removeMember = (index: number) => {
    setCurrentMembers((current) => current.filter((_, idx) => idx !== index));
  };

  const handleAddTeam = () => {
    if (!teamName.trim()) {
      alert('Please enter a team name.');
      return;
    }

    if (currentMembers.length === 0) {
      alert('A team must have at least one member.');
      return;
    }

    updateDraft((current) => {
      if (teamModalMode === 'edit' && editingTeamIndex !== null) {
        const existing = current.staff[editingTeamIndex];
        if (!existing) return current;

        const duplicate = current.staff.some(
          (staff, idx) =>
            idx !== editingTeamIndex && staff.team.toLowerCase() === teamName.trim().toLowerCase()
        );
        if (duplicate) {
          alert('Team name already used.');
          return current;
        }

        const nextStaff = {
          ...existing,
          team: teamName.trim(),
          members: currentMembers.map(
            (member) => `${member.name} [${member.cert}]${member.lead ? ' (Lead)' : ''}`
          ),
        };

        const nextStaffArray = [...current.staff];
        nextStaffArray[editingTeamIndex] = nextStaff;

        return {
          ...current,
          staff: nextStaffArray,
        };
      } else {
        const duplicate = current.staff.some(
          (staff) => staff.team.toLowerCase() === teamName.trim().toLowerCase()
        );
        if (duplicate) {
          alert('Team name already used.');
          return current;
        }

        const members = currentMembers.map(
          (member) => `${member.name} [${member.cert}]${member.lead ? ' (Lead)' : ''}`
        );

        const nextStaff: Staff = {
          team: teamName.trim(),
          location: 'No Post',
          status: 'On Break',
          members,
        };

        return {
          ...current,
          staff: [...current.staff, nextStaff],
        };
      }
    });

    setTeamName('');
    setMemberName('');
    setMemberCert('');
    setIsTeamLead(false);
    setCurrentMembers([]);
    setIsTeamModalOpen(false);
    setTeamModalMode('create');
    setEditingTeamIndex(null);
  };

  const startTeamEdit = (index: number) => {
    const team = eventDraft?.staff[index];
    if (!team) return;

    const members = team.members.map((member) => {
      const match = member.match(/^(.+?)\s*\[([^\]]+)\]\s*(\(Lead\))?$/);
      if (match) {
        return {
          name: match[1],
          cert: match[2],
          lead: Boolean(match[3]),
        };
      }
      return { name: member, cert: '', lead: false };
    });

    setTeamName(team.team);
    setCurrentMembers(members);
    setTeamModalMode('edit');
    setEditingTeamIndex(index);
    setIsTeamModalOpen(true);
  };

  const removeTeam = (index: number) => {
    updateDraft((current) => ({
      ...current,
      staff: current.staff.filter((_, idx) => idx !== index),
    }));
  };

  const handleAddSupervisor = () => {
    if (!samName.trim() || !samCert) {
      alert('Supervisor call sign and certification are required.');
      return;
    }

    updateDraft((current) => {
      const duplicate = current.supervisor.some(
        (supervisor) => supervisor.team.toLowerCase() === samName.trim().toLowerCase()
      );
      if (duplicate) {
        alert('Supervisor call sign already used.');
        return current;
      }

      const nextSupervisor: Supervisor = {
        team: samName.trim(),
        location: 'Roaming',
        status: 'On Break',
        member: samMemberName.trim()
          ? `${samMemberName.trim()} [${samCert}]`
          : `${samName.trim()} [${samCert}]`,
      };

      return {
        ...current,
        supervisor: [...current.supervisor, nextSupervisor],
      };
    });

    setSamName('');
    setSamMemberName('');
    setSamCert('');
    setIsSupervisorModalOpen(false);
  };

  const removeSupervisor = (index: number) => {
    updateDraft((current) => ({
      ...current,
      supervisor: current.supervisor.filter((_, idx) => idx !== index),
    }));
  };

  const eventDraftId = eventDraft?.id;

  useEffect(() => {
    if (!eventDraftId) return;

    const postingTimes = postsEnabled ? buildPostingTimes(scheduleFrom, scheduleTo, scheduleBy) : [];

    setScheduleChips(
      postingTimes.map((time) => ({
        id: makeId(),
        time,
      }))
    );

    updateDraft((current) => ({
      ...current,
      postingTimes,
      scheduleConfig: {
        from: formatTimeValue(scheduleFrom),
        to: formatTimeValue(scheduleTo),
        by: scheduleBy,
      },
    }));
  }, [eventDraftId, postsEnabled, scheduleFrom, scheduleTo, scheduleBy]);

  const removeScheduleChip = (chipId: string) => {
    setScheduleChips((current) => {
      const filtered = current.filter((chip) => chip.id !== chipId);
      updateDraft((draft) => ({
        ...draft,
        postingTimes: filtered.map((chip) => chip.time),
      }));
      return filtered;
    });
  };

  const saveEditedScheduleChip = (chipId: string, nextTime: string) => {
    const trimmed = nextTime.trim();
    if (!trimmed) {
      setEditingChipId(null);
      setEditingChipValue('');
      return;
    }

    setScheduleChips((current) => {
      const updated = current.map((chip) =>
        chip.id === chipId ? { ...chip, time: trimmed } : chip
      );
      updateDraft((draft) => ({
        ...draft,
        postingTimes: updated.map((chip) => chip.time),
      }));
      return updated;
    });

    setEditingChipId(null);
    setEditingChipValue('');
  };

  const getCalendarDate = () => {
    const currentDate = eventDraft?.date;
    if (!currentDate) return today(getLocalTimeZone());

    try {
      return parseDate(currentDate);
    } catch {
      return today(getLocalTimeZone());
    }
  };

  const handleCreateLiteEvent = async () => {
    if (!eventDraft) return;

    if (!eventDraft.name.trim()) {
      alert('Please enter an event name.');
      return;
    }

    const finalized: LiteEventDraft = {
      ...eventDraft,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };

    await saveLiteEvent(finalized);

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`lite_event_${eventDraft.id}`);
    }

    router.push(`/lite/events/${eventDraft.id}/dispatch`);
  };

  if (loading || !eventDraft) {
    return <LoadingScreen label="Loading Lite setup…" />;
  }

  return (
    <main className="relative bg-surface-deepest text-white h-full overflow-hidden leading-none">
      <DiagonalStreaksFixed />

      <div className="relative z-10 max-w-[1200px] mx-auto h-full overflow-hidden flex flex-col">
        <div className="px-6 pt-4 pb-4 flex-shrink-0 space-y-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white text-left">Lite Event Setup</h1>
            <p className="text-sm text-surface-light mt-1">
              Build your event locally with locations, staffing, posts, and schedule before dispatch.
            </p>
          </div>

          <div className="flex items-end gap-4">
            <div style={{ flex: 4 }}>
              <Input
                label="Event Name"
                labelPlacement="outside"
                placeholder="Enter event name"
                value={eventDraft.name}
                onValueChange={(value) =>
                  updateDraft((current) => ({ ...current, name: value }))
                }
                classNames={inputClassNames}
                size="lg"
              />
            </div>
            <div style={{ flex: 3 }}>
              <DatePicker
                label="Event Date"
                labelPlacement="outside"
                value={getCalendarDate()}
                onChange={(value) => {
                  if (!value) return;
                  updateDraft((current) => ({ ...current, date: value.toString() }));
                }}
                classNames={inputClassNames}
                size="lg"
              />
            </div>
            <div className="flex-shrink-0">
              <Button
                onPress={handleCreateLiteEvent}
                size="lg"
                radius="lg"
                className="bg-accent hover:bg-accent/90 text-white"
              >
                Create Event
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex h-full overflow-hidden">
            <PanelGroup direction="horizontal">
              <Panel defaultSize={40} minSize={30} maxSize={55}>
                <div className="flex flex-col h-full relative overflow-hidden px-6 pt-0 pb-4">
                  <div className="flex-shrink-0 flex items-end gap-3 mb-3">
                    <Tabs
                      selectedKey={selectedLeftTab}
                      onSelectionChange={(key) => setSelectedLeftTab(key as 'locations' | 'equipment')}
                      classNames={{
                        tabList: 'p-1 rounded-2xl flex-shrink-0',
                        tab: 'rounded-2xl px-4 text-white data-[selected=true]:text-white',
                        panel: 'hidden',
                        cursor: 'rounded-2xl',
                      }}
                    >
                      <Tab key="locations" title="Locations" />
                      <Tab key="equipment" title="Equipment" />
                    </Tabs>

                    <div className="flex-1 flex gap-2">
                      <Input
                        placeholder={selectedLeftTab === 'locations' ? 'e.g., Main Entrance' : 'e.g., Gurney 1'}
                        value={selectedLeftTab === 'locations' ? locationInput : equipmentInput}
                        onValueChange={(value) => {
                          if (selectedLeftTab === 'locations') {
                            setLocationInput(value);
                          } else {
                            setEquipmentInput(value);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            if (selectedLeftTab === 'locations') {
                              addLocation();
                            } else {
                              addEquipment();
                            }
                          }
                        }}
                        variant="flat"
                        classNames={inputClassNames}
                      />
                      <Button
                        isIconOnly
                        onPress={selectedLeftTab === 'locations' ? addLocation : addEquipment}
                        className="flex-shrink-0 bg-accent hover:bg-accent/90 text-white"
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <Card
                    isBlurred
                    className="flex-1 overflow-hidden"
                    style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)' }}
                  >
                    {selectedLeftTab === 'locations' ? (
                      <ScrollShadow
                        hideScrollBar
                        className="space-y-2 p-3 pr-2 scrollbar-hide h-full"
                        style={{ minHeight: 0 }}
                      >
                        {allPosts.map((post, index) => (
                          <Card
                            key={`${getPostName(post)}_${index}`}
                            isBlurred
                            className="rounded-2xl"
                            style={{ backgroundColor: '#27272a' }}
                          >
                            <div className="flex items-center justify-between px-3 py-2 gap-2">
                              {editingLocationIndex === index ? (
                                <>
                                  <Input
                                    value={locationEditInput}
                                    onValueChange={setLocationEditInput}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        saveLocationEdit();
                                      }
                                      if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelLocationEdit();
                                      }
                                    }}
                                    size="sm"
                                    autoFocus
                                    classNames={inputClassNames}
                                  />
                                  <div className="flex items-center gap-1">
                                    <Button isIconOnly size="sm" variant="light" onPress={saveLocationEdit}>
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button isIconOnly size="sm" variant="light" onPress={cancelLocationEdit}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm text-white truncate">{getPostName(post)}</span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      onPress={() => startLocationEdit(index)}
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      color="danger"
                                      onPress={() => removeLocation(index)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </Card>
                        ))}
                      </ScrollShadow>
                    ) : (
                      <ScrollShadow
                        hideScrollBar
                        className="space-y-2 p-3 pr-2 scrollbar-hide h-full"
                        style={{ minHeight: 0 }}
                      >
                        {eventDraft.venue.equipment.map((item, index) => (
                          <Card
                            key={item.id}
                            isBlurred
                            className="rounded-2xl"
                            style={{ backgroundColor: '#27272a' }}
                          >
                            <div className="flex items-center justify-between px-3 py-2 gap-2">
                              {editingEquipmentIndex === index ? (
                                <>
                                  <Input
                                    value={equipmentEditInput}
                                    onValueChange={setEquipmentEditInput}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        saveEquipmentEdit();
                                      }
                                      if (event.key === 'Escape') {
                                        event.preventDefault();
                                        cancelEquipmentEdit();
                                      }
                                    }}
                                    size="sm"
                                    autoFocus
                                    classNames={inputClassNames}
                                  />
                                  <div className="flex items-center gap-1">
                                    <Button isIconOnly size="sm" variant="light" onPress={saveEquipmentEdit}>
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button isIconOnly size="sm" variant="light" onPress={cancelEquipmentEdit}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="text-sm text-white truncate">{item.name}</span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      onPress={() => startEquipmentEdit(index)}
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      color="danger"
                                      onPress={() => removeEquipment(index)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </Card>
                        ))}
                      </ScrollShadow>
                    )}
                  </Card>
                </div>
              </Panel>

              <PanelResizeHandle className="w-1 bg-surface-liner transition-colors cursor-col-resize flex items-center justify-center group">
                <div className="w-0.5 h-8 bg-surface-light/30 rounded-full transition-colors" />
              </PanelResizeHandle>

              <Panel defaultSize={60} minSize={45}>
                <div className="flex flex-col h-full relative overflow-hidden px-6 pt-0 pb-4">
                  <Card
                    isBlurred
                    className="flex-1 flex flex-col overflow-hidden"
                    style={{ backgroundColor: 'rgba(39, 39, 42, 0.5)' }}
                  >
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                      <Tabs
                        selectedKey={selectedRightTab}
                        onSelectionChange={(key) =>
                          setSelectedRightTab(key as 'teams' | 'supervisors' | 'posts' | 'equipment')
                        }
                        fullWidth
                        className="w-full flex-shrink-0"
                        classNames={{
                          tabList: 'p-1 w-full flex-shrink-0',
                          tab: 'text-white data-[selected=true]:text-white',
                          cursor: 'rounded-2xl',
                          panel: 'hidden',
                        }}
                      >
                        <Tab key="teams" title="Teams" />
                        <Tab key="supervisors" title="Supervisors" />
                        <Tab key="posts" title="Posts" />
                        <Tab key="equipment" title="Equipment" />
                      </Tabs>

                      <div className="flex-shrink-0 min-h-12 px-3 py-2 flex items-center justify-between border-b border-surface-liner">
                        {selectedRightTab === 'teams' && (
                          <>
                            <h3 className="text-white font-semibold text-lg">Teams</h3>
                            <Button
                              isIconOnly
                              size="sm"
                              onPress={() => {
                                setTeamModalMode('create');
                                setEditingTeamIndex(null);
                                setTeamName('');
                                setCurrentMembers([]);
                                setIsTeamModalOpen(true);
                              }}
                              className="min-w-8 w-8 h-8"
                              style={{ backgroundColor: '#27272a' }}
                            >
                              <Plus className="h-4 w-4 text-white" />
                            </Button>
                          </>
                        )}

                        {selectedRightTab === 'supervisors' && (
                          <>
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
                          </>
                        )}

                        {selectedRightTab === 'posts' && (
                          <>
                            <h3 className="text-white font-semibold text-lg">Posts</h3>
                            <div className="h-8 flex items-center">
                              <Checkbox
                                isSelected={postsEnabled}
                                onValueChange={setPostsEnabled}
                                size="sm"
                              >
                                <span className="text-sm text-white">Enable Posts</span>
                              </Checkbox>
                            </div>
                          </>
                        )}

                        {selectedRightTab === 'equipment' && (
                          <>
                            <h3 className="text-white font-semibold text-lg">Equipment</h3>
                            <div className="w-8 h-8" />
                          </>
                        )}
                      </div>

                      {selectedRightTab === 'teams' && (
                        <div className="px-4 py-3 flex-1 overflow-hidden">
                          <ScrollShadow
                            className="pr-2 scrollbar-hide h-full"
                            hideScrollBar
                            style={{ minHeight: 0 }}
                          >
                            <div className="grid grid-cols-2 gap-2 auto-rows-max content-start items-start">
                              {eventDraft.staff.map((staff, index) => (
                                <Card
                                  key={`${staff.team}_${index}`}
                                  isBlurred
                                  className="rounded-2xl h-fit"
                                  style={{ backgroundColor: '#27272a' }}
                                >
                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                    <button
                                      type="button"
                                      className="text-sm text-white truncate text-left flex-1"
                                      onClick={() =>
                                        setOpenTeams((current) => ({
                                          ...current,
                                          [index]: !current[index],
                                        }))
                                      }
                                    >
                                      {staff.team}
                                    </button>

                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onPress={() => startTeamEdit(index)}
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        onPress={() => removeTeam(index)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>

                                  {openTeams[index] && (
                                    <ul className="px-3 pb-2 list-disc list-inside text-xs text-gray-300">
                                      {staff.members.map((member, memberIndex) => (
                                        <li key={`${staff.team}_${memberIndex}`}>{member}</li>
                                      ))}
                                    </ul>
                                  )}
                                </Card>
                              ))}
                            </div>
                          </ScrollShadow>
                        </div>
                      )}

                      {selectedRightTab === 'supervisors' && (
                        <div className="px-4 py-3 flex-1 overflow-hidden">
                          <ScrollShadow
                            className="pr-2 scrollbar-hide h-full"
                            hideScrollBar
                            style={{ minHeight: 0 }}
                          >
                            <div className="grid grid-cols-2 gap-2 auto-rows-max content-start items-start">
                              {eventDraft.supervisor.map((supervisor, index) => (
                                <Card
                                  key={`${supervisor.team}_${index}`}
                                  isBlurred
                                  className="rounded-2xl h-fit"
                                  style={{ backgroundColor: '#27272a' }}
                                >
                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                    <button
                                      type="button"
                                      className="text-sm text-white truncate text-left flex-1"
                                      onClick={() =>
                                        setOpenSupervisors((current) => ({
                                          ...current,
                                          [index]: !current[index],
                                        }))
                                      }
                                    >
                                      {supervisor.team}
                                    </button>

                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      color="danger"
                                      onPress={() => removeSupervisor(index)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>

                                  {openSupervisors[index] && (
                                    <ul className="px-3 pb-2 list-disc list-inside text-xs text-gray-300">
                                      <li>{supervisor.member}</li>
                                    </ul>
                                  )}
                                </Card>
                              ))}
                            </div>
                          </ScrollShadow>
                        </div>
                      )}

                      {selectedRightTab === 'posts' && (
                        <div className="px-4 py-3 flex-1 overflow-hidden">
                          <ScrollShadow
                            className="space-y-4 pr-2 scrollbar-hide h-full"
                            hideScrollBar
                            style={{ minHeight: 0 }}
                          >
                            <div className={`space-y-3 ${!postsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                              <Select
                                label="Select Posts"
                                labelPlacement="outside"
                                placeholder="Choose posts for this event"
                                selectionMode="multiple"
                                selectedKeys={new Set(eventDraft.eventPosts.map((post) => getPostName(post)))}
                                isDisabled={!postsEnabled}
                                classNames={selectClassNames}
                                size="lg"
                                onSelectionChange={(keys) => {
                                  const values =
                                    keys === 'all'
                                      ? allPosts.map((post) => getPostName(post))
                                      : Array.from(keys).map((key) => String(key));

                                  updateDraft((current) => ({
                                    ...current,
                                    eventPosts: values
                                      .map((value) =>
                                        current.venue.posts.find((post) => getPostName(post) === value)
                                      )
                                      .filter((post): post is Post => Boolean(post)),
                                  }));
                                }}
                              >
                                {allPosts.map((post) => {
                                  const postName = getPostName(post);
                                  return (
                                    <SelectItem key={postName} textValue={postName} aria-label={postName}>
                                      {postName}
                                    </SelectItem>
                                  );
                                })}
                              </Select>

                              {eventDraft.eventPosts.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {eventDraft.eventPosts.map((post, index) => {
                                    const postName = getPostName(post);
                                    return (
                                      <Chip
                                        key={`${postName}_${index}`}
                                        onClose={() => {
                                          updateDraft((current) => ({
                                            ...current,
                                            eventPosts: current.eventPosts.filter((_, idx) => idx !== index),
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
                                      onClose={() => removeScheduleChip(chip.id)}
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
                                          onChange={(event) => setEditingChipValue(event.target.value)}
                                          onBlur={() => saveEditedScheduleChip(chip.id, editingChipValue)}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                              saveEditedScheduleChip(chip.id, editingChipValue);
                                            }
                                            if (event.key === 'Escape') {
                                              setEditingChipId(null);
                                              setEditingChipValue('');
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
                          </ScrollShadow>
                        </div>
                      )}

                      {selectedRightTab === 'equipment' && (
                        <div className="px-4 py-3 flex-1 overflow-hidden">
                          <ScrollShadow
                            className="space-y-2 pr-2 scrollbar-hide h-full"
                            hideScrollBar
                            style={{ minHeight: 0 }}
                          >
                            {eventDraft.venue.equipment.map((equipment) => {
                              const selectedEquipment = eventDraft.eventEquipment.find(
                                (item) => item.id === equipment.id
                              );

                              return (
                                <div key={equipment.id} className="rounded-2xl p-3" style={{ backgroundColor: '#27272a' }}>
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      isSelected={Boolean(selectedEquipment)}
                                      onValueChange={(checked) => {
                                        if (checked) {
                                          updateDraft((current) => ({
                                            ...current,
                                            eventEquipment: [
                                              ...current.eventEquipment,
                                              { ...equipment, defaultLocation: undefined },
                                            ],
                                          }));
                                        } else {
                                          updateDraft((current) => ({
                                            ...current,
                                            eventEquipment: current.eventEquipment.filter(
                                              (item) => item.id !== equipment.id
                                            ),
                                          }));
                                        }
                                      }}
                                    />

                                    <span className="text-white font-medium flex-shrink-0">{equipment.name}</span>

                                    {selectedEquipment && (
                                      <Select
                                        placeholder="Select Default Location"
                                        selectedKeys={
                                          selectedEquipment.defaultLocation
                                            ? [selectedEquipment.defaultLocation]
                                            : []
                                        }
                                        onSelectionChange={(keys) => {
                                          const locationName =
                                            keys === 'all' ? '' : (Array.from(keys)[0] as string | undefined);

                                          updateDraft((current) => ({
                                            ...current,
                                            eventEquipment: current.eventEquipment.map((item) =>
                                              item.id === equipment.id
                                                ? {
                                                    ...item,
                                                    defaultLocation: locationName,
                                                  }
                                                : item
                                            ),
                                          }));
                                        }}
                                        classNames={{
                                          ...selectClassNames,
                                          base: 'max-w-[220px]',
                                        }}
                                        size="sm"
                                        className="ml-auto"
                                      >
                                        {allPosts.map((post) => {
                                          const postName = getPostName(post);
                                          return <SelectItem key={postName}>{postName}</SelectItem>;
                                        })}
                                      </Select>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </ScrollShadow>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </div>
      </div>

      <AddTeamModal
        isOpen={isTeamModalOpen}
        onClose={() => {
          setIsTeamModalOpen(false);
          setTeamModalMode('create');
          setEditingTeamIndex(null);
          setTeamName('');
          setCurrentMembers([]);
        }}
        mode={teamModalMode}
        onSubmit={handleAddTeam}
        titleOverride={teamModalMode === 'edit' ? 'Edit Team' : 'Add New Team'}
        submitLabelOverride={teamModalMode === 'edit' ? 'Save Team' : 'Add Team'}
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
        onSubmit={handleAddSupervisor}
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

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LiteCreateContent />
    </Suspense>
  );
}
