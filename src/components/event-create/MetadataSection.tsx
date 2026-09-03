"use client";

import React, { useState } from 'react';
import { DateValue, Time } from '@internationalized/date';
import { DatePicker, Input, TimeInput } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import type { Event } from '@/app/types';
import SurgeCriteriaSection from './SurgeCriteriaSection';

type Props = {
  eventData: Partial<Event>;
  setEventData: React.Dispatch<React.SetStateAction<Partial<Event> & { eventEquipment: Event['eventEquipment'] }>>;
  getCalendarDate: () => DateValue;
  scheduleFrom: Time;
  setScheduleFrom: (time: Time) => void;
  scheduleTo: Time;
  setScheduleTo: (time: Time) => void;
  inputClassNames: {
    label: string;
    inputWrapper: string;
    input: string;
  };
};

export default function MetadataSection({
  eventData,
  setEventData,
  getCalendarDate,
  scheduleFrom,
  setScheduleFrom,
  scheduleTo,
  setScheduleTo,
  inputClassNames,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const crossesMidnight =
    scheduleTo.hour * 60 + scheduleTo.minute <= scheduleFrom.hour * 60 + scheduleFrom.minute;

  return (
    <div className="space-y-4">
      <div>
        <Input
          label="Event Name"
          labelPlacement="outside"
          variant="flat"
          color="default"
          placeholder="Enter event name"
          value={eventData.name || ''}
          onValueChange={(value) => setEventData((prev) => ({ ...prev, name: value }))}
          isRequired
          classNames={inputClassNames}
          size="lg"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DatePicker
          label="Event Date"
          labelPlacement="outside"
          variant="flat"
          color="default"
          value={getCalendarDate()}
          onChange={(date) => {
            if (date) {
              setEventData((prev) => ({ ...prev, date: date.toString() }));
            }
          }}
          isRequired
          classNames={inputClassNames}
          size="lg"
        />
        <TimeInput
          label="Start Time"
          labelPlacement="outside"
          variant="flat"
          color="default"
          value={scheduleFrom}
          onChange={(value) => value && setScheduleFrom(value)}
          hourCycle={24}
          isRequired
          classNames={inputClassNames}
          size="lg"
        />
        <TimeInput
          label="End Time"
          labelPlacement="outside"
          variant="flat"
          color="default"
          value={scheduleTo}
          onChange={(value) => value && setScheduleTo(value)}
          hourCycle={24}
          isRequired
          classNames={inputClassNames}
          size="lg"
        />
      </div>
      {crossesMidnight && (
        <p className="text-xs text-surface-faint">Ends the next day, past midnight.</p>
      )}

      <div className="pt-2 border-t border-surface-liner">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          className="flex items-center gap-1.5 text-sm text-surface-faint hover:text-surface-light py-2"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          Advanced settings
        </button>
        {advancedOpen && (
          <div className="pt-1">
            <SurgeCriteriaSection
              eventData={eventData}
              setEventData={setEventData}
              inputClassNames={inputClassNames}
            />
          </div>
        )}
      </div>
    </div>
  );
}
