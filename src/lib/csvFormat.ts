const pad = (n: number, len = 2) => n.toString().padStart(len, '0');

/**
 * Formats a log entry's epoch timestamp for CSV export as a full local
 * date + time ("YYYY-MM-DD HH:mm:ss"), instead of just a time-of-day —
 * an event that runs past midnight still sorts and reads unambiguously
 * this way. The dispatch board's own on-screen logs stay date-free
 * (HH:mm), this is exports only.
 */
export function formatLogTimestampForCsv(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '';
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
