import type { Call } from '@/app/types';

/**
 * When `call` is about to receive its first team/supervisor/equipment
 * assignment (i.e. it was Pending — no assigned team yet), returns how long
 * it sat pending as "Xm Ys", measured from its first log entry (created at
 * call-creation time) to `now`. Returns null when the call wasn't Pending
 * (already had a team, or has no log to measure from), so callers can skip
 * appending a duration note.
 */
export function describePendingDuration(call: Call, now: Date): string | null {
  if ((call.assignedTeam || []).length > 0) return null;
  const createdAt = call.log?.[0]?.timestamp;
  if (!createdAt) return null;

  const totalSeconds = Math.max(0, Math.floor((now.getTime() - createdAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/** Appends " (assigned after Xm Ys pending)" to `message` when `call` is receiving its first assignment; returns `message` unchanged otherwise. */
export function withPendingSuffix(message: string, call: Call, now: Date): string {
  const duration = describePendingDuration(call, now);
  return duration ? `${message} (assigned after ${duration} pending)` : message;
}
