"use client";

import React from 'react';
import DispatchMotionCell from './motioncell';
import TrackingTextEntry from '@/components/dispatch/trackingtextentry';

type Props = {
  callDisplayNumber: number | undefined;
  isOpen: boolean;
  notesText: string;
  onNotesChange: (value: string) => void;
  onNotesFocus: () => void;
  onNotesBlur: () => Promise<void>;
  logText: string;
  onLogChange: (value: string) => void;
  onLogFocus: () => void;
  onLogBlur: () => Promise<void>;
  onLogInsertTimestamp: () => void;
  onClose: () => void;
  priority?: boolean;
  rowClassName?: string;
};

export default function CallTrackingDetails({
  callDisplayNumber,
  isOpen,
  notesText,
  onNotesChange,
  onNotesFocus,
  onNotesBlur,
  logText,
  onLogChange,
  onLogFocus,
  onLogBlur,
  onLogInsertTimestamp,
  onClose,
  priority,
  rowClassName,
}: Props) {
  return (
    <tr className={rowClassName}>
      <td
        colSpan={6}
        className="p-2 pt-1.5 pb-3 border-b border-surface-liner align-top"
        onClick={onClose}
      >
        <DispatchMotionCell isOpen={isOpen} animate={true} className="cursor-pointer">
          {priority && (
            <div className="bg-status-red text-surface-light p-2 mb-2 rounded">
              ⚠️ PRIORITY CALL: Life threat to patient/provider
            </div>
          )}

          <div
            className="mt-0 mb-1.5 text-sm text-surface-light"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold mb-1">Notes</div>
            <TrackingTextEntry
              mode="note"
              value={notesText}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onNotesBlur}
              onFocus={onNotesFocus}
              minRows={2}
              maxRows={3}
              variant="flat"
              placeholder="Add notes"
              className="min-w-0"
            />
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <strong>Log for Call #{callDisplayNumber}:</strong>
            <TrackingTextEntry
              mode="log"
              value={logText}
              onChange={(e) => onLogChange(e.target.value)}
              onBlur={onLogBlur}
              onFocus={onLogFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onLogInsertTimestamp();
                }
              }}
              minRows={4}
              maxRows={5}
              variant="flat"
              placeholder="No log entries"
              className="min-w-0"
            />
          </div>
        </DispatchMotionCell>
      </td>
    </tr>
  );
}
