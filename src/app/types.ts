export type Post =
  | string
  | {
    name: string;
    x: number | null; // percentage of width
    y: number | null; // percentage of height
    isClinic?: boolean;
    clinicId?: string; // stable id, set once when isClinic first becomes true
  };

export interface Clinic {
  id: string;
  name: string;
}

export interface Layer {
  id: string;
  name: string;
  mapUrl?: string;
  posts: Post[];
}

export interface Venue {
  id: string;
  name: string;
  equipment: Equipment[];
  layers?: Layer[];
  posts?: Post[];
  mapUrl?: string;
  userId: string;
  sharedWith?: string[]; // Array of emails
  isOrgVenue?: boolean; // Visible to all users on this instance, set by an admin
}

export interface Event {
  id: string;
  name: string;
  date: string;
  venue: Venue;
  sharedWith?: string[]; // Array of emails
  isOrgEvent?: boolean; // Visible to every member of the org, set by an admin
  postingTimes: string[];
  staff: Staff[];
  supervisor: Supervisor[];
  userId: string;
  calls: Call[];
  status?: 'draft' | 'active';
  createdAt?: string | number;
  pendingAssignments?: {
    [team: string]: { post: string; time: string };
  };
  eventPosts: Post[];
  eventEquipment: EventEquipment[];
  ended?: boolean;
  postAssignments?: PostAssignment;
  clinics?: Clinic[];

  postingStart?: string | number;
  postingEnd?: string | number;
  scheduleStart?: string | number;
  scheduleEnd?: string | number;
  startTime?: string | number;
  endTime?: string | number;
  start?: string | number;
  end?: string | number;

  interactionSessions?: InteractionSession[];

  /** Percent of teams actively on calls at which the surge display turns red. Defaults to 70 when unset. */
  surgeLimitPercent?: number;
}

export interface TeamLogEntry {
  timestamp: number;
  message: string;
}

export interface Staff {
  team: string;
  location: string;
  status: string;
  members: string[];
  log?: TeamLogEntry[];
  originalPost?: string;
}

export interface Supervisor {
  team: string;
  location: string;
  status: string;
  member: string;
  log?: TeamLogEntry[];
  originalPost?: string;
}

export type PostAssignment = {
  [time: string]: {
    [post: string]: string;
  };
};

export interface CallLogEntry {
  timestamp: number;
  message: string;
}

export interface DetachedTeam {
  team: string;
  reason: string;
  /** What kind of assignment this was, so a revert knows how to restore it. Defaults to 'team' when absent (legacy data). */
  kind?: 'team' | 'supervisor' | 'equipment';
  /** Status the team/supervisor held immediately before this detachment, used to revert. */
  previousStatus?: string;
  /** Location the team/supervisor held immediately before this detachment, used to revert. */
  previousLocation?: string;
  /** Names of equipment items that moved off this team at detach time (kind === 'equipment' only), used to revert. */
  equipmentNames?: string[];
}

export type ClinicOutcome = "Discharged" | "AMA" | "Rolled from Clinic" | "Transported";

export interface Call {
  id: string;
  order: number;
  status: string;
  location: string;
  assignedTeam: string[];
  chiefComplaint: string;
  source?: string;
  age?: string;
  gender?: string;
  priority?: boolean;
  duplicate?: boolean;
  duplicateOf?: string;
  log?: CallLogEntry[];
  notes?: string;
  detachedTeams?: DetachedTeam[];
  equipmentTeams?: string[];
  equipment?: string[];
  clinic?: boolean;
  clinicId?: string;
  outcome?: ClinicOutcome;
  /** Ambulance/transport unit number captured when outcome is set to 'Transported'. */
  transportUnit?: string;
}

export interface CallLogEntry {
  timestamp: number;
  message: string;
}

export type EquipmentStatus = string;

export interface Equipment {
  id: string;
  name: string;
  status: EquipmentStatus;
  assignedTeam?: string | null;
  location?: string;
}

export type EventEquipment = Equipment & { locationId?: string; defaultLocation?: string; notes?: string };

export interface Area {
  id: string;
  shape: "circle" | "rect" | "poly";
  coords: number[];
  preFillColor: string;
  fillColor: string;
  strokeColor: string;
  lineWidth: number;
  active: boolean;
  disabled: boolean;
}

export interface ImgMap {
  name: string;
  areas: Area[];
}

export interface MouseClickLog {
  timestamp: number;
}

export interface KeyStrokeLog {
  timestamp: number;
}

export interface InteractionSession {
  sessionId: string;
  eventId: string;
  startTime: number;
  endTime?: number;
  mouseClicks: MouseClickLog[];
  keyStrokes: KeyStrokeLog[];
}

export type EquipmentItem = {
  name: string;
  stagingLocation: string; // Default/designated staging location
  currentLocation?: string; // Current location override
  status: string; // 'Available' or 'Call X'
  callId?: string; // Associated call ID if on a call
  deliveryTeam?: string; // Team delivering the equipment
  needsRefresh?: boolean; // Whether equipment needs to be marked ready after clinic delivery
  notes?: string; // Additional details/notes about the equipment
};

export type Role = {
  name: string;
  fullName: string;
}