// calltrackingcard.tsx
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Card, CardHeader, CardBody, Input, Chip, Button,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Textarea
} from '@heroui/react';
import { Plus, MoreVertical } from 'lucide-react';
import {
  Dropdownmenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Event, Call } from '@/app/types';

type CallTrackingCardProps = {
  call: Call;
  callDisplayNumber: number;
  event: Event;
  onLocationChange: (callId: string, newLocation: string) => void;
  onAgeSexChange: (callId: string, ageSex: string) => void;
  onChiefComplaintChange: (callId: string, chiefComplaint: string) => void;
  onRemoveTeamFromCall: (callId: string, team: string) => Promise<void>;
  onAddTeamToCall: (callId: string, team: string) => Promise<void>;
  handleTeamStatusChange: (callId: string, team: string, newStatus: string) => void;
  handleMarkDuplicate: (callId: string) => void;
  handleTogglePriority: (callId: string) => void;
  handleDeleteCall: (callId: string) => void;
  formatAgeSex: (age?: string | number, gender?: string) => string;
  getCallRowClass: (call: Call) => string;
  updateEvent: (updates: Partial<Event>) => Promise<void>;
};

function useMMSS(since?: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!since) return;
    const tick = () => setElapsed(Math.floor((Date.now() - since) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function callBg(call: Call, event: Event) {
  // Check if any assigned team has active status
  if (!Array.isArray(call.assignedTeam)) return 'bg-surface-deep';
  
  const statuses = call.assignedTeam
    .map(t => event?.staff?.find(s => s.team === t)?.status)
    .filter((status): status is string => status !== undefined);

  if (statuses.some(status => ['En Route', 'On Scene', 'Transporting'].includes(status))) {
    return 'bg-[#2d2123]';
  }

  return 'bg-surface-deep';
}

export default function CallTrackingCard({
  call,
  callDisplayNumber,
  event,
  onLocationChange,
  onAgeSexChange,
  onChiefComplaintChange,
  onRemoveTeamFromCall,
  onAddTeamToCall,
  handleTeamStatusChange,
  handleMarkDuplicate,
  handleTogglePriority,
  handleDeleteCall,
  formatAgeSex,
  getCallRowClass,
  updateEvent,
}: CallTrackingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [locationInput, setLocationInput] = useState(call.location || '');
  const [ageSexInput, setAgeSexInput] = useState(formatAgeSex(call.age, call.gender) || '');
  const [chiefComplaintInput, setChiefComplaintInput] = useState(call.chiefComplaint || '');
  // Persistent local state for notes and log — never goes null to prevent flicker
  const [notesText, setNotesText] = useState(call.notes || '');
  const notesFocusedRef = useRef(false);
  const [logText, setLogText] = useState(() => {
    if (call.log && call.log.length > 0) {
      return call.log.map((entry: {timestamp: number; message: string}) => entry.message).join('\n');
    }
    return '';
  });
  const logFocusedRef = useRef(false);

  useEffect(() => {
    setLocationInput(call.location || '');
  }, [call.location]);

  useEffect(() => {
    setAgeSexInput(formatAgeSex(call.age, call.gender) || '');
  }, [call.age, call.gender, formatAgeSex]);

  useEffect(() => {
    setChiefComplaintInput(call.chiefComplaint || '');
  }, [call.chiefComplaint]);

  // Sync notes from props when not focused
  useEffect(() => {
    if (!notesFocusedRef.current) {
      setNotesText(call.notes || '');
    }
  }, [call.notes]);

  // Sync log from props when not focused
  useEffect(() => {
    if (!logFocusedRef.current) {
      const newText = call.log && call.log.length > 0
        ? call.log.map((entry: {timestamp: number; message: string}) => entry.message).join('\n')
        : '';
      setLogText(newText);
    }
  }, [call.log]);

  // Get call creation timestamp for timer
  const callTimestamp = useMemo(() => {
    if (call.log && call.log.length > 0) {
      return call.log[0].timestamp;
    }
    return Date.now();
  }, [call.log]);

  const timer = useMMSS(callTimestamp);
  const bg = getCallRowClass(call) || callBg(call, event);

  // Get available teams for dropdown (including On Break and In Clinic)
  const availableStaff = useMemo(() => {
    return (event.staff || []).filter(s => 
      !call.assignedTeam?.includes(s.team)
    );
  }, [event.staff, call.assignedTeam]);

  const availableSupervisors = useMemo(() => {
    return (event.supervisor || []).filter(s => 
      !call.assignedTeam?.includes(s.team)
    );
  }, [event.supervisor, call.assignedTeam]);

  const availableEquipment = useMemo(() => {
    const equipmentItems = event.venue?.equipment || [];
    return equipmentItems
      .map(eq => typeof eq === 'string' ? eq : eq.name)
      .filter(equipName => !call.equipment?.includes(equipName));
  }, [event.venue?.equipment, call.equipment]);

  // Get teams available for equipment delivery
  const teamsForEquipment = useMemo(() => {
    return (event.staff || []).filter(s => 
      ['Available', 'In Clinic', 'On Break'].includes(s.status)
    );
  }, [event.staff]);

  return (
    <Card className={`rounded-2xl shadow-sm border-0 ${bg}`}>
      {/* HEADER */}
      <CardHeader 
        onClick={() => setExpanded(v => !v)}
        className="relative flex items-center justify-between px-4 py-3 pb-0 cursor-pointer select-none"
      >
        <div className="text-[15px] sm:text-base font-semibold text-surface-light">
          Call {callDisplayNumber}
        </div>
        
        {/* Right section: Timer and Menu aligned horizontally */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {/* Timer */}
          <div className="text-[15px] sm:text-base font-semibold text-surface-light tabular-nums">
            {timer}
          </div>

          {/* 3-dot menu */}
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
            <Dropdown placement="bottom-end" offset={6}>
              <DropdownTrigger>
                <button
                  className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Call actions"
                  type="button"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Call actions">
                <DropdownItem 
                  key="showLog"
                  onPress={() => setExpanded(v => !v)}
                >
                  {expanded ? 'Hide Log' : 'Show Log'}
                </DropdownItem>
                <DropdownItem 
                  key="duplicate"
                  onPress={() => handleMarkDuplicate(call.id)}
                >
                  Mark as Duplicate
                </DropdownItem>
                <DropdownItem 
                  key="priority"
                  onPress={() => handleTogglePriority(call.id)}
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
          </div>
        </div>
      </CardHeader>

      {/* BODY */}
      <CardBody className="px-4 pb-3 space-y-3">
        {/* Row 1: Location */}
        <div className="flex gap-2">
          <Input
            label="Location"
            labelPlacement="inside"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            onBlur={() => {
              if (locationInput !== call.location) {
                onLocationChange(call.id, locationInput);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            variant="flat"
            classNames={{
              input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none",
              inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep"
            }}
            className="flex-1"
          />
        </div>

        {/* Row 2: Age/Sex (1/4) + Chief Complaint (3/4) */}
        <div className="flex gap-2">
          <Input
            label="Age/Sex"
            labelPlacement="inside"
            value={ageSexInput}
            onChange={(e) => setAgeSexInput(e.target.value)}
            onBlur={() => {
              if (ageSexInput !== formatAgeSex(call.age, call.gender)) {
                onAgeSexChange(call.id, ageSexInput);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            variant="flat"
            classNames={{
              input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none",
              inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep"
            }}
            className="w-1/4"
          />
          <Input
            label="Chief Complaint"
            labelPlacement="inside"
            value={chiefComplaintInput}
            onChange={(e) => setChiefComplaintInput(e.target.value)}
            onBlur={() => {
              if (chiefComplaintInput !== call.chiefComplaint) {
                onChiefComplaintChange(call.id, chiefComplaintInput);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            variant="flat"
            classNames={{
              input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none",
              inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep"
            }}
            className="flex-1"
          />
        </div>

        {/* Row 3: Team tags + Add button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active assigned teams */}
          {(Array.isArray(call.assignedTeam) ? call.assignedTeam : []).map((team: string) => {
            const isEquipmentOnlyTeam = call.equipmentTeams?.includes(team);
            const statusOptions = isEquipmentOnlyTeam
              ? ['En Route Eq', 'Assisting', 'Delivered Eq']
              : ['En Route', 'On Scene', 'Unable to Locate', 'Transporting', 'Rolled from Scene', 'Delivered', 'Refusal', 'NMM', 'Detached'];
            
            // Get current team status from event
            const teamStaff = event.staff?.find(s => s.team === team) || event.supervisor?.find(s => s.team === team);
            const currentStatus = teamStaff?.status || 'Unknown';

            return (
              <Chip
                key={team}
                size="lg"
                variant="flat"
                color="default"
                className="text-surface-light h-9"
                onClose={() => onRemoveTeamFromCall(call.id, team)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{team}</span>
                  <Dropdown placement="bottom-end" offset={2}>
                    <DropdownTrigger>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="text-xs text-surface-faint hover:text-surface-light transition-colors"
                      >
                        {currentStatus} ▼
                      </button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Team Status"
                      onAction={(key) => handleTeamStatusChange(call.id, team, key as string)}
                    >
                      {statusOptions.map(status => (
                        <DropdownItem key={status}>{status}</DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </Chip>
            );
          })}

          {/* Detached teams */}
          {call.detachedTeams?.map((detachedTeam: { team: string; reason: string }) => (
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

          {/* Add Team Button */}
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
                  {availableStaff.length > 0 ? (
                    availableStaff.map(s => {
                      const isBreakOrClinic = ['On Break', 'In Clinic'].includes(s.status);
                      return (
                        <DropdownMenuItem
                          key={s.team}
                          onClick={() => onAddTeamToCall(call.id, s.team)}
                          className={`hover:bg-surface-liner focus:bg-surface-liner cursor-pointer ${
                            isBreakOrClinic ? 'bg-status-blue/20 text-surface-light' : 'text-surface-light'
                          }`}
                        >
                          {s.team} {isBreakOrClinic && `(${s.status})`}
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled className="text-surface-faint">
                      No available teams
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Add Supervisor Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                  Add Supervisor
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                  {availableSupervisors.length > 0 ? (
                    availableSupervisors.map(s => {
                      const isBreakOrClinic = ['On Break', 'In Clinic'].includes(s.status);
                      return (
                        <DropdownMenuItem
                          key={s.team}
                          onClick={() => onAddTeamToCall(call.id, s.team)}
                          className={`hover:bg-surface-liner focus:bg-surface-liner cursor-pointer ${
                            isBreakOrClinic ? 'bg-status-blue/20 text-surface-light' : 'text-surface-light'
                          }`}
                        >
                          {s.team} {isBreakOrClinic && `(${s.status})`}
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled className="text-surface-faint">
                      No available supervisors
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Add Equipment Submenu - with team selection */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                  Add Equipment
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                  {availableEquipment.length > 0 ? (
                    availableEquipment.map(equipName => (
                      <DropdownMenuSub key={equipName}>
                        <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer text-surface-light">
                          {equipName}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="bg-surface-deep border-surface-liner">
                          {teamsForEquipment.length > 0 ? (
                            teamsForEquipment.map(t => {
                              const isBreakOrClinic = ['On Break', 'In Clinic'].includes(t.status);
                              return (
                                <DropdownMenuItem
                                  key={t.team}
                                  onClick={async () => {
                                    const now = new Date();
                                    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                                    // Find the equipment object in venue or event equipment
                                    const venueEquipment = event.venue?.equipment || [];
                                    const equipmentObj = venueEquipment.find(eq => 
                                      (typeof eq === 'string' ? eq : eq.name) === equipName
                                    );
                                    const equipmentId = typeof equipmentObj === 'object' ? equipmentObj.id : equipName;

                                    const updatedEquipment = event.eventEquipment?.map((eq) =>
                                      eq.id === equipmentId || eq.name === equipName
                                        ? {
                                            ...eq,
                                            status: 'In Use' as const,
                                            assignedTeam: t.team,
                                            location: call.location
                                          }
                                        : eq
                                    );

                                    const callLogEntry = {
                                      timestamp: now.getTime(),
                                      message: `${hhmm} - ${equipName} assigned to ${t.team} for this call.`
                                    };

                                    const teamLogEntry = {
                                      timestamp: now.getTime(),
                                      message: `${hhmm} - responding to call #${callDisplayNumber} with ${equipName}`
                                    };

                                    const updatedCall = {
                                      ...call,
                                      assignedTeam: [...(call.assignedTeam || []), t.team],
                                      equipment: [...(call.equipment || []), equipName],
                                      equipmentTeams: [...(call.equipmentTeams || []), t.team],
                                      status: 'Assigned',
                                      log: [...(call.log || []), callLogEntry]
                                    };

                                    const updatedStaff = event.staff.map((staff) =>
                                      staff.team === t.team
                                        ? {
                                            ...staff,
                                            status: 'En Route Eq',
                                            location: call.location,
                                            originalPost: staff.location || 'Unknown',
                                            log: [...(staff.log || []), teamLogEntry]
                                          }
                                        : staff
                                    );

                                    const updatedCalls = event.calls.map((c) =>
                                      c.id === call.id ? updatedCall : c
                                    );

                                    await updateEvent({
                                      calls: updatedCalls,
                                      staff: updatedStaff,
                                      eventEquipment: updatedEquipment
                                    });
                                  }}
                                  className={`hover:bg-surface-liner focus:bg-surface-liner cursor-pointer ${
                                    isBreakOrClinic ? 'bg-status-blue/20 text-surface-light' : 'text-surface-light'
                                  }`}
                                >
                                  {t.team} {isBreakOrClinic && `(${t.status})`}
                                </DropdownMenuItem>
                              );
                            })
                          ) : (
                            <DropdownMenuItem disabled className="text-surface-faint">
                              No teams available
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ))
                  ) : (
                    <DropdownMenuItem disabled className="text-surface-faint">
                      No available equipment
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </Dropdownmenu>
        </div>

        {/* Expanded section: Notes and Log */}
        {expanded && (
          <div className="pt-3 border-t border-surface-liner space-y-3" onClick={e => e.stopPropagation()}>
            {call.priority && (
              <div className="bg-status-red text-surface-light p-2 rounded">
                ⚠️ PRIORITY CALL: Life threat to patient/provider
              </div>
            )}

            {/* Notes - NO LOG ENTRY */}
            <div className="text-sm text-surface-light">
              <div className="font-semibold mb-1">Notes</div>
              <Textarea
                value={notesText}
                onChange={(e) => {
                  setNotesText(e.target.value);
                }}
                onBlur={async () => {
                  notesFocusedRef.current = false;
                  const text = notesText;
                  if ((call.notes || '') !== text) {
                    const updatedCall = { ...call, notes: text };
                    const updated = event.calls.map((c: Call) => 
                      c.id === call.id ? updatedCall : c
                    );
                    await updateEvent({ calls: updated });
                  }
                }}
                onFocus={() => {
                  notesFocusedRef.current = true;
                }}
                minRows={2}
                variant="flat"
                placeholder="Add notes"
                className="min-w-0"
                classNames={{
                  input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0",
                  inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep group-data-[focus-visible=true]:bg-surface-deep group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 focus-within:ring-0"
                }}
              />
            </div>

            {/* Log - Editable Textarea */}
            <div className="text-sm text-surface-light">
              <div className="font-semibold mb-1">Log for Call #{callDisplayNumber}:</div>
              <Textarea
                value={logText}
                onChange={(e) => {
                  setLogText(e.target.value);
                }}
                onBlur={async () => {
                  logFocusedRef.current = false;
                  const text = logText;
                  
                  // Convert text back to log entries
                  const lines = text.split('\n').filter(line => line.trim());
                  const newLog = lines.map(line => ({
                    timestamp: Date.now(),
                    message: line
                  }));
                  
                  const updatedCall = { ...call, log: newLog };
                  const updated = event.calls.map((c: Call) => 
                    c.id === call.id ? updatedCall : c
                  );
                  await updateEvent({ calls: updated });
                }}
                onFocus={() => {
                  logFocusedRef.current = true;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const now = new Date();
                    const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                    setLogText(prev => prev + `\n${hhmm} - `);
                  }
                }}
                minRows={4}
                variant="flat"
                placeholder="No log entries"
                className="min-w-0"
                classNames={{
                  input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0 text-sm",
                  inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep group-data-[focus-visible=true]:bg-surface-deep group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 focus-within:ring-0"
                }}
              />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
