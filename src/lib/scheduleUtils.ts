import { Time } from '@internationalized/date';

export function parseTimeValue(value: string, fallback: Time): Time {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  ) {
    return new Time(hour, minute);
  }

  return fallback;
}

export function formatTimeValue(value: Time): string {
  return `${value.hour.toString().padStart(2, '0')}:${value.minute
    .toString()
    .padStart(2, '0')}`;
}

export function buildPostingTimes(from: Time, to: Time, byMinutesRaw: string): string[] {
  const byMinutes = Number.parseInt(byMinutesRaw, 10);
  if (!Number.isFinite(byMinutes) || byMinutes <= 0) return [];

  const minutesInDay = 24 * 60;
  const startMinutes = from.hour * 60 + from.minute;
  const toMinutes = to.hour * 60 + to.minute;
  const endMinutes = toMinutes <= startMinutes ? toMinutes + minutesInDay : toMinutes;

  const times: string[] = [];
  const maxIterations = Math.ceil((endMinutes - startMinutes) / Math.max(1, byMinutes)) + 2;
  let iteration = 0;

  for (let value = startMinutes; value <= endMinutes; value += byMinutes) {
    iteration += 1;
    if (iteration > maxIterations) break;

    const normalized = value % minutesInDay;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
  }

  return times;
}
