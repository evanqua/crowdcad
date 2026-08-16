# TAK Integration — Implementation Plan

**Status:** In progress — Phase 0 complete, Phase 1 partially complete (see §0)
**Target:** CrowdCAD (`core/`), general-purpose capability; IC-EMS is the first deployer
**Author:** drafted 2026-08-11
**Last updated:** 2026-08-16
**Latest code:** `52fe6c5` on `feature/tak-phase0` (in the `core/` submodule)

---

## How to use this document

**This is the progress tracker for the TAK integration. It is written to be picked
up cold, in a fresh session, with no other context.**

- **§0 is the current state.** Read it first. It says what exists, what does not,
  why the work stopped where it did, and what to do next.
- **§1 onward is the original plan**, preserved as drafted and annotated inline with
  ✅ (done) / 🟡 (partial) / ⛔ (not started, and why). The plan itself is settled —
  don't re-plan it. What changes between sessions is §0.
- **§0.5 is the session log.** Append to it.

**If you are starting a session:** read §0.1–§0.3, then §0.4 for the next action,
then only the phase section you are about to touch.

**Before you end a session:** update the §0.1 table, add any judgment calls to
§0.3, and append a §0.5 entry. A stale tracker is worse than none — it will be
trusted and it will be wrong.

### Where the code is

| | |
|---|---|
| Repo | the **`core/` submodule**, not the root wrapper |
| This document | `core/docs/TAK_INTEGRATION_PLAN.md` — **the canonical copy** |
| Latest commit | `52fe6c5` — Phase 0 completion + Phase 1 pure modules |
| Parent commit | `9fe8de6` — georeference groundwork (was uncommitted WIP before 2026-08-15) |
| Pushed? | **No.** See the warning below. |

⚠️ **`core`'s only remote is the PUBLIC `evanqua/crowdcad`.** A bare `git push`
publishes. Nothing here has been pushed; treat pushing as a deliberate, owner-only
act.

⚠️ **Branch discoverability.** `52fe6c5` lives on `feature/tak-phase0`, which was cut
from `feature/tak-georeference`. If your `core/` checkout is on
`feature/tak-georeference`, **this file and all Phase 1 code will not be present** —
you would be reading a stale tree and could easily redo finished work. To bring the
branch you're on up to date (a pure fast-forward, no merge commit, nothing lost):

```bash
cd core
git log --oneline -1                       # if this is NOT 52fe6c5, keep reading
git merge --ff-only feature/tak-phase0     # from feature/tak-georeference
```

### Verify the state you inherited

```bash
cd core
git log --oneline -2     # expect: 52fe6c5, then 9fe8de6
npm run test:unit        # expect: 5 files, 81 passed
npm run type-check       # expect: clean, no output
```

If the test count is 34, you are on `9fe8de6` and are missing this session's work.
If `src/lib/tak/` does not exist, likewise.

> **Placement note — resolved 2026-08-15.** This document originally lived in the
> root wrapper's `docs/` because the `core/` submodule had uncommitted work on
> `feature/tak-georeference`. That work is now committed (`9fe8de6`), so per the
> original note this file was moved to `core/docs/TAK_INTEGRATION_PLAN.md` and now
> travels with the code it describes.
>
> **A superseded copy still exists** at
> `.claude/worktrees/tak-integration-plan/docs/TAK_INTEGRATION_PLAN.md` (branch
> `worktree-tak-integration-plan` in the **root** repo). It is the original 861-line
> draft with **no status annotations at all** — it does not know any code was ever
> written. Delete that worktree and branch rather than editing it; if you find
> yourself reading an 861-line copy with no ✅ markers, you have the wrong file.

---

## 0. Implementation status

This section is the running record of what has actually been built, and why the
work stopped where it did. Everything below §1 is the original plan as drafted;
where reality diverged from it, the divergence is recorded here and cross-referenced
from the phase section it affects.

### 0.1 Completed

| Phase | Item | State | Landed in |
|---|---|---|---|
| — | This planning document | Done | `8344a6a` (root wrapper) |
| 0 | `ControlPoint` / `Georeference` types, `Layer.georeference`, `Staff`/`Supervisor.position` | Done | `9fe8de6` |
| 0 | `geoUtils.ts` — tangent-plane projection, 2-point anti-similarity solver, 3+-point least-squares affine solver, `pixelToLatLon` / `latLonToPixel` | Done | `9fe8de6` |
| 0 | `postName` / `postPercent` / `postLatLon` / `layerPostsLatLon` derive-on-read accessors | Done | `9fe8de6` |
| 0 | Control-point placement mode, editing UI, `GeoreferenceSection` / `GeoreferencePointDialog` | Done | `9fe8de6` |
| 0 | vitest harness (`npm run test:unit`) + 34 solver tests | Done | `9fe8de6` |
| **0.1** | **Georeference persistence round-trip** | **Verified — no code change needed** | — |
| **0.2** | **Derived lat/lon readout per post in the venue editor** | **Done** | `52fe6c5` |
| **0.3** | **Residual / fit-quality readout in metres + unacceptable-fit warning** | **Done** | `52fe6c5` |
| **1.1** | **Pure modules `tak/{types,uid,cot,redaction}.ts` + tests** | **Done** | `52fe6c5` |
| **1.1** | **`TakPublishSettings`, `TeamPosition`, `PositionSource`, `Staff/Supervisor.takUid`, `Event.tak` types** | **Done** | `52fe6c5` |

Everything in the first block above (rows through the vitest harness) was built in
earlier sessions and sat **uncommitted** on `feature/tak-georeference`; the first act
of the 2026-08-15 session was to commit it as `9fe8de6` so it could not be lost and
so an isolated branch could be cut from it.

**Verification at the close of the 2026-08-15 session:** `npm run type-check` clean,
`npm run test:unit` 81/81 passing (up from 34), `npm run build` succeeds with all
routes compiling. Two pre-existing lint warnings in `page.client.tsx` (`uploadWithRetry`,
`LayerControlBar` unused) were confirmed to predate this work and were left alone.

### 0.2 Explicitly NOT done, and why

- **`mapping.ts` (`eventToCotEvents`), `kml.ts`, and the `/api/tak/...` feed routes.**
  Deferred on purpose. §7.3 and §1.5 gate exactly these on two verification spikes
  that need real TAK clients and a real TAK server — neither of which was available.
  Building them from documentation alone is the specific failure mode §7.3 warns
  against (a wrong CoT type code renders as a confusing or alarming symbol on a
  partner agency's map). The modules that are spike-*independent* were built instead.
- **Phase 0.4 — validating the solver against a real georeferenced overlay.**
  Blocked on an external artifact: an existing WinTAK KMZ/GeoTIFF from IC-EMS.
  This is an open ask, not a technical obstacle. Until it is satisfied, the solver
  is verified only against synthetic fixtures.
- **`positions` collection security rules** (`firestore.rules`, `scripts/setup-pocketbase.js`).
  Not written. `TeamPosition` exists as a type only; nothing reads or writes it yet,
  so the rules would be unenforced and untested. They belong with Phase 2/3, when a
  producer actually exists.
- **Phases 2–6.** Untouched, as scoped.

### 0.3 Decisions made during implementation

1. **Residual distance is measured in the solver's own tangent plane.** Rather than
   introducing a second distance model (haversine/Vincenty), `georeferenceResiduals`
   projects both the fitted and the operator-entered lat/lon through the *same*
   `toLocalPlane` the solver uses and takes the Euclidean distance there, scaled by
   an exported `METRES_PER_DEGREE_LATITUDE = 111320`. This keeps the reported error
   consistent with the model that produced it — a residual measured under different
   assumptions than the fit would be quietly misleading. It inherits the same
   flat-earth venue-scale limitation as the rest of the module, which is documented
   at the constant.

2. **Fit quality is reported only for 3+ control points.** A 2-point anti-similarity
   fit is exact by construction, so its residuals are floating-point noise. Printing
   "max error 0.0 m" there would imply a precision claim the fit does not actually
   make. The 2-point status message was left exactly as it was.

3. **`MAX_ACCEPTABLE_RESIDUAL_METRES = 25`** is exported as a named constant and the
   georeference status banner flips from "ok" to "warn" above it. Chosen to match the
   threshold §11 proposes for refusing to publish CoT, so the operator-facing warning
   and the future publish-time gate agree on one number rather than drifting apart.

4. **The derived lat/lon readout covers every layer, not just the active one.** The
   venue editor's post list is cross-layer (each row is tagged with its layer name).
   Scoping the readout to the active layer left rows from other georeferenced layers
   silently blank — visually identical to "this layer isn't calibrated", which is the
   opposite of the calibration feedback loop 0.2 exists to provide. It is memoized as
   one `layerPostsLatLon` call per layer, so it remains one transform solve per layer
   rather than one per post.

5. **`CotDetail.chiefComplaint` was added to the CoT detail type** (a deviation from
   §5, which did not name it). `applyRedaction` operates on a `CotEvent`, never on the
   raw `Call`. Without a typed field to allow through, "permit the chief complaint and
   nothing else" would have had to be implemented as string surgery on an opaque
   `remarks` blob — which is a denylist wearing an allowlist's clothes. A dedicated
   optional field keeps the allowlist a real, type-checked object construction.

6. **`applyRedaction` never forwards the input's `remarks`.** Output remarks are
   rebuilt from scratch from allowlisted pieces only. This defends against a *future*
   upstream mapping bug that dumps the whole call (age, gender, notes, log) into
   remarks as a convenience string — the redaction test simulates exactly that
   worst case and asserts every PHI sentinel is absent from the serialized output at
   every mode, including `'full'`. Per §8 and §10 this is the one test that must
   never be skipped.

7. **`parseCotXml` is a deliberately narrow parser, not an XML library.** The §1.1
   purity constraint (no Node built-ins, no DOM, runs unmodified in browser /
   function / sidecar) rules out most parsers, and pulling a dependency in for output
   is explicitly forbidden. It handles the shape CrowdCAD emits and that CoT devices
   commonly send, returns `null` on anything malformed rather than a half-populated
   object, and documents its own limits (no CDATA, namespaces, comments, or nested
   repeated detail elements). The escape hatch, if a real server sends richer CoT,
   is the MIT-licensed `fast-xml-parser` named in §9 — a dependency decision to make
   deliberately, not to sleepwalk into.

8. **Candidate CoT type codes are committed as constants but marked UNVERIFIED**, each
   carrying its confidence level, behind a prominent warning comment. This makes the
   spike's job concrete (confirm or correct four named constants) without pretending
   the values are settled. Nothing consumes them yet, because `mapping.ts` is deferred.

9. **The work was done on `feature/tak-phase0`, cut from the committed
   `feature/tak-georeference`.** Nothing was pushed: `core`'s only remote is the
   **public** `evanqua/crowdcad`, so publishing is a deliberate, owner-only act.

### 0.4 Recommended next steps, in order

1. **Run the two gating spikes** (§1.5 and §7.3) — they block the most valuable
   remaining work and need only a test TAK server plus the WinTAK install IC-EMS
   already has.
2. **Get the IC-EMS overlay** for Phase 0.4 and turn it into a vitest fixture.
3. **Then** `mapping.ts` → the feed route → the event-settings UI, in that order.
4. Answer the six open questions in §11 — several change the adapter priority for
   Phase 2 and are organizational lead-time items, not coding tasks.

**What is safe to start right now, with no spike and no external input:** nothing
large. That is the honest answer, and it is why §0.4 leads with the spikes rather
than with code. The next meaningful code (`mapping.ts`) is one spike away, and
that spike needs an afternoon with WinTAK, not a development environment. Resist
the temptation to build `mapping.ts` speculatively — §7.3 explains exactly what
goes wrong.

### 0.5 Session log

Append one entry per working session. Keep entries short: what changed, what was
decided, where it stopped. Detail belongs in §0.1–§0.3.

**2026-08-11 — planning.**
Drafted this document (`8344a6a`, root wrapper). No code written. Grounded the plan
in two findings from reading the codebase: the whole event is one Firestore document
behind a single `updateEvent()` transaction (so live GPS cannot be written into
`Staff.position` at device rate — §6.2), and the georeference math had no production
callers (so Phase 0 is a hard prerequisite).

**Earlier sessions (pre-2026-08-15) — georeference groundwork.**
Built the types, the solvers in `geoUtils.ts`, the control-point placement UI, and the
vitest harness with 34 tests. **This work was left uncommitted** on
`feature/tak-georeference`.

**2026-08-15 — Phase 0 completion + Phase 1 pure modules.**
- Committed the inherited uncommitted groundwork as `9fe8de6` before touching
  anything else, so it could not be lost.
- Verified Phase 0.1 (persistence) — already correct, no code change.
- Implemented Phase 0.2 (per-post derived lat/lon, all layers) and Phase 0.3
  (residuals in metres + 25 m warning threshold). Phase 0 exit criteria met.
- Implemented the spike-independent half of Phase 1.1: `src/lib/tak/{types,uid,cot,
  redaction}.ts` plus tests, and the TAK config/position types.
- **Deliberately did not build** `mapping.ts`, `kml.ts`, or the feed routes — all
  gated on the two spikes (§0.2, §7.3, §1.5).
- Committed as `52fe6c5` on `feature/tak-phase0`. **Not pushed.**
- Tests 34 → 81. `type-check` clean, `npm run build` clean.
- Decisions recorded in §0.3(1)–(9).

**2026-08-16 — documentation pass.**
Restructured this file for cold-session pickup: added the "How to use this document"
header, the code-location and state-verification blocks, the branch-discoverability
warning, and this session log. Pinned commit SHAs in the §0.1 table instead of branch
names, since branches move and SHAs do not. No code changed.

---

## 1. Executive summary

> *Everything from here on is the original plan as drafted on 2026-08-11, annotated
> inline with ✅ / 🟡 / ⛔ status markers. It records the reasoning and the target
> design, **not** current progress — for that, see §0. The recommendation below still
> stands; nothing found during implementation has contradicted it.*

**Recommendation: build a CoT (Cursor on Target) *bridge*, not a TAK client and not
an ATAK plugin.**

CrowdCAD should treat TAK as an **interoperability surface**, not as a UI or a data
store. Concretely, three deliverables in sequence:

| Phase | Deliverable | Infra required | Value |
|---|---|---|---|
| **1** | Read-only CoT/KML feed served from a Next.js route | none (existing deploy) | Teams + posts appear on any TAK client, day one |
| **2** | `crowdcad-tak-bridge` — standalone Node sidecar, bidirectional CoT over TLS | one small container | Live two-way sync with a real TAK Server |
| **3** | Inbound position/status ingest + dispatch map overlay | (same as Phase 2) | Field positions land in the dispatch board |

Phases 4–6 (field PWA hardening, ATAK plugin, mesh/Meshtastic ops guidance) are
scoped but explicitly deferred.

**Why a bridge and not something in-app:** CrowdCAD deploys as Next.js SSR onto a
Cloud Function (`firebase.json` → `ssrdispatch60ca7`). A serverless function cannot
hold the long-lived TCP/TLS socket that CoT streaming requires. Anything that needs
a persistent connection has to live in a separate always-on process. Phase 1 is
designed specifically to sidestep that so there is useful output before anyone has
to stand up new infrastructure.

**Two findings from reading the current code that shape the design:**

1. **The whole event is one document.** `Event` embeds `calls`, `staff`,
   `supervisor`, `postAssignments`, and every dispatch mutation funnels through a
   single `updateEvent()` transaction on `events/{eventId}`
   (`core/src/app/(main)/events/[eventId]/dispatch/page.tsx:171`). Writing live GPS
   positions into that document will not scale — see §6.2. Positions need their own
   collection.
2. **The georeference math is written but unused.** `solveGeoreference` is consumed
   only by the venue-editor status banner. `pixelToLatLon`, `postLatLon`, and
   `layerPostsLatLon` (`core/src/lib/geoUtils.ts`) have tests but zero production
   callers. TAK export is the first real consumer, so Phase 0 has to finish wiring
   them.

---

## 2. Scope calibration — set expectations before writing code

This section exists so that nobody is surprised later. It is not a reason to skip
the work; it is the honest framing to put in front of IC-EMS.

### 2.1 What TAK genuinely gives CrowdCAD

- A **common operating picture** shared with agencies that already run TAK
  (university police, county EMS, fire), without CrowdCAD having to integrate with
  each of their systems.
- A **map client CrowdCAD does not have to build** — ATAK/iTAK/WebTAK render
  positions, tracks, and overlays far better than a from-scratch dispatch map.
- **Outdoor / cross-venue geospatial awareness** — teams moving between lots,
  gates, and the venue perimeter.
- An institutional story: federally-backed, free, already in the deployer's
  network.

### 2.2 What TAK will *not* solve

- **Floor / seating-tier disambiguation.** GPS altitude cannot reliably separate
  stadium concourse levels, and TAK's elevation model (DTED) is outdoor terrain
  data — it has no concept of "level 3 of a building." Multi-level awareness is
  solved by CrowdCAD's own `Layer` model, which is already per-level. The plan
  carries the layer name in the CoT `<remarks>` and as a group/channel suffix so a
  TAK operator can at least *read* which level a team is on, but the map will show
  every level stacked at one lat/lon. **Say this out loud to IC-EMS.**
- **"3D seating with wireframes."** That is a LiDAR/photogrammetry surveying
  engagement producing a georeferenced digital twin. It is a vendor procurement,
  not a software feature, and nothing in this plan moves toward it. TAK's 3D model
  support is a static decoration layer, not live occupancy.
- **The actual stated operational need.** IC-EMS wants field providers to press
  *arrived / clear from patient / moving patient* because radio fails in a loud
  stadium. ATAK is a poor UI for that: it is a dense tactical map app on a
  volunteer-managed, heterogeneous phone fleet, and its status-reporting affordances
  are buried. **The right client for that need is a CrowdCAD field PWA** — three
  large buttons, a background geolocation ping, works on any phone with a browser,
  no TAK.gov registration, no APK sideloading.

  These are **complementary, not competing**: the field PWA is what *produces*
  status and position; the TAK bridge is what *exports* it to everyone else's map.
  Phase 4 covers the PWA. If IC-EMS has to pick one for game day, the PWA is the one
  that solves their problem; TAK is what makes the data useful to partner agencies.

### 2.3 Design principles

1. **CrowdCAD is the system of record.** TAK is a projection of CrowdCAD state, and
   an input channel for position. TAK is never authoritative for call state.
2. **Opt-in, per-deployment, per-event.** A CrowdCAD instance with no TAK config
   must behave exactly as it does today. No new required env vars, no new required
   services.
3. **Pure core, impure edges.** All CoT construction, parsing, and mapping is pure
   TypeScript in `core/src/lib/tak/`, unit-tested with vitest, importable by both
   the Next.js app and the sidecar. Sockets, certs, and retries live only in the
   sidecar.
4. **PHI never leaves by default.** See §8.

---

## 3. Current state inventory

### 3.1 Already built

*Updated 2026-08-15. The "uncommitted" caveat in the original draft is resolved —
all of the below is committed as `9fe8de6` on `feature/tak-georeference`, and the
"no production callers" gaps are closed.*

| Item | Location | State |
|---|---|---|
| `ControlPoint`, `Georeference` types | `src/app/types.ts` | Done |
| `Layer.georeference?` | `src/app/types.ts` | Done |
| `Staff.position?` / `Supervisor.position?` (`lat`, `lon`, `accuracy`, `timestamp`) | `src/app/types.ts` | Done — retained as the low-rate "last known" mirror; live positions go to `TeamPosition`, see §6.2 |
| Transform solver: 2-point anti-similarity, 3+-point least-squares affine, tangent-plane projection | `src/lib/geoUtils.ts` | Done, well-commented |
| `pixelToLatLon` / `latLonToPixel` | `src/lib/geoUtils.ts` | Done — now consumed by the venue editor readout and the residual math |
| `postName` / `postPercent` / `postLatLon` / `layerPostsLatLon` | `src/lib/geoUtils.ts` | Done — `layerPostsLatLon` now drives the venue editor's per-post coordinate readout |
| `georeferenceResiduals`, `METRES_PER_DEGREE_LATITUDE`, `MAX_ACCEPTABLE_RESIDUAL_METRES` | `src/lib/geoUtils.ts` | Done (2026-08-15) |
| Control-point placement UI + validation | `src/components/venue-management/{GeoreferenceSection,GeoreferencePointDialog}.tsx`, `venues/management/page.client.tsx` | Done |
| Per-post derived lat/lon readout + fit-quality banner | `venues/management/page.client.tsx`, `GeoreferenceSection.tsx` | Done (2026-08-15) |
| CoT pure modules `types` / `uid` / `cot` / `redaction` | `src/lib/tak/` | Done (2026-08-15) — `mapping.ts` and `kml.ts` deliberately deferred, see §0.2 |
| TAK config + position types (`TakPublishSettings`, `TeamPosition`, `PositionSource`, `takUid`) | `src/app/types.ts` | Done (2026-08-15) — types only, no producer or consumer yet |
| vitest harness | `vitest.config.ts`, `npm run test:unit` | Done — 81 tests (geoUtils + tak) |

### 3.2 Relevant existing architecture

- **Service abstraction.** All data access goes through `IDbService` /
  `IAuthService` / `IStorageService` (`core/src/lib/services/`), selected at build
  time by `NEXT_PUBLIC_BACKEND` (`firebase` | `pocketbase`). The bridge must not
  break this — it needs its own server-side adapters (§6.4).
- **Single mutation funnel.** `updateEvent(updateInput)` in the dispatch page wraps
  `dbService.runTransaction` (cloud) or `saveLiteEvent` (lite). Every status change
  — `handleStatusChange`, `handleTeamStatusChange`, `handleSupervisorStatusChange`,
  `handleEquipmentStatusChange` — routes through it. This is the single place to
  detect "something changed, republish CoT" if publishing ever happens client-side.
- **Realtime read.** `dbService.subscribeToDocument<Event>('events', eventId, …)`
  (dispatch page line ~1470). The bridge uses the server-side equivalent.
- **Status vocabulary.** `core/src/lib/statusColors.ts` is the canonical status list
  (`Available`, `En Route`, `On Scene`, `Transporting`, `On Break`, `In Clinic`,
  `En Route Eq`, `Assisting`, `Delivered Eq`, `Resolved`, …) plus
  `deriveTeamVisualStatus()`, which is what the dispatcher actually sees. CoT
  mapping should use the *derived* status, not the raw one.
- **Deploy targets.** Firebase Hosting → Cloud Function SSR (root `firebase.json`),
  and self-host via `core/docker-compose.yml` / `core/Dockerfile` /
  `core/Dockerfile.pocketbase`. The bridge slots into the Docker path as one more
  service; Firebase deployers run it anywhere (Cloud Run, a Pi, a venue laptop).
- **Security rules.** `core/firestore.rules` scopes `events` and `venues` by
  `orgId` membership. New collections need rules.
- **HIPAA conventions.** `core/CLAUDE.md`: no telemetry that could capture PHI,
  respect `DISABLE_TELEMETRY`, never log `Call`/`Staff`/`Supervisor` details.

---

## 4. Architecture: options considered

| # | Option | Verdict |
|---|---|---|
| A | Browser opens CoT connection directly | **Rejected.** Browsers cannot open raw TCP/TLS. Only viable against CloudTAK's WebSocket, which would make CloudTAK mandatory and put TAK credentials in the browser. |
| B | Next.js API route proxies to a TAK REST API (CloudTAK) | **Partially adopted.** Stateless HTTP works fine from a Cloud Function, and it is the cheapest outbound path *if* the deployer runs CloudTAK. Adopted as one adapter inside the bridge, and as the fallback for serverless-only deployers. Cannot do inbound streaming. |
| C | Standalone Node sidecar holding a persistent CoT/TLS connection | **Adopted as primary (Phase 2).** Backend-agnostic, TAK-server-agnostic, bidirectional, deployable as a container next to the app or on a venue laptop. Cost: one more process to run. |
| D | Read-only feed endpoint from Next.js (CoT-over-HTTP / KML network link) | **Adopted as Phase 1.** Zero new infrastructure, works on the existing serverless deploy, and gives IC-EMS immediate value on the WinTAK setup they already have. Limited: one-way, pull-based, no live push. |
| E | Native ATAK plugin (Android/Java, TAK.gov-gated SDK) | **Deferred (Phase 6).** Highest effort, Android-only, gated behind TAK.gov approval, and delivers nothing the bridge doesn't already deliver for the stated use case. |
| F | Managed TAK (Sit(x) et al.) | **Not a code decision.** Documented in ops guidance as an alternative to self-hosting; the bridge speaks to it the same way. |

### 4.1 Chosen shape

```
                       ┌────────────────────────────────────────┐
                       │  CrowdCAD (Next.js, Firebase/PocketBase)│
                       │  events/{id}  venues/{id}  positions/*  │
                       └───────┬───────────────────────▲─────────┘
             subscribe (read)  │                       │ throttled writes
                               ▼                       │
   ┌───────────────────────────────────────────────────┴───────────┐
   │  crowdcad-tak-bridge  (Node, always-on, self-hosted)          │
   │                                                               │
   │   core/src/lib/tak/  ← shared pure modules ─────────┐         │
   │     cot.ts  mapping.ts  redaction.ts  types.ts      │         │
   │                                                     │         │
   │   adapters:  tcp-tls (raw CoT)  │  cloudtak (REST/WS)         │
   └───────┬────────────────────────────────────▲──────────────────┘
           │ CoT out (TLS 8089 / TCP 8087)      │ CoT in
           ▼                                    │
   ┌───────────────────────────────────────────────────────────────┐
   │  TAK Server  (GOTS / FreeTAKServer / CloudTAK / managed)      │
   └───────┬───────────────────────────────────────────────────────┘
           │
     ATAK · iTAK · WebTAK · WinTAK/TAKX  (field + ops center)

   ── Phase 1 side path, no bridge, no TAK server ──
   GET /api/tak/feed.kml?token=…  ──▶  ATAK/WinTAK network link
```

---

## 5. Data model additions

All in `core/src/app/types.ts` unless noted. Every field optional; absent config
means the feature is off.

```ts
// ── TAK export configuration ────────────────────────────────────────────────
// Non-secret only. Certificates, keys, and passwords NEVER go in the database —
// org members can read the org doc, and a P12 in Firestore is a credential leak.
export type TakCallPublishMode =
  | 'off'             // default — no call markers published at all
  | 'location-only'   // marker at the call location, no clinical detail
  | 'full';           // + chief complaint in remarks. Requires explicit opt-in.

export interface TakPublishSettings {
  enabled: boolean;
  publishTeams: boolean;          // default true
  publishSupervisors: boolean;    // default true
  publishPosts: boolean;          // default true — static post markers
  publishCalls: TakCallPublishMode;   // default 'off'
  callsignPrefix?: string;        // e.g. "ICEMS" -> "ICEMS-Team 3"
  cotGroup?: string;              // TAK group/channel, e.g. "Cyan"
  staleSeconds?: number;          // default 120; see §7.4
  publishIntervalSeconds?: number;// default 30
}

export interface Event {
  // …existing fields…
  tak?: TakPublishSettings;
}

// ── Inbound binding ─────────────────────────────────────────────────────────
export type PositionSource = 'tak' | 'field-client' | 'manual';

export interface Staff {
  // …existing fields…
  /** CoT UID of the TAK device bound to this team; set in the dispatch UI. */
  takUid?: string;
  /** Where `position` came from. Absent = unknown/legacy. */
  positionSource?: PositionSource;
}
// same two fields on Supervisor
```

New standalone collection (**not** nested in the event doc — see §6.2):

```ts
/** One document per (event, team). Collection: `positions`. Doc id: `${eventId}__${team}`. */
export interface TeamPosition {
  eventId: string;
  orgId: string;          // for security rules
  team: string;
  lat: number;
  lon: number;
  accuracy: number;       // metres, CEP
  hae?: number;           // height above ellipsoid, metres; 9999999.0 = unknown
  heading?: number;       // degrees true
  speed?: number;         // m/s
  timestamp: number;      // epoch ms, device time
  receivedAt: number;     // epoch ms, server time
  source: PositionSource;
  takUid?: string;
  /** Best-guess venue layer, derived from the georeference; advisory only. */
  layerId?: string;
}
```

`Staff.position` is **kept** as a low-frequency "last known" mirror (written at most
once per team per few minutes, for the summary view and for offline reads), but the
live dispatch map subscribes to `positions`. Document this in the type comment so
nobody re-plumbs high-rate writes into the event doc later.

### 5.1 Firestore rules (`core/firestore.rules`)

```
match /positions/{positionId} {
  // Read: org members of the owning org.
  allow read: if request.auth != null
              && request.resource == null
              && isOrgMember(resource.data.orgId);
  // Write: org members (field clients) — bridge uses Admin SDK and bypasses rules.
  allow create, update: if request.auth != null
              && request.resource.data.orgId is string
              && isOrgMember(request.resource.data.orgId)
              && request.resource.data.eventId is string;
  allow delete: if request.auth != null && isOrgMember(resource.data.orgId);
}
```

PocketBase equivalent: add a `positions` collection in
`core/scripts/setup-pocketbase.js` with matching list/create/update rules.

---

## 6. Implementation phases

### Phase 0 — Finish the georeference groundwork (prerequisite) — ✅ COMPLETE except 0.4

*Status 2026-08-15: 0.1 verified, 0.2 and 0.3 implemented, 0.4 blocked on an external
artifact from IC-EMS. Exit criteria met. Details and decisions in §0.*

The transform math is done and tested. What is missing is everything that *uses*
it. TAK export cannot produce a single coordinate until this lands.

**0.1 Persist georeference** ✅ *Verified, no code change required.*
`buildGeoreferenceForSave()` in `page.client.tsx` already omits `undefined` at every
depth (`label` and `updatedBy` are omitted rather than set to `undefined`, satisfying
Firestore's constraint), bumps `version`/`updatedAt` only for layers whose control
points actually changed this session, and the save path filters top-level keys only —
so the nested `controlPoints` array survives intact. The original concern that
`stripUndefined()` might eat the array does not apply: it recurses into arrays and
filters `undefined` *elements*, it does not drop the array itself.

Original task text follows — confirm `Layer.georeference` round-trips through
`dbService.updateDocument('venues', …)` in `page.client.tsx:854`, including
`version` bump and `updatedAt`/`updatedBy` on save. `stripUndefined()` must not eat
the nested `controlPoints` array.

**0.2 Surface derived coordinates in the venue editor.** ✅ *Done.*
`layerPostsLatLon()` now drives a per-post lat/lon readout (6 decimal places) in the
Locations tab of `page.client.tsx`. Coverage is **all layers**, not just the active
one — see decision §0.3(4). Posts on a georeferenced layer that were never placed on
the map show `not placed on map`; on an uncalibrated layer nothing is shown, since a
hint on every row would be noise rather than signal.

**0.3 Add a residual/fit-quality readout.** ✅ *Done.*
`georeferenceResiduals(georef)` in `geoUtils.ts` returns `{ perPoint, maxMetres,
rmsMetres }` (or `null` when the transform is unsolvable). `describeGeoreferenceStatus()`
now reports e.g. `least-squares affine fit (4 points), max error 3.2 m, RMS 1.8 m`,
and flips to a warning tone above `MAX_ACCEPTABLE_RESIDUAL_METRES` (25 m) telling the
operator the fit is too inaccurate for geospatial export and to re-check the control
point coordinates. Reported for 3+ points only — see decisions §0.3(1)–(3).

**0.4 Verify against a real overlay.** ⛔ *Blocked — external dependency.*
Requires an existing georeferenced WinTAK seating-chart overlay (KMZ or GeoTIFF) from
IC-EMS; extract its known corner coordinates and use it as a vitest fixture to
validate the solver end-to-end. **This is an open ask to IC-EMS, not a coding task.**
Until it is satisfied the solver is validated against synthetic fixtures only, which
catch math errors but cannot catch a systematic misunderstanding of how a real overlay
is georeferenced.

**Exit criteria:** ✅ met — a venue layer can be georeferenced in the UI, every post
shows a lat/lon, and fit quality is displayed in metres (with an explicit warning
when the fit is too poor to trust).

---

### Phase 1 — Read-only feed (no new infrastructure) — 🟡 PARTIAL

*Status 2026-08-15: the spike-independent half of 1.1 is built and tested. `mapping.ts`,
`kml.ts`, and everything in 1.3–1.4 remain gated on the two spikes (§1.5, §7.3) —
see §0.2 for why that boundary was drawn where it was.*

Ship value against the existing serverless deploy, before anyone stands up a TAK
server.

**1.1 Pure modules.** Create `core/src/lib/tak/`:

```
core/src/lib/tak/
  types.ts     ✅ CotEvent, CotPoint, CotDetail, COT_UNKNOWN,
                  candidate COT_TYPE_* constants (marked UNVERIFIED)
  cot.ts       ✅ buildCotXml(e: CotEvent): string
                  parseCotXml(xml: string): CotEvent | null
                  escapeXml, formatCotTime
  uid.ts       ✅ CROWDCAD_UID_PREFIX, slugify, teamUid, supervisorUid,
                  postUid, callUid, isCrowdcadUid
  redaction.ts ✅ applyRedaction(cot, mode): CotEvent | null
  kml.ts       ⛔ deferred — gated on the §1.5 KML network-link spike
  mapping.ts   ⛔ deferred — gated on the §7.3 CoT type-code spike
```

The purity constraint below is enforced in what shipped: the only imports anywhere
under `src/lib/tak/` are `import type { TakCallPublishMode } from '@/app/types'` and
sibling `./types` imports. No `firebase`, no `next`, no DOM, no Node built-ins, no
new npm dependencies.

Test coverage for what shipped: 40 tests across `cot.test.ts`, `uid.test.ts`, and
`redaction.test.ts` — build→parse round-trips, XML escaping of hostile input
(`<`, `>`, `&`, quotes, emoji, no double-escaped ampersands), `COT_UNKNOWN` sentinels
asserted *not* to be `0`, UID determinism and echo-suppression prefix matching, and
the PHI allowlist test described in §0.3(6).

Hard constraint: **no imports outside `@/app/types` and `@/lib/geoUtils`.** No
`firebase`, no `next`, no DOM, no Node built-ins. These modules must run
unmodified in the browser, in a Cloud Function, and in the sidecar. `buildCotXml`
uses string templating with strict XML escaping — do not pull in a DOM/XML library
for output. `parseCotXml` may use `fast-xml-parser` (MIT), which is
environment-neutral.

**1.2 `eventToCotEvents`** ⛔ *Not started — gated on the §7.3 type-code spike.*
The building blocks it needs (UID helpers, XML builder, redaction, and the
georeference accessors from Phase 0) are all in place, so this becomes mostly
assembly once the spike locks the type codes down.

— the heart of the integration. Pure function,
`(Event, Venue, TakPublishSettings, nowMs) => CotEvent[]`. Responsibilities:

- Solve each layer's georeference **once** via `solveGeoreference` (or
  `layerPostsLatLon`, which already amortizes it).
- Emit a **post marker** per placed post per georeferenced layer.
- Emit a **team marker** per `Staff` entry: prefer live `position`; fall back to the
  lat/lon of the post named in `staff.location`; emit nothing if neither resolves.
  (Falling back to post location is a deliberate, useful default — it means TAK
  shows something real for a fleet with no GPS devices at all.)
- Use `deriveTeamVisualStatus(status, event, team)` from `statusColors.ts` for the
  status text, so TAK and the dispatch board never disagree.
- Emit **call markers** only per `settings.publishCalls`, after `applyRedaction`.
- Skip layers with no georeference, and posts with `postPercent() === null`,
  silently. Both are normal production shapes.
- Deterministic UIDs (§7.2) so repeat publishes update markers rather than
  littering the map.

**1.3 Feed route** ⛔ *Not started — gated on the §1.5 KML spike, which §1.5 itself
says must return before this is built.*

— `core/src/app/api/tak/[eventId]/feed.kml/route.ts` and
`.../feed.cot/route.ts`.

- Auth: a per-event, revocable feed token (opaque random string stored on the event
  doc as `tak.feedTokenHash`, compared with a constant-time hash). TAK clients
  fetching a network link cannot do interactive auth, so a bearer token in the URL
  is the only practical mechanism — which makes revocation and rotation mandatory,
  not optional. Rotate on demand from the UI; expire automatically when the event
  ends (`Event.ended`).
- `Cache-Control: no-store`; the client polls.
- Returns 404 (not 403) for a bad token, so the endpoint doesn't confirm event
  existence to an unauthenticated caller.
- Rate-limit per token.

**1.4 UI.** ⛔ *Not started.* The `TakPublishSettings` type it binds to exists;
nothing reads or writes it yet.

A "TAK" section in the event settings: enable toggle, publish switches,
callsign prefix, group, and a copyable feed URL with a "rotate token" button.
Compose from existing `event-create/` section components; follow the
`GeoreferenceSection.tsx` layout conventions (HeroUI `Card`, surface tokens,
status-tone banner).

**1.5 Verification spike** ⛔ *NOT RUN — this is now the single highest-priority
item in the whole plan.* It needs no code, only a WinTAK/ATAK install and a test
feed, and it gates 1.2, 1.3, and `kml.ts`.

(do this before 1.3 is finished). Confirm on real
clients that a KML network link is actually consumable:
- ATAK-CIV: import KML/KMZ works; **network-link refresh support varies by
  version — verify on the target release**.
- WinTAK: IC-EMS already runs it with manual overlays; test there first since it's
  the client they have.
- If network links prove unreliable, fall back to serving a **downloadable KMZ /
  Data Package** the dispatcher re-imports, and prioritize Phase 2 harder.

Do not build the whole feed route before this spike returns.

**Exit criteria:** a dispatcher pastes one URL into WinTAK and sees live-ish posts
and team positions with correct status colors.

---

### Phase 2 — The bridge (`crowdcad-tak-bridge`) — ⛔ NOT STARTED

**2.1 Location and packaging.** `core/services/tak-bridge/`, its own
`package.json`, TypeScript, built with `tsup`/`esbuild` to a single bundle.
`tsconfig.json` sets `baseUrl: "../../"` and `paths: { "@/*": ["src/*"] }` so it
imports the shared pure modules from `core/src/lib/tak/` without duplication.
Ships as a service in `core/docker-compose.yml` (opt-in profile) and a
`Dockerfile.tak-bridge`.

**2.2 Configuration** — environment only, never the database:

```
CROWDCAD_BACKEND=firebase|pocketbase
CROWDCAD_EVENT_IDS=evt_abc,evt_def      # or CROWDCAD_ORG_ID to follow all active events
GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json   # firebase
POCKETBASE_URL / POCKETBASE_ADMIN_TOKEN           # pocketbase

TAK_ADAPTER=tcp|cloudtak
TAK_HOST=tak.example.org
TAK_PORT=8089                 # 8089 CoT/TLS, 8087 CoT/TCP
TAK_TLS_CLIENT_P12=/secrets/client.p12
TAK_TLS_CLIENT_P12_PASSWORD=…
TAK_TLS_CA=/secrets/ca.pem
TAK_TLS_REJECT_UNAUTHORIZED=true    # never default to false

CLOUDTAK_URL / CLOUDTAK_TOKEN       # when TAK_ADAPTER=cloudtak

TAK_PUBLISH_INTERVAL_SECONDS=30
TAK_STALE_SECONDS=120
TAK_INGEST_ENABLED=true
TAK_INGEST_MIN_WRITE_INTERVAL_SECONDS=10
TAK_INGEST_MIN_MOVE_METRES=15
```

**2.3 Adapter interface.**

```ts
export interface TakTransport {
  connect(): Promise<void>;
  publish(events: CotEvent[]): Promise<void>;
  /** Inbound stream; no-op for transports that cannot subscribe. */
  onCot(handler: (e: CotEvent) => void): void;
  close(): Promise<void>;
  readonly state: 'connecting' | 'open' | 'reconnecting' | 'closed';
}
```

Two implementations:
- `TcpTlsTransport` — `node:tls` socket, CoT XML framing, mutual-TLS via P12.
  Exponential backoff with jitter (1 s → 60 s cap), heartbeat, resubscribe on
  reconnect. Start with **XML over TLS**; TAK Server accepts it for compatibility.
  Protobuf ("TAK protocol v1") negotiation is a later optimization, not a
  requirement — note it and move on.
- `CloudTakTransport` — REST for injection, WebSocket for inbound. Thinner, no
  cert handling, viable for deployers who already run CloudTAK (MIT-licensed, and
  the most natural REST-in/CoT-out target).

**2.4 Outbound loop.**
1. Subscribe to `events/{eventId}` (and its `venues/{venueId}`) server-side.
2. On change **or** every `TAK_PUBLISH_INTERVAL_SECONDS`, call
   `eventToCotEvents(...)`.
3. Diff against the last published set by UID; publish new/changed, and publish a
   final stale-now message for UIDs that disappeared (team removed, call resolved)
   so markers age off rather than lingering.
4. Republish everything on reconnect — TAK servers do not persist client state.

**2.5 Inbound loop** (feature-flagged by `TAK_INGEST_ENABLED`).
1. Receive CoT from the server.
2. Ignore anything CrowdCAD itself published (UID prefix match) — **echo
   suppression is mandatory** or the bridge will feed itself in a loop.
3. Resolve `cot.uid` → team via `Staff.takUid`. Unbound UIDs go to a
   "pending TAK devices" list surfaced in the dispatch UI, where a dispatcher binds
   device → team (§6.3). **Never auto-bind** by callsign string matching.
4. Apply the write throttle (§6.2) and write to `positions`.

**2.6 Health and observability.** `GET /healthz` on the bridge: transport state,
last publish time, last inbound CoT time, event subscription count, reconnect
count. Structured logs. **Log no PHI** — no chief complaint, age, gender, patient
notes, ever, per `core/CLAUDE.md`. Log team callsigns and UIDs only.

---

### Phase 3 — Inbound positions in the dispatch UI — ⛔ NOT STARTED

**3.1 Subscribe.** New hook `core/src/hooks/useTeamPositions.ts`, built on
`dbService.subscribeToQuery<TeamPosition>('positions', [where('eventId','==',id)])`.
Returns a `Map<team, TeamPosition>` plus per-team staleness.

**3.2 Render.** Overlay team markers on the existing venue map in the dispatch
view, converting lat/lon → image percentage with `latLonToPixel` against the
active layer's georeference. Reuse `map-pan-surface.tsx` / `map-zoom-controls.tsx`
and `useZoomPan`; colour markers with `getStatusColor(deriveTeamVisualStatus(...))`
so they match team cards exactly. Positions older than `2 × staleSeconds` render
dimmed with a "last seen Nm ago" tooltip rather than disappearing.

**3.3 Device binding UI.** In `teamcard.tsx` (or a small modal under
`modals/event/`), let a dispatcher bind a TAK UID to a team, from the list of
unbound UIDs the bridge has seen. Show battery/staleness if present in the CoT
`<status>` detail.

**3.4 Layer inference.** Given a position, pick the most plausible layer by
checking which georeferenced layers contain the point in image space (0–100 in both
axes). Advisory only — write it to `TeamPosition.layerId`, show it as a hint, and
label it as a guess in the UI. Do **not** auto-switch the dispatcher's active
layer based on it, and do not present it as ground truth. See §2.2.

---

### Phase 4 — Field client PWA — ⛔ NOT STARTED (but this is what IC-EMS actually asked for)

Scoped here for sequencing, planned in detail separately.

- Route `core/src/app/field/[eventId]/page.tsx`, mobile-first, install-to-home-screen.
- Sign in as a team (short-lived event code, not a full account).
- Three large status buttons driven by the existing status vocabulary; optimistic
  UI with offline queue.
- `navigator.geolocation.watchPosition` → throttled writes to `positions` with
  `source: 'field-client'`.
- Status changes write through the same shapes `updateEvent()` produces, so the
  dispatch board treats them identically to dispatcher-entered changes.
- Everything the PWA writes flows out through the bridge to TAK for free — no extra
  work. **This is why the phases compose.**

Assume degraded, non-FirstNet cellular in a dense crowd: aggressive batching,
exponential backoff, visible "not synced" state, and never block the UI on a write.

---

### Phase 5 — Ops guidance, no code — ⛔ NOT STARTED

Documentation deliverables in `core/docs/TAK_DEPLOYMENT.md`:

- Choosing a server: GOTS TAK Server (TAK.gov registration, free but an approval
  step) vs FreeTAKServer (EPL, pip-installable, no registration, no SLA) vs
  CloudTAK (MIT, best REST surface) vs managed. For a single-venue collegiate EMS
  deployment, **CloudTAK or FreeTAKServer on a small VM** is the pragmatic call.
- Firewall/network: 8089 (CoT/TLS), 8087 (CoT/TCP), 8443 (admin), 8446 (cert
  enrollment / WebTAK), 9000-series for federation.
- Cert enrollment for a volunteer-managed, heterogeneous phone fleet — the real
  operational cost of TAK, and the thing most likely to eat game-day setup time.
- Connectivity fallback: Meshtastic's TAK-server-bridge mode on iOS turns a phone
  into a local TAK endpoint over LoRa, no cell dependency. Worth a pre-season test
  at the venue. Nothing in CrowdCAD changes — the bridge points at that endpoint
  like any other.
- FirstNet: eligibility tiering (Primary vs Extended Primary) and device
  provisioning are a carrier/procurement track, not a software track. Start it
  early if it matters; it will not be resolved by game day otherwise.

---

### Phase 6 — ATAK plugin — ⛔ NOT STARTED (explicitly deferred)

Only revisit if field providers end up carrying ATAK as their primary device *and*
the PWA proves insufficient. Requires TAK.gov approval, the Android plugin SDK,
per-ATAK-version rebuilds (quarterly trimester releases), and APK distribution to a
volunteer fleet. High ongoing maintenance, narrow benefit. Recommend against for
now, and revisit no earlier than a full season of production use.

---

## 6.1 – 6.4 Cross-cutting design notes

### 6.2 Write-rate constraint (important)

`Event` embeds calls, staff, and assignments in **one document**, and every
dispatcher client holds a live subscription to it. Writing GPS positions into
`Staff.position` at device rate would mean:

- Firestore's ~1 sustained write/second per-document limit exceeded with as few as
  a handful of devices;
- transaction contention against real dispatcher edits going through the same
  `runTransaction` funnel, causing retries and lost-update risk on *call* data;
- every dispatcher re-downloading the entire event document (all calls, all staff)
  on every GPS tick.

**Therefore:** live positions go to their own `positions` collection, one document
per (event, team), and writes are throttled at the producer:

- at most one write per team per `TAK_INGEST_MIN_WRITE_INTERVAL_SECONDS` (default 10 s);
- **and** only if moved more than `TAK_INGEST_MIN_MOVE_METRES` (default 15 m) or
  more than 60 s has elapsed;
- `Staff.position` is refreshed at most every few minutes as a "last known" mirror.

With 10 devices this is ~1 write/s spread across 10 documents — comfortable.

### 6.3 Identity mapping

CrowdCAD's unit of dispatch is a **team** (`Staff.team`, a string like `"Team 3"`).
TAK's unit is a **device UID**. These are not the same: teams have multiple members,
devices get swapped mid-event, and a volunteer fleet has no stable device→person
registry. Explicit binding by a dispatcher (`Staff.takUid`) is the only reliable
mapping. Never infer it from callsign strings — two agencies at one venue will
collide on `"Team 3"` on the first shared federation.

Callsigns published outward are `${callsignPrefix}-${team}` so a federated map
stays unambiguous.

### 6.4 Backend-agnosticism in the bridge

The browser-side `IDbService` adapters use client SDKs and cannot be reused
server-side. The bridge needs a minimal server-side counterpart:

```ts
interface BridgeDbSource {
  subscribeEvent(eventId: string, cb: (e: Event) => void): Unsubscribe;
  getVenue(venueId: string): Promise<Venue>;
  writePosition(p: TeamPosition): Promise<void>;
  mirrorStaffPosition(eventId: string, team: string, p: TeamPosition): Promise<void>;
}
```

Two implementations: `firebase-admin` and PocketBase (admin token + realtime
subscriptions). Keep the surface this small deliberately — it is four methods, not
a second copy of `IDbService`.

---

## 7. CoT mapping specification

### 7.1 Message shape

```xml
<event version="2.0"
       uid="crowdcad.{eventId}.team.{teamSlug}"
       type="a-f-G-U-C"
       how="m-g"
       time="2026-08-11T18:04:22.000Z"
       start="2026-08-11T18:04:22.000Z"
       stale="2026-08-11T18:06:22.000Z">
  <point lat="39.180820" lon="-86.525520" hae="9999999.0" ce="12.0" le="9999999.0"/>
  <detail>
    <contact callsign="ICEMS-Team 3"/>
    <__group name="Cyan" role="Team Member"/>
    <precisionlocation geopointsrc="GPS" altsrc="???"/>
    <remarks>Status: On Scene | Post: Gate 4 | Level: Concourse 200</remarks>
  </detail>
</event>
```

Rules:
- `hae` and `le` use `9999999.0` for unknown (the CoT convention) — never `0`.
- `ce` carries `accuracy` in metres when known; `9999999.0` otherwise.
- All timestamps ISO-8601 UTC with milliseconds.
- XML-escape every interpolated string. Callsigns and post names are user input.

### 7.2 UID scheme

Deterministic and namespaced, so republishing updates rather than duplicates, and
so echo suppression is a simple prefix test:

```
crowdcad.{eventId}.team.{slug(team)}
crowdcad.{eventId}.sup.{slug(team)}
crowdcad.{eventId}.post.{layerId}.{slug(postName)}
crowdcad.{eventId}.call.{callId}
```

### 7.3 Type codes — **verify before trusting**

| CrowdCAD entity | Proposed CoT type | Confidence |
|---|---|---|
| Staff team | `a-f-G-U-C` (friendly ground unit) | High — standard for personnel/teams |
| Supervisor | `a-f-G-U-C` + `role="Team Lead"` in `__group` | High |
| Post (static) | `b-m-p-w` (waypoint) | Medium |
| Call / incident | `b-r-f-h-c` (CASEVAC / 9-line) or a generic point | **Low — verify** |
| Emergency beacon | `b-a-o-tbl` / `b-a-o-pan` / `b-a-o-can` | Medium |

**Status 2026-08-15:** ⛔ spike NOT run. The four candidate codes above are committed
as constants in `src/lib/tak/types.ts`, each annotated with its confidence level and
sitting behind a prominent UNVERIFIED warning comment. Nothing consumes them yet
(`mapping.ts` is deferred precisely so that they cannot leak into a real broadcast
before being confirmed). The spike's deliverable is concrete: confirm or correct four
named constants, then delete the warning.

**Action:** before implementing `mapping.ts`, run a verification spike — publish one
of each candidate type to a test server, observe the rendered icon in ATAK-CIV and
WinTAK, and lock the table down against what actually renders. Do not ship type
codes derived from documentation alone; a wrong type code renders as a confusing or
alarming symbol on a partner agency's map. Record the confirmed table in
`core/src/lib/tak/types.ts` as commented constants.

### 7.4 Staleness

`stale = time + staleSeconds` (default 120 s), with
`publishIntervalSeconds` default 30 s — a 4× margin, so two dropped publishes don't
make a stationary team vanish. If publishing is slowed for bandwidth, raise
`staleSeconds` proportionally.

### 7.5 Status → remarks

Human-readable, not machine-parsed by TAK. Publish the **derived** status from
`deriveTeamVisualStatus()`, plus assigned post and layer name. Do not encode
clinical detail here — that is the PHI boundary (§8).

---

## 8. Privacy, PHI, and security

This is the section to get right; everything else is recoverable.

**Publishing CoT is broadcasting.** Every connected TAK client, every federated
partner server, and every server administrator sees it. There is no per-recipient
access control beyond coarse group/channel scoping.

1. **`publishCalls` defaults to `'off'`.** Nothing about a call leaves CrowdCAD
   unless a deployer explicitly turns it on, per event.
2. **`'location-only'` is the recommended maximum.** A marker at the incident
   location with a call number and nothing else. That is operationally sufficient
   for "send help here."
3. **`'full'` requires a hard-blocked confirmation in the UI** naming exactly which
   fields will be transmitted (`chiefComplaint`), and stating that they leave
   CrowdCAD's access controls. `age`, `gender`, `notes`, and `log` are **never**
   published in any mode — enforce that as an allowlist in `redaction.ts`, not a
   denylist, and unit-test it.
4. **Logging.** Per `core/CLAUDE.md`, no `console.*` of `Call`/`Staff`/`Supervisor`
   detail. The bridge logs UIDs, team names, and counts only. Respect
   `DISABLE_TELEMETRY`.
5. **Transport.** TLS with `rejectUnauthorized: true` and a pinned CA. Plain-TCP
   8087 is permitted only for a loopback/lab setup and must warn loudly at startup.
6. **Feed tokens** (Phase 1) are bearer credentials in a URL: store hashed, rotate
   on demand, auto-expire on `Event.ended`, rate-limit, 404 on mismatch.
7. **No secrets in the database.** Certificates, P12 passwords, and CloudTAK tokens
   live in the bridge's environment/secret mount only. `TakPublishSettings` is
   deliberately non-secret so it can live on a document org members can read.
8. **Position data is sensitive too.** Staff location history is personal data even
   without PHI. Positions should not outlive the event: add a retention job that
   deletes `positions` documents for ended events after a configurable window
   (default 30 days).

---

## 9. Licensing

CrowdCAD is AGPL-3.0; network use triggers source availability for any modified
hosted version, including a third party's deployment.

| Dependency | License | Verdict |
|---|---|---|
| CoT protocol / spec | open spec | Fine |
| CloudTAK | MIT | Fine to depend on, call, or vendor |
| FreeTAKServer | EPL (weak, file-level) | Fine as an external service dependency |
| `fast-xml-parser` (proposed) | MIT | Fine |
| ATAK/iTAK/WinTAK/TAKX clients | Government-managed, **not** open source | We never link against them — we speak CoT over the wire. Fine. |
| Vendor/contractor tools (e.g. `tak-cad`, TAKwerx dispatcher plugin) | Varies | **Read the license before depending on anything from a defense contractor.** Do not vendor without review. |

`crowdcad-tak-bridge` is part of CrowdCAD and ships AGPL-3.0. Keep it in the same
repository so that is unambiguous. Per-library license check is a checklist item in
the PR template for this feature.

---

## 10. Testing strategy

**Unit (vitest — harness already exists, `npm run test:unit`):**
- `cot.ts`: build → parse round-trip; XML escaping of hostile callsigns/post names
  (`<`, `&`, quotes, emoji); unknown-value sentinels; timestamp formatting.
- `mapping.ts`: golden-fixture CoT XML for a representative event — team with live
  position, team with post-fallback only, team with neither, ungeoreferenced layer,
  legacy string post, post with `x/y === null`. Assert count and UIDs exactly.
- `redaction.ts`: allowlist enforcement — assert `age`/`gender`/`notes`/`log` never
  appear in output at any mode, including `'full'`. This is the one test that must
  never be skipped.
- `geoUtils` residual math added in Phase 0.

**Integration:**
- `docker-compose` profile bringing up FreeTAKServer + the bridge + the Firebase
  emulator; seed an event, assert CoT arrives with the expected UIDs; inject inbound
  CoT, assert a throttled write lands in `positions`; assert echo suppression drops
  CrowdCAD's own UIDs.
- Throttle test: 100 synthetic position updates in 10 s produce ≤ 2 writes.

**E2E (playwright-bdd, existing harness under `core/tests/e2e/`):**
- `tak-config.feature` — enable TAK on an event, rotate the feed token, confirm the
  old token 404s.
- `tak-positions.feature` — seed a `positions` document, assert the marker renders
  on the dispatch map at the expected image coordinates, and dims when stale.

**Manual client matrix** (record results in `core/docs/TAK_DEPLOYMENT.md`):
ATAK-CIV (current release), iTAK, WebTAK, WinTAK (IC-EMS's current client) — icon
rendering per type code, stale behavior, network-link refresh, callsign display.

---

## 11. Risks and open questions

| Risk | Impact | Mitigation |
|---|---|---|
| KML network links unsupported/unreliable in target clients | Phase 1 loses most of its value | Spike **first** (1.5); fall back to downloadable KMZ/Data Package and accelerate Phase 2 |
| Wrong CoT type codes | Confusing or alarming symbols on partner maps | Verification spike (7.3) before implementation; lock the table with observed evidence |
| Bad georeference silently produces wrong coordinates | Teams shown in the wrong place — actively dangerous | Phase 0.3 residual readout in metres; refuse to publish CoT when max residual exceeds a threshold (propose 25 m) and surface why |
| Position write rate | Firestore contention with live call editing | Separate `positions` collection + producer-side throttle (§6.2) |
| Echo loop bridge ↔ server | Runaway traffic, duplicated markers | UID-prefix suppression, integration-tested |
| Cert enrollment on a volunteer phone fleet | Game-day setup burns hours | Document early; pre-season enrollment session; consider CloudTAK's browser client to skip per-device certs for some roles |
| TAK.gov registration lead time | Blocks GOTS server/ATAK-CIV access | Start registration immediately; FreeTAKServer/CloudTAK unblock development in the meantime |
| Scope creep toward "3D seating" | Consumes the season with no shippable result | §2.2 — state plainly that this is a surveying procurement, out of scope |
| Congested non-FirstNet cellular | Positions stop flowing at peak | Throttling + offline queue + visible sync state; Meshtastic bridge as a tested fallback |

**Open questions for IC-EMS (and any deployer):**
1. Who runs the TAK server, and which one? (Answer changes the adapter priority.)
2. Who owns the TAK.gov registration, and has it been started?
3. Is any PHI export ever acceptable, or is `location-only` the permanent ceiling?
4. Is there an existing georeferenced overlay (KMZ/GeoTIFF) we can use as a
   Phase 0.4 fixture?
5. Do field providers carry ATAK, or a browser? (Decides Phase 4 vs Phase 6
   priority — and per §2.2, the browser answer is the better one.)
6. Is federation with another agency's server expected this season? (Certificate
   exchange and a mutual agreement — organizational lead time, start early.)

---

## 12. Sequencing

| Phase | Status | Rough effort | Depends on | Ships |
|---|---|---|---|---|
| 0 — georeference completion | ✅ done (0.4 blocked) | S | — | Calibratable venue layers with visible fit quality |
| 1 — read-only feed | 🟡 1.1 partial | M | 0 + KML spike | One URL into WinTAK, live-ish picture |
| 2 — bridge (outbound) | ⛔ | L | 1 + type-code spike | Real-time CoT to a real TAK server |
| 3 — inbound + dispatch map | ⛔ | M | 2 | Field positions on the dispatch board |
| 4 — field PWA | ⛔ | L | 3 (schema only) | **The thing IC-EMS actually needs** |
| 5 — ops docs | ⛔ | S | 2 | Deployers can self-serve |
| 6 — ATAK plugin | ⛔ deferred | XL | — | Revisit after a full season |

**Spike status — both still outstanding, and they are now the critical path:**

| Spike | Gates | Status |
|---|---|---|
| (a) KML network-link support on WinTAK / ATAK-CIV | `kml.ts`, feed route (1.3) | ⛔ NOT RUN |
| (b) CoT type-code icon rendering | `mapping.ts` (1.2), and everything downstream | ⛔ NOT RUN |

Neither needs a development environment — they need a TAK client and a test server.
Until they run, Phase 1 cannot correctly proceed past the pure modules already built,
and Phases 2–3 inherit the same blocker.

**If the season is short and only one thing ships: Phase 0 + Phase 4.** That
delivers the operational need — field providers reporting status without radio —
and leaves the TAK export as a follow-on that reuses everything already built.

---

## 13. File manifest

✅ = landed as of 2026-08-15. Unmarked = still outstanding.

New:

```
✅ src/lib/tak/types.ts                    CoT domain model, COT_UNKNOWN, candidate type codes
✅ src/lib/tak/cot.ts                      escapeXml, formatCotTime, buildCotXml, parseCotXml
✅ src/lib/tak/uid.ts                      deterministic UID helpers + echo-suppression test
✅ src/lib/tak/redaction.ts                applyRedaction — the PHI allowlist
✅ src/lib/__tests__/tak/{cot,uid,redaction}.test.ts
✅ docs/TAK_INTEGRATION_PLAN.md            this document, moved here from the root wrapper
   src/lib/tak/{kml,mapping}.ts            gated on the §1.5 / §7.3 spikes
   src/lib/__tests__/tak/mapping.test.ts
   src/app/api/tak/[eventId]/feed.kml/route.ts
   src/app/api/tak/[eventId]/feed.cot/route.ts
   src/components/event-create/TakIntegrationSection.tsx
   src/hooks/useTeamPositions.ts
   services/tak-bridge/**                  (package.json, src/, Dockerfile.tak-bridge)
   docs/TAK_DEPLOYMENT.md
   tests/e2e/features/{tak-config,tak-positions}.feature
```

Modified:

```
✅ src/app/types.ts                                  TakPublishSettings, TeamPosition, PositionSource, takUid, Event.tak
✅ src/lib/geoUtils.ts                               georeferenceResiduals + threshold constants (Phase 0.3)
✅ src/lib/__tests__/geoUtils.test.ts                residual tests
✅ src/app/(main)/venues/management/page.client.tsx  derived lat/lon readout (Phase 0.2)
✅ src/components/venue-management/GeoreferenceSection.tsx  residual readout (Phase 0.3)
   firestore.rules                                   positions collection — deferred to Phase 2/3, see §0.2
   scripts/setup-pocketbase.js                       positions collection — deferred to Phase 2/3
   src/app/(main)/events/[eventId]/dispatch/page.tsx position overlay + TAK UID binding
   src/components/dispatch/teamcard.tsx              TAK device binding affordance
   docker-compose.yml                                opt-in tak-bridge service
   docs/ARCHITECTURE.md                              document the bridge boundary
```
