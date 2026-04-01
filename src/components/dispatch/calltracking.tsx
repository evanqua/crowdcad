// components/calltracking.tsx
'use client';

import React, {} from 'react';
import { 
  Button, 
  Chip, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
} from '@heroui/react';
import { Plus, MoreVertical } from "lucide-react";
import type { Event, Call, EquipmentStatus, Supervisor, Staff, Equipment } from '@/app/types';
import { useCallTrackingState } from '@/hooks/useCallTrackingState';
import CallTrackingDetails from '@/components/dispatch/calltrackingdetails';

import {
  Dropdownmenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Define EditableCallField type locally
type EditableCallField = keyof Call | 'ageSex';

interface CallTrackingTableProps {
  event: Event;
  callDisplayNumberMap: Map<string, number>;
  showResolvedCalls: boolean;
  setShowResolvedCalls: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowQuickCallForm: (value: boolean) => void;
  openCallId: string | null;
  setOpenCallId: (value: string | null) => void;
  editingCell: { callId: string; field: EditableCallField } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ callId: string; field: EditableCallField } | null>>;
  editValue: string;
  setEditValue: (value: string) => void;
  teamStatusMap: Record<string, Record<string, string>>;
  updateEvent: (updates: Partial<Event>) => Promise<void>;
  handleCellClick: <K extends keyof Call>(callId: string, field: K, value?: Call[K]) => void;
  handleCellBlur: <K extends keyof Call>(callId: string, field: K) => Promise<void>;
  handleAgeSexBlur: (callId: string) => Promise<void>;
  handleRowClick: (e: React.MouseEvent, callId: string) => void;
  handleMarkDuplicate: (callId: string) => void;
  handleTogglePriorityFromMenu: (callId: string) => void;
  handleDeleteCall: (callId: string) => void;
  handleTeamStatusChange: (callId: string, team: string, newStatus: string) => void;
  handleRemoveTeamFromCall: (callId: string, team: string) => Promise<void>;
  handleAddTeamToCall: (callId: string, team: string) => Promise<void>;
  getCallRowClass: (call: Call) => string;
  computeCallStatus: (call: Call) => string;
  formatAgeSex: (age?: string | number, gender?: string) => string;
  TableColGroup: React.ComponentType;
  PortalDropdown: React.ComponentType<unknown>;
}

interface DetachedTeam {
  team: string;
  reason: string;
}

interface LogEntry {
  timestamp: number;
  message: string;
}

export const CallTrackingTable: React.FC<CallTrackingTableProps> = ({
  event,
  callDisplayNumberMap,
  showResolvedCalls,
  setShowResolvedCalls,
  setShowQuickCallForm,
  openCallId,
  setOpenCallId,
  editingCell,
  setEditingCell,
  editValue,
  setEditValue,
  teamStatusMap,
  updateEvent,
  handleCellClick,
  handleCellBlur,
  handleAgeSexBlur,
  handleRowClick,
  handleMarkDuplicate,
  handleTogglePriorityFromMenu,
  handleDeleteCall,
  handleTeamStatusChange,
  handleRemoveTeamFromCall,
  handleAddTeamToCall,
  getCallRowClass,
  computeCallStatus,
  formatAgeSex,
  TableColGroup,
}) => {
  // const ButtonRefs = useRef<Record<string, HTMLElement | null>>({});
  const {
    notesTexts,
    setNotesTexts,
    notesFocusedRef,
    logTexts,
    setLogTexts,
    logFocusedRef,
    pendingValues,
    markPendingValue,
  } = useCallTrackingState(event, formatAgeSex);


  return (
    <div className="col-span-2 space-y-4 text-black">
      <div className="p-4 bg-surface-deep rounded-xl overflow-hidden">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-surface-light">
            Total Calls: {event.calls?.length || 0}
          </h3>
          <div className="flex gap-2">
            <Button
              isIconOnly
              size="md"
              variant="flat"
              aria-label="Add Team or Supervisor"
              onPress={() => setShowQuickCallForm(true)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-[870px] w-full text-[14px] sm:text-[15px] text-surface-light table-fixed border-separate border-spacing-0">
            <TableColGroup />
            <thead>
              <tr className="border-b border-surface-liner">
                <th className="px-3 py-2.5 text-left text-surface-faint w-16">Call #</th>
                <th className="px-3 py-2.5 text-left text-surface-faint w-40">Chief Complaint</th>
                <th className="px-3 py-2.5 text-left text-surface-faint w-16">A/S</th>
                <th className="px-3 py-2.5 text-left text-surface-faint w-40">Status</th>
                <th className="px-3 py-2.5 text-left text-surface-faint w-48">Location</th>
                <th className="px-3 py-2.5 text-left text-surface-faint">Team</th>
                <th className="px-3 py-2.5 text-right text-surface-faint w-12"></th>
              </tr>
            </thead>

            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-surface-liner">
              {[
                // Active calls first
                ...event.calls
                  .filter((call: Call) => !["Delivered", "Refusal", "NMM", "Rolled", "Resolved", "Unable to Locate"].includes(call.status))
                  .sort((a: Call, b: Call) => parseInt(a.id) - parseInt(b.id)),
                // Show resolved calls when showResolvedCalls is true
                ...(showResolvedCalls
                  ? event.calls
                      .filter((c: Call) => ["Delivered", "Refusal", "NMM", "Rolled", "Resolved", "Unable to Locate"].includes(c.status))
                      .sort((a: Call, b: Call) => parseInt(a.id) - parseInt(b.id))
                  : [])
              ].map((call: Call) => {
                const pendingForCall = pendingValues[call.id] || {};
                return (
                <React.Fragment key={call.id}>
                  <tr
                    className={`cursor-pointer min-h-3.25rem ${getCallRowClass(call)} transition-colors`}
                    onClick={(e) => handleRowClick(e, call.id)}
                  >
                        <td className="px-3 py-2.5">{callDisplayNumberMap.get(call.id)}</td>
                        
                        {/* Chief Complaint */}
                        <td
                          className="px-3 py-2.5 truncate"
                          onClick={() => handleCellClick(call.id, 'chiefComplaint', call.chiefComplaint)}
                        >
                          {editingCell?.callId === call.id && editingCell.field === 'chiefComplaint' ? (
                            <input
                              type="text"
                              value={editValue}
                              autoFocus
                              onChange={(e) => setEditValue(e.target.value)}
                              onFocus={(e) => {
                                // If this was the placeholder value, clear it on focus
                                if (e.target instanceof HTMLInputElement && e.target.value === '[Edit]') {
                                  setEditValue('');
                                }
                              }}
                              onBlur={async () => {
                                markPendingValue(call.id, 'chiefComplaint', editValue);
                                try {
                                  await handleCellBlur(call.id, 'chiefComplaint');
                                } catch {
                                  // ignore - pending will be cleared by effect if updated
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                } else if (e.key === 'Tab' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleCellBlur(call.id, 'chiefComplaint').then(() => {
                                    setEditingCell({ callId: call.id, field: 'ageSex' });
                                    setEditValue(formatAgeSex(call.age, call.gender));
                                  });
                                }
                              }}
                              className="w-full bg-transparent text-surface-light px-0 py-0 border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                            />
                          ) : (
                            // Prefer a pending value while saving to avoid flashing the placeholder
                            (pendingForCall.chiefComplaint !== undefined
                              ? (pendingForCall.chiefComplaint || <span className="text-surface-light whitespace-nowrap">[Edit]</span>)
                              : (call.chiefComplaint ? call.chiefComplaint : <span className="text-surface-light whitespace-nowrap">[Edit]</span>))
                          )}
                        </td>
                        
                        {/* Age/Sex */}
                        <td
                          className="px-3 py-2.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCell({ callId: call.id, field: 'ageSex' });
                            setEditValue(formatAgeSex(call.age, call.gender));
                          }}
                        >
                          {editingCell?.callId === call.id && editingCell.field === 'ageSex' ? (
                            <input
                              type="text"
                              value={editValue}
                              autoFocus
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={async () => {
                                markPendingValue(call.id, 'ageSex', editValue);
                                try {
                                  await handleAgeSexBlur(call.id);
                                } catch {}
                              }}
                              onFocus={(e) => {
                                // Clear [Edit] placeholder on focus
                                if (e.target.value === '[Edit]') {
                                  setEditValue('');
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                } else if (e.key === 'Tab' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleAgeSexBlur(call.id).then(() => {
                                    setEditingCell({ callId: call.id, field: 'location' });
                                    setEditValue(call.location || '');
                                  });
                                }
                              }}
                             className="w-full bg-transparent text-surface-light px-0 py-0 border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                            />
                          ) : (
                            <span className="truncate">
                              {(() => {
                                if (pendingForCall.ageSex !== undefined) {
                                  return pendingForCall.ageSex || <span className="text-surface-light whitespace-nowrap">[Edit]</span>;
                                }
                                const formatted = formatAgeSex(call.age, call.gender);
                                return formatted || <span className="text-surface-light whitespace-nowrap">[Edit]</span>;
                              })()}
                            </span>
                          )}
                        </td>
                        
                        {/* Status */}
                        <td className="px-3 py-2.5">{computeCallStatus(call)}</td>
                        
                        {/* Location */}
                        <td className="px-3 py-2.5" onClick={() => handleCellClick(call.id, 'location', call.location)}>
                          {editingCell?.callId === call.id && editingCell.field === 'location' ? (
                            <input
                              type="text"
                              value={editValue}
                              autoFocus
                              onChange={e => setEditValue(e.target.value)}
                              onFocus={e => {
                                // If the value is "Unknown", select all text so it's easy to replace
                                if (editValue === 'Unknown') {
                                  e.target.select();
                                }
                              }}
                              onBlur={() => handleCellBlur(call.id, 'location')}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="w-full bg-transparent text-surface-light px-0 py-0 border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                            />
                          ) : (
                            call.location || <span className="text-surface-light whitespace-nowrap">[Edit]</span>
                          )}
                        </td>
                        
                        {/* Team - Updated with larger Chips and shadcn dropdown */}
                        <td className="px-3 py-2.5 relative z-0">
                          <div className="relative z-0 flex flex-wrap items-center gap-2">
                            {/* Active assigned teams - Larger chips with centered dropdown */}
                            {(Array.isArray(call.assignedTeam) ? call.assignedTeam : []).map((team: string) => {
                              const isEquipmentOnlyTeam = call.equipmentTeams?.includes(team);
                              const statusOptions = isEquipmentOnlyTeam
                                ? ['En Route Eq', 'Assisting', 'Delivered Eq',]
                                : ['En Route', 'On Scene', 'Unable to Locate', 'Transporting', 'Rolled from Scene', 'Delivered', 'Refusal', 'NMM', 'Detached'];
                           
                              return (
                                <Chip
                                  key={team}
                                  size="lg"
                                  variant="flat"
                                  color="default"
                                  className="text-surface-light h-9"
                                  onClose={() => handleRemoveTeamFromCall(call.id, team)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{team}</span>
                                    <Dropdown>
                                      <DropdownTrigger>
                                        <Button
                                          size="sm"
                                          variant="light"
                                          className="min-w-0 h-6 px-2 text-xs"
                                        >
                                          {teamStatusMap[call.id]?.[team] || event?.staff.find(s => s.team === team)?.status || 'En Route'}
                                        </Button>
                                      </DropdownTrigger>
                                      <DropdownMenu
                                        aria-label="Team status"
                                        onAction={(key) => handleTeamStatusChange(call.id, team, key as string)}
                                      >
                                        {statusOptions.map((status: string) => (
                                          <DropdownItem key={status}>{status}</DropdownItem>
                                        ))}
                                      </DropdownMenu>
                                    </Dropdown>
                                  </div>
                                </Chip>
                              );
                            })}
                            
                            {/* Detached teams */}
                            {call.detachedTeams?.map((detachedTeam: DetachedTeam) => (
                              <Chip
                                key={detachedTeam.team}
                                size="lg"
                                variant="flat"
                                color={detachedTeam.reason === 'Delivered' ? 'success' : 'default'}
                                className="border border-surface-liner h-9"
                              >
                                <span className="text-surface-light font-medium mr-2">
                                  {detachedTeam.team}
                                </span>
                                <span className="text-xs">
                                  {detachedTeam.reason === 'Refusal' ? 'Refusal' : detachedTeam.reason}
                                </span>
                              </Chip>
                            ))}
                            
                            {/* Add Team Button with shadcn DropdownMenu */}
                            <Dropdownmenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  aria-label="Add"
                                  className="w-8 h-8 rounded-full hover:bg-surface-liner"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-surface-deep border-surface-liner text-surface-light">
                                
                                {/* Add Team Submenu */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                                    Add Team
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                                    {(() => {
                                      const allTeams = event.staff ? event.staff.map(s => s.team) : [];
                                      
                                      // Filter teams: must NOT be assigned to active calls, and must be Available/In Clinic/On Break
                                      const activeTeams = allTeams.filter(teamName => {
                                        const teamStaff = event.staff?.find(s => s.team === teamName);
                                        const isAssignedToActiveCall = event.calls?.some((c: Call) => 
                                          c.assignedTeam?.includes(teamName) && 
                                          !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                        );
                                        return !isAssignedToActiveCall && teamStaff?.status === 'Available';
                                      });
                                      
                                      const inactiveTeams = allTeams.filter(teamName => {
                                        const teamStaff = event.staff?.find(s => s.team === teamName);
                                        const isAssignedToActiveCall = event.calls?.some((c: Call) => 
                                          c.assignedTeam?.includes(teamName) && 
                                          !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                        );
                                        return !isAssignedToActiveCall && ['In Clinic', 'On Break'].includes(teamStaff?.status || '');
                                      });                                     
                                      return [
                                        ...activeTeams.map(team => (
                                          <DropdownMenuItem
                                            key={team}
                                            className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer"
                                            onClick={() => handleAddTeamToCall(call.id, team)}
                                          >
                                            {team}
                                          </DropdownMenuItem>
                                        )),
                                        ...inactiveTeams.map(team => (
                                          <DropdownMenuItem
                                            key={team}
                                            className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer bg-status-blue/20"
                                            onClick={() => handleAddTeamToCall(call.id, team)}
                                          >
                                            {team}
                                          </DropdownMenuItem>
                                        ))
                                      ];
                                    })()}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>

                                {/* Add Supervisor Submenu */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                                    Add Supervisor
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                                    {event.supervisor
                                      ?.filter((supervisor: Supervisor) => {
                                        const notAssignedToThisCall = !call.assignedTeam?.includes(supervisor.team);
                                        const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                          c.assignedTeam?.includes(supervisor.team) && 
                                          !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                        );
                                        const hasValidStatus = ['Available', 'In Clinic', 'On Break'].includes(supervisor.status);
                                        return notAssignedToThisCall && notAssignedToAnyActiveCall && hasValidStatus;
                                      })
                                      .map((supervisor: Supervisor) => {
                                        const match = supervisor.member.match(/^(.+?)\s\[(.+?)\]/);
                                        const memberName = match ? match[1] : supervisor.member;
                                        const isInactive = ['In Clinic', 'On Break'].includes(supervisor.status);
                                        return (
                                          <DropdownMenuItem
                                            key={`supervisor-${supervisor.team}`}
                                            className={`text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer ${isInactive ? 'bg-status-blue/20' : ''}`}
                                            onClick={async () => {
                                              const now = new Date();
                                              const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                              const callLogEntry = {
                                                timestamp: now.getTime(),
                                                message: `${hhmm} - Supervisor ${memberName} (${supervisor.team}) assigned to call.`
                                              };
                                              const teamLogEntry = {
                                                timestamp: now.getTime(),
                                                message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} (supervisor support)`
                                              };

                                              const updatedCall = {
                                                ...call,
                                                assignedTeam: [...(call.assignedTeam || []), supervisor.team],
                                                status: call.assignedTeam?.length ? call.status : 'Assigned',
                                                log: [...(call.log || []), callLogEntry]
                                              };

                                              const updatedSupervisor = event.supervisor?.map((s: Supervisor) =>
                                                s.team === supervisor.team
                                                  ? {
                                                      ...s,
                                                      status: 'En Route',
                                                      location: call.location,
                                                      originalPost: s.location || 'Unknown',
                                                      log: [...(s.log || []), teamLogEntry]
                                                    }
                                                  : s
                                              );

                                              const updatedCalls = event.calls.map((c: Call) => (c.id === call.id ? updatedCall : c));

                                              await updateEvent({
                                                calls: updatedCalls,
                                                supervisor: updatedSupervisor
                                              });
                                            }}
                                          >
                                            {memberName} ({supervisor.team})
                                          </DropdownMenuItem>
                                        );
                                      })}
                                    {(!event.supervisor || event.supervisor.filter((supervisor: Supervisor) => {
                                      const notAssignedToThisCall = !call.assignedTeam?.includes(supervisor.team);
                                      const isAvailable = supervisor.status === 'Available' ||
                                        !event.calls?.some((c: Call) => 
                                          c.assignedTeam?.includes(supervisor.team) && 
                                          !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                        );
                                      return notAssignedToThisCall && isAvailable;
                                    }).length === 0) && (
                                      <DropdownMenuItem disabled className="text-surface-light/50">
                                        No supervisors available
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>

                                {/* Add Equipment Submenu */}
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                                    Add Equipment
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                                    {(() => {
                                      // Filter available and in clinic equipment separately
                                      const availableEquipment = (event.eventEquipment || [])
                                        .filter((eq: Equipment) => eq.status === 'Available' || !eq.assignedTeam);
                                      
                                      const inClinicEquipment = (event.eventEquipment || [])
                                        .filter((eq: Equipment) => eq.status === 'In Clinic');
                                      
                                      return [
                                        // Available equipment (no highlighting)
                                        ...availableEquipment.map((equipment: Equipment) => (
                                        <DropdownMenuSub key={equipment.id}>
                                          <DropdownMenuSubTrigger className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                                            {equipment.name}
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                                            {/* Available TEAMS and INACTIVE TEAMS */}
                                            {(() => {
                                              const availableTeams = event.staff.filter((team: Staff) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(team.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(team.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && team.status === 'Available';
                                              });
                                              
                                              const inactiveTeams = event.staff.filter((team: Staff) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(team.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(team.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && ['In Clinic', 'On Break'].includes(team.status);
                                              });
                                              
                                              return [
                                                ...availableTeams.map((team: Staff) => (
                                                  <DropdownMenuItem
                                                    key={`equip-team-${team.team}`}
                                                    className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer"
                                                    onClick={async () => {
                                                      const now = new Date();
                                                      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                      const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                        eq.id === equipment.id
                                                          ? {
                                                              ...eq,
                                                              status: 'In Use' as EquipmentStatus,
                                                              assignedTeam: team.team,
                                                              location: call.location
                                                            }
                                                          : eq
                                                      );

                                                      const callLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - ${equipment.name} assigned to ${team.team} for this call.`
                                                      };

                                                      const teamLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name}`
                                                      };

                                                      const updatedCall = {
                                                        ...call,
                                                          assignedTeam: [...(call.assignedTeam || []), team.team],
                                                          equipment: [...(call.equipment || []), equipment.name],
                                                          equipmentTeams: [...(call.equipmentTeams || []), team.team],
                                                        status: 'Assigned',
                                                        log: [...(call.log || []), callLogEntry]
                                                      };

                                                      const updatedStaff = event.staff.map((t: Staff) =>
                                                        t.team === team.team
                                                          ? {
                                                              ...t,
                                                              status: 'En Route Eq',
                                                              location: call.location,
                                                              originalPost: t.location || 'Unknown',
                                                              log: [...(t.log || []), teamLogEntry]
                                                            }
                                                          : t
                                                      );

                                                      const updatedCalls = event.calls.map((c: Call) =>
                                                        c.id === call.id ? updatedCall : c
                                                      );

                                                      await updateEvent({
                                                        calls: updatedCalls,
                                                        staff: updatedStaff,
                                                        eventEquipment: updatedEquipment
                                                      });
                                                    }}
                                                  >
                                                    {team.team}
                                                  </DropdownMenuItem>
                                                )),
                                                ...inactiveTeams.map((team: Staff) => (
                                                  <DropdownMenuItem
                                                    key={`equip-team-inactive-${team.team}`}
                                                    className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer bg-status-blue/20"
                                                    onClick={async () => {
                                                      const now = new Date();
                                                      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                      const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                        eq.id === equipment.id
                                                          ? {
                                                              ...eq,
                                                              status: `Call ${call.order}`,
                                                              assignedTeam: team.team,
                                                              location: team.team
                                                            }
                                                          : eq
                                                      );

                                                      const callLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - ${equipment.name} assigned to ${team.team} for this call.`
                                                      };

                                                      const teamLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name}`
                                                      };

                                                      const updatedCall = {
                                                        ...call,
                                                        assignedTeam: [...(call.assignedTeam || []), team.team],
                                                        equipmentTeams: [...(call.equipmentTeams || []), team.team],
                                                        status: 'Assigned',
                                                        log: [...(call.log || []), callLogEntry]
                                                      };

                                                      const updatedStaff = event.staff.map((t: Staff) =>
                                                        t.team === team.team
                                                          ? {
                                                              ...t,
                                                              status: 'En Route Eq',
                                                              location: call.location,
                                                              originalPost: t.location || 'Unknown',
                                                              log: [...(t.log || []), teamLogEntry]
                                                            }
                                                          : t
                                                      );

                                                      const updatedCalls = event.calls.map((c: Call) =>
                                                        c.id === call.id ? updatedCall : c
                                                      );

                                                      await updateEvent({
                                                        calls: updatedCalls,
                                                        staff: updatedStaff,
                                                        eventEquipment: updatedEquipment
                                                      });
                                                    }}
                                                  >
                                                    {team.team}
                                                  </DropdownMenuItem>
                                                ))
                                              ];
                                            })()}

                                            {/* Available SUPERVISORS and INACTIVE SUPERVISORS */}
                                            {(() => {
                                              const availableSupervisors = event.supervisor?.filter((sup: Supervisor) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(sup.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(sup.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && sup.status === 'Available';
                                              }) || [];
                                              
                                              const inactiveSupervisors = event.supervisor?.filter((sup: Supervisor) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(sup.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(sup.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && ['In Clinic', 'On Break'].includes(sup.status);
                                              }) || [];
                                              
                                              return [
                                                ...availableSupervisors.map((supervisor: Supervisor) => {
                                                  const match = supervisor.member.match(/^(.+?)\s\[(.+?)\]/);
                                                  const memberName = match ? match[1] : supervisor.member;
                                                  
                                                  return (
                                                    <DropdownMenuItem
                                                      key={`equip-supervisor-${supervisor.team}`}
                                                      className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer"
                                                      onClick={async () => {
                                                        const now = new Date();
                                                        const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                        const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                          eq.id === equipment.id
                                                            ? {
                                                                ...eq,
                                                                status: 'In Use' as EquipmentStatus,
                                                                assignedTeam: supervisor.team,
                                                                location: call.location
                                                              }
                                                            : eq
                                                        );

                                                        const callLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - ${equipment.name} assigned to Supervisor ${memberName} (${supervisor.team}) for this call.`
                                                        };

                                                        const teamLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name} (supervisor support)`
                                                        };

                                                        const updatedCall = {
                                                          ...call,
                                                          assignedTeam: [...(call.assignedTeam || []), supervisor.team],
                                                          equipmentTeams: [...(call.equipmentTeams || []), supervisor.team],
                                                          status: 'Assigned',
                                                          log: [...(call.log || []), callLogEntry]
                                                        };

                                                        const updatedSupervisor = event.supervisor?.map((s: Supervisor) =>
                                                          s.team === supervisor.team
                                                            ? {
                                                                ...s,
                                                                status: 'En Route Eq',
                                                                location: call.location,
                                                                originalPost: s.location || 'Unknown',
                                                                log: [...(s.log || []), teamLogEntry]
                                                              }
                                                            : s
                                                        );

                                                        const updatedCalls = event.calls.map((c: Call) =>
                                                          c.id === call.id ? updatedCall : c
                                                        );

                                                        await updateEvent({
                                                          calls: updatedCalls,
                                                          supervisor: updatedSupervisor,
                                                          eventEquipment: updatedEquipment
                                                        });
                                                      }}
                                                    >
                                                      {supervisor.team}
                                                    </DropdownMenuItem>
                                                  );
                                                }),
                                                ...inactiveSupervisors.map((supervisor: Supervisor) => {
                                                  const match = supervisor.member.match(/^(.+?)\s\[(.+?)\]/);
                                                  const memberName = match ? match[1] : supervisor.member;
                                                  
                                                  return (
                                                    <DropdownMenuItem
                                                      key={`equip-supervisor-inactive-${supervisor.team}`}
                                                      className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer bg-status-blue/20"
                                                      onClick={async () => {
                                                        const now = new Date();
                                                        const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                        const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                          eq.id === equipment.id
                                                            ? {
                                                                ...eq,
                                                                status: 'In Use' as EquipmentStatus,
                                                                assignedTeam: supervisor.team,
                                                                location: call.location
                                                              }
                                                            : eq
                                                        );

                                                        const callLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - ${equipment.name} assigned to Supervisor ${memberName} (${supervisor.team}) for this call.`
                                                        };

                                                        const teamLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name} (supervisor support)`
                                                        };

                                                        const updatedCall = {
                                                          ...call,
                                                          assignedTeam: [...(call.assignedTeam || []), supervisor.team],
                                                          equipmentTeams: [...(call.equipmentTeams || []), supervisor.team],
                                                          status: 'Assigned',
                                                          log: [...(call.log || []), callLogEntry]
                                                        };

                                                        const updatedSupervisor = event.supervisor?.map((s: Supervisor) =>
                                                          s.team === supervisor.team
                                                            ? {
                                                                ...s,
                                                                status: 'En Route Eq',
                                                                location: call.location,
                                                                originalPost: s.location || 'Unknown',
                                                                log: [...(s.log || []), teamLogEntry]
                                                              }
                                                            : s
                                                        );

                                                        const updatedCalls = event.calls.map((c: Call) =>
                                                          c.id === call.id ? updatedCall : c
                                                        );

                                                        await updateEvent({
                                                          calls: updatedCalls,
                                                          supervisor: updatedSupervisor,
                                                          eventEquipment: updatedEquipment
                                                        });
                                                      }}
                                                    >
                                                      {supervisor.team}
                                                    </DropdownMenuItem>
                                                  );
                                                })
                                              ];
                                            })()}
                                            </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            )),
                                        // In Clinic equipment (blue highlighting)
                                        ...inClinicEquipment.map((equipment: Equipment) => (
                                        <DropdownMenuSub key={equipment.id}>
                                          <DropdownMenuSubTrigger className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer bg-status-blue/20">
                                            {equipment.name}
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                                            {/* Available TEAMS and INACTIVE TEAMS for In Clinic equipment */}
                                            {(() => {
                                              const availableTeams = event.staff.filter((team: Staff) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(team.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(team.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && team.status === 'Available';
                                              });
                                              
                                              const inactiveTeams = event.staff.filter((team: Staff) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(team.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(team.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && ['In Clinic', 'On Break'].includes(team.status);
                                              });
                                              
                                              return [
                                                ...availableTeams.map((team: Staff) => (
                                                  <DropdownMenuItem
                                                    key={`equip-team-clinic-${team.team}`}
                                                    className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer"
                                                    onClick={async () => {
                                                      const now = new Date();
                                                      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                      const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                        eq.id === equipment.id
                                                          ? {
                                                              ...eq,
                                                              status: 'In Use' as EquipmentStatus,
                                                              assignedTeam: team.team,
                                                              location: call.location
                                                            }
                                                          : eq
                                                      );

                                                      const callLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - ${equipment.name} assigned to ${team.team} for this call.`
                                                      };

                                                      const teamLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name}`
                                                      };

                                                      const updatedCall = {
                                                        ...call,
                                                          assignedTeam: [...(call.assignedTeam || []), team.team],
                                                          equipment: [...(call.equipment || []), equipment.name],
                                                          equipmentTeams: [...(call.equipmentTeams || []), team.team],
                                                        status: 'Assigned',
                                                        log: [...(call.log || []), callLogEntry]
                                                      };

                                                      const updatedStaff = event.staff.map((t: Staff) =>
                                                        t.team === team.team
                                                          ? {
                                                              ...t,
                                                              status: 'En Route Eq',
                                                              location: call.location,
                                                              originalPost: t.location || 'Unknown',
                                                              log: [...(t.log || []), teamLogEntry]
                                                            }
                                                          : t
                                                      );

                                                      const updatedCalls = event.calls.map((c: Call) =>
                                                        c.id === call.id ? updatedCall : c
                                                      );

                                                      await updateEvent({
                                                        calls: updatedCalls,
                                                        staff: updatedStaff,
                                                        eventEquipment: updatedEquipment
                                                      });
                                                    }}
                                                  >
                                                    {team.team}
                                                  </DropdownMenuItem>
                                                )),
                                                ...inactiveTeams.map((team: Staff) => (
                                                  <DropdownMenuItem
                                                    key={`equip-team-inactive-clinic-${team.team}`}
                                                    className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer bg-status-blue/20"
                                                    onClick={async () => {
                                                      const now = new Date();
                                                      const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                      const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                        eq.id === equipment.id
                                                          ? {
                                                              ...eq,
                                                              status: `Call ${call.order}`,
                                                              assignedTeam: team.team,
                                                              location: team.team
                                                            }
                                                          : eq
                                                      );

                                                      const callLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - ${equipment.name} assigned to ${team.team} for this call.`
                                                      };

                                                      const teamLogEntry = {
                                                        timestamp: now.getTime(),
                                                        message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name}`
                                                      };

                                                      const updatedCall = {
                                                        ...call,
                                                        assignedTeam: [...(call.assignedTeam || []), team.team],
                                                        equipmentTeams: [...(call.equipmentTeams || []), team.team],
                                                        status: 'Assigned',
                                                        log: [...(call.log || []), callLogEntry]
                                                      };

                                                      const updatedStaff = event.staff.map((t: Staff) =>
                                                        t.team === team.team
                                                          ? {
                                                              ...t,
                                                              status: 'En Route Eq',
                                                              location: call.location,
                                                              originalPost: t.location || 'Unknown',
                                                              log: [...(t.log || []), teamLogEntry]
                                                            }
                                                          : t
                                                      );

                                                      const updatedCalls = event.calls.map((c: Call) =>
                                                        c.id === call.id ? updatedCall : c
                                                      );

                                                      await updateEvent({
                                                        calls: updatedCalls,
                                                        staff: updatedStaff,
                                                        eventEquipment: updatedEquipment
                                                      });
                                                    }}
                                                  >
                                                    {team.team}
                                                  </DropdownMenuItem>
                                                ))
                                              ];
                                            })()}

                                            {/* Available SUPERVISORS and INACTIVE SUPERVISORS for In Clinic equipment */}
                                            {(() => {
                                              const availableSupervisors = event.supervisor?.filter((sup: Supervisor) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(sup.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(sup.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && sup.status === 'Available';
                                              }) || [];
                                              
                                              const inactiveSupervisors = event.supervisor?.filter((sup: Supervisor) => {
                                                const notAssignedToThisCall = !call.assignedTeam?.includes(sup.team);
                                                const notAssignedToAnyActiveCall = !event.calls?.some((c: Call) => 
                                                  c.assignedTeam?.includes(sup.team) && 
                                                  !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
                                                );
                                                return notAssignedToThisCall && notAssignedToAnyActiveCall && ['In Clinic', 'On Break'].includes(sup.status);
                                              }) || [];
                                              
                                              return [
                                                ...availableSupervisors.map((supervisor: Supervisor) => {
                                                  const match = supervisor.member.match(/^(.+?)\s\[(.+?)\]/);
                                                  const memberName = match ? match[1] : supervisor.member;
                                                  
                                                  return (
                                                    <DropdownMenuItem
                                                      key={`equip-supervisor-clinic-${supervisor.team}`}
                                                      className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer"
                                                      onClick={async () => {
                                                        const now = new Date();
                                                        const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                        const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                          eq.id === equipment.id
                                                            ? {
                                                                ...eq,
                                                                status: 'In Use' as EquipmentStatus,
                                                                assignedTeam: supervisor.team,
                                                                location: call.location
                                                              }
                                                            : eq
                                                        );

                                                        const callLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - ${equipment.name} assigned to Supervisor ${memberName} (${supervisor.team}) for this call.`
                                                        };

                                                        const teamLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name} (supervisor support)`
                                                        };

                                                        const updatedCall = {
                                                          ...call,
                                                          assignedTeam: [...(call.assignedTeam || []), supervisor.team],
                                                          equipmentTeams: [...(call.equipmentTeams || []), supervisor.team],
                                                          status: 'Assigned',
                                                          log: [...(call.log || []), callLogEntry]
                                                        };

                                                        const updatedSupervisor = event.supervisor?.map((s: Supervisor) =>
                                                          s.team === supervisor.team
                                                            ? {
                                                                ...s,
                                                                status: 'En Route Eq',
                                                                location: call.location,
                                                                originalPost: s.location || 'Unknown',
                                                                log: [...(s.log || []), teamLogEntry]
                                                              }
                                                            : s
                                                        );

                                                        const updatedCalls = event.calls.map((c: Call) =>
                                                          c.id === call.id ? updatedCall : c
                                                        );

                                                        await updateEvent({
                                                          calls: updatedCalls,
                                                          supervisor: updatedSupervisor,
                                                          eventEquipment: updatedEquipment
                                                        });
                                                      }}
                                                    >
                                                      {supervisor.team}
                                                    </DropdownMenuItem>
                                                  );
                                                }),
                                                ...inactiveSupervisors.map((supervisor: Supervisor) => {
                                                  const match = supervisor.member.match(/^(.+?)\s\[(.+?)\]/);
                                                  const memberName = match ? match[1] : supervisor.member;
                                                  
                                                  return (
                                                    <DropdownMenuItem
                                                      key={`equip-supervisor-inactive-clinic-${supervisor.team}`}
                                                      className="text-surface-light hover:bg-surface-liner focus:bg-surface-liner cursor-pointer bg-status-blue/20"
                                                      onClick={async () => {
                                                        const now = new Date();
                                                        const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                                        const updatedEquipment = event.eventEquipment?.map((eq: Equipment) =>
                                                          eq.id === equipment.id
                                                            ? {
                                                                ...eq,
                                                                status: 'In Use' as EquipmentStatus,
                                                                assignedTeam: supervisor.team,
                                                                location: call.location
                                                              }
                                                            : eq
                                                        );

                                                        const callLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - ${equipment.name} assigned to Supervisor ${memberName} (${supervisor.team}) for this call.`
                                                        };

                                                        const teamLogEntry = {
                                                          timestamp: now.getTime(),
                                                          message: `${hhmm} - responding to call #${callDisplayNumberMap.get(call.id)} with ${equipment.name} (supervisor support)`
                                                        };

                                                        const updatedCall = {
                                                          ...call,
                                                          assignedTeam: [...(call.assignedTeam || []), supervisor.team],
                                                          equipmentTeams: [...(call.equipmentTeams || []), supervisor.team],
                                                          status: 'Assigned',
                                                          log: [...(call.log || []), callLogEntry]
                                                        };

                                                        const updatedSupervisor = event.supervisor?.map((s: Supervisor) =>
                                                          s.team === supervisor.team
                                                            ? {
                                                                ...s,
                                                                status: 'En Route Eq',
                                                                location: call.location,
                                                                originalPost: s.location || 'Unknown',
                                                                log: [...(s.log || []), teamLogEntry]
                                                              }
                                                            : s
                                                        );

                                                        const updatedCalls = event.calls.map((c: Call) =>
                                                          c.id === call.id ? updatedCall : c
                                                        );

                                                        await updateEvent({
                                                          calls: updatedCalls,
                                                          supervisor: updatedSupervisor,
                                                          eventEquipment: updatedEquipment
                                                        });
                                                      }}
                                                    >
                                                      {supervisor.team}
                                                    </DropdownMenuItem>
                                                  );
                                                })
                                              ];
                                            })()}
                                            </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            ))
                                      ];
                                    })()}
                                    {(!event.eventEquipment || (event.eventEquipment.filter((eq: Equipment) => eq.status === 'Available' || eq.status === 'In Clinic' || !eq.assignedTeam).length === 0)) && (
                                              <DropdownMenuItem disabled className="text-surface-light/50">
                                                No equipment available
                                              </DropdownMenuItem>
                                            )}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              </DropdownMenuContent>
                            </Dropdownmenu>
                          </div>
                        </td>
                        {/* Options Ellipsis */}
                        <td className="px-3 py-2.5 text-right">
                          <Dropdown placement="bottom-end" offset={6}>
                            <DropdownTrigger>
                              <button
                                className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center ml-auto"
                                aria-label="Call actions"
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Call actions">
                              <DropdownItem 
                                key="showLog"
                                onPress={() => setOpenCallId(openCallId === call.id ? null : call.id)}
                              >
                                {openCallId === call.id ? 'Hide Log' : 'Show Log'}
                              </DropdownItem>
                              <DropdownItem 
                                key="duplicate"
                                onPress={() => handleMarkDuplicate(call.id)}
                              >
                                Mark as Duplicate
                              </DropdownItem>
                              <DropdownItem 
                                key="priority"
                                onPress={() => handleTogglePriorityFromMenu(call.id)}
                              >
                                {call.priority ? 'Remove Priority' : 'Mark as Priority'}
                              </DropdownItem>
                              <DropdownItem 
                                key="delete"
                                className="text-danger"
                                color="danger"
                                onPress={() => {
                                  if (confirm('Are you sure you want to delete this call? This action cannot be undone.')) {
                                    handleDeleteCall(call.id);
                                  }
                                }}
                              >
                                Delete Call
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </td>
                      </tr>
                  
                  {/* Expanded row for notes and log - NO ANIMATION */}
                  {openCallId === call.id && (
                    <CallTrackingDetails
                      key={`${call.id}-details`}
                      callDisplayNumber={callDisplayNumberMap.get(call.id)}
                      notesText={notesTexts[call.id] ?? (call.notes || '')}
                      onNotesChange={(value) => {
                        setNotesTexts((prev) => ({ ...prev, [call.id]: value }));
                      }}
                      onNotesFocus={() => {
                        notesFocusedRef.current = call.id;
                      }}
                      onNotesBlur={async () => {
                        notesFocusedRef.current = null;
                        const text = notesTexts[call.id] ?? '';
                        const callNow = event?.calls.find((currentCall: Call) => currentCall.id === call.id);
                        if (!callNow) return;

                        if ((callNow.notes || '') !== text) {
                          const updatedCall = { ...callNow, notes: text };
                          const updated = event!.calls.map((currentCall: Call) =>
                            currentCall.id === call.id ? updatedCall : currentCall
                          );
                          await updateEvent({ calls: updated });
                        }
                      }}
                      logText={logTexts[call.id] ?? (() => {
                        if (call.log && call.log.length > 0) {
                          return call.log.map((entry: LogEntry) => entry.message).join('\n');
                        }
                        return '';
                      })()}
                      onLogChange={(value) => {
                        setLogTexts((prev) => ({ ...prev, [call.id]: value }));
                      }}
                      onLogFocus={() => {
                        logFocusedRef.current = call.id;
                      }}
                      onLogBlur={async () => {
                        logFocusedRef.current = null;
                        const text = logTexts[call.id] ?? '';
                        const callNow = event?.calls.find((currentCall: Call) => currentCall.id === call.id);
                        if (!callNow) return;

                        const lines = text.split('\n').filter((line) => line.trim());
                        const newLog: LogEntry[] = lines.map((line) => ({
                          timestamp: Date.now(),
                          message: line,
                        }));

                        const updatedCall = { ...callNow, log: newLog };
                        const updated = event!.calls.map((currentCall: Call) =>
                          currentCall.id === call.id ? updatedCall : currentCall
                        );
                        await updateEvent({ calls: updated });
                      }}
                      onLogInsertTimestamp={() => {
                        const now = new Date();
                        const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                        setLogTexts((prev) => ({ ...prev, [call.id]: (prev[call.id] || '') + `\n${hhmm} - ` }));
                      }}
                      onClose={() => setOpenCallId(null)}
                      priority={call.priority}
                    />
                  )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-center pt-3">
          <button
            onClick={() => setShowResolvedCalls(prev => !prev)}
            className="text-surface-faint text-base hover:text-surface-light"
            aria-label="Toggle resolved calls"
          >
            {showResolvedCalls ? 'Hide Resolved Calls' : 'Show Resolved Calls'}
          </button>
        </div>
      </div>
    </div>
  );
};
