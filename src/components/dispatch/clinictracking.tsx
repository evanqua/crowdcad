// components/clinictracking.tsx
'use client';

import React from 'react';
import { 
  Button, 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  Textarea
} from '@heroui/react';
import { MoreVertical } from 'lucide-react';
import type { Event, Call, CallLogEntry, ClinicOutcome } from '@/app/types';
import DispatchMotionCell from './motioncell';
import TrackingTableBase from './trackingtablebase';
import { TEAM_CARD_ROW_HOVER_CLASS } from '@/lib/statusColors';

type EditableCallField = keyof Call | 'ageSex';

interface ClinicTrackingTableProps {
  event: Event;
  callDisplayNumberMap: Map<string, number>;
  showResolvedClinicCalls: boolean;
  setShowResolvedClinicCalls: (value: boolean | ((prev: boolean) => boolean)) => void;
  openClinicCallId: string | null;
  setOpenClinicCallId: (value: string | null) => void;
  editingCell: { callId: string; field: EditableCallField } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ callId: string; field: EditableCallField } | null>>;
  editValue: string;
  setEditValue: (value: string) => void;
  updateEvent: (updates: Partial<Event>) => Promise<void>;
  handleCellClick: <K extends keyof Call>(callId: string, field: K, value?: Call[K]) => void;
  handleCellBlur: <K extends keyof Call>(callId: string, field: K) => Promise<void>;
  handleAgeSexBlur: (callId: string) => Promise<void>;
  getCallRowClass: (call: Call) => string;
  formatAgeSex: (age?: string | number, gender?: string) => string;
}

const TableColGroup = () => (
  <colgroup>
    <col className="w-16" />
    <col className="w-40" />
    <col className="w-16" />
    <col className="w-48" />
    <col className="w-28" />
    <col />
    <col className="w-12" />
  </colgroup>
);

export default function ClinicTrackingTable({
  event,
  callDisplayNumberMap,
  showResolvedClinicCalls,
  setShowResolvedClinicCalls,
  openClinicCallId,
  setOpenClinicCallId,
  editingCell,
  setEditingCell,
  editValue,
  setEditValue,
  updateEvent,
  handleCellClick,
  handleCellBlur,
  handleAgeSexBlur,
  getCallRowClass,
  formatAgeSex,
}: ClinicTrackingTableProps) {
  // Persistent local state for notes/log text per call — never goes null to prevent flicker
  const [notesTexts, setNotesTexts] = React.useState<Record<string, string>>({});
  const notesFocusedRef = React.useRef<string | null>(null);
  const [logTexts, setLogTexts] = React.useState<Record<string, string>>({});
  const logFocusedRef = React.useRef<string | null>(null);

  const resolvedClinicCalls = (event?.calls || [])
    .filter(c => c.status === 'Delivered' && !!c.outcome)
    .sort((a, b) => parseInt(a.id) - parseInt(b.id));
  const unresolvedClinicCalls = (event?.calls || [])
    .filter(c => c.status === 'Delivered' && !c.outcome)
    .sort((a, b) => parseInt(a.id) - parseInt(b.id));

  // Sync notes from props when not focused
  React.useEffect(() => {
    if (!event?.calls) return;
    setNotesTexts(prev => {
      const next = { ...prev };
      for (const call of event.calls) {
        if (notesFocusedRef.current !== call.id) {
          next[call.id] = call.notes || '';
        }
      }
      return next;
    });
  }, [event?.calls]);

  // Sync log from props when not focused
  React.useEffect(() => {
    if (!event?.calls) return;
    setLogTexts(prev => {
      const next = { ...prev };
      for (const call of event.calls) {
        if (logFocusedRef.current !== call.id) {
          const text = call.log && call.log.length > 0
            ? call.log.map((entry: CallLogEntry) => entry.message).join('\n')
            : '';
          next[call.id] = text;
        }
      }
      return next;
    });
  }, [event?.calls]);

  

  return (
    <div className="w-full">
      <TrackingTableBase
        TableColGroup={TableColGroup}
        showStatusColumn={true}
        showTeamAssignmentChips={false}
      >
            {[
              // Unresolved clinic (Delivered with no outcome)
              ...unresolvedClinicCalls,

              // Resolved clinic (Delivered with an outcome) when toggled on
              ...resolvedClinicCalls,
            ].map(call => (
              <React.Fragment key={call.id}>
                {(() => {
                  const isResolvedClinicCall = call.status === 'Delivered' && !!call.outcome;
                  const resolvedIndex = isResolvedClinicCall ? resolvedClinicCalls.findIndex((resolvedCall) => resolvedCall.id === call.id) : -1;
                  const isMotionVisible = !isResolvedClinicCall || showResolvedClinicCalls;
                  const motionDelayMs = isResolvedClinicCall && resolvedIndex >= 0 ? resolvedIndex * 30 : 0;
                  return (
                <tr
                  className={`cursor-pointer min-h-3.25rem bg-transparent rounded-none ${getCallRowClass(call)} ${openClinicCallId === call.id || getCallRowClass(call) ? '' : TEAM_CARD_ROW_HOVER_CLASS} transition-colors`}
                  onClick={(e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
                    setOpenClinicCallId(openClinicCallId === call.id ? null : call.id);
                  }}
                >
                  <td className="p-0">
                    <DispatchMotionCell isOpen={isMotionVisible} delayMs={motionDelayMs} className="px-3 py-2.5">
                      {callDisplayNumberMap.get(call.id)}
                    </DispatchMotionCell>
                  </td>

                  {/* Chief Complaint (inline edit) */}
                  <td
                    className="p-0"
                    onClick={() => handleCellClick(call.id, 'chiefComplaint', call.chiefComplaint)}
                  >
                    <DispatchMotionCell isOpen={isMotionVisible} delayMs={motionDelayMs} className="px-3 py-2.5 truncate">
                      {editingCell?.callId === call.id && editingCell.field === 'chiefComplaint' ? (
                        <input
                          type="text"
                          value={editValue}
                          autoFocus
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => handleCellBlur(call.id, 'chiefComplaint')}
                          onKeyDown={e => {
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
                        call.chiefComplaint || <span className="text-surface-light whitespace-nowrap">[Edit]</span>
                      )}
                    </DispatchMotionCell>
                  </td>

                  {/* A/S (inline edit) */}
                  <td
                    className="p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCell({ callId: call.id, field: 'ageSex' });
                      setEditValue(formatAgeSex(call.age, call.gender));
                    }}
                  >
                    <DispatchMotionCell isOpen={isMotionVisible} delayMs={motionDelayMs} className="px-3 py-2.5">
                      {editingCell?.callId === call.id && editingCell.field === 'ageSex' ? (
                        <input
                          type="text"
                          value={editValue}
                          autoFocus
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => handleAgeSexBlur(call.id)}
                          onKeyDown={e => {
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
                        formatAgeSex(call.age, call.gender) || <span className="text-surface-light whitespace-nowrap">[Edit]</span>
                      )}
                    </DispatchMotionCell>
                  </td>



                  {/* Location (inline edit) */}
                  <td
                    className="p-0"
                    onClick={() => handleCellClick(call.id, 'location', call.location)}
                  >
                    <DispatchMotionCell isOpen={isMotionVisible} delayMs={motionDelayMs} className="px-3 py-2.5 truncate">
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
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="w-full bg-transparent text-surface-light px-0 py-0 border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        />
                      ) : (
                        call.location || <span className="text-surface-light whitespace-nowrap">[Edit]</span>
                      )}
                    </DispatchMotionCell>
                  </td>

                  {/* Status - Using HeroUI Dropdown */}
                  <td className="p-0" onClick={e => e.stopPropagation()}>
                    <DispatchMotionCell isOpen={isMotionVisible} delayMs={motionDelayMs} className="px-3 py-2.5">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            size="sm"
                            variant="flat"
                            className="min-w-0 h-7 px-2 text-xs justify-start bg-surface-liner hover:bg-surface-muted"
                          >
                            {call.outcome || 'In Clinic'}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                          aria-label="Clinic Status"
                          onAction={async (key) => {
                            const val = key as string;
                            const now = new Date();
                            const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');

                            const updatedCalls = event.calls.map((c: Call) => {
                              if (c.id !== call.id) return c;
                              return {
                                ...c,
                                outcome: val === 'In Clinic' ? undefined : val as ClinicOutcome,
                                log: [
                                  ...(c.log || []),
                                  {
                                    timestamp: now.getTime(),
                                    message: `${hhmm} - Clinic Status: ${val}`
                                  }
                                ]
                              } as Call;
                            });

                            await updateEvent({ calls: updatedCalls });
                          }}
                        >
                          <DropdownItem key="In Clinic">In Clinic</DropdownItem>
                          <DropdownItem key="Transported">Transported</DropdownItem>
                          <DropdownItem key="AMA">AMA</DropdownItem>
                          <DropdownItem key="Discharged">Discharged</DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </DispatchMotionCell>
                  </td>

                  {/* Team (inline edit) */}
                  <td className="p-0">
                    <DispatchMotionCell isOpen={isMotionVisible} delayMs={motionDelayMs} className="px-3 py-2.5">
                      {(call.assignedTeam && call.assignedTeam.length > 0)
                        ? (Array.isArray(call.assignedTeam) ? call.assignedTeam.join(', ') : call.assignedTeam)
                        : (call.detachedTeams?.map(d => d.team).join(', ') || 'Walkup')}
                    </DispatchMotionCell>
                  </td>
                  {/* Options Ellipsis */}
                  <td className="p-0">
                    <DispatchMotionCell isOpen={isMotionVisible} delayMs={motionDelayMs} className="px-3 py-2.5 text-right">
                      <Dropdown placement="bottom-end" offset={6}>
                        <DropdownTrigger>
                          <button
                            className="p-0 m-0 border-0 bg-transparent text-surface-light hover:text-status-blue transition-colors cursor-pointer flex items-center justify-center"
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
                            onPress={() => setOpenClinicCallId(openClinicCallId === call.id ? null : call.id)}
                          >
                            {openClinicCallId === call.id ? 'Hide Log' : 'Show Log'}
                          </DropdownItem>
                          <DropdownItem 
                            key="delete"
                            className="text-danger"
                            color="danger"
                            onPress={async () => {
                              if (confirm('Are you sure you want to delete this call? This action cannot be undone.')) {
                                const updatedCalls = event.calls.filter((c: Call) => c.id !== call.id);
                                await updateEvent({ calls: updatedCalls });
                              }
                            }}
                          >
                            Delete Call
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </DispatchMotionCell>
                  </td>
                </tr>
                  );
                })()}

                {/* Expanded row for notes and log - NO ANIMATION */}
                {openClinicCallId === call.id && (
                  <tr>
                    <td
                      colSpan={7}
                      className={`p-2 border-b border-surface-liner ${getCallRowClass(call)}`}
                      onClick={() => setOpenClinicCallId(null)}
                    >
                      <div className="cursor-pointer">
                        {call.priority && (
                          <div className="bg-status-red text-surface-light p-2 mb-2 rounded">
                            ⚠️ PRIORITY CALL: Life threat to patient/provider
                          </div>
                        )}
                        
                        {/* Notes - Using HeroUI Textarea - NO LOG ENTRY */}
                        <div
                          className="mt-1 mb-3 text-sm text-surface-light"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-semibold mb-1">Notes</div>
                          <Textarea
                            value={notesTexts[call.id] ?? (call.notes || '')}
                            onChange={(e) => {
                              setNotesTexts(prev => ({ ...prev, [call.id]: e.target.value }));
                            }}
                            onBlur={async () => {
                              notesFocusedRef.current = null;
                              const text = notesTexts[call.id] ?? '';
                              const callNow = event?.calls.find((c: Call) => c.id === call.id);
                              if (!callNow) return;
                              
                              if ((callNow.notes || '') !== text) {
                                const updatedCall = { ...callNow, notes: text };
                                const updated = event!.calls.map((c: Call) => 
                                  c.id === call.id ? updatedCall : c
                                );
                                await updateEvent({ calls: updated });
                              }
                            }}
                            onFocus={() => {
                              notesFocusedRef.current = call.id;
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

                        
                        {/* Log - Using HeroUI ScrollShadow */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <strong>Log for Call #{callDisplayNumberMap.get(call.id)}:</strong>
                            <Textarea
                              value={logTexts[call.id] ?? (() => {
                                if (call.log && call.log.length > 0) {
                                  return call.log.map((entry: CallLogEntry) => entry.message).join('\n');
                                }
                                return '';
                              })()}
                              onChange={(e) => {
                                setLogTexts(prev => ({ ...prev, [call.id]: e.target.value }));
                              }}
                              onBlur={async () => {
                                logFocusedRef.current = null;
                                const text = logTexts[call.id] ?? '';
                                const callNow = event?.calls.find((c: Call) => c.id === call.id);
                                if (!callNow) return;
                                
                                // Convert text back to log entries
                                const lines = text.split('\n').filter(line => line.trim());
                                const newLog: CallLogEntry[] = lines.map(line => ({
                                  timestamp: Date.now(),
                                  message: line
                                }));
                                
                                const updatedCall = { ...callNow, log: newLog };
                                const updated = event!.calls.map((c: Call) => 
                                  c.id === call.id ? updatedCall : c
                                );
                                await updateEvent({ calls: updated });
                              }}
                              onFocus={() => {
                                logFocusedRef.current = call.id;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  const now = new Date();
                                  const hhmm = now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0');
                                  setLogTexts(prev => ({ ...prev, [call.id]: (prev[call.id] || '') + `\n${hhmm} - ` }));
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
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
      </TrackingTableBase>
      
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
  );
}
