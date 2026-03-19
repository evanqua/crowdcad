// equipmentcard.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Card, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Select, SelectItem, Autocomplete, AutocompleteItem, Textarea
} from '@heroui/react';
import { MoreVertical } from 'lucide-react';
import type { Event, EquipmentItem } from '@/app/types';

type EquipmentCardProps = {
  equipment: EquipmentItem;
  event: Event;
  onStatusChange: (equipmentName: string, newStatus: string) => void;
  onLocationChange: (equipmentName: string, newLocation: string) => void;
  onMarkReady?: (equipmentName: string) => void;
  onDelete?: (equipmentName: string) => void;
  updateEvent: (updates: Partial<Event>) => Promise<void>;
};

function equipmentBg(status: string) {
  if (status === 'In Clinic') return 'bg-status-blue/20';
  if (status.startsWith('Call ') || status === 'In Use') return 'bg-[#2d2123]';
  return 'bg-surface-deep';
}

export default function EquipmentCard({
  equipment,
  event,
  onStatusChange,
  onLocationChange,
  onMarkReady,
  onDelete,
  updateEvent
}: EquipmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [notesText, setNotesText] = useState(equipment.notes || '');
  const notesFocusedRef = useRef(false);

  useEffect(() => {
    if (!notesFocusedRef.current) {
      setNotesText(equipment.notes || '');
    }
  }, [equipment.notes]);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 640);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const assignedCandidate = equipment.currentLocation || equipment.deliveryTeam;
    setLocationInput(assignedCandidate || equipment.stagingLocation || '');
  }, [equipment.currentLocation, equipment.stagingLocation, equipment.deliveryTeam]);

  const isOnCall = equipment.status.startsWith('Call ');

  const statusOptions = ['Available', 'In Use', 'In Clinic'];

  const derivedSelectStatus = (() => {
    if (equipment.status === 'In Clinic') return 'In Clinic';
    const locationIsTeam = !!(equipment.currentLocation && event?.staff?.some(s => s.team === equipment.currentLocation));
    if (isOnCall || equipment.deliveryTeam || locationIsTeam || equipment.status === 'In Use') return 'In Use';
    return 'Available';
  })();

  const bg = equipmentBg(equipment.status);

  return (
    <Card
      className={`rounded-2xl shadow-sm border-0 ${bg}`}
    >
      <div
        onClick={() => setExpanded(v => !v)}
        className="relative flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none"
      >
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="font-semibold text-[15px] sm:text-base text-surface-light">{equipment.name}</div>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          >
            <Dropdown placement="bottom-end" offset={6}>
              <DropdownTrigger>
                <button
                  className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Equipment actions"
                  type="button"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Equipment actions"
                itemClasses={{ base: 'px-3 py-2 text-sm text-surface-light rounded-xl' }}
                onAction={(key) => {
                  if (key === 'ready' && equipment.needsRefresh) onMarkReady?.(equipment.name);
                  if (key === 'delete') onDelete?.(equipment.name);
                }}
              >
                {equipment.needsRefresh ? (
                  <DropdownItem key="ready">Mark Ready</DropdownItem>
                ) : null}
                <DropdownItem key="delete" className="text-status-red">Delete</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* BODY*/}
      <div className="px-4 pb-3 pt-0">
          {/* Controls row */}
          <div className="grid grid-cols-5 gap-1">
            {/* Status */}
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="col-span-2">
              <Select
                aria-label="Status"
                label="Status"
                labelPlacement="inside"
                selectedKeys={new Set([(isMobile ? derivedSelectStatus : derivedSelectStatus).trim()])}
                onSelectionChange={(keys) => {
                  const raw = Array.from(keys as Set<string>)[0] || '';
                  const val = (raw || '').trim();
                  if (val) onStatusChange(equipment.name, val);
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
                    onLocationChange(equipment.name, key as string);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = locationInput.trim();
                    if (value && value !== (equipment.currentLocation || equipment.stagingLocation)) {
                      onLocationChange(equipment.name, value);
                    }
                  }
                }}
                onBlur={() => {
                  const value = locationInput.trim();
                  if (value && value !== (equipment.currentLocation || equipment.stagingLocation)) {
                    onLocationChange(equipment.name, value);
                  } else if (!value) {
                    onLocationChange(equipment.name, equipment.stagingLocation || '');
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
                {(() => {
                  const posts = (event.venue?.posts || []).map(p => (typeof p === 'string' ? p : p.name));
                  const teams = (event.staff || []).map(s => s.team);
                  const opts = Array.from(new Set(['Clinic', ...posts, ...teams, equipment.stagingLocation].filter(Boolean)));
                  return opts.map(p => <AutocompleteItem key={p}>{p}</AutocompleteItem>);
                })()}
              </Autocomplete>
            </div>
          </div>

          {/* Expanded section */}
          {expanded && (
            <div className="mt-3" onClick={e => e.stopPropagation()}>
              <div className="text-sm font-semibold text-surface-light mb-2">Equipment Details</div>
              <div className="text-sm text-surface-light mb-2 space-y-1">
                <div>Staging Location: {equipment.stagingLocation || 'Not Set'}</div>
                {equipment.callId && <div>Call ID: {equipment.callId}</div>}
                {equipment.deliveryTeam && <div>Delivery Team: {equipment.deliveryTeam}</div>}
              </div>
              <div className="text-sm font-semibold text-surface-light mb-1">Notes</div>
              <Textarea
                value={notesText}
                onChange={(e) => {
                  setNotesText(e.target.value);
                }}
                onBlur={async () => {
                  notesFocusedRef.current = false;
                  const notes = notesText.trim();
                  
                  const updatedEquipment = event.eventEquipment?.map(eq => 
                    eq.name === equipment.name ? { ...eq, notes } : eq
                  );
                  await updateEvent({ eventEquipment: updatedEquipment });
                }}
                onFocus={() => {
                  notesFocusedRef.current = true;
                }}
                minRows={2}
                variant="flat"
                placeholder="Add notes about this equipment"
                className="min-w-0"
                classNames={{
                  input: "text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0 text-sm",
                  inputWrapper: "bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep group-data-[focus-visible=true]:bg-surface-deep group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 focus-within:ring-0"
                }}
              />
            </div>
          )}
        </div>
    </Card>
  );
}
