// teamcard-condensed.tsx — Compact version of teamcard
'use client';

import React, {useEffect, useMemo, useState, useRef} from 'react';
import {
  Card, CardHeader, CardBody, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Select, SelectItem, Autocomplete, AutocompleteItem, Textarea
} from '@heroui/react';
import {MoreVertical} from 'lucide-react';
import type {Event, Staff} from '@/app/types';

type TeamCardCondensedProps = {
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

export default function TeamCardCondensed({
  staff, event, sinceMs,
  onStatusChange, onLocationChange,
  onEdit, onDelete, onRefreshPost, updateEvent
}: TeamCardCondensedProps) {
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
    const base: string[] = ['Clinic'];
    const posts = (event.venue?.posts || []).map(p => (typeof p === 'string' ? p : p.name));
    return Array.from(new Set([...base, ...posts]));
  }, [event.venue?.posts]);

  const bg = teamBg(staff.status, event, staff.team);

  // Get all members for display
  const allMembers = useMemo(() => {
    if (!staff.members || staff.members.length === 0) return [];
    return staff.members.map(m => {
      if (typeof m === 'string') {
        const rx = m.match(/^(.+?)\s\[(.+?)\](?:\s\(Lead\))?/);
        const name = rx?.[1] ?? m.replace(/\s\(Lead\)/, '');
        const cert = rx?.[2] ?? '';
        const isLead = m.includes('(Lead)');
        return { name, cert, isLead };
      }
      return { name: '', cert: '', isLead: false };
    });
  }, [staff.members]);

  return (
    <Card className={`rounded-xl shadow-sm border-0 ${bg}`}>
      {/* COLLAPSED HEADER - Single compact line */}
      <CardHeader
        onClick={() => setExpanded(v => !v)}
        className="relative flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Team name */}
          <span className="text-sm font-semibold text-surface-light truncate">
            {staff.team}
          </span>
          {/* Location as plain text */}
          <span className="text-sm text-surface-faint truncate">
            {staff.location || 'No location'}
          </span>
        </div>

        {/* Three dots menu */}
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
      </CardHeader>

      {/* EXPANDED BODY */}
      {expanded && (
        <CardBody className="px-3 pb-3 pt-0 space-y-3">
          {/* Status and Location controls */}
          <div className="grid grid-cols-5 gap-2">
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
                  setLocationInput(val);
                }}
                onSelectionChange={(key) => {
                  if (key) {
                    onLocationChange(staff, key as string);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = locationInput.trim();
                    if (value && value !== staff.location) {
                      onLocationChange(staff, value);
                    }
                  }
                }}
                onBlur={() => {
                  const value = locationInput.trim();
                  if (value && value !== staff.location) {
                    onLocationChange(staff, value);
                  } else if (!value) {
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

          {/* Team members and timer row */}
          <div className="flex items-start justify-between gap-3">
            {/* Members on left */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-surface-light mb-1">Team Members</div>
              <div className="space-y-0.5">
                {allMembers.map((member, idx) => (
                  <div key={idx} className="text-xs text-surface-faint truncate">
                    {member.name} {member.cert ? `[${member.cert}]` : ''} {member.isLead ? '(Lead)' : ''}
                  </div>
                ))}
                {allMembers.length === 0 && (
                  <div className="text-xs text-surface-faint italic">No members</div>
                )}
              </div>
            </div>
            
            {/* Timer on right */}
            <div className="flex-shrink-0">
              <div className="text-xs font-semibold text-surface-light mb-1">Timer</div>
              <div className="text-base font-semibold text-surface-light tabular-nums">
                {timer}
              </div>
            </div>
          </div>

          {/* Activity log */}
          <div onClick={e => e.stopPropagation()}>
            <div className="text-xs font-semibold text-surface-light mb-1">Activity Log</div>
            <Textarea
              value={logText}
              onChange={(e) => {
                setLogText(e.target.value);
              }}
              onBlur={async () => {
                logFocusedRef.current = false;
                const text = logText;
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
              minRows={3}
              variant="flat"
              placeholder="No log entries"
              className="min-w-0"
              classNames={{
                input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0 text-xs",
                inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep group-data-[focus-visible=true]:bg-surface-deep group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 focus-within:ring-0"
              }}
            />
          </div>
        </CardBody>
      )}
    </Card>
  );
}
