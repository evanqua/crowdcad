// lib/callSort.ts
import type { Call } from '@/app/types';

export type CallSortMode = 'newest' | 'oldest' | 'pending';

/** A call with no team assigned yet — the same definition dispatch/page.tsx's getCallPrimaryStatus uses for 'Pending'. */
export function isCallPending(call: Call): boolean {
  return !Array.isArray(call.assignedTeam) || call.assignedTeam.length === 0;
}

// call.id is Date.now().toString() at creation, so parseInt is effectively a creation timestamp.
const byId = (a: Call, b: Call) => parseInt(a.id) - parseInt(b.id);

function compareWithinGroup(mode: CallSortMode, a: Call, b: Call): number {
  if (mode === 'oldest') return byId(a, b);
  if (mode === 'pending') {
    const aPending = isCallPending(a);
    const bPending = isCallPending(b);
    if (aPending !== bPending) return aPending ? -1 : 1;
    return byId(b, a);
  }
  return byId(b, a); // 'newest' (default)
}

/**
 * Orders a list of active calls: Priority calls first, then Pinned calls,
 * then everything else — each group internally ordered by `mode`. Intended
 * for the active-calls list only; resolved calls keep their own ordering
 * since pin/priority stop mattering once a call is resolved.
 */
export function sortActiveCalls(calls: Call[], mode: CallSortMode = 'newest'): Call[] {
  const rank = (call: Call) => (call.priority ? 0 : call.pin ? 1 : 2);
  return [...calls].sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return compareWithinGroup(mode, a, b);
  });
}
