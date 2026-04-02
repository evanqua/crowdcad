"use client";

import React from 'react';
import { Textarea } from '@heroui/react';

type Props = {
  callDisplayNumber: number | undefined;
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
        colSpan={7}
        className="p-2 border-b border-surface-liner"
        onClick={onClose}
      >
        <div className="cursor-pointer">
          {priority && (
            <div className="bg-status-red text-surface-light p-2 mb-2 rounded">
              ⚠️ PRIORITY CALL: Life threat to patient/provider
            </div>
          )}

          <div
            className="mt-1 mb-3 text-sm text-surface-light"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold mb-1">Notes</div>
            <Textarea
              value={notesText}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onNotesBlur}
              onFocus={onNotesFocus}
              minRows={2}
              variant="flat"
              placeholder="Add notes"
              className="min-w-0"
              classNames={{
                input: 'text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0',
                inputWrapper: 'bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep group-data-[focus-visible=true]:bg-surface-deep group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 focus-within:ring-0',
              }}
            />
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            <strong>Log for Call #{callDisplayNumber}:</strong>
            <Textarea
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
              variant="flat"
              placeholder="No log entries"
              className="min-w-0"
              classNames={{
                input: 'text-surface-light bg-surface-deep outline-none focus:outline-none data-[focus=true]:outline-none focus:ring-0 focus-visible:ring-0 text-sm',
                inputWrapper: 'bg-surface-deep shadow-none border border-surface-liner hover:bg-surface-liner group-data-[focus=true]:bg-surface-deep group-data-[focus-visible=true]:bg-surface-deep group-data-[focus-visible=true]:ring-0 group-data-[focus-visible=true]:ring-offset-0 focus-within:ring-0',
              }}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}
