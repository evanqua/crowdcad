import React from 'react';
import { Event, Staff } from '@/app/types';
import TeamCard from '@/components/dispatch/teamcard';
import TeamCardCondensed from '@/components/dispatch/teamcard-condensed';

type TeamWidgetProps = {
  staff: Staff;
  event: Event;
  callDisplayNumberMap: Map<string, number>;
  teamTimers: { [team: string]: number };
  onStatusChange: (staff: Staff, newStatus: string, clinicId?: string) => void;
  onLocationChange: (staff: Staff, newLocation: string) => void;
  onEditTeam?: (staff: Staff) => void;
  onDeleteTeam?: (team: string) => void;
  onRefreshTeamPost?: (team: string) => void;
  onNewCall?: (team: string) => void;
  updateEvent: (updates: Partial<Event>) => Promise<void>;
  cardViewMode?: 'normal' | 'condensed';
  hasVenueMap?: boolean;
  onViewOnMap?: (teamName: string) => void;
  /** Every post name actually placeable on the map — gates whether the "view on map" button is clickable (disabled if this team/supervisor's location isn't one of them). */
  knownMapLocations?: Set<string>;
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
    onNewCall,
    updateEvent,
    cardViewMode = 'normal',
    hasVenueMap,
    onViewOnMap,
    knownMapLocations,
  } = props;

  const CardComponent = cardViewMode === 'condensed' ? TeamCardCondensed : TeamCard;
  const canLocateOnMap = !!hasVenueMap && !!staff.location && !!knownMapLocations?.has(staff.location);

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
      onNewCall={onNewCall}
      updateEvent={updateEvent}
      hasVenueMap={hasVenueMap}
      onViewOnMap={onViewOnMap}
      canLocateOnMap={canLocateOnMap}
    />
  );
});

export default TeamWidget;
