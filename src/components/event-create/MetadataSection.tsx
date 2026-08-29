"use client";

import React from 'react';
import { DateValue } from '@internationalized/date';
import { DatePicker, Input, Tooltip } from '@heroui/react';
import { CircleHelp } from 'lucide-react';
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
          variant="flat"
          color="primary"
          placeholder="Enter event name"
          value={eventData.name || ''}
          onValueChange={(value) => setEventData((prev) => ({ ...prev, name: value }))}
          classNames={inputClassNames}
          size="lg"
        />
      </div>
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <DatePicker
            label="Event Date"
            labelPlacement="outside"
            variant="flat"
            color="primary"
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
        <div className="flex-1">
          <Input
            type="number"
            label={
              <span className="inline-flex items-center gap-1">
                Surge Limit
                <Tooltip content="Percent of teams on calls at which the dispatch board's surge display turns red." placement="top">
                  <CircleHelp className="w-3.5 h-3.5 text-surface-faint" />
                </Tooltip>
              </span>
            }
            labelPlacement="outside"
            variant="flat"
            color="primary"
            placeholder="70"
            min={1}
            max={100}
            value={String(eventData.surgeLimitPercent ?? 70)}
            onValueChange={(value) => {
              const parsed = Number(value);
              setEventData((prev) => ({
                ...prev,
                surgeLimitPercent: Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : prev.surgeLimitPercent,
              }));
            }}
            endContent={<span className="text-surface-faint text-sm">%</span>}
            classNames={inputClassNames}
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}
