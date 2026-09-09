import React from 'react';
import { Button, Checkbox, Input } from '@heroui/react';
import { ZONE_COLOR_PALETTE } from '@/lib/zoneColors';

interface PendingZoneDialogProps {
  zoneNameInput: string;
  zoneNameInputRef: React.RefObject<HTMLInputElement | null>;
  setZoneNameInput: (value: string) => void;
  zoneColorInput: string;
  setZoneColorInput: (value: string) => void;
  zoneIsDispatchZoneInput: boolean;
  setZoneIsDispatchZoneInput: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PendingZoneDialog({
  zoneNameInput,
  zoneNameInputRef,
  setZoneNameInput,
  zoneColorInput,
  setZoneColorInput,
  zoneIsDispatchZoneInput,
  setZoneIsDispatchZoneInput,
  onConfirm,
  onCancel,
}: PendingZoneDialogProps) {
  return (
    <div
      className="fixed z-30 w-60 rounded-lg border border-status-blue bg-surface-deepest p-3 shadow-xl"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <p className="mb-2 text-xs font-medium text-surface-light">Name this area:</p>
      <Input
        ref={zoneNameInputRef}
        value={zoneNameInput}
        onValueChange={setZoneNameInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Area name"
        size="sm"
        variant="flat"
        color="default"
        classNames={{
          input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
          inputWrapper: 'px-4 hover:bg-surface-deep mb-2',
        }}
      />
      <p className="mb-1 text-[11px] font-medium text-surface-light/70">Color:</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {ZONE_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use color ${color}`}
            onClick={() => setZoneColorInput(color)}
            className={`h-5 w-5 rounded-full transition ${zoneColorInput === color ? 'ring-2 ring-offset-1 ring-offset-surface-deepest ring-surface-light' : ''}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <Checkbox
        isSelected={zoneIsDispatchZoneInput}
        onValueChange={setZoneIsDispatchZoneInput}
        size="sm"
        classNames={{ label: 'text-surface-light text-xs' }}
      >
        Mark as Dispatch Zone
      </Checkbox>
      <div className="flex gap-2 mt-2">
        <Button size="sm" radius="full" variant="flat" onPress={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          size="sm"
          radius="full"
          onPress={onConfirm}
          className="flex-1 bg-accent hover:bg-accent/90 text-surface-light"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
