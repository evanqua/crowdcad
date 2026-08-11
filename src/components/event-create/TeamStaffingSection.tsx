import React from 'react';
import { Button, ButtonGroup, Card, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, ScrollShadow } from '@heroui/react';
import { Trash2, ChevronDown } from 'lucide-react';
import type { Staff } from '@/app/types';

type Props = {
  staff: Staff[];
  openTeams: Record<number, boolean>;
  setOpenTeams: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onDeleteTeam: (idx: number) => void;
  onAddTeam: () => void;
  onUploadCSV: () => void;
};

export default function TeamStaffingSection({
  staff,
  openTeams,
  setOpenTeams,
  onDeleteTeam,
  onAddTeam,
  onUploadCSV,
}: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between">
        <h3 className="text-surface-light font-semibold text-lg">Teams</h3>
        <ButtonGroup>
          <Button
            size="sm"
            onPress={onAddTeam}
            className="h-8 px-3 text-sm text-surface-light bg-zinc-700 hover:bg-zinc-600"
            data-testid="add-team-button"
          >
            Add Team
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                size="sm"
                className="h-8 min-w-8 w-8 text-surface-light bg-zinc-700 hover:bg-zinc-600"
                aria-label="More add-team options"
              >
                <ChevronDown className="h-4 w-4 text-surface-light" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Team add options"
              onAction={(key) => {
                if (key === 'upload-csv') onUploadCSV();
              }}
            >
              <DropdownItem key="upload-csv">Upload CSV</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </ButtonGroup>
      </div>

      <div className="px-4 py-3 flex-1 min-h-0 flex flex-col">
        <ScrollShadow className="space-y-2 pr-2 scrollbar-hide flex-1 min-h-0" hideScrollBar style={{ overflow: 'auto' }}>
          {staff.map((team, idx) => (
            <Card key={idx} isBlurred className="rounded-2xl bg-surface-deeper/90">
              <div
                className="flex items-center justify-between px-3 py-2 gap-2 cursor-pointer"
                onClick={() => setOpenTeams((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              >
                <span className="text-surface-light font-medium truncate">{team.team}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTeam(idx);
                    }}
                    className="p-1 rounded bg-transparent"
                    aria-label="Delete team"
                  >
                    <Trash2 className="h-4 w-4 text-surface-light" />
                  </button>
                </div>
              </div>
              {openTeams[idx] && (
                <ul className="px-3 pb-2 list-disc list-inside text-sm text-gray-300">
                  {team.members.map((member, mIdx) => (
                    <li key={mIdx}>{member}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </ScrollShadow>
      </div>
    </div>
  );
}
