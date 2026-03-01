// clinictrackingcard.tsx
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Card, CardHeader, CardBody, Input, Button,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Textarea
} from '@heroui/react';
import { MoreVertical } from 'lucide-react';
import type { Event, Call } from '@/app/types';

type ClinicTrackingCardProps = {
  call: Call;
  callDisplayNumber: number;
  event: Event;
  onLocationChange: (callId: string, newLocation: string) => void;
  onAgeSexChange: (callId: string, ageSex: string) => void;
  onChiefComplaintChange: (callId: string, chiefComplaint: string) => void;
  onOutcomeChange: (callId: string, outcome: string) => void;
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

function callBg(call: Call) {
  // Clinic calls always use default background
  return 'bg-surface-deep';
}

export default function ClinicTrackingCard({
  call,
  callDisplayNumber,
  event,
  onLocationChange,
  onAgeSexChange,
  onChiefComplaintChange,
  onOutcomeChange,
  handleDeleteCall,
  formatAgeSex,
  getCallRowClass,
  updateEvent,
}: ClinicTrackingCardProps) {
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
  const bg = callBg(call);

  // Get primary team (first assigned team or first detached team)
  const primaryTeam = useMemo(() => {
    if (call.assignedTeam && call.assignedTeam.length > 0) {
      return Array.isArray(call.assignedTeam) ? call.assignedTeam[0] : call.assignedTeam;
    }
    if (call.detachedTeams && call.detachedTeams.length > 0) {
      return call.detachedTeams[0].team;
    }
    return 'Walkup';
  }, [call.assignedTeam, call.detachedTeams]);

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
              inputWrapper: "bg-surface-deep shadow-none hover:bg-surface-deep group-data-[focus=true]:bg-surface-deep border border-surface-liner"
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

        {/* Row 3: Status (left half) + Primary Team (right half) */}
        <div className="flex gap-2">
          {/* Status Dropdown */}
          <div className="flex-1" onClick={e => e.stopPropagation()}>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  radius="md"
                  className="w-full h-full justify-start bg-surface-deep border border-surface-liner hover:bg-surface-muted text-white px-2"
                >
                  <div className="text-left flex-4 pl-0.5">
                    <div className="text-xs text-[#d4d4d8] pb-0.5">Status</div>
                    <div className="text-sm">{call.outcome || 'In Clinic'}</div>
                  </div>
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Clinic Status"
                onAction={(key) => onOutcomeChange(call.id, key as string)}
              >
                <DropdownItem key="In Clinic">In Clinic</DropdownItem>
                <DropdownItem key="Transported">Transported</DropdownItem>
                <DropdownItem key="AMA">AMA</DropdownItem>
                <DropdownItem key="Discharged">Discharged</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>

          {/* Primary Team (read-only) */}
          <div className="flex-1">
            <div className="h-full px-2.5 py-2 bg-surface-deep border border-surface-liner rounded-xl flex flex-col justify-center">
              <div className="text-xs text-[#d4d4d8] mb-0.5">Primary Team</div>
              <div className="text-sm">{primaryTeam}</div>
            </div>
          </div>
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
