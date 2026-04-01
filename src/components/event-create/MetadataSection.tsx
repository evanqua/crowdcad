import React from 'react';
import { DateValue } from '@internationalized/date';
import { DatePicker, Input } from '@heroui/react';
import type { Event } from '@/app/types';

type Props = {
  eventData: Partial<Event>;
  setEventData: React.Dispatch<React.SetStateAction<Partial<Event> & { eventEquipment: Event['eventEquipment'] }>>;
  getCalendarDate: () => DateValue;
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
  inputClassNames,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Input
          label="Event Name"
          labelPlacement="outside"
          placeholder="Event Name"
          value={eventData.name || ''}
          onValueChange={(value) => setEventData((prev) => ({ ...prev, name: value }))}
          classNames={inputClassNames}
          size="lg"
        />
      </div>
      <div>
        <DatePicker
          label="Event Date"
          labelPlacement="outside"
          value={getCalendarDate()}
          onChange={(date) => {
            if (date) {
              setEventData((prev) => ({ ...prev, date: date.toString() }));
            }
          }}
          classNames={inputClassNames}
          size="lg"
        />
      </div>
    </div>
  );
}
