// components/dispatch/callindicatoricons.tsx
import { Tooltip } from '@heroui/react';
import { TriangleAlert, Pin } from 'lucide-react';
import type { Call } from '@/app/types';

/**
 * Priority/pin status icons shown just to the left of a call's three-dot
 * menu. Read-only: toggling either flag happens from the menu itself.
 */
export default function CallIndicatorIcons({ call }: { call: Call }) {
  if (!call.priority && !call.pin) return null;
  return (
    <span className="flex items-center gap-1 shrink-0">
      {call.priority && (
        <Tooltip content="Priority Call" placement="top">
          <TriangleAlert className="h-4 w-4 text-status-red" aria-label="Priority call" />
        </Tooltip>
      )}
      {call.pin && (
        <Tooltip content="Pinned Call" placement="top">
          <Pin className="h-4 w-4 text-accent" aria-label="Pinned call" />
        </Tooltip>
      )}
    </span>
  );
}
