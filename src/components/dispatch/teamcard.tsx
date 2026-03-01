// teamcard.tsx — REPLACE component export with this version
'use client';

import React, {useEffect, useMemo, useState, useRef} from 'react';
import {
  Card, CardHeader, CardBody, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Select, SelectItem, Autocomplete, AutocompleteItem, Textarea
} from '@heroui/react';
import {MoreVertical} from 'lucide-react';
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

function getLeadNameCert(staff: Staff) {
  const isSupervisor =
    Array.isArray(staff.members) &&
    staff.members.length === 1 &&
    typeof staff.members[0] === 'string' &&
    !staff.members[0].includes('(Lead)');

  if (isSupervisor) {
    const m = staff.members?.[0] ?? '';
    const rx = m.match(/^(.+?)\s\[(.+?)\]/);
    return { name: rx?.[1] ?? m, cert: rx?.[2] ?? '' };
  }
  const lead = (staff.members || []).find(m => typeof m === 'string' && m.includes('(Lead)')) || '';
  const rx = lead.match(/^(.+?)\s\[(.+?)\]/);
  return { name: rx?.[1] ?? 'No Lead', cert: rx?.[2] ?? '' };
}

function teamBg(status: string, event: Event, team: string) {
  // Check if team is assisting with equipment (orange)
  const onEqRun =
    !!event.calls?.some(c =>
      c.equipmentTeams?.includes(team) && !['Resolved','Delivered','Delivered Eq','Refusal','NMM'].includes(c.status)
    ) || ['En Route Eq', 'Assisting'].includes(status);
  
  if (onEqRun) return 'bg-status-orange/15';
  
  // Check if team is on active patient care call (red)
  const activeCare =
    !!event.calls?.some(c =>
      c.assignedTeam?.includes(team) && !['Resolved','Delivered','Delivered Eq','Refusal','NMM'].includes(c.status)
    );
  
  if (activeCare) return 'bg-[#2d2123]';
  
  if (['On Break','In Clinic'].includes(status)) return 'bg-status-blue/20';
  
  return 'bg-surface-deep';
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
  const {name, cert} = useMemo(() => getLeadNameCert(staff), [staff]);
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

  const bg = teamBg(staff.status, event, staff.team);

  return (
    <Card
      // No outside border; unified bg for header + body
      className={`rounded-2xl shadow-sm border-0 ${bg}`}
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
          <div className="text-xs text-surface-faint truncate">
            {name} {cert ? `[${cert}]` : ''}
          </div>
        </div>

        {/* Right section: Timer and Menu aligned horizontally at top */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
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
        <div className="grid grid-cols-5 gap-3">
          {/* Status */}
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="col-span-2">
            <Select
              aria-label="Status"
              label="Status"
              labelPlacement="inside"
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
                trigger: 'bg-surface-deep text-surface-light border border-surface-liner'
              }}
            >
              {statusOptions.map((s) => (
                <SelectItem key={s}>{s}</SelectItem>
              ))}
            </Select>
          </div>
          {/* Location */}
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="col-span-3">
            <Autocomplete
              aria-label="Location"
              label="Location"
              labelPlacement="inside"
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
                  inputWrapper: 'bg-surface-deep text-surface-light border border-surface-liner group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 data-[focus-visible=true]:ring-0 data-[focus-visible=true]:ring-offset-0 focus-within:ring-0 focus:ring-0',
                  input: 'bg-surface-deep data-[focus-visible=true]:ring-0 focus:ring-0 focus-visible:ring-0 outline-none focus:outline-none data-[focus=true]:outline-none'
                }
              }}
            >
              {postOptions.map(p => (
                <AutocompleteItem key={p}>{p}</AutocompleteItem>
              ))}
            </Autocomplete>
          </div>
        </div>

        {/* Expanded section — same bg, no border, no extra spacing from header */}
        {expanded && (
          <div className="mt-3" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-surface-light mb-2">Activity Log</div>
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
        )}
      </CardBody>
    </Card>
  );
}
