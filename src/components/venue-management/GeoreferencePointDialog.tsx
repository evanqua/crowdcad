import React from 'react';
import { Button, Input } from '@heroui/react';

interface GeoreferencePointDialogProps {
  latInput: string;
  lonInput: string;
  labelInput: string;
  latInputRef: React.RefObject<HTMLInputElement | null>;
  setLatInput: (value: string) => void;
  setLonInput: (value: string) => void;
  setLabelInput: (value: string) => void;
  latError: string | null;
  lonError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function GeoreferencePointDialog({
  latInput,
  lonInput,
  labelInput,
  latInputRef,
  setLatInput,
  setLonInput,
  setLabelInput,
  latError,
  lonError,
  onConfirm,
  onCancel,
}: GeoreferencePointDialogProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="fixed z-30 w-64 rounded-lg border border-status-orange bg-surface-deepest p-3 shadow-xl"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <p className="mb-2 text-xs font-medium text-surface-light">
        Real-world position for this point:
      </p>
      <div className="mb-2">
        <Input
          ref={latInputRef}
          value={latInput}
          onValueChange={setLatInput}
          onKeyDown={handleKeyDown}
          placeholder="Latitude"
          size="sm"
          variant="bordered"
          isInvalid={!!latError}
          classNames={{
            input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
            inputWrapper: 'px-4 hover:bg-surface-deep',
          }}
        />
        {latError && <p className="mt-1 text-xs text-status-red">{latError}</p>}
      </div>
      <div className="mb-2">
        <Input
          value={lonInput}
          onValueChange={setLonInput}
          onKeyDown={handleKeyDown}
          placeholder="Longitude"
          size="sm"
          variant="bordered"
          isInvalid={!!lonError}
          classNames={{
            input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
            inputWrapper: 'px-4 hover:bg-surface-deep',
          }}
        />
        {lonError && <p className="mt-1 text-xs text-status-red">{lonError}</p>}
      </div>
      <Input
        value={labelInput}
        onValueChange={setLabelInput}
        onKeyDown={handleKeyDown}
        placeholder="Label (optional)"
        size="sm"
        variant="bordered"
        classNames={{
          input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
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
          className="flex-1 bg-status-orange hover:bg-status-orange/90 text-surface-deepest"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
