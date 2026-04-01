import React from 'react';
import { Event, Staff } from '@/app/types';
import TeamCard from '@/components/dispatch/teamcard';
import TeamCardCondensed from '@/components/dispatch/teamcard-condensed';

type TeamWidgetProps = {
  staff: Staff;
  event: Event;
  callDisplayNumberMap: Map<string, number>;
  teamTimers: { [team: string]: number };
  onStatusChange: (staff: Staff, newStatus: string) => void;
  onLocationChange: (staff: Staff, newLocation: string) => void;
  onEditTeam?: (staff: Staff) => void;
  onDeleteTeam?: (team: string) => void;
  onRefreshTeamPost?: (team: string) => void;
  updateEvent: (updates: Partial<Event>) => Promise<void>;
  cardViewMode?: 'normal' | 'condensed';
};

const TeamWidget = React.memo(function TeamWidget(props: TeamWidgetProps) {
  const {
    staff,
    event,
    teamTimers,
    onStatusChange,
    onLocationChange,
    onEditTeam,
    onDeleteTeam,
    onRefreshTeamPost,
    updateEvent,
    cardViewMode = 'normal',
  } = props;

  const CardComponent = cardViewMode === 'condensed' ? TeamCardCondensed : TeamCard;

  return (
    <CardComponent
      staff={staff}
      event={event}
      sinceMs={teamTimers?.[staff.team]}
      onStatusChange={onStatusChange}
      onLocationChange={onLocationChange}
      onEdit={onEditTeam}
      onDelete={onDeleteTeam}
      onRefreshPost={onRefreshTeamPost}
      updateEvent={updateEvent}
    />
  );
});

export default TeamWidget;
