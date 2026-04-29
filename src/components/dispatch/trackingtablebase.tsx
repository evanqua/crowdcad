'use client';

import React from 'react';

interface TrackingTableBaseProps {
  TableColGroup: React.ComponentType;
  showStatusColumn: boolean;
  showTeamAssignmentChips: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export default function TrackingTableBase({
  TableColGroup,
  showStatusColumn,
  showTeamAssignmentChips,
  children,
  footer,
  className,
}: TrackingTableBaseProps) {
  return (
    <div className={`w-full ${className || ''}`.trim()} data-team-chips={showTeamAssignmentChips ? 'on' : 'off'}>
      <div className="overflow-x-auto w-full">
        <table className="min-w-[870px] w-full text-[14px] sm:text-[15px] text-surface-light table-fixed border-separate border-spacing-0">
          <TableColGroup />
          <thead>
            <tr className="border-b border-surface-liner">
              <th className="px-3 py-2.5 text-left text-surface-faint w-16">Call #</th>
              <th className="px-3 py-2.5 text-left text-surface-faint w-40">Chief Complaint</th>
              <th className="px-3 py-2.5 text-left text-surface-faint w-16">A/S</th>
              <th className="px-3 py-2.5 text-left text-surface-faint w-48">Location</th>
              {showStatusColumn && <th className="px-3 py-2.5 text-left text-surface-faint w-28">Status</th>}
              <th className="px-3 py-2.5 text-left text-surface-faint">Team</th>
              <th className="px-3 py-2.5 text-right text-surface-faint w-12"></th>
            </tr>
          </thead>

          <tbody className="[&>tr>td]:border-b [&>tr>td]:border-surface-liner">{children}</tbody>
        </table>
      </div>

      {footer}
    </div>
  );
}
