import React from 'react';
import { Button, ScrollShadow } from '@heroui/react';
import { Trash2, Plus } from 'lucide-react';
import type { Staff } from '@/app/types';

type Props = {
  staff: Staff[];
  openTeams: Record<number, boolean>;
  setOpenTeams: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onDeleteTeam: (idx: number) => void;
  onAddTeam: () => void;
};

export default function TeamStaffingSection({
  staff,
  openTeams,
  setOpenTeams,
  onDeleteTeam,
  onAddTeam,
}: Props) {
  return (
    <>
      <div className="flex-shrink-0 px-3 py-3 flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">Teams</h3>
        <Button
          isIconOnly
          size="sm"
          onPress={onAddTeam}
          className="min-w-8 w-8 h-8"
          style={{ backgroundColor: '#27272a' }}
        >
          <Plus className="h-4 w-4 text-white" />
        </Button>
      </div>

      <div className="px-4 py-3">
        <ScrollShadow className="space-y-2 pr-2 scrollbar-hide" hideScrollBar style={{ minHeight: 'calc(100vh - 334px)', maxHeight: 'calc(100vh - 334px)', overflow: 'auto' }}>
          {staff.map((team, idx) => (
            <div key={idx} className="rounded-2xl p-3" style={{ backgroundColor: '#27272a' }}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setOpenTeams((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              >
                <span className="text-white font-medium">{team.team}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTeam(idx);
                    }}
                    className="p-1 rounded bg-transparent"
                    aria-label="Delete team"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              {openTeams[idx] && (
                <ul className="mt-2 list-disc list-inside text-sm text-gray-300">
                  {team.members.map((member, mIdx) => (
                    <li key={mIdx}>{member}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </ScrollShadow>
      </div>
    </>
  );
}
