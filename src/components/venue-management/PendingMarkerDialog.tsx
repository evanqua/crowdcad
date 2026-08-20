import React from 'react';
import { Button, Checkbox, Input } from '@heroui/react';

interface PendingMarkerDialogProps {
  markerNameInput: string;
  markerInputRef: React.RefObject<HTMLInputElement | null>;
  setMarkerNameInput: (value: string) => void;
  markerIsClinicInput: boolean;
  setMarkerIsClinicInput: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** The lat/lon this marker was actually dropped at, when placed on the
   *  real basemap (10.E) rather than a raster image. Only present for a
   *  basemap-placed marker -- the raster path leaves both undefined, and
   *  the coordinate readout below is omitted entirely in that case. */
  lat?: number;
  lon?: number;
}

export default function PendingMarkerDialog({
  markerNameInput,
  markerInputRef,
  setMarkerNameInput,
  markerIsClinicInput,
  setMarkerIsClinicInput,
  onConfirm,
  onCancel,
  lat,
  lon,
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
      <p className="mb-2 text-xs font-medium text-surface-light">Name this location:</p>
      {lat !== undefined && lon !== undefined && (
        <p className="mb-2 text-xs text-surface-faint">
          {lat.toFixed(6)}, {lon.toFixed(6)}
        </p>
      )}
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
          input: 'text-surface-light text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
          inputWrapper: 'px-4 hover:bg-surface-deep mb-2',
        }}
      />
      <Checkbox
        isSelected={markerIsClinicInput}
        onValueChange={setMarkerIsClinicInput}
        size="sm"
        classNames={{ label: 'text-surface-light text-xs' }}
      >
        Mark as Clinic
      </Checkbox>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="flat" onPress={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          size="sm"
          onPress={onConfirm}
          className="flex-1 bg-accent hover:bg-accent/90 text-surface-light"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
