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

export interface ControlPoint {
  x: number;      // percentage of image width,  0-100
  y: number;      // percentage of image height, 0-100
  lat: number;
  lon: number;
  label?: string; // e.g. "NW corner of main stage"
}

export interface Georeference {
  controlPoints: ControlPoint[];  // 2 = similarity transform, 3+ = least-squares affine
  version: number;                // bump on recalibration
  updatedAt: number;              // epoch ms
  updatedBy?: string;
}

export interface Layer {
  id: string;
  name: string;
  mapUrl?: string;
  posts: Post[];
  georeference?: Georeference;
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

  tak?: TakPublishSettings;
}

export interface TeamLogEntry {
  timestamp: number;
  message: string;
}

export interface Staff {
  team: string;
  location: string;
  // Low-rate "last known position" mirror only. Device-rate GPS updates are
  // written to the top-level TeamPosition collection, NOT here — see the
  // comment on TeamPosition for why. Keep it that way: do not start writing
  // high-rate position updates into this field.
  position?: {
    lat: number;
    lon: number;
    accuracy: number;             // metres, CEP
    timestamp: number;            // epoch ms
  };
  status: string;
  members: string[];
  log?: TeamLogEntry[];
  originalPost?: string;
  takUid?: string;
  positionSource?: PositionSource;
}

export interface Supervisor {
  team: string;
  location: string;
  position?: {
    lat: number;
    lon: number;
    accuracy: number;             // metres, CEP
    timestamp: number;            // epoch ms
  };
  status: string;
  member: string;
  log?: TeamLogEntry[];
  originalPost?: string;
  takUid?: string;
  positionSource?: PositionSource;
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

// --- TAK (Team Awareness Kit) / CoT bridge -------------------------------

export type TakCallPublishMode = 'off' | 'location-only' | 'full';

// Per-event configuration for the CoT bridge that mirrors CrowdCAD dispatch
// state out to TAK clients (ATAK-CIV, WinTAK, etc).
//
// This document is deliberately NON-SECRET: it lives on the Event document,
// which any member of the owning organization can read. Certificates, key
// passwords, and server auth tokens for the TAK server connection must NEVER
// be stored here (or anywhere in Firestore/PocketBase) — they belong in a
// server-side secret store, referenced by ID/name if needed, never by value.
export interface TakPublishSettings {
  enabled: boolean;
  publishTeams: boolean;
  publishSupervisors: boolean;
  publishPosts: boolean;
  publishCalls: TakCallPublishMode;
  callsignPrefix?: string;
  cotGroup?: string;
  staleSeconds?: number;
  publishIntervalSeconds?: number;
}

export type PositionSource = 'tak' | 'field-client' | 'manual';

// A single team's live GPS position, written at device rate (potentially
// multiple times per second per team).
//
// This is intentionally a SEPARATE top-level collection, not a field nested
// inside the Event document, for three reasons:
//   1. Write-rate: an Event document (calls, staff, assignments — everything
//      dispatchers edit) is ONE document that every dispatcher client
//      subscribes to. Firestore documents have a practical ~1 write/sec
//      limit; device-rate GPS writes would blow straight past that.
//   2. Contention: high-rate position writes landing in the same document as
//      dispatcher edits (status changes, call assignments, etc.) would
//      constantly race/contend inside the same transaction.
//   3. Bandwidth: every dispatcher client listening to the Event document
//      would have to re-download the ENTIRE event payload on every single
//      GPS tick from every team, instead of subscribing to position updates
//      independently.
//
// `Staff.position` (see above) is kept as a low-rate "last known position"
// mirror ONLY, so that nobody is tempted to re-plumb high-rate GPS writes
// into the Event document later.
export interface TeamPosition {
  eventId: string;
  orgId: string;
  team: string;
  lat: number;
  lon: number;
  accuracy: number;   // metres, CEP
  hae?: number;       // height above ellipsoid, metres
  heading?: number;   // degrees true
  speed?: number;     // m/s
  timestamp: number;  // epoch ms, device time
  receivedAt: number; // epoch ms, server time
  source: PositionSource;
  takUid?: string;
  layerId?: string;   // advisory best-guess venue layer
}