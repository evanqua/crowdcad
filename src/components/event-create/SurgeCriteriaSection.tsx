"use client";

import React from 'react';
import { Input, Tooltip } from '@heroui/react';
import { CircleHelp } from 'lucide-react';
import type { Event } from '@/app/types';

type Props = {
  eventData: Partial<Event>;
  setEventData: React.Dispatch<React.SetStateAction<Partial<Event> & { eventEquipment: Event['eventEquipment'] }>>;
  inputClassNames: {
    label: string;
    inputWrapper: string;
    input: string;
  };
};

export default function SurgeCriteriaSection({ eventData, setEventData, inputClassNames }: Props) {
  return (
    <div className="max-w-xs">
      <Input
        type="number"
        data-testid="surge-limit-input"
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
        color="default"
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
  );
}
