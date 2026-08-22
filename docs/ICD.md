> This document reflects CrowdCAD at commit `f146992` (branch `feature/profile-refactor`, 2026-08-12). PocketBase schema and API surface change independently of the app — verify against a live `/api/collections/{name}` response if this looks stale.

# CrowdCAD Interface Control Document (ICD) — PocketBase Backend

## 1. Overview

CrowdCAD is a dispatch and event-staffing web application (Next.js) used to plan events, staff venues, and run live dispatch during an event (tracking calls/incidents, team status, equipment, and post assignments).

CrowdCAD supports two interchangeable backends, selected at build/runtime via the `NEXT_PUBLIC_BACKEND` environment variable: **Firebase** (default) and **PocketBase** (self-hosted, e.g. for LAN/offline deployments). This document describes only the **PocketBase** backend (`NEXT_PUBLIC_BACKEND=pocketbase`), currently pinned to **PocketBase v0.37.1** (see `Dockerfile.pocketbase`).

This document is written to be integration-agnostic: it describes the raw PocketBase data interface (collections, fields, REST/SSE access) so that any external system — not just CrowdCAD's own frontend or a specific TAK integration — can read and write CrowdCAD data correctly.

## 2. Accessing the Data

### 2.1 Base URL

All access goes through a single PocketBase server, e.g. `http://<host>:8090`. The app reads this from `NEXT_PUBLIC_POCKETBASE_URL`.

### 2.2 REST endpoints

PocketBase exposes a standard REST API per collection at `/api/collections/{collectionName}/records`:

| Operation | Method & path |
|---|---|
| List/search | `GET /api/collections/{collection}/records?filter=...&sort=...&page=...&perPage=...` |
| View one | `GET /api/collections/{collection}/records/{id}` |
| Create | `POST /api/collections/{collection}/records` (JSON or multipart body) |
| Update | `PATCH /api/collections/{collection}/records/{id}` (partial — only sent fields change) |
| Delete | `DELETE /api/collections/{collection}/records/{id}` |
| Download a file field | `GET /api/files/{collection}/{recordId}/{filename}` |

`filter` uses PocketBase's own query-expression syntax (e.g. `filter=(userId='abc123' && status='active')`). Values interpolated into filters should be escaped (the app does this via the SDK's `pb.filter()` helper) to avoid filter-injection.

Only fields declared on a collection are accepted/returned — unknown fields sent in a create/update body are silently dropped, not stored (see §4 notes on `events`).

### 2.3 Authentication

The built-in `users` collection is a PocketBase **auth collection**:

- `POST /api/collections/users/auth-with-password` with `{ identity, password }` → returns `{ token, record }`. The token is a JWT sent as `Authorization: Bearer {token}` on subsequent requests.
- `POST /api/collections/users/records` to sign up (`email`, `password`, `passwordConfirm`).
- `POST /api/collections/users/request-password-reset`, `/confirm-password-reset` for password recovery.
- `POST /api/collections/users/auth-refresh` to renew a token using the current one.

All non-`users` collections in this deployment (`venues`, `events`, `dispatchLogs`, `_storage`, `settings`) use the API rule `@request.auth.id != ""` for list/view/create/update/delete — i.e. **any authenticated user may read and write any record in these collections**; there is no per-owner or per-role restriction enforced by PocketBase itself (`userId`/`sharedWith` fields are used for *application-level* filtering only, not access control). `settings` create/update/delete additionally requires `@request.auth.isAdmin = true`.

### 2.4 Realtime (SSE) subscriptions

PocketBase pushes live changes over a single Server-Sent-Events stream at `GET /api/realtime`:

1. Open an `EventSource` connection to `{baseURL}/api/realtime`. The server sends a `PB_CONNECT` event containing a `clientId`.
2. `POST /api/realtime` with `{ clientId, subscriptions: [...] }` (and the same `Authorization` bearer header used for REST) to (re)declare which topics that client wants. Topics are strings like:
   - `"{collection}/*"` — all records in a collection (create/update/delete)
   - `"{collection}/{recordId}"` — a single record
3. Subsequent matching changes arrive as SSE messages named after the collection, with a JSON payload `{ action: "create"|"update"|"delete", record: {...} }`.

The official PocketBase JS SDK (used by CrowdCAD) wraps this as `pb.collection(name).subscribe(topic, callback)` / `.unsubscribe(topic)` and manages the connect/reconnect handshake automatically.

## 3. Collections

CrowdCAD's PocketBase instance has **five custom collections** (`venues`, `events`, `dispatchLogs`, `_storage`, `settings`) plus PocketBase's **built-in `users` auth collection**. There are no separate "units", "calls", or "assignments" collections — those concepts live as JSON-typed fields nested inside `events` (documented as sub-shapes in §3.7, since they're integral to the event data model).

### 3.1 `users` (built-in auth collection)

Only fields actually read/written by the app are listed; PocketBase auth collections also carry internal system columns (password hash, token key, verification state, etc.) not exposed here.

| Field | Type | Description | Nullable | Example |
|---|---|---|---|---|
| `id` | text (15-char, system) | Primary key, auto-generated. | No | `"a1b2c3d4e5f6g7h"` |
| `email` | email (system) | Login identity. | No | `"medic@example.org"` |
| `name` | text | Display name. | Yes | `"Jordan Lee"` |
| `phone` | text | Contact phone number. | Yes | `"+1-555-0100"` |
| `isAdmin` | bool | Grants access to CrowdCAD's Profile → Admin section (manage other admins, org settings). Added via `scripts/setAdminPocketbase.js`; not present by default until the setup script runs. | Yes (defaults false) | `true` |

### 3.2 `venues`

Reusable venue templates: layout, posts, and equipment, independent of any specific event.

| Field | Type | Description | Nullable | Example |
|---|---|---|---|---|
| `id` | text (15-char) | Primary key. | No | `"m3n4o5p6q7r8s9t"` |
| `name` | text | Venue name. | No (required) | `"Downtown Stadium"` |
| `userId` | text | `id` of the `users` record that owns/created the venue. Not a PocketBase relation field — plain text copy of the id. | Yes | `"a1b2c3d4e5f6g7h"` |
| `equipment` | json — `Equipment[]` | Venue's default equipment inventory. See §3.7. | Yes | `[{"id":"eq1","name":"AED #1","status":"Available"}]` |
| `layers` | json — `Layer[]` | Named map layers, each with its own posts. See §3.7. | Yes | `[{"id":"l1","name":"Main Map","posts":[...]}]` |
| `posts` | json — `Post[]` | Flat list of posts when the venue has no layers. See §3.7. | Yes | `[{"name":"Gate A","x":12.5,"y":40.0}]` |
| `mapUrl` | text | URL/path to the venue's base map image. | Yes | `"/files/maps/stadium.png"` |
| `sharedWith` | json — `string[]` | Email addresses of other users granted access to this venue. | Yes | `["helper@example.org"]` |
| `isOrgVenue` | bool | If true, visible to every user on this instance (set by an admin), not just the owner/sharedWith list. | Yes (defaults false) | `false` |

### 3.3 `events`

The central planning/dispatch record for a single event: a snapshot of the venue plus staffing, calls, and assignments as the event runs.

| Field | Type | Description | Nullable | Example |
|---|---|---|---|---|
| `id` | text (15-char) | Primary key. | No | `"e1f2g3h4i5j6k7l"` |
| `name` | text | Event name. | Yes | `"Summer Festival 2026"` |
| `date` | text | Event date, stored as an ISO 8601 string (see §5). Not a PocketBase `date` field type — plain text. | Yes | `"2026-08-15T00:00:00.000Z"` |
| `userId` | text | `id` of the owning `users` record (plain text, not a relation). | Yes | `"a1b2c3d4e5f6g7h"` |
| `venue` | json — `Venue` | Snapshot of the venue used for this event (copied from `venues` at event-create time, then edited independently). See §3.2/§3.7. | Yes | `{"id":"m3n4o5...","name":"Downtown Stadium",...}` |
| `sharedWith` | json — `string[]` | Email addresses with access to this event. | Yes | `["helper@example.org"]` |
| `postingTimes` | json — `string[]` | Labels for the shift/posting time slots used to build the schedule grid. | Yes | `["06:00","08:00","10:00"]` |
| `staff` | json — `Staff[]` | Field teams ("units") working the event. See §3.7. | Yes | `[{"team":"Team 1","status":"Available",...}]` |
| `supervisor` | json — `Supervisor[]` | Supervisory units. See §3.7. | Yes | `[{"team":"Supervisor 1","status":"Available",...}]` |
| `calls` | json — `Call[]` | Incidents/calls logged during the event. See §3.7. | Yes | `[{"id":"c1","order":1,"status":"Active",...}]` |
| `status` | text | Event lifecycle state. Observed values: `"draft"`, `"active"`. | Yes | `"active"` |
| `eventPosts` | json — `Post[]` | Posts as configured for this specific event (may diverge from the venue template). See §3.7. | Yes | `[{"name":"Gate A","x":12.5,"y":40.0}]` |
| `eventEquipment` | json — `EventEquipment[]` | Equipment inventory for this event. See §3.7. | Yes | `[{"id":"eq1","name":"AED #1","status":"Available","locationId":"Gate A"}]` |
| `pendingAssignments` | json — `{ [team]: { post, time } }` | Assignments queued but not yet committed to `postAssignments`, keyed by team name. | Yes | `{"Team 1":{"post":"Gate A","time":"08:00"}}` |
| `postAssignments` | json — `{ [time]: { [post]: team } }` | Committed post assignment grid: for each posting time, which team covers which post. See §3.7. | Yes | `{"08:00":{"Gate A":"Team 1"}}` |
| `interactionSessions` | json — `InteractionSession[]` | Client-side usage-tracking sessions (mouse/keystroke activity timestamps) for the dispatch UI. See §3.7. | Yes | `[{"sessionId":"s1","eventId":"e1f2...","startTime":1755000000000,"mouseClicks":[],"keyStrokes":[]}]` |

### 3.4 `dispatchLogs`

Append-style log of dispatch-page activity for an event.

| Field | Type | Description | Nullable | Example |
|---|---|---|---|---|
| `id` | text (15-char) | Primary key. | No | `"d1e2f3g4h5i6j7k"` |
| `eventId` | text | `id` of the related `events` record (plain text, not a relation). | Yes | `"e1f2g3h4i5j6k7l"` |
| `data` | json | Log payload; shape is caller-defined and not further constrained by the schema. | Yes | `{"type":"call-created","callId":"c1"}` |

### 3.5 `_storage`

Generic file store used by the app's storage adapter (e.g. venue map images), keyed by an application-defined logical path rather than by collection semantics.

| Field | Type | Description | Nullable | Example |
|---|---|---|---|---|
| `id` | text (15-char) | Primary key. | No | `"f1g2h3i4j5k6l7m"` |
| `path` | text | Logical path the app looks the file up by (app-level convention, e.g. `"maps/stadium.png"`). Intended to be unique per path, though uniqueness is enforced by the app's find-or-create logic rather than a documented DB constraint. | No (required) | `"maps/stadium.png"` |
| `file` | file | The uploaded binary. Served at `/api/files/_storage/{id}/{filename}`. | Yes | `"stadium_a1b2.png"` |

### 3.6 `settings`

Small key/value store for org-wide configuration (currently used for the certifications list offered when adding staff).

| Field | Type | Description | Nullable | Example |
|---|---|---|---|---|
| `id` | text (15-char) | Primary key. | No | `"s1t2u3v4w5x6y7z"` |
| `key` | text | Setting name. Observed value: `"certifications"`. | No (required) | `"certifications"` |
| `list` | json — `string[]` | Value for the setting. For `"certifications"`, the list of certification labels offered in the UI. | Yes | `["CPR","EMT-B","EMT-P","RN","MD/DO"]` |

### 3.7 Embedded JSON sub-shapes (nested inside `venues`/`events`, not separate collections)

PocketBase stores these as opaque `json` fields with no server-side schema; the shapes below are enforced only by the TypeScript contracts in `src/app/types.ts`, not by PocketBase itself.

**`Post`** — a location on a venue map. Either a bare string (a legacy/simple post name) or an object:
| Field | Type | Description |
|---|---|---|
| `name` | string | Post name. |
| `x`, `y` | number \| null | Position as a percentage of map width/height. |
| `isClinic` | bool (optional) | Marks this post as a clinic. |
| `clinicId` | string (optional) | Stable id, generated once when `isClinic` first becomes true. Survives the post being renamed later; used to match this post against `events.clinics` entries. |

**`Layer`**: `id`, `name`, `mapUrl?`, `posts: Post[]`.

**`Clinic`**: `id` (matches a clinic-flagged `Post.clinicId`), `name` (kept in sync with that post's current name). `events.clinics: Clinic[]` is populated additively from the event's `venue.posts` — see `src/lib/clinics.ts`'s `syncClinicsFromVenue`.

**`Equipment`** (venue-level): `id`, `name`, `status` (free-text status string), `assignedTeam?`, `location?`.

**`EventEquipment`** = `Equipment` + `locationId?`, `defaultLocation?`, `notes?`.

**`Staff`** (a field team / "unit"):
| Field | Type | Description |
|---|---|---|
| `team` | string | Team name/identifier. |
| `location` | string | Current location/post. |
| `status` | string | Free-text status (e.g. availability). |
| `members` | string[] | Member names. |
| `log?` | `{timestamp:number, message:string}[]` | Activity log for this team. |
| `originalPost?` | string | Post the team was originally assigned before any reassignment. |

**`Supervisor`** — same shape as `Staff` but with a single `member: string` instead of `members: string[]`.

**`Call`** (an incident):
| Field | Type | Description |
|---|---|---|
| `id` | string | Call identifier (app-generated, not a PocketBase record id). |
| `order` | number | Display/creation order. |
| `status` | string | Free-text call status. |
| `location` | string | Where the call is. |
| `assignedTeam` | string[] | Team(s) responding. |
| `chiefComplaint` | string | Reason for the call. |
| `source?`, `age?`, `gender?` | string | Optional patient/context details. |
| `priority?`, `duplicate?`, `clinic?` | bool | Flags. |
| `duplicateOf?`, `clinicId?` | string | Reference ids (plain strings, not relations). |
| `log?` | `{timestamp:number, message:string}[]` | Call activity log. |
| `notes?` | string | Free text. |
| `detachedTeams?` | `{team:string, reason:string}[]` | Teams detached from the call and why. |
| `equipmentTeams?`, `equipment?` | string[] | Related equipment/teams. |
| `outcome?` | `"Discharged" \| "AMA" \| "Rolled from Clinic" \| "Transported"` | Clinic disposition. |

**`postAssignments`**: `{ [time: string]: { [post: string]: string /* team */ } }` — the committed schedule grid.

**`pendingAssignments`**: `{ [team: string]: { post: string; time: string } }` — assignments staged but not yet placed into `postAssignments`.

**`InteractionSession`**: `sessionId`, `eventId`, `startTime` (epoch ms), `endTime?` (epoch ms), `mouseClicks: {timestamp:number}[]`, `keyStrokes: {timestamp:number}[]`.

## 4. Fields present in the app's TypeScript types but not in this PocketBase schema

`src/app/types.ts`'s `Event` interface also declares `createdAt`, `ended`, `postingStart`/`postingEnd`, `scheduleStart`/`scheduleEnd`, `startTime`/`endTime`, and `start`/`end`. None of these appear in the `events` collection's actual field list (`scripts/setup-pocketbase.js`, `tests/e2e/pb_migrations/…created_events.js`). CrowdCAD supports both a Firebase and a PocketBase backend behind a common interface, and these fields appear to be write-only leftovers for the Firebase path: since PocketBase silently drops unknown fields on create/update (§2.2), sending them to a PocketBase-backed deployment has no effect — they will not be persisted or returned. Do not rely on them being present in PocketBase `events` records.

`clinics` **is** a schema-backed `json` field on `events` (added alongside multi-clinic support) — it does persist on PocketBase.

## 5. Notes

- **Timestamp format**: There is no PocketBase `date`/`autodate` field type in use anywhere in this schema. `events.date` is a plain `text` field populated by the frontend with `new Date(...).toISOString()` — i.e. ISO 8601, UTC, e.g. `"2026-08-15T00:00:00.000Z"`. Timestamps inside JSON sub-objects (`Call.log[].timestamp`, `Staff.log[].timestamp`, `InteractionSession.startTime/endTime`, `MouseClickLog.timestamp`, `KeyStrokeLog.timestamp`) are JS epoch milliseconds (numbers), not ISO strings — mixed formats depending on where the value originates.
- **No `created`/`updated` audit fields**: unlike PocketBase's usual default, none of the five custom collections define `created`/`updated` autodate fields, so there is no built-in record of when a `venues`/`events`/`dispatchLogs`/`_storage`/`settings` row was created or last modified.
- **ID conventions**: every collection's primary key (`id`) is a 15-character lowercase alphanumeric string (`^[a-z0-9]{15}$`), auto-generated by PocketBase. Cross-references between collections (`events.userId`, `venues.userId`, `dispatchLogs.eventId`, `Call.duplicateOf`, `Call.clinicId`) are stored as plain text copies of the referenced id — none of them are PocketBase `relation` fields, so referential integrity (e.g. cascading delete, existence checks) is not enforced by the database.
- **No soft deletes**: `deleteDocument` issues a real PocketBase `DELETE`; there is no `deleted`/`isDeleted` flag or tombstone record in any collection. Deletion is permanent.
- **Access control is mostly at the application layer, not PocketBase's**: as noted in §2.3, any authenticated user can read/write any `venues`/`events`/`dispatchLogs`/`_storage` record via the raw API — `userId`/`sharedWith` only drive what the CrowdCAD UI *chooses* to show, not what PocketBase *permits*. An integration talking to the API directly must not assume those fields are an access-control boundary.
- **JSON fields are schemaless in PocketBase**: all `json`-typed fields (venue/staff/calls/equipment/etc.) are validated only by the TypeScript types in `src/app/types.ts` on the frontend, not by PocketBase. A non-CrowdCAD client can write any JSON shape into them without the server rejecting it.
