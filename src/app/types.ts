export type Post =
  | string
  | {
    name: string;
    x: number | null; // percentage of width
    y: number | null; // percentage of height
    isClinic?: boolean;
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
}

export interface TeamLogEntry {
  timestamp: number;
  message: string;
}

/**
 * A team's live GPS position, reported by a TAK client (ATAK/iTAK) and written
 * by the CrowdCAD-TAK bridge.
 *
 * This is the only geographic concept in the data model. Everywhere else a
 * position is a percentage of the venue map image (see `Post`), because a venue
 * map is just a picture with no inherent coordinate system. The bridge does the
 * projection and stores both forms: `lat`/`lon` are the ground truth it
 * received, and `x`/`y` are that position expressed in the same units as
 * `Post.x`/`Post.y` so the map can draw it without knowing any geography.
 *
 * Every field is optional on the parent because a team with no TAK device
 * simply never has one, and nothing in the app requires it.
 */
export interface TakPosition {
  lat: number;
  lon: number;
  /** Percent of venue map width — same units as `Post.x`. Null if unprojectable. */
  x: number | null;
  /** Percent of venue map height — same units as `Post.y`. Null if unprojectable. */
  y: number | null;
  /**
   * False when the unit is outside the venue map's bounds. The position is
   * still recorded rather than clamped, so the UI can choose to hide the
   * marker instead of drawing it somewhere the unit demonstrably is not.
   */
  onMap: boolean;
  /** Epoch ms when the bridge received the position. */
  timestamp: number;
  /** TAK callsign that reported it, for tracing a marker back to a device. */
  callsign?: string;
  /** Reported accuracy in metres (CoT circular error); absent when unknown. */
  accuracy?: number;
  /** Epoch ms after which the reporting client considers this position stale. */
  staleAt?: number;
  /**
   * Nearest `Post` by map distance, as context only. Deliberately NOT written
   * into `location`: that field drives post assignments, and letting GPS
   * silently reassign a team would be a destructive side effect of walking.
   */
  nearestPost?: string;
}

export interface Staff {
  team: string;
  location: string;
  status: string;
  members: string[];
  log?: TeamLogEntry[];
  originalPost?: string;
  tak?: TakPosition;
}

export interface Supervisor {
  team: string;
  location: string;
  status: string;
  member: string;
  log?: TeamLogEntry[];
  originalPost?: string;
  tak?: TakPosition;
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

interface DetachedTeam {
  team: string;
  reason: string;
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