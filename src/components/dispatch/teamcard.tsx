// teamcard.tsx — REPLACE component export with this version
'use client';

import React, {useEffect, useMemo, useState, useRef} from 'react';
import {
  Card, CardHeader, CardBody, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Select, SelectItem, Autocomplete, AutocompleteItem, Textarea
} from '@heroui/react';
import {ChevronDown, ChevronUp, MapPin, MoreVertical} from 'lucide-react';
import type {Event, Staff} from '@/app/types';

type TeamCardProps = {
  staff: Staff;
  event: Event;
  sinceMs?: number;
  onStatusChange: (staff: Staff, newStatus: string) => void;
  onLocationChange: (staff: Staff, newLocation: string) => void;
  onEdit?: (staff: Staff) => void;
  onDelete?: (teamName: string) => void;
  onRefreshPost?: (teamName: string) => void;
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

function formatMemberLine(member: string) {
  const isLead = member.includes('(Lead)');
  const withoutLead = member.replace(/\s*\(Lead\)\s*/g, '').trim();
  const certMatches = [...withoutLead.matchAll(/\[(.+?)\]/g)].map(match => match[1]).filter(Boolean);
  const name = withoutLead.replace(/\s*\[.+?\]/g, '').trim();
  const certText = certMatches.map(cert => `[${cert}]`).join(' ');
  const leadText = isLead ? ' [Lead]' : '';
  return `${name}${certText ? ` ${certText}` : ''}${leadText}`.trim();
}

function teamStatusTone(status: string, event: Event, team: string) {
  // Check if team is assisting with equipment (orange)
  const onEqRun =
    !!event.calls?.some(c =>
      c.equipmentTeams?.includes(team) && !['Resolved','Delivered','Delivered Eq','Refusal','NMM'].includes(c.status)
    ) || ['En Route Eq', 'Assisting'].includes(status);
  
  if (onEqRun) {
    return {
      borderClass: 'border-status-card-yellow',
      fillClass: 'bg-status-card-yellow/20'
    };
  }
  
  // Check if team is on active patient care call (red)
  const activeCare =
    !!event.calls?.some(c =>
      c.assignedTeam?.includes(team) && !['Resolved','Delivered','Delivered Eq','Refusal','NMM'].includes(c.status)
    );
  
  if (activeCare) {
    return {
      borderClass: 'border-status-card-red',
      fillClass: 'bg-status-card-red/20'
    };
  }
  
  if (['On Break','In Clinic'].includes(status)) {
    return {
      borderClass: 'border-status-card-blue',
      fillClass: 'bg-status-card-blue/20'
    };
  }
  
  return {
    borderClass: 'border-surface-liner',
    fillClass: 'bg-surface-liner/30'
  };
}

export default function TeamCard({
  staff, event, sinceMs,
  onStatusChange, onLocationChange,
  onEdit, onDelete, onRefreshPost, updateEvent
}: TeamCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Persistent local state for log text — never goes null to prevent flicker
  const [logText, setLogText] = useState(() => {
    if (staff.log && staff.log.length > 0) {
      return staff.log.map(entry => entry.message).join('\n');
    }
    return '';
  });
  const logFocusedRef = useRef(false);
  const lastValidLocation = useRef<string | undefined>(undefined);
  // Sync log text from props when not focused (prevents overwriting user edits)
  useEffect(() => {
    if (!logFocusedRef.current) {
      const newText = staff.log && staff.log.length > 0
        ? staff.log.map(entry => entry.message).join('\n')
        : '';
      setLogText(newText);
    }
  }, [staff.log]);
  useEffect(() => {
    if (staff.location && staff.location !== 'Clinic') {
      lastValidLocation.current = staff.location;
    }
  }, [staff.location]);
  const [locationInput, setLocationInput] = useState(staff.location || '');
  useEffect(() => {
    setLocationInput(staff.location || '');
  }, [staff.location]);
  const memberLines = useMemo(() => {
    const members = Array.isArray(staff.members) ? staff.members : [];
    return members
      .filter((member): member is string => typeof member === 'string' && member.trim().length > 0)
      .map(formatMemberLine);
  }, [staff.members]);
  const timer = useMMSS(sinceMs);

  // Status options
  const isOnAnyActiveCall = !!event.calls?.some(c =>
    c.assignedTeam?.includes(staff.team) && !['Resolved','Delivered','Refusal','NMM'].includes(c.status)
  );

  const isOnEq = !!event.calls?.some(c => 
    c.equipmentTeams?.includes(staff.team) && !['Resolved','Delivered Eq','Refusal','NMM'].includes(c.status)
  ) || ['En Route Eq', 'Assisting'].includes(staff.status);

  const statusOptions = isOnEq
    ? ['En Route Eq', 'Assisting', 'Delivered Eq']
    : isOnAnyActiveCall
      ? ['En Route', 'On Scene', 'Transporting']
      : ['Available', 'On Break', 'In Clinic'];

  const postOptions: string[] = React.useMemo(() => {
    const base: string[] = ['Clinic']; // Only Clinic, not Transporting
    const posts = (event.venue?.posts || []).map(p => (typeof p === 'string' ? p : p.name));
    return Array.from(new Set([...base, ...posts]));
  }, [event.venue?.posts]);

  const statusTone = teamStatusTone(staff.status, event, staff.team);

  return (
    <Card
      // Closed cards are transparent/sharp; open cards retain active dark shell.
      className={`dispatch-shell-card ${expanded ? 'dispatch-shell-card--open' : ''} w-full border-0 transition-colors duration-200 ${expanded ? 'rounded-2xl bg-surface-deep shadow-sm' : 'rounded-none bg-transparent shadow-none hover:bg-surface-deep'}`}
    >
      {/* HEADER (click to toggle). Not a <button>, so no nested <button> issues */}
      <CardHeader
        onClick={() => setExpanded(v => !v)}
        className="relative flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none"
      >
        <div className="min-w-0">
          <div className="text-[15px] sm:text-base font-semibold text-surface-light truncate">
            {staff.team}
          </div>
        </div>

        {/* Right section: Timer and Menu aligned horizontally at top */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="text-surface-light/70">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>

          {/* Timer */}
          <div className="text-[15px] sm:text-base font-semibold text-surface-light tabular-nums">
            {timer}
          </div>

          {/* 3-dot menu - native button with no background effects */}
          <div
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            <Dropdown placement="bottom-end" offset={6}>
              <DropdownTrigger>
                <button
                  className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Team actions"
                  type="button"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownTrigger>
            <DropdownMenu
              aria-label="Team actions"
              itemClasses={{ base: 'px-3 py-2 text-sm text-surface-light rounded-xl' }}
              onAction={(key) => {
                if (key === 'refresh') onRefreshPost?.(staff.team);
                if (key === 'edit') onEdit?.(staff);
                if (key === 'delete') onDelete?.(staff.team);
              }}
            >
              <DropdownItem key="refresh">Refresh Post</DropdownItem>
              <DropdownItem key="edit">Edit</DropdownItem>
              <DropdownItem key="delete" className="text-status-red">Delete</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
        </div>
      </CardHeader>

      {/* BODY (collapsed/expanded). Same bg, no extra borders, no extra gap */}
      <CardBody className="px-4 pb-3 pt-0">
        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Status */}
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="min-w-0 flex-[1]">
            <Select
              aria-label="Status"
              selectedKeys={new Set([staff.status ?? ''])}
              onSelectionChange={(keys) => {
                const val = Array.from(keys as Set<string>)[0] || '';
                if (val) {
                  if (val === 'Available') {
                    const targetLocation = 
                      staff.originalPost || 
                      event.pendingAssignments?.[staff.team]?.post || 
                      lastValidLocation.current;

                    if (targetLocation && targetLocation !== staff.location) {
                      onLocationChange(staff, targetLocation);
                    } else if (staff.location === 'Clinic') {
                      onLocationChange(staff, ''); 
                    }
                  }
                  onStatusChange(staff, val);
                }
              }}
              classNames={{
                base: 'min-w-0',
                trigger: `${statusTone.fillClass} text-surface-light border ${statusTone.borderClass} rounded-full transition-colors`
              }}
            >
              {statusOptions.map((s) => (
                <SelectItem key={s}>{s}</SelectItem>
              ))}
            </Select>
          </div>
          {/* Location */}
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="min-w-0 flex-[1.5]">
            <Autocomplete
              aria-label="Location"
              startContent={<MapPin className="h-4 w-4 text-surface-faint" />}
              inputValue={locationInput}
              onInputChange={(val) => {
                // Update local state as user types - makes it editable
                setLocationInput(val);
              }}
              onSelectionChange={(key) => {
                // Handle dropdown selection - updates immediately
                if (key) {
                  onLocationChange(staff, key as string);
                }
              }}
              onKeyDown={(e) => {
                // Handle Enter key for custom values
                if (e.key === 'Enter') {
                  const value = locationInput.trim();
                  if (value && value !== staff.location) {
                    onLocationChange(staff, value);
                  }
                }
              }}
              onBlur={() => {
                // Handle clicking away for custom values
                const value = locationInput.trim();
                if (value && value !== staff.location) {
                  onLocationChange(staff, value);
                } else if (!value) {
                  // If cleared, update parent
                  onLocationChange(staff, '');
                }
              }}
              allowsCustomValue
              className="min-w-0"
              classNames={{
                base: 'min-w-0 data-[focus-visible=true]:outline-none data-[focus=true]:outline-none',
              }}
              inputProps={{
                classNames: {
                  inputWrapper: 'bg-surface-deep text-surface-light border border-surface-liner rounded-full pl-3 group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 data-[focus-visible=true]:ring-0 data-[focus-visible=true]:ring-offset-0 focus-within:ring-0 focus:ring-0',
                  input: 'bg-surface-deep pl-1 data-[focus-visible=true]:ring-0 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none data-[focus=true]:outline-none'
                }
              }}
            >
              {postOptions.map(p => (
                <AutocompleteItem key={p}>{p}</AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
        </div>

        {/* Expanded section — animated in normal flow */}
        <div className={`dispatch-expand-grid ${expanded ? 'dispatch-expand-grid--open' : ''}`}>
          <div className="dispatch-expand-inner">
            <div
              className={`mt-3 dispatch-expand-fade ${expanded ? 'dispatch-expand-fade--open pointer-events-auto' : 'pointer-events-none'}`}
              onClick={e => e.stopPropagation()}
              aria-hidden={!expanded}
            >
            <div className="text-xs font-bold text-surface-light mb-1">Team</div>
            <div className="space-y-1 mb-3">
              {memberLines.map((line, index) => (
                <div key={`${staff.team}-member-${index}`} className="text-xs text-surface-faint truncate">
                  {line}
                </div>
              ))}
              {memberLines.length === 0 && (
                <div className="text-xs text-surface-faint italic">No members</div>
              )}
            </div>

            <div className="text-xs font-bold text-surface-light mb-1">Activity Log</div>
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
                
                const updatedStaff = event.staff.map(s => 
                  s.team === staff.team ? { ...s, log: newLog } : s
                );
                await updateEvent({ staff: updatedStaff });
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
        </div>
      </CardBody>
    </Card>
  );
}
