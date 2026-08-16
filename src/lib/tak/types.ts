// CoT (Cursor on Target) domain model.
//
// CoT is the XML message format TAK clients (ATAK-CIV, WinTAK, iTAK) and TAK
// servers speak. These types model just enough of a CoT <event> to carry a
// CrowdCAD team/supervisor/post/call marker — not the full CoT schema.
//
// Import-boundary note: this file (and everything else under src/lib/tak/)
// must run unmodified in a browser, a serverless function, and a standalone
// Node sidecar. Keep it dependency-free.

export interface CotPoint {
  lat: number;
  lon: number;
  hae?: number; // height above ellipsoid, metres
  ce?: number;  // circular error (horizontal accuracy), metres
  le?: number;  // linear error (vertical accuracy), metres
}

export interface CotEvent {
  uid: string;
  type: string;  // CoT type code, e.g. 'a-f-G-U-C'
  how?: string;  // e.g. 'm-g'
  time: number;  // epoch ms
  start: number; // epoch ms
  stale: number; // epoch ms
  point: CotPoint;
  detail?: CotDetail;
}

export interface CotDetail {
  callsign?: string;
  groupName?: string;
  groupRole?: string;
  remarks?: string;
  geopointsrc?: string;
  altsrc?: string;
  // Call-marker-only field. Populated EXCLUSIVELY by applyRedaction() in
  // redaction.ts — it is the one clinical field the 'full' TakCallPublishMode
  // permits through that module's allowlist, and applyRedaction folds it
  // into `remarks` before buildCotXml serializes the event. Do not set this
  // anywhere else (in particular, never forward a Call's raw chiefComplaint
  // straight into `remarks`), and do not add further clinical fields to this
  // interface without updating the allowlist in redaction.ts AND the tests
  // in src/lib/__tests__/tak/redaction.test.ts.
  chiefComplaint?: string;
}

// CoT convention for "this hae/ce/le value is unknown" — NOT a measurement.
// 0 must never be substituted for "unknown": 0 is a legitimate measured
// value (ground-level hae, or perfect ce/le accuracy), so treating it as a
// stand-in for "unknown" would make an unknown value look like a precise
// zero to anyone reading the marker.
export const COT_UNKNOWN = 9999999.0;

// ---------------------------------------------------------------------------
// CANDIDATE CoT type codes — UNVERIFIED.
//
// These are derived from published CoT type-code documentation only. They
// have NOT been confirmed against a real TAK server. Before relying on any
// of these in production, publish an event using each code to a real TAK
// server and visually confirm the rendered icon in BOTH ATAK-CIV and WinTAK.
// A wrong type code doesn't just fail silently — it renders as a confusing,
// misleading, or alarming symbol on a partner agency's map (e.g. a medical
// team rendering as a hostile unit, or a call rendering as a CASEVAC request
// no one actually made). Do not remove this warning until each code below
// has been visually verified and the confidence level updated.
// ---------------------------------------------------------------------------

// Friendly ground unit. Confidence: HIGH (standard, widely-documented code).
export const COT_TYPE_TEAM = 'a-f-G-U-C';

// Same base type as COT_TYPE_TEAM; supervisors are distinguished from teams
// via CotDetail.groupRole, not a different type code. Confidence: HIGH.
export const COT_TYPE_SUPERVISOR = 'a-f-G-U-C';

// Waypoint, used for static posts (gates, aid stations, etc).
// Confidence: MEDIUM.
export const COT_TYPE_POST = 'b-m-p-w';

// CASEVAC / 9-line report type, borrowed here to represent a dispatch call.
// Confidence: LOW — VERIFY before relying on this. This is the shakiest
// mapping in the set: a CASEVAC type code carries strong military-medical
// connotations in TAK clients that a general dispatch "call" marker may not
// warrant, and it may pull in CASEVAC-specific detail rendering we don't
// populate.
export const COT_TYPE_CALL = 'b-r-f-h-c';
