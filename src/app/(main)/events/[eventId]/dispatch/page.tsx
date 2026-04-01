'use client';
import { useEffect, useMemo, useState, useRef, useCallback, use } from 'react';
import PostingScheduleModal from '@/components/modals/event/postingschedulemodal';
import VenueMapModal from '@/components/modals/event/venuemapmodal';
import EndEventModal from '@/components/modals/event/endeventmodal';
import QuickCallModal from "@/components/modals/event/quickcallmodal";
import ClinicWalkupModal from "@/components/dispatch/clinicwalkupmodal";
import AddTeamModal from "@/components/modals/event/addteammodal";
import AddSupervisorModal from "@/components/modals/event/addsupervisormodal";
import React from 'react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { PostAssignment, Event, Staff, Supervisor, Call, EquipmentStatus, CallLogEntry, TeamLogEntry, EquipmentItem, EventEquipment, ClinicOutcome } from '@/app/types';
import { toast, Slide } from 'react-toastify';
import { useRouter } from 'next/navigation';
import isEqual from 'lodash.isequal';
import { useAuth } from '@/hooks/useauth';
import { useLiteMode } from '@/lib/LiteContext';
import { deleteLiteEvent, getLiteEvent, saveLiteEvent } from '@/lib/liteEventStore';
import { Plus, RotateCw, ArrowDownWideNarrow, Rows2, Rows4} from "lucide-react";
import TeamWidget from '@/components/dispatch/teamwidget';
import { CallTrackingTable } from '@/components/dispatch/calltracking';
import ClinicTrackingTable from '@/components/dispatch/clinictracking';
import CallTrackingCard from '@/components/dispatch/calltrackingcard';
import ClinicTrackingCard from '@/components/dispatch/clinictrackingcard';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import DebugModal from '@/components/modals/debugmodal';
import { ShieldAlert } from 'lucide-react';
import { Select, SelectItem, Tabs, Tab, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from "@heroui/react"
import EquipmentCard from '@/components/dispatch/equipmentcard';
import LoadingScreen from '@/components/ui/loading-screen';
import { normalizeLiteDraftToEvent, removeUndefinedDeep, toLiteDraftFromEvent } from '@/lib/liteEventAdapters';

interface DispatchRoutePageProps {
  params: Promise<{ eventId: string }>;
}

// function StatusTimer({ since }: { since: number })  {
//   const [elapsed, setElapsed] = React.useState(0);

//   React.useEffect(() => {
//     setElapsed(Math.floor((Date.now() - since) / 1000));
//     const interval = setInterval(() => {
//       setElapsed(Math.floor((Date.now() - since) / 1000));
//     }, 1000);
//     return () => clearInterval(interval);
//   }, [since]);

//   const minutes = Math.floor(elapsed / 60);
//   const seconds = elapsed % 60;
//   return (
//     <span>
//       {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
//     </span>
//   );
// }

const AUTO_POST_SYNC = false;

export default function DispatchPage({ params }: DispatchRoutePageProps) {
  const [event, setEvent] = useState<Event | undefined>(undefined);
  const [postAssignments, setPostAssignments] = useState<PostAssignment>({});
  // const handleBulkPostAssignment = (newAssignments: PostAssignment) => {
  //   setPostAssignments(newAssignments);
  // };
  const { eventId } = use(params);
  const { isLiteMode: layoutLiteMode } = useLiteMode();
  const isLiteMode = layoutLiteMode;
  const { user: authUser, ready: authReady } = useAuth();
  const user = isLiteMode ? null : authUser;
  const ready = isLiteMode ? true : authReady;
  const router = useRouter();
  const [openCallId, setOpenCallId] = useState<string | null>(null);
  const [openClinicCallId, setOpenClinicCallId] = useState<string | null>(null);
  const [, setTeamToAdd] = useState<{ [callId: string]: string }>({});
  // const [addMenuType, setAddMenuType] = useState<{ [callId: string]: 'main' | 'team' | 'supervisor' | 'equipment' }>({});
  const [showQuickCallForm, setShowQuickCallForm] = useState(false);
  const quickCallRef = useRef<HTMLFormElement>(null);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [quickCall, setQuickCall] = useState({
    location: '',
    source: '',
    age: '',
    gender: '',
    chiefComplaint: '',
    assignedTeam: '',
  });
  const [clinicCall, setClinicCall] = useState({
    age: '',
    gender: '',
    chiefComplaint: '',
  });
  const [teamName, setTeamName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberCert, setMemberCert] = useState('');
  const [isTeamLead, setIsTeamLead] = useState(false);
  const [currentMembers, setCurrentMembers] = useState<{ name: string, cert: string, lead: boolean }[]>([]);
  const [editTeamOriginalName, setEditTeamOriginalName] = useState<string | null>(null);
  const LICENSES = ['CPR', 'EMT-B', 'EMT-A', 'EMT-P', 'RN', 'MD/DO'];
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    callId: string;
  } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedDuplicateCallId, setSelectedDuplicateCallId] = useState<string | null>(null);
  type EditableCallField = keyof Call | 'ageSex';

  const [editingCell, setEditingCell] = useState<{ callId: string; field: EditableCallField } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const [showResolvedClinicCalls, setShowResolvedClinicCalls] = useState(false);
  
  const [showAddSupervisorModal, setShowAddSupervisorModal] = useState(false);
  const [showEditSupervisorModal, setShowEditSupervisorModal] = useState(false);
  const [editSupervisorOriginalName, setEditSupervisorOriginalName] = useState<string | null>(null);
  const [showQuickClinicCallForm, setShowQuickClinicCallForm] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  
  // Configure admin emails here or load from environment / Firestore for your deployment.
  const ADMIN_EMAILS: string[] = [];
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  const isTimeSlotActive = (timeSlot: string, allTimes: string[]) => {
    const now = new Date();
    const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const sortedTimes = [...allTimes].sort();
    const index = sortedTimes.indexOf(timeSlot);
    if (index === -1) return false;
    
    const nextTime = sortedTimes[index + 1];
    return currentHHMM >= timeSlot && (!nextTime || currentHHMM < nextTime);
  };

  const updateEvent = useCallback(async (
    updateInput: Partial<Event> | ((current: Event) => Partial<Event>)
  ) => {
    if (!eventId) return;

    if (isLiteMode) {
      try {
        const currentDraft = await getLiteEvent(eventId);
        if (!currentDraft) {
          throw new Error('Lite event not found');
        }

        const currentEvent = normalizeLiteDraftToEvent(currentDraft);
        const updates =
          typeof updateInput === 'function' ? updateInput(currentEvent) : updateInput;

        const nextEvent = {
          ...currentEvent,
          ...removeUndefinedDeep(updates),
        } as Event;

        const nextDraft = toLiteDraftFromEvent(nextEvent, currentDraft);
        await saveLiteEvent(nextDraft);

        setEvent(nextEvent);
        setPostAssignments(nextEvent.postAssignments || {});
      } catch (error) {
        console.error('Local update failed:', error);
        toast.error('Failed to save local changes. Please try again.');
      }
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "events", eventId);
        const eventDoc = await transaction.get(eventRef);
        if (!eventDoc.exists()) throw new Error("Event does not exist");

        const currentEvent = eventDoc.data() as Event;
        
        let updates: Partial<Event>;
        if (typeof updateInput === 'function') {
          updates = updateInput(currentEvent);
        } else {
          updates = updateInput;
        }

        transaction.update(eventRef, removeUndefinedDeep(updates));
      });
    } catch (error) {
      console.error("Update failed:", error);
      toast.error("Failed to save changes. Please try again.");
    }
  }, [eventId, isLiteMode]);

  const handlePostAssignment = useCallback(async (time: string, post: string, team: string) => {
    await updateEvent((currentEvent) => {
      const assignments = { ...(currentEvent.postAssignments || {}) };
      if (!assignments[time]) assignments[time] = {};

      Object.keys(assignments[time]).forEach(p => {
        if (assignments[time][p] === team) {
          delete assignments[time][p];
        }
      });

      if (team) {
        assignments[time][post] = team;
      } else {
        delete assignments[time][post];
      }

      let updatedStaff = currentEvent.staff;
      const isActive = isTimeSlotActive(time, currentEvent.postingTimes || []);
      
      if (isActive && updatedStaff) {
        updatedStaff = updatedStaff.map(s => {
          if (s.team !== team) return s;
          
          const newHomeBase = post || 'Roaming';
          const shouldMoveLocation = s.status === 'Available';

          return {
            ...s,
            originalPost: newHomeBase,
            location: shouldMoveLocation ? newHomeBase : s.location
          };
        });
      }

      return {
        postAssignments: assignments,
        staff: updatedStaff
      };
    });
  }, [updateEvent]);

  const handleBulkPostAssignment = useCallback(async (newAssignments: PostAssignment) => {
    await updateEvent((currentEvent) => {
      const finalAssignments = { ...(currentEvent.postAssignments || {}), ...newAssignments };
      
      let updatedStaff = currentEvent.staff || [];
      const times = currentEvent.postingTimes || [];

      const activeTimeSlot = times.find(t => isTimeSlotActive(t, times));
      
      if (activeTimeSlot && newAssignments[activeTimeSlot]) {
        const activeAssignments = finalAssignments[activeTimeSlot];
        
        updatedStaff = updatedStaff.map(s => {
          const assignedPost = Object.keys(activeAssignments).find(
            key => activeAssignments[key] === s.team
          );
          
          const newHomeBase = assignedPost || 'Roaming';
          const shouldMoveLocation = s.status === 'Available';
          if (s.originalPost === newHomeBase) return s;

          return {
            ...s,
            originalPost: newHomeBase,
            location: shouldMoveLocation ? newHomeBase : s.location
          };
        });
      }

      return {
        postAssignments: finalAssignments,
        staff: updatedStaff
      };
    });
  }, [updateEvent]);

  const handleClearAllPostAssignments = useCallback(async () => {
    if (!confirm('Are you sure you want to clear all assignments?')) return;
    
    await updateEvent((currentEvent) => {
      const emptyAssignments: PostAssignment = {};
      
      const updatedStaff = (currentEvent.staff || []).map(s => ({
        ...s,
        originalPost: 'Roaming',
        location: s.status === 'Available' ? 'Roaming' : s.location
      }));

      return {
        postAssignments: emptyAssignments,
        staff: updatedStaff
      };
    });
  }, [updateEvent]);

  const handleUpdatePostingTime = useCallback(async (originalTime: string, newTime: string) => {
    if (originalTime === newTime) return;

    await updateEvent((currentEvent) => {
      const times = currentEvent.postingTimes || [];
      if (times.includes(newTime)) {
         throw new Error("Time slot already exists");
      }
      const newTimes = times.map(t => t === originalTime ? newTime : t);

      const assignments = { ...(currentEvent.postAssignments || {}) };
      if (assignments[originalTime]) {
        assignments[newTime] = assignments[originalTime];
        delete assignments[originalTime];
      }

      return {
        postingTimes: newTimes,
        postAssignments: assignments
      };
    });
  }, [updateEvent]);

  // --- Admin Action Handlers ---

  const handlePopulateTestData = useCallback(async () => {
    if (!event) return;
    const now = Date.now();
    const testTeams: Staff[] = [
      { team: 'Alpha', members: ['Test User [EMT]'], status: 'Available', location: 'Roaming', log: [{ timestamp: now, message: 'Test data populated' }], originalPost: 'Roaming' },
      { team: 'Bravo', members: ['Test User [Paramedic]'], status: 'Available', location: 'Roaming', log: [{ timestamp: now, message: 'Test data populated' }], originalPost: 'Roaming' },
      { team: 'Charlie', members: ['Test User [RN]'], status: 'Available', location: 'Roaming', log: [{ timestamp: now, message: 'Test data populated' }], originalPost: 'Roaming' }
    ];
    
    const currentTeamNames = new Set((event.staff || []).map(s => s.team));
    const teamsToAdd = testTeams.filter(t => !currentTeamNames.has(t.team));
    
    if (teamsToAdd.length === 0) {
      toast.info("Test teams (Alpha, Bravo, Charlie) already exist.");
      return;
    }

    await updateEvent({ staff: [...(event.staff || []), ...teamsToAdd] });
    toast.success(`Added ${teamsToAdd.length} test teams.`);
  }, [event, updateEvent]);

  const handleResetAllStatuses = useCallback(async () => {
    if (!event) return;
    const now = Date.now();
    const hhmm = new Date().getHours().toString().padStart(2, '0') + new Date().getMinutes().toString().padStart(2, '0');
    
    const updatedStaff = (event.staff || []).map(s => ({
      ...s,
      status: 'Available',
      location: 'Roaming',
      log: [...(s.log || []), { timestamp: now, message: `${hhmm} - Admin Reset: Status set to Available` }]
    }));

    await updateEvent({ staff: updatedStaff });
    toast.success("All staff statuses reset to Available/Roaming.");
  }, [event, updateEvent]);

  const handleNuclearClear = useCallback(async () => {
    if (!event) return;
    if (!window.confirm("WARNING: This will delete ALL calls and reset ALL logs. Staff will be kept but history wiped. Continue?")) return;

    const now = Date.now();
    const updatedStaff = (event.staff || []).map(s => ({
      ...s,
      log: [{ timestamp: now, message: 'System logs cleared by Admin' }],
      status: 'Available',
      location: 'Roaming'
    }));
    
    const updatedSupervisors = (event.supervisor || []).map(s => ({
        ...s,
        log: [{ timestamp: now, message: 'System logs cleared by Admin' }],
        status: 'Available',
        location: 'Roaming'
    }));

    await updateEvent({
      calls: [],
      staff: updatedStaff,
      supervisor: updatedSupervisors
    });
    toast.error("System Nuke Executed: All calls deleted and logs reset.");
  }, [event, updateEvent]);

  function isDuplicateTeamName(teamName: string, existingStaff: Staff[]): boolean {
    if (!teamName || !existingStaff || existingStaff.length === 0) return false;
    
    const normalizedName = teamName.toLowerCase().trim();
    
    console.log('Checking for duplicate team name:', normalizedName);
    console.log('Existing teams:', existingStaff.map(s => s.team.toLowerCase().trim()));
    
    return existingStaff.some(staff => {
      const existingName = staff.team.toLowerCase().trim();
      const isDuplicate = existingName === normalizedName;
      if (isDuplicate) {
        console.log(`Found duplicate: "${existingName}" matches "${normalizedName}"`);
      }
      return isDuplicate;
    });
  }

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

  const handleAddNewTeam = useCallback(() => {
    setTeamName('');
    setCurrentMembers([]);
    setMemberName('');
    setMemberCert('');
    setIsTeamLead(false);
    setShowAddTeamModal(true);
  }, []);

  const handleAddNewSupervisor = useCallback(() => {
    // Reset only what the 3-field supervisor form needs
    setTeamName('');        // Call Sign
    setMemberName('');      // Supervisor Name (optional)
    setMemberCert('');      // Certification (required)

    // Do NOT touch currentMembers / isTeamLead; those are for teams
    setShowAddSupervisorModal(true);
  }, []);

  // at top of the component (with other hooks)
  const [, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddMenu(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);


  const handleSaveNewSupervisor = useCallback(async () => {
    if (!event) return;

    const callSign = teamName.trim();
    const cert = memberCert.trim();
    // name is optional
    const name = memberName.trim();

    if (!callSign || !cert) {
      alert('Supervisor Call Sign and Certification are required.');
      return;
    }

    // Prevent duplicate call signs
    if (event.supervisor?.some(s => s.team.toLowerCase().trim() === callSign.toLowerCase())) {
      alert(`A supervisor with the call sign "${callSign}" already exists.`);
      return;
    }

    // Build the single-line member string (name may be empty)
    const memberString = `${name || 'Supervisor'} [${cert}]`;

    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    const newSupervisor: Supervisor = {
      team: callSign,
      member: memberString,
      status: 'Available',
      location: 'Roaming',
      log: [{ timestamp: now.getTime(), message: `${hhmm} - supervisor created` }],
      originalPost: 'Roaming',
    };

    try {
      await updateEvent({
        supervisor: [...(event.supervisor || []), newSupervisor],
      });

      // clear fields + close
      setTeamName('');
      setMemberName('');
      setMemberCert('');
      setShowAddSupervisorModal(false);
    } catch (error) {
      console.error('Error saving supervisor:', error);
      alert('Error saving supervisor. Please try again.');
    }
  }, [event, teamName, memberName, memberCert, updateEvent]);

  const handleEditSupervisor = useCallback((supervisor: Supervisor) => {
    setTeamName(supervisor.team);

    // Parse "Name [CERT]" into fields
    const match = supervisor.member?.match(/^(.+?)\s\[(.+?)\]$/);
    const name = match ? match[1].trim() : (supervisor.member || '').trim();
    const cert = match ? match[2].trim() : '';

    setMemberName(name);     // optional
    setMemberCert(cert);     // required

    // keep team fields for teams untouched
    setEditSupervisorOriginalName(supervisor.team);
    setShowEditSupervisorModal(true);
  }, []);

  const handleSaveEditedSupervisor = useCallback(async () => {
    if (!event || !editSupervisorOriginalName) return;

    const newCallSign = teamName.trim();
    const cert = memberCert.trim();
    const name = memberName.trim(); // optional

    if (!newCallSign || !cert) {
      alert('Supervisor Call Sign and Certification are required.');
      return;
    }

    // if call sign changed, prevent duplicates
    if (
      editSupervisorOriginalName !== newCallSign &&
      event.supervisor?.some(s => s.team.toLowerCase().trim() === newCallSign.toLowerCase())
    ) {
      alert(`A supervisor with the call sign "${newCallSign}" already exists.`);
      return;
    }

    const memberString = `${name || 'Supervisor'} [${cert}]`;

    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    const updatedSupervisor = (event.supervisor || []).map(s => {
      if (s.team !== editSupervisorOriginalName) return s;
      return {
        ...s,
        team: newCallSign,
        member: memberString,
        log: [
          ...(s.log || []),
          {
            timestamp: now.getTime(),
            message: `${hhmm} - supervisor edited${
              editSupervisorOriginalName !== newCallSign ? ` (renamed from ${editSupervisorOriginalName})` : ''
            }`,
          },
        ],
      };
    });

    try {
      await updateEvent({ supervisor: updatedSupervisor });

      setTeamName('');
      setMemberName('');
      setMemberCert('');
      setEditSupervisorOriginalName(null);
      setShowEditSupervisorModal(false);
    } catch (error) {
      console.error('Error saving supervisor changes:', error);
      alert('Error saving supervisor changes. Please try again.');
    }
  }, [event, teamName, memberName, memberCert, editSupervisorOriginalName, updateEvent]);


  const handleDeleteSupervisor = useCallback(async (supervisorNameToDelete: string) => {
    if (!event) return;

    const remainingSupervisor = (event.supervisor || []).filter(s => s.team !== supervisorNameToDelete);

    await updateEvent({
      supervisor: remainingSupervisor
    });
  }, [event, updateEvent]);

  const handleSaveNewTeam = useCallback(async () => {
    if (!teamName || currentMembers.length === 0) {
      alert('Please enter a team name and add at least one member.');
      return;
    }

    const trimmedName = teamName.trim();

    // Pass a function to updateEvent to get the LATEST 'event' from server
    await updateEvent((currentEvent) => {
      // Check for duplicates using the FRESH currentEvent
      if (isDuplicateTeamName(trimmedName, currentEvent.staff || [])) {
        throw new Error(`A team with the name "${trimmedName}" already exists.`); 
        // Note: Throwing here cancels the transaction
      }

      const membersStrings = currentMembers.map(m => `${m.name} [${m.cert}]${m.lead ? ' (Lead)' : ''}`);

      const staffEntry: Staff = {
        team: trimmedName,
        members: membersStrings,
        status: 'Available',
        location: '',
        log: [{ timestamp: Date.now(), message: 'Team created' }]
      };

      return { staff: [...(currentEvent.staff || []), staffEntry] };
    });

    // UI resets (only runs if transaction didn't throw)
    setTeamName('');
    setCurrentMembers([]);
    setShowAddTeamModal(false);
  }, [teamName, currentMembers, updateEvent]);

  const handleEditTeam = useCallback((staff: Staff) => {
    setTeamName(staff.team);
    const parsed = (staff.members || []).map((m) => {
      const lead = m.includes('(Lead)');
      const nameCertMatch = m.match(/^(.+?)\s\[(.+?)\]/);
      const name = nameCertMatch ? nameCertMatch[1].trim() : m.trim();
      const cert = nameCertMatch ? nameCertMatch[2].trim() : '';
      return { name, cert, lead };
    });
    setCurrentMembers(parsed);
    setMemberName('');
    setMemberCert('');
    setIsTeamLead(false);
    setEditTeamOriginalName(staff.team);
    setShowEditTeamModal(true);
  }, []);

  const handleSaveEditedTeam = useCallback(async () => {
    if (!teamName || currentMembers.length === 0 || !event || !editTeamOriginalName) {
      alert('Please enter a team name and add at least one member.');
      return;
    }

    const newName = teamName.trim();
    const oldName = editTeamOriginalName;

    console.log('Attempting to save edited team:', oldName, '->', newName);
    console.log('Current event staff:', event.staff);

    if (oldName !== newName && isDuplicateTeamName(newName, event.staff || [])) {
      alert(`A team with the name "${newName}" already exists. Please choose a different name.`);
      return;
    }

    const membersStrings = currentMembers.map(m => `${m.name} [${m.cert}]${m.lead ? ' (Lead)' : ''}`);

    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    const updatedStaff = (event.staff || []).map(s => {
      if (s.team !== oldName) return s;
      return {
        ...s,
        team: newName,
        members: membersStrings,
        log: [
          ...(s.log || []),
          { timestamp: now.getTime(), message: `${hhmm} - team edited${oldName !== newName ? ` (renamed from ${oldName})` : ''}` }
        ]
      };
    });

    const updatedCalls = oldName !== newName ? (event.calls || []).map(c => {
      let assignedTeam = c.assignedTeam || [];
      let detachedTeams = c.detachedTeams || [];

      if (assignedTeam.includes(oldName)) {
        assignedTeam = assignedTeam.map(t => (t === oldName ? newName : t));
      }
      if (detachedTeams.length) {
        detachedTeams = detachedTeams.map(dt => dt.team === oldName ? { ...dt, team: newName } : dt);
      }

      return (assignedTeam !== c.assignedTeam || detachedTeams !== c.detachedTeams)
        ? { ...c, assignedTeam, detachedTeams }
        : c;
    }) : event.calls;

    try {
      await updateEvent({ staff: updatedStaff, calls: updatedCalls });

      setTeamName('');
      setCurrentMembers([]);
      setEditTeamOriginalName(null);
      setShowEditTeamModal(false);
    } catch (error) {
      console.error('Error saving team changes:', error);
      alert('Error saving team changes. Please try again.');
    }
  }, [teamName, currentMembers, event, editTeamOriginalName, updateEvent]);

  const handleDeleteTeam = useCallback(async (teamNameToDelete: string) => {
    if (!event) return;

    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    const remainingStaff = (event.staff || []).filter(s => s.team !== teamNameToDelete);

    const updatedCalls = (event.calls || []).map(c => {
      if (!c.assignedTeam?.includes(teamNameToDelete)) return c;

      const newAssigned = (c.assignedTeam || []).filter(t => t !== teamNameToDelete);
      const newStatus =
        newAssigned.length === 0
          ? 'Pending'
          : c.status;

      const log: CallLogEntry = {
        timestamp: now.getTime(),
        message: `${hhmm} - ${teamNameToDelete} removed (team deleted).`
      };

      return {
        ...c,
        assignedTeam: newAssigned,
        status: newStatus,
        log: [...(c.log || []), log]
      };
    });

    await updateEvent({
      staff: remainingStaff,
      calls: updatedCalls
    });
  }, [event, updateEvent]);

  const [teamStatusMap, setTeamStatusMap] = useState<{ [callId: string]: { [team: string]: string } }>({});

  const getCallRowClass = (call: Call) => {
    if (!Array.isArray(call.assignedTeam)) return 'bg-surface-deep';

    if (!event) return 'bg-surface-deep';

    const statuses = call.assignedTeam
      .map(t => event?.staff.find(s => s.team === t)?.status)
      .filter((status): status is string => status !== undefined);

    if (statuses.some(status => ['En Route', 'On Scene', 'Transporting'].includes(status))) {
      return 'bg-status-red/10';
    }

    return 'bg-surface-deep';
  };


  async function handleAgeSexBlur(callId: string) {
    const call = event?.calls.find(c => c.id === callId);
    if (!call) return;

    const { age, gender } = parseAgeSex(editValue);
    const newAge = age || '';
    const newGender = gender || '';

    const hasChange = (call.age || '') !== newAge || (call.gender || '') !== newGender;
    if (hasChange) {
      const now = new Date();
      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
      const updatedCall = {
        ...call,
        age: newAge,
        gender: newGender,
        log: [...(call.log || []), { timestamp: now.getTime(), message: `${hhmm} - Age/Sex set to ${formatAgeSex(newAge, newGender) || 'N/A'}.` }]
      };
      const updated = event!.calls.map(c => c.id === callId ? updatedCall : c);
      await updateEvent({ calls: updated });
    }
    setEditingCell(null);
  }

  const formatAgeSex = (age?: string | number, gender?: string) => {
    return [
      typeof age === 'number' ? String(age) : age?.trim(),
      gender?.trim()
    ]
      .filter(Boolean)
      .join('/');
  };

  const parseAgeSex = (val: string): { age: string; gender: string } => {
    // Don't remove all spaces - keep the original formatting
    // Only capitalize letters that immediately follow numbers
    let processed = val;
    
    // Replace pattern: digit followed optionally by space(s) followed by lowercase letter
    // Capitalize only the letter that immediately follows the number (with optional space)
    processed = processed.replace(/(\d)\s*([a-z])/g, (match, digit, letter) => {
      return digit + letter.toUpperCase();
    });
    
    // Now parse the result
    const parts = processed.split(/[,\-\/]/).filter(Boolean);

    let age = '', gender = '';
    if (parts.length === 1) {
      if (/\d/.test(parts[0])) {
        age = parts[0];
      } else {
        gender = parts[0];
      }
    } else if (parts.length >= 2) {
      for (const p of parts) {
        if (!age && /\d/.test(p)) {
          age = p;
        } else if (!gender) {
          gender = p;
        }
      }
    }
    return { age, gender };
  };

  const handleSupervisorStatusChange = useCallback((supervisor: Staff, newStatus: string) => {
    const updatedSupervisors = event?.supervisor.map(s =>
      s.team === supervisor.team
        ? {
            ...s,
            status: newStatus,
            log: [
              ...(s.log || []),
              {
                timestamp: Date.now(),
                message: `${new Date().getHours().toString().padStart(2, '0')}${new Date().getMinutes().toString().padStart(2, '0')} - status changed to ${newStatus}`
              }
            ]
          }
        : s
    );
    // updateEvent({ supervisor: updatedSupervisors });
    updateEvent({ 
      supervisor: updatedSupervisors,
      postAssignments
    });
  }, [event, updateEvent, postAssignments]);

  const handleSupervisorLocationChange = useCallback(async (supervisor: Staff, newLocation: string) => {
    const updatedSupervisors = event?.supervisor.map(s =>
      s.team === supervisor.team
        ? {
            ...s,
            location: newLocation,
            status: newLocation === 'Clinic' && s.status === 'Available' ? 'In Clinic' : s.status, // Changed from 'Available'
            log: [
              ...(s.log || []),
              {
                timestamp: Date.now(),
                message: `${new Date().getHours().toString().padStart(2, '0')}${new Date().getMinutes().toString().padStart(2, '0')} - Post changed to ${newLocation}`
              }
            ]
          }
        : s
    );
    // await updateEvent({ supervisor: updatedSupervisors });
    await updateEvent({ 
      supervisor: updatedSupervisors,
      postAssignments
    });
  }, [event, updateEvent, postAssignments]);

  // Helper to convert equipment data to EquipmentItem format
  const getEquipmentItems = (): EquipmentItem[] => {
    if (!event) return [];
    const items: EquipmentItem[] = [];
    
    // If eventEquipment exists and has items, use ONLY that (deleted items won't be in the array)
    // Otherwise fall back to venue equipment
    const equipmentSource = (event.eventEquipment && event.eventEquipment.length > 0) 
      ? event.eventEquipment 
      : (event?.venue?.equipment || []);
    
    equipmentSource.forEach(eq => {
      const eqName = typeof eq === 'string' ? eq : eq.name;
      const eventEq = event.eventEquipment?.find(e => e.name === eqName);
      
      // Get staging location - prefer eventEquipment's defaultLocation, fallback to equipment location from venue
      const stagingLocation = eventEq?.defaultLocation || 
                             (typeof eq !== 'string' && eq.location) || 
                             'Staging';
      
      // Check if equipment is on any active call
      const activeCall = event.calls?.find(c => 
        c.equipment?.includes(eqName) && 
        !['Resolved', 'Delivered', 'Refusal', 'NMM'].includes(c.status)
      );
      
      // Determine delivery team
      const deliveryTeam = activeCall?.equipmentTeams?.[0];
      
      // Determine current location - prefer eventEquipment location if set
      let currentLocation = eventEq?.location;
      
      // If on call and delivered eq, location is the assigned team
      if (activeCall && activeCall.status === 'Delivered Eq') {
        currentLocation = activeCall.assignedTeam[0];
      }
      
      // Check if equipment is in clinic
      const inClinic = currentLocation === 'In Clinic' || eventEq?.status === 'In Clinic';
      
      // Determine status
      let status: string;
      if (activeCall) {
        // Get the call display number for this call
        const callNum = callDisplayNumberMap.get(activeCall.id) || activeCall.order;
        status = `Call ${callNum}`;
      } else if (inClinic) {
        status = 'In Clinic';
      } else {
        status = eventEq?.status || 'Available';
      }
      
      items.push({
        name: eqName,
        stagingLocation: stagingLocation,
        currentLocation: currentLocation || stagingLocation,
        status: status,
        callId: activeCall?.id,
        deliveryTeam: deliveryTeam,
        needsRefresh: inClinic && !activeCall, // Only needs refresh if in clinic but not on active call
        notes: eventEq?.notes,
      });
    });
    
    return items;
  };

  const handleEquipmentStatusChange = useCallback(async (equipmentName: string, newStatus: string) => {
    if (!event) return;
    
    try {
      const existing = (event.eventEquipment || []).find(eq => eq.name === equipmentName);

      let updatedEventEquipment: EventEquipment[] = event.eventEquipment ? [...event.eventEquipment] : [];

      if (existing) {
        updatedEventEquipment = updatedEventEquipment.map(eq =>
          eq.name === equipmentName ? { ...eq, status: newStatus as EquipmentStatus } : eq
        );
      } else {
        // Not currently tracked in event.eventEquipment — add it so changes persist
        // Try to derive a staging/location from venue definition if available
        const venueEq = (event.venue?.equipment || []).find(v => (typeof v === 'string' ? v : v.name) === equipmentName);
        const derivedLocation = typeof venueEq === 'string' ? '' : (venueEq && (venueEq as { location?: string }).location) || '';
        const newItem: EventEquipment = {
          id: `eq_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: equipmentName,
          status: newStatus as EquipmentStatus,
          location: derivedLocation,
          assignedTeam: null,
        } as EventEquipment;
        updatedEventEquipment.push(newItem);
      }

      // Optimistically update local state so the UI reflects the change immediately
      setEvent(prev => prev ? { ...prev, eventEquipment: updatedEventEquipment } : prev);

      await updateEvent({ eventEquipment: updatedEventEquipment });
    } catch (error) {
      console.error('Error updating equipment status:', error);
      toast.error('Failed to update equipment status');
    }
  }, [event, updateEvent, setEvent]);

  const handleEquipmentLocationChange = (equipmentName: string, newLocation: string) => {
    if (!event) return;
    const existing = event.eventEquipment?.find(e => e.name === equipmentName);
    const updatedEquipment = existing 
      ? (event.eventEquipment || []).map(e => e.name === equipmentName ? { ...e, location: newLocation } : e)
      : [...(event.eventEquipment || []), { 
          id: `eq_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: equipmentName,
          status: 'Available' as EquipmentStatus,
          location: newLocation,
          assignedTeam: null,
        }];
    updateEvent({ eventEquipment: updatedEquipment });
  };

  const handleEquipmentMarkReady = (equipmentName: string) => {
    // Mark equipment as ready: reset to staging location
    if (!event) return;
    const eqItem = event.venue?.equipment?.find(e => (typeof e === 'string' ? e : e.name) === equipmentName);
    const stagingLocation = typeof eqItem === 'string' ? '' : eqItem?.location || 'Not Set';
    const updatedEquipment = (event.eventEquipment || []).map(e => 
      e.name === equipmentName ? { ...e, location: stagingLocation } : e
    );
    updateEvent({ eventEquipment: updatedEquipment });
  };

  const handleEquipmentDelete = useCallback(async (equipmentName: string) => {
    if (!event) return;
    
    const confirmDelete = window.confirm(`Delete equipment "${equipmentName}" from this event?`);
    if (!confirmDelete) return;

    try {
      // Remove from eventEquipment array (event-specific equipment)
      const updatedEventEquipment = (event.eventEquipment || []).filter(
        eq => eq.name !== equipmentName
      );

      await updateEvent({
        eventEquipment: updatedEventEquipment
      });

      toast.success(`Deleted equipment: ${equipmentName}`);
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast.error('Failed to delete equipment');
    }
  }, [event, updateEvent]);

  const handleResetEquipmentLocations = useCallback(async () => {
    if (!event) return;
    
    const updatedEventEquipment = (event.eventEquipment || []).map(eq => {
      // Get the default/staging location from venue equipment definition
      const venueEq = (event.venue?.equipment || []).find(v => 
        (typeof v === 'string' ? v : v.name) === eq.name
      );
      const defaultLocation = typeof venueEq === 'string' ? 'Staging' : (venueEq?.location || 'Staging');
      
      return {
        ...eq,
        location: eq.defaultLocation || defaultLocation,
        status: 'Available' as EquipmentStatus
      };
    });

    await updateEvent({ eventEquipment: updatedEventEquipment });
    toast.success('Equipment locations reset to defaults');
  }, [event, updateEvent]);

  const handleAddVenueEquipment = useCallback(async (equipmentName: string) => {
    if (!event) return;

    // Find the venue equipment definition
    const venueEq = (event.venue?.equipment || []).find(v => 
      (typeof v === 'string' ? v : v.name) === equipmentName
    );
    
    if (!venueEq) return;

    const name = typeof venueEq === 'string' ? venueEq : venueEq.name;
    const defaultLocation = typeof venueEq === 'string' ? 'Staging' : (venueEq.location || 'Staging');

    const newEquipment: EventEquipment = {
      id: `eq_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      name: name,
      status: 'Available' as EquipmentStatus,
      location: defaultLocation,
      defaultLocation: defaultLocation,
      assignedTeam: null,
    };

    await updateEvent({
      eventEquipment: [...(event.eventEquipment || []), newEquipment]
    });

    toast.success(`Added equipment: ${name}`);
  }, [event, updateEvent]);

  // Get venue equipment that's not yet on the dispatch page
  const getAvailableVenueEquipment = useCallback(() => {
    if (!event?.venue?.equipment) return [];
    
    const currentEquipmentNames = new Set(
      (event.eventEquipment || []).map(eq => eq.name)
    );
    
    return (event.venue.equipment || [])
      .map(eq => typeof eq === 'string' ? eq : eq.name)
      .filter(name => !currentEquipmentNames.has(name));
  }, [event]);


  const handleTeamStatusChange = (callId: string, team: string, newStatus: string) => {
    console.log("FUNCTION CALLED", { callId, team, newStatus });
    setTeamStatusMap(prev => {
      const updatedStatusMap = { ...prev };
      if (['Delivered', 'Refusal', 'NMM', 'Detached', 'Delivering', 'Delivered Eq'].includes(newStatus)) {
        // Remove team's status from this call in teamStatusMap when detaching
        if (updatedStatusMap[callId]) {
          delete updatedStatusMap[callId][team];
        }
      } else {
        // Normal update for non-detaching statuses
        updatedStatusMap[callId] = {
          ...(updatedStatusMap[callId] || {}),
          [team]: newStatus
        };
      }
      return updatedStatusMap;
    });

    const latestCall = event?.calls.find(c => c.id === callId);
    if (!latestCall) return;

    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    const logMessage = `${hhmm} - ${team} set to ${newStatus}`;
    
    // DECLARE newCallStatus here with proper initialization
    let newCallStatus = latestCall.status; // Initialize with current status
    
    const isEqDetaching = ['Delivered Eq'].includes(newStatus);
    
    const updatedCalls = (event?.calls || []).map(c => {
      console.log('call updated');
      if (c.id !== callId) return c;

      const isDetaching = ['Delivered', 'Refusal', 'Unable to Locate', 'NMM', 'Detached', 'Delivering', 'Rolled from Scene'].includes(newStatus);

      const updatedLog = [...(c.log || []), { timestamp: Date.now(), message: logMessage }];

      let updatedAssignedTeam = c.assignedTeam || [];
      let updatedEquipmentTeams = c.equipmentTeams || [];
      const updatedDetachedTeams = [...(c.detachedTeams || [])];

      // Handle equipment team detachment
      if (isEqDetaching) {
        updatedAssignedTeam = updatedAssignedTeam.filter(t => t !== team);
        updatedEquipmentTeams = updatedEquipmentTeams.filter(t => t !== team);
        
        // Record detachment
        if (!updatedDetachedTeams.some(t => t.team === team)) {
          updatedDetachedTeams.push({ 
            team, 
            reason: newStatus === 'Delivered Eq' ? 'Delivered Eq' : 'Detached' 
          });
        }
      } else if (isDetaching) {
        // Original detachment logic for regular teams
        // remove team from assigned list
        updatedAssignedTeam = updatedAssignedTeam.filter(t => t !== team);
        // Also remove from equipment teams if present
        updatedEquipmentTeams = updatedEquipmentTeams.filter(t => t !== team);

        // record one-time detachment
        if (!updatedDetachedTeams.some(t => t.team === team)) {
          updatedDetachedTeams.push({ team, reason: newStatus });
        }

        // Auto-detach supervisors when any team is detached with resolving status
        if (['Delivered', 'Refusal', 'NMM'].includes(newStatus)) {
          const supervisorsOnCall = event?.supervisor?.filter(s => 
            c.assignedTeam?.includes(s.team)
          ) || [];
          
          supervisorsOnCall.forEach(supervisor => {
            if (!updatedDetachedTeams.some(t => t.team === supervisor.team)) {
              updatedDetachedTeams.push({ team: supervisor.team, reason: 'Auto-detached' });
            }
          });
          
          // Remove supervisors from assigned teams
          updatedAssignedTeam = updatedAssignedTeam.filter(teamName => 
            !event?.supervisor?.some(s => s.team === teamName)
          );
        }

        if (updatedAssignedTeam.length === 0) {
          if (newStatus === 'Delivered') {
            newCallStatus = 'Delivered';
          } else if (newStatus === 'NMM') {
            newCallStatus = 'NMM';
          } else if (newStatus === 'Unable to Locate') {
            newCallStatus = 'Unable to Locate';
          } else if (newStatus === 'Refusal') {
            newCallStatus = 'Refusal';
          } else if (newStatus === 'Ambulance') {
            newCallStatus = 'Resolved';
          } else {
            newCallStatus = 'Resolved';
          }
        } else {
          // compute composite status from remaining assigned teams
          const remainingStatuses = Object.entries(teamStatusMap[callId] || {})
            .filter(([teamName]) => updatedAssignedTeam.includes(teamName))
            .map(([, status]) => status as string);

          if (remainingStatuses.includes('Transporting')) newCallStatus = 'Transporting';
          else if (remainingStatuses.includes('On Scene')) newCallStatus = 'On Scene';
          else if (remainingStatuses.includes('En Route')) newCallStatus = 'En Route';
        }
      } else {
        // standard transitions while still assigned
        if (newStatus === 'On Scene') newCallStatus = 'On Scene';
        else if (newStatus === 'Transporting') newCallStatus = 'Transporting';
      }

      // IMPORTANT: set clinic flag here (no second pass / no self-reference)
      const clinicFlag = (newStatus === 'Delivered' || newCallStatus === 'Delivered') ? true : (c.clinic ?? false);

      // Special handling for Ambulance status - show as "Rolled" but mark as resolved
      const displayStatus = newCallStatus === 'Resolved' && newStatus === 'Ambulance' ? 'Rolled' : newCallStatus;

      console.log(`[Status Change] Call ${callId} - Team: ${team} -> ${newStatus}`);
      console.log("Updated Arrays:", {
        assignedTeam: updatedAssignedTeam,
        equipmentTeams: updatedEquipmentTeams
      });

      return {
        ...c,
        status: displayStatus,
        clinic: clinicFlag,
        log: updatedLog,
        assignedTeam: updatedAssignedTeam,
        equipmentTeams: updatedEquipmentTeams,
        detachedTeams: updatedDetachedTeams
      };
    });

    // Rest of the function continues as before...
    const updatedStaff = event?.staff.map(t => {
      console.log('idk')
      if (t.team !== team) return t;

      let updatedLocation = t.location;
      let updatedStatus = newStatus;

      // Handle equipment detachment statuses
      if (['Delivered Eq', 'Detached'].includes(newStatus)) {
        updatedLocation = t.originalPost || 'Unknown';
        updatedStatus = 'Available';
      } else if (newStatus === 'Delivered') {
        updatedLocation = 'Clinic';
        updatedStatus = 'In Clinic';
      } else if (['En Route', 'On Scene', 'Transporting'].includes(newStatus)) {
        updatedLocation = latestCall.location;
        updatedStatus = newStatus;
      } else if (['En Route Eq', 'Assisting'].includes(newStatus)) {
        // Equipment assistance statuses
        updatedLocation = latestCall.location;
        updatedStatus = newStatus;
      } else if (['Refusal', 'NMM', 'Detached', 'Unable to Locate', 'Rolled from Scene'].includes(newStatus)) { 
        updatedLocation = t.originalPost || 'Unknown';
        updatedStatus = 'Available';
      } else if (newStatus === 'In Clinic') {
        updatedLocation = 'Clinic';
        updatedStatus = 'In Clinic';
      }

      return {
        ...t,
        status: updatedStatus,
        location: updatedLocation,
      };
    });

    // Handle supervisor status updates when call is complete
    let updatedSupervisor = event?.supervisor;
    if (['Delivered', 'Refusal', 'NMM', 'Rolled'].includes(newCallStatus)) {
      const supervisorsOnCall = event?.supervisor?.filter(s => 
        latestCall.assignedTeam?.includes(s.team)
      ) || [];
      
      if (supervisorsOnCall.length > 0) {
        updatedSupervisor = event?.supervisor?.map(s => {
          if (supervisorsOnCall.some(supervisor => supervisor.team === s.team)) {
            const teamLogEntry: TeamLogEntry = {
              timestamp: now.getTime(),
              message: `${hhmm} - auto-detached from completed call, status set to Available at Roaming`
            };
            
            return {
              ...s,
              status: 'Available',
              location: 'Roaming',
              log: [...(s.log || []), teamLogEntry]
            };
          }
          return s;
        });
      }
    }

    // Handle equipment status updates when call / team status changes
    let updatedEquipment = event?.eventEquipment;

    // Determine the call after updates and equipment listed on that call
    const callAfterUpdate = (updatedCalls || event?.calls || []).find(c => c.id === callId);
    const callEquipmentNames = new Set(
      (callAfterUpdate?.equipment || []).map((n: unknown) => (typeof n === 'string' ? n : (n as { name?: string }).name || ''))
    );

    // Equipment currently held by the team that just changed status OR listed on the call
    const teamEquipment = (event?.eventEquipment || []).filter(eq => eq.assignedTeam === team || callEquipmentNames.has(eq.name));

    if (teamEquipment.length > 0) {
      const callAfterUpdate = (updatedCalls || event?.calls || []).find(c => c.id === callId);
      
      if (isEqDetaching) {
        // Delivered Eq: transfer to patient care team
        updatedEquipment = event?.eventEquipment?.map(eq =>
          eq.assignedTeam === team
            ? {
                ...eq,
                assignedTeam: null,
                status: 'Available',
                location: callAfterUpdate?.assignedTeam?.[0] || 'Clinic'
              }
            : eq
        );
      } else if (newStatus === 'Assisting') {
        // Assisting: keep with assisting team
        updatedEquipment = event?.eventEquipment?.map(eq =>
          eq.assignedTeam === team
            ? {
                ...eq,
                location: team
              }
            : eq
        );
      } else {
        // Case A: Call has no remaining assigned teams → resolve equipment to Clinic
        const noTeamsRemain = !callAfterUpdate?.assignedTeam || callAfterUpdate.assignedTeam.length === 0;
        const callResolvedLike = ['Resolved', 'Delivered', 'Refusal', 'NMM', 'Unable to Locate', 'Rolled'].includes(
          callAfterUpdate?.status || newCallStatus
        );

        if (noTeamsRemain && callResolvedLike) {
          // If the call was Delivered to clinic, mark equipment as In Clinic
          // but keep the same team recorded as the assignedTeam (they delivered it).
          const resolvedStatus = callAfterUpdate?.status || newCallStatus;
          if (resolvedStatus === 'Delivered') {
            updatedEquipment = event?.eventEquipment?.map(eq =>
              eq.assignedTeam === team
                ? {
                    ...eq,
                    // keep assignedTeam so history shows who delivered it
                    assignedTeam: team,
                    status: 'In Clinic' as EquipmentStatus,
                    location: 'Clinic'
                  }
                : eq
            );
          } else {
            updatedEquipment = event?.eventEquipment?.map(eq =>
              eq.assignedTeam === team
                ? {
                    ...eq,
                    assignedTeam: null,
                    status: 'Available' as EquipmentStatus,
                    location: 'Clinic'
                  }
                : eq
            );
          }
        } else {
          // Other teams remain on the call or the call is still active.
          // Keep equipment marked as In Use and preserve/transfer assignment appropriately.
          const newAssigned = (callAfterUpdate?.assignedTeam && callAfterUpdate.assignedTeam.length > 0)
            ? (callAfterUpdate.assignedTeam.includes(team) ? team : callAfterUpdate.assignedTeam[0])
            : team;

          updatedEquipment = event?.eventEquipment?.map(eq =>
            eq.assignedTeam === team
              ? {
                  ...eq,
                  assignedTeam: newAssigned,
                  status: 'In Use' as EquipmentStatus,
                  location: callAfterUpdate?.location || eq.location || newAssigned || 'Roaming'
                }
              : eq
          );
        }
      }
    }

    // Update the event with all changes
    updateEvent({
      calls: updatedCalls,
      staff: updatedStaff,
      postAssignments,
      ...(updatedSupervisor && { supervisor: updatedSupervisor }),
      ...(updatedEquipment && { eventEquipment: updatedEquipment })
    });
  };

  const [showResolvedCalls, setShowResolvedCalls] = useState(false);

  const [teamSortMode, setTeamSortMode] = useState<'availability' | 'asc' | 'desc'>('availability');
  const [cardViewMode, setCardViewMode] = useState<'normal' | 'condensed'>('normal');

  const [selectedLeftTab, setSelectedLeftTab] = useState<string>('teams');


  
  useEffect(() => {
    const handleHotkey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        setShowQuickCallForm(true);
        setTimeout(() => {
          (document.querySelector('input[name="callLocation"]') as HTMLInputElement | null)?.focus();
        }, 10);
      }
      if (e.key === 'Escape') {
        setShowQuickCallForm(false);
      }
    };
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, []);

   useEffect(() => {
    if (!eventId) {
      console.error('eventId is undefined or null, skipping event subscription');
      return;
    }

    if (isLiteMode) {
      let cancelled = false;

      const loadLiteEvent = async () => {
        try {
          const draft = await getLiteEvent(eventId);
          if (cancelled) return;

          if (!draft) {
            setEvent(undefined);
            router.push('/lite/create');
            return;
          }

          const activeDraft =
            draft.status === 'draft' ? { ...draft, status: 'active' as const } : draft;

          if (activeDraft !== draft) {
            await saveLiteEvent(activeDraft);
          }

          const normalizedEvent = normalizeLiteDraftToEvent(activeDraft);
          setEvent((prev) => {
            if (!isEqual(prev, normalizedEvent)) {
              return normalizedEvent;
            }
            return prev;
          });
          setPostAssignments(normalizedEvent.postAssignments || {});
        } catch (error) {
          console.error('Error loading local event:', error);
          setEvent(undefined);
          router.push('/lite/create');
        }
      };

      void loadLiteEvent();
      return () => {
        cancelled = true;
      };
    }

    if (!user) {
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'events', eventId), (doc) => {
      if (doc.exists()) {
        const eventData = doc.data() as Event;
        // Debug: log event document contents to diagnose missing postingTimes
        console.log('Firestore snapshot - eventData:', {
          id: doc.id,
          postingTimes: eventData.postingTimes,
          postAssignments: eventData.postAssignments,
          eventDataSample: {
            id: eventData.id,
            name: eventData.name,
            date: eventData.date,
            eventPostsLength: (eventData.eventPosts || []).length,
            staffLength: (eventData.staff || []).length,
          }
        });

        const userEmail = user.email?.toLowerCase();
        const isSharedUser = eventData.sharedWith?.some(email => email.toLowerCase() === userEmail);

        if (eventData.userId && eventData.userId !== user.uid && !isAdmin && !isSharedUser) {
          console.error('Unauthorized access to event');
          sessionStorage.setItem('redirectPath', `/events/${eventId}/dispatch`);
          router.push('/?login=true&error=unauthorized');
          return;
        }
        setEvent(prev => {
          if (!isEqual(prev, eventData)) {
            setPostAssignments(eventData.postAssignments || {});
            return eventData;
          }
          return prev;
        });
      } else {
        setEvent(undefined);
        router.push('/venues/selection');
      }
    }, (error) => {
      console.error('Error fetching event:', error);
      // Handle permission errors
      if (error.code === 'permission-denied') {
        sessionStorage.setItem('redirectPath', `/events/${eventId}/dispatch`);
        router.push('/?login=true&error=unauthorized');
      }
    });

    return () => unsubscribe();
  }, [eventId, user, router, isAdmin, isLiteMode]);
  
  const handleRemoveTeamFromCall = async (callId: string, teamToRemove: string) => {
    if (!event) return;
    
    // Find the call and team objects
    const call = event.calls.find(c => c.id === callId);
    const team = event.staff.find(t => t.team === teamToRemove);
    
    if (!call || !team) return;
  
    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + 
                 now.getMinutes().toString().padStart(2, '0');
  
    // Update call log
    const callLogEntry: CallLogEntry = {
      timestamp: now.getTime(),
      message: `${hhmm} - ${teamToRemove} detached from call.`
    };
  
    // Update team log
    const teamLogEntry: TeamLogEntry = {
      timestamp: now.getTime(),
      message: `${hhmm} - detached from call #${callDisplayNumberMap.get(callId)} (${callId}); back to post at ${team.location}`
    };
  
    // Update call: remove team and add log
    const updatedCall: Call = {
      ...call,
      assignedTeam: (call.assignedTeam || []).filter(t => t !== teamToRemove),
      status: (call.assignedTeam || []).length <= 1 ? 'Pending' : call.status,
      log: [...(call.log || []), callLogEntry]
    };
  
    // Update team: reset status and add log
    const updatedTeam: Staff = {
      ...team,
      status: 'Available',
      log: [...(team.log || []), teamLogEntry]
    };
  
    // Create updated arrays
    const updatedCalls = event.calls.map(c => 
      c.id === callId ? updatedCall : c
    );
    
    const updatedStaff = event.staff.map(t => 
      t.team === teamToRemove ? updatedTeam : t
    );
  
    // Save to Firestore
    await updateEvent({ 
      calls: updatedCalls, 
      staff: updatedStaff,
      postAssignments
    });
  };  

  // const handlePostAssignment = async (time: string, postKey: string, team: string) => {
  //   const updatedAssignments = {
  //     ...postAssignments,
  //     [time]: {
  //       ...(postAssignments[time] || {}),
  //       [postKey]: team,
  //     },
  //   };
  //   setPostAssignments(updatedAssignments);
  //   await updateEvent({ postAssignments: updatedAssignments });
  // };

  // const handleClearAllPostAssignments = async () => {
  //   if (!event) return;

  //   const clearedAssignments: { [time: string]: { [post: string]: string } } = {};
  //   for (const time of event.postingTimes || []) {
  //     clearedAssignments[time] = {};
  //     for (const post of event.eventPosts || []) {
  //       const postKey = getPostKey(post);
  //       clearedAssignments[time][postKey] = '';
  //     }
  //   }

  //   setPostAssignments(clearedAssignments);
  //   await updateEvent({ postAssignments: clearedAssignments });
  // };

  // const handleUpdatePostingTime = async (originalTime: string, newTime: string) => {
  //   if (!event) return;
    
  //   const newPostingTimes = event.postingTimes?.map(time => 
  //     time === originalTime ? newTime : time
  //   ) || [];

  //   // Update post assignments
  //   const newPostAssignments = { ...postAssignments };
  //   if (newPostAssignments[originalTime]) {
  //     newPostAssignments[newTime] = newPostAssignments[originalTime];
  //     delete newPostAssignments[originalTime];
  //   }

  //   // Update Firestore
  //   await updateEvent({
  //     postingTimes: newPostingTimes,
  //     postAssignments: newPostAssignments
  //   });
  // };

  // Right-click menu opener
  // const handleRightClick = (e: React.MouseEvent, callId: string) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //   setContextMenu({
  //     x: e.clientX,
  //     y: e.clientY,
  //     callId,
  //   });
  // };

  // Mark a call as duplicate
  const handleMarkDuplicate = async (callId: string) => {
    setSelectedDuplicateCallId(callId);
    setShowDuplicateModal(true);
    setContextMenu(null);
  };

  const handleResolveDuplicate = async (duplicateCallId: string, originalCallId: string) => {
    const duplicateCall = event?.calls.find(c => c.id === duplicateCallId);
    if (!duplicateCall) return;

    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    const originalCallNumber = callDisplayNumberMap.get(originalCallId);

    // Update call log with duplicate resolution
    const newLogEntry: CallLogEntry = {
      timestamp: now.getTime(),
      message: `${hhmm} - Resolved, duplicate to call #${originalCallNumber}`
    };

    // Update call: set duplicate & status
    const updatedCall: Call = {
      ...duplicateCall,
      duplicate: true,
      duplicateOf: originalCallId,
      status: 'Resolved',
      // Clear assigned teams when marking as duplicate
      assignedTeam: [],
      log: [...(duplicateCall.log || []), newLogEntry]
    };

    // If there were teams assigned to this duplicate call, we should free them up
    if (duplicateCall.assignedTeam && duplicateCall.assignedTeam.length > 0) {
      const updatedStaff = event?.staff.map(staff => {
        if (duplicateCall.assignedTeam?.includes(staff.team)) {
          // Free up the team - set them back to Available status at their original location
          const teamLogEntry: TeamLogEntry = {
            timestamp: now.getTime(),
            message: `${hhmm} - freed from duplicate call #${callDisplayNumberMap.get(duplicateCallId)}, back to post`
          };
          
          return {
            ...staff,
            status: 'Available',
            location: staff.originalPost || staff.location || 'Unknown',
            log: [...(staff.log || []), teamLogEntry]
          };
        }
        return staff;
      });

      // Update both calls and staff
      const updatedCalls = event?.calls.map(c => c.id === duplicateCallId ? updatedCall : c);
      
      await updateEvent({ 
        calls: updatedCalls,
        staff: updatedStaff,
        postAssignments
      });
    } else {
      // Just update the call
      const updatedCalls = event?.calls.map(c => c.id === duplicateCallId ? updatedCall : c);
      await updateEvent({ calls: updatedCalls });
    }

    setShowDuplicateModal(false);
    setSelectedDuplicateCallId(null);
  };

  const handleTogglePriority = async (callId: string, priority: boolean) => {
    const call = event?.calls.find(c => c.id === callId);
    if (!call) return;

    // Get the current time in HHMM format
    const now = new Date();
    const hhmm =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0');

    // Build log message based on checked status
    const logMessage = `${hhmm} - ${
      priority ? 'marked as Priority' : 'unmarked as Priority'
    }`;

    // Add the new log entry
    const updatedCall = {
      ...call,
      priority,
      log: [...(call.log || []), { timestamp: now.getTime(), message: logMessage }]
    };

    // Update the calls array
    const updatedCalls = event?.calls.map(c =>
      c.id === callId ? updatedCall : c
    );

    await updateEvent({ calls: updatedCalls });
  };

  // Toggle Priority (as before)
  const handleTogglePriorityFromMenu = async (callId: string) => {
    const call = event?.calls.find(c => c.id === callId);
    if (!call) return;

    await handleTogglePriority(callId, !call.priority);
    setContextMenu(null);
  };

  // Close menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleScroll = () => setContextMenu(null);

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [contextMenu]);
  
  const addTeamLog = useCallback((staff: Staff, message: string): Staff => {
    const now = new Date();
    const hhmm =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0');
    const newEntry = { timestamp: now.getTime(), message: `${hhmm} - ${message}` };
    return {
      ...staff,
      log: [...(staff.log || []), newEntry],
    };
  }, []);

  const handleStatusChange = useCallback(async (staff: Staff, newStatus: string) => {
    const team = staff.team;

    setTeamTimers(prev => ({ ...prev, [team]: Date.now() }));

    await updateEvent((currentEvent) => {

      const callId = currentEvent.calls.find(c => 
        c.assignedTeam?.includes(team) && 
        !['Resolved', 'Available'].includes(c.status) 
      )?.id;

      const now = new Date();
      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
      const logMessage = `${hhmm} - ${team} set to ${newStatus}`;

      const updatedStaff = (currentEvent.staff || []).map(s => {
        if (s.team !== team) return s;
        
        const teamLogEntry: TeamLogEntry = { timestamp: now.getTime(), message: logMessage };

        return {
            ...s,
            status: newStatus,
            location: newStatus === 'Available' ? (s.originalPost || 'Roaming') : s.location,
            log: [...(s.log || []), teamLogEntry]
        };
      });

      // Update Calls Array (if team was on a call)
      let updatedCalls = currentEvent.calls || [];
      if (callId) {
         updatedCalls = updatedCalls.map(c => {
            if (c.id !== callId) return c;
            
            const assignedTeams = c.assignedTeam || [];
            const teamStatuses = assignedTeams.map(t => {
                if (t === team) return newStatus; // The new status for current team
                const s = updatedStaff.find(st => st.team === t);
                return s ? s.status : 'Available';
            });

            // Calculate new composite status for the call
            let newCallStatus = c.status;
            if (teamStatuses.includes('Transporting')) newCallStatus = 'Transporting';
            else if (teamStatuses.includes('On Scene')) newCallStatus = 'On Scene';
            else if (teamStatuses.includes('En Route')) newCallStatus = 'En Route';

            return {
                ...c,
                status: newCallStatus,
                log: [...(c.log || []), { timestamp: now.getTime(), message: logMessage }]
            };
         });
      }

      return {
        staff: updatedStaff,
        calls: updatedCalls
      };
    });
  }, [updateEvent]);

  const handleLocationChange = useCallback(async (staff: Staff, newLocation: string) => {
    const updatedStaff = event?.staff.map(t =>
      t.team === staff.team
        ? addTeamLog(
            {
              ...t,
              location: newLocation,
              status: newLocation === 'Clinic' && t.status === 'Available' ? 'In Clinic' : t.status,
            },
            `Post changed to ${newLocation}`
          )
        : t
    );
    await updateEvent({ 
      staff: updatedStaff,
      postAssignments // Explicitly preserve postAssignments
    });
  }, [event, updateEvent, addTeamLog, postAssignments]); // Add postAssignments dependency

  const handleAddTeamToCall = async (callId: string, team: string) => {
    if (!team || !event) return;
    const call = event.calls.find(c => c.id === callId);
    if (!call) return;
  
    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + 
                 now.getMinutes().toString().padStart(2, '0');
  
    // Update call log
    const callLogEntry: CallLogEntry = {
      timestamp: now.getTime(),
      message: `${hhmm} - ${team} assigned and en route.`
    };
  
    // Update team log
    const teamLogEntry: TeamLogEntry = {
      timestamp: now.getTime(),
      message: `${hhmm} - responding to call #${callDisplayNumberMap.get(callId)} (${callId})`
    };
  
    const updatedCall: Call = {
      ...call,
      assignedTeam: [...(call.assignedTeam || []), team],
      status: 'Assigned',
      log: [...(call.log || []), callLogEntry]
    };
  
    const updatedStaff = event.staff.map(t => 
      t.team === team
        ? {
            ...t,
            status: 'En Route',
            location: call.location,
            originalPost: t.location || 'Unknown', // Save original post
            log: [...(t.log || []), teamLogEntry]
          }
        : t
    );
  
    const updatedCalls = event.calls.map(c => 
      c.id === callId ? updatedCall : c
    );

    // Update equipment: mark as In Use any equipment already assigned to this team
    // or explicitly listed on the call's equipment list.
    let updatedEquipment = event.eventEquipment || [];
    try {
      const callEquipmentNames = new Set(
        (call.equipment || []).map((n: unknown) => (typeof n === 'string' ? n : (n as { name?: string }).name || ''))
      );
      updatedEquipment = (event.eventEquipment || []).map(eq => {
        const eqName = eq.name;
        const isListedOnCall = callEquipmentNames.has(eqName);
        const isCurrentlyAssignedToTeam = eq.assignedTeam === team;
        if (isListedOnCall || isCurrentlyAssignedToTeam) {
          return {
            ...eq,
            assignedTeam: team,
            status: 'In Use' as EquipmentStatus,
            location: call.location || eq.location || team
          };
        }
        return eq;
      });
    } catch (e) {
      console.error('Error updating equipment on team add:', e);
    }

    await updateEvent({ 
      calls: updatedCalls, 
      staff: updatedStaff,
      postAssignments,
      eventEquipment: updatedEquipment
    });

    setTeamToAdd(prev => ({ ...prev, [callId]: '' }));
  };    

  const handleCallUpdate = async (callId: string, updates: Partial<Call>) => {
    const updatedCalls = event?.calls?.map(call => 
      call.id === callId ? { ...call, ...updates } : call
    ) || [];
    await updateEvent({ calls: updatedCalls });
  };

  const handleScheduledPostAssignment = useCallback(
    async (time: string, assignments: { [post: string]: string }) => {
      if (!event) return;

      // Update each team's location and log
      let updatedStaff = [...event.staff];
      const pendingAssignments = event.pendingAssignments ? { ...event.pendingAssignments } : {};

      Object.entries(assignments).forEach(([post, teamName]) => {
        if (!teamName) return;
        updatedStaff = updatedStaff.map(staff => {
          if (staff.team === teamName) {
            const isBusy = ['En Route', 'On Scene', 'Transporting'].includes(staff.status);
            if (isBusy) {
              // Store the pending assignment for this team
              pendingAssignments[teamName] = { post, time };
              return staff; // Do not update location or log yet
            } else {
              // Update location and log immediately
              return addTeamLog({ ...staff, location: post }, `Available to ${post} at scheduled time ${time}`);
            }
          }
          return staff;
        });
      });

      // Write updates once
      await updateEvent({
        staff: updatedStaff,
        postAssignments: {
          ...postAssignments,
          [time]: assignments,
        },
        pendingAssignments,
      });

      notifyPostAssignmentChange(`Scheduled posting change for ${time}`, assignments);
    },
    [event, postAssignments, updateEvent, addTeamLog]
  );
 
  // Tracks when a team entered its current status, in ms since epoch
  const [teamTimers, setTeamTimers] = useState<{ [team: string]: number }>({});
  // Cache last known status per team so we only update on true status changes
  const lastTeamStatus = useRef<{ [team: string]: string }>({});
  // Cache last known "status since" per team derived from logs to avoid using Date.now() except on true status change
  const lastStatusSince = useRef<{ [team: string]: number }>({});

  // Helper: derive the most recent timestamp when this team entered its current status from its log
  // Helper: derive most recent timestamp when this team entered current status OR location
  function deriveStatusSinceFromLog(team: Staff): number | null {
    if (!team?.log?.length) return null;
    const currentStatus = team.status;
    const currentLocation = team.location;

    for (let i = team.log.length - 1; i >= 0; i--) {
      const entry = team.log[i];
      const msg = entry.message || '';

      // Case 1: Status change matches current status
      if (
        msg.includes('status changed to') &&
        msg.toLowerCase().includes(currentStatus.toLowerCase())
      ) {
        return entry.timestamp || null;
      }

      // Case 2: Post/location change matches current post
      if (
        msg.includes('Post changed to') &&
        msg.toLowerCase().includes(currentLocation.toLowerCase())
      ) {
        return entry.timestamp || null;
      }
    }
    return null;
  }

  const staffSignature = useMemo(() => {
    if (!event?.staff) return '';
    return event.staff
      .map(t => `${t.team}|${t.status}|${t.location}`)
      .join(',');
  }, [event?.staff]);

  function deriveStatusSinceFromLogSupervisor(supervisor: Supervisor): number | null {
    if (!supervisor?.log?.length) return null;
    
    const currentStatus = supervisor.status;
    const currentLocation = supervisor.location;
    
    for (let i = supervisor.log.length - 1; i >= 0; i--) {
      const entry = supervisor.log[i];
      const msg = entry.message;
      
      // Case 1: Status change matches current status
      if (msg.includes('status changed to') && msg.toLowerCase().includes(currentStatus.toLowerCase())) {
        return entry.timestamp;
      }
      
      // Case 2: Post/location change matches current post
      if (msg.includes('Post changed to') && msg.toLowerCase().includes(currentLocation.toLowerCase())) {
        return entry.timestamp;
      }
    }
    
    return null;
  }

  useEffect(() => {
    if (!event?.staff && !event?.supervisor) return;
    
    setTeamTimers(prev => {
      const updated: { [team: string]: number } = { ...prev };
      const currentTeamNames = [
        ...(event.staff?.map(t => t.team) || []),
        ...(event.supervisor?.map(s => s.team) || [])
      ];
      
      // Handle regular teams
      event.staff?.forEach(team => {
        const key = team.team;
        const status = team.status;
        const location = team.location;
        const hadEntry = key in lastTeamStatus.current;
        const lastKey = lastTeamStatus.current[key];
        const combinedKey = `${status}|${location}`;
        
        if (!hadEntry) {
          lastTeamStatus.current[key] = combinedKey;
          const fromLog = deriveStatusSinceFromLog(team);
          const seeded = typeof fromLog === 'number' ? fromLog : 
                      typeof updated[key] === 'number' ? updated[key] : Date.now();
          updated[key] = seeded;
          lastStatusSince.current[key] = seeded;
          return;
        }
        
        if (lastKey !== combinedKey) {
          lastTeamStatus.current[key] = combinedKey;
          const fromLog = deriveStatusSinceFromLog(team);
          const newSince = typeof fromLog === 'number' ? fromLog : Date.now();
          updated[key] = newSince;
          lastStatusSince.current[key] = newSince;
        } else {
          const cached = lastStatusSince.current[key];
          if (typeof cached === 'number') {
            updated[key] = cached;
          }
        }
      });
      
      // Handle supervisors
      event.supervisor?.forEach(supervisor => {
        const key = supervisor.team;
        const status = supervisor.status;
        const location = supervisor.location;
        const hadEntry = key in lastTeamStatus.current;
        const lastKey = lastTeamStatus.current[key];
        const combinedKey = `${status}|${location}`;
        
        if (!hadEntry) {
          lastTeamStatus.current[key] = combinedKey;
          const fromLog = deriveStatusSinceFromLogSupervisor(supervisor);
          const seeded = typeof fromLog === 'number' ? fromLog : 
                      typeof updated[key] === 'number' ? updated[key] : Date.now();
          updated[key] = seeded;
          lastStatusSince.current[key] = seeded;
          return;
        }
        
        if (lastKey !== combinedKey) {
          lastTeamStatus.current[key] = combinedKey;
          const fromLog = deriveStatusSinceFromLogSupervisor(supervisor);
          const newSince = typeof fromLog === 'number' ? fromLog : Date.now();
          updated[key] = newSince;
          lastStatusSince.current[key] = newSince;
        } else {
          const cached = lastStatusSince.current[key];
          if (typeof cached === 'number') {
            updated[key] = cached;
          }
        }
      });
      
      // Clean up removed teams/supervisors
      Object.keys(updated).forEach(teamKey => {
        if (!currentTeamNames.includes(teamKey)) {
          delete updated[teamKey];
          delete lastTeamStatus.current[teamKey];
          delete lastStatusSince.current[teamKey];
        }
      });
      
      return updated;
    });
  }, [event?.staff, event?.supervisor, staffSignature]);

  const [nextPostingTime, setNextPostingTime] = useState<string | null>(null);

  const computeNextPostingTime = useCallback((current: string, times: string[]): string | null => {
    if (!times.length) return null;

    // Validate current time format (must be 4-digit HHmm)
    if (current.length !== 4 || isNaN(parseInt(current))) {
      console.error(`Invalid current time format: ${current}`);
      return null;
    }
    const currentMins = parseInt(current.substring(0,2)) * 60 + parseInt(current.substring(2));

    // Process and validate times
    const validTimes = times
      .map(t => {
        // Handle both HH:mm and HHmm formats
        let hours: string, minutes: string;
        
        if (t.includes(':')) {
          [hours, minutes] = t.split(':');
        } else if (t.length === 3 || t.length === 4) {
          // Pad to 4 digits for HHmm format
          const padded = t.padStart(4, '0');
          hours = padded.substring(0,2);
          minutes = padded.substring(2,4);
        } else {
          console.warn(`Skipping invalid time format: ${t}`);
          return null;
        }

        // Validate numerical values
        const hoursNum = parseInt(hours);
        const minutesNum = parseInt(minutes);
        
        if (isNaN(hoursNum) || isNaN(minutesNum) || 
            hoursNum < 0 || hoursNum > 23 || 
            minutesNum < 0 || minutesNum > 59) {
          console.warn(`Skipping invalid time: ${t}`);
          return null;
        }

        return {
          time: t,
          minutes: hoursNum * 60 + minutesNum
        };
      })
      .filter(t => t !== null)
      .sort((a, b) => a.minutes - b.minutes);

    if (validTimes.length === 0) return null;

    // Find next valid time
    for (const { minutes, time } of validTimes) {
      if (minutes > currentMins) return time;
    }

    // Wrap to first time next day
    return validTimes.length > 0 ? validTimes[0].time : null;
  }, []);
 
  const parseTimeToMinutes = useCallback((timeStr: string): number | null => {
    // Handle HH:mm format
    if (timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) 
        return hours * 60 + minutes;
    }
    
    // Handle HHmm format
    const cleanTime = timeStr.padStart(4, '0');
    const hours = parseInt(cleanTime.substring(0, 2));
    const minutes = parseInt(cleanTime.substring(2, 4));
    
    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) 
      return hours * 60 + minutes;
    
    console.warn(`Invalid time format: ${timeStr}`);
    return null;
  }, []);

  const triggeredToday = useRef(new Set());
  const [lastTriggerDate, setLastTriggerDate] = useState(new Date().toDateString());

  useEffect(() => {
    if (!AUTO_POST_SYNC) return; // new, disables auto post
    console.log('useEffect: schedule interval tick');

    if (!event || !nextPostingTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const today = now.toDateString();
      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

      console.log(`[Schedule Check] Current time: ${hhmm}, Next posting time: ${nextPostingTime}`);

      // Reset triggered set at midnight
      if (today !== lastTriggerDate) {
        triggeredToday.current = new Set();
        setLastTriggerDate(today);
        console.log('[Schedule Check] Reset triggered times for new day');
      }

      const nextTotalMins = parseTimeToMinutes(nextPostingTime);
      const currentTotalMins = parseTimeToMinutes(hhmm);

      console.log(`[Schedule Check] Current minutes: ${currentTotalMins}, Next minutes: ${nextTotalMins}`);

      if (nextTotalMins === null || currentTotalMins === null) return;

      // Check if we should trigger
      if (currentTotalMins >= nextTotalMins && !triggeredToday.current.has(nextPostingTime)) {
        console.log(`[Schedule Check] TRIGGERING scheduled assignment for ${nextPostingTime}`);
        
        // Do the scheduled assignment
        const assignments = postAssignments[nextPostingTime] || {};
        handleScheduledPostAssignment(nextPostingTime, assignments);

        triggeredToday.current.add(nextPostingTime);

        // Advance to next posting time (wraps to first if at end)
        const newNextTime = computeNextPostingTime(hhmm, event.postingTimes || []);
        console.log(`[Schedule Check] Advanced to next posting time: ${newNextTime}`);
        setNextPostingTime(newNextTime);
      } else {
        console.log(`[Schedule Check] Not triggering - either in future (${currentTotalMins < nextTotalMins}) or already triggered (${triggeredToday.current.has(nextPostingTime)})`);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [event, nextPostingTime, postAssignments, lastTriggerDate, handleScheduledPostAssignment, computeNextPostingTime, parseTimeToMinutes]);

  const getCurrentActiveTime = useCallback(() => {
    if (!event?.postingTimes?.length) return null;
    
    const now = new Date();
    const currentHHMM = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
    
    // Use the same logic as computeNextPostingTime to stay consistent
    const nextTime = computeNextPostingTime(currentHHMM, event.postingTimes);
    
    // If we have a next time, find the current active period
    if (nextTime) {
      const currentMins = parseTimeToMinutes(currentHHMM);
      const allValidTimes = event.postingTimes
        .map(t => ({ time: t, minutes: parseTimeToMinutes(t) }))
        .filter(t => t.minutes !== null)
        .sort((a, b) => a.minutes! - b.minutes!);
      
      // Find the most recent time that has passed
      let activeTime = allValidTimes[0]?.time;
      for (const t of allValidTimes) {
        if (currentMins !== null && t.minutes !== null && currentMins >= t.minutes) {
          activeTime = t.time;
        }
      }
      
      // However, if we're past all times for today, highlight the next upcoming time
      const nextTimeMins = parseTimeToMinutes(nextTime);
      const lastValidTime = allValidTimes[allValidTimes.length - 1];
      if (currentMins !== null && nextTimeMins !== null && lastValidTime?.minutes !== null && currentMins > lastValidTime.minutes) {
        // We're past all times, so highlight the next time (which is the first time tomorrow)
        return nextTime;
      } 
      return activeTime;
    }
    
    return null;
  }, [event?.postingTimes, parseTimeToMinutes, computeNextPostingTime]);

  useEffect(() => {
    if (event?.postingTimes?.length) {
      const now = new Date();
      const hhmm = now.getHours().toString().padStart(2, '0') + 
                  now.getMinutes().toString().padStart(2, '0');
      const nextTime = computeNextPostingTime(hhmm, event.postingTimes);
      setNextPostingTime(nextTime);
      
      console.log(`Current time: ${hhmm}`);
      console.log(`All posting times:`, event.postingTimes);
      console.log(`Next posting time computed: ${nextTime}`);
      
      // Also compute and log the current active time
      const activeTime = getCurrentActiveTime();
      console.log(`Current active time for highlighting: ${activeTime}`);
    }
  }, [event?.postingTimes, getCurrentActiveTime, computeNextPostingTime]);

  // Find the currently "active" posting time and then
  // set each team's location to the post they are assigned to for that time.
  const refreshAllPostsFromSchedule = useCallback(async () => {
    if (!event) return;

    const active = getCurrentActiveTime();
    if (!active) {
      toast.info('No active posting time to refresh.');
      return;
    }

    const assignments = postAssignments[active] || {};
    if (!Object.keys(assignments).length) {
      toast.info(`No assignments found for ${active}.`);
      return;
    }

    const busy = new Set(['En Route', 'On Scene', 'Transporting']);
    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    let changed = 0;
    const updatedStaff = (event.staff || []).map(t => {
      // find which post assigns this team
      const postForTeam = Object.entries(assignments).find(([, team]) => team === t.team)?.[0];
      if (!postForTeam) return t;

      // if you want to force even when busy, remove this busy check:
      if (busy.has(t.status)) {
        return t; // skip busy teams
      }

      if (t.location === postForTeam) return t;

      changed++;
      return {
        ...t,
        location: postForTeam,
        log: [
          ...(t.log || []),
          { timestamp: now.getTime(), message: `${hhmm} - Post changed to ${postForTeam} (manual refresh)` }
        ],
      };
    });

    if (changed > 0) {
      await updateEvent({ staff: updatedStaff });
      toast.success(`Refreshed ${changed} team${changed === 1 ? '' : 's'} to scheduled posts.`);
    } else {
      toast.info('No teams updated (either busy or already at scheduled posts).');
    }
  }, [event, postAssignments, getCurrentActiveTime, updateEvent]);

  // Update a single team (for the widget "Refresh Post" action)
  const refreshTeamFromSchedule = useCallback(async (teamName: string) => {
    if (!event) return;

    const active = getCurrentActiveTime();
    if (!active) {
      toast.info('No active posting time to refresh.');
      return;
    }
    const assignments = postAssignments[active] || {};
    const postForTeam = Object.entries(assignments).find(([, team]) => team === teamName)?.[0];

    if (!postForTeam) {
      toast.info(`No scheduled post for ${teamName} at ${active}.`);
      return;
    }

    const team = (event.staff || []).find(s => s.team === teamName);
    if (!team) return;

    // if you want to prevent moving busy teams, keep this:
    if (['En Route', 'On Scene', 'Transporting'].includes(team.status)) {
      toast.info(`${teamName} is busy; not moved.`);
      return;
    }

    if (team.location === postForTeam) {
      toast.info(`${teamName} is already at ${postForTeam}.`);
      return;
    }

    const now = new Date();
    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

    const updatedStaff = (event.staff || []).map(s =>
      s.team === teamName
        ? {
            ...s,
            location: postForTeam,
            log: [
              ...(s.log || []),
              { timestamp: now.getTime(), message: `${hhmm} - Post changed to ${postForTeam} (manual refresh)` }
            ],
          }
        : s
    );

    await updateEvent({ staff: updatedStaff });
    toast.success(`${teamName} → ${postForTeam}`);
  }, [event, postAssignments, getCurrentActiveTime, updateEvent]);

  const sortedAllCalls = useMemo(() => {
    if (!event?.calls) return [];
    return [...event.calls].sort((a, b) => parseInt(a.id) - parseInt(b.id)); // Oldest first
  }, [event?.calls]);
  
  const callDisplayNumberMap = useMemo(() => {
    const map = new Map();
    sortedAllCalls.forEach((call, index) => map.set(call.id, index + 1)); // 1 for first call
    return map;
  }, [sortedAllCalls]);

  // const activeCalls = useMemo(() => 
  //   sortedAllCalls.filter(call => call.status !== 'Resolved'), 
  //   [sortedAllCalls]
  // );

  function handleCellClick<K extends keyof Call>(callId: string, field: K, value?: Call[K]) {
    setEditingCell({ callId, field });
    setEditValue(typeof value === "string" ? value : value !== undefined && value !== null ? String(value) : "");
  }

  // function capitalize(str) {
  //   return str.charAt(0).toUpperCase() + str.slice(1);
  // }

  function camelCaseToTitle(str: string) {
    // Insert a space before all caps and capitalize the first letter
    return str
      .replace(/([A-Z])/g, ' $1') // chiefComplaint -> chief Complaint
      .replace(/^./, s => s.toUpperCase()); // chief Complaint -> Chief Complaint
  }

  async function handleCellBlur<K extends keyof Call>(callId: string, field: K) {
    const call = event?.calls.find(c => c.id === callId);
    if (!call) return;

    const prevValue = call[field];
    const newValue = editValue;

    if (prevValue !== newValue) {
      const now = new Date();
      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
      const action = (prevValue === undefined || prevValue === "" || prevValue === null)
        ? "set"
        : "changed";
        const logMessage = `${hhmm} - ${camelCaseToTitle(field)} ${action} to ${newValue}.`;

      // Add log entry to the call's log
      const updatedCall = {
        ...call,
        [field]: newValue,
        log: [
          ...(call.log || []),
          { timestamp: now.getTime(), message: logMessage }
        ]
      };

      // Update the calls array
      const updatedCalls = event?.calls.map(c => c.id === callId ? updatedCall : c);

      await updateEvent({ calls: updatedCalls });
    } else {
      // If no change, just update the value (optional)
      await handleCallUpdate(callId, { [field]: newValue });
    }

    setEditingCell(null);
  }

  const computeCallStatus = (call: Call): string => {
    if (!Array.isArray(call.assignedTeam)) return call.status || 'Pending';

    if (!event) return call.status || 'Pending';
    
    if (!call.assignedTeam || call.assignedTeam.length === 0) {
      return call.status || 'Pending';
    }
  
    const teamStatuses = call.assignedTeam
      .map(teamName => event.staff.find(t => t.team === teamName)?.status)
      .filter(Boolean) as string[];
  
    if (teamStatuses.includes('Transporting')) return 'Transporting';
    if (teamStatuses.includes('On Scene')) return 'On Scene';
    if (teamStatuses.includes('En Route')) return 'En Route';
    
    return call.status || 'Assigned';
  };  
  
  function notifyPostAssignmentChange(reason: string, details: Record<string, unknown>) {
    console.log("Post Assignment Change Notification Triggered", new Date().toLocaleTimeString(), "Reason:", reason, details);
    // Play sound
    const audio = new Audio('/alert.mp3'); // or use a URL
    audio.play();
  
    // Show toast notification
    toast.info("Reminder: Post Assignments are changing.", {
      position: "top-right",
      autoClose: 10000, // 10 seconds, or set as desired
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      transition: Slide,
    });
  }

  const formatSummaryTimestamp = useCallback((timestamp: number): string => {
    return Number.isFinite(timestamp) ? timestamp.toFixed(2) : '';
  }, []);

  const generateSummaryCSVData = useCallback((): string => {
    if (!event) return '';

    const csvRows: string[] = [];
    csvRows.push('Log Type,Team/Call ID,Timestamp,Message');

    event.staff.forEach((team) => {
      (team.log || []).forEach((entry: TeamLogEntry) => {
        const message = (entry.message || '').replace(/"/g, '""');
        csvRows.push(`Staff,${team.team},${formatSummaryTimestamp(entry.timestamp)},"${message}"`);
      });
    });

    event.calls.forEach((call) => {
      (call.log || []).forEach((entry: CallLogEntry) => {
        const message = (entry.message || '').replace(/"/g, '""');
        csvRows.push(`Call,${call.id},${formatSummaryTimestamp(entry.timestamp)},"${message}"`);
      });
    });

    return csvRows.join('\n');
  }, [event, formatSummaryTimestamp]);

  const handleExportSummaryCsv = useCallback(() => {
    const csvContent = generateSummaryCSVData();
    if (!csvContent) {
      toast.info('No summary logs to export yet.');
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', `${event?.name || eventId || 'LiteEvent'}_Summary.csv`);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [event?.name, eventId, generateSummaryCSVData]);

  const handleClearLiteEvent = useCallback(async () => {
    if (!isLiteMode || !eventId) return;

    const confirmed = window.confirm(
      'This will permanently clear this local event and all logs. This action is irreversible. Are you sure you want to continue?'
    );

    if (!confirmed) return;

    try {
      await deleteLiteEvent(eventId);
      toast.success('Local event cleared.');
      router.push('/lite');
    } catch (error) {
      console.error('Failed to clear local event:', error);
      toast.error('Failed to clear local event. Please try again.');
    }
  }, [isLiteMode, eventId, router]);

  const [showVenueMap, setShowVenueMap] = useState(false);
  const [showPostingSchedule, setShowPostingSchedule] = useState(false);
  const [showEndEvent, setShowEndEvent] = useState(false);

  useEffect(() => {
    const openVenue = () => setShowVenueMap(true);
    const openPosting = () => setShowPostingSchedule(true);
    const openEnd = () => setShowEndEvent(true);
    const openLiteClear = () => {
      void handleClearLiteEvent();
    };
    const openLiteExport = () => {
      handleExportSummaryCsv();
    };

    window.addEventListener('open-posting-schedule', openPosting);
    window.addEventListener('open-lite-clear-event', openLiteClear);
    window.addEventListener('open-lite-export-summary', openLiteExport);

    if (!isLiteMode) {
      window.addEventListener('open-venue-map', openVenue);
      window.addEventListener('open-end-event', openEnd);
    }

    return () => {
      window.removeEventListener('open-posting-schedule', openPosting);
      window.removeEventListener('open-lite-clear-event', openLiteClear);
      window.removeEventListener('open-lite-export-summary', openLiteExport);

      if (!isLiteMode) {
        window.removeEventListener('open-venue-map', openVenue);
        window.removeEventListener('open-end-event', openEnd);
      }
    };
  }, [isLiteMode, handleClearLiteEvent, handleExportSummaryCsv]);

  // Tab cycling for left sidebar tabs
  useEffect(() => {
    const tabs = ['teams', 'supervisors', 'equipment'];
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const activeElement = document.activeElement;
        if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(activeElement.tagName)) {
          return; // Let normal tab behavior happen
        }
        event.preventDefault();
        const currentIndex = tabs.indexOf(selectedLeftTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setSelectedLeftTab(tabs[nextIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedLeftTab]);

  useEffect(() => {
    if (isLiteMode) return;

    if (ready && !user) {
      // Store the current path for redirect after login
      sessionStorage.setItem('redirectPath', `/events/${eventId}/dispatch`);
      router.push('/?login=true&error=auth');
    }
  }, [user, ready, router, eventId, isLiteMode]);

  // Return early if auth is not ready or user is not authenticated
  if (!isLiteMode && !ready) {
    return <LoadingScreen label="Loading…" />;
  }

  if (!isLiteMode && !user) {
    return (
      <div className="w-full bg-surface-deepest min-h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="text-surface-light">Redirecting...</div>
      </div>
    );
  }

  const handleRowClick = (e: React.MouseEvent, id: string) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, Button, a, [contenteditable="true"]')) return;
    setOpenCallId(openCallId === id ? null : id);
  };

  // function getPostKey(post: Post): string {
  //   return typeof post === 'string' ? post : post.name;
  // }

  // Handler reserved for interactive map marker moves; keep defined for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleTeamMarkerMove = async (teamName: string, newX: number, newY: number) => {
    if (!event) return;
    // Find the team's current post object
    const team = event.staff.find(t => t.team === teamName);
    if (!team) return;
    // Find the post object for the team's location
    const postIdx = event.eventPosts.findIndex(p => (typeof p === 'string' ? p : p.name) === team.location);
    if (postIdx === -1) return;

    // Update the post's coordinates
    const posts = [...event.eventPosts];
    if (typeof posts[postIdx] === 'object') {
      posts[postIdx] = { ...posts[postIdx], x: newX, y: newY };
    }

    await updateEvent({
      venue: {
        ...event.venue,
        posts,
      }
    });
  };

  // Handler reserved for interactive equipment marker moves; keep defined for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEquipmentMarkerMove = async (equipmentId: string, newX: number, newY: number) => {
    if (!event) return;
    
    // Find the equipment in eventEquipment array
    const equipment = event.eventEquipment?.find(eq => eq.id === equipmentId);
    if (!equipment) return;

    // Find the post object for equipment's current location
    const postIndex = event.eventPosts?.findIndex(p => 
      (typeof p === 'string' ? p : p.name) === equipment.location
    );
    
    if (postIndex === -1 || !event.eventPosts) {
      // No matching post found, equipment might not have a valid location
      console.warn(`No post found for equipment ${equipment.name} at location ${equipment.location}`);
      return;
    }

    // Update the post's coordinates
    const updatedPosts = [...event.eventPosts];
    if (typeof updatedPosts[postIndex] === 'object') {
      updatedPosts[postIndex] = { 
        ...updatedPosts[postIndex], 
        x: newX, 
        y: newY 
      };
    }

    // Save updated posts to the event
    await updateEvent({
      eventPosts: updatedPosts
    });
  };

  if (!event) return <LoadingScreen label="Loading event…" />;

  const COLW = {
    CALLNO: '5rem',   // Call #
    CC:     '10rem',  // Chief Complaint
    AS:     '4rem',   // A/S
    STATUS: '9rem',   // Status
    LOC:    '10rem',  // Location
  };

  function TableColGroup() {
    return (
      <colgroup>
        <col style={{ width: COLW.CALLNO }} />
        <col style={{ width: COLW.CC }} />
        <col style={{ width: COLW.AS }} />
        <col style={{ width: COLW.STATUS }} />
        <col style={{ width: COLW.LOC }} />
        <col />
      </colgroup>
    );
  }

  const handleDeleteCall = async (callId: string) => {
    if (!event) return;

    // Filter out the call to delete it
    const updatedCalls = event.calls.filter(call => call.id !== callId);

    await updateEvent({ calls: updatedCalls });
    setContextMenu(null);
  };

  return (
    <>
      {/* All your modals first - unchanged */}
      <QuickCallModal
        isOpen={showQuickCallForm}
        onClose={() => setShowQuickCallForm(false)}
        event={event}
        updateEvent={updateEvent}
        quickCall={quickCall}
        setQuickCall={setQuickCall}
        formatAgeSex={formatAgeSex}
        parseAgeSex={parseAgeSex}
        quickCallRef={quickCallRef}
      />
      <ClinicWalkupModal
        isOpen={showQuickClinicCallForm}
        onClose={() => setShowQuickClinicCallForm(false)}
        event={event}
        updateEvent={updateEvent}
        clinicCall={clinicCall}
        setClinicCall={setClinicCall}
        formatAgeSex={formatAgeSex}
        parseAgeSex={parseAgeSex}
      />
      <AddTeamModal
        isOpen={showAddTeamModal}
        onClose={() => setShowAddTeamModal(false)}
        mode="create"
        onSubmit={handleSaveNewTeam}
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
      <AddTeamModal
        isOpen={showEditTeamModal}
        onClose={() => setShowEditTeamModal(false)}
        mode="edit"
        onSubmit={handleSaveEditedTeam}
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
        isOpen={showAddSupervisorModal}
        onClose={() => setShowAddSupervisorModal(false)}
        mode="create"
        onSubmit={handleSaveNewSupervisor}
        teamName={teamName}
        setTeamName={setTeamName}
        memberName={memberName}
        setMemberName={setMemberName}
        memberCert={memberCert}
        setMemberCert={setMemberCert}
        LICENSES={LICENSES}
      />
      <AddSupervisorModal
        isOpen={showEditSupervisorModal}
        onClose={() => setShowEditSupervisorModal(false)}
        mode="edit"
        onSubmit={handleSaveEditedSupervisor}
        teamName={teamName}
        setTeamName={setTeamName}
        memberName={memberName}
        setMemberName={setMemberName}
        memberCert={memberCert}
        setMemberCert={setMemberCert}
        LICENSES={LICENSES}
      />
      <DebugModal 
        isOpen={showDebugModal} 
        onClose={() => setShowDebugModal(false)}
        onPopulate={handlePopulateTestData}
        onReset={handleResetAllStatuses}
        onClear={handleNuclearClear}
        event={event}
      />
      {/* Main Layout */}
      <div className="w-full bg-surface-deepest h-[calc(100vh-72px)]">
        <div className="max-w-[1750px] mx-auto px-3 sm:px-4 h-full">


          {isAdmin && (
            <button 
              onClick={() => setShowDebugModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/50 rounded hover:bg-red-500 hover:text-white transition-all text-sm font-bold"
            >
              <ShieldAlert className="w-4 h-4" />
              Debug View
            </button>
          )}
          
          {/* Desktop Layout - Left Sidebar with Select, Right Side with Calls & Clinic */}
          <div className="hidden lg:block h-full">
            <ResizablePanelGroup direction="horizontal" className="gap-2 h-full">
              
              {/* LEFT SIDEBAR - Select for Teams/Supervisors/Equipment */}
              <ResizablePanel defaultSize={25} minSize={20} maxSize={37}>
                <div className="h-full rounded-xl pb-16">
                  {/* Header with Select and Action Buttons */}
                  <div className="flex justify-between items-center px-4 pt-2 pb-2 border-b border-surface-liner">
                    <Select
                      selectedKeys={[selectedLeftTab]}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        setSelectedLeftTab(selected);
                      }}
                      aria-label="Select section"
                      className="max-w-[140px]"
                      classNames={{
                        trigger: "bg-surface-deep hover:bg-surface-liner h-10 min-h-10",
                        value: "text-surface-lightest",
                        popoverContent: "bg-surface-deep border-surface-liner",
                      }}
                    >
                      <SelectItem key="teams">Teams</SelectItem>
                      <SelectItem key="supervisors">Supervisors</SelectItem>
                      <SelectItem key="equipment">Equipment</SelectItem>
                    </Select>


                    <div className="flex items-center gap-2">
                      <Tooltip 
                        content={
                          selectedLeftTab === 'teams' 
                            ? 'Add Team' 
                            : selectedLeftTab === 'supervisors' 
                            ? 'Add Supervisor' 
                            : 'Add Equipment'
                        } 
                        placement="top"
                      >
                        <div>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button
                                isIconOnly
                                size="md"
                                variant="flat"
                                className="bg-surface-deep hover:bg-surface-liner"
                                aria-label="Add Team or Supervisor"
                              >
                                <Plus className="h-5 w-5" />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu
                              aria-label="Team Actions"
                              onAction={(key) => {
                                if (key === "team") {
                                  handleAddNewTeam();
                                } else if (key === "supervisor") {
                                  handleAddNewSupervisor();
                                }
                              }}
                            >
                              <DropdownItem key="team">Add Team</DropdownItem>
                              <DropdownItem key="supervisor">Add Supervisor</DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </div>
                      </Tooltip>
                      <Tooltip 
                        content={selectedLeftTab === 'teams' ? 'Refresh all team posts from schedule' : 'Update all locations'} 
                        placement="top"
                      >
                        <div>
                          <Button
                            isIconOnly
                            size="md"
                            variant="flat"
                            className="bg-surface-deep hover:bg-surface-liner"
                            onPress={refreshAllPostsFromSchedule}
                            aria-label="Update all posts"
                            isDisabled={selectedLeftTab === 'supervisors' || selectedLeftTab === 'equipment'}
                          >
                            <RotateCw className="h-5 w-5" />
                          </Button>
                        </div>
                      </Tooltip>
                      <Tooltip content="Sort and view options" placement="top">
                        <div>
                          <Dropdown
                            classNames={{
                              content: "min-w-[140px] w-[140px] max-w-[140px]", // Adjust dropdown width here
                            }}
                          >
                            <DropdownTrigger>
                              <Button
                                isIconOnly
                                size="md"
                                variant="flat"
                                className="bg-surface-deep hover:bg-surface-liner"
                                aria-label="Sort teams"
                              >
                                <ArrowDownWideNarrow className="h-5 w-5" />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu
                              aria-label="Sort and view options"
                            >
                              <DropdownItem
                                key="view-toggle"
                                isReadOnly
                                className="cursor-default hover:bg-transparent px-0 py-0"
                                textValue="View toggle"
                              >
                                <Tabs
                                  selectedKey={cardViewMode}
                                  onSelectionChange={(key) => setCardViewMode(key as 'normal' | 'condensed')}
                                  size="sm"
                                  fullWidth
                                  classNames={{
                                    tabList: "gap-0 w-full bg-surface-deep p-0.5 rounded-lg",
                                    tab: "h-7 data-[selected=true]:text-surface-light data-[hover=true]:opacity-100 transition-colors",
                                    cursor: "bg-surface-liner",
                                  }}
                                >
                                  <Tab
                                    key="normal"
                                    title={
                                      <Tooltip content="Standard card view with full details" placement="top">
                                        <div className="flex items-center gap-1 pointer-events-none">
                                          <Rows2 className="h-4 w-4" />
                                        </div>
                                      </Tooltip>
                                    }
                                  />
                                  <Tab
                                    key="condensed"
                                    title={
                                      <Tooltip content="Compact card view for more teams on screen" placement="top">
                                        <div className="flex items-center gap-1 pointer-events-none">
                                          <Rows4 className="h-4 w-4" />
                                        </div>
                                      </Tooltip>
                                    }
                                  />
                                </Tabs>
                              </DropdownItem>
                              <DropdownItem
                                key="divider"
                                isReadOnly
                                className="p-0 m-0 h-px bg-surface-liner cursor-default"
                                textValue="divider"
                              >
                                <div className="h-px" />
                              </DropdownItem>
                              <DropdownItem
                                key="availability"
                                onClick={() => setTeamSortMode('availability')}
                                className={teamSortMode === 'availability' ? 'bg-surface-liner' : ''}
                              >
                                Availability
                              </DropdownItem>
                              <DropdownItem
                                key="asc"
                                onClick={() => setTeamSortMode('asc')}
                                className={teamSortMode === 'asc' ? 'bg-surface-liner' : ''}
                              >
                                Ascending
                              </DropdownItem>
                              <DropdownItem
                                key="desc"
                                onClick={() => setTeamSortMode('desc')}
                                className={teamSortMode === 'desc' ? 'bg-surface-liner' : ''}
                              >
                                Descending
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </div>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Content with ScrollShadow */}
                  <div className="h-full overflow-auto scrollbar-hide">
                    <div className="p-4">
                      
                      {/* TEAMS CONTENT */}
                      {selectedLeftTab === 'teams' && (
                        <div className={cardViewMode === 'condensed' ? 'space-y-1.5' : 'space-y-3'}>
                          {[...(event?.staff || [])]
                            .sort((a, b) => {
                              const statusRank = (status: string) => {
                                if (status === 'Available' || status === 'Available') return 0;
                                if (['In Clinic', 'On Break'].includes(status)) return 1;
                                if (['En Route', 'On Scene', 'Transporting'].includes(status)) return 2;
                                return 3;
                              };
                              if (teamSortMode === 'availability') {
                                const rA = statusRank(a.status), rB = statusRank(b.status);
                                return rA !== rB ? rA - rB : a.team.localeCompare(b.team, undefined, { numeric: true });
                              }
                              if (teamSortMode === 'asc') {
                                return a.team.localeCompare(b.team, undefined, { numeric: true });
                              }
                              if (teamSortMode === 'desc') {
                                return b.team.localeCompare(a.team, undefined, { numeric: true });
                              }
                              return 0;
                            })
                            .map(staff => (
                              <TeamWidget
                                key={staff.team}
                                staff={staff}
                                event={event}
                                callDisplayNumberMap={callDisplayNumberMap}
                                teamTimers={teamTimers}
                                onStatusChange={handleStatusChange}
                                onLocationChange={handleLocationChange}
                                onEditTeam={handleEditTeam}
                                onDeleteTeam={handleDeleteTeam}
                                onRefreshTeamPost={refreshTeamFromSchedule}
                                updateEvent={updateEvent}
                                cardViewMode={cardViewMode}
                              />
                            ))}
                          {(!event?.staff || event.staff.length === 0) && (
                            <div className="text-center text-surface-light/50 py-8">
                              No teams available
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUPERVISORS CONTENT */}
                      {selectedLeftTab === 'supervisors' && (
                        <div className={cardViewMode === 'condensed' ? 'space-y-1.5' : 'space-y-3'}>
                          {event?.supervisor && event.supervisor.length > 0 ? (
                            event.supervisor
                              .sort((a, b) => a.team.localeCompare(b.team, undefined, { numeric: true }))
                              .map(supervisor => {
                                const supervisorAsStaff: Staff = {
                                  team: supervisor.team,
                                  location: supervisor.location,
                                  status: supervisor.status,
                                  members: [supervisor.member],
                                  log: supervisor.log,
                                  originalPost: supervisor.originalPost
                                };
                                
                                return (
                                  <TeamWidget
                                    key={supervisor.team}
                                    staff={supervisorAsStaff}
                                    event={event}
                                    callDisplayNumberMap={callDisplayNumberMap}
                                    teamTimers={teamTimers}
                                    onStatusChange={handleSupervisorStatusChange}
                                    onLocationChange={handleSupervisorLocationChange}
                                    onEditTeam={(staff) => {
                                      const correspondingSupervisor = event.supervisor?.find(s => s.team === staff.team);
                                      if (correspondingSupervisor) {
                                        handleEditSupervisor(correspondingSupervisor);
                                      }
                                    }}
                                    onDeleteTeam={handleDeleteSupervisor}
                                    onRefreshTeamPost={refreshTeamFromSchedule}
                                    updateEvent={updateEvent}
                                    cardViewMode={cardViewMode}
                                  />
                                );
                              })
                          ) : (
                            <div className="text-center text-surface-light/50 py-8">
                              No supervisors assigned
                            </div>
                          )}
                        </div>
                      )}

                      {/* EQUIPMENT CONTENT */}
                      {selectedLeftTab === 'equipment' && (
                        <div className="space-y-2">
                          {(event?.venue?.equipment?.length || event?.eventEquipment?.length) ? (
                            <>
                              {/* Sort equipment: active calls at bottom */}
                              {getEquipmentItems()
                                .sort((a, b) => {
                                  const aOnCall = a.status !== 'Available' ? 1 : 0;
                                  const bOnCall = b.status !== 'Available' ? 1 : 0;
                                  return aOnCall - bOnCall; // Available first, on-call at bottom
                                })
                                .map((equipmentItem) => (
                                  <EquipmentCard
                                    key={equipmentItem.name}
                                    equipment={equipmentItem}
                                    event={event!}
                                    onStatusChange={handleEquipmentStatusChange}
                                    onLocationChange={handleEquipmentLocationChange}
                                    onMarkReady={handleEquipmentMarkReady}
                                    onDelete={handleEquipmentDelete}
                                    updateEvent={updateEvent}
                                  />
                                ))}
                            </>
                          ) : (
                            <div className="text-center text-surface-light/50 py-8">
                              No equipment configured
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* RIGHT SIDE - Calls and Clinic Stacked */}
              <ResizablePanel defaultSize={75} minSize={50}>
                <div className="h-full overflow-auto scrollbar-hide pt-2 pb-2">
                  <div className="">
                    {/* Call Tracking */}
                    <div className="rounded-xl overflow-hidden">
                      <CallTrackingTable
                        event={event}
                        callDisplayNumberMap={callDisplayNumberMap}
                        showResolvedCalls={showResolvedCalls}
                        setShowResolvedCalls={setShowResolvedCalls}
                        setShowQuickCallForm={setShowQuickCallForm}
                        openCallId={openCallId}
                        setOpenCallId={setOpenCallId}
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        teamStatusMap={teamStatusMap}
                        updateEvent={updateEvent}
                        handleCellClick={handleCellClick}
                        handleCellBlur={handleCellBlur}
                        handleAgeSexBlur={handleAgeSexBlur}
                        handleRowClick={handleRowClick}
                        handleMarkDuplicate={handleMarkDuplicate}
                        handleTogglePriorityFromMenu={handleTogglePriorityFromMenu}
                        handleDeleteCall={handleDeleteCall}
                        handleTeamStatusChange={handleTeamStatusChange}
                        handleRemoveTeamFromCall={handleRemoveTeamFromCall}
                        handleAddTeamToCall={handleAddTeamToCall}
                        getCallRowClass={getCallRowClass}
                        computeCallStatus={computeCallStatus}
                        formatAgeSex={formatAgeSex}
                        TableColGroup={TableColGroup}
                      />
                    </div>

                    {/* Clinic Tracking */}
                    <div className="rounded-xl overflow-hidden">
                      <ClinicTrackingTable
                        event={event}
                        callDisplayNumberMap={callDisplayNumberMap}
                        showResolvedClinicCalls={showResolvedClinicCalls}
                        setShowResolvedClinicCalls={setShowResolvedClinicCalls}
                        setShowQuickClinicCallForm={setShowQuickClinicCallForm}
                        openClinicCallId={openClinicCallId}
                        setOpenClinicCallId={setOpenClinicCallId}
                        editingCell={editingCell}
                        setEditingCell={setEditingCell}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        updateEvent={updateEvent}
                        handleCellClick={handleCellClick}
                        handleCellBlur={handleCellBlur}
                        handleAgeSexBlur={handleAgeSexBlur}
                        getCallRowClass={getCallRowClass}
                        formatAgeSex={formatAgeSex}
                      />
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Mobile/Tablet Layout - Bottom Tabs */}
          <div className="lg:hidden">
            {/* Background rectangle to cover bottom radius space */}
            <div className="fixed bottom-0 left-0 right-0 h-5 bg-surface-deep z-40"></div>
            <Tabs 
              aria-label="Dispatch sections" 
              placement="bottom"
              radius="full"
              classNames={{
                base: "w-full",
                tabList: "fixed bottom-0 left-0 right-0 w-full bg-surface-deep border-t border-surface-light/10 z-50",
                cursor: "bg-blue-600",
                tab: "h-10",
                tabContent: "text-lg text-surface-light group-data-[selected=true]:text-surface-lightest"
              }}
            >
              {/* TEAMS TAB */}
              <Tab key="teams" title="Staff">
                <div className="space-y-6 pb-20">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-xl font-bold text-surface-light">Teams</h2>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Add Team or Supervisor" placement="top">
                          <div>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button isIconOnly size="md" variant="flat" aria-label="Add Team or Supervisor">
                                  <Plus className="h-5 w-5" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu
                                aria-label="Team Actions"
                                onAction={(key) => {
                                  if (key === "team") handleAddNewTeam();
                                  else if (key === "supervisor") handleAddNewSupervisor();
                                }}
                              >
                                <DropdownItem key="team">Add Team</DropdownItem>
                                <DropdownItem key="supervisor">Add Supervisor</DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </Tooltip>
                        <Tooltip content="Refresh all team posts from schedule" placement="top">
                          <div>
                            <Button isIconOnly size="md" variant="flat" onPress={refreshAllPostsFromSchedule}>
                              <RotateCw className="h-5 w-5" />
                            </Button>
                          </div>
                        </Tooltip>
                        <Tooltip content="Sort and view options" placement="top">
                          <div>
                            <Dropdown
                              classNames={{
                                content: "min-w-[140px] w-[140px] max-w-[140px]", // Adjust dropdown width here
                              }}
                            >
                              <DropdownTrigger>
                                <Button isIconOnly size="md" variant="flat" aria-label="Sort teams">
                                  <ArrowDownWideNarrow className="h-5 w-5" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu
                                aria-label="Sort and view options"
                              >
                                <DropdownItem
                                  key="view-toggle"
                                  isReadOnly
                                  className="cursor-default hover:bg-transparent px-2 py-1"
                                  textValue="View toggle"
                                >
                                  <Tabs
                                    selectedKey={cardViewMode}
                                    onSelectionChange={(key) => setCardViewMode(key as 'normal' | 'condensed')}
                                    size="sm"
                                    fullWidth
                                    disableAnimation
                                    classNames={{
                                      tabList: "gap-0 w-full bg-surface-deep p-0.5 rounded-lg",
                                      tab: "h-7 px-2 data-[selected=true]:bg-surface-liner data-[selected=true]:text-surface-light data-[hover=true]:opacity-100 transition-colors",
                                      cursor: "bg-surface-liner",
                                    }}
                                  >
                                    <Tab
                                      key="normal"
                                      title={
                                        <Tooltip content="Standard card view with full details" placement="top">
                                          <div className="flex items-center gap-1 pointer-events-none">
                                            <Rows2 className="h-4 w-4" />
                                          </div>
                                        </Tooltip>
                                      }
                                    />
                                    <Tab
                                      key="condensed"
                                      title={
                                        <Tooltip content="Compact card view for more teams on screen" placement="top">
                                          <div className="flex items-center gap-1 pointer-events-none">
                                            <Rows4 className="h-4 w-4" />
                                          </div>
                                        </Tooltip>
                                      }
                                    />
                                  </Tabs>
                                </DropdownItem>
                                <DropdownItem
                                  key="divider"
                                  isReadOnly
                                  className="p-0 m-0 h-px bg-surface-liner cursor-default"
                                  textValue="divider"
                                >
                                  <div className="h-px" />
                                </DropdownItem>
                                <DropdownItem
                                  key="availability"
                                  onClick={() => setTeamSortMode('availability')}
                                  className={teamSortMode === 'availability' ? 'bg-surface-liner' : ''}
                                >
                                  Availability
                                </DropdownItem>
                                <DropdownItem
                                  key="asc"
                                  onClick={() => setTeamSortMode('asc')}
                                  className={teamSortMode === 'asc' ? 'bg-surface-liner' : ''}
                                >
                                  Ascending
                                </DropdownItem>
                                <DropdownItem
                                  key="desc"
                                  onClick={() => setTeamSortMode('desc')}
                                  className={teamSortMode === 'desc' ? 'bg-surface-liner' : ''}
                                >
                                  Descending
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                    <div className={cardViewMode === 'condensed' ? 'space-y-1.5' : 'space-y-3'}>
                      <div className="grid grid-cols-1 gap-3">
                        {[...(event?.staff || [])]
                          .sort((a, b) => {
                            const statusRank = (status: string) => {
                              if (status === 'Available' || status === 'Available') return 0;
                              if (['In Clinic', 'On Break'].includes(status)) return 1;
                              if (['En Route', 'On Scene', 'Transporting'].includes(status)) return 2;
                              return 3;
                            };
                            if (teamSortMode === 'availability') {
                              const rA = statusRank(a.status), rB = statusRank(b.status);
                              return rA !== rB ? rA - rB : a.team.localeCompare(b.team, undefined, { numeric: true });
                            }
                            if (teamSortMode === 'asc') return a.team.localeCompare(b.team, undefined, { numeric: true });
                            if (teamSortMode === 'desc') return b.team.localeCompare(a.team, undefined, { numeric: true });
                            return 0;
                          })
                          .map(staff => (
                            <TeamWidget
                              key={staff.team}
                              staff={staff}
                              event={event}
                              callDisplayNumberMap={callDisplayNumberMap}
                              teamTimers={teamTimers}
                              onStatusChange={handleStatusChange}
                              onLocationChange={handleLocationChange}
                              onEditTeam={handleEditTeam}
                              onDeleteTeam={handleDeleteTeam}
                              onRefreshTeamPost={refreshTeamFromSchedule}
                              updateEvent={updateEvent}
                              cardViewMode={cardViewMode}
                            />
                          ))}
                      </div>
                    </div>
                  </div>

                  {event?.supervisor && event.supervisor.length > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold text-surface-light">Supervisors</h2>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {event.supervisor
                          ?.sort((a, b) => a.team.localeCompare(b.team, undefined, { numeric: true }))
                          .map(supervisor => {
                            const supervisorAsStaff: Staff = {
                              team: supervisor.team,
                              location: supervisor.location,
                              status: supervisor.status,
                              members: [supervisor.member],
                              log: supervisor.log,
                              originalPost: supervisor.originalPost
                            };
                            return (
                              <TeamWidget
                                key={supervisor.team}
                                staff={supervisorAsStaff}
                                event={event}
                                callDisplayNumberMap={callDisplayNumberMap}
                                teamTimers={teamTimers}
                                onStatusChange={handleSupervisorStatusChange}
                                onLocationChange={handleSupervisorLocationChange}
                                onEditTeam={(staff) => {
                                  const correspondingSupervisor = event.supervisor?.find(s => s.team === staff.team);
                                  if (correspondingSupervisor) handleEditSupervisor(correspondingSupervisor);
                                }}
                                onDeleteTeam={handleDeleteSupervisor}
                                onRefreshTeamPost={refreshTeamFromSchedule}
                                updateEvent={updateEvent}
                                cardViewMode={cardViewMode}
                              />
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </Tab>

              {/* EQUIPMENT TAB */}
              <Tab key="equipment" title="Equipment">
                <div className="space-y-6 pb-20">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-xl font-bold text-surface-light">Equipment</h2>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Add Equipment from venue" placement="top">
                          <div>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button 
                                  isIconOnly 
                                  size="md" 
                                  variant="flat" 
                                  aria-label="Add Equipment"
                                >
                                  <Plus className="h-5 w-5" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu
                                aria-label="Add Equipment"
                                onAction={(key) => handleAddVenueEquipment(key as string)}
                              >
                                {getAvailableVenueEquipment().length > 0 ? (
                                  getAvailableVenueEquipment().map(equipName => (
                                    <DropdownItem key={equipName}>{equipName}</DropdownItem>
                                  ))
                                ) : (
                                  <DropdownItem key="none" textValue="No equipment available" isReadOnly>
                                    No equipment left to add
                                  </DropdownItem>
                                )}
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </Tooltip>
                        <Tooltip content="Reset all equipment locations to defaults" placement="top">
                          <div>
                            <Button 
                              isIconOnly 
                              size="md" 
                              variant="flat" 
                              onPress={handleResetEquipmentLocations}
                              aria-label="Reset equipment locations"
                            >
                              <RotateCw className="h-5 w-5" />
                            </Button>
                          </div>
                        </Tooltip>
                        <Tooltip content="Sort equipment" placement="top">
                          <div>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button isIconOnly size="md" variant="flat" aria-label="Sort equipment">
                                  <ArrowDownWideNarrow className="h-5 w-5" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu
                                aria-label="Sort options"
                                selectedKeys={[teamSortMode]}
                                selectionMode="single"
                                onSelectionChange={(keys) => {
                                  const selected = Array.from(keys)[0] as 'availability' | 'asc' | 'desc';
                                  setTeamSortMode(selected);
                                }}
                              >
                                <DropdownItem key="availability">Availability</DropdownItem>
                                <DropdownItem key="asc">Ascending</DropdownItem>
                                <DropdownItem key="desc">Descending</DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(event?.venue?.equipment?.length || event?.eventEquipment?.length) ? (
                        <div className="grid grid-cols-1 gap-3">
                          {getEquipmentItems()
                            .sort((a, b) => {
                              const aOnCall = a.status !== 'Available' ? 1 : 0;
                              const bOnCall = b.status !== 'Available' ? 1 : 0;
                              return aOnCall - bOnCall;
                            })
                            .map((equipmentItem) => (
                              <EquipmentCard
                                key={equipmentItem.name}
                                equipment={equipmentItem}
                                event={event!}
                                onStatusChange={handleEquipmentStatusChange}
                                onLocationChange={handleEquipmentLocationChange}
                                onMarkReady={handleEquipmentMarkReady}
                                onDelete={handleEquipmentDelete}
                                updateEvent={updateEvent}
                              />
                            ))}
                        </div>
                      ) : (
                        <div className="text-center text-surface-light/50 py-8">
                          No equipment configured
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Tab>

              <Tab key="calls" title="Calls">
                <div className="space-y-6 pb-20">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-xl font-bold text-surface-light">Calls</h2>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Add new call" placement="top">
                          <div>
                            <Button 
                              isIconOnly 
                              size="md" 
                              variant="flat" 
                              aria-label="Add Call"
                              onPress={() => setShowQuickCallForm(true)}
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        // Active calls first
                        ...event.calls
                          .filter((call: Call) => !['Delivered', 'Refusal', 'NMM', 'Rolled', 'Resolved', 'Unable to Locate'].includes(call.status))
                          .sort((a: Call, b: Call) => parseInt(a.id) - parseInt(b.id)),
                        // Show resolved calls when showResolvedCalls is true
                        ...(showResolvedCalls
                          ? event.calls
                              .filter((c: Call) => ['Delivered', 'Refusal', 'NMM', 'Rolled', 'Resolved', 'Unable to Locate'].includes(c.status))
                              .sort((a: Call, b: Call) => parseInt(a.id) - parseInt(b.id))
                          : [])
                      ].map((call: Call) => (
                        <CallTrackingCard
                          key={call.id}
                          call={call}
                          callDisplayNumber={callDisplayNumberMap.get(call.id) || 0}
                          event={event}
                          onLocationChange={async (callId, newLocation) => {
                            const callToUpdate = event.calls.find(c => c.id === callId);
                            if (!callToUpdate) return;
                            
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                            const updatedCall = {
                              ...callToUpdate,
                              location: newLocation,
                              log: [...(callToUpdate.log || []), { timestamp: now.getTime(), message: `${hhmm} - Location changed to ${newLocation}.` }]
                            };
                            const updatedCalls = event.calls.map(c => c.id === callId ? updatedCall : c);
                            await updateEvent({ calls: updatedCalls });
                          }}
                          onAgeSexChange={async (callId, ageSexValue) => {
                            const callToUpdate = event.calls.find(c => c.id === callId);
                            if (!callToUpdate) return;
                            
                            const { age, gender } = parseAgeSex(ageSexValue);
                            const newAge = age || '';
                            const newGender = gender || '';
                            
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                            const updatedCall = {
                              ...callToUpdate,
                              age: newAge,
                              gender: newGender,
                              log: [...(callToUpdate.log || []), { timestamp: now.getTime(), message: `${hhmm} - Age/Sex set to ${formatAgeSex(newAge, newGender) || 'N/A'}.` }]
                            };
                            const updatedCalls = event.calls.map(c => c.id === callId ? updatedCall : c);
                            await updateEvent({ calls: updatedCalls });
                          }}
                          onChiefComplaintChange={async (callId, newChiefComplaint) => {
                            const callToUpdate = event.calls.find(c => c.id === callId);
                            if (!callToUpdate) return;
                            
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                            const updatedCall = {
                              ...callToUpdate,
                              chiefComplaint: newChiefComplaint,
                              log: [...(callToUpdate.log || []), { timestamp: now.getTime(), message: `${hhmm} - Chief Complaint changed to ${newChiefComplaint}.` }]
                            };
                            const updatedCalls = event.calls.map(c => c.id === callId ? updatedCall : c);
                            await updateEvent({ calls: updatedCalls });
                          }}
                          onRemoveTeamFromCall={handleRemoveTeamFromCall}
                          onAddTeamToCall={handleAddTeamToCall}
                          handleTeamStatusChange={handleTeamStatusChange}
                          handleMarkDuplicate={handleMarkDuplicate}
                          handleTogglePriority={handleTogglePriorityFromMenu}
                          handleDeleteCall={handleDeleteCall}
                          getCallRowClass={getCallRowClass}
                          formatAgeSex={formatAgeSex}
                          updateEvent={updateEvent}
                        />
                      ))}
                      {(!event.calls || event.calls.length === 0) && (
                        <div className="text-center text-surface-light/50 py-8">
                          No calls
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center pt-3">
                      <button
                        onClick={() => setShowResolvedCalls(prev => !prev)}
                        className="text-surface-faint text-base hover:text-surface-light"
                        aria-label="Toggle resolved calls"
                      >                        {showResolvedCalls ? 'Hide Resolved Calls' : 'Show Resolved Calls'}
                      </button>
                    </div>
                  </div>
                </div>
              </Tab>

              {/* CLINIC TAB */}
              <Tab key="clinic" title="Clinic">
                <div className="space-y-6 pb-20">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-xl font-bold text-surface-light">
                        Clinic ({(event.calls || []).filter(c => c.status === 'Delivered' && !c.outcome).length})
                      </h2>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Add clinic walk-up" placement="top">
                          <div>
                            <Button 
                              isIconOnly 
                              size="md" 
                              variant="flat" 
                              aria-label="Add Clinic Call"
                              onPress={() => setShowQuickClinicCallForm(true)}
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                          </div>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        // Unresolved clinic (Delivered with no outcome)
                        ...(event.calls || [])
                          .filter(c => c.status === 'Delivered' && !c.outcome)
                          .sort((a, b) => parseInt(a.id) - parseInt(b.id)),
                        // Resolved clinic (Delivered with an outcome) when toggled on
                        ...(showResolvedClinicCalls
                          ? (event.calls || [])
                              .filter(c => c.status === 'Delivered' && !!c.outcome)
                              .sort((a, b) => parseInt(a.id) - parseInt(b.id))
                          : [])
                      ].map((call: Call) => (
                        <ClinicTrackingCard
                          key={call.id}
                          call={call}
                          callDisplayNumber={callDisplayNumberMap.get(call.id) || 0}
                          event={event}
                          onLocationChange={async (callId, newLocation) => {
                            const callToUpdate = event.calls.find(c => c.id === callId);
                            if (!callToUpdate) return;
                            
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                            const updatedCall = {
                              ...callToUpdate,
                              location: newLocation,
                              log: [...(callToUpdate.log || []), { timestamp: now.getTime(), message: `${hhmm} - Location changed to ${newLocation}.` }]
                            };
                            const updatedCalls = event.calls.map(c => c.id === callId ? updatedCall : c);
                            await updateEvent({ calls: updatedCalls });
                          }}
                          onAgeSexChange={async (callId, ageSexValue) => {
                            const callToUpdate = event.calls.find(c => c.id === callId);
                            if (!callToUpdate) return;
                            
                            const { age, gender } = parseAgeSex(ageSexValue);
                            const newAge = age || '';
                            const newGender = gender || '';
                            
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                            const updatedCall = {
                              ...callToUpdate,
                              age: newAge,
                              gender: newGender,
                              log: [...(callToUpdate.log || []), { timestamp: now.getTime(), message: `${hhmm} - Age/Sex set to ${formatAgeSex(newAge, newGender) || 'N/A'}.` }]
                            };
                            const updatedCalls = event.calls.map(c => c.id === callId ? updatedCall : c);
                            await updateEvent({ calls: updatedCalls });
                          }}
                          onChiefComplaintChange={async (callId, newChiefComplaint) => {
                            const callToUpdate = event.calls.find(c => c.id === callId);
                            if (!callToUpdate) return;
                            
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                            const updatedCall = {
                              ...callToUpdate,
                              chiefComplaint: newChiefComplaint,
                              log: [...(callToUpdate.log || []), { timestamp: now.getTime(), message: `${hhmm} - Chief Complaint changed to ${newChiefComplaint}.` }]
                            };
                            const updatedCalls = event.calls.map(c => c.id === callId ? updatedCall : c);
                            await updateEvent({ calls: updatedCalls });
                          }}
                          onOutcomeChange={async (callId, outcome) => {
                            const callToUpdate = event.calls.find(c => c.id === callId);
                            if (!callToUpdate) return;
                            
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                            const updatedCall = {
                              ...callToUpdate,
                              outcome: outcome === 'In Clinic' ? undefined : outcome as ClinicOutcome,
                              log: [...(callToUpdate.log || []), { timestamp: now.getTime(), message: `${hhmm} - Clinic Status: ${outcome}` }]
                            };
                            const updatedCalls = event.calls.map(c => c.id === callId ? updatedCall : c);
                            await updateEvent({ calls: updatedCalls });
                          }}
                          handleDeleteCall={handleDeleteCall}
                          getCallRowClass={getCallRowClass}
                          formatAgeSex={formatAgeSex}
                          updateEvent={updateEvent}
                        />
                      ))}
                      {(!event.calls || event.calls.filter(c => c.status === 'Delivered').length === 0) && (
                        <div className="text-center text-surface-light/50 py-8">
                          No clinic calls
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center pt-3">
                      <button
                        onClick={() => setShowResolvedClinicCalls(prev => !prev)}
                        className="text-surface-faint text-base hover:text-surface-light"
                        aria-label="Toggle resolved clinic calls"
                      >
                        {showResolvedClinicCalls ? 'Hide Resolved Clinic Calls' : 'Show Resolved Clinic Calls'}
                      </button>
                    </div>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </div>
        </div>
      </div>

      <PostingScheduleModal
        isOpen={showPostingSchedule}
        onClose={() => setShowPostingSchedule(false)}
        event={event}
        postAssignments={postAssignments}
        onPostAssignment={handlePostAssignment}
        onBulkPostAssignment={handleBulkPostAssignment}
        onClearAllPostAssignments={handleClearAllPostAssignments}
        onUpdatePostingTime={handleUpdatePostingTime}
        getCurrentActiveTime={getCurrentActiveTime}
        updateEvent={updateEvent}
        notifyPostAssignmentChange={notifyPostAssignmentChange}
      />

      {!isLiteMode && (
        <>
          {/* Cloud-only modals */}
          {event?.venue && (
            <VenueMapModal
              isOpen={showVenueMap}
              onClose={() => setShowVenueMap(false)}
              layers={
                event.venue.layers && event.venue.layers.length
                  ? event.venue.layers
                  : [
                      {
                        id:
                          typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? (crypto as unknown as { randomUUID?: () => string }).randomUUID?.() ?? `layer-${Date.now()}`
                            : `layer-${Date.now()}`,
                        name: event.venue.name || 'Main Floor',
                        posts: event.eventPosts || [],
                        mapUrl: event.venue.mapUrl,
                      },
                    ]
              }
              staff={event.staff || []}
              equipment={event.eventEquipment || []}
              teamTimers={teamTimers}
            />
          )}

          <EndEventModal
            open={showEndEvent}
            onClose={() => setShowEndEvent(false)}
            onEndNoSummary={async () => {}}
            onQuickSummary={async () => router.push(`/events/${event.id}/summary`)}
          />
        </>
      )}

      {showDuplicateModal && selectedDuplicateCallId && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center" onClick={() => setShowDuplicateModal(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-deepest border border-surface-liner text-surface-light rounded-2xl p-6 w-full max-w-2xl shadow-xl space-y-4"
          >
            <h2 className="text-2xl font-bold text-surface mb-4">Select Original Call</h2>
            <p className="text-surface-light mb-4">
              Call #{callDisplayNumberMap.get(selectedDuplicateCallId)} is a duplicate of which call?
            </p>
            <div className="max-h-80 overflow-y-auto border border-surface-liner rounded">
              <table className="w-full text-sm">
                <thead className="bg-surface-deep sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-surface-light">Call #</th>
                    <th className="px-3 py-2 text-left text-surface-light">Chief Complaint</th>
                    <th className="px-3 py-2 text-left text-surface-light">Age</th>
                    <th className="px-3 py-2 text-left text-surface-light">Sex</th>
                    <th className="px-3 py-2 text-left text-surface-light">Location</th>
                    <th className="px-3 py-2 text-left text-surface-light">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {event?.calls
                    .filter(call => call.id !== selectedDuplicateCallId && !["Delivered", "Refusal", "NMM", "Resolved"].includes(call.status))
                    .sort((a, b) => parseInt(a.id) - parseInt(b.id))
                    .map(call => (
                      <tr key={call.id} className="border-b border-surface-liner hover:bg-surface-deep">
                        <td className="px-3 py-2">{callDisplayNumberMap.get(call.id)}</td>
                        <td className="px-3 py-2">{call.chiefComplaint || 'N/A'}</td>
                        <td className="px-3 py-2">{call.age || 'N/A'}</td>
                        <td className="px-3 py-2">{call.gender || 'N/A'}</td>
                        <td className="px-3 py-2">{call.location || 'N/A'}</td>
                        <td className="px-3 py-2">
                          <Button
                            onClick={() => handleResolveDuplicate(selectedDuplicateCallId, call.id)}
                            className="px-3 py-1 bg-status-red hover:bg-status-red/80 text-white rounded text-sm"
                          >
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {event?.calls.filter(call => call.id !== selectedDuplicateCallId && !["Delivered", "Refusal", "NMM", "Resolved"].includes(call.status)).length === 0 && (
              <p className="text-surface-light text-center py-4">No active calls available to mark as original.</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 rounded bg-surface-deep hover:bg-surface-liner text-surface-light"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}