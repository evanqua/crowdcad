import type { Event } from '@/app/types';

export type DispatchStatusColor = {
  borderClass: string;
  fillClass: string;
  textClass: string;
  chipClass: string;
  rowClass: string;
};

const DEFAULT_STATUS_COLOR: DispatchStatusColor = {
  borderClass: 'border-surface-liner',
  fillClass: 'bg-surface-liner/30',
  textClass: 'text-surface-light',
  chipClass: 'border border-surface-liner bg-surface-liner/30',
  rowClass: '',
};

export const TEAM_CARD_ROW_HOVER_CLASS = 'hover:bg-surface-deep';

export const STATUS_COLORS: Record<string, DispatchStatusColor> = {
  Available: DEFAULT_STATUS_COLOR,
  Assigned: DEFAULT_STATUS_COLOR,
  Pending: DEFAULT_STATUS_COLOR,
  Detached: DEFAULT_STATUS_COLOR,
  Delivered: DEFAULT_STATUS_COLOR,
  'Delivered Eq': {
    borderClass: 'border-status-card-yellow',
    fillClass: 'bg-status-card-yellow/20',
    textClass: 'text-status-orange',
    chipClass: 'border border-status-card-yellow bg-status-card-yellow/20',
    rowClass: '',
  },
  Refusal: DEFAULT_STATUS_COLOR,
  NMM: DEFAULT_STATUS_COLOR,
  Resolved: DEFAULT_STATUS_COLOR,
  Rolled: DEFAULT_STATUS_COLOR,
  'Rolled from Scene': DEFAULT_STATUS_COLOR,
  'Unable to Locate': DEFAULT_STATUS_COLOR,
  'On Break': {
    borderClass: 'border-status-card-blue',
    fillClass: 'bg-status-card-blue/20',
    textClass: 'text-status-blue',
    chipClass: 'border border-status-card-blue bg-status-card-blue/20',
    rowClass: '',
  },
  'In Clinic': {
    borderClass: 'border-status-card-blue',
    fillClass: 'bg-status-card-blue/20',
    textClass: 'text-status-blue',
    chipClass: 'border border-status-card-blue bg-status-card-blue/20',
    rowClass: '',
  },
  'En Route Eq': {
    borderClass: 'border-status-card-yellow',
    fillClass: 'bg-status-card-yellow/20',
    textClass: 'text-status-orange',
    chipClass: 'border border-status-card-yellow bg-status-card-yellow/20',
    rowClass: '',
  },
  Assisting: {
    borderClass: 'border-status-card-yellow',
    fillClass: 'bg-status-card-yellow/20',
    textClass: 'text-status-orange',
    chipClass: 'border border-status-card-yellow bg-status-card-yellow/20',
    rowClass: '',
  },
  'En Route': {
    borderClass: 'border-status-card-red',
    fillClass: 'bg-status-card-red/20',
    textClass: 'text-status-red',
    chipClass: 'border border-status-card-red bg-status-card-red/20',
    rowClass: 'bg-status-card-red',
  },
  'On Scene': {
    borderClass: 'border-status-card-red',
    fillClass: 'bg-status-card-red/20',
    textClass: 'text-status-red',
    chipClass: 'border border-status-card-red bg-status-card-red/20',
    rowClass: 'bg-status-card-red',
  },
  Transporting: {
    borderClass: 'border-status-card-red',
    fillClass: 'bg-status-card-red/20',
    textClass: 'text-status-red',
    chipClass: 'border border-status-card-red bg-status-card-red/20',
    rowClass: 'bg-status-card-red',
  },
};

export function getStatusColor(status?: string | null): DispatchStatusColor {
  if (!status) return DEFAULT_STATUS_COLOR;
  return STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
}

export function deriveTeamVisualStatus(status: string, event: Event, team: string): string {
  const onEqRun =
    !!event.calls?.some(
      c => c.equipmentTeams?.includes(team) && !['Resolved', 'Delivered', 'Delivered Eq', 'Refusal', 'NMM'].includes(c.status)
    ) || ['En Route Eq', 'Assisting'].includes(status);

  if (onEqRun) return 'En Route Eq';

  const activeCare = !!event.calls?.some(
    c => c.assignedTeam?.includes(team) && !['Resolved', 'Delivered', 'Delivered Eq', 'Refusal', 'NMM'].includes(c.status)
  );

  if (activeCare) return 'En Route';

  return status;
}

const ROW_STATUS_PRIORITY = ['Transporting', 'On Scene', 'En Route'];

export function getRowStatusClass(statuses: string[]): string {
  for (const status of ROW_STATUS_PRIORITY) {
    if (statuses.includes(status)) {
      return getStatusColor(status).rowClass;
    }
  }
  return '';
}
