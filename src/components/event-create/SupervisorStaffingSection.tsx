import React from 'react';
import { Button, ScrollShadow } from '@heroui/react';
import { Trash2, Plus } from 'lucide-react';
import type { Supervisor } from '@/app/types';

type Props = {
  supervisors: Supervisor[];
  openSupervisors: Record<number, boolean>;
  setOpenSupervisors: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onDeleteSupervisor: (idx: number) => void;
  onAddSupervisor: () => void;
};

export default function SupervisorStaffingSection({
  supervisors,
  openSupervisors,
  setOpenSupervisors,
  onDeleteSupervisor,
  onAddSupervisor,
}: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between">
        <h3 className="text-surface-light font-semibold text-lg">Supervisors</h3>
        <Button
          isIconOnly
          size="sm"
          onPress={onAddSupervisor}
          className="min-w-8 w-8 h-8"
          style={{ backgroundColor: '#27272a' }}
          aria-label="Add Supervisor"
        >
          <Plus className="h-4 w-4 text-surface-light" />
        </Button>
      </div>

      <div className="px-4 py-3 flex-1 min-h-0 flex flex-col">
        <ScrollShadow className="space-y-2 pr-2 scrollbar-hide flex-1 min-h-0" hideScrollBar style={{ overflow: 'auto' }}>
          {supervisors.map((supervisor, idx) => (
            <div key={idx} className="rounded-2xl p-3" style={{ backgroundColor: '#27272a' }}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setOpenSupervisors((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              >
                <span className="text-surface-light font-medium">{supervisor.team}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSupervisor(idx);
                    }}
                    className="p-1 rounded bg-transparent"
                    aria-label="Delete supervisor"
                  >
                    <Trash2 className="h-4 w-4 text-surface-light" />
                  </button>
                </div>
              </div>
              {openSupervisors[idx] && (
                <ul className="mt-2 list-disc list-inside text-sm text-gray-300">
                  <li>{supervisor.member}</li>
                </ul>
              )}
            </div>
          ))}
        </ScrollShadow>
      </div>
    </div>
  );
}
