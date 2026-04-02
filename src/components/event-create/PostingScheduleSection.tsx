import React from 'react';
import { TimeInput, Input, Chip } from '@heroui/react';
import { Time } from '@internationalized/date';

type ScheduleChip = { id: string; time: string; editable: boolean };

type Props = {
  postsEnabled: boolean;
  scheduleFrom: Time;
  setScheduleFrom: (time: Time) => void;
  scheduleTo: Time;
  setScheduleTo: (time: Time) => void;
  scheduleBy: string;
  setScheduleBy: (value: string) => void;
  scheduleChips: ScheduleChip[];
  setScheduleChips: React.Dispatch<React.SetStateAction<ScheduleChip[]>>;
  editingChipId: string | null;
  setEditingChipId: React.Dispatch<React.SetStateAction<string | null>>;
  editingChipValue: string;
  setEditingChipValue: React.Dispatch<React.SetStateAction<string>>;
  setPostingTimes: (updater: (prev: string[]) => string[]) => void;
  inputClassNames: {
    label: string;
    inputWrapper: string;
    input: string;
  };
};

export default function PostingScheduleSection({
  postsEnabled,
  scheduleFrom,
  setScheduleFrom,
  scheduleTo,
  setScheduleTo,
  scheduleBy,
  setScheduleBy,
  scheduleChips,
  setScheduleChips,
  editingChipId,
  setEditingChipId,
  editingChipValue,
  setEditingChipValue,
  setPostingTimes,
  inputClassNames,
}: Props) {
  return (
    <div className={`space-y-3 mt-6 ${!postsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <h3 className="text-white font-semibold text-lg">Schedule</h3>

      <div className="grid grid-cols-3 gap-3">
        <TimeInput
          label="From"
          labelPlacement="inside"
          value={scheduleFrom}
          onChange={(value) => value && setScheduleFrom(value)}
          hourCycle={24}
          isDisabled={!postsEnabled}
          classNames={inputClassNames}
          size="md"
        />
        <TimeInput
          label="To"
          labelPlacement="inside"
          value={scheduleTo}
          onChange={(value) => value && setScheduleTo(value)}
          hourCycle={24}
          isDisabled={!postsEnabled}
          classNames={inputClassNames}
          size="md"
        />
        <Input
          label="By"
          labelPlacement="inside"
          placeholder="75"
          value={scheduleBy}
          onValueChange={setScheduleBy}
          type="number"
          min="1"
          endContent="min"
          isDisabled={!postsEnabled}
          classNames={inputClassNames}
          size="md"
        />
      </div>

      {scheduleChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {scheduleChips.map((chip) => (
            <Chip
              key={chip.id}
              onClose={() => {
                const timeToRemove = chip.time;
                setScheduleChips((prev) => prev.filter((c) => c.id !== chip.id));
                setPostingTimes((prev) => prev.filter((time) => time !== timeToRemove));
              }}
              variant="flat"
              style={{ backgroundColor: '#3eb1fd33', color: '#3eb1fd' }}
              onClick={() => {
                setEditingChipId(chip.id);
                setEditingChipValue(chip.time);
              }}
              className="cursor-pointer"
            >
              {editingChipId === chip.id ? (
                <input
                  type="text"
                  value={editingChipValue}
                  onChange={(e) => setEditingChipValue(e.target.value)}
                  onBlur={() => {
                    const oldTime = scheduleChips.find((current) => current.id === chip.id)?.time;
                    setScheduleChips((prev) =>
                      prev.map((current) =>
                        current.id === chip.id ? { ...current, time: editingChipValue } : current
                      )
                    );
                    if (oldTime) {
                      setPostingTimes((prev) =>
                        prev.map((time) => (time === oldTime ? editingChipValue : time))
                      );
                    }
                    setEditingChipId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const oldTime = scheduleChips.find((current) => current.id === chip.id)?.time;
                      setScheduleChips((prev) =>
                        prev.map((current) =>
                          current.id === chip.id ? { ...current, time: editingChipValue } : current
                        )
                      );
                      if (oldTime) {
                        setPostingTimes((prev) =>
                          prev.map((time) => (time === oldTime ? editingChipValue : time))
                        );
                      }
                      setEditingChipId(null);
                    }
                  }}
                  autoFocus
                  className="bg-transparent outline-none w-16 text-center"
                />
              ) : (
                chip.time
              )}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
