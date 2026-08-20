/**
 * The bare-string form is a legacy shape kept intentionally unchanged: it is
 * load-bearing in scheduling, where `PostAssignment` keys posts by NAME, not
 * by object identity. A string post carries no coordinates of any kind and
 * never will.
 *
 * The object form's `lat`/`lon` follow the same system-of-record convention
 * as `CallPosition` in this file (read that doc comment first) — with the
 * roles reversed depending on which fields are present:
 *
 * - `lat`/`lon` ABSENT (the default, and the only shape any existing venue
 *   has today): `x`/`y` are the record, exactly as before. Nothing about
 *   this post's behaviour changes.
 * - `lat`/`lon` PRESENT: they become the record, and `x`/`y` are derived
 *   per-layer from the layer's georeference (see `postPercentOnLayer` in
 *   `lib/geoUtils.ts`), and may be `null` on any given layer when the point
 *   falls outside that layer's image — the post is still real, only the
 *   *drawing* on that particular raster is unavailable. This is what lets a
 *   Post be placed on a real basemap in a venue that has no map image at
 *   all: there is nothing for `x`/`y` to be a percentage OF, but `lat`/`lon`
 *   need no image to mean something.
 *
 * There is deliberately NO migration that backfills `lat`/`lon` onto
 * existing percent-only posts. An ungeoreferenced percent post has no true
 * lat/lon — synthesizing one from a guessed extent would produce a marker
 * that LOOKS authoritative and is wrong, which is the same failure the TAK
 * integration refuses when it records an off-map fix as `onMap: false`
 * rather than clamping it onto the image: a clamped (or guessed) marker is
 * a confident lie. A post only gets `lat`/`lon` when something actually
 * knows its ground position — e.g. it was placed directly on a georeferenced
 * basemap, or on a layer with no image at all.
 */
export type Post =
  | string
  | {
    name: string;
    x: number | null; // percentage of width
    y: number | null; // percentage of height
    isClinic?: boolean;
    /**
     * System-of-record latitude, in degrees. Present only for coordinate-
     * native posts — see the type-level doc comment above. When present,
     * this — not `x`/`y` — is the ground truth; `x`/`y` are re-derived per
     * layer on read (see `postPercentOnLayer`).
     */
    lat?: number;
    /** System-of-record longitude, in degrees. See `lat` above. */
    lon?: number;
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
  /**
   * Metres of uncertainty on lat/lon, when this point came from a device GPS
   * fix rather than a known coordinate. Undefined for hand-entered points,
   * which carry no honest uncertainty estimate either way — a typed
   * coordinate looked up from a survey marker and one guessed off a map are
   * both "no accuracy figure", and this field must not be made up a number
   * to fill that gap.
   *
   * This exists because `georeferenceResiduals` (see `lib/geoUtils.ts`)
   * measures how self-consistent the control points are against each
   * other — how well the fitted transform reproduces them — NOT how true
   * any of them are to the ground. A set of points all seeded from ±40 m
   * GPS fixes can agree with each other almost perfectly (a tight residual)
   * while being uniformly offset from reality by 40 m: the fit has no way
   * to detect an error that all its inputs share. Recording the accuracy
   * each point actually came in with is what lets a fit-quality readout
   * stop overstating itself — a caller can compare the residual against the
   * worst input accuracy and say "consistent, but only as trustworthy as
   * its coarsest GPS fix" instead of implying the residual alone is the
   * whole story.
   *
   * Optional field on an existing interface — no migration needed. Every
   * control point written before this field existed simply has none, which
   * is the correct reading for "accuracy unknown," not "point is exact."
   */
  accuracy?: number;
}

export interface Georeference {
  controlPoints: ControlPoint[];  // 2 = similarity transform, 3+ = least-squares affine
  version: number;                // bump on recalibration
  updatedAt: number;              // epoch ms
  updatedBy?: string;
  /**
   * The `Layer.mapUrl` these control points were last placed or confirmed
   * against.
   *
   * Control points are percentages of an image, and carry no reference to
   * WHICH image — so they survive a map swap unchanged and silently wrong.
   * `version` records that something invalidating happened, but only helps a
   * coordinate that was stamped at derivation time; it cannot tell an operator
   * reopening this venue tomorrow whether the calibration on screen still
   * describes the picture under it. Comparing this against the layer's current
   * `mapUrl` can, and it is derived rather than a flag, so there is no
   * "someone forgot to clear it" failure mode.
   *
   * Written only when the control points are actually placed or edited — NOT
   * when the map image is replaced. That asymmetry is the whole point: a swap
   * must leave the old URL behind so the mismatch persists across a save and
   * a reload.
   *
   * Optional because every georeference written before this field existed has
   * none. Absent means "unknown", which must never be reported as stale — see
   * `GeoreferenceStaleness` in `lib/geoUtils.ts` for why crying wolf on the
   * entire existing corpus is the worse error.
   */
  calibratedForMapUrl?: string;
}

export interface Layer {
  id: string;
  name: string;
  mapUrl?: string;
  posts: Post[];
  georeference?: Georeference;
}

/**
 * A saved opening camera for a venue's basemap view (TAK plan §8, Phase 8.I).
 *
 * This is VIEW state, not position state, and the distinction is the whole
 * reason it is safe: §8.C requires every marker to derive from lat/lon via
 * `geoUtils`, never from anything the map library owns. A camera never
 * becomes a marker — nothing reads these numbers to place anything — so
 * storing MapLibre's own view parameters here does not open the door §8.C
 * closes.
 *
 * It exists because the alternative is inference. `BasemapView` otherwise
 * frames itself from the venue raster's corners or from already-located
 * markers, and a venue that has NEITHER — a campus-scale venue with no
 * uploaded image and no georeference, which is the case that motivated this
 * — leaves MapLibre at its built-in world view, where a venue-sized PMTiles
 * extract has no tiles at all. An operator who has panned to the framing
 * they want is a better authority on that framing than any bounds we could
 * compute for them.
 *
 * Stored on `Venue` rather than `Layer` deliberately: layers are floors of
 * one building and share a single real-world footprint, so a per-layer
 * camera would be the same numbers repeated with an opportunity to disagree.
 */
export interface BasemapCamera {
  center: { lat: number; lon: number };
  zoom: number;
  /** Map rotation, degrees clockwise from north. Omitted when north-up. */
  bearing?: number;
  /** Camera tilt, degrees from straight down. Omitted when flat. */
  pitch?: number;
  /** Epoch ms, so a stale framing can be told from a deliberate one. */
  updatedAt?: number;
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
  /** Saved opening camera for basemap view. See `BasemapCamera`. */
  basemapCamera?: BasemapCamera;
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
/**
 * One intermediate fix on the way to a `TakPosition`, in map percentages.
 *
 * Deliberately not a full `TakPosition`: this is drawing data, not a record of
 * a reading. It exists so the marker can be animated along the route actually
 * taken, and carrying accuracy, callsign or lat/lon per point would multiply
 * the size of every position write for information nothing renders.
 */
export interface TakPathPoint {
  /** Percent of venue map width — same units as `Post.x`. */
  x: number;
  /** Percent of venue map height — same units as `Post.y`. */
  y: number;
  /** Epoch ms when the bridge received this fix, on the bridge's clock. */
  t: number;
}

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
  /**
   * Fixes received between this position and the previous write, oldest first
   * and excluding this one. Empty whenever the device reports no faster than
   * the bridge writes, which is the normal case.
   *
   * The bridge used to keep only the newest fix per callsign and discard the
   * rest, so the map had two points seconds apart and no choice but to draw the
   * straight line between them — a unit rounding a corner appeared to cut
   * through it. Interpolating along this path instead follows the route that
   * was actually taken. Off-map fixes are omitted rather than clamped, on the
   * same reasoning as `onMap`.
   */
  path?: TakPathPoint[];
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

/**
 * One row of the `tak_positions` collection — a live position as the bridge
 * stores it.
 *
 * Why this is not just a `TakPosition` inside the event
 * ----------------------------------------------------
 * It used to be. Teams live as a JSON array inside a single `events` record, so
 * writing one team's position meant reading the whole event, editing one array
 * element, and writing the entire array back — while the dispatcher's browser
 * was editing the same record. PocketBase has no multi-document transactions
 * and no per-record version token, so that read-modify-write could silently
 * clobber a status change with no error anywhere.
 *
 * Splitting positions into their own collection draws the line along ownership:
 * the `events` record holds what humans edit, and `tak_positions` holds what the
 * machine writes. Two writers never touch the same record, so the race is gone
 * rather than merely narrowed — which is what makes writing a position every
 * second safe.
 *
 * One record per (`eventId`, `callsign`). The bridge upserts by that pair and
 * never reads or writes the event at all.
 */
export interface TakPositionRecord extends TakPosition {
  /** PocketBase record id. Absent on a record being created. */
  id?: string;
  /** Event this position belongs to. */
  eventId: string;
  /** Device callsign. Required here — it is half the record's identity. */
  callsign: string;
  /**
   * Team name supplied by the bridge's `--bind` flag, when one was used. Only a
   * fallback for matching: `Staff.takCallsign` is the authoritative binding.
   */
  boundTeam?: string;
  /** CoT `uid` of the reporting device, for tracing a marker back to a client. */
  uid?: string;
  /** CoT type string (`a-f-G-U-C`, …), kept for debugging misclassified events. */
  cotType?: string;
}

export interface Staff {
  team: string;
  location: string;
  status: string;
  members: string[];
  log?: TeamLogEntry[];
  originalPost?: string;
  /**
   * Last known live position. **No longer persisted** — since positions moved to
   * the `tak_positions` collection, nothing writes this field to the database.
   * It is merged in client-side by `useTakPositions` so the map can keep reading
   * `team.tak`, and any value still stored on an old event record is ignored.
   */
  tak?: TakPosition;
  /**
   * TAK callsign whose position reports belong to this team. This is the
   * authoritative binding, and it is dispatcher-owned: the bridge only ever
   * reads it, so changing it takes effect without restarting anything.
   */
  takCallsign?: string;
}

export interface Supervisor {
  team: string;
  location: string;
  status: string;
  member: string;
  log?: TeamLogEntry[];
  originalPost?: string;
  /** Merged in client-side from `tak_positions`, exactly as on `Staff`. */
  tak?: TakPosition;
  /** TAK callsign bound to this supervisor. Same semantics as `Staff.takCallsign`. */
  takCallsign?: string;
}

/**
 * How a position came to exist.
 *
 * `'manual'` is a dispatcher clicking the venue map; `'tak'` is a pin dropped on
 * a phone and then *explicitly accepted* by dispatch. The distinction is kept
 * forever because it is the difference between a coordinate CrowdCAD authored
 * and one it received. CrowdCAD is the system of record for call state, so a
 * position that arrived over the wire must stay identifiable as such rather than
 * being laundered into looking dispatcher-authored.
 *
 * Not to be confused with the `PositionSource` that was deleted from this file
 * along with `TeamPosition` (see the note at the end of the file): that one
 * described *live GPS* provenance for a team. This describes how a *call* got a
 * coordinate. Different concept, same obvious name.
 */
export type PositionSource = 'manual' | 'tak';

/**
 * A call's own location, independent of any named post.
 *
 * **`lat`/`lon` is the system of record; `x`/`y` are derived for drawing.** That
 * is the *inverse* of `Post`, deliberately:
 *
 * | | authored by | system of record | derived on read |
 * |---|---|---|---|
 * | `Post` | clicking the venue image | percent of image (`x`, `y`) | lat/lon |
 * | `CallPosition` | clicking the map **or** a pin from a phone | **lat/lon** | percent of image |
 *
 * A post only ever comes into existence by clicking an image, so image
 * coordinates are its natural system of record. A call pin can arrive from a
 * phone that has never seen the image, so lat/lon is the only representation
 * both sources share. Storing a call as percent-of-image would make an inbound
 * TAK pin unrepresentable until somebody chose a layer for it, and at ingest
 * time that choice would fall to the bridge — the component least qualified to
 * make it, since it knows sockets, not venues.
 *
 * **Consequence, accepted deliberately:** a call cannot be pinned on an
 * uncalibrated layer at all. There is no percent-only degraded mode. A call
 * position that cannot be expressed as lat/lon cannot be published to TAK,
 * cannot be handed to a partner agency, and cannot be compared against a team's
 * GPS fix; it is a coordinate in name only. Supporting it would make
 * calibration look optional when calibration is the entire mechanism.
 */
export interface CallPosition {
  lat: number;
  lon: number;
  /**
   * Percent of venue map width — same units as `Post.x` — derived via the
   * layer's georeference. Null when the point falls outside this layer's image:
   * the pin is still real and still published; it is the *drawing* that is
   * unavailable.
   */
  x: number | null;
  /** Percent of venue map height — same units as `Post.y`. Null as for `x`. */
  y: number | null;
  /**
   * Layer the pin is drawn on. Initially resolved by georeference containment,
   * but **correctable by dispatch** — unlike `TakPosition.layerId`, which is
   * only advisory, this is durable call state. GPS altitude cannot separate
   * stadium levels, so containment alone puts a pin dropped on level 3 onto
   * whichever layer's bounds happen to contain it. A human has to be able to say
   * otherwise, and that correction has to survive.
   */
  layerId?: string;
  /**
   * Which `Georeference.version` produced `x`/`y`. A mismatch against the
   * layer's current version means the map image or its calibration changed
   * underneath this pin, so the derived percentages point somewhere the pin
   * never was. Stale coordinates are surfaced, never silently redrawn.
   */
  georeferenceVersion?: number;
  source: PositionSource;
  /** Epoch ms when the pin was placed, or for `'tak'`, when it was accepted. */
  placedAt: number;
  placedBy?: string;
  /**
   * CoT `uid` of the originating pin, when `source` is `'tak'`. Provenance only
   * — **never** used to locate the call. The device that reported a pin may have
   * moved a mile since, and its own position is unrelated to the pin's.
   */
  takUid?: string;
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
  /**
   * The call's own coordinate, when one was placed.
   *
   * Absent means legacy behaviour, which is still the common case: the call's
   * position is resolved by matching the free-text `location` against a placed
   * post's name, and a call whose location is not a named post has no position
   * at all.
   *
   * This does **not** supersede `location`. Free text stays the primary field in
   * the Quick Call flow — dispatchers type what the caller said, under time
   * pressure, and `"NW concourse, by gate 4"` carries information a coordinate
   * does not. The two are complementary.
   */
  position?: CallPosition;
}

/**
 * One unreviewed inbound pin, dropped by hand on a TAK client.
 * Collection: `tak_pin_reports`.
 *
 * **A pin report is not a `Call` and must never be written into `Event.calls`.**
 * CrowdCAD is the system of record for call state and TAK is never authoritative
 * for it. Auto-creating a call from a pin would make a tactical map app, running
 * on a volunteer-managed phone fleet, an unauthenticated writer to the call
 * queue. A pin is a *proposal*: dispatch either accepts it — creating a real
 * `Call` with `position.source = 'tak'` — or dismisses it. The accept action is
 * where a human supplies the chief complaint, which is precisely the field a pin
 * cannot carry and dispatch must not invent.
 */
export interface TakPinReport {
  id: string;
  eventId: string;
  orgId: string;
  lat: number;
  lon: number;
  /**
   * Operator-typed label from the device.
   *
   * **UNTRUSTED FREE TEXT, and a possible PHI carrier.** Somebody typing a
   * patient's name or condition into a marker label on their phone is entirely
   * plausible. Never auto-copy this into any `Call` field; show it to the
   * reviewing dispatcher and let them decide what, if anything, belongs in the
   * record.
   */
  label?: string;
  /** Device remarks. Same trust level and same PHI caution as `label`. */
  remarks?: string;
  takUid: string;
  takCallsign?: string;
  cotType: string;
  /** Epoch ms on the reporting device's clock. */
  timestamp: number;
  /** Epoch ms on the server's clock, when the bridge received it. */
  receivedAt: number;
  status: 'pending' | 'accepted' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: number;
  /** Set when accepted, so a pin can be traced to the call it became. */
  callId?: string;
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

// --- Why there is only one live-position model ------------------------------
//
// Two TAK efforts ran in parallel and each independently designed a live GPS
// position type: `TakPosition`/`TakPositionRecord` (above) and a `TeamPosition`
// with a parallel `Staff.position` mirror. Both reached the SAME structural
// conclusion for the same three reasons — positions belong in their own
// top-level collection, never nested in the Event document, because (1) an
// Event doc is one record every dispatcher subscribes to and has a practical
// ~1 write/sec ceiling that device-rate GPS blows straight past, (2) high-rate
// position writes would contend with dispatcher edits in the same record, and
// (3) every listening client would otherwise re-download the whole event
// payload on every GPS tick. That agreement is the strongest evidence the
// design is right.
//
// `TeamPosition`, `PositionSource`, `Staff.position` and `Supervisor.position`
// were deleted when the branches were merged, because `TakPositionRecord` is
// the one that is actually built, wired to the bridge, and proven against a
// real FreeTAKServer. Keeping both would have meant two names for one concept
// and a standing invitation to write to the wrong one.
//
// If you need something the deleted type had and `TakPosition` lacks — `orgId`,
// `hae`, `heading`, `speed`, a server-side `receivedAt` distinct from device
// `timestamp`, an advisory `layerId`, or a `source` discriminator for non-TAK
// position providers — ADD IT TO `TakPosition`/`TakPositionRecord` above. Do
// not reintroduce a second position type.
