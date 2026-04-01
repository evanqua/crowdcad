import { Time } from '@internationalized/date';
import { useMemo, useState } from 'react';
import { buildPostingTimes } from '@/lib/scheduleUtils';

type Options = {
  initialFrom?: Time;
  initialTo?: Time;
  initialBy?: string;
  enabled?: boolean;
};

export function useScheduleGeneration(options: Options = {}) {
  const {
    initialFrom = new Time(16, 0),
    initialTo = new Time(23, 59),
    initialBy = '75',
    enabled = true,
  } = options;

  const [scheduleFrom, setScheduleFrom] = useState<Time>(initialFrom);
  const [scheduleTo, setScheduleTo] = useState<Time>(initialTo);
  const [scheduleBy, setScheduleBy] = useState(initialBy);

  const postingTimes = useMemo(
    () => (enabled ? buildPostingTimes(scheduleFrom, scheduleTo, scheduleBy) : []),
    [enabled, scheduleFrom, scheduleTo, scheduleBy]
  );

  return {
    scheduleFrom,
    setScheduleFrom,
    scheduleTo,
    setScheduleTo,
    scheduleBy,
    setScheduleBy,
    postingTimes,
  };
}
