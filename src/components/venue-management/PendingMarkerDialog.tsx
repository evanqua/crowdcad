import React from 'react';
import { Button, Input } from '@heroui/react';

interface PendingMarkerDialogProps {
  markerNameInput: string;
  markerInputRef: React.RefObject<HTMLInputElement | null>;
  setMarkerNameInput: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PendingMarkerDialog({
  markerNameInput,
  markerInputRef,
  setMarkerNameInput,
  onConfirm,
  onCancel,
}: PendingMarkerDialogProps) {
  return (
    <div
      className="fixed z-30 w-52 rounded-lg border border-status-blue bg-surface-deepest p-3 shadow-xl"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <p className="mb-2 text-xs font-medium text-white">Name this location:</p>
      <Input
        ref={markerInputRef}
        value={markerNameInput}
        onValueChange={setMarkerNameInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onConfirm();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Location name"
        size="sm"
        variant="bordered"
        classNames={{
          input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
          inputWrapper: 'px-4 hover:bg-surface-deep mb-2',
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="flat" onPress={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          size="sm"
          onPress={onConfirm}
          className="flex-1 bg-accent hover:bg-accent/90 text-white"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
