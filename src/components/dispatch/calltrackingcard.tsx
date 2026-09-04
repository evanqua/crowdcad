// calltrackingcard.tsx
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Card, CardHeader, CardBody, Input, Chip, Button,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Autocomplete, AutocompleteItem
} from '@heroui/react';
import { Plus, MoreVertical, RotateCw } from 'lucide-react';
import {
  Dropdownmenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Event, Call, DetachedTeam } from '@/app/types';
import TrackingTextEntry from '@/components/dispatch/trackingtextentry';
import DispatchMotionCell from '@/components/dispatch/motioncell';
import StatusLabel, { getMenuLabel } from '@/components/dispatch/statuslabel';
import EquipmentTypeIcon, { getEquipmentStatusWord } from '@/components/dispatch/equipmenttypeicon';
import { useDispatchTerms } from '@/lib/dispatchVocabulary/context';
import { getEventClinics, getTransportingLabel, getDeliveredLabel, isCallResolved, getVenueLocationOptions } from '@/lib/clinics';
import { getEquipmentIconType } from '@/lib/equipmentIcon';
import { getStatusColor } from '@/lib/statusColors';
import { useMMSS } from '@/hooks/useMMSS';

type CallTrackingCardProps = {
  call: Call;
  callDisplayNumber: number;
  event: Event;
  onLocationChange: (callId: string, newLocation: string) => void;
  onAgeSexChange: (callId: string, ageSex: string) => void;
  onChiefComplaintChange: (callId: string, chiefComplaint: string) => void;
  onRemoveTeamFromCall: (callId: string, team: string) => Promise<void>;
  onAddTeamToCall: (callId: string, team: string) => Promise<void>;
  handleTeamStatusChange: (callId: string, team: string, newStatus: string, clinicId?: string) => void;
  onTransportToAmbulance: (callId: string, team: string) => void;
  handleRevertDetachment: (callId: string, team: string) => void;
  handleMarkDuplicate: (callId: string) => void;
  handleTogglePriority: (callId: string) => void;
  handleDeleteCall: (callId: string) => void;
  formatAgeSex: (age?: string | number, gender?: string) => string;
  teamStatusMap: { [callId: string]: { [team: string]: string } };
  updateEvent: (updates: Partial<Event>) => Promise<void>;
};

const dropdownMotionProps = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
  transition: { duration: 0.16, ease: 'easeOut' },
} as const;

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
  onTransportToAmbulance,
  handleRevertDetachment,
  handleMarkDuplicate,
  handleTogglePriority,
  handleDeleteCall,
  formatAgeSex,
  teamStatusMap,
  updateEvent,
}: CallTrackingCardProps) {
  const { t } = useDispatchTerms();
  const clinics = getEventClinics(event.clinics);
  const isResolved = isCallResolved(call);
  const [clinicPickTeam, setClinicPickTeam] = useState<string | null>(null);
  // Which status opened the clinic picker — 'Transporting' or 'Delivered',
  // both of which need a destination clinic recorded when more than one exists.
  const [clinicPickStatus, setClinicPickStatus] = useState<string>('Transporting');
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

  // Detached-team pill label — 'Delivered' gets the same clinic-name
  // decoration (and icon-suppression once a real name is shown) as the
  // active Transporting pill above; every other reason is a plain
  // status label.
  const renderDetachedReason = (reason: string) => {
    if (reason === 'Delivered') {
      const { text, showIcon } = getDeliveredLabel(t, clinics, call.clinicId);
      return <StatusLabel status="Delivered" text={text} showIcon={showIcon} />;
    }
    return <StatusLabel status={reason} text={t(reason)} />;
  };

  const locationOptions = useMemo(() => getVenueLocationOptions(event.venue), [event.venue]);

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
    <Card
      className={`dispatch-shell-card ${expanded ? 'dispatch-shell-card--open' : ''} w-full border-0 transition-colors duration-200 ${expanded ? 'rounded-lg bg-surface-deep shadow-sm' : 'rounded-none bg-transparent shadow-none hover:bg-surface-deep'}`}
    >
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
            <Dropdown motionProps={dropdownMotionProps} placement="bottom-end" offset={6}>
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
                  {expanded ? t('Hide Log') : t('Show Log')}
                </DropdownItem>
                <DropdownItem
                  key="duplicate"
                  onPress={() => handleMarkDuplicate(call.id)}
                >
                  {t('Mark as Duplicate')}
                </DropdownItem>
                <DropdownItem
                  key="priority"
                  onPress={() => handleTogglePriority(call.id)}
                >
                  {call.priority ? t('Remove Priority') : t('Mark as Priority')}
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
                  {t('Delete Call')}
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
          <Autocomplete
            aria-label="Location"
            label="Location"
            labelPlacement="inside"
            inputValue={locationInput}
            onInputChange={(v) => setLocationInput(v)}
            onSelectionChange={(key) => {
              if (key) onLocationChange(call.id, key as string);
            }}
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
            allowsCustomValue
            variant="flat"
            inputProps={{
              classNames: {
                input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none",
                inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep"
              }
            }}
            className="flex-1"
          >
            {locationOptions.map((loc) => (
              <AutocompleteItem key={loc}>{loc}</AutocompleteItem>
            ))}
          </Autocomplete>
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
              : ['En Route', 'On Scene', 'Unable to Locate', 'Transporting', 'Pending Transport', 'Rolled from Scene', 'Delivered', 'Refusal', 'NMM', 'Detached'];
            
            // Same resolution desktop's CallTrackingTable uses: a per-call
            // override (teamStatusMap) takes priority over the team's own
            // current status, so the pill reflects and resets exactly like
            // the real call does.
            const currentStatus = teamStatusMap[call.id]?.[team] || event?.staff.find(s => s.team === team)?.status || 'En Route';
            const teamStatusColor = getStatusColor(currentStatus);
            const transportingLabel = currentStatus === 'Transporting' ? getTransportingLabel(t, clinics, call.clinicId) : null;

            // Equipment this team is actually running — used to swap the
            // pill's "Eq" suffix for the matching map icon, and to name the
            // specific item in the dropdown options and the activity log.
            const teamEquipment = isEquipmentOnlyTeam
              ? (event.eventEquipment || []).filter(eq => eq.assignedTeam === team)
              : [];
            const teamEquipmentNames = teamEquipment.map(eq => eq.name).join(', ');
            const teamEquipmentIconType = teamEquipment[0] ? getEquipmentIconType(teamEquipment[0].name) : null;
            const isEqStatus = currentStatus === 'Delivered Eq' || currentStatus === 'En Route Eq';

            return (
              <Chip
                key={team}
                size="lg"
                variant="flat"
                color="default"
                className={`text-surface-light h-9 ${teamStatusColor.chipClass}`}
                onClose={() => onRemoveTeamFromCall(call.id, team)}
              >
                <div className="flex items-center gap-2" data-testid={`team-chip-${team}`}>
                  <span className="font-medium">{team}</span>
                  {clinicPickTeam === team ? (
                    <Dropdown
                      motionProps={dropdownMotionProps}
                      placement="bottom-end"
                      offset={2}
                      isOpen
                      onOpenChange={(isOpen) => {
                        if (!isOpen) setClinicPickTeam(null);
                      }}
                    >
                      <DropdownTrigger>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-surface-faint hover:text-surface-light transition-colors"
                        >
                          {t('Select clinic')} ▼
                        </button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Select destination clinic"
                        onAction={(key) => {
                          setClinicPickTeam(null);
                          handleTeamStatusChange(call.id, team, clinicPickStatus, key as string);
                        }}
                      >
                        {clinics.map((clinic) => (
                          <DropdownItem key={clinic.id}>{clinic.name}</DropdownItem>
                        ))}
                      </DropdownMenu>
                    </Dropdown>
                  ) : (
                    <Dropdown motionProps={dropdownMotionProps} placement="bottom-end" offset={2}>
                      <DropdownTrigger>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="text-xs text-surface-faint hover:text-surface-light transition-colors"
                        >
                          {isEqStatus && teamEquipmentIconType ? (
                            <span className="inline-flex items-center gap-1">
                              <span>{getEquipmentStatusWord(currentStatus)}</span>
                              <EquipmentTypeIcon type={teamEquipmentIconType} />
                            </span>
                          ) : (
                            <StatusLabel
                              status={currentStatus}
                              text={transportingLabel ? transportingLabel.text : t(currentStatus)}
                              showIcon={transportingLabel ? transportingLabel.showIcon : true}
                            />
                          )} ▼
                        </button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Team Status"
                        onAction={(key) => {
                          if ((key === 'Transporting' || key === 'Delivered') && clinics.length > 1) {
                            setClinicPickTeam(team);
                            setClinicPickStatus(key as string);
                            return;
                          }
                          if (key === 'Rolled from Scene') {
                            onTransportToAmbulance(call.id, team);
                            return;
                          }
                          handleTeamStatusChange(call.id, team, key as string, (key === 'Transporting' || key === 'Delivered') ? clinics[0]?.id : undefined);
                        }}
                      >
                        {statusOptions.map(status => (
                          <DropdownItem key={status}>
                            {(status === 'Delivered Eq' || status === 'En Route Eq') && teamEquipmentNames
                              ? `${getEquipmentStatusWord(status)} ${teamEquipmentNames}`
                              : getMenuLabel(status, t)}
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    </Dropdown>
                  )}
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
              color="default"
              className={`h-9 ${getStatusColor(detachedTeam.reason).chipClass}`}
              onClose={() => handleRevertDetachment(call.id, detachedTeam.team)}
              endContent={<RotateCw className="w-3.5 h-3.5" aria-label={t('Reopen Call')} />}
            >
              <span className="text-surface-light font-medium mr-2">
                {detachedTeam.team}
              </span>
              <Button
                size="sm"
                radius="full"
                variant="light"
                isDisabled
                className="min-w-0 h-6 px-2 text-xs shrink-0 opacity-100 cursor-default"
              >
                {renderDetachedReason(detachedTeam.reason)}
              </Button>
            </Chip>
          ))}

          {/* Add Team Button — disabled once the call is resolved (delivered,
              refusal, nmm, unable to locate, transferred to ambulance); only
              reopening it via handleRevertDetachment re-enables this. */}
          <Dropdownmenu>
            <DropdownMenuTrigger asChild>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                aria-label="Add"
                isDisabled={isResolved}
                className="w-8 h-8 rounded-full hover:bg-surface-liner"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-surface-deep border-surface-liner text-surface-light">
              {/* Add Team Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                  {t('Add Team')}
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
                            isBreakOrClinic ? 'bg-status-card-blue text-surface-light' : 'text-surface-light'
                          }`}
                        >
                          {s.team} {isBreakOrClinic && `(${t(s.status)})`}
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled className="text-surface-faint">
                      {t('No available teams')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Add Supervisor Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                  {t('Add Supervisor')}
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
                            isBreakOrClinic ? 'bg-status-card-blue text-surface-light' : 'text-surface-light'
                          }`}
                        >
                          {s.team} {isBreakOrClinic && `(${t(s.status)})`}
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <DropdownMenuItem disabled className="text-surface-faint">
                      {t('No available supervisors')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Add Equipment Submenu - with team selection */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-surface-liner focus:bg-surface-liner cursor-pointer">
                  {t('Add Equipment')}
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
                                    isBreakOrClinic ? 'bg-status-card-blue text-surface-light' : 'text-surface-light'
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
                      {t('No available equipment')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </Dropdownmenu>
        </div>

        {/* Expanded section: Notes and Log */}
        <DispatchMotionCell isOpen={expanded} animate overflowVisibleWhenOpen>
          <div
            className="pt-3 border-t border-surface-liner space-y-3"
            onClick={e => e.stopPropagation()}
            aria-hidden={!expanded}
          >
            {call.priority && (
              <div className="bg-status-red text-surface-light p-2 rounded">
                ⚠️ PRIORITY CALL: Life threat to patient/provider
              </div>
            )}

            {/* Notes - NO LOG ENTRY */}
            <div className="text-sm text-surface-light">
              <div className="font-semibold mb-1">Notes</div>
              <TrackingTextEntry
                mode="note"
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
                maxRows={3}
                variant="flat"
                placeholder="Add notes"
                className="min-w-0"
              />
            </div>

            {/* Log - Editable Textarea */}
            <div className="text-sm text-surface-light">
              <div className="font-semibold mb-1">Log for Call #{callDisplayNumber}:</div>
              <TrackingTextEntry
                mode="log"
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
                maxRows={5}
                variant="flat"
                placeholder="No log entries"
                className="min-w-0"
              />
            </div>
          </div>
        </DispatchMotionCell>
      </CardBody>
    </Card>
  );
}
