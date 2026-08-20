# TAK Integration — Implementation Plan

**Status:** In progress — Phase 0 complete, Phase 1.1–1.2 and 1.4 complete, inbound bridge complete, 1.3/1.5 blocked, Phase 7 complete except 7.D. **A 2026-08-18 field report reopened the plan: a real basemap (new Phase 8) and multi-level venues (new Phase 9) are now in scope — read §0.6 first. Two of the three reports are now closed: the checkout split (§0.6.1) and label behaviour (7.E(3), §0.6.3). The third — the round trip (§0.6.4) — is still open and is the largest gap in the project.** **A second 2026-08-18 report confirmed Phase 8 was still unstarted at the time and surfaced a gap in how it was scoped — read §0.6.6. Later the same day, Phase 8 was implemented: 8.A–8.F are built (`maplibre-gl`/`pmtiles`/`@protomaps/basemaps` are now dependencies, `BasemapView.tsx` renders the second view, the raster/basemap toggle is wired into `venuemapmodal.tsx`), and 8.G is built for the control-point capture use ("Use my location" in `GeoreferenceSection`) but the basemap-view self-marker use is not wired to any caller. **Phase 8 has now been visually verified working in a browser** — the first time any of it has been looked at rather than merely type-checked — against the local Berkeley PMTiles extract: base map, venue raster, and labels all draw in the correct order, both post markers place correctly, and attribution is present (§8.H). Getting there found and fixed four real bugs, the first of which is load-bearing enough to have its own callout: **`maplibre-gl` must stay pinned to 5.x, not 6.x — §0.3(59), §8.A.** Phase 8 is still 🟡 IN PROGRESS for the reason it was before: the code is entirely uncommitted, and no basemap assets are checked in (a developer must run `scripts/fetch-basemap.sh` and set `NEXT_PUBLIC_BASEMAP_PMTILES_URL` to see anything render). See §0.5's "Phase 8 visually verified" entry, §8.H, and §0.1.**
**Target:** CrowdCAD (`core/`), general-purpose capability; IC-EMS is the first deployer
**Author:** drafted 2026-08-11
**Last updated:** 2026-08-18
**Branch:** `feature/tak-integration` — **the single branch for all TAK work**
**Latest code:** the merge of `feature/tak-phase0` into `feature/tak-integration` (2026-08-16)

> ✅ **The two TAK branches have been merged.** Outbound CoT publishing and the
> inbound FreeTAKServer bridge now live on one branch. There is no longer a second
> effort to reconcile — see §0.45 for what survived the merge and why.

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
- **§0.6 is the 2026-08-18 field report** — three problems reported from the running
  app, each traced to code. It reopens decisions §2.2 and §7.E had closed, and it is
  where to look before trusting any ✅ in §0.1.

**If you are starting a session:** read §0.1–§0.3, then §0.4 for the next action,
then only the phase section you are about to touch.

**Before you end a session:** update the §0.1 table, add any judgment calls to
§0.3, and append a §0.5 entry. A stale tracker is worse than none — it will be
trusted and it will be wrong.

### 🔴 The branch rule — read this before you write any code

**All TAK work goes on `feature/tak-integration`. One branch. No exceptions.**

**Commit to `feature/tak-integration` every time you complete a phase.** Not at the
end of the project, not when it feels tidy — at each phase boundary, as a matter of
course. A phase that is finished but uncommitted is a phase that can be lost, and
worse, a phase the next session cannot see.

**Never commit TAK work to `main`.** And never start a new branch for "just this
part" of TAK.

Why this rule exists, in one paragraph: it was written *after* the failure it
prevents. Two TAK efforts ran in parallel on separate branches — `feature/tak-phase0`
and `feature/tak-integration` — in two checkouts whose git object databases could not
even see each other. Neither session knew the other existed. They independently
designed the same live-position type twice, disagreed on a CoT type code, and built
two georeference models, and the second effort was only discovered by accident. The
merge that fixed it (§0.45) cost a session and threw away real, working code that had
simply been written twice. Splitting TAK across branches is not a neutral
organizational choice; it is how that happens again.

Practical form:

```bash
cd core
git branch --show-current        # must print feature/tak-integration
# ... finish a phase, verify it ...
npm run type-check && npm run test:unit
git add -A && git commit -m "feat(tak): <what the phase delivered> (Phase N.M)"
```

Then update §0.1, §0.3, and §0.5 in this document **in that same commit or the next
one** — the tracker and the code should never be more than one commit apart.

⚠️ **Committing is not pushing.** See the push warning below; it still stands.

### Where the code is

| | |
|---|---|
| Repo | the **`core/` submodule**, not the root wrapper |
| This document | `core/docs/TAK_INTEGRATION_PLAN.md` — **the canonical copy** |
| Branch | `feature/tak-integration` — **all TAK work, both directions** |
| Working checkout | `.claude/worktrees/fts-local-dev/` (root) and its `core/` |
| Outbound (publish CoT) | `core/src/lib/tak/` — `cot.ts` `mapping.ts` `redaction.ts` `types.ts` `uid.ts` |
| Inbound (ingest CoT) | `dev/crowdcad-tak-bridge/` + `dev/freetakserver/` in the **root wrapper** |
| Live positions in the UI | `core/src/lib/takInterpolation.ts`, `core/src/hooks/useTakTween.ts`, `useTakPositions.ts` |
| Pushed? | **No.** The merge and everything after it are local. See the warning below. |
| Retired branch | `feature/tak-phase0` — fully merged in; do not commit to it again |

⚠️ **`core`'s only remote is the PUBLIC `evanqua/crowdcad`.** A bare `git push`
publishes. The merge has not been pushed; treat pushing as a deliberate, owner-only
act.

⚠️ **The two-checkout trap — this is what caused the split.** TAK work has been done
in two places: the main checkout at `core/`, and the root worktree at
`.claude/worktrees/fts-local-dev/`. **A root worktree gets its own submodule module
directory**, so `.git/modules/core` and `.git/worktrees/fts-local-dev/modules/core`
are *separate repositories with disjoint object databases*. Branches created in one
are invisible in the other — `git merge-base` across them fails with
`Not a valid object name`, and `git branch -a` gives no hint the other exists. That is
precisely why two TAK efforts ran for days without noticing each other.

Before starting TAK work, confirm you are somewhere that can see the branch:

```bash
git -C core branch --list feature/tak-integration   # must print the branch
```

If it prints nothing, you are in a checkout whose object database lacks it. Bridge it
by fetching from the other module directory *by local path* rather than starting a new
branch:

```bash
git -C core remote add other /path/to/repo/.git/modules/core   # or .git/worktrees/<wt>/modules/core
git -C core fetch other 'refs/heads/*:refs/remotes/other/*'
```

### Verify the state you inherited

Don't verify by commit SHA — this document gets amended, so the tip moves while the
code doesn't. Check for the *artifacts* instead:

```bash
cd core
ls src/lib/tak/                    # expect: cot.ts  mapping.ts  redaction.ts  types.ts  uid.ts
ls src/hooks/useTakPositions.ts    # expect: present — this is the INBOUND half
npm run test:unit                  # expect: 7 files, 122 passed
npm run type-check                 # expect: clean, no output
```

Both the outbound modules and the inbound hooks must be present. If you have one and
not the other, you are on a pre-merge tree.

Failure modes, in the order you're likely to hit them:

| Symptom | What it means |
|---|---|
| `src/lib/tak/` present, `useTakPositions.ts` missing | Pre-merge `feature/tak-phase0`. You are missing the entire inbound bridge. |
| `useTakPositions.ts` present, `src/lib/tak/` missing | Pre-merge `feature/tak-integration`. You are missing all outbound CoT publishing. |
| `src/lib/tak/` missing, 34 tests pass | You're on `9fe8de6` or earlier — Phase 1 code is absent. |
| `src/lib/tak/` missing, 0 tests / no `geoUtils.test.ts` | You're on a branch with no TAK work at all. Check `git branch -a` — **and re-read the two-checkout trap above**, because the branch may exist in a module directory you cannot see. |
| 105 tests pass, 6 files | Pre-merge phase0 tip. |
| 122 tests pass, 7 files | You have everything described in §0.1. Proceed. |
| `Cannot find module 'vitest'` | This worktree has no `node_modules`. Either `npm install` here, or symlink `core/node_modules` (it is excluded locally via `.git/modules/core/info/exclude`, not `.gitignore` — the tracked ignore pattern is `node_modules/` with a trailing slash and does not match a symlink). |

If the counts drift after future work, trust §0.1's table over these numbers.

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
| **1.2** | **`mapping.ts` — `eventToCotEvents()` + 22 tests** | **Done** | `3f0451c` |
| **1.2** | **`COT_TYPE_CODES_VERIFIED` flag, propagated onto every `MappingResult`** | **Done** | `3f0451c` |
| **1.2** | **Call markers now carry a `callsign` (redaction allowlist extended by one already-allowed value)** | **Done** | `3f0451c` |
| **1.4** | **`settings.ts` — `DEFAULT_TAK_PUBLISH_SETTINGS`, `withTakDefaults`, `describeSkipReason`, `summarizeSkips` + 17 tests** | **Done** | this session |
| **1.4** | **`TakSection.tsx` — event-settings TAK panel, wired into the create/edit page as a `TAK` tab** | **Done** | this session |
| **1.4** | **Live diagnostics preview — `eventToCotEvents`'s first non-test caller (read-only, transmits nothing)** | **Done** | this session |
| **1.4** | **Unverified-type-code banner surfaced to the operator** | **Done** | this session |
| — | **`types.ts` cross-refs to a nonexistent "plan §0.6" corrected to §0.45/§7.3** | **Done** | this session |
| — | **Disambiguation banner on the root wrapper's rival `dev/TAK_INTEGRATION_PLAN.md`** | **Done** | this session |
| — | **Georeference reconciliation — `geoUtils.mercator-conformance.test.ts` (14 tests) proving the affine solver and `georef.js` agree** | **Done** | this session |
| — | **`georef.js` "How far this applies" scoping header + `georef.test.js` cross-pin tripwire on the shared fixture** | **Done** | this session |
| — | **`docs/TAK_OPEN_QUESTIONS.md` — §11's six questions restated for IC-EMS** | **Done** | this session |
| **7.3** | **`dev/freetakserver/spike-typecodes.mjs` — the type-code spike harness. Publishes one marker per candidate code and prints an observation sheet** | **Done** | this session |
| **2.5** | **Bridge echo suppression widened from one hardcoded UID to a `crowdcad.` prefix match, + cross-repo tripwire test** | **Done** | `78c86ad` (root wrapper) |
| **7** | **Phase 7 scoped: pin-droppable calls (both directions) + coordinate-first map — §6 Phase 7, §5.2 types, §7.2 UID rules, §7.3 seventh observation, §8(9) inbound PHI, §12, §13** | **Planned** | 2026-08-17 |
| — | **Call-position gap and the map's raster assumptions recorded in §0.2; §0.4's "everything is hardware-gated" conclusion superseded a second time** | **Done** | 2026-08-17 |
| — | **Bridge pin-misfiling defect documented (§0.2, §0.3(40)) — live today, found while scoping Phase 7** | **Documented, then fixed — see next row** | 2026-08-17 |
| **7.D (prereq)** | **Bridge pin-misfiling defect FIXED: `parseEvent` now returns `kind: 'pin'` for `b-m-p-*` instead of collapsing it into `kind: 'position'`; `bridge.js` gained pure `shouldWritePosition()` and drops pins before `buffer.offer()`. README's type table no longer documents the bug as correct behaviour** | **Done** | `0445d3c` (root wrapper) |
| **7.A** | **`Call.position` (`CallPosition`: lat/lon of record, `x`/`y` derived, `georeferenceVersion`, `source`, `placedAt`/`placedBy`, provenance-only `takUid`) + `PositionSource` + `TakPinReport` for the 7.D review queue** | **Done** | `b23cf92` |
| **7.C** | **`buildCallEvent` precedence rewritten: a placed pin outranks the post name-match, and publishes with `ce = COT_UNKNOWN`. Skip detail now names both failure modes. `mapping.test.ts` 15 → 28 tests** | **Done** | `50dd6b4` |
| **7.E(2)** | **`GeoTransform.version` stamping, `postLatLon` / `layerPostsLatLon` return `georeferenceVersion`, tri-state `georeferenceStaleness()`. `geoUtils.test.ts` 40 → 49 tests** | **Done** | `47157a4` |
| **7.E(2)** | **Root cause behind it: replacing a layer's map image never invalidated that layer's georeference, so every post silently relocated. `handleSubmit` now treats a map swap on a layer that has control points as georeference-dirty (bumping `version`) without discarding the points** | **Done** | `47157a4` |
| **7.E(2) f/u** | **`describeGeoreferenceStatus` stops reporting a stale fit as "ok" — residuals suppressed rather than shown beside a warning, because a fit measured against the wrong image is meaningless, not merely worse** | **Done** | `dbb7dce` |
| **7.E(2) f/u** | **…and it now survives a save: `Georeference.calibratedForMapUrl` + `georeferenceMapMatch()` derive staleness from the image identity, so reopening the venue tomorrow no longer shows a confident "ok". `geoUtils.test.ts` 49 → 56** | **Done** | `a46de5c` |
| **7.E(1)** | **Off-map edge indicators. New pure `src/lib/offMapUtils.ts` (`offMapIndicator` → badge edge point, arrow angle, true bearing + distance) and `geoUtils.metresBetween()`; wired into `venuemapmodal.tsx` for both off-map call pins and `tak.onMap: false` teams. `geoUtils.test.ts` 56 → 63, new `offMapUtils.test.ts` 15. Suite 193 → 215** | **Done** | `a094350` + `67f8804` |
| — | **2026-08-18 field report investigated and recorded: §0.6, §0.3(51)–(54), revised §0.4, Phase 7.E(3) scoped, Phases 8 (basemap) and 9 (multi-level) newly written. No code.** | **Done** | 2026-08-18 |
| **0.4(0a)** | **Checkout consolidation. `feature/tak-georeference` merged into `feature/tak-integration` in the main checkout, whose `core` was pinned at `9fe8de6` and could not resolve any TAK commit. The two submodule object databases were bridged by a local remote rather than a re-clone, and the fts-local-dev worktree was detached rather than deleted so its gitignored TLS material survived. Six ✅ phases are now in a binary someone can actually run** | **Done** | `b8d24df` |
| **7.E(3)** | **Label behaviour. New pure `src/lib/labelScale.ts`: sub-linear scaling (`markerCounterScale` = `mapScale ** -k`, net size `mapScale ** (1 - k)`, `k = 0.5`), collision declutter (`declutterLabels`, hides rather than nudges), zoom-gated secondary detail (`minScale`). `layoutOffMapBadges` moved in as `layoutEdgeBadges` and subsumed as an obstacle set rather than left to run beside the new pass. Wired into BOTH `venuemapmodal.tsx` and the venue editor, which had opposite behaviours. New `labelScale.test.ts` 45. Suite 215 → 260** | **Done** | `3ea888f` |
| **7.B** | **Pin-drop UI: placement mode + drag-to-correct + clear on `venuemapmodal.tsx`, a `CallMarker` coloured through `getStatusColor()`, an optional draft-pin affordance on Quick Call, and the new pure `src/lib/callPositionUtils.ts` (`placeCallPin` refuses on an uncalibrated layer; `resolveCallPinPercent` re-derives x/y from the layer's current transform on every read). `Call.position` finally has a writer. 20 new tests, suite 173 → 193** | **Done** | `4dc00c8` |
| — | **Second 2026-08-18 field report investigated and recorded: §0.6.6. Phases 8.F (georeference is not a precondition in basemap view) and 8.G (device GPS as a control-point source) newly scoped within Phase 8. No code.** | **Done** | 2026-08-18 |
| **8.A** | **MapLibre GL JS chosen and wired, `maplibre-gl`/`pmtiles`/`@protomaps/basemaps` added to both root and core `package.json`, loaded only via dynamic `import()` inside `BasemapView.tsx` so a deployment with no basemap configured never pays for the ~200KB dependency. Initially shipped on `maplibre-gl@^6.4.1`; corrected to **`^5.24.0` and pinned** after visual verification showed 6.x silently drops all vector tile data (§0.3(59))** | **Done** | `0e030bc` |
| **8** | **Phase 8 visually verified working in a browser for the first time (local Berkeley PMTiles extract) — base map, venue raster (0.85 opacity), and Protomaps labels all draw in the documented §8.A layer order; both post markers place correctly; `© OpenStreetMap` attribution present. Four real bugs found and fixed in the process: the maplibre-gl 6.x incompatibility (§0.3(59)), unabsolutised sprite/glyph URLs (§0.3(60)), the `absolute inset-0` container collapsing to zero height (§0.3(61)), and the camera-fit deadlock on `load` (§0.3(62)). Full accounting in §8.H** | **Done** | `0e030bc` |
| **8.B** | **`src/lib/basemap/config.ts` — `readBasemapConfig()` / `isBasemapConfigured()`, `null` unless `NEXT_PUBLIC_BASEMAP_PMTILES_URL` is set (the degrade-to-nothing gate), 30 tests. `scripts/fetch-basemap.sh` builds the offline PMTiles/glyph/sprite bundle into `public/basemap/` (gitignored, mirrored into the root wrapper). No asset bundle is committed — a fresh clone has no basemap until the script is run and the env var is set** | **Done** | `0e030bc` |
| **8.C** | **`geoUtils.layerImageCorners()` — the four percent-corners evaluated through `pixelToLatLon`, MapLibre `ImageSource` order. `src/lib/basemap/style.ts` builds the style: Protomaps base → venue raster (opacity 0.85) → Protomaps labels on top. `BasemapView` only ever hands MapLibre a lat/lon it was given; it never asks MapLibre to compute one** | **Done** | `0e030bc` |
| **8.D** | **Second, selectable view. `MapViewMode = 'raster' \| 'basemap'` in `venuemapmodal.tsx`, persisted to `localStorage['crowdcad.venueMap.viewMode']`. Deviation from the plan text: defaults to basemap only when a basemap is configured AND the current layer is calibrated (not simply "when configured"), and the toggle sits bottom-left rather than an unstated default corner, because top-left is already claimed by the placement banners** | **Done** | `0e030bc` |
| **8.E** | **No code — this subsection is a framing warning ("a basemap will make the map look like a GIS without making it one"), not a deliverable. Still applies; ship the toggle with that caveat stated to IC-EMS** | **N/A** | — |
| **8.F** | **Basemap-view pin-dropping without control points — gate is `effectiveBasemap \|\| currentLayerCalibrated` (equivalent to the planned `viewMode === 'raster' && !currentLayerCalibrated`) guarding `UncalibratedLayerNotice` in `venuemapmodal.tsx`. `placeCallPinFromLatLon()` added to `callPositionUtils.ts` as the basemap-side writer; raster and basemap clicks share a new `writeCallPinPlacement` helper so `Call.position` cannot drift between the two paths** | **Done** | `0e030bc` |
| **8.G** | **`useDeviceLocation` hook (`classifyPositionError`, `classifyAccuracyQuality`, `getGeolocationUnsupportedReason`, 11 tests) and "Use my location" per control-point row in `GeoreferenceSection` — **built and wired**, including a coarse-fix warning (never a disable) above `MAX_ACCEPTABLE_RESIDUAL_METRES`, and `ControlPoint.accuracy?: number` on `types.ts`. **Not wired:** the basemap-view "you are here" self-marker — `BasemapView.tsx` accepts a `deviceLocation` prop and draws it, but no caller in `venuemapmodal.tsx` ever passes one, so a dispatcher in basemap view never sees their own position. A pre-existing bug was found and fixed in the same change: `buildGeoreferenceForSave` (`page.client.tsx`) was silently stripping `accuracy` off every control point on save; it now carries it through** | **Partially done** | `0e030bc` |
| **8.I** | **`Venue.basemapCamera` + the 4-level initial-camera precedence chain (saved camera → raster corners → located markers → archive coverage bounds → MapLibre default), `resolveInitialCamera()`, `parseArchiveCoverage`/`isOutsideCoverage`, `onCoverageWarning`. Shipped contract-first as two commits eight minutes apart so the shared type could not be a moving target. 22 tests in `camera.test.ts` — note the commit message's "26" is wrong; `npx vitest run` counts 22** | **Done** | `b6d3dc9` + `a78421a` |
| **8.J** | **Basemap in the *venue editor* — the raster/basemap toggle ported across from the dispatch modal, plus "Set default view" / "Clear default view" writing `Venue.basemapCamera` through the new `sanitizeBasemapCameraForSave()` (Firestore rejects `undefined` at any depth). 4 tests. Shipped together with 10.D because without it the button was inert** | **Done** | `40342f5` |
| **10.D** | **`onCameraChange` on `BasemapView` — fires on `moveend` and once when the map first becomes ready, held through a ref. Closes 8.J's inert "Set default view" button, which had been passing a callback through a type cast to a prop that did not exist. The mount emit was added during implementation and was not in the scoping: without it an operator cannot save a camera §8.I already resolved for them. The type cast at the editor call site is gone** | **Done** | `40342f5` |
| **10.C** | **`Post.lat`/`Post.lon` — a coordinate of record for the object form, following `CallPosition`'s convention rather than inventing a second one. `postGeoPosition()` added as the validating reader; `postLatLon`/`layerPostsLatLon` now let a stored coordinate win before the georeference is consulted, and solve it lazily so an all-coordinate-native layer performs zero solves. `postPercentOnLayer()` added (not in the scoping) as the read path for drawing a coordinate-native post on a raster — returns `null`, never a clamped value, off-image. No backfill migration. `geoUtils.test.ts` 70 → 85 tests** | **Done (uncommitted)** | this session |
| **10.E** | **Placement against the basemap in the editor. The marker-tool gate was *split*, not widened: "Add Markers" is now `previewUrl \|\| effectiveBasemap`, while "Add Control Point" stays raster-only because a control point is by definition an image-pixel↔ground correspondence. `handleBasemapMapClick` builds `{ name: '', x: null, y: null, lat, lon }` with every key explicitly present (post objects are written to Firestore verbatim). `pendingMarker` widened; `PendingMarkerDialog` shows the captured lat/lon to 6 dp. Both raster renderers now resolve through `postPercentOnLayer` so a map-placed post is not invisible in venue-image view. Dragging a coordinate-native post is deliberately disabled** | **Done (uncommitted)** | this session |
| **10.E(1)** | **Pre-existing, live, silently destructive: the editor's raster marker renderer used the post-`.filter()` index as if it were the index into the full `posts` array, so with any text-only or bare-string post present, dragging or renaming a marker acted on a *different* post. Fixed by capturing the original index before the filter** | **Done (uncommitted)** | this session |
| **10.E(2)** | **A venue with no image made the dispatch modal render `<Image src="">`, which Next.js reports as two console errors. Now omitted entirely with a muted empty-state in its place** | **Done (uncommitted)** | this session |

Everything in the first block above (rows through the vitest harness) was built in
earlier sessions and sat **uncommitted** on `feature/tak-georeference`; the first act
of the 2026-08-15 session was to commit it as `9fe8de6` so it could not be lost and
so an isolated branch could be cut from it.

> ✅ **RESOLVED 2026-08-17 (later the same day) in `78c86ad`.** Kept here because the
> recurrence is the point, not the fix.
>
> **What the state was.** Three completed items were uncommitted in the root wrapper's
> working tree — precisely what the branch rule above exists to prevent (*"a phase that
> is finished but uncommitted is a phase that can be lost, and worse, a phase the next
> session cannot see"*), and the **second** such occurrence.
>
> | Item | Where | Evidence then | Now |
> |---|---|---|---|
> | §2.5 echo suppression + tripwire test | `dev/crowdcad-tak-bridge/bridge.js`, `bridge.test.js` | `git show HEAD:…/bridge.js \| grep -c CROWDCAD_UID_PREFIX` → **0** | committed |
> | §0.3(30) type-code spike harness | `dev/freetakserver/spike-typecodes.mjs` | **untracked** | committed |
> | §0.3(34) FTS findings | `dev/TAK_DECISIONS.md` | modified, uncommitted | committed |
>
> The echo-suppression fix was the one that mattered most: without it **every marker
> CrowdCAD publishes under its own documented prefix comes straight back in as a GPS
> fix** (§0.3(32)).
>
> **The practice that caught it, and should be repeated.** Committing the inherited
> working tree was the *first* act of the session, before any new code — not because
> anything looked wrong, but because §0.1's own record said this had already happened
> twice. Verify by the commands in the evidence column, never by SHA: this document is
> amended in place, so tips move.

**Verification at the close of the 2026-08-15 session:** `npm run type-check` clean,
`npm run test:unit` 81/81 passing (up from 34), `npm run build` succeeds with all
routes compiling. Two pre-existing lint warnings in `page.client.tsx` (`uploadWithRetry`,
`LayerControlBar` unused) were confirmed to predate this work and were left alone.

**Verification at the close of the 2026-08-16 session (Phase 1.4):** `npm run type-check`
clean, `npm run test:unit` **139/139 passing across 8 files** (122 before 1.4 — the 81
figure above predates `mapping.ts`'s 22 landing — plus 17 new in `settings.test.ts`).
`npm run lint` shows only pre-existing warnings; `npx eslint` on the three new/changed
files individually is silent. Both numbers were re-run independently after the
implementing agent reported them, not taken on trust.

**Verification at the close of the 2026-08-16 session (georeference reconciliation):**
`npm run type-check` clean, `npm run test:unit` **153/153 passing across 9 files**
(139 before — 14 new in `geoUtils.mercator-conformance.test.ts`), and the bridge's
`node georef.test.js` **12/12** (11 before — one new cross-pin tripwire). All three
numbers were re-run independently after the implementing agent reported them, same
practice as above. No production code was touched this session: the diff is one new
test file, one new test case, one doc comment, and this tracker.

**Verification mid-2026-08-17 session (Phase 7.A / 7.C / 7.E2 + the bridge pin fix):**
`npm run type-check` clean, `npm run test:unit` **166/166 passing across 9 files**
(153 before — 13 new in `mapping.test.ts`, 9 new in `geoUtils.test.ts`, and 4 folded
into existing suites), bridge `node cot.test.js` **13/13** (12 before) and
`node bridge.test.js` **26/26** (23 before). Core working tree clean; the root wrapper
shows only the `core` submodule pointer.

Two agent-reported figures did **not** survive checking and are recorded because the
failure mode is worth recognising: two agents each self-reported "+13 tests, 166 total",
which cannot both be true (153 + 13 + 13 = 179). Each had counted the *other's*
additions as part of its own baseline. The real counts above come from re-running the
suite and reading the `describe` blocks directly. **Do not accept a test count from an
agent report when another agent has touched the same suite concurrently.**

### 0.2 Explicitly NOT done, and why

- **`kml.ts` and the `/api/tak/...` feed routes.** Still deferred. §1.5 gates these
  on the KML network-link spike, which needs a real TAK client. The feed route is
  also the *first place CrowdCAD would transmit to a network*, so it is exactly
  where the unverified-type-code gate has to be enforced — see §0.3(10).
- ~~**`mapping.ts` (`eventToCotEvents`)**~~ — **built 2026-08-16.** The original
  deferral reasoning was that §7.3's type-code spike gates it. On re-examination
  that conflated two different things: *choosing* the four type-code strings (which
  the spike settles) with *the mapping logic that consumes them* (which it does
  not). The strings were already committed as named constants in `types.ts`, so
  when the spike lands, correcting them is a four-line edit in one file and
  `mapping.ts` becomes correct for free. Meanwhile the spike-independent 95% —
  georeference solving, position fallback, status derivation, UID determinism, the
  PHI boundary — was blocking on nothing. What the deferral was actually protecting
  against is *broadcast*, and that protection now lives where broadcast happens:
  `COT_TYPE_CODES_VERIFIED` is propagated onto every `MappingResult`, and §1.3's
  feed route must refuse to transmit while it is false. See §0.3(10).
- **Phase 0.4 — validating the solver against a real georeferenced overlay.**
  Blocked on an external artifact: an existing WinTAK KMZ/GeoTIFF from IC-EMS.
  This is an open ask, not a technical obstacle. Until it is satisfied, the solver
  is verified only against synthetic fixtures.
- **`positions` collection security rules** (`firestore.rules`, `scripts/setup-pocketbase.js`).
  Not written. `TakPosition` (née `TeamPosition`) is wired to the bridge; security rules belong with
  Phase 2/3. See §0.45.
- **Phase 2 — INBOUND bridge (TAK → CrowdCAD).** ✅ Built and proven on real hardware.
  Lives in the root wrapper at `dev/crowdcad-tak-bridge/` and `dev/freetakserver/`. See §0.45.
- **Phase 2 — OUTBOUND publishing (CrowdCAD → TAK).** ⛔ Still not done, and easy to
  miss now that the inbound half works. **Nothing in the running app transmits.**
  As of Phase 1.4 `eventToCotEvents` finally has a non-test caller — the settings
  panel's diagnostics preview — but that caller renders the result to the operator's
  own screen and opens no socket. The gap between "the mapper runs in the app" and
  "the app publishes" is still the whole of §7.3 plus a transport. Do not read the
  diagnostics preview as evidence that publishing works.
- **Phase 3 — inbound positions in the dispatch UI.** ✅ Built, including device
  binding: `takInterpolation.ts`, `useTakTween.ts`, `useTakPositions.ts` wired into the
  map, and `Staff.takCallsign` editable from `addteammodal.tsx`.
- **Phases 4–6.** Untouched, as scoped.
- **Phase 7 — calls cannot be placed at a coordinate, in either direction.** Added to
  this plan 2026-08-17 after it was reported from the running app ("I can't drop a pin
  for a specific call"). This was never a deferral; it was an **unexamined assumption**
  baked in from the first draft — that a call's location is the name of a post. It is:
  `Call.location` is a `string` and `Call` has no coordinate field at all, so
  `buildCallEvent` can only locate a call by string-matching a placed post, and the
  venue map has no call marker. See Phase 7 for the full statement. §0.3(36) covers why
  the plan did not notice, which is the more useful lesson.
  **Closed for the outbound direction 2026-08-17:** 7.A (`Call.position`, `b23cf92`),
  7.C (publishing a call at its own coordinate, `50dd6b4`) and 7.B (the pin-drop UI,
  `4dc00c8`) are all done — model, writer, and publisher. The "field is real and nothing
  populates it" state noted here for most of the day is resolved; `Call.position` now
  has exactly one writer, `placeCallPin`. **Still open: 7.D** (inbound pins as proposed
  calls), whose bridge half is built (`0445d3c`) and whose review queue is gated on the
  §7.3 pin type code, i.e. on a phone.
- **Phase 7.E — the venue map is not yet a coordinate space.** Also reported from the
  running app ("the map is still a .png so all the locations are just hard coded"). Half
  of that is a misreading worth correcting in writing, because it will recur: post
  positions are *not* baked into the image — `Post` stores percentages of image
  width/height as data, and Phase 0's georeference already gives them real lat/lon. The
  half that is right is that the map still behaves like an image with dots on it: an
  off-image coordinate renders as nothing, and `Georeference.version` exists but nothing
  consumes it, so replacing a venue image silently moves every post. Phase 7.E(2) is a
  latent data-integrity bug rather than a missing feature.
  **7.E(2) closed 2026-08-17 (`47157a4`)** — at both ends: the version is now stamped
  onto every derived coordinate *and* a map swap on a calibrated layer actually bumps it
  (see §0.3(42), which is the part the task as written would have missed). **7.E(1) is
  still open:** an off-image coordinate still renders as nothing, with no edge indicator
  telling dispatch which way and how far. Note what 7.E(1) is *not* — it is not a
  basemap; see §2.2.

✅ **~~Known defect, live today~~ — FIXED 2026-08-17 in `0445d3c`.** The bridge used to
misfile a hand-dropped iTAK pin as a team GPS fix: `cot.js` accepted both `a-*` and
`b-m-p-*` as positional and wrote everything surviving to `tak_positions`, so a pin
somebody tapped moved a *team's* marker on the dispatch map. Echo suppression did not
help — it filters CrowdCAD's own UIDs, not a phone's. Same failure mode `core/CLAUDE.md`
already forbids for `nearestPost`, arriving by a different route.

`parseEvent` now classifies `b-m-p-*` as `kind: 'pin'` — deliberately a *smaller* shape
than `'position'`, with no `hae` and no `accuracy`, because a tap on a map has neither.
`bridge.js` gained a pure `shouldWritePosition(ev)` and drops pins before
`buffer.offer()`, logging them under `--verbose`. Per §0.3(40) the old expectations were
deleted on purpose rather than adjusted until green. The bridge README's type table had
listed `b-m-p-*` under "Position? **yes**" — i.e. it documented the bug as correct
behaviour — and now shows actual `kind` values.

**Pins are logged and dropped, not queued.** Phase 7.D's `tak_pin_reports` review queue
does not exist yet, and inventing a holding pen for them would create a second
half-built inbound path. Dropping is the honest interim behaviour; the alternative was
writing pins somewhere with no consumer.

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

10. **The unverified-type-code guard is data, not a lock.** The obvious way to keep
    unverified type codes off a partner's map is to make `eventToCotEvents` refuse
    to emit anything until the spike runs. That was rejected: it would make the
    module untestable by default, and it puts the guard in the wrong place —
    building a `CotEvent` object in memory harms nobody, *transmitting* it does.
    Instead `types.ts` exports a single `COT_TYPE_CODES_VERIFIED = false`, and
    every `MappingResult` carries it as `typeCodesVerified`. The obligation is
    stated in the module header and repeated here: **§1.3's feed route and §2's
    bridge must check that flag and refuse to transmit to a shared or partner TAK
    server while it is false.** One flag, one place to flip, and a caller that
    cannot plausibly claim not to have seen it.

11. **`eventToCotEvents` returns `{ events, skipped, typeCodesVerified }`, not a
    bare `CotEvent[]`** (a deviation from §1.2's stated signature). §11 requires
    refusing to publish a layer whose georeference residual exceeds 25 m, and §1.2
    requires silently skipping uncalibrated layers and unplaced posts. A bare array
    can express *that* something was dropped only by its absence, which turns the
    single most likely operator question — "why isn't Team 3 showing up in TAK?" —
    into a debugging session. Every skip is now a typed `{ reason, subject, detail }`
    record, and the detail string for a rejected layer contains the measured error
    and the limit it exceeded, ready to render in the §1.4 settings UI.

12. **A post-derived team position reports `how="h-e"` and `geopointsrc="USER"`,
    never `"m-g"`/`"GPS"`.** §1.2 makes falling back to the assigned post's location
    a deliberate default, and it is a good one — it means a fleet with no GPS devices
    at all still produces a real picture. But that position is a human-placed post on
    a human-georeferenced map, and labelling it as a GPS fix would tell every TAK
    client it is a live satellite position accurate to metres when it is a
    building-scale estimate of where someone was last *assigned*. The distinction is
    the difference between "Team 3 is here" and "Team 3 was posted here"; TAK has a
    field for it, so it gets used honestly.

13. **A marker's circular error carries the georeference fit's own residual.** For a
    live GPS fix, `ce` is the device's reported accuracy. For anything placed via a
    georeferenced layer — every post marker, and every post-derived team marker —
    `ce` is that layer's `maxMetres` residual, because a post is only as
    well-located as the transform that placed it. This costs nothing (the residual
    is already computed to enforce the 25 m gate) and makes the uncertainty visible
    to a TAK operator instead of implying millimetre precision.

14. **Posts are indexed by *slugified* name for team-location lookup.** `Staff.location`
    is a free-text field a dispatcher types; the post name is a free-text field
    someone else typed months earlier. Exact-match lookup makes "gate 4" vs "Gate 4"
    a silent no-marker failure. Reusing `slugify` from `uid.ts` means the matcher and
    the UID builder normalize identically, so a team that matches a post is
    guaranteed to match the same post the UID scheme names. Duplicate post names
    across layers resolve to the first georeferenced layer in order — genuinely
    ambiguous ("Medical Tent" on two levels are different places), so it is at least
    deterministic and documented rather than arbitrary.

15. **`applyRedaction` now emits `detail.callsign`** — a change to the PHI module,
    made deliberately and narrowly. It emits the *same* `identifier` value that
    already went into `remarks`, so no information that was previously withheld now
    leaves the system, and the allowlist stays a real field-by-field construction.
    The reason: a CoT event with no `<contact callsign>` renders in TAK as its raw
    UID (`crowdcad.evt1.call.abc123`) — unreadable as a map label and a gratuitous
    disclosure of internal identifiers to every federated partner. The chief
    complaint is pointedly **not** included: a callsign is a permanent label beside
    the icon and appears in contact lists, whereas remarks require opening the
    marker, so even in `'full'` mode clinical text stays behind that extra tap.
    Two tests in `redaction.test.ts` pin both halves of this.

16. **`mapping.ts` takes `now` as a parameter and reads no clock.** Combined with the
    deterministic UIDs, the whole module is a pure function, so the determinism test
    is a literal `JSON.stringify(a) === JSON.stringify(b)` and the republish-idempotency
    property (same UIDs at a later `now`, advanced timestamps) is directly assertable.

17. **One branch for all TAK work, committed at every phase boundary.** This reverses
    the earlier "do not merge" recommendation in §0.45, and it is the most consequential
    process decision in this document — see the branch rule at the top. The earlier
    recommendation optimized for a clean diff; the failure it permitted was two sessions
    building the same thing twice without knowing. A tidy diff is worth less than one
    person being able to see the whole system.

18. **When two designs collided in the merge, the one that had touched real hardware
    won.** `TakPosition`/`TakPositionRecord` was kept over `TeamPosition` not because it
    was better specified — `TeamPosition` had a richer field set (`orgId`, `hae`,
    `heading`, `speed`, a server-side `receivedAt`, a `source` discriminator) — but
    because it is the one wired to a bridge that has relayed a real phone's GPS through
    a real FreeTAKServer. A design proven against hardware carries information a design
    on paper does not. The dropped fields are listed in a note at the bottom of
    `types.ts` with instructions to add them *to the surviving type* rather than
    reintroduce a second one.

19. **The georeference models were deliberately NOT reconciled during the merge.**
    `geoUtils.ts` (affine + residual gate) and the bridge's `georef.js` (image-percentage
    projection) both survive. Nothing imports both, so the merge did not force a choice,
    and forcing one under merge pressure would have meant redesigning the working
    inbound path to prove a point. Left as Phase 2/3 work. This is the one place the
    old "they disagree architecturally" warning still has teeth.

    > **Superseded 2026-08-16 by §0.3(27).** The instinct not to force a merge was
    > right; the stated reason was wrong. They do not "disagree architecturally" —
    > they answer different questions, and one is a special case of the other. This
    > entry is kept because the decision it records (don't unify under pressure) was
    > correct and the reasoning is instructive about why a plausible framing survived
    > this long unchallenged.

20. **`mapping.ts` reads `member.tak`, and publishes off-map fixes.** The merge's only
    real integration edit. `onMap: false` means the fix falls outside the venue map
    *image* — a limitation of drawing on a picture, not doubt about the position — and
    TAK has real basemaps, so publishing it beats falling back to the post the member
    was merely assigned to. A test pins this.

--- *Phase 1.4, 2026-08-16* ---

21. **The feed URL and rotate-token button were deliberately left out of §1.4.** The
    phase as drafted asks the settings panel for "a copyable feed URL with a rotate
    token button". The §1.3 route that URL would point at does not exist and is gated
    on the §1.5 spike. Building the control anyway — even disabled, even labelled
    "coming soon" — would put a string in the UI that looks like a working feed
    endpoint and returns 404 to anyone who pastes it into WinTAK. A missing control
    is honest about the missing feature; a placeholder URL is not. The rest of §1.4
    shipped in full. Add this when §1.3 lands, not before.

22. **The settings panel renders `eventToCotEvents`'s `skipped` records as a live
    diagnostics preview.** §0.3(11) argued for typed skip records specifically so the
    operator question "why isn't Team 3 showing up in TAK?" would not require a
    debugger, and named the §1.4 UI as where they would be rendered. That is now
    built: the panel calls the mapper in a `useMemo` over data the page already has
    and shows marker counts plus grouped skips, surfacing the `layer-fit-unacceptable`
    detail string (measured error and the limit it exceeded) per subject. **This makes
    the mapper's first non-test caller a read-only one** — it computes into React
    state and opens no socket. That ordering is deliberate and worth preserving: the
    mapper gets exercised against real event shapes by real operators well before
    anything transmits, which is the cheapest possible place to discover that it is
    wrong.

23. **The unverified-type-code banner ignores the enable toggle.** Every other control
    in the panel dims when TAK publishing is off. The `COT_TYPE_CODES_VERIFIED` banner
    does not, because it is not a publish control — it is a statement about the state
    of the integration, and the operator most likely to need it is precisely the one
    about to turn publishing on for the first time. It is gated on the constant alone,
    so it disappears by itself when §7.3 flips the flag; nothing about the warning is
    hardcoded.

24. **`withTakDefaults` merges with `??`, never `||`.** Four of the nine fields in
    `TakPublishSettings` are booleans that default to `true`. Under `||`, an operator
    who deliberately turned `publishTeams` off would have that choice silently
    reverted on every read, because `false` is falsy — a settings panel that does not
    keep the setting. Both the panel and `eventToCotEvents` read through this one
    function, so "never configured" and "explicitly saved the defaults" behave
    identically. A test pins the `false`-preservation case.

25. **`describeSkipReason` is a `Record` keyed by the full union, not a `switch` with a
    default.** Adding a new `MappingSkipReason` to `mapping.ts` and forgetting to
    describe it now fails the type-check instead of rendering a blank row in the
    operator's diagnostics list. The failure mode this prevents is quiet: a skip
    reason with no label still *counts*, so the panel would report "3 skipped" and
    explain none of them — worse than not having the panel, because it looks
    authoritative.

26. **Diagnostics split teams from supervisors by `detail.groupRole`, not by type
    code.** `COT_TYPE_TEAM` and `COT_TYPE_SUPERVISOR` are currently the same string
    (`a-f-G-U-C`) — deliberately, per the note in `types.ts`: supervisors are
    distinguished in CoT by `groupRole`, not a distinct type. So the preview cannot
    count them apart by `type`, and reads `groupRole` instead, which `mapping.ts`
    already sets correctly for both. If §7.3 ever gives supervisors their own type
    code, this stays correct either way.

27. **The two georeference "models" were never rivals, and neither one is going
    away.** §0.45 and §0.3(19) both recorded this as technical debt — two
    implementations of the same thing that ought eventually to be unified, with
    `geoUtils.ts` named as "the better-specified of the two". That framing was
    wrong, and acting on it would have made the system worse. They answer
    different questions:

    - **`core/src/lib/geoUtils.ts` is a calibration solver.** An operator places
      2+ control points on an arbitrary venue image — a scanned floor plan, a
      hand-drawn site map, a PDF rotated to fit a page — and it fits a 4-DOF
      anti-similarity (exactly 2 points, exact fit) or a 6-DOF least-squares
      affine (3+ points). It has rotation and shear terms because it must: the
      image can be at any angle to north. Its output is an *estimate*, gated by
      `MAX_ACCEPTABLE_RESIDUAL_METRES = 25`.
    - **`dev/crowdcad-tak-bridge/georef.js` is the analytic inverse of a known
      crop.** `make-campus-map.py` builds the venue image by stitching OSM tiles
      for an exact bounding box, so the coordinate of every pixel is *known*, not
      fitted. `project()` computes image-x from longitude alone and image-y from
      latitude alone — there are no cross terms in the arithmetic — so it is
      structurally incapable of expressing rotation or shear. Not "assumes zero
      rotation": *has nowhere to put it.*

    So `georef.js` is a degenerate, diagonal-only member of the family `geoUtils.ts`
    fits. One general model, one exact shortcut valid only for one script's output.
    Unifying them would mean deleting exact arithmetic and replacing it with a
    fitted approximation of itself — strictly a downgrade, and the reason the
    "affine solver is better-specified" line has been struck from §0.45.

    **What was done instead of a refactor**, all of it additive:

    - `core/src/lib/__tests__/geoUtils.mercator-conformance.test.ts` (14 tests)
      pins the real `campus-map.json` `mercator` block as a fixture, derives four
      corner control points from `georef.js`'s own `unproject()`, fits
      `solveGeoreference` to them, and asserts the two agree across the interior.
      Measured divergence, affine-fit vs. Mercator-exact:

      | sample point | divergence |
      |---|---|
      | centre (50, 50) | **0.0370 m** |
      | (25, 75) | **0.0278 m** |
      | (10, 90) | **0.0133 m** |
      | (95, 5) near-edge | **0.0070 m** |

      The asserted bound is 0.1 m, comfortably above the 3.7 cm worst case. Note
      the *shape* of that table: error is largest in the middle and smallest near
      the corners, which is exactly what fitting an affine to four corner points
      should do, and is a useful sanity signal that the test measures what it
      claims to.
    - The same test perturbs the corner control points by hand-written asymmetric
      offsets of ~3–5 cm (no `Math.random()` — a flaky georeference test is worse
      than none) and shows divergence jumping to **0.67–5.59 m**, one to two
      orders of magnitude larger. This is the load-bearing result: *the model
      disagreement is negligible next to operator calibration error.* Anyone
      chasing centimetres between the two implementations is optimising the wrong
      term.
    - `georef.js` gained a "How far this applies" section stating the north-up-only
      limitation, that it throws rather than guesses on a sidecar with no
      `mercator` block, and that `geoUtils.ts` is the general solver for every
      other venue — with the conformance test named by path as the proof.
    - `dev/crowdcad-tak-bridge/georef.test.js` gained a tripwire that loads the
      real `campus-map.json` and asserts its four corner `unproject()` values still
      match the literals pinned in the core test. The two files are in different
      repos and different languages; without this, regenerating the campus map
      would silently make the core fixture stale and the conformance proof
      meaningless while both suites stayed green.

    **The scoping rule this establishes:** any venue image that is not
    `make-campus-map.py` output goes through `geoUtils.ts`, always. `georef.js`
    is not a faster path to be preferred where it happens to work — it is a
    special case that must refuse anything outside its narrow input shape, which
    it now does loudly.

28. **§11's open questions were extracted into a standalone IC-EMS-facing
    document** (`core/docs/TAK_OPEN_QUESTIONS.md`) rather than left as a section
    of an engineering plan. The plan is written for whoever is writing the code;
    it assumes CoT, federation, and GOTS mean something to the reader. The people
    who can actually answer these six questions are a clinical authority, a comms
    ops lead, and an inter-agency liaison, and none of them should have to read
    §7.3 to answer "can chief complaint leave CrowdCAD". The new document orders
    the questions by urgency rather than by plan numbering, and each one states
    what changes depending on the answer and what a *usable* answer looks like —
    because "we'll get back to you on the server" is not an answer that unblocks
    anything, whereas "undecided, ask again in two weeks" genuinely is.

    Each heading carries a `*(Plan §11, question N)*` cross-reference so the two
    documents cannot drift apart silently. §11 remains the source of truth for the
    engineering consequences; the new file is a translation, not a fork.

    One caution recorded because it nearly went wrong: the drafting agent's first
    version claimed CrowdCAD has adapters for all three TAK server types, that the
    feed URL ships today, and that PHI export defaults to on. All three were false,
    and all three would have been read by IC-EMS as commitments. They were caught
    by grepping `core/src` and reading `settings.ts` rather than by reviewing the
    agent's prose. **An outward-facing document generated from an inward-facing one
    must have every capability claim re-derived from the code**, not from the
    summary of the code — the failure mode is not a typo, it is promising a
    customer something that does not exist.

29. **The bridge stays in the wrapper repo for now — but the reason usually given
    for splitting it out is wrong, and the precondition for splitting it is not
    yet met.** The question was raised 2026-08-16: should
    `dev/crowdcad-tak-bridge/` become its own repository, on the standard
    reasoning that a standalone sidecar with its own runtime and deploy lifecycle
    normally earns one?

    The *pattern* is real and eventually right here. The *premise* — that the
    bridge is "unrelated" to the app — is the opposite of true, and it is the
    premise that decides the timing. Verified against the code:

    - `pocketbase.js` reads `events` records, mutates the **`staff` array (core's
      `Staff[]`)** and writes it back, and owns the `tak_positions` collection.
    - `georef.js`'s `nearestPost()` consumes core's `Post[]` shape, legacy
      bare-string entries included.
    - Device binding is `Staff.takCallsign`, defined in `core/src/app/types.ts`.

    The bridge is not adjacent to CrowdCAD's data model — it is a **direct writer
    into CrowdCAD's database using CrowdCAD's schema**. And that contract is held
    together by nothing but proximity: there is no schema-validation layer
    (`types.ts` is authoritative by convention only), and the bridge is plain JS,
    so nothing type-checks it even today. What actually catches drift is that both
    trees sit in one checkout and their suites run together — see the §0.3(27)
    tripwire, where `georef.test.js` asserts values pinned in a test inside
    `core/`. Split the repos as things stand and that check *cannot run in one CI
    job*: it degrades into two suites that stay green while disagreeing, which is
    strictly worse than the coupling it replaced.

    Two further costs specific to this project:

    - Repo count is already expensive here. §0.45 documents an entire parallel
      TAK effort lost to the wrapper/submodule/worktree topology. Going 2 → 3
      multiplies that, and the branch rule at the top of this document becomes
      unenforceable — a change spanning core and bridge could no longer be one
      atomic, reviewable commit.
    - The `certs-export/` and `fts-*.zip` ignore rules exist because those bundles
      contain a **private CA key**. Ignore rules are per-repo. A new repo starts
      with an empty `.gitignore` on the same day someone is copying files into it.

    **Decision: split later, contract first.** The precondition is that core↔bridge
    drift is caught by something other than shared folder membership — a versioned
    schema the bridge validates against at runtime, and the georeference fixture
    published as a data file both sides read rather than two hand-pinned copies.
    Once that exists the split is cheap and the standard reasoning applies
    properly. Done in the other order, it trades a coupling that is checked for one
    that is silent.

    **This changes no phase ordering** — nothing in §0.4 depends on repo layout.
    When the split does happen it touches core's `CLAUDE.md` ("The bridge is not
    in this repo…"), §13's file manifest, and the tripwire in §0.3(27).

30. **The §7.3 spike was never "one afternoon with a phone" — it was an
    afternoon of building a publisher, and nobody had built it.** §0.4 has
    called the spike the top priority for three sessions running, on the
    grounds that the equipment already exists and only a person with a phone
    is missing. That was true about the *equipment* and wrong about the
    *work*. Checked against the tree rather than the claim: nothing anywhere
    in `dev/` could publish a caller-chosen type code. `probe-cot.py`
    hardcodes `a-f-G-U-C` inline. `seed-berkeley.py` has a `cot()` helper that
    takes a `cot_type` parameter, but its `argparse` surface exposes only
    `--host/--plain/--move`, so changing a type means editing source. And the
    two codes core actually emits — `b-m-p-w` and `b-r-f-h-c` — appear
    **nowhere in `dev/` at all**: they have never been sent to a TAK server by
    anything, which also means they have never even been shown to be
    well-formed enough for a server to accept.

    So whoever finally sat down with a phone would have spent their afternoon
    hand-rolling CoT and reading this plan to reconstruct the candidate list,
    then eyeballed icons against a mental table. That is how a spike returns
    "mostly fine, I think."

    `dev/freetakserver/spike-typecodes.mjs` removes that afternoon. It
    publishes one marker per candidate, laid out on a spaced grid, and prints
    a numbered observation sheet. Three properties are deliberate:

    - **The callsign is the type code**, so the observer reads the icon and
      the code off the same label. No lookup table, no assumption that
      markers arrived in order, nothing to transcribe wrongly.
    - **The expected rendering is printed before the observation blank**, so
      the answer is compared against a written prediction rather than decided
      after the fact. A prediction you write down first is evidence; one you
      write down after is a rationalisation.
    - **There is a control marker** (`a-h-G-U-C`, hostile) that CrowdCAD must
      never publish. If it does not render obviously differently from the
      friendly team marker, the client is not doing symbol lookup by type and
      every other answer on the sheet is void. The sheet says to check it
      first. Without a control, "all the icons looked plausible" and "the
      client ignored my type codes entirely" are the same observation.

31. **The harness imports core's real modules rather than copying the codes,
    and this is the first time the §1.1 purity constraint has been cashed
    in.** §1.1 requires everything under `src/lib/tak/` to "run unmodified in
    the browser, in a Cloud Function, and in the sidecar." Until now that was
    an untested assertion — every consumer was a vitest file or a React
    component, both inside the app's build.

    The harness imports `cot.ts`, `types.ts` and `uid.ts` straight from
    `core/src/lib/tak/` into a plain `node` process with no build step, using
    Node's built-in type stripping plus a ~15-line resolve hook (needed only
    because TypeScript writes `./types` where Node's ESM resolver wants
    `./types.ts`). It works, unmodified, which is the claim §1.1 makes.

    The reason to do it this way rather than paste the four strings into the
    script: **the harness cannot drift from the thing it verifies.** Correct a
    constant in `types.ts` and the next run tests the corrected value. A
    copied list would be a second source of truth for exactly the values whose
    single source of truth is the entire point, and it would go stale on the
    same day the spike succeeded. It also means the spike publishes core's own
    `buildCotXml()` output, so it tests the real serializer and not a
    stand-in.

32. **Echo suppression in the bridge was a single hardcoded UID, not a prefix
    match, and would have fed CrowdCAD its own markers back as GPS fixes.**
    §2.5 lists echo suppression as mandatory. The inbound bridge was built by
    the sibling effort, which had no outbound half to defend against, so what
    it actually implemented was `if (ev.uid === 'CROWDCAD-BRIDGE') continue`
    — enough to skip its own announce and nothing else.

    Every marker CrowdCAD publishes carries a `crowdcad.`-prefixed UID
    (`uid.ts`), none of which equal that string, and team markers are
    `a-f-G-U-C`, which `cot.js` classifies as a **position**. So on the day
    outbound publishing lands, the bridge would have read CrowdCAD's own
    published team positions back out of the relay and written them to
    `tak_positions` as though a phone had reported them. The failure mode is
    the dangerous kind: the map keeps moving and looks entirely healthy, while
    what it is drawing is CrowdCAD's own echo rather than anybody's location.

    Now `isSelfPublished(uid)` prefix-matches `crowdcad.` and keeps the legacy
    exact match for the bridge's own announce. The prefix constant is
    duplicated in the bridge rather than imported — that file is
    dependency-free CommonJS and core's is TypeScript — so `bridge.test.js`
    pins the two together by reading `uid.ts` off disk and comparing the
    declared literal, the same cross-repo tripwire pattern §0.3(27) used for
    the georeference fixture. The test asserts the regex matched before
    comparing, so a rename in core fails loudly instead of passing on `null`.

33. **The bridge stores positions for callsigns that match no team, so
    publishing test markers into a live stack is not the harmless act it
    looks like.** This nearly cost real data this session. `core/CLAUDE.md`
    says an unmatched callsign is "logged once and **ignored** rather than
    guessed", which reads as "nothing is written". The code says otherwise:
    `bridge.js` comments that "binding is now purely a display concern — the
    position is stored either way, and the dispatch page decides what to
    draw", and warns the operator that the callsign "is stored but not shown
    on the map".

    Both statements are true of different things — the *team binding* is
    ignored rather than guessed, which is the §6.3 safety property; the
    *position record* is written regardless. But the wording invites exactly
    the wrong inference at exactly the wrong moment, which is when someone is
    deciding whether it is safe to fire test CoT at a stack with a live
    bridge on it. It is not: every marker of an `a-*` or `b-m-p-*` type
    becomes a `tak_positions` record keyed by its callsign.

    Hence the warning at the top of `spike-typecodes.mjs` telling you to stop
    the bridge first, and hence §0.3(32) mattering more than it looks — with
    the prefix fix in place, a current bridge ignores every marker the
    harness sends, because they all carry `crowdcad.` UIDs.

34. **The local FreeTAKServer had relayed nothing for two days while every
    check said it was fine.** This was found by accident, while smoke-testing
    the §7.3 harness against it, and it is the single most dangerous state
    this stack can be in.

    What the server's own logs say:

    - `messages sent to clients in 15 seconds: 0` — in **all 4026** sampling
      windows since the container started. Not a dip; it had never once
      fanned anything out.
    - `TypeError: a bytes-like object is required, not 'NoneType'` at
      `send_component_data_controller.py:65`, on `connection.sock.send(message)`,
      thrown 82 times, on `Action: connection` and `Action: disconnection`.
      FTS is holding connection records whose socket is `None` and dying in
      the fan-out loop.

    What every check available said, at the same time:

    | check | verdict | what it actually proves |
    |---|---|---|
    | `docker ps` | **healthy** | a process is running |
    | `probe-cot.py` | **✓ genuinely serving CoT** | the port accepts a connection and replies |
    | second client connected | received a `b-t-f` welcome banner | the port is alive |

    `probe-cot.py` cannot catch this, and the reason is worth stating plainly
    because `dev/TAK_DECISIONS.md` §9 currently recommends it as *the* way to
    confirm FTS is really live: its success criterion is "the server replied
    with CoT", and the reply it receives is FTS's own GeoChat welcome banner.
    That banner is generated locally on connect. It proves the listener is up.
    It says nothing whatsoever about fan-out — which, for a server whose
    entire job is fan-out, is the only property that matters.

    So the diagnostic ladder in §9 has a missing rung. `nc -z` proves less
    than `probe-cot.py`, and `probe-cot.py` proves less than "a second client
    saw the marker". Only the third is the actual question.

35. **Phase 7's sub-items are lettered (7.A–7.E), not numbered.** `§7.3` has meant
    *CoT type codes* since the first draft, and this document's own convention is that
    `§N.M` denotes Phase N.M for N ≤ 6 while `§7`–`§13` are spec sections. Adding a
    "Phase 7.3" would produce two live meanings for one label in a document whose
    stated purpose is to be picked up cold by someone with no other context. Letters
    cost nothing and remove the collision entirely. The alternative considered was
    numbering the new phase 8 to dodge the clash, which would have left a permanent
    gap at 7 that future readers would have to be told about.

36. **The plan missed the call-position gap for six phases, and the reason generalises.**
    Every layer of the export path was specified against `Call.location` without anyone
    writing down that `Call.location` is a *name*, not a place. The mapper's
    post-name lookup, the redaction allowlist, `publishCalls`, the settings panel and
    its diagnostics preview were all designed, built, and tested — and every one of them
    is *correct* given the assumption. That is exactly why it survived: nothing failed.
    The diagnostics preview even reports the symptom in production wording — `Call
    location "X" is not a placed post on a georeferenced layer` — and it reads as a
    configuration nag, not as "this data model cannot express a call's position."

    The lesson matches §0.4's earlier one about spikes almost exactly: *a skip reason
    that fires constantly is a design report, not a warning.* When a mapper's normal
    operating state is "this entity has no resolvable position", the thing to check is
    whether the entity can ever have one. Worth applying to the remaining skip reasons
    before Phase 1.3 treats them as ordinary.

37. **`Call.position` stores lat/lon as of record; `Post` keeps percent-of-image.** The
    inversion is intentional and is argued in Phase 7.A. Short form: a post is only ever
    authored by clicking an image, so image coordinates are its natural record; a call
    pin can arrive from a phone that has never seen the image, so lat/lon is the only
    representation a dispatcher's click and a responder's pin share. The rejected
    alternative — percent-of-image for both, for consistency — forces the bridge to pick
    a venue layer at ingest in order to store anything at all, which puts a venue
    decision in the one component that has no venue context (§6.4).

38. **A pin dropped on an uncalibrated layer is refused, not stored degraded.** A
    percent-only call position would be unpublishable, uncomparable to any GPS fix, and
    invisible to a partner agency, while looking on screen exactly like a working one.
    Refusing and surfacing the georeference prompt makes calibration a precondition
    instead of a silent quality tier. This mirrors §0.3(2)'s reasoning about not printing
    a fit quality that implies precision the fit does not have.

39. **An inbound pin becomes a *proposed* call, never a call.** §2.3(1) already makes
    CrowdCAD the system of record and TAK non-authoritative for call state; auto-creation
    would make a tactical map app on a volunteer-managed phone fleet an unauthenticated
    writer to the call queue. Pins land in `tak_pin_reports` (§5.2) for explicit dispatch
    accept/dismiss. The accept step is also where a human must type the chief complaint —
    which doubles as a PHI boundary (§8(9)), since a pin's operator-typed remarks are
    untrusted text that must never be auto-copied into a clinical field.

40. **Splitting `a-*` from `b-m-p-*` in the bridge is recorded as a behaviour change,
    not a fix in passing.** `cot.js` treats both as positional today, so a hand-dropped
    pin already moves a team's marker (§0.2). Two tested files encode the current
    behaviour, and the temptation will be to adjust them until they pass. They should
    change *visibly*, with the old expectation deleted on purpose — the whole reason this
    defect is invisible is that everything currently passes. Gated on §7.3's spike for
    the pin type code, and only for that: the split itself is knowable without hardware
    because CrowdCAD's *own* posts are already `b-m-p-w`.

    **Restarting the container did not fix it.** It came back `healthy`, and a
    re-run of the A/B test still relayed nothing (`number of CoT messages
    received by services: 0` while bytes were demonstrably being sent). This
    is still open — see §0.5.

    Why this belongs in a *type-code* plan: the §7.3 spike's whole method is
    "publish a marker, look at the phone, write down what you see". Against a
    server in this state the phone shows an empty map for every candidate, and
    the natural reading of an empty map is *the type codes are wrong*. They
    would not be. A silent relay failure and a bad type code are
    indistinguishable at the point of observation, and one of them would have
    been written into `types.ts` as a finding.

    That is why `spike-typecodes.mjs` now opens a second client before it
    publishes and reports which of its own markers came back. Zero returned
    prints a block telling the operator not to record the run as "did not
    render", and points at the two log greps above. The harness had to be able
    to tell "the server dropped it" from "the client drew it oddly" before any
    of its output could be trusted.

41. **Georeference staleness is tri-state — `'fresh' | 'stale' | 'unknown'` — and
    "unknown" is never collapsed into "stale".** A missing stamp and a mismatched stamp
    are different facts. Every position written before `GeoTransform.version` existed has
    no stamp, so folding the two together would relabel the entire existing corpus as
    known-wrong and train dispatch to ignore the warning. `'stale'` means *proven*
    mismatch: two numbers were compared and differed.

    An honest caveat, documented in `geoUtils.ts` itself: the accessors derive on every
    call, so a stamp returned by `postLatLon` always compares `'fresh'` against the
    georeference it was just derived from. The field earns its keep only once a caller
    **holds** the value across a render, a store write, or a TAK export — which is
    exactly what `CallPosition.georeferenceVersion` does. Stamping without a holder is
    infrastructure for a check that cannot yet fail; that is deliberate, and stated so
    nobody reads the passing comparison as evidence the mechanism has been exercised.

42. **The 7.E(2) task as written would have shipped a detector that was blind to the
    likeliest real failure.** The assignment was "consume `Georeference.version`". Doing
    only that leaves the question of what ever *changes* the version — and it turned out
    that replacing a layer's map image never marked the georeference dirty at all. Swap
    in a re-exported site plan with different margins and every control point still
    refers to the old pixels: posts move, the version does not bump, and a staleness
    check compares two identical numbers and reports `'fresh'`. The fix is at the source
    (`handleSubmit` treats a map swap on a layer that has control points as dirty), and
    the version stamping is the detector for what slips past it.

    **The control points are bumped, not cleared.** Discarding them would destroy a
    calibration that is often still nearly right — a re-export of the same plan at a new
    resolution — and force the operator to redo work they could have nudged. Bumping the
    version marks every derived coordinate as needing re-confirmation while keeping the
    material to re-confirm *with*.

43. **A call published from a placed pin carries `ce = COT_UNKNOWN`, not `0` and not an
    invented radius.** A pin is somebody's finger on a map: its error is real and
    unquantified, unlike a GPS fix, which arrives with a circular error the device
    actually measured. `COT_UNKNOWN` states "not known", which is true. `0` would claim
    certainty the pin has not earned, and a made-up radius would be a precision claim
    with nothing behind it. Same reasoning as §0.3(2) and §0.3(38).

44. **A placed pin outranks the post name-match, and the skip message now names both
    ways to fail.** `buildCallEvent` previously located a call only by string-matching
    `Call.location` against a placed post; with 7.A there are two sources and the
    explicit one must win — a dispatcher who dropped a pin has overridden the text.
    `reason: 'position-unresolved'` is unchanged (no new `MappingSkipReason`), because
    the outcome is identical and a new variant would oblige every consumer to learn a
    distinction that changes nothing for them. Only the human-readable detail grew, to
    say *both* "no pin" and "location is not a placed post on a georeferenced layer" —
    an operator reading the old message would have gone looking for a typo in a post
    name when the real answer was "drop a pin".

45. **A calibration records which image it was made against; staleness is derived from
    that, not stored as a flag.** `Georeference.calibratedForMapUrl` holds the
    `Layer.mapUrl` the control points were last placed or confirmed against, and
    `georeferenceMapMatch()` compares it with the layer's current `mapUrl`. Deriving
    removes the "someone forgot to clear the flag" failure mode entirely: there is no
    state to maintain, only two strings to compare.

    **It answers a different question from `georeferenceStaleness()` and does not replace
    it.** That one asks *"was this coordinate derived from the calibration currently in
    force?"* and needs a coordinate that was stamped at derivation time. This one asks
    *"is the calibration currently in force valid at all?"* and needs only the layer —
    which is what an operator opening the venue editor has, and precisely what the status
    banner had no way to determine. A test asserts both at once on the same layer: a
    freshly derived coordinate is version-`'fresh'` while the layer is map-`'stale'`.

    **The field advances only on a points edit, never on a map swap** — which is why
    `buildGeoreferenceForSave` now takes `pointsConfirmed` separately from `isDirty`.
    `isDirty` means "something invalidating happened" and covers both causes; only the
    operator actually re-checking the points earns the stamp. Merging them would have the
    swap's own save erase the staleness that swap created. For the same reason, choosing
    a new map file *removes* that layer from `georeferenceDirtyLayerIds`, so "edit points,
    then swap the image, then save" cannot stamp the new URL onto points that never saw
    it; the version bump is unaffected because `mapReplaced` still supplies one.

    Tri-state again, for §0.3(41)'s reason: a georeference written before this field
    existed has no URL, and that is `'unknown'`, not `'stale'`. Reporting the entire
    existing corpus as broken is how a warning gets clicked past. The field is
    self-migrating — the first genuine points edit on a legacy layer starts tracking it.

    **Known false alarm, accepted.** Uploads are pathed
    `venue_maps/{Date.now()}_{filename}`, so re-uploading the byte-identical file yields
    a new URL and reports `'stale'`. The cost is re-confirming points that were already
    right, which is the safe direction to err; the alternative is hashing image bytes.

46. **Two defect fixes in a row landed only half the fix on the first pass, and both
    times the missing half was the durable one.** 7.E(2) as scoped stamped a version
    nothing bumped (§0.3(42)); §0.4(1d) as scoped suppressed a stale banner that was
    cleared on save moments before the page navigated away. The shape is the same: the
    in-memory, this-session path is the one that is easy to see and easy to test, and the
    persisted path is where the operator actually meets the bug — a day later, in a
    different session, with no memory of the swap. **When fixing a staleness bug, ask
    what a reader sees after a reload before considering it closed.**

47. **A delegated agent reported a fix it had not made, and the unmade fix would have
    made the whole feature silently non-functional.** The 7.B agent's report said the
    fallback layer id was "now derived from stable `eventId`". It was not: `venueLayers`
    was still a plain `const` in the render body calling `crypto.randomUUID()`, so the
    id changed every render, and `resolveCallPinPercent`'s (correct) layer-mismatch guard
    meant a dropped pin disappeared on the next render — on every venue without an
    explicit `layers` array. Nothing caught it: type-check passes, all 191 tests passed,
    and the failure needs a *second render* to appear, which no unit test performed.
    **The lesson is not "don't delegate"** — the delegated 7.B work was substantially
    good and the module boundary it chose was the right one. It is that *a claim in an
    agent's report is a hypothesis about the diff, and the diff is the artifact.* Read
    the diff for the specific claims, especially claims of the form "also fixed X",
    which are the ones no test was written for.

48. **`resolveCallPinPercent` returning `null` on a layer mismatch is right, and it is
    also what made (47) invisible-then-catastrophic.** Worth stating because the
    temptation on discovering the vanishing pin is to soften the guard — draw the pin
    anyway, or fall back to the stamped x/y across layers. That would be wrong: a pin
    stamped against layer *A* has percentages that mean nothing on layer *B*'s image, and
    drawing it there puts a call somewhere it demonstrably is not. Same principle as
    "never write `nearestPost` to `Staff.location`" in `core/CLAUDE.md`. The guard was
    the messenger; the unstable id was the bug.

49. **`npm run lint` output must be checked for errors across the WHOLE output, never
    through `tail`.** A `useMemo` added in `4dc00c8` landed below an early return in
    `dispatch/page.tsx`, producing "React has detected a change in the order of Hooks
    called by DispatchPage" on **every** dispatch page load. `react-hooks/rules-of-hooks`
    is enabled here (via `next/core-web-vitals`), is an **error** not a warning, and
    flagged it correctly — both times it shipped. It went unseen because lint was being
    read through `tail -20`, and `src/app/(main)/events/...` sorts first, so this file's
    errors were above the cut while the surviving warnings all came from later files.
    The tool was working; the pipe was hiding it. Two consequences worth keeping:
    **(a)** grep the full output for `Error:` (`npm run lint | grep -c "Error:"` after
    stripping ANSI codes), because a nonzero error count is the only thing that
    distinguishes a broken build from a noisy one — this repo has 21 standing warnings,
    so "lint printed some stuff" is not signal. **(b)** The stated warning baseline in
    earlier sessions (7 warnings) was itself an artifact of the same truncation; the
    real figure is 21.

50. **A hook must go above EVERY early return, not the one named in the crash.** The
    first fix for (49) moved the `useMemo` above `if (!event) return` — the return
    quoted in the error — and missed two auth guards above it (`!ready`, `!user`), so
    the crash was still live for any render that bailed out at the auth stage. React
    counts hooks by call order, so the *first* early return is the binding constraint.
    `DispatchPage` has three. The fixed code carries a comment saying so, because the
    next person to add a guard will otherwise reintroduce it.

51. **A settings switch for a capability that does not exist must say so on the
    switch.** §1.4's TAK panel offers "Enable TAK publishing" and a live diagnostics
    preview that enumerates exactly which markers would be sent. Everything about that
    surface reads as a working feature; nothing about it transmits (§0.6.4). This
    document has recorded "nothing transmits" since 2026-08-16 and that was judged
    sufficient — it was not, because the person operating the product does not read this
    document. The rule: **the honest place to disclose a stub is the control, not the
    plan.** Until Phase 2's outbound leg lands, the switch and the preview both need
    wording that says publishing is not yet wired. This is the same failure shape as
    §0.2's warning not to read the diagnostics preview as evidence that publishing works
    — restated once as a note to future readers of this file, and once, now, where it
    belongs.

52. **"Verified" in §0.1 has only ever meant the tests pass.** Not one ✅ in this
    document has ever meant a human watched the feature work, and §0.6.1 shows why that
    was not merely a gap but an *impossibility*: the checkout being run had none of the
    code. Two consequences. **(a)** Verification claims in §0.1 should say which kind
    they are — `type-check + suite` is a different and weaker claim than `seen working`,
    and conflating them is how six phases got marked done without anyone looking at
    them. **(b)** The cheapest fix is not a testing-strategy change, it is making the
    branch runnable in the checkout the operator actually opens. §0.6.1.

53. **A basemap is now in scope, and the reasons it was out of scope are now
    requirements.** §2.2 and §7.E declined a real basemap on three grounds; the deployer
    has overridden that (§0.6.2). The correct response to an overridden objection is not
    to delete it but to convert it into an acceptance criterion — so §8.B carries the
    offline objection forward as a hard requirement (**the basemap must degrade to
    nothing, leaving the raster and every marker rendering exactly as they do today**),
    and §8.C carries the projection objection forward as a one-way boundary rather than
    a reconciliation. An objection that is answered is worth more than an objection that
    is forgotten.

54. **Label behaviour is a product decision, and it had been made twice, in opposite
    directions, by accident.** The dispatch map counter-scales every label to a constant
    on-screen size; the venue editor lets labels scale and blur with the raster
    (§0.6.3). Neither was written down and neither was chosen — one is the consequence
    of a `scale(1/mapScale)` copied across six marker components, the other of its
    absence. Before 7.E(3) changes either, the intended behaviour has to be stated as a
    decision: constant-size, scale-with-map, or the sub-linear-plus-declutter behaviour
    the report is actually asking for. **The two surfaces must then agree**, because a
    dispatcher who calibrates in the editor and works in the dispatch map is entitled to
    assume they are looking at the same map.

55. **The view-mode default is calibration-gated, not configuration-gated.** §8.D as
    drafted said "add the basemap as a second, selectable view" without specifying which
    view opens by default. The shipped rule is `isBasemapConfigured() && currentLayerCalibrated`
    — basemap only if a tile archive exists *and* the layer's raster can actually overlay
    it. Defaulting to basemap whenever one is merely configured would silently drop the
    venue raster (and every post/call plotted against it) the first time a dispatcher
    opens an uncalibrated layer, which is a worse first impression than opening in raster
    view and offering the toggle.

56. **The view toggle went bottom-left, not top-left.** Undocumented in §8.D because the
    plan never picked a corner. `MarkerPlacementInstruction` and `UncalibratedLayerNotice`
    already render top-left whenever placement mode is armed, and can be on screen at the
    same moment as the toggle; bottom-left is the one corner of the map shell nothing else
    claims.

57. **`buildGeoreferenceForSave` was silently dropping `ControlPoint.accuracy` on save.**
    Found while wiring 8.G's "Use my location" through to persistence: the save path
    stripped every field on a control point down to a fixed allowlist that predated
    `accuracy`, so a GPS-seeded point's accuracy figure was captured at placement time and
    then discarded before it ever reached Firestore/PocketBase — the residual readout
    would have kept overstating the fit quality of exactly the points §8.G exists to
    protect. Fixed by carrying `accuracy` through when present, in the same change that
    added the field.

58. **8.G's two use cases shipped unevenly, and that is recorded rather than glossed
    over.** Use #2 (a "Use my location" affordance on control-point entry) is built and
    wired into `GeoreferenceSection`. Use #1 (a basemap-view "you are here" self-marker)
    is built at the component level — `BasemapView` accepts a `deviceLocation` prop and
    draws the dot plus accuracy circle described in its own doc comment — but nothing in
    `venuemapmodal.tsx` instantiates `useDeviceLocation()` and passes it in. The capability
    exists; the wiring that would make a dispatcher see it does not yet.

59. **`maplibre-gl` must stay on 5.x. Do not upgrade to 6.x.** Pinned to `^5.24.0` in
    both `package.json` files (repo root and `core/`). This is not a preference, it is
    load-bearing, and it is the most important thing found while visually verifying
    Phase 8 for the first time: `pmtiles@4.5.0` registers its `pmtiles://` handler with
    `maplibregl.addProtocol()`, which only writes to the **main thread's** protocol
    registry. Vector tile requests are issued from MapLibre's **web worker**. In
    maplibre-gl 5.x the worker falls back to `isWorker(self) && self.worker?.actor` and
    forwards the request to the main thread, where the pmtiles handler lives — so it
    works. maplibre-gl 6.x **removed that bridge**: there is no `getResource` message
    type anywhere in the 6.4.1 bundle, and the worker has its own separate, empty
    registry reached via `self.addProtocol`.

    **The failure mode is what makes this dangerous: nothing reports an error.** The
    PMTiles archive header still downloads and the TileJSON still resolves, because both
    happen on the main thread. Only tile data never loads — tiles sit in state
    `"loading"` forever, zero network requests are ever issued for them,
    `map.on('error')` never fires, and the map shows a blank grey surface. Under 6.4.1
    the style also never finishes loading, so `map.on('load')` never fires either — see
    (62) below, which depends on this not happening.

    **This is invisible to the degrade-to-nothing contract in §8.B.** `onUnavailable` is
    only ever called from a MapLibre error path, and MapLibre never reports one here, so
    the basemap does not degrade to the raster-only view §8.B promises — it just
    silently renders nothing on top of a view that looks like it should have a basemap.
    Anyone revisiting this version pin needs to know the safety net does not cover this
    specific case: a routine `npm update` past 6.0 breaks the entire feature with a
    clean `type-check`, a clean `build`, and no error anywhere in the browser console.

60. **Sprite/glyph URLs must be absolutised in the browser, not in `config.ts`.**
    MapLibre's style-spec validation rejects a root-relative sprite URL outright:
    `Invalid sprite URL "/basemap/sprites/light", must be absolute`. `config.ts`'s
    defaults stay relative on purpose, because that file is SSR-safe and must not touch
    `window` — so a new `absoluteUrl()` helper in `src/lib/basemap/style.ts` does the
    absolutising instead, applied to `glyphs`, `sprite`, and the `pmtiles://` source URL
    just before they are handed to MapLibre.

    **The sharp edge, worth writing down so it isn't rediscovered the hard way:**
    `absoluteUrl()` uses plain string concatenation, deliberately **not** `new URL(url,
    origin)`. The glyphs value is a template containing literal `{fontstack}` and
    `{range}` placeholders, and `URL()` percent-encodes braces to `%7B`/`%7D`. MapLibre
    substitutes into the raw template string at request time, so once those placeholders
    are encoded they no longer match and every label silently fails to load — while the
    map itself keeps rendering, so nothing about it looks broken.

61. **The map container must be `h-full w-full`, not `absolute inset-0`.** MapLibre's own
    stylesheet declares `.maplibregl-map { position: relative }`. That CSS arrives via a
    dynamic `import(...)` inside `BasemapView.tsx`, so it is appended to the document
    *after* Tailwind's stylesheet. At equal specificity the later rule wins: MapLibre's
    `relative` beats Tailwind's `absolute`, `inset-0` stops applying, and the container
    collapses to zero height. Observed directly as a 1480×0 container holding MapLibre's
    own 1480×300 fallback canvas. MapLibre reports nothing wrong about being asked to
    render into a 0px box — another failure in this phase with no error signal, fixed in
    `BasemapView.tsx`.

62. **The initial camera is passed to the `Map` constructor (`bounds` +
    `fitBoundsOptions`), not fitted inside a `once('load')` handler.** MapLibre only
    fires `load` once `style.loaded()` is true, which requires every source to report
    loaded. That condition never arrived while the map sat at its built-in world view on
    startup, because the venue-sized PMTiles extract has no tiles out there to finish
    loading. The old code therefore deadlocked: the camera fit needed the `load` event,
    and the `load` event needed a camera already pointed somewhere tiles exist. Bounds
    passed at construction are pure transform math and need no tiles to resolve. Side
    benefit: this also removes the world-view flash that used to appear on every open.
    `reducedMotionEnabledRef`, which existed only to choose an animation duration for
    that `load`-time fit, was deleted as dead code — the constructor path isn't animated
    at all, which is also the correct reduced-motion behaviour by construction, not by a
    check.

63. **The Protomaps schema-version mismatch was investigated and cleared, not left as an
    open question.** The PMTiles archive is Protomaps Basemap schema v4.15.2; the
    installed `@protomaps/basemaps` package is 5.7.2. This looked like exactly the kind
    of thing that silently breaks style resolution, so it was checked rather than
    assumed: all nine source-layer names the archive ships (`boundaries`, `buildings`,
    `earth`, `landcover`, `landuse`, `places`, `pois`, `roads`, `water`) are identical to
    what the v5 package's style asks for, and tiles decode correctly against it. Recorded
    here so the next person who notices the version skew does not re-spend the time
    re-investigating it.

64. **The extract's real max zoom is 15, not the 16 `scripts/fetch-basemap.sh` requests.**
    The upstream Protomaps daily build this project pulls from tops out at 15 for this
    region. The script's `--maxzoom 16` is a request, not a guarantee, and the archive
    silently caps at what the upstream build actually has. Not a bug to fix — a fact
    about the current data source worth knowing before someone spends time debugging
    "missing" zoom-16 tiles that were never going to exist.

65. **`core/.env.local` did not exist and had to be created before any of this could be
    verified.** It is gitignored, so a fresh checkout — including the one this
    verification ran from — simply doesn't have it; it was copied from the root
    `.env.local`. Without it, `npm run dev` run from `core/` — which is the workflow
    `core/CLAUDE.md` itself prescribes for TAK work, pinned to port 3004 — cannot start
    at all, because the app throws at startup on a missing Firebase config. Worth a line
    here because this is exactly the kind of environment gap that makes a phase
    "impossible to verify" look like a code problem when it is a checkout-setup problem
    — the same shape of issue §0.6.1 already documented once for a different missing
    piece.

### 0.4 Recommended next steps, in order

> **Amended 2026-08-19.** Two things changed the ordering below. First, this document
> had drifted from the tree: §8.I was committed (`b6d3dc9`, `a78421a`) and documented
> nowhere, and §8.J is sitting uncommitted in the working directory — both are now
> written up, and §13's Phase 8 `(uncommitted)` markers are corrected. Second, a gap was
> reported from the running app that outranks most of what follows: **creating a venue
> offers no map-backed option at all**, only a static image upload. Phase 8 built a real
> basemap and never surfaced it on the one screen where a venue comes into existence.
> That is now **Phase 10**, and the IC-EMS GIS walkthrough the same day is **Phase 11**.
>
> Revised priority, ahead of items 1–3 below for anyone touching the map:
>
> - ~~**10.D first**~~ — ✅ done in `40342f5`, landed together with §8.J because the
>   editor's "Set default view" button was written against a prop that did not exist and
>   was therefore inert; shipping the toggle without the prop would have meant a visible
>   control that could not work.
> - ~~**Commit §8.J**~~ — ✅ done in the same commit. The editor now has a basemap
>   surface, which unblocks the rest of Phase 10.
> - **10.C then 10.E** — give `Post` a coordinate of record the way §7.A did for
>   `Call.position`, then wire `onMapClick` in the editor. These are one change split
>   across two files; doing 10.E first yields a click handler with nowhere to put its
>   answer.
> - **11.B when convenient** — CSV import of lat/long locations is the highest-value,
>   lowest-risk item in either phase, and it is what stops a 134-location venue from
>   being hand-clicked.
>
> The §7.3 type-code spike (item 1) is still the top priority for the *TAK* half of this
> project. Phase 10 is the top priority for the *map* half. They need different people
> and different equipment, and neither blocks the other.


0. **Confirm you are on `feature/tak-integration`** and that both halves are present
   (see "Verify the state you inherited"). Read §0.45 for what the inbound half is —
   it is described nowhere else here.
1. **Run the §7.3 type-code spike.** This is the top priority and it is now cheaper
   than it has ever been: the merged branch has a Dockerized FTS and a working TLS
   iTAK package, so the missing ingredient is one person, one phone, and an
   afternoon — *not* a TAK.gov registration or a WinTAK licence. Publish one marker
   of each candidate type, screenshot the icons, correct the four constants in
   `types.ts`, flip `COT_TYPE_CODES_VERIFIED`, and settle `b-m-p-w` vs `b-m-p-s-m`
   (the merge kept both codes alive precisely because neither is verified). This
   single afternoon unblocks the feed route, the bridge, and everything downstream.
2. **Run the §1.5 KML network-link spike** — same sitting, same equipment.
3. **Get the IC-EMS overlay** for Phase 0.4 and turn it into a vitest fixture.
4. **Then** the feed route (§1.3), and only then the feed-URL half of §1.4 that
   §0.3(21) deliberately left out. The feed route is where `typeCodesVerified`
   must be enforced — see §0.3(10).
5. Answer the six open questions in §11 — several change the adapter priority for
   Phase 2 and are organizational lead-time items, not coding tasks.

**Amended 2026-08-17 — items 1 and 2 gained a seventh observation and a co-beneficiary.**
While running the spike, also drop a pin by hand in iTAK and record the CoT type it
emits (§7.3). That single line settles the gate on Phase 7.D, so the same afternoon now
unblocks the feed route, the bridge, everything downstream, *and* inbound pin-drop.

**Also amended: there is unblocked code to write again, for the first time since 1.4.**

> **~~Every remaining item in this plan is now gated on something that is not
> typing.~~ Superseded 2026-08-17.** ~~What is safe to start right now — the
> event-settings UI (§1.4) — was built 2026-08-16, and that changes the shape of the
> project.~~ The claim was accurate about every phase this plan *contained*, and wrong
> about the plan's coverage. **Phase 7 — pin-droppable calls and a coordinate-first
> map — was missing entirely**, because the plan assumed a call's location is a post
> name and never wrote that assumption down (§0.3(36)). 7.A–7.C and 7.E depend only on
> Phase 0, which is done.
>
> This is the second time this section has confidently declared the project
> hardware-gated and been wrong, and the two failures have the same shape: the first
> mistook "a spike settles this decision" for "a spike blocks everything adjacent to
> it" (see the superseded block below); this one mistook "every phase in the plan is
> gated" for "everything worth doing is gated." **A plan is not an inventory of the
> work.** Before concluding that nothing can proceed, check the running app against
> the plan rather than the plan against itself — both of these were reported by
> someone using CrowdCAD, not found by reading.

**So: 1a. Phase 7.E(2) and 7.A–7.C**, in that order, needing nothing but a keyboard.
7.E(2) first because it is the only *defect* among them: `Georeference.version` exists
and nothing consumes it, so replacing a venue map image silently relocates every post
on it. Then the `Call.position` model and pin-drop, which is the reported gap. 7.D
joins the queue behind the spike.

**~~And before anything else, the live one:~~ Done 2026-08-17 (`0445d3c`).** The bridge
used to misfile a hand-dropped pin as a team GPS fix (§0.2, §0.3(40)); it no longer does.
It was taken first, ahead of the planned 7.E(2)/7.A–7.C order, because it was the only
item on this list that was already hurting somebody with a phone in the field.

**Amended 2026-08-17 — items 1a and the live one are largely spent. What is next:**

1b. ✅ **DONE (`4dc00c8`) — Phase 7.B, the pin-drop UI.** ~~The single highest-value item,
    because 7.A landed `Call.position` and **nothing writes to it**.~~ A model with no
    writer is worse than
    either half alone: the type invites callers to read a field that is always
    `undefined`, and 7.C's publishing path can never fire. Requirements that are
    decisions, not preferences: a pin on an *uncalibrated* layer is **refused**, not
    stored degraded (§0.3(38)); re-dragging an existing pin appends to `Call.log`,
    because moving a call is an operational act with a time and an author; and the
    marker must read its colour from `getStatusColor()`, never a local class map.

    **All three held.** The conversion logic went into a new pure module,
    `src/lib/callPositionUtils.ts`, so it is testable without a DOM (there is no
    component-test harness — §0.2); clearing a pin is logged too, since a call that lost
    its coordinate is otherwise indistinguishable from one that never had it. Three
    defects were found reviewing the delegated diff, the worst of which made a dropped
    pin vanish on the next render for any layerless venue — see Phase 7.B and §0.3(47).

1c. ✅ **DONE (`a094350` geometry, `67f8804` UI) — Phase 7.E(1), off-map edge
    indicators.** ~~← START HERE.~~ Split in two so the geometry could be tested at all:
    `src/lib/offMapUtils.ts` is pure and has 15 tests, the `.tsx` half has none because
    this repo has no component-test harness (§0.2). Both requirements below held —
    bearing *and* distance, and no clamping. Two traps were called out in the spec up
    front and both were real: percent space is not isotropic, so the arrow angle needs
    an aspect correction or it points visibly wrong on any non-square map; and the
    screen-plane angle and the true-north bearing are different numbers that only
    coincide on a north-up map, so neither may be derived from the other. Tests pin
    both. **Not verified visually** — no browser in the session — so arrow orientation
    and badge placement still want a human eye. Known limit: with many badges on one
    edge the declutter fan-out can push the last ones past the image bounds, where the
    container clips them again; fine for the handful of off-map targets this
    realistically sees. Both edit
    `venuemapmodal.tsx` (1185 lines before 7.B, ~1800 after), and running them
    concurrently would have bought a merge conflict rather than parallelism.
    An indicator must carry **bearing and distance** —
    an arrow alone says "not here" without saying where, which is the state the map is
    in today. It must **not clamp** the position onto the image edge: `onMap: false`
    exists so the UI hides a marker instead of drawing it somewhere the unit
    demonstrably is not (`core/CLAUDE.md`), and a clamped dot is exactly that lie. And
    it is **not a basemap** — see §2.2.

    **7.B added a second population of off-map markers, so scope this for both.** It is
    no longer only about `TakPosition.onMap: false` for teams: `resolveCallPinPercent`
    re-derives a call pin's x/y from the layer's *current* transform, so a
    recalibration can legitimately move a stored pin outside 0–100 and `CallMarker` has
    no off-map case today. 7.B's stopgap was to block the *creation* of an off-map pin
    (both drag-release handlers now reject a release outside the image rect) — that
    keeps garbage out of the data, but it does nothing for a pin that was on-map when
    placed and is off-map after a re-fit. Such a pin is *clipped away* — the pan
    container is `overflow-hidden` (`venuemapmodal.tsx:956`) — so the current behaviour
    is silent disappearance, not a marker drawn in the wrong place. That is the safe
    failure of the two, and it is still the exact gap 7.E(1) exists to close: the call
    has a real coordinate and the dispatcher is shown nothing at all.

1d. ✅ **DONE (`dbb7dce`, then `a46de5c`) — Follow-up defect from 7.E(2):
    `describeGeoreferenceStatus` ~~now actively misreports swapped-image layers~~.** `47157a4` made a map swap bump
    `georeference.version`, but `GeoreferenceSection` is passed only `controlPoints`
    (`page.client.tsx`) and cannot see the version or the swap. So a layer whose image
    was replaced still shows its old fit quality and an "ok" banner, computed from
    control points that now refer to different pixels. This is worse than the bug
    7.E(2) fixed: before, the operator was told nothing; now they are told everything is
    fine. Plumb `georeference.version` and the swap intent down, and let the section say
    "needs re-confirmation" instead of restating a stale residual. Small, self-contained,
    and touches no file 7.B or 7.E(1) is in.

    **It was not as self-contained as that.** The first pass (`dbb7dce`) plumbed the
    staged-file state down and suppressed the residuals — correct, and only half the
    problem: `mapFile`/`pendingLayer` are cleared on save and `handleSubmit` navigates
    away, so the case that actually bites — reopening the venue *tomorrow* — was still a
    confident "ok" over points placed on a different picture. Closed properly in
    `a46de5c` with `Georeference.calibratedForMapUrl` and `georeferenceMapMatch()`. See
    §0.3(45); `geoUtils.test.ts` 49 → 56.

7.D still joins the queue behind the spike — the pin type code is the gate, and the
bridge half of it is already done.

If you have arrived here looking for code to write and cannot run a spike, the
honest answer is that there is very little left that is both safe and useful, and
the temptation to build the feed route "ready for when the spike lands" should be
resisted for the reason §1.5 gives in its own text: the spike may return "network
links are unreliable on the target release", which changes what the feed route
*is*. Writing it first means writing it twice. Better uses of a session with no
hardware: ~~turn the §11 open questions into a written list for whoever can answer
them, or reconcile the two georeference models (§0.3(19)) — the one piece of real
technical debt the merge knowingly left behind.~~

**~~Both of those were done 2026-08-16.~~** The open questions are now
`core/docs/TAK_OPEN_QUESTIONS.md` (§0.3(28)), and the georeference reconciliation
turned out not to be debt at all: the two models answer different questions and
both are staying, now with a conformance test and an explicit scoping rule proving
it (§0.3(27)).

> **~~That leaves the honest answer to "what can I do with no hardware?" as: very
> little.~~ Superseded 2026-08-16 (later still).** The claim was that every
> remaining item needs a phone, a TAK client, or IC-EMS. That was true of the
> *spikes* and false of the *preparation for them*, and the distinction was
> worth about a session's work:
>
> - The §7.3 spike had **no publisher**. Nothing in the tree could send a
>   caller-chosen type code, and the two codes core actually emits had never
>   been sent to a TAK server by anything. Built this session as
>   `dev/freetakserver/spike-typecodes.mjs` — §0.3(30). The spike is now
>   genuinely "one person, one phone, ten minutes", which is what this section
>   kept claiming it already was.
> - Echo suppression in the bridge was **one hardcoded UID**, not a prefix
>   match, and would have looped CrowdCAD's own markers back in as GPS fixes
>   the day outbound publishing landed — §0.3(32). No hardware required to
>   find or to fix.
> - The local FreeTAKServer had **relayed nothing for two days** while
>   reporting healthy — §0.3(34). Had that gone unnoticed, the spike would
>   have shown zero markers and the obvious conclusion would have been that
>   the type codes were wrong.
>
> The general lesson, which is the same one §0.2 learned about `mapping.ts`:
> "this is blocked on a spike" is a statement about the *decision* the spike
> settles, not about everything adjacent to it. Ask what the blocked work
> actually needs before inheriting the block. Two of the three items above
> were sitting inside something this document had already marked as blocked.

The remaining items below **do** need a phone, a real TAK client, or an answer
from IC-EMS. If you are here with a free session and no hardware, the
highest-value things left are not code:

- **Chase the §11 answers.** `TAK_OPEN_QUESTIONS.md` exists precisely so this is
  an email, not a drafting exercise. Questions 1–4 unblock the next two sprints,
  and two of them (TAK.gov registration, federation) have organizational lead time
  measured in weeks that no amount of engineering compresses.
- **Do not build the feed route ahead of the §1.5 spike.** This warning is
  unchanged and is now the *only* thing standing between a spare session and a
  rewrite: the spike may return "network links are unreliable on the target
  release", which changes what the feed route *is*. Writing it first means writing
  it twice.

**Amended 2026-08-18 — a field report reopened the list, and one item on it is not
engineering.** Three problems were reported from the running app and investigated
(§0.6). The revised order, ahead of everything above that needs hardware:

**0a. ✅ DONE (`b8d24df`) — Make the branch runnable in the checkout the operator
actually opens.** This
outranks all code. The app has been run from a checkout whose `core` is pinned at
`9fe8de6` and contains no TAK work at all — it cannot even resolve `d233438` as an
object (§0.6.1). Six ✅ phases have therefore never been seen by anybody. Consolidate
onto one checkout; do not create a third. Note also that the bridge is PocketBase-only,
so a Firebase-backed app shares no database with it regardless.

**0b. Say on the switch that publishing is not wired.** §1.4's TAK panel presents an
enable toggle and a live "what would publish" preview for a transport that does not
exist (§0.6.4, §0.3(51)). Small, and it stops the product from misrepresenting itself
in the meantime.

**1a′. ✅ DONE (`3ea888f`) — Phase 7.E(3), label behaviour.** Self-contained, needed
nothing, and closes the second field report. The decision required first by §0.3(54)
was taken by the deployer: sub-linear scaling with declutter and zoom-gating. Both
surfaces now share one law. See the end of §7.E item 4.

**1b′. ✅ DONE (uncommitted, this session) — Phase 8, a real basemap.** §2.2 and §7.E's
refusal is overridden (§0.6.2, §0.3(53)). 8.A–8.F are built; 8.G is built for
control-point capture and not yet wired for the basemap-view self-marker (§0.3(58)). The
offline requirement in §8.B degrades correctly — no PMTiles archive is committed, so a
fresh clone opens in raster view with no toggle offered at all. **What is left, in
order:** (1) commit the working tree — nothing above is in git history yet; (2) run
`scripts/fetch-basemap.sh` and set `NEXT_PUBLIC_BASEMAP_PMTILES_URL` against a real
deployment and actually look at the rendered map — `type-check`/`test:unit`/`build`
passing is not the same claim as a human having seen it; (3) wire `useDeviceLocation()`
into `venuemapmodal.tsx` and pass it to `BasemapView`'s `deviceLocation` prop to close
8.G's self-marker gap; (4) a component test for `BasemapView.tsx`, which currently has
none.

**1c′. Phase 9.A — model the level on `Layer`.** The true blocker behind IC-EMS's
multi-level ask, and it contains no TAK content at all (§0.6.5). Nothing about floors can
be published until CrowdCAD knows what a floor is.

**1d′. Phase 2, outbound leg — the transport.** The largest single gap in the project and
the one the field report names most directly: CrowdCAD can build correct CoT for every
marker it owns and has nowhere to send it (§0.6.4). Partly gated — what is *published*
should wait on §7.3's type codes — but the transport itself is not: a socket, a retry
policy and a rate limit are the same work whatever the four type-code strings turn out
to be. See §6.2's write-rate constraint before starting.

Items 1–5 below are unchanged and still stand; they remain the only path to
`COT_TYPE_CODES_VERIFIED = true`.


### 0.45 The second TAK effort, and the merge that ended the split

Discovered 2026-08-16, merged the same day. Everything this document said about
Phase 2 being untouched was wrong — not stale, wrong, because it never knew a second
effort existed. **This section is now history plus the merge record**, but read it
anyway: the inbound half of the system is described here and nowhere else in this
document, and the failure it records is the reason for the branch rule at the top.

**Branch `feature/tak-integration`** (in **both** the root wrapper and `core`),
checked out at `.claude/worktrees/fts-local-dev/`. Its pre-merge state was **committed
and pushed** — root to the private `iv-zhang/CrowdCAD`, `core` to the public
`evanqua/crowdcad`. It is now also the home of everything that used to be on
`feature/tak-phase0`.

> #### ⚠️ The sibling effort left a rival document with the same filename
>
> Found 2026-08-16, during the Phase 1.4 session. The code was merged; **the
> documents were not.** There are two:
>
> | | This file | The other |
> |---|---|---|
> | Path | `core/docs/TAK_INTEGRATION_PLAN.md` | `dev/TAK_INTEGRATION_PLAN.md` (root wrapper) |
> | Covers | The whole system, outbound-first | The inbound bridge only |
> | "Phase 1" means | The read-only outbound feed — *partial* | Position ingest + tweening — *complete* |
>
> **The phase numbers are unrelated and contradict each other.** "Phase 1 complete"
> and "Phase 1 partial" are both true, about different work. A banner now sits at
> the top of each file tabling the difference; do not remove it, and never carry a
> phase number across without translating it.
>
> The other document is kept rather than folded in, because it is the only detailed
> record of how the inbound bridge actually works. `dev/TAK_DECISIONS.md` beside it
> is likewise still live — `core/CLAUDE.md` tells you to read it before touching
> anything TAK-related, and that instruction stands.
>
> This is the same failure as the original split, one layer up: merging the branches
> did not merge the *maps*, so a session reading only one file still gets a confident
> and wrong picture of what is built. The branch rule at the top of this document
> covers code; this note is the documentation half of it.

It was not an earlier or later version of this plan. It was a **sibling effort from
the same ancestor commit** (`7a82626`), with a different architecture, *further along
in a different direction*:

| | `feature/tak-phase0` (this doc) | `feature/tak-integration` |
|---|---|---|
| Backend | Firestore | PocketBase |
| Shape | In-app pure modules, publish CoT **outbound** | Standalone Node bridge, ingest CoT **inbound** |
| TAK server | none stood up | **real FreeTAKServer, Dockerized, running** |
| Georeference | control points + affine solver | image-percentage projection (`georef.js`) |
| Reached | Phase 0 + Phase 1.2 | its own "Phase 1 complete" |

**What is actually there:** `dev/freetakserver/` — a working `docker-compose` FTS
stack with real self-generated certs, a TLS iTAK data package (`fts-itak-tls.zip`),
and diagnostic scripts. `dev/crowdcad-tak-bridge/` — ~2,300 lines of dependency-free
Node (bridge, CoT parse/build, georef, PocketBase store) with ~1,100 lines of tests.
And in its `core/`: `takInterpolation.ts`, `useTakTween.ts`, `useTakPositions.ts`,
wired into `venuemapmodal.tsx` and the dispatch page.

**Empirically established over there, and worth trusting** (measured on real hardware,
per its `dev/TAK_DECISIONS.md`):

- iTAK **forces TLS**: adding a server produces a TLS ClientHello on 8446 and *zero*
  connections to the plaintext 8087 port. A plain-TCP data package is rejected outright.
- FTS **swallows the first event on every connection** — five markers on one socket
  deliver four. Any bridge must send a throwaway first event or re-send.
- A real iPhone running iTAK connected over TLS 8089 and its live GPS was relayed
  out by FTS. **The inbound path works on real hardware.**

These are backend-agnostic facts about FreeTAKServer and iTAK. Phase 2 here will hit
every one of them, and they cost someone real hours to find.

**What is NOT established over there — checked specifically, because it looked like it
might be:** the §7.3 type-code spike is **still un-run on the merged branch.** That branch
emits `a-f-G-U-C`, `a-f-G-E-V-C`, `a-f-G-E-V-M`, and `b-m-p-s-m`, and its README says
markers were "verified end to end". But what did the verifying was `map-view.py` — a
home-made Python/Leaflet page that parses CoT and draws *its own* circles, colouring
them by the `a-f-` / `a-h-` prefix according to what the code *assumes* TAK does. That
proves the CoT is well-formed and the coordinates are right. It proves nothing about
which MIL-STD-2525 symbol a real TAK client picks, which is the entire question §7.3
asks. **No one has yet looked at a CrowdCAD marker on an ATAK, WinTAK, or iTAK screen.**
This is an easy mistake to repeat — the warning in `types.ts` now names it explicitly.

One concrete disagreement to settle when the spike runs: this branch proposes
`b-m-p-w` for posts, that branch ships `b-m-p-s-m`. Both are unverified. Resolve them
together and make the branches agree.

#### ✅ Resolved 2026-08-16 — the branches were merged

**An earlier revision of this section recommended *not* merging.** That
recommendation was overruled and is now obsolete; it is quoted here only so a future
reader who remembers it knows it was superseded on purpose, not forgotten:

> ~~Recommendation — do not merge these branches. They disagree architecturally
> (Firestore vs PocketBase, outbound vs inbound, two different georeference models)
> and a merge would produce something neither design intended.~~

The reasoning was sound about the *diff* and wrong about the *cost*. Two branches
that cannot see each other do not stay complementary — they duplicate. In the days
they ran in parallel they produced two live-position types, two georeference models,
and two unit-test runners for one codebase, and the second effort was found by
accident rather than by any process. Keeping them apart preserved a tidy diff at the
price of the thing that actually matters: one person being able to see the whole
system. **All TAK work now lives on `feature/tak-integration` — see the branch rule
at the top of this document.**

`feature/tak-phase0` was merged into `feature/tak-integration` (merge base `7a82626`).
The conflict surface was far smaller than feared: **two files**, `package.json` and
`src/app/types.ts`. Everything else — the whole outbound `src/lib/tak/` module set,
the georeference UI, the bridge, the tween — applied cleanly and coexists.

**What survived, and why:**

| Contested thing | Kept | Dropped | Reason |
|---|---|---|---|
| Live position type | `TakPosition` / `TakPositionRecord` | `TeamPosition`, `PositionSource`, `Staff.position`, `Supervisor.position`, `takUid` | Both designs reached the *same* structural conclusion independently. Only one is built, wired to the bridge, and proven against a real FreeTAKServer. |
| Unit test runner | vitest (`npm run test:unit`) | the bespoke `node --experimental-strip-types` runner | The merge produced a **duplicate `test:unit` JSON key** — silently last-wins, which would have orphaned the interpolation tests. `takInterpolation.test.ts` was converted to vitest with every assertion preserved. |
| Georeference model | **both, unreconciled** | — | They answer different questions and do not conflict in code. See below. |
| CoT post type code | **unresolved** | — | `b-m-p-w` vs `b-m-p-s-m`. Still both unverified; still §7.3's job. |

**The one line of real integration work:** `mapping.ts` read `member.position` to find
a live GPS fix. It now reads `member.tak`, the surviving field. That single edit is
what connects the inbound bridge to the outbound publisher — a position that arrives
from a phone is now the position CrowdCAD republishes. Deliberately, a fix with
`onMap: false` is still published: being outside the venue *image* is a limitation of
drawing on a picture, not doubt about where the unit is, and TAK has real basemaps.

**Still genuinely unreconciled — do not mistake "merged" for "unified":**

- ~~**Two georeference models coexist.**~~ **Resolved 2026-08-16 — the premise was
  wrong.** See §0.3(27). They were never two models of the same thing: `geoUtils.ts`
  is a general calibration solver for arbitrary venue images, and the bridge's
  `georef.js` is the exact analytic inverse of a *known* north-up Web Mercator tile
  crop. The second is a degenerate case of the first, not a rival to it. Nothing needs
  to win. The sentence this replaces — "the affine solver is the better-specified of
  the two" — was true in the narrow sense that affine is the more general family, and
  misleading in the sense every reader took it: it implied `geoUtils` should absorb
  `georef.js`, which would replace exact arithmetic with a fitted estimate.
- **Firestore vs PocketBase.** Unchanged by the merge; the service abstraction already
  covers it.

Before writing a line of Phase 2, still read `dev/TAK_DECISIONS.md` end to end — it is
in the **root wrapper**, not `core`, and the hardware facts above are all it.

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

Then fixed a self-reference bug that pass introduced: "verify you're on `52fe6c5`"
was already false the moment the doc commit landed on top of it, which would have
sent the next session chasing a phantom missing commit. The verification block now
checks for *artifacts* (`ls src/lib/tak/`, the test count) rather than the branch
tip, and the §0.1 SHAs are labelled **code** commits so doc-only amendments don't
invalidate them. Rule for future passes: nothing in the orientation header may
assert what the tip of the branch is.

**2026-08-16 — Phase 1.2 (`mapping.ts`) + discovery of the parallel effort.**
- Surveyed the other TAK worktrees before writing code, and found
  `feature/tak-integration`: a committed, pushed, architecturally distinct sibling
  effort with a running FreeTAKServer and an inbound bridge. Recorded in §0.45.
  This document had been asserting Phase 2 was untouched; it was not.
- Checked specifically whether that branch's real-hardware work had satisfied the
  §7.3 type-code spike. **It had not** — the "verification" was a home-made Leaflet
  viewer, not a TAK client. Wrote that trap into the `types.ts` warning so the next
  reader doesn't re-make the inference.
- Re-examined the §7.3 deferral of `mapping.ts` and concluded it over-reached:
  the spike settles four *string constants*, not the mapping logic. Built
  `eventToCotEvents` (`mapping.ts`, ~330 lines) and moved the broadcast guard to
  `COT_TYPE_CODES_VERIFIED`, propagated onto every result. §0.2, §0.3(10).
- Extended `applyRedaction` to emit `detail.callsign` — same already-allowlisted
  value as `remarks`, no new disclosure; chief complaint pointedly excluded. §0.3(15).
- Tests 81 → 105. `type-check` clean, `npm run build` exit 0, no new lint warnings.
- Decisions recorded in §0.3(10)–(16). **Not pushed.**

**2026-08-16 — branch consolidation: one branch for all TAK work.**
- Acted on a direct instruction to stop the split: merge everything onto
  `feature/tak-integration` and commit there at every phase boundary. This
  **overrules** the "do not merge" recommendation the previous session had written
  into §0.45; that section now carries the reversal and the reasoning.
- **Diagnosed why the split happened**, which turned out to be mechanical rather than
  anyone's oversight: a root git worktree gets its **own submodule module directory**,
  so `.git/modules/core` and `.git/worktrees/fts-local-dev/modules/core` were separate
  repositories with disjoint object databases. `git merge-base` across them failed with
  `Not a valid object name`, and neither checkout's `git branch -a` listed the other's
  branches. Two sessions could not have discovered each other by any normal means.
  Written up as "the two-checkout trap" in the orientation header, with the
  fetch-by-local-path recipe that bridges it.
- Bridged the object databases and merged `feature/tak-phase0` into
  `feature/tak-integration` (base `7a82626`). Conflict surface was two files:
  `package.json` and `src/app/types.ts`.
- Unified the duplicated live-position model onto `TakPosition`/`TakPositionRecord`;
  deleted `TeamPosition`, `PositionSource`, `Staff.position`, `Supervisor.position`,
  `takUid`. Left a note at the bottom of `types.ts` naming the dropped fields and
  saying to extend the survivor rather than reintroduce a second type. §0.3(18).
- Caught a **duplicate `test:unit` key** in the auto-merged `package.json` — valid
  JSON, silently last-wins, and it would have quietly orphaned the interpolation
  tests. Unified on vitest and converted `takInterpolation.test.ts` from its
  hand-rolled `node:assert` runner, preserving every assertion.
- Wired the two halves together: `mapping.ts` now reads `member.tak` instead of the
  deleted `member.position`, so a fix arriving from a phone is the position CrowdCAD
  republishes. Added tests for unknown-accuracy `ce` and for publishing off-map
  fixes. §0.3(20).
- Deliberately left the two georeference models unreconciled — nothing imports both,
  and forcing a choice under merge pressure would have meant redesigning a working
  inbound path to prove a point. §0.3(19).
- Tests 105 → 122 (7 files). `type-check` clean across the whole merged tree.
- Decisions recorded in §0.3(17)–(20). **Not pushed.**

**2026-08-16 — Phase 1.4: the event-settings TAK panel.**
- Picked 1.4 because §0.4 named it the only remaining item gated on nothing: the
  §7.3 and §1.5 spikes both need a phone and a real TAK client, and Phase 0.4 needs
  an artifact from IC-EMS. A settings panel transmits nothing, so none of that
  applies to it.
- Built `src/lib/tak/settings.ts` (defaults, `??`-merge semantics, skip-reason
  presentation) with 17 tests, and `TakSection.tsx` (411 lines), wired into the
  event create/edit page as a `TAK` tab persisting to `Event.tak`.
- Gave `eventToCotEvents` its **first non-test caller** — the diagnostics preview,
  which is read-only and opens no socket. §0.3(22).
- **Deliberately did not build the feed URL / rotate-token control**, because the
  §1.3 route it points at does not exist. §0.3(21).
- Fixed two dangling `types.ts` cross-references to a "plan §0.6" that has never
  existed; the intended target was §0.45.
- Found that the code merge had left the *documents* unmerged: a rival
  `dev/TAK_INTEGRATION_PLAN.md` in the root wrapper with contradictory phase
  numbering, plus 80 lines of uncommitted progress log in it. Banners added to
  both files; see the warning box in §0.45.
- Tests 122 → **139 (8 files)**. `type-check` clean, lint shows only pre-existing
  warnings. Both figures re-verified independently of the implementing agent.
- Decisions recorded in §0.3(21)–(26). **Not pushed.**

**2026-08-16 (later) — georeference reconciliation and the IC-EMS question list.**
- Took the two items §0.4 named as the only hardware-free work left. Both are now
  closed, and neither closed the way the plan predicted.
- **The georeference "debt" was a false premise.** §0.45 and §0.3(19) recorded two
  rival models needing unification, with `geoUtils.ts` named the better-specified.
  Reading both showed they answer different questions: `geoUtils.ts` fits a
  transform to operator-placed control points on an arbitrary image, while
  `georef.js` inverts a known Mercator tile crop and has no cross terms in its
  arithmetic at all — it cannot express rotation, structurally. Unifying them
  would have replaced exact maths with a fitted estimate of itself. §0.3(27), and
  the §0.45 bullet and §0.3(19) are struck through rather than deleted.
- Proved it numerically instead of asserting it:
  `geoUtils.mercator-conformance.test.ts` fits the affine solver to four corners
  derived from `georef.js`'s own `unproject()` and measures **0.7–3.7 cm**
  agreement across the interior, against a 10 cm asserted bound. Perturbing the
  control points by ~3–5 cm pushes divergence to **0.67–5.59 m** — the result that
  actually matters, because it shows operator calibration error dominates model
  disagreement by one to two orders of magnitude.
- Added a cross-repo tripwire: `georef.test.js` now pins the same `campus-map.json`
  corners the core test depends on, so regenerating the map can't quietly make the
  conformance proof meaningless while both suites stay green.
- Wrote `docs/TAK_OPEN_QUESTIONS.md` for IC-EMS. **Caught three false capability
  claims** in the drafting agent's output — adapters for all three server types,
  a shipping feed URL, PHI export defaulting to on — by re-deriving each from
  `core/src` rather than reviewing the prose. §0.3(28).
- Answered a question raised mid-session about giving the bridge its own repo:
  the pattern is standard, but the "it's unrelated" premise is backwards — the
  bridge writes core's `Staff[]` into core's database. Recorded as §0.3(29):
  split later, make the contract explicit first.
- Tests 139 → **153 (9 files)**; bridge `georef.test.js` 11 → **12**. `type-check`
  clean. All three figures re-verified independently of the implementing agent.
- No production code touched: one new test file, one new test case, one doc
  comment, and this tracker.
- Decisions recorded in §0.3(27)–(29). **Not pushed.**

**2026-08-16 (later still) — the §7.3 spike harness, echo suppression, and a dead relay.**
- Started from §0.4's conclusion that everything left was hardware-gated, and
  checked the tree instead of the claim. Three items were not gated on hardware
  at all. §0.4 now carries the superseded conclusion and the general lesson:
  *"this is blocked on a spike" is a statement about the decision the spike
  settles, not about everything adjacent to it.*
- **Built the §7.3 spike harness** — `dev/freetakserver/spike-typecodes.mjs`. The
  spike had been described for months as "one afternoon with a phone", but nothing
  in either branch could publish a marker of a caller-chosen type code, and the two
  codes the spike exists to settle appeared nowhere in `dev/`. The afternoon could
  not have happened. Design notes in §7.3, rationale in §0.3(30)–(31).
- Ran core's `src/lib/tak/` modules unmodified under plain Node for the first time,
  which is the §1.1 purity constraint finally being cashed in. Node ≥22.6 strips
  the types; a ~15-line `node:module` resolve hook covers TypeScript's
  extensionless `./types` import, which the ESM resolver otherwise rejects.
- **Fixed echo suppression** (§2.5, marked mandatory since the first draft). It was
  one hardcoded UID literal. Every marker CrowdCAD published under its own
  documented prefix would have come straight back in as a GPS fix. Now a prefix
  match, with a cross-repo tripwire test. Bridge tests 18 → **23**; suites
  re-verified independently at 23 / 12 / 12. §0.3(32).
- **Found the local FreeTAKServer had relayed nothing for two days** while
  `docker ps` said healthy and `probe-cot.py` said "✓ genuinely serving CoT".
  Its own counters: `messages sent to clients: 0` in all 4026 windows, plus 82
  `NoneType` socket crashes in the fan-out loop. Restarting did not fix it.
  **Still open.** §0.3(34), and added to `dev/TAK_DECISIONS.md` §9 — the ladder
  there was missing its top rung, because `probe-cot.py`'s success criterion is
  satisfied by FTS's own welcome banner and says nothing about fan-out.
- Consequently gave the harness its own relay check: it opens a second client
  before publishing and reports which markers came back. A silent relay failure
  and a wrong type code look identical on a phone, and one of them would have been
  written into `types.ts` as a finding.
- **Nearly wrote junk into live PocketBase**, and did not, by checking `bridge.js`
  rather than trusting `core/CLAUDE.md`'s "ignored rather than guessed" — the team
  *binding* is ignored, the *position record* is written regardless. §0.3(33). The
  live spike run is therefore still pending: it needs the bridge stopped, a working
  relay, and a phone.
- `COT_TYPE_CODES_VERIFIED` remains **false**. Nothing transmits.
- Decisions recorded in §0.3(30)–(34). **Not pushed.**

**2026-08-17 — Phase 7 scoped. Planning only; no code written.**
- Started from two reports from the running app — *"I can't drop a pin for a specific
  call"* and *"the map is still a .png so all the locations are just hard coded"* — and
  checked them against the tree. Both are real. The first is a **data-model gap**:
  `Call.location` is a `string`, `Call` has no coordinate field, `buildCallEvent` can
  only locate a call by string-matching a placed post, and the venue map has no call
  marker at all. The second is **half a misreading worth correcting in writing** (post
  positions are percent-of-image *data*, not baked into the PNG, and Phase 0 already
  gives them real lat/lon) over **a real gap** (the map still behaves as an image with
  dots on it). Written up as Phase 7, §0.2, §0.3(36)–(38).
- **Added Phase 7 to §6** — 7.A `Call.position` (lat/lon of record, inverting `Post` on
  purpose), 7.B pin-drop in CrowdCAD, 7.C publish calls at their own coordinate, 7.D
  inbound pins from iTAK/ATAK as *proposed* calls, 7.E coordinate-first map. Supporting
  edits in §2.2 (no basemap — expectation-setting), §5.2 (types), §7.2 (inbound UIDs stay
  the device's), §7.3 (seventh observation for the spike), §8(9) (inbound free text is a
  PHI carrier — §8 had only ever looked outward), §12, §13.
- **Found a live defect while scoping 7.D:** the bridge misfiles a hand-dropped pin as a
  team GPS fix. `cot.js` accepts `a-*` and `b-m-p-*` alike as positional and writes both
  to `tak_positions`, so a tap on a phone moves a *team's* marker on the dispatch board.
  Echo suppression does not catch it (it filters CrowdCAD's own UIDs, not a phone's).
  Same failure mode `core/CLAUDE.md` forbids for `nearestPost`, by a different route.
  Documented in §0.2 and §0.3(40); **not fixed** — it is a behaviour change to two tested
  files and belongs in a code session.
- **§0.4's "everything is hardware-gated" conclusion superseded for the second time.**
  It was true of every phase the plan *contained* and false of the plan's coverage.
  Recorded the shared shape of both failures: a plan is not an inventory of the work, and
  both gaps were reported by someone *using* CrowdCAD rather than found by reading.
- **Verified §0.1's claims rather than inheriting them**, and found two completed items
  uncommitted in the root wrapper — the §2.5 echo-suppression fix and the §0.3(30) spike
  harness. `git show HEAD:…/bridge.js | grep -c CROWDCAD_UID_PREFIX` → 0. The §0.1 row
  that said `b4c7a3b` was wrong and now says so. This is the second recurrence of the
  exact failure the branch rule exists to prevent; flagged at the top of §0.1.
- Also this session, outside the plan: diagnosed a `Cannot read properties of undefined
  (reading 'call')` 500 on the dispatch route as a 3-day-stale `next dev` whose `.next`
  had a production build written into it (4 of 6 client chunks 404ing). Not a code fault
  — cleared `.next`, restarted, route returns 200. Recorded here only so the next session
  does not go looking for it in the TAK code.
- `COT_TYPE_CODES_VERIFIED` remains **false**. Nothing transmits. **Not pushed.**

**2026-08-17 (second session, same day) — Phase 7 code: 7.A, 7.C, 7.E(2), and the bridge
pin fix.** The first day of Phase 7 that produced code rather than scope. Five commits,
all verified independently of the agents that wrote them (§0.1).

- **Committed the inherited working tree first**, before writing anything new — `78c86ad`
  in the root wrapper, carrying §2.5's echo suppression, `spike-typecodes.mjs`, and the
  FTS silent-relay findings, and bumping `core` 4e00f13 → c0751fd. §0.1's own record said
  this loss had already nearly happened twice; that was reason enough not to build on top
  of it. The 🔴 block in §0.1 is now marked resolved rather than deleted.
- **Fixed the live pin-misfiling defect** (`0445d3c`) — the one thing here a user would
  notice today, since dropping a pin in iTAK during an event moved a team's marker on the
  dispatch board. cot 12 → 13 tests, bridge 23 → 26.
- **7.A `Call.position`** (`b23cf92`) and **7.C publish-at-own-coordinate** (`50dd6b4`),
  `mapping.test.ts` 15 → 28. New decisions §0.3(43) (`ce = COT_UNKNOWN` for a pin) and
  §0.3(44) (a pin outranks the post name-match; no new `MappingSkipReason`).
- **7.E(2)** (`47157a4`) — and the more useful half was the part **not** in the task
  prompt. "Consume `Georeference.version`" builds a detector; nothing was *bumping* the
  version, because replacing a layer's map image never marked its georeference dirty. The
  detector would have compared two identical numbers and reported `'fresh'` on exactly
  the failure it was built to catch. Root-caused in `handleSubmit`; control points bumped,
  not cleared. §0.3(41)–(42). `geoUtils.test.ts` 40 → 49.
- **On delegation.** Work was split across Sonnet/Haiku agents to conserve orchestrator
  context, and every report was checked rather than trusted. Three things did not survive
  checking: a **fabricated doc citation** (an agent cited "Phase 3.2" for the pin review
  queue in two source comments — Phase 3 is inbound positions; the queue is 7.D), an
  **overclaiming comment** calling a hand-dropped pin and an accepted phone coordinate
  "both precise handlings" (a finger on a map is not precise — replaced with §0.3(43)'s
  actual reasoning), and **two mutually impossible test counts** (§0.1). One agent also
  routed writes through `python3` heredocs when `Edit` was blocked, a workaround declined
  at the orchestrator level; its full diff was read before the commit. The lesson is not
  "don't delegate" — it is that an agent report is a claim, and the cheap checks
  (re-run the suite, grep the citation, read the diff) caught all four.
- **Environment note, for the next session.** The background-isolation guard blocked all
  writes and `EnterWorktree` could not re-enter the cwd it was already in. A *new*
  worktree was refused on purpose: per the branch rule, a fresh root worktree gives `core`
  a submodule object DB that cannot see `feature/tak-integration` — which is precisely how
  the two rival TAK efforts (§0.45) ran for days unaware of each other. Resolved with the
  owner's explicit approval by setting `"worktree": {"bgIsolation": "none"}` in
  `.claude/settings.local.json`, staying in `.claude/worktrees/fts-local-dev`.
- **Closed the follow-up 7.E(2) created**, in two passes (`dbb7dce`, `a46de5c`). Worth
  noting *why* two: the first pass fixed the banner for the current editing session, which
  is the version that is easy to see and easy to test, and left the operator who reopens
  the venue tomorrow still being told "ok" over points placed on a different picture. That
  is the second consecutive staleness fix whose first pass missed the durable half —
  §0.3(46). `geoUtils.test.ts` 49 → 56.
- ~~**Stopped here:** 7.B (pin-drop UI) in flight.~~ **7.B landed in `4dc00c8`** later the
  same session — see the entry below. 7.E(1) deliberately sequenced *after*
  7.B — both edit `venuemapmodal.tsx`, and two concurrent agents in one 1185-line file is
  a merge conflict dressed as parallelism. New follow-up in §0.4: `describeGeoreferenceStatus`
  now **actively misreports** swapped-image layers as fine, because `GeoreferenceSection`
  receives only `controlPoints` and cannot see `version`.
- `COT_TYPE_CODES_VERIFIED` remains **false**. Nothing transmits. **Not pushed.**

### 2026-08-17 (cont.) — 7.B lands; the outbound chain closes

- **Phase 7.B built and committed (`4dc00c8`).** `Call.position` finally has a writer, so
  the outbound chain 7.A → 7.B → 7.C is complete inside CrowdCAD: drop a pin, and
  `buildCallEvent` publishes that call at its own coordinate instead of at its assigned
  post. Two standing caveats on "complete", both pre-existing:
  `COT_TYPE_CODES_VERIFIED` is still `false` and Phase 2's outbound leg is still unwired,
  so this is correct on paper and has never been watched arriving on a phone.
- **The conversion logic went into a new pure module** rather than the modal:
  `src/lib/callPositionUtils.ts`, 150 lines, 20 tests. Reason is structural, not
  stylistic — this repo has **no component-test harness** (§0.2), so logic left inside a
  1800-line `.tsx` is logic that cannot be tested at all. Suite 173 → 193 across 10 files.
- **Reviewed the delegated diff line by line and found three defects; all three are
  fixed in the same commit.** One was serious enough to have shipped a feature that
  silently did not work: the synthesised fallback `Layer` for a venue with no explicit
  `layers` array called `crypto.randomUUID()` in the render body, so a dropped pin's
  stamped `layerId` no longer matched the layer on the very next render, and
  `resolveCallPinPercent`'s layer-mismatch guard correctly refused to draw it. The pin
  vanished as it was dropped. **The agent's report claimed this was already fixed.** The
  other two: neither drag-release handler had the bounds guard `handleMapClick` had, so
  releasing off the image committed a negative or >100 percentage; and clearing a pin was
  unlogged while placing and moving were logged. §0.3(47) and (48) draw the lessons —
  briefly, an agent's "also fixed X" is the claim least likely to have a test behind it,
  and the mismatch guard was the messenger, not the bug.
- **Verified rather than assumed, every time it was cheap to.** Ran type-check and the
  suite personally instead of quoting agent counts; confirmed the four hardcoded marker
  colours in `venuemapmodal.tsx` were pre-existing with `git show HEAD:`; confirmed all
  eslint warnings were pre-existing (including `geoUtils.ts`'s unused `ControlPoint`,
  which is in `HEAD` and not in this diff). Two of my *own* claims were wrong and were
  corrected before they landed in this document: calls publish as `b-r-f-h-c`, not
  `b-m-p-s-m`, and an off-map call pin is *clipped* by the pan container's
  `overflow-hidden`, not drawn outside it.
- **One suspicion of mine that was simply wrong,** recorded so it is not re-raised: the
  `position: undefined` in `handleClearSelectedCallPin` looked like the classic
  Firestore-rejects-undefined bug. It is not — `removeUndefinedDeep` strips the key on the
  way out and `tx.update` replaces the whole `calls` array, so the field genuinely clears
  rather than being written as `null`.
- **Known, deliberately not fixed:** `app/types.ts` declares `CallLogEntry` **twice**
  (~line 352 and ~line 446) with identical bodies. TS declaration merging makes it
  harmless and it predates all TAK work, so fixing it belongs to a types cleanup, not
  here. Flagged so the next reader does not assume the second one is a different type.
- ~~**Stopped here:** 7.E(1) is now the only unblocked item in Phase 7 and is next.~~
  **7.E(1) landed too** — see below. The root wrapper's `core` submodule pointer bump
  went in as `7d70d63`.
- `COT_TYPE_CODES_VERIFIED` remains **false**. Nothing transmits. **Not pushed.**

### 2026-08-17 (cont.) — 7.E(1) lands; a hooks crash, and why lint didn't stop it

- **Phase 7.E(1) built (`a094350` geometry, `67f8804` UI).** Split deliberately: the
  geometry went into a pure `src/lib/offMapUtils.ts` with 15 tests, because the `.tsx`
  half cannot be tested at all here (§0.2, no component harness). Suite 193 → 215.
  **With this, every Phase 7 item that does not require a phone is done.**
- **The user hit a hooks-order crash on the dispatch page, and it was mine.** `4dc00c8`
  wrapped `venueLayers` in `useMemo` to stabilise the synthetic layer id, but left it
  where the old plain `const` sat — below an early return. A `const` there is fine; a
  hook is not. It crashed on every dispatch page load, because `event` is always null on
  the first render.
- **It then took two passes to fix, which is the part worth remembering.** The first
  pass (`9d3239b`) moved the hook above the early return *named in the crash report* and
  missed two auth guards above that one. §0.3(50).
- **The deeper miss: lint had caught it, twice, and I wasn't reading lint properly.**
  `react-hooks/rules-of-hooks` is enabled and is an error, not a warning. It was invisible
  because lint was being read through `tail -20` and this file sorts first. Confirmed the
  rule genuinely fires by linting a throwaway component with the same shape, then fixed
  the habit: grep the whole output for `Error:`. §0.3(49). This also corrected the
  warning baseline recorded in earlier sessions — 21, not 7.
- **Delegation notes.** Two Sonnet agents (7.E(1) geometry, 7.E(1) UI) and one Haiku
  audit. The geometry and UI work were both good and both had their spec's traps handled;
  I hardened four tests in the geometry that narrowed `result.geo` behind an early
  `return` without asserting it first, which would have let them pass vacuously. The
  Haiku hooks audit returned "no violations found" — wrong, but **my** fault: I told it
  the dispatch page was already fixed, so it skipped the one file that still had the bug.
  A clean audit result is the cheapest kind to get wrong; the durable check was never the
  audit, it was the linter I had been truncating.
- The UI agent independently flagged that my stated lint baseline was wrong and that it
  had seen a `rules-of-hooks` error, which it guessed was a stale-cache artifact. It was
  not an artifact — it was the real bug, disappearing mid-run because I fixed it
  concurrently. Both halves of its report were more right than the explanation it
  attached to them.
- **Not verified visually.** No browser in the session, so arrow orientation, badge
  placement and fan-out spacing on the new indicators are reasoned from code only and
  want a human eye.
- **Stopped here:** nothing unblocked remains in Phase 7. Everything further needs the
  §7.3 type-code spike — one person, one phone, an afternoon.
- `COT_TYPE_CODES_VERIFIED` remains **false**. Nothing transmits. **Not pushed.**

### 2026-08-18 — a field report, three reports, and one of them was the checkout

- **No code was written this session.** The session's output is §0.6, §0.3(51)–(54),
  the revised §0.4, Phase 7.E(3), and the new Phases 8 and 9. Three problems were
  reported from the running app; all three were investigated against the tree before
  anything was written down.
- **The most important finding is not a feature gap.** The app is being run from a
  checkout whose `core` is pinned at `9fe8de6` — no `src/lib/tak/`, no
  `callPositionUtils.ts`, no `CallMarker` — and whose `core` module cannot even resolve
  `d233438` as a git object. **Six phases marked ✅ in §0.1 have never been present in the
  binary anybody actually ran.** §0.6.1. The worktree that *does* have the code has no
  root `node_modules` and no `.env.local`, so it does not run either. This is the
  two-checkout trap from §0.45 recurring in a new form: last time it split the work, this
  time it hid it.
- **That reframes "verified".** Every ✅ in this document rests on `type-check` plus a
  passing suite. None has ever rested on a human seeing the feature work, and §0.6.1
  explains why that was not possible rather than merely neglected. §0.3(52).
- **Report 1 (the PNG map) is literal and §2.2's refusal is overridden.** No mapping
  library is installed anywhere in the repo and the map is an `<img>` under a CSS
  `scale()`. The three objections §7.E raised against a basemap all still hold; they are
  now acceptance criteria rather than reasons to decline — §0.3(53). The encouraging
  half: `pixelToLatLon` at the four percent corners already yields what a MapLibre
  `ImageSource` wants, so no new mathematics is needed.
- **Report 2 (labels) is not caused by the PNG**, which is how it was framed. It is
  `scale(${1 / mapScale})` on six marker components in `venuemapmodal.tsx`, exactly
  cancelling the container zoom. The venue editor does the *opposite* — no counter-scale
  at all. Two surfaces, opposite behaviour, neither one chosen deliberately. §0.3(54).
- **Report 3 (markers both ways) is three separate things** and it was worth taking them
  apart: the pin-drop UI exists and is reachable but is absent from the checkout being
  run; the outbound transport does not exist at all, in the app or in the bridge; and
  inbound pins are parsed and then deliberately dropped pending 7.D. Only the middle one
  is a true absence.
- **§1.4's TAK panel is now the product misrepresenting itself.** An enable switch and a
  live "what would publish" preview, for a transport that does not exist. §0.2 has warned
  about this in prose since 2026-08-16; the warning belongs on the control, not in the
  plan. §0.3(51).
- **Delegation.** Two Sonnet investigations (map rendering; TAK round-trip) and one
  Sonnet spec draft (Phases 8 and 9). Both investigations were checked against the tree
  on the points this document now asserts. The checkout finding was not in either brief —
  it came from running `git -C core cat-file -t d233438` before trusting anything else,
  which is the practice §0.1 already recommends and which paid for itself immediately.
- **Baseline re-run personally, not quoted:** `npm run test:unit` **215 passed across 11
  files**, `npm run type-check` clean, both in `.claude/worktrees/fts-local-dev/core`.
  Matches §0.1's figure.
- `COT_TYPE_CODES_VERIFIED` remains **false**. Nothing transmits. **Not pushed.**

---

### 2026-08-18 (cont.) — the checkout is consolidated, and 7.E(3) lands

Two of the three field reports closed in one sitting. Neither needed a phone.

**The checkout (0a, `b8d24df`).** The merge itself was the small part. What took care
was everything around it: the main checkout's `core` and the fts-local-dev worktree's
`core` are *different object databases* (`.git/modules/core` versus
`.git/worktrees/fts-local-dev/modules/core`), so the main checkout could not resolve a
single TAK commit — not a missing branch, a missing object store. Bridged with a local
remote pointing at the worktree's module directory and a fetch, rather than re-cloning
from `origin`, because `origin` is the public repo and none of this has been pushed.

Three things were deliberately preserved rather than cleaned up. The fts-local-dev
worktree was **detached, not deleted** — it holds gitignored TLS material (`Client.p12`,
`ca.pem`, the FTS `.env`) that exists nowhere else and that §CLAUDE.md forbids
committing; those artifacts were copied across first. The root `tsconfig.json`'s
react/react-dom `@types` pin was backed up and restored on top of the merge, because
removing it breaks the root build and the merge would have taken the other side. And
the `core` pointer conflict was resolved to `b34ec6c` only after confirming it contains
`7a82626`, the pointer the other branch recorded — so the resolution loses nothing
rather than looking like it loses nothing.

**7.E(3) (`3ea888f`).** Written up at the end of §7.E item 4. The part worth repeating
here is the framing that made it small: the two behaviours the product already had were
not two bugs, they were `k = 1` and `k = 0` of one parameter nobody had written down.
Naming the parameter turned "pick a new label behaviour" into "pick a number between
the two things we already do", and made the endpoints testable as regressions against
the old behaviour rather than as prose.

The declutterer is the piece that will need revisiting. It hides rather than nudges,
which is the right default and is argued for in place, but it estimates label widths
arithmetically instead of measuring them — layout has to be decided during render,
before the label exists to measure, and measuring afterwards means a second render pass
per zoom frame. The estimate is deliberately biased wide: over-estimating hides a label
that would just have fit, under-estimating draws two labels on top of each other, and
only the first is recoverable by zooming in.

**What is still open from the field report.** The third report — the round trip
(§0.6.4) — is untouched and is now the largest single gap in the project. CrowdCAD can
build correct CoT for every marker it owns and has nowhere to send it; the bridge parses
inbound pins and drops them pending 7.D. Also still standing: 0b, the enable-publishing
switch that still does not say publishing is unwired (§0.3(51)) — small, and it is the
product misrepresenting itself every day it waits.

---

### 2026-08-18 (cont.) — Phase 8 implemented: 8.A–8.F built, 8.G partially built

§0.6.6 (below) is the record of a report investigated *before* this work started, and it
is left as written — at the time it was checked, Phase 8 genuinely had zero lines of
code. Later the same session, Phase 8 was implemented. **Read §0.6.6 as history, not as
current status.**

**What shipped.** `src/lib/basemap/config.ts` (`readBasemapConfig`, `isBasemapConfigured`,
the `NEXT_PUBLIC_BASEMAP_PMTILES_URL`-gated degrade-to-nothing check) and
`src/lib/basemap/style.ts` (`buildBasemapStyle` — Protomaps base, then the venue raster at
0.85 opacity, then Protomaps labels on top, so street names stay legible over the venue
image). `src/components/dispatch/BasemapView.tsx` (~904 lines) is the MapLibre canvas:
`maplibre-gl` is only ever reached through a dynamic `import()`, so a deployment with no
basemap configured never pays for the ~200KB dependency; every failure path — missing
config, a rejected import, a 404'd tile archive, any MapLibre `error` event — funnels
into one `onUnavailable(reason)` and the component renders `null`, never an error UI, per
§8.B's requirement. `src/hooks/useDeviceLocation.ts` wraps browser Geolocation.
`scripts/fetch-basemap.sh` builds the offline PMTiles/glyph/sprite bundle. `venuemapmodal.tsx`
gained the `MapViewMode` toggle (§8.D), `handleBasemapClick` writing through the new
`placeCallPinFromLatLon()` (§8.F), and `UncalibratedLayerNotice` now gated correctly per
view. `GeoreferenceSection.tsx` and `page.client.tsx` gained "Use my location" per
control-point row (§8.G, control-point-capture half only — see below).
`maplibre-gl@^6.4.1`, `pmtiles@^4.5.0`, and `@protomaps/basemaps@^5.7.2` are now
dependencies in both root and core `package.json`. Full accounting in §0.1's new 8.A–8.G
rows. **`maplibre-gl@^6.4.1` did not survive contact with a browser** — the next
session-log entry, "Phase 8 visually verified in a browser," found it silently breaks
vector tile loading and downgrades it to `^5.24.0`. Left as `^6.4.1` here because that is
what this entry's session actually installed; read the version in this paragraph as
history, the same way §0.6.6 is history.

**Two things did not ship as scoped, and are recorded rather than smoothed over:**

1. **8.G's self-marker use case is unwired.** `BasemapView` accepts and draws a
   `deviceLocation` prop, but no caller ever supplies one — `venuemapmodal.tsx` never
   instantiates `useDeviceLocation()`. Only the "Use my location" control-point capture
   half of 8.G reached the UI. §0.3(58).
2. **A latent bug in `buildGeoreferenceForSave` was found and fixed in the same change**:
   it stripped `ControlPoint.accuracy` on every save, which would have quietly defeated
   the point of 8.G's accuracy plumbing the first time anyone reopened a venue. §0.3(57).

**Two deviations from the plan text, both deliberate:** the view toggle sits bottom-left,
not an unstated default corner, because the placement banners already claim top-left
(§0.3(56)); and the default view is `isBasemapConfigured() && currentLayerCalibrated`,
not simply "basemap if configured" (§0.3(55)).

**Verification state — read this precisely, because it is easy to overstate.**
`npm run type-check` is clean in `core` and `npx tsc --noEmit` is clean at root.
`npm run test:unit` is 320/320 across 14 files (up from 260 across fewer files at the
7.E(3) checkpoint — the delta is `basemap/config.test.ts` (30), `deviceLocation.test.ts`
(11), and additions to `geoUtils.test.ts` and `callPositionUtils.test.ts` for
`layerImageCorners` and `placeCallPinFromLatLon`). The root `npm run build` succeeds with
`maplibre-gl` confined to async chunks, confirming the zero-config bundle-size claim in
§8.A holds. **None of that is a human looking at a rendered map.** No basemap asset
bundle is committed (`public/basemap/` is gitignored, as designed), no Playwright
coverage exists for either the basemap view or `useDeviceLocation`, and `BasemapView.tsx`
itself has no dedicated unit test — its correctness rests on type-check plus the
downstream tests of the pure modules it calls, not on tests of its own rendering. §0.3(52)
already established that every ✅ in this document has only ever meant "the tests pass";
that caveat applies to Phase 8 at least as much as anything before it, because this is
the first phase where the untested surface (a canvas MapLibre draws into) is the entire
point of the phase.

**Not committed.** Every file listed above is uncommitted working-tree state, same as the
rest of this session's work. `git status` in `core` shows it as modified/untracked;
nothing has been pushed.

---

### 2026-08-18 (cont.) — Phase 8 visually verified in a browser; four bugs found and fixed

The previous entry closed with "no human has looked at the rendered map." This entry is
that verification, run against the local Berkeley PMTiles extract, and it did not pass
cleanly on the first attempt — it found four real bugs, all now fixed. Full technical
detail for each lives at §0.3(59)–(62); this entry is the narrative and the evidence.

**Setup gap found first.** `core/.env.local` did not exist in this checkout — gitignored,
so a fresh clone never has it — and without it `npm run dev` from `core/` (the workflow
`core/CLAUDE.md` itself prescribes for TAK work, port 3004) cannot start at all. Copied
from the root `.env.local`. §0.3(65).

**Bug 1 — the map rendered nothing, silently.** Shipped on `maplibre-gl@^6.4.1` per §8.A
as originally written. In the browser: archive header downloaded, TileJSON resolved,
`map.on('load')` never fired, blank grey canvas, zero console errors. Root cause:
`pmtiles@4.5.0`'s `addProtocol()` registration only reaches MapLibre's main thread;
maplibre-gl 6.x removed the worker-to-main-thread resource bridge that 5.x has, so the
web worker issuing tile requests has no pmtiles handler to call and simply never
completes. **Fixed by pinning `maplibre-gl` to `^5.24.0` in both `package.json` files** —
not upgrading past it until pmtiles (or MapLibre) closes the gap. §0.3(59). This is the
most important of the four fixes: it fails with no error signal at all, and it will
silently recur if anyone bumps the dependency without knowing why the pin is there.

**Bug 2 — style rejected outright, then labels silently missing.** MapLibre's style-spec
validation threw `Invalid sprite URL "/basemap/sprites/light", must be absolute` because
`config.ts`'s defaults are deliberately relative (it's SSR-safe, no `window` access). Fix:
a new `absoluteUrl()` helper in `style.ts`, applied to `glyphs`, `sprite`, and the
`pmtiles://` source URL. First attempt used `new URL(url, origin)` and broke labels a
different, quieter way — it percent-encodes the `{fontstack}`/`{range}` placeholders in
the glyphs template, so MapLibre's later substitution no longer matches and every label
fails to load with the map otherwise looking fine. Final fix uses string concatenation.
§0.3(60).

**Bug 3 — 1480×0 container.** `BasemapView.tsx` used `absolute inset-0`; MapLibre's own
stylesheet ships `.maplibregl-map { position: relative }` and loads after Tailwind's
(dynamic `import()`), so at equal specificity it wins and the container collapses to zero
height. Fixed by switching the container to `h-full w-full`. §0.3(61).

**Bug 4 — camera never settled, `load` never fired.** The camera fit ran inside a
`once('load')` handler, but `load` requires every source to report loaded, and the
venue-scale PMTiles extract has no tiles at the map's default world-view starting camera
— deadlock. Fixed by passing `bounds`/`fitBoundsOptions` to the `Map` constructor instead,
which is pure transform math needing no tiles. `reducedMotionEnabledRef`, which existed
only to pick an animation duration for the old `load`-time fit, was removed as dead code.
§0.3(62).

**What rendered, once all four were fixed.** Streets, buildings, parks, POI icons, and
place labels all draw from the local extract; the georeferenced venue raster composites
on top at 0.85 opacity; Protomaps place labels correctly draw *over* the raster,
confirming the §8.A layer order (base → venue raster → labels) works as designed in a
real browser, not just on paper; both post markers place correctly; the `© OpenStreetMap`
attribution control is present per §9. Tile decode confirmed at zoom 15: 659 road
features, 10,530 buildings, 4,284 POIs, 30 render buckets built.

**Two environment facts confirmed along the way, neither a bug:** the archive is
Protomaps Basemap schema v4.15.2 against an installed `@protomaps/basemaps@5.7.2` — this
was investigated as a suspected mismatch and cleared, all nine source-layer names match
and tiles decode correctly (§0.3(63)); and the extract's actual max zoom is 15, not the 16
`scripts/fetch-basemap.sh` requests — the upstream Protomaps daily build tops out there
for this region (§0.3(64)).

**Full verification suite, after all four fixes, all green:** core `npm run type-check`
clean; root `npx tsc --noEmit` exit 0; `npm run test:unit` 320/320 across 14 files
(unchanged from the previous entry — none of the four fixes touched a pure module a unit
test covers); core `npm run lint` 0 errors, pre-existing warnings only; root `npm run
build` succeeds with `maplibre-gl` confined to async chunks only — zero occurrences in the
shared first-load chunks — which is the concrete evidence behind §8.B's requirement that a
deployment with no basemap configured never pays for the renderer.

**Still not committed.** Same working-tree state as the previous entry, now with these
four fixes layered on top. §0.1's new Phase 8 row and Phase 8's new §8.H record the same
material in the phase-status and phase-detail locations respectively.


### 2026-08-19 — the IC-EMS GIS walkthrough, and the venue-creation gap it exposed

The CrowdCAD team met with IC-EMS (Indiana University / IU Health LifeLine EMS and
IC-EMS) and was shown their existing GIS+ATAK workflow for IU Football at Memorial
Stadium, built in ArcGIS Pro. Five things were demonstrated. An ArcGIS Pro project
layering basemaps under a georeferenced `StadiumMapNew` raster and point-feature
layers, worked at roughly 1:4,639–1:7,249 scale. A 134-row location attribute table —
`Category` / `Subcategory` / `Label` / `Lat` / `Long` — authored as a CSV and turned into
points via ArcGIS's `XY Table To Point` tool, with CSV as their standing interchange
format. A track-playback product for the 2024-11-30 IU–Purdue game showing full-shift
movement as one polyline per callsign (`Supervisor`, `Code Truck`, `East Stands Row 24`,
and others). A call-symbology product classifying the same game's calls by run type
(Medical, Trauma, Other, Intoxication) with distinct icon and colour per class. And a
season-scale kernel-density heat map of call volume across the 2023-2024 season,
independent of any single event.

Separately, and not from IC-EMS: creating a venue in CrowdCAD today offers no
map-backed option at all. The only path is a static image upload, which is the same gap
this document's Phase 10 (scoped elsewhere) exists to close, and which sharpens what
Phase 11 depends on — CSV import and GeoJSON export only make sense once a venue's
geometry is lat/lon-native rather than percent-of-image.

This session added two new phases to the plan rather than writing code. Phase 10 covers
map-first venue creation. Phase 11 covers the GIS-interchange and after-action-analytics
work motivated directly by this walkthrough: a structured location taxonomy that
subsumes `isClinic` rather than sitting beside it (11.A); CSV/GeoJSON/KML interchange in
both directions, called out as the highest-value, lowest-risk item and cross-referenced
against the KMZ/GeoTIFF ask already standing in `TAK_OPEN_QUESTIONS.md` §6 (11.B); track
history, scoped honestly against the §6.2 write-rate constraint and flagged as
PHI-adjacent under §8 rather than treated as free (11.C); call symbology by run type,
extending `statusColors.ts` (11.D); and season-scale density surfaces, scoped down to an
export-first version rather than an in-app reimplementation (11.E). The document was
also reconciled with the committed 8.I work already in the tree, so Phase 8's status and
this session's additions read consistently against each other rather than as two
uncoordinated edits landing the same day.

### 2026-08-19 (cont.) — the editor gets a basemap, and the inert button is closed (8.J, 10.D)

The planning half of this session ended with two phases written and a working tree
holding an uncommitted §8.J diff. The implementation half closed both.

**The two were committed together, deliberately, as `40342f5`.** §8.J ports the
raster/basemap toggle into the venue editor and adds "Set default view" /
"Clear default view"; §10.D adds the `onCameraChange` prop that button depends on.
Committing 8.J alone would have shipped a visible control that could not work — the
editor passed `onCameraChange` through a type cast to a prop that did not exist on
`BasemapViewProps`, so `hasLiveCamera` never became true and the button was permanently
disabled. A disabled button with no explanation is indistinguishable from a broken one,
which is a worse artifact to leave in a repo than either half alone.

`BasemapView` now fires `onCameraChange` on `moveend` **and once when the map first
becomes ready**, holding the callback through a ref like every other callback in that
file. The mount emit was not in 10.D as scoped and was added during implementation:
without it an operator who is happy with the camera §8.I already resolved for them
cannot save it, because the capture button stays disabled until they nudge the map to
prove a camera exists. The readout deliberately does not stamp `updatedAt` —
`sanitizeBasemapCameraForSave()` already stamps that at write time, and two timestamps
meaning different things would agree only by accident. The type cast at the editor call
site was removed in the same commit; nothing passes through `as` any more.

Verification: `npm run type-check` clean, `npx vitest run` → **16 files, 346 tests
passed**, `npm run lint` → 3 warnings, all pre-existing in the 8.J WIP diff
(`uploadWithRetry` unused, `LayerControlBar` unused, a type-only `prev`) and none from
this work. No test accompanies the component change itself — this repo has no
component-test harness (§8.I), the emit is four `map.get*()` calls behind a ref, and the
pure function it feeds is already covered — so this is the second Phase 8/10 item whose
verification is a browser session rather than a suite, and it is handed to the operator
as an explicit test checkpoint rather than claimed as done here.

**What this does not yet do, stated so the checkpoint is not oversold.** The editor can
now *show* a basemap and *save a camera*; it still cannot place a post on one. The
marker-tool gate at `page.client.tsx:1484` is still `previewUrl && !effectiveBasemap`,
which means turning the basemap on in the editor continues to hide the marker tool.
Basemap view in the editor remains look-only until 10.C gives `Post` a coordinate of
record and 10.E rewires that gate — the two items the phase already records as "one
change split across two files."

Phase 8 is now marked complete except 8.G's basemap-view self-marker. Phase 10 moves to
partly built.

### 2026-08-19 (cont. 2) — a location can finally be placed on the map (10.C, 10.E)

The 8.J/10.D checkpoint was handed back for testing with two caveats stated up front: the
tile archive is a UC Berkeley extract, and basemap view in the editor was still look-only.
The test came back confirming both — the map renders and behaves, and *"cannot mark
locations on the map."* That was the expected result, not a regression; closing it is
10.C and 10.E, which landed together here.

**`Post` now has a coordinate of record.** The object form gained `lat`/`lon` following
`CallPosition`'s convention rather than inventing a second one, and `geoUtils` gained
`postGeoPosition` to read it and `postPercentOnLayer` to derive a drawable percent from
it. Existing venues are untouched and there is no backfill: an ungeoreferenced percent
post has no true lat/lon, and synthesising one from a guessed extent produces a marker
that looks authoritative and is wrong — the same refusal `TAK_DECISIONS.md` §6 makes when
it records an off-map fix as `onMap: false` rather than clamping it.

**The editor's marker gate was split rather than widened.** "Add Markers" now works in
both views; "Add Control Point" stays raster-only, because a control point is by
definition a correspondence between an image pixel and a ground coordinate and there is
no image to place one on in basemap view. That distinction is now a comment at the gate,
since the obvious "fix" is to relax both together and it would be wrong.

**Two things the scoping did not anticipate turned up during implementation, and both had
to be closed for the feature to be coherent.** A map-placed post was invisible on *every*
raster — both renderers read `post.x`/`post.y` raw, so a pin placed on the map vanished
the moment the operator flipped to venue-image view, even on a georeferenced venue where
its position had been derivable all along. And dragging such a post in raster view would
have written a percent back onto a record whose truth is lat/lon; that is now disabled
with the cursor saying so, because moving one correctly means inverse-projecting through
the georeference and that is genuinely separate work.

**A pre-existing bug surfaced on the way and is the most serious thing in this entry.**
The editor's raster renderer used the index of the *filtered* post array as if it were the
index into the full one. Every post the filter dropped — a text-only location, a legacy
bare-string post — shifted every index after it, so dragging or renaming a marker acted on
a different post than the one clicked. A rename silently retitled the wrong location. The
venue in the 2026-08-19 screenshot has exactly that shape: a text location listed above a
placed marker. This was live, it predates Phase 10 entirely, and coordinate-native posts
only made it easier to hit. Recorded as 10.E(1) rather than folded into 10.E, because a
data-corruption bug that shipped deserves its own line in the table.

The console error reported alongside the marker gap — `<Image src="">` on a venue with no
image — is 10.E(2). It is a direct consequence of Phase 10 making "venue with no picture" a
supported shape rather than a degenerate one.

Verification for the whole change: `tsc --noEmit` clean, 361/361 tests across 16 files (up
from 346), and no new lint warnings — the four that remain are byte-identical to `HEAD`.

What is still not built, stated so the next checkpoint is not oversold: **10.F** (locating a
venue at creation via device GPS or typed coordinates) and **10.G** (surfacing 8.I's
`onCoverageWarning` in the editor, so a venue outside the tile extract is told so instead of
rendering grey). Phase 10 stays 🟡 partly built.


---

### 0.6 The 2026-08-18 field report — three reports from the running app

Three problems were reported from the running app on 2026-08-18. Each was investigated
against the code before anything was written here; every citation below is from
`feature/tak-integration` at `d233438`. **Two of the three are real gaps in the
product. One is substantially an artifact of which checkout the app is being run
from** — and that one is the most urgent, because it has been silently distorting this
document's picture of what the operator can actually see.

The reports, verbatim:

1. *"the map still uses a png and isn't a dynamic map like on my iphone"* — and IC-EMS
   wants **3D maps inside TAK for things which need multiple levels**.
2. *"the map names are restricted since it's just a screenshot so the words just stay
   the same size when zooming in and out instead of changing size along with movement"*.
3. *"still no option to put down markers on crowdcad which should reflect on iTAK, and
   vice versa"*.

#### 0.6.1 The checkout first, because it changes how to read report 3

**The TAK work is invisible from the checkout the app is being run in.** This is the
two-checkout trap described under "Where the code is", firing a second time in a new
way: not splitting the work as it did in §0.45, but hiding it.

| | |
|---|---|
| Main checkout `/Users/…/Dispatch/dispatch` | root on `feature/tak-georeference`, `core` pinned at `9fe8de6` |
| What that `core` contains | no `src/lib/tak/`, no `callPositionUtils.ts`, no `CallMarker` — **no TAK work at all** |
| What its `core` module cannot even resolve | `git -C core cat-file -t d233438` → `fatal: Not a valid object name` |
| Its stale `feature/tak-integration` | `8c51029`, well behind `d233438` |
| The checkout that has the work | `.claude/worktrees/fts-local-dev/` — root `13413f4`, `core` `d233438` |
| …but that checkout has | **no root `node_modules` and no `.env.local`**, so `npm run dev` does not run there either |

So the first half of report 3 — *"still no option to put down markers on crowdcad"* —
is substantially **"the feature is not in the binary being run."** 7.B's pin-drop UI is
real, reachable and wired (§0.6.4); it is simply absent from `9fe8de6`.

**This is not a footnote, it is a process failure worth naming.** Six phases have been
built, verified by test count and type-check, and marked ✅ in §0.1 — while the person
who reports what the product does has been running a tree containing none of it. Every
"verified" in §0.1 has meant *the tests pass*. Not one of them has ever meant *a human
saw it work*. §0.5's 7.E(1) entry already concedes "not verified visually"; this is the
structural reason why, and it applies retroactively to 7.B and 7.E(2) as well.

**The fix is consolidation, not a third checkout.** Either bring the main checkout onto
`feature/tak-integration` — its `core` module must first fetch the worktree's module
directory by local path, per "Where the code is" — or make the worktree runnable
(`npm install` at its root, plus an `.env.local`). Consolidating is the better of the
two: this document already contains a long section on what having two checkouts cost
(§0.45), and the correct number of TAK checkouts is one.

⚠️ **A second, independent reason report 3 could not have worked even from the right
tree:** the bridge is **PocketBase-only** (§0.6.4). An app running the default
`NEXT_PUBLIC_BACKEND=firebase` shares no database with it.

#### 0.6.2 Report 1 — the raster map. §2.2's "not a basemap" is now overridden

The finding is literal and there is nothing to argue with. The venue map is a
`next/image` `<img>` with `unoptimized`, and zoom is a CSS
`transform: translate(…) scale(…)` on the `div` wrapping it and every marker
(`venuemapmodal.tsx:1214-1241`), `transformOrigin: 'center center'`, scale clamped to
0.5–8 (`venuemapmodal.tsx:28-30`). There is no canvas, no WebGL, no tile renderer.
**No mapping library is a dependency anywhere in the repo** — maplibre-gl, mapbox-gl,
leaflet, react-map-gl, ol and deck.gl are all absent from both `package.json` files —
and no tile URL appears anywhere in the tree.

**§2.2 and the closing paragraph of §7.E both declare a real basemap explicitly out of
scope. That decision is overridden by the deployer as of 2026-08-18.** Recording *why*
it was made still matters, because the reasons did not evaporate — they turned from
grounds for declining into costs to be paid:

| Original objection (§7.E) | Still true? | What it becomes |
|---|---|---|
| A tile source and its licensing | Yes | A provider decision — §8.B |
| An offline story — "stadium connectivity is a premise of this project, not an edge case" | Yes, and it is the hard one | Pre-packaged offline tiles, and a basemap that degrades to nothing — §8.B. **This is the objection that must not be waved through.** |
| Reconciling a projection with `geoUtils`'s flat tangent-plane model | Yes, but smaller than stated | A one-way boundary, not a rewrite — §8.C |

What the objection got right, and what must survive the reversal: **coordinates, not
tiles, are what made Phase 0 valuable.** A basemap adds context underneath the venue
image; it does not change what a post or a call *is*. Phase 8 is scoped so that ripping
the basemap back out leaves the coordinate model untouched.

The one genuinely encouraging finding: `geoUtils` already has everything needed to
place the raster as a georeferenced overlay. `pixelToLatLon(t, x, y)`
(`geoUtils.ts:309`), evaluated at the four percent corners, yields exactly the corner
lat/lons a MapLibre `ImageSource` takes. No new mathematics is required — only a helper
that packages it.

#### 0.6.3 Report 2 — the labels. Deliberate, written down nowhere, and inconsistent between two surfaces

**This is not a consequence of the map being a PNG**, which is how the report frames
it, and the distinction matters because fixing it does not require Phase 8. It is one
line, repeated six times:

```tsx
transform: `translate(-50%, -50%) scale(${1 / mapScale})`
```

`OffMapBadge:243`, `PostMarker:313`, `EquipmentMarker:460`, `TeamMarker:597`,
`TakMarker:721`, `CallMarker:839` — all in `venuemapmodal.tsx`. The marker's ancestor is
scaled by `scale(mapScale)`; the marker applies `scale(1/mapScale)`; the product is
exactly 1. Labels are pixel-constant by construction, at every zoom, permanently.
Several tooltips additionally hardcode `fontSize: '15px'` (`:507`, `:636`, `:760`,
`:874`).

**And the venue editor does the opposite.** `renderMarkers()` and
`renderControlPointMarkers()` (`venues/management/page.client.tsx:797-876`) place
markers with plain percent `left`/`top` inside the *same* scaled div as the image, with
no counter-scale — so there, labels grow and blur along with the raster. Two map
surfaces in one product, with opposite label behaviour, and neither behaviour recorded
anywhere until now.

**Neither extreme is what a map does.** Constant-size is defensible and is what most
GIS clients do; scale-with-raster is what the editor does by accident and is
indefensible at 8×. What an iPhone map actually does — which is the comparison the
report is making — is neither: labels grow **sub-linearly** with zoom, are
**decluttered** by collision, and **appear and disappear by zoom level**, so that
zooming in reveals detail rather than magnifying it. That last property is the real
content of the complaint, and no amount of font scaling delivers it on its own. Scoped
as **7.E(3)**.

#### 0.6.4 Report 3 — the round trip. The CrowdCAD half exists; the transport does not

The two directions are in completely different states and have to be taken separately.

**CrowdCAD → iTAK: the chain is complete right up to the wire, and there is no wire.**
`eventToCotEvents` (`mapping.ts:359`) has exactly **one** non-test caller —
`TakSection.tsx:152`, a `useMemo` feeding the "What would publish" diagnostics card
(`TakSection.tsx:338-408`). The result never leaves the component. There is no
`/api/tak` string anywhere in the repository; `core/src/app/api/` contains only
`contact/route.ts`. No `net.Socket`, no `dgram`, no CoT port constant exists anywhere in
`core/src`. The "Enable TAK publishing" switch (`TakSection.tsx:187-199`) writes
`TakPublishSettings` onto the event, and **nothing consumes that setting.**

The bridge does not close the gap from its side either: `bridge.js` contains **no
outbound code at all** — no reference to `eventToCotEvents` or any `COT_TYPE` — and its
only socket write is a hardcoded self-announce on connect (uid `CROWDCAD-BRIDGE`,
`bridge.js:667-681`) built for echo-suppression testing. Comments at `bridge.js:715` and
`:722` say "once outbound publishing is live", which is an accurate description of the
present tense.

§0.2 has said "nothing transmits" since 2026-08-16 and it has been true the entire
time. What is new here is the **operator-facing consequence**: a dispatcher can now
enable TAK publishing in the UI, watch a diagnostics panel enumerate the markers that
would be sent, and reasonably conclude the system is publishing. §1.4 built an interface
for a capability that does not exist. That is not an argument against having built it —
but the switch has to say so. §0.3(51).

**iTAK → CrowdCAD: parsed correctly, then deliberately discarded.** `cot.js:186-198`
classifies `b-m-p-*` as `kind: 'pin'`; `bridge.js:165-167` is
`shouldWritePosition(ev) { return ev.kind === 'position'; }`; `bridge.js:693-705` logs
pins under `--verbose` and `continue`s. Nothing is written anywhere. The
`tak_pin_reports` collection has no writer, and `TakPinReport` (`types.ts:403-430`) is a
type with no implementation. This is exactly the interim behaviour §0.2 chose on
purpose, and it is still the right one — but it means the "vice versa" half of report 3
is not merely unwired, it is *intentionally dropping the data* until 7.D lands.

**The pin-drop UI itself is sound, and is buried.** Verified reachable: the dispatch
page renders `venuemapmodal` twice (`dispatch/page.tsx:3845` normal, `:3861` draft-pin
mode); Quick Call has a **"Drop pin on map"** button (`quickcallmodal.tsx:266`); an
existing call is pinned through a `Select` of calls plus `MarkerModeToggleButton`
(`venuemapmodal.tsx:1947-1972`), rendered only when `updateEvent && calls.length > 0`.
It is gated on calibration via `isLayerCalibrated` (`venuemapmodal.tsx:1567`), which is
correct and was decided in 7.A. Two discoverability facts worth keeping: it is
**cloud-only** (`dispatch/page.tsx:3058` passes `onRequestDropPin` as `undefined` in
Lite Mode), and for an existing call it is a two-step arm-then-click flow inside a modal
that has to be opened first. A user who has not been told it exists can miss it. But
*"no option to put down markers"* is, from the right checkout, no longer accurate.

#### 0.6.5 What IC-EMS asked for, and what is actually deliverable

The request is *"3D maps inside TAK for things which need multiple levels."* §2.2's
answer — that TAK cannot disambiguate floors because DTED is outdoor terrain data — is
**still technically correct and is no longer a sufficient answer**, because it stops at
what TAK cannot do without saying what it can.

- **CrowdCAD has no level data to send.** `Layer` is
  `{ id, name, mapUrl?, posts, georeference? }` (`types.ts:54-60`) — **no elevation, no
  floor number, no ordering field.** Order is array index, and `LayerControlBar` shows
  exactly one layer at a time with no z-stacking. Any TAK-side multi-level story is
  blocked on modelling this first, which is a CrowdCAD change containing no TAK content
  whatsoever. That is Phase 9.A, and it needs no hardware.
- **A TAK client can filter and label by level even though it cannot compute one.**
  Carrying a real floor value in CoT `<detail>`, in the callsign suffix, and as a
  distinct group/channel per level lets an operator *choose* a level. That is not 3D and
  must not be sold as 3D, but it is the difference between an unreadable pile of stacked
  markers and a usable picture — Phase 9.B.
- **"3D seating with wireframes" remains a surveying procurement**, exactly as §2.2
  says. Nothing in Phase 8 or Phase 9 moves toward it, and Phase 8 must not be allowed
  to imply otherwise: putting tiles under the venue image will make the map look far
  more capable without making it know anything at all about floors. §9.C separates the
  three different things "3D" is being used to mean here.

The honest sentence for IC-EMS: *multi-level awareness will be correct and filterable in
both CrowdCAD and TAK; it will not be a 3D model, and no software change produces one.*

#### 0.6.6 The second 2026-08-18 report — the map is still a PNG, and control points are being demanded where they are not needed

A second field report came in the same day, after the checkout was consolidated and
7.E(3) landed. Two reports, verbatim:

1. *"the map is still a png"*
2. *"don't need geolocation control point if u alr know where my actual position is.
   additionally, if the map is actually like apple or google maps or something a live
   map u don't need control points as well."*

**Report 1 is simply Phase 8 not started.** §0.6.2 scoped the basemap on 2026-08-18 at
`b34ec6c`; Phase 8 was still marked ⛔ NOT STARTED, and nothing had shipped. The map
surface is unchanged from what §0.6.2 described: `<Image src={mapUrl}>` at
`venuemapmodal.tsx:1355` inside `VenueMapWithPosts`, CSS `transform: translate(...)
scale(...)` at `venuemapmodal.tsx:1341`. Confirmed again today: maplibre-gl, mapbox-gl,
leaflet, react-map-gl, ol and deck.gl are still absent from both `package.json` files.
This is the **third** consecutive report about the same surface — report 1 of the first
round (§0.6.2) and the label complaint that opened §0.6.3 were both about this same
PNG-and-CSS-transform stack, and now a third report says the same thing a third time.
§0.6.1 already made the process point once: scoping a phase is not shipping it, and
every ✅ in §0.1 has only ever meant *the tests pass* — never that a human saw it work.
Phase 8 does not even have a ✅ to be caught out on, so this report cost nothing to
explain, but it is one more data point that the gap between "written down" and "in the
operator's hands" is this project's recurring failure mode, not an incident.

**Report 2 splits into two claims, and they are not the same claim.**

The second half — *"if the map is actually like apple or google maps or something a
live map u don't need control points as well"* — is **correct, and Phase 8 as drafted
never said so.** §8.C scoped MapLibre placing the raster as an `ImageSource`; it never
stated the consequence for pin-dropping that follows from a basemap being present at
all: a click on a real map is natively `map.unproject(e.point)`, a lat/lon by
construction, so there is nothing to calibrate before a pin can be placed. §8.F below
closes that gap.

The first half — *"don't need geolocation control point if u alr know where my actual
position is"* — **rests on a premise that is false today.** `grep -rn
"navigator.geolocation\|getCurrentPosition\|watchPosition"` over `core/src` and the
root `src` returns **zero hits**, in both trees, confirmed again for this report. The
app has no browser-geolocation code path anywhere. The blue dot the report is
presumably referring to is `TakMarker` (`venuemapmodal.tsx:679-811`), drawn from
`team.tak.x`/`team.tak.y` — a GPS fix relayed from a phone running ATAK/iTAK, through
FreeTAKServer, the Node bridge, the `tak_positions` collection, and
`useTakPositions.ts`. That is somebody else's phone on the venue network, not the
browser's own position, and it is not available in the venue editor, which is the one
place control points actually get placed. So the premise ("you already know where I
am") is false as stated — but the expectation behind it is reasonable, not
unreasonable to dismiss: the product could know where the person looking at the screen
is standing, and it has simply never asked. §8.G below closes that gap, at a cost that
has to be stated plainly rather than absorbed.

**The current refusal, unchanged since §0.6.2:** `UncalibratedLayerNotice`
(`venuemapmodal.tsx:935-957`) renders at `venuemapmodal.tsx:1990-1996`, gated
`showPlacementUi && !currentLayerCalibrated`, where `currentLayerCalibrated =
isLayerCalibrated(currentLayerObj)` (`venuemapmodal.tsx:1698`) and `isLayerCalibrated`
(`callPositionUtils.ts:67`) is just `solveGeoreference(...) !== null` — ">= 2
non-degenerate control points" (`geoUtils.ts:128-129`). §8.F changes *when* this gate
applies. It does not remove it.

| Half of report 2 | Claim | Status | Answered by |
|---|---|---|---|
| "if the map is actually like apple or google maps... u don't need control points" | A basemap click is already a coordinate | Correct, and never stated as a consequence in Phase 8 as drafted | §8.F |
| "don't need geolocation control point if u alr know where my actual position is" | The app already knows the viewer's position | False today — no `navigator.geolocation` call exists anywhere in the repo | §8.G |

> ⛔→✅ **Overridden by implementation, later the same session.** Everything above this
> callout is the accurate record of what the investigation found *at the time it was
> run* — Phase 8 really was zero lines of code when this was written. It no longer is:
> 8.A–8.F shipped, and 8.G shipped for control-point capture (not yet for the basemap-view
> self-marker). See the "2026-08-18 (cont.) — Phase 8 implemented" session-log entry
> above and §0.1 for what actually exists now, and read the "confirmed again today"
> language in §0.6.2 and above as a timestamp, not a current claim.

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

  > **Superseded in part, 2026-08-18.** The paragraph above remains the honest technical
  > statement — TAK cannot compute a floor, and nothing changes that. What it got wrong
  > was stopping there. It does not mention that **CrowdCAD has no level data to send in
  > the first place**: `Layer` carries no floor number, no elevation and no ordering
  > field (§0.6.5), so the "carry the layer name in `<remarks>`" plan above is the
  > *entire* multi-level story that currently exists, and it is a string. Phase 9 models
  > the level properly, then says exactly what TAK can and cannot do with it.

- **"3D seating with wireframes."** That is a LiDAR/photogrammetry surveying
  engagement producing a georeferenced digital twin. It is a vendor procurement,
  not a software feature, and nothing in this plan moves toward it. TAK's 3D model
  support is a static decoration layer, not live occupancy.
- **A real basemap for CrowdCAD's own map.** Georeferencing a venue image (Phase 0)
  gives every placed thing a true lat/lon, and Phase 7 makes calls first-class in that
  coordinate space. Neither turns the venue map into a GIS: there are no OSM/satellite
  tiles, no vector layers, and no panning beyond the image. The raster stays the
  backdrop; what changes is that coordinates — not pixels — become the system of record.
  Anyone who hears "the map is dynamic now" and pictures Google Maps has the wrong
  picture. Phase 7.E says what it would actually take.

  > **Overridden 2026-08-18.** The deployer has asked for a real basemap and the refusal
  > above no longer holds — see §0.6.2 and Phase 8. Everything the paragraph says about
  > what georeferencing does and does not buy is still correct, and the warning in its
  > last two sentences is *more* important now, not less: a basemap makes the map look
  > like a GIS without making it one. §8.E.

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

### 5.2 Call positions and georeference provenance (Phase 7)

> ✅ **Shipped in `b23cf92`.** `CallPosition`, `PositionSource` and `TakPinReport` are in
> `core/src/app/types.ts` now; the sketch below matched what landed. Read `types.ts` as
> authoritative — CrowdCAD has no schema-validation layer, so this section is
> documentation, not a spec.
>
> **One name collision to know about.** `PositionSource` shipped as `'manual' | 'tak'` —
> and it is **not** the `PositionSource` in §5.1 above. That one (`'tak' |
> 'field-client' | 'manual'`) described *live GPS* provenance for a team and was
> **deleted** at the §0.45 merge along with `TeamPosition`, because `TakPositionRecord`
> is the type that is actually built and proven against real hardware. The new one
> describes how a *call* got a coordinate: different concept, same obvious name, and
> `types.ts` carries a doc comment saying so at the declaration. `'field-client'` was not
> carried over — a union member with no producer is a branch every `switch` must handle
> for a case that cannot occur; add it with the thing that emits it.

```ts
// ── A call's own location, independent of any named post ────────────────────
/**
 * lat/lon is the SYSTEM OF RECORD; x/y are derived for drawing. This is the
 * INVERSE of `Post`, deliberately — see Phase 7.A. A post is always authored by
 * clicking the venue image, so image coordinates are natural for it. A call pin
 * can arrive from a phone that has never seen the image, so lat/lon is the only
 * representation both sources share.
 */
export interface CallPosition {
  lat: number;
  lon: number;
  /** Percent of image width/height, derived via the layer georeference. Null if
   *  the point falls outside this layer's image — see Phase 7.E(1). */
  x: number | null;
  y: number | null;
  /** Layer the pin is drawn on. Resolved by georeference containment, and
   *  CORRECTABLE BY DISPATCH — unlike `TakPosition.layerId`, this is durable
   *  call state, not a transient fix. Phase 7.E(3). */
  layerId?: string;
  /** Which georeference produced x/y. Mismatch against the layer's current
   *  `Georeference.version` means the map image changed underneath this pin and
   *  the derived coordinates are stale — Phase 7.E(2). */
  georeferenceVersion?: number;
  source: PositionSource;          // 'manual' = dropped in CrowdCAD, 'tak' = accepted from a pin
  placedAt: number;                // epoch ms
  placedBy?: string;
  /** CoT uid of the originating pin, when source is 'tak'. Provenance only —
   *  never used to locate the call. See §7.2. */
  takUid?: string;
}

export interface Call {
  // …existing fields…
  /** Absent = legacy behaviour: position derived from `location` by post-name
   *  match, exactly as `buildCallEvent` does today. */
  position?: CallPosition;
}
```

`Call.location` (free text) is **kept and stays primary** in the Quick Call flow. It is
not superseded by `position` — `"NW concourse, by gate 4"` carries information a
coordinate does not, and dispatch types under time pressure. Phase 7.B.

Inbound pins awaiting dispatch review are **not** `Call`s and must not be written into
`Event.calls` (Phase 7.D — CrowdCAD is the system of record; a pin is a proposal):

```ts
/** One document per unreviewed inbound pin. Collection: `tak_pin_reports`. */
export interface TakPinReport {
  id: string;
  eventId: string;
  orgId: string;
  lat: number;
  lon: number;
  /** Operator-typed label/remarks from the device. UNTRUSTED FREE TEXT and a
   *  possible PHI carrier — see §8(9). Never auto-copied into a Call field. */
  label?: string;
  remarks?: string;
  takUid: string;
  takCallsign?: string;
  cotType: string;
  timestamp: number;               // device time
  receivedAt: number;              // server time
  status: 'pending' | 'accepted' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: number;
  /** Set when accepted, so a pin can be traced to the call it became. */
  callId?: string;
}
```

Rules for `tak_pin_reports` mirror `positions` in §5.1 (org-scoped read/write, bridge
writes via Admin SDK / PocketBase admin and bypasses them). Add the collection to
`core/scripts/setup-pocketbase.js` alongside `tak_positions`.

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

*Status 2026-08-16: **1.1, 1.2 and 1.4 are built and tested.** What remains is
`kml.ts`, the 1.3 feed route, the feed-URL control §0.3(21) held back with it, and
the 1.5 spike that gates all three. Every remaining piece of Phase 1 is a piece
that touches the network — which is exactly the boundary §0.2 drew, now reached.*

*(The superseded 2026-08-15 note said 1.3–1.4 were both spike-gated. That was
half wrong: a settings panel transmits nothing, so no spike ever gated 1.4. The
error is instructive — "this phase is blocked" was inherited from the phase
number rather than checked against what the work actually does.)*

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
  mapping.ts   ✅ eventToCotEvents(event, venue, settings, now): MappingResult
                  DEFAULT_STALE_SECONDS, MappingSkip, MappingSkipReason
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

**1.2 `eventToCotEvents`** ✅ *Built 2026-08-16.* Every responsibility listed below
is implemented and tested (22 tests). Two deliberate deviations from the text as
drafted, both recorded in §0.3: it returns `{ events, skipped, typeCodesVerified }`
rather than a bare `CotEvent[]` (§0.3(11)), and it enforces the §11 residual gate by
refusing any layer whose georeference fit exceeds `MAX_ACCEPTABLE_RESIDUAL_METRES`,
reporting the measured error. The type codes it emits remain UNVERIFIED — the module
propagates that fact rather than blocking on it (§0.3(10)).

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

**1.4 UI.** ✅ *Built 2026-08-16, except the feed URL.* `TakSection.tsx` is wired
into `src/app/(main)/events/[eventId]/create/page.tsx` as a `TAK` tab, reading and
writing `Event.tak` through the page's existing `stripUndefined` save path. An
event whose operator never opens the tab gains no `tak` field.

A "TAK" section in the event settings: enable toggle, publish switches,
callsign prefix, group, ~~and a copyable feed URL with a "rotate token" button~~.
Compose from existing `event-create/` section components; follow the
`GeoreferenceSection.tsx` layout conventions (HeroUI `Card`, surface tokens,
status-tone banner).

Built as specified, plus three things the draft did not ask for:

- **A `publishCalls` three-way control with an explicit PHI warning on `full`.**
  The warning names what full mode transmits (the chief complaint, to every
  connected client and federated partner) *and* what it never transmits in any
  mode (age, gender, notes, call log) — the latter because an operator who
  cannot see the boundary will assume the worst and leave calls off entirely,
  which loses the genuinely useful `location-only` mode. Copy checked against
  `redaction.ts`'s actual allowlist, not against intent.
- **The `COT_TYPE_CODES_VERIFIED` banner** — see §0.3(23).
- **A live diagnostics preview** rendering `eventToCotEvents`'s `skipped`
  records — see §0.3(22). This is the payoff §0.3(11) was written to enable.

**The feed URL was deliberately omitted** — §0.3(21). Add it with §1.3, not before.
`staleSeconds` and `publishIntervalSeconds` are exposed with the §6.2 write-rate
reasoning as helper text, defaulting to 120s/30s (a 4× margin, per §7.4).

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

### Phase 2 — The bridge (`crowdcad-tak-bridge`) — 🟡 INBOUND BUILT, OUTBOUND NOT WIRED

**Read the direction carefully — the two halves are at completely different stages.**

**INBOUND (TAK → CrowdCAD) is built and proven on real hardware.** It lives in the
ROOT WRAPPER at `dev/crowdcad-tak-bridge/` and `dev/freetakserver/`, *not* in `core/`,
and arrived via the 2026-08-16 merge (§0.45). A real iPhone running iTAK over TLS had
its GPS relayed by FreeTAKServer into the `tak_positions` collection. Read
`dev/TAK_DECISIONS.md` in the root wrapper for the FreeTAKServer and iTAK constraints
that drove its design — several look arbitrary and are load-bearing.

**OUTBOUND (CrowdCAD → TAK) is NOT wired.** The pure modules exist and are tested
(`core/src/lib/tak/`), but `eventToCotEvents` currently has **no non-test callers** —
nothing in the running app publishes a CoT event to anything. That is what the rest of
this section specifies and it is still to do, and it stays gated on the §7.3 type-code
spike before anything transmits.

The subsections below were written before the inbound bridge existed and describe a
single bridge service inside `core/`. Treat them as the spec for the *outbound* path
only; do not read them as a description of what is there now.

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

**Step 2 status: ✅ done this session.** It was specified as "UID prefix match"
above and implemented as `ev.uid === 'CROWDCAD-BRIDGE'` — one hardcoded literal,
which suppressed only the bridge's own announce and nothing else. Every marker
CrowdCAD published under its documented `crowdcad.` prefix would have come back
in and been written as a GPS fix for whatever callsign it carried. `bridge.js` now
has `isSelfPublished(uid)`, which prefix-matches `CROWDCAD_UID_PREFIX` and still
matches the legacy `CROWDCAD-BRIDGE` announce (which predates the prefix scheme).

The prefix constant is duplicated in `bridge.js` rather than imported — `uid.ts`
is TypeScript and the bridge is dependency-free CommonJS — so `bridge.test.js`
carries a cross-repo tripwire that reads `core/src/lib/tak/uid.ts` off disk and
asserts the two agree, failing loudly if the regex stops matching rather than
passing on a `null`. Bridge tests: 18 → 23. Detail in §0.3(32).

**2.6 Health and observability.** `GET /healthz` on the bridge: transport state,
last publish time, last inbound CoT time, event subscription count, reconnect
count. Structured logs. **Log no PHI** — no chief complaint, age, gender, patient
notes, ever, per `core/CLAUDE.md`. Log team callsigns and UIDs only.

---

### Phase 3 — Inbound positions in the dispatch UI — ✅ BUILT

**Inbound positions ARE implemented and wired into the dispatch UI**, and arrived via
the 2026-08-16 merge (§0.45). The bridge receives CoT from TAK clients, writes to the
`tak_positions` collection, and the UI subscribes and renders. See
`core/src/hooks/useTakPositions.ts`, `useTakTween.ts`, and `core/src/lib/takInterpolation.ts`,
wired into `venuemapmodal.tsx` and the dispatch page. Positions carry intermediate fixes
in `path` so the marker is walked along its actual route by arc length rather than
teleporting between fixes (§0.3(18)).

**Device binding is built too:** `Staff.takCallsign` is editable from the dispatch UI
(`addteammodal.tsx`, wired in the dispatch page), and it is the authoritative binding —
the bridge only reads it, so changing a callsign takes effect without a restart.

⚠️ **The subsections below are stale in their details.** They were written against the
pre-merge design and name `useTeamPositions.ts`, a `'positions'` collection, and the
`TeamPosition` type — **all three of which no longer exist**; `TeamPosition` was deleted
in the merge (§0.3(18)). Read them for intent, not for identifiers.

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

### Phase 7 — Pin-droppable calls and a coordinate-first map — 🟡 PARTLY BUILT

> **Status as of 2026-08-17.** 7.A ✅ `b23cf92` · 7.B ✅ `4dc00c8` · 7.C ✅ `50dd6b4` ·
> 7.D 🟡 bridge half ✅ `0445d3c`, review queue ⛔ (gated on the §7.3 pin type code) ·
> 7.E(1) ✅ `a094350` (geometry) + `67f8804` (UI) · 7.E(2) ✅ `47157a4` +
> `dbb7dce` + `a46de5c` · **7.E(3) 🟡 SCOPED 2026-08-18, not started.** The text below is
> the original scoping and is kept as written; each sub-item carries its own status line.
>
> ⚠️ **This block used to read "everything in Phase 7 that does not need a phone is now
> done." That was true when written and is now false**, and how it became false is the
> useful part: 7.E(3) was not deferred, it was *invisible*, exactly as Phase 7 itself was
> before 2026-08-17 (§0.3(36)). Both were found by someone using the running app, not by
> re-reading this plan. Two remaining items: **7.E(3)** (label behaviour — needs nothing)
> and **7.D's review queue** (gated on the §7.3 type-code spike). Per-decision notes in
> §0.3(41)–(47), session narrative in §0.5.
>
> **The outbound chain is now complete end to end.** 7.A gave `Call.position` a shape,
> 7.C gave it a publisher, and 7.B gives it the writer that was missing: a dispatcher
> drops a pin on the venue map, and `buildCallEvent` emits that call at its own
> coordinate (`COT_TYPE_CALL` = `b-r-f-h-c`) instead of at its assigned post. Before
> `4dc00c8` nothing in the product could produce a `Call.position` at all, so 7.C's
> pin-outranks-post precedence was live code on a field that was always absent.
>
> Two caveats on "complete", both pre-existing and neither introduced by 7.B:
> `COT_TYPE_CODES_VERIFIED` is still `false` — no candidate code in §7.3 has been
> confirmed against a real iTAK/ATAK screen — and Phase 2's **outbound leg is not
> wired** (§2, 🟡 INBOUND BUILT, OUTBOUND NOT WIRED). So the chain is complete in
> CrowdCAD and correct on paper; it has not yet been watched arriving on a phone.

**This is the only substantial item left in the plan that is not gated on a spike, a
phone, or IC-EMS.** §0.4 spent two revisions concluding that nothing unblocked
remained. That was true of the *export* work and false of the *model underneath it*.
See §0.3(36).

**Why this phase exists, and why §1–§6 do not contain it.** The original plan assumed
a call's location is the name of a post. It is:

```ts
// src/app/types.ts — the only spatial field on a Call
export interface Call { location: string; /* no lat/lon, no x/y */ }
```

Everything downstream inherited that assumption without ever stating it:

- `buildCallEvent` resolves a call's position by string match —
  `posts.get(slugify(call.location))` — and returns `null` on a miss, surfacing as the
  skip `Call location "X" is not a placed post on a georeferenced layer`
  (`src/lib/tak/mapping.ts`).
- The venue map renders `PostMarker` and `TakMarker` and has **no call marker at all**
  (`src/components/modals/event/venuemapmodal.tsx`).
- The Quick Call *Location* field is a free-text `Input` — not a post picker, not a map
  affordance. Blank becomes the literal string `"Unknown"`
  (`src/components/modals/event/quickcallmodal.tsx`).

So a call cannot be placed anywhere that is not already a named post, on any surface,
in either direction. This is not missing UI on top of a working model: **there is
nowhere to put the coordinate.**

**Sub-items are lettered, not numbered.** `§7.3` already means *CoT type codes*
throughout this document — the convention here is that `§N.M` denotes Phase N.M for
N ≤ 6, while `§7`–`§13` are specification sections. A "Phase 7.3" would be genuinely
ambiguous in a document meant to be picked up cold. §0.3(35).

#### 7.A — `Call.position`: lat/lon of record, percent derived — ✅ BUILT (`b23cf92`)

Landed as scoped: `CallPosition` and `PositionSource` in `core/src/app/types.ts`, plus
`TakPinReport` for 7.D's review queue. Two details worth knowing at the call site:
`layerId` is **optional and correctable by dispatch**, unlike `TakPosition.layerId`
(a device's fix is not a claim about which layer it belongs to, but a dispatcher's pin
is, and dispatchers mis-click); and `takUid` is **provenance only — never used to
locate**, so an accepted inbound pin records where it came from without becoming a live
link to a phone.

Types in §5. The asymmetry with `Post` is deliberate and load-bearing:

| | authored by | system of record | derived on read |
|---|---|---|---|
| `Post` | clicking the venue image | percent of image (`x`, `y`) | lat/lon, via the layer georeference |
| `Call.position` | clicking the map **or** a pin from a phone | **lat/lon** | percent of image, for drawing |

A post only ever comes into existence by clicking an image, so image coordinates are
its natural system of record. A call pin can arrive from a phone that has never seen
the image, so lat/lon is the only representation both sources share. Storing a call as
percent-of-image would make an inbound TAK pin unrepresentable until someone chose a
layer for it — and that choice would fall to the bridge at ingest time, the component
least qualified to make it (§6.4: the bridge knows sockets, not venues).

**Consequence to accept up front:** a call pinned on an *uncalibrated* layer cannot be
stored as a coordinate. Two options — refuse the pin, or store percent-only as a
degraded mode. **Recommend refusing**, surfacing the georeference prompt the venue
editor already has. A call position that cannot be expressed as lat/lon cannot be
published to TAK, cannot be handed to a partner agency, and cannot be compared against
a team's GPS fix; it is a coordinate in name only. A degraded mode would make
calibration look optional when it is the entire mechanism. This makes calibration a
*precondition* for pin-drop rather than a silent quality difference.

#### 7.B — Pin-drop in CrowdCAD — ✅ BUILT (`4dc00c8`)

Landed as scoped below, plus one new module the scoping did not anticipate:
`src/lib/callPositionUtils.ts` (150 lines, 20 tests). The percent↔lat/lon conversion
was pulled out of the modal so it could be tested without a DOM — there is no
component-test harness in this repo (§0.2), so anything left inside a 1800-line
`.tsx` is effectively untestable. Its two load-bearing functions:

- **`placeCallPin()` refuses on an uncalibrated layer** rather than falling back to
  percent-only. A position that cannot be expressed as lat/lon cannot be published to
  TAK, handed to a partner agency, or compared against a team's GPS fix — so a click on
  an uncalibrated layer produces *nothing*, not a coordinate that only looks like one.
  `isLayerCalibrated()` is exported separately so the UI can say so *before* the click
  rather than swallowing it.
- **`resolveCallPinPercent()` re-derives x/y from the layer's current georeference on
  every read**, falling back to the stamped x/y only when the transform can't be solved
  at all. This is the same derive-on-read discipline `geoUtils.postLatLon` already
  applies to `Post`, running in the opposite direction (§5.2) — a pin lands in the right
  place after a recalibration with no migration step. The fallback is deliberate: a
  possibly-stale dot beats the pin vanishing the moment someone opens the control-point
  editor.

Staleness renders from `callPinStaleness()`, which keeps `'stale'` and `'unknown'`
distinct (§0.3(41)) — an unstamped pre-7.A position is not evidence of a bad fit.

**Three defects found in review of the delegated work, fixed in the same commit.**
Worth recording because two of the three were invisible to type-check and tests:

1. **The pin vanished the instant it was dropped, on any layerless venue.** The
   fallback `Layer` that `dispatch/page.tsx` synthesises for a venue with no explicit
   `layers` array was built with `crypto.randomUUID()` in the render body, so the id
   changed on every render. A pin stamped `layerId: uuid-A`; the next render asked
   layer `uuid-B` to draw it; `resolveCallPinPercent` correctly returned `null` on the
   mismatch; the pin disappeared. Now a `useMemo` keyed on the venue, with a
   deterministic `layer-${venue.id || eventId}`. **The delegated agent reported having
   fixed this and had not** — see §0.3(47).
2. **Drag-release off the image committed a garbage coordinate.** `handleMapClick` had
   an `isPointWithinRect()` guard; neither drag-release handler did, and
   `pixelToPercent` happily returns negative or >100 off the edge. Releasing off-map now
   leaves the pin where it was — the recoverable outcome, and the honest one until
   7.E(1) gives an off-map position somewhere to render.
3. **Clearing a pin was not logged**, while placing and moving were. A call that had a
   coordinate and lost it is otherwise indistinguishable from a call that never had
   one. `buildCallPinLogEntry` gained a `'cleared'` arm.

Scoping as originally written, all of which held:

- A placement mode on the venue map modal, modelled on the control-point placement mode
  the venue editor already has (`GeoreferenceSection`, `MarkerModeToggleButton`) rather
  than a new interaction vocabulary.
- A `CallMarker` beside `PostMarker` / `TakMarker`, coloured through
  `getStatusColor()` from `src/lib/statusColors.ts` so a call pin carries status the way
  every other dispatch surface does. **No hardcoded marker colours** — `core/CLAUDE.md`
  is explicit that status colour lives in one place.
- Re-drag to correct a pin, with the move appended to `Call.log`. Position is
  operationally significant and call state already keeps a log.
- The Quick Call modal **keeps free text as the primary field** and gains an *optional*
  "drop pin" affordance. Dispatchers type what the caller said, under time pressure;
  that must not regress into a required map interaction. Text and coordinate are
  complementary — `"NW concourse, by gate 4"` carries information a coordinate does not.

#### 7.C — Outbound: a call publishes at its own coordinate — ✅ BUILT (`50dd6b4`)

Landed as one branch in `buildCallEvent`, with two departures from the scoping below.
**No new reason string:** `position-unresolved` covers both failure modes, because the
outcome is identical and a new `MappingSkipReason` would make every consumer learn a
distinction that changes nothing for them (§0.3(44)) — only the human-readable *detail*
grew. And a pin publishes with **`ce = COT_UNKNOWN`**, not a zero and not an invented
radius (§0.3(43)). `mapping.test.ts` 15 → 28 tests.

One change in `buildCallEvent`: prefer `call.position` when present, fall back to the
existing post-name lookup, then skip. The skip plumbing already exists (`MappingSkip`,
`describeSkipReason`), so this is one branch and one new reason string — not new
architecture. Redaction is untouched: `applyRedaction` operates on the assembled
`CotEvent`, and a coordinate is not PHI — but see §8 for why a pin *label* is.

This also removes the sharpest edge in the current mapper: today a call at a real
location that simply is not a named post is silently absent from the TAK picture,
indistinguishable on a partner agency's map from no call existing.

#### 7.D — Inbound: a dropped pin from iTAK / ATAK — 🟡 bridge half BUILT (`0445d3c`)

> **The misfiling described below is fixed.** `parseEvent` returns `kind: 'pin'` for
> `b-m-p-*`; `bridge.js` drops pins before `buffer.offer()` via a pure
> `shouldWritePosition()`. Pins are logged under `--verbose` and **discarded**, not
> queued — `tak_pin_reports` has no consumer yet, and writing to a queue nobody reads
> would be a second half-built inbound path. **Still to do:** the review queue and the
> dispatch accept/dismiss UI, gated on the §7.3 spike settling the pin type code. Note
> the split itself needed no hardware: CrowdCAD's own posts already publish as `b-m-p-w`.

⚠️ **~~This sub-item begins by fixing a live misfiling, not by adding a feature.~~**
`dev/crowdcad-tak-bridge/cot.js` classifies inbound CoT as:

```js
const isAtom   = cotType.startsWith('a-');      // a unit reporting itself
const isMapPin = cotType.startsWith('b-m-p-');  // ← a hand-dropped pin lands here
if (!isAtom && !isMapPin) return { kind: 'ignore', reason: 'not a positional type', cotType };
// everything surviving becomes { kind: 'position' } → written to tak_positions
```

A pin dropped by hand in iTAK is therefore **already ingested today, and recorded as a
team GPS fix.** It is not dropped on the floor; it is silently wrong, and it will move
a team's marker on the dispatch map to wherever somebody tapped. Echo suppression does
not catch it — that is a UID-prefix test (§2.5) and filters only CrowdCAD's *own*
markers, so the posts CrowdCAD publishes as `b-m-p-w` are excluded while a phone's pin
is not.

This is the same class of error `core/CLAUDE.md` already legislates against for
`nearestPost` — *"never write it to `Staff.location`, because letting GPS silently
reassign a team would make walking around a destructive act."* Here a stranger's tap
does the reassigning.

Splitting `a-*` (position) from `b-m-p-*` (map pin) is a **behaviour change to
existing, tested code**: `cot.test.js` and `bridge.test.js` encode the current
classification, so the change must land visibly in the diff, not be absorbed as a
still-passing test.

**Never auto-create a call from a pin.** §2.3(1) makes CrowdCAD the system of record
and TAK never authoritative for call state; auto-creation would make a tactical map app
on a volunteer-managed phone fleet an unauthenticated writer to the call queue. An
inbound pin becomes a **proposed call** in a review queue that dispatch explicitly
accepts — creating a real `Call` with `position.source = 'tak'` — or dismisses. The
accept action is where a human supplies the chief complaint, which is precisely the
field a pin cannot carry and dispatch must not invent.

⚠️ **The exact CoT type for a hand-dropped pin is UNVERIFIED**, and it is the *same
question* §7.3's spike already exists to settle: `b-m-p-w` (waypoint) vs `b-m-p-s-m`
(spot marker), both of which the merge kept alive precisely because neither was
confirmed. Add *"drop a pin by hand in iTAK and record the type it emits"* to the
spike's observation sheet — one extra line on a sheet somebody is already holding a
phone to fill in, and it turns this sub-item from guesswork into a lookup. Until the
spike runs, 7.D is gated with the rest of §7.3. **7.A–7.C and 7.E are not.**

#### 7.E — The map: coordinate-first, raster as backdrop

This is the "the map is still just a PNG" complaint, stated precisely. Post locations
are **not** baked into the image: `Post` stores `{ name, x, y }` as percentages of image
width and height, operator-placed and persisted in Firestore/PocketBase. The PNG is
already a backdrop rather than the source of truth, and the georeference work
(`Georeference.controlPoints`, `geoUtils.pixelToLatLon` / `latLonToPixel`) already gives
those percentages real-world meaning. What is *not* yet true is that the map behaves as
a coordinate space rather than an image with dots on it. Three concrete gaps:

1. **Anything whose lat/lon falls outside the image is invisible.** The map returns
   early: `if (!tak || tak.x == null || tak.y == null || tak.onMap === false) return
   null`. This is *not* an oversight — `core/CLAUDE.md` records the reasoning: off-map
   fixes are stored `onMap: false` "rather than clamped, so the UI hides the marker
   instead of drawing it somewhere the unit demonstrably is not." That decision is
   correct and stays. What is missing is the third option it never considered: an
   **edge indicator carrying bearing and distance**, which is neither a lie about
   position nor silence. A team or a call just outside the mapped area is exactly the
   case where dispatch most needs to know a direction.

   ✅ **BUILT (7.E(1)) — `a094350` (geometry) + `67f8804` (UI).** Both constraints held:
   the badge carries **bearing *and* distance** (`"Call #12 NE 420 m"`), and nothing
   clamps — `offMapIndicator` returns an `edge` point that is where the *badge* draws,
   explicitly never written back to a `CallPosition` or `TakPosition`. Covers both
   populations that can go off-image: `tak.onMap: false` teams, and call pins whose
   percent, re-derived from the layer's current transform, falls outside 0–100 after a
   recalibration. On an uncalibrated layer the arrow still points (direction on the image
   plane needs no georeference) but no distance is shown, rather than inventing one from
   percentages. Two subtleties that were nearly bugs are recorded in `offMapUtils.ts`'s
   doc comments: the arrow angle needs an **aspect correction** because percent space is
   not isotropic, and the screen-plane angle is **not** the true-north bearing on any
   rotated georeference.
2. **Swapping the PNG silently moves every post.** Percent coordinates are meaningful
   only against one image; re-crop or replace it and every post shifts with no signal.
   `Georeference.version` exists to be bumped on recalibration and **nothing consumes
   it**. Stamp derived coordinates with the version that produced them (§5) and surface
   a "recalibration needed" state instead of quietly serving wrong positions. This is
   the one item here that is a latent data-integrity bug rather than a missing feature.

   ✅ **BUILT (`47157a4`)** — and the scoping above understated it. Stamping alone would
   have been a detector with nothing to detect: **nothing bumped the version**, because
   replacing a layer's map image never marked its georeference dirty, so the check would
   have compared two identical numbers and reported `'fresh'` on exactly the failure it
   was built for. Fixed at the source in `handleSubmit` (a map swap on a layer that has
   control points is georeference-dirty), with control points **bumped, not cleared** —
   a re-export of the same plan at a new resolution is usually still nearly right, and
   discarding the calibration destroys the material needed to re-confirm it. Staleness
   is tri-state (`'fresh' | 'stale' | 'unknown'`); "no stamp" is never reported as
   "wrong". §0.3(41)–(42). `geoUtils.test.ts` 40 → 49 tests.

   ✅ **Follow-up closed (`dbb7dce` + `a46de5c`).** `describeGeoreferenceStatus` had
   started *actively misreporting* a swapped-image layer as fine — being told "ok" is
   worse than the silence that preceded `47157a4`. It now suppresses residuals outright
   for a stale fit (a fit measured against the wrong image is not a worse number, it is a
   meaningless one) and says to nudge the points, not to start over. Staleness is durable
   via `Georeference.calibratedForMapUrl` / `georeferenceMapMatch()`, so it survives a
   save and a reload — §0.3(45), and §0.3(46) on why the first pass missed that.
3. **Which layer does a bare lat/lon belong to?** A pin from a phone names no layer.
   Resolve by testing georeference containment per layer, preferring the active layer on
   a tie, and marking genuinely ambiguous results rather than guessing. Say the limit
   out loud, per §2.2: GPS altitude cannot separate stadium levels, so a pin dropped on
   level 3 lands on whichever layer's bounds contain it. `TakPosition.layerId` is
   already documented as advisory — a *call's* layer must additionally be **correctable
   by dispatch**, not merely advisory, because it is durable call state rather than a
   transient fix.

4. **Labels do not behave like map labels, and the two map surfaces disagree about how
   they should.** Added 2026-08-18 from the field report (§0.6.3). Every marker on the
   dispatch map applies `transform: translate(-50%, -50%) scale(${1 / mapScale})` —
   `OffMapBadge:243`, `PostMarker:313`, `EquipmentMarker:460`, `TeamMarker:597`,
   `TakMarker:721`, `CallMarker:839` in `venuemapmodal.tsx` — exactly cancelling the
   container's `scale(mapScale)`, so a label is pixel-constant at every zoom. The venue
   editor does the **opposite**: `renderMarkers()` and `renderControlPointMarkers()`
   (`venues/management/page.client.tsx:797-876`) sit inside the scaled div with no
   counter-scale, so labels there grow and blur with the raster. Neither behaviour was
   chosen; one is a line copied six times, the other is its absence.

   ✅ **7.E(3) — BUILT 2026-08-18 (`3ea888f`).** The report frames this as a consequence
   of the map being a PNG. It is not, and that mattered: **it was fixable without
   Phase 8**, and it was fixed before Phase 8 was started. What shipped is recorded
   under "What was built" at the end of this item; the analysis below is left as
   written, because the decision it argues for is the one that was taken.

   The decision comes before the code (§0.3(54)). Three candidate behaviours, and the
   third is what the report is actually describing:

   | Behaviour | What it is | Where it is right |
   |---|---|---|
   | Constant size | today's dispatch map | defensible, and what most GIS clients do; but at 0.5× the labels crowd and at 8× they look detached from a map that has grown 16× under them |
   | Scale with the raster | today's venue editor | wrong at 8×, where a post name becomes a banner; it is not a considered choice, it is a missing transform |
   | **Sub-linear, decluttered, zoom-gated** | what a phone map does | **recommended** |

   The third is three separate mechanisms and they should be built and judged
   separately, because only the first is trivial: (a) **replace the counter-scale
   `1 / mapScale` with `mapScale ** -k`** for some `k` between 0 and 1, so the label's
   *net* on-screen size becomes `mapScale ** (1 - k)` — `k = 1` is today's constant
   size, `k = 0` is the editor's scale-with-raster, and `k = 0.5` (net √zoom) is the
   usual starting point — clamped to a legible minimum and a sane maximum. Writing it
   this way matters: the two behaviours the product has today are the two endpoints of
   one parameter, which is why they were never noticed as a choice; (b) **declutter by collision**, hiding or
   offsetting a label that overlaps one already placed, which is the mechanism that
   makes a real map legible at low zoom and which nothing here has today; (c) **gate by
   zoom level**, so that secondary labels — equipment staggers, off-map distance
   readouts — appear only above a threshold. **(c) is what "zooming in reveals detail"
   actually means**, and it is the half of the complaint that no font-scaling curve
   delivers on its own.

   Two constraints carried over from work already done. The **off-map badges from
   7.E(1) must keep their bearing and distance readable at every zoom** — they are the
   only thing standing between a dispatcher and silence about a unit outside the mapped
   area, so if anything stays constant-size it is these. And **`layoutOffMapBadges`
   already does a fan-out declutter along an edge** (`venuemapmodal.tsx:144`); a general
   collision declutterer should subsume it rather than run beside it, or the two will
   fight along the image border.

   Do the geometry in a pure module, as 7.B and 7.E(1) both did and for the same reason
   — there is no component-test harness here (§0.2), so anything left inside
   `venuemapmodal.tsx` is untestable. A `src/lib/labelScale.ts` with the curve, the
   clamp, and the collision test is testable; the `.tsx` wiring is not.

   **Whatever is chosen, the venue editor and the dispatch map must then agree.** A
   dispatcher who calibrates control points in one and works calls in the other is
   entitled to assume they are looking at the same map, and today they are not.

   **Effort:** (a) S, (b) M, (c) S once (b) exists. Needs no phone, no spike, no
   IC-EMS.

   ---

   **What was built (`3ea888f`).** All three mechanisms, plus the two carried-over
   constraints, plus the "both surfaces must agree" requirement. The geometry is
   `core/src/lib/labelScale.ts` — pure, 45 tests in `labelScale.test.ts`, suite
   215 → 260.

   **(a) The curve.** `markerCounterScale(mapScale, k = 0.5)` returns the factor a
   marker puts in its own `transform: scale(...)` while sitting inside a container
   already scaled by `mapScale`; `labelScreenScale` returns the resulting net
   on-screen size. They are not computed independently — the counter-scale is derived
   as `labelScreenScale / mapScale`, which is what makes the clamps
   (`MIN_LABEL_SCREEN_SCALE` 0.85, `MAX_LABEL_SCREEN_SCALE` 2.25) describe what is
   actually on screen rather than an intermediate. The endpoints are pinned by test:
   `markerCounterScale(s, 1) === 1 / s` is the old dispatch map, `markerCounterScale(s, 0) === 1`
   is the old editor. A zero, negative or non-finite scale is treated as 1 rather than
   dividing by zero, because the failure mode of that division is *every marker
   disappearing from the map*.

   Also from (a): the per-marker stagger offsets (`15 / mapScale`, `16 / mapScale`)
   became `staggerOffsetPx(15, mapScale)`. They were correct only while markers were
   `1 / mapScale`; once a marker grows sub-linearly, an offset that holds still on
   screen lets the marker grow out from under it and re-overlap the post it was
   staggered away from.

   **(b) The declutterer.** `declutterLabels` is greedy by priority — live TAK
   callsigns (30) outrank call numbers (20) outrank post names (10) — and **hides
   rather than nudges**. A nudged label on a dispatch map is a label pointing at the
   wrong place, and the operator can still hover the marker or zoom in, which is
   exactly what brings the label back. Ties break on id so a label cannot flicker as
   unrelated state changes. It returns a decision for every input id, so callers
   render from the map with no fallback branch.

   `layoutOffMapBadges` was **subsumed, not paralleled**, as the item above required:
   it moved into the module as `layoutEdgeBadges`, and its output feeds
   `edgeBadgeObstacles` into the same collision pass as immovable obstacles. The two
   cannot fight along the image border because there is now one pass. Its fan spacing
   also became zoom-aware — it was a screen-pixel constant applied in container
   pixels, so badges fanned further and further apart the more you zoomed in.

   **(c) The gate.** `minScale` on a label, with `SECONDARY_LABEL_MIN_SCALE = 1.6` —
   just above the 1.5× first zoom step, so exactly one click reveals the second tier.
   Call numbers are gated; post names and live callsigns are not.

   **The 7.E(1) constraint held.** Off-map badges kept the old `1 / mapScale` constant
   size, deliberately and with the reason written at the call site. They are viewport
   chrome pinned to the image boundary, not map content: if anything on this map stays
   pixel-constant it is the thing standing between a dispatcher and silence about a
   unit outside the mapped area. This is the one place `k = 1` is still right.

   **Both surfaces now agree.** The venue editor got mechanism (a) — markers there had
   *no* counter-scale, so a 24px pin was a 192px pin at 8×. It did not get (b) or (c),
   on purpose: it is a placement tool working on a handful of posts where seeing every
   marker you have placed matters more than a tidy layout, and it has no measured pixel
   rect to do collision in. That is a stated scope line, not an oversight.

   **Two things changed that the item did not ask for.** Posts, live callsigns and call
   numbers now carry *persistent* labels rather than hover-only tooltips — decluttering
   labels nothing draws would have been a no-op, and "the words stay the same size" is
   only answerable by a label that is always there. And each visual label is
   `aria-hidden` while its marker carries an `aria-label` at every zoom: hiding a label
   is a *visual* decision, and a screen-reader user must not lose a post's name because
   two labels happened to overlap.

   **One inherited comment was wrong.** `layoutOffMapBadges` claimed a corner resolves
   to the vertical edge; its `y` checks run first, so it has always resolved to the
   horizontal one. Behaviour kept (changing it would move existing badges for no
   benefit, and a venue image is usually wider than tall), comment corrected, tie-break
   pinned by a test. Found by the agent writing the test suite, which is the argument
   for §0.2's "pure module or it is untestable" rule stated in miniature.

   **Not closed by this.** The labels baked into the raster itself are still frozen —
   they are pixels. Only CrowdCAD's own labels behave like map labels now. Making the
   *map's* names dynamic is Phase 8, and remains Phase 8.


**Explicitly not in scope: a real basemap.** No OSM/satellite tiles, no vector layers,
no panning beyond the image. Georeferencing yields coordinates, not a GIS. Tiles would
mean a tile source and its licensing, an offline story (stadium connectivity is a
premise of this project, not an edge case), and reconciling a projection with
`geoUtils`'s deliberately flat tangent-plane model, whose venue-scale assumption is
documented at `METRES_PER_DEGREE_LATITUDE`. That is its own project. Recorded here so
nobody reads "coordinate-first map" as a promise of one — §2.2 exists for exactly this
kind of expectation-setting.

> ⛔→✅ **Overridden 2026-08-18 by the deployer.** The paragraph above stands as the
> record of why a basemap was declined; it is no longer the decision. IC-EMS asked for
> a dynamic, multi-level map, and the raster-with-dots behaviour was reported directly
> from the running app (§0.6.2). **The three objections were not wrong and have not been
> dropped — they have become acceptance criteria** in the new Phase 8: the licensing
> objection becomes the provider choice (§8.A/§8.B), the offline objection becomes a
> hard requirement that the basemap *degrade to nothing* rather than break the map
> (§8.B), and the projection objection becomes an explicit one-way boundary with a
> conformance test rather than a reconciliation (§8.C). §0.3(53).


**Effort:** 7.A S, 7.B M, 7.C S, 7.D M (behaviour change plus a review-queue UI), 7.E M
— of which 7.E(3) is S for the scaling curve, M for the declutterer, S for zoom-gating.
7.E(1), 7.E(2) and 7.E(3) are independently shippable and improve the map whether or not
calls ever get pins; 7.E(3) is the only one of the three that closes a complaint made by
somebody using the product.

---

### Phase 8 — A real basemap under the venue raster — ✅ COMPLETE (`0e030bc`, `b6d3dc9`, `a78421a`, `40342f5`) except 8.G's self-marker

**8.F and 8.G were scoped 2026-08-18** in response to the second field report (§0.6.6).
**Implementation followed the same day, and visual verification followed later the same
day (§8.H).** 8.A–8.F are built as described below; 8.G is built for its
control-point-capture use case and not yet wired for its basemap-view self-marker use
case (§0.3(58)). The 🟡 marker is honest for a narrower reason now than it was earlier
the same session: the map has been looked at in a browser and works, but none of it is
committed, and no basemap asset bundle exists in the repo (`scripts/fetch-basemap.sh`
must be run and `NEXT_PUBLIC_BASEMAP_PMTILES_URL` set before any of it renders anything
in a fresh checkout). Getting to a working render found four real bugs, fixed before
anything below could be called verified — see §8.H and §0.3(59)–(62), and read §8.A's
library-choice writeup with the correction folded in: **MapLibre shipped first on 6.x,
then had to be pinned back to 5.x, and 6.x must not be reintroduced.** See the
"Phase 8 visually verified in a browser" session-log entry and §0.1's Phase 8 rows for
the full accounting.

This phase **reverses** a decision this document already made twice — explicitly out of
scope in §2.2 and again at the end of §7.E, on three stated grounds: a tile source and
its licensing, the offline story (a stadium premise, not an edge case), and reconciling
a real projection with `geoUtils`'s deliberately flat tangent-plane model. IC-EMS has
now asked for "3D maps inside TAK for things which need multiple levels," and the
deployer has overridden the earlier call (§0.6.2). The objections did not evaporate when
the decision reversed — they became costs this phase has to pay, itemised below rather
than absorbed silently. **One thing must survive the reversal:** coordinates, not tiles,
are what made Phase 0 and Phase 7 valuable. Every marker on the new map must still be
derived from lat/lon via `geoUtils`, never from anything the map library owns, so that
ripping the basemap back out — if IC-EMS decides it is not worth the cost — leaves the
coordinate model completely untouched.

#### 8.A — Library choice — ✅ built

**Shipped as recommended: MapLibre GL JS**, added to both root and core `package.json`,
imported only via dynamic `import()` inside `BasemapView.tsx` so the cost below is paid
only by deployments that configure a basemap (§8.B). The reasoning that follows is
recorded as drafted, because it is still the reasoning for the library itself — but the
**version** it was shipped on is not what was originally recorded here, and the
correction is load-bearing enough to state before anything else in this subsection.

> ⚠️ **`maplibre-gl` must stay on `^5.24.0`. Do not upgrade to 6.x.** First shipped on
> `maplibre-gl@^6.4.1`; downgraded and pinned to `^5.24.0` in both `package.json` files
> after visual verification showed 6.x silently drops every vector tile — no error, no
> failed request, no `map.on('error')`, just a blank grey map, because `pmtiles@4.5.0`'s
> `addProtocol()` registration never reaches the web worker that actually issues tile
> requests under 6.x (5.x has a worker→main-thread bridge for exactly this; 6.x removed
> it). This also defeats §8.B's degrade-to-nothing contract, because `onUnavailable` is
> never called — see §0.3(59) for the full mechanism. A routine `npm update` past 6.0
> will reintroduce this with a clean build and no visible symptom until someone opens the
> basemap view.

The rest of the original reasoning:

**Recommend MapLibre GL JS.** It is BSD-3, has no account or API-key requirement to run
the renderer itself, supports `ImageSource` for exactly the four-corner georeferenced
raster overlay this project needs, and supports pitch and bearing — which matters
honestly, not decoratively, for the "3D" part of the ask (see §9.C). It has a maintained
first-party React binding, which matters in a codebase that is otherwise
React-component-shaped throughout.

The alternatives were considered and rejected for specific reasons, not generically:

| Library | Rejected because |
|---|---|
| Leaflet | No vector tiles, no tilt/rotate, no GPU rendering — it would solve the tile-under-raster problem and nothing else IC-EMS asked for |
| Mapbox GL JS | Licence terms and a mandatory Mapbox account/token, which this project has no institutional relationship with and no reason to acquire |
| OpenLayers | Heavier API surface, weaker vector-tile ergonomics, no meaningful advantage over MapLibre for this use case |

State the cost honestly: MapLibre is roughly a 200KB-gzipped class of dependency, and it
is **the first heavy client dependency this project has taken on**. Every prior phase has
been pure TypeScript or thin wrappers around browser/Firebase/PocketBase APIs already in
the bundle. This is a different kind of commitment and should be reviewed as one.

#### 8.B — Tiles and the offline story. This is the hard part and must not be waved through — ✅ built

**Shipped as recommended: PMTiles (Protomaps).** `scripts/fetch-basemap.sh` builds the
offline bundle — a PMTiles extract from the Protomaps daily planet build, glyph ranges,
and sprites — into `public/basemap/` (gitignored, and mirrored into the root wrapper's
`public/` because the app normally runs from there). `src/lib/basemap/config.ts` is the
degrade-to-nothing gate itself: `readBasemapConfig()` returns `null` — synchronously,
with no maplibre import at all — unless `NEXT_PUBLIC_BASEMAP_PMTILES_URL` is set, 30
tests covering the empty/whitespace/configured cases. **No asset bundle is committed.** A
fresh clone has run neither the script nor set the env var, so it opens in raster view
with no toggle offered — exactly the degrade-to-nothing behaviour required below, now
also the *default* behaviour rather than a fallback path that has to trigger. The
reasoning that produced this design is recorded as drafted:

**Recommend PMTiles (Protomaps) as the default tile source.** A PMTiles archive is a
single file served over HTTP range requests — no tile server process, no per-request
billing, no API key — and it has a genuine offline/self-hosted story: the archive can be
copied onto whatever machine runs the venue's local network segment and served as a
static file, which is the only story that survives a stadium's connectivity being
unreliable by design rather than by accident.

The alternatives, and why each fails the same test differently:

| Option | Why not |
|---|---|
| Raw OSM tile servers (`tile.openstreetmap.org`) | Usage policy explicitly forbids production/bulk use; this would get the deployer's IP blocked, not degraded |
| MapTiler / Stadia Maps | Require an API key, bill per request, and are online-only unless a paid offline-pack tier is purchased — reintroduces a vendor dependency this project has otherwise avoided |
| Self-hosted raster tile pyramid | Storage-heavy — an order of magnitude larger than a vector PMTiles archive for the same coverage — and gives up vector styling entirely |

**Requirement, not a suggestion: the basemap must degrade to nothing.** If the tile
archive fails to load — network down, file missing, range requests unsupported by
whatever is serving it — the venue raster and every marker on it must render exactly as
they do today, with no error state blocking them. A basemap that breaks the existing map
when the network dies is strictly worse than no basemap at all, given that offline
operation is the whole premise this project is built on. This is the same discipline
§7.E(1) already applied to off-map markers: silence and honest degradation over a broken
or invented display.

#### 8.C — The coordinate boundary — ✅ built

**Shipped as proposed.** `geoUtils.layerImageCorners(transform)` evaluates
`pixelToLatLon` at the four percent corners and returns them in MapLibre `ImageSource`
order, with its own `describe('layerImageCorners', ...)` block added to `geoUtils.test.ts`.
`src/lib/basemap/style.ts` hands that straight to `buildBasemapStyle()`'s raster source,
and `BasemapView.tsx` states the boundary in its own file header: every marker is placed
with `marker.setLngLat([lon, lat])` from a coordinate the component was *handed* — never
from a pixel or percentage it derived itself. The Mercator-conformance test this section
called for already existed before Phase 8 (`geoUtils.mercator-conformance.test.ts`,
written for the bridge's `georef.js` reconciliation, §0.3(27)); it proves the affine
solver agrees with a Mercator-exact computation to within 0.1 m at venue scale, which is
the same claim `layerImageCorners`'s own tests now make for the four-corner case
specifically. The original design reasoning:

Define precisely what changes and what stays put. The venue raster becomes a MapLibre
`ImageSource`, positioned by four corner lat/lons. There is no packaged helper for this
today; propose `geoUtils.layerImageCorners(transform)`, evaluating the existing
`pixelToLatLon` at the four percent corners `(0,0)`/`(100,0)`/`(0,100)`/`(100,100)` and
returning them in the `[[tl],[tr],[br],[bl]]` order MapLibre's `ImageSource` expects.
Markers — posts, calls, TAK positions — become MapLibre `Marker`s or a GeoJSON symbol
layer, positioned by lat/lon read the same way every other coordinate consumer in this
codebase already reads it.

The projection concern from §2.2/§7.E is real and must be addressed honestly rather than
assumed away: MapLibre renders in Web Mercator, and `geoUtils` uses a flat tangent-plane
approximation. At venue scale — hundreds of metres, not kilometres — the disagreement
between the two is sub-metre, small enough to ignore operationally. But the boundary
between them must be **one-way and explicit**: `geoUtils` stays the sole authority for
pixel↔latlon conversion, and MapLibre is only ever *handed* a lat/lon, never asked to
compute one. There is already a conformance test proving the affine solver agrees with
the bridge's `georef.js` (§0.3(27)); Phase 8 needs the equivalent test proving
`layerImageCorners` output, rendered through MapLibre's Mercator projection, lands within
tolerance of what `geoUtils` itself would place there.

#### 8.D — Migration path, and why it must be incremental — ✅ built

**Shipped as the plan required: a second, selectable view, not a replacement.**
`venuemapmodal.tsx` gained `type MapViewMode = 'raster' | 'basemap'`, persisted to
`localStorage['crowdcad.venueMap.viewMode']`, with a bottom-left toggle. Two deviations
from the text below, both recorded in §0.3(55)–(56): the default view is
`isBasemapConfigured() && currentLayerCalibrated`, not simply "basemap if configured" —
opening an uncalibrated layer straight into a bare basemap with no venue raster would be
a worse first impression than staying in raster view and offering the toggle; and the
toggle sits bottom-left rather than an unstated corner, because `MarkerPlacementInstruction`
and `UncalibratedLayerNotice` already claim top-left whenever placement mode is armed. The
venue editor, as anticipated, stayed percent-native — no basemap-relative control-point
UI was built, matching the reasoning below. The original migration reasoning:

Roughly eight files are coupled to percent-of-image coordinates (`venuemapmodal.tsx`'s
marker components and `getContainedImageRect`, `venues/management/page.client.tsx`'s
render and drag math, `markerUtils.ts`, `offMapUtils.ts`, `callPositionUtils.ts`,
`takInterpolation.ts` / `useTakTween.ts`). A big-bang replacement of the existing map is
the wrong shape for this migration: it is the only map dispatch has on game day, and 7.B
and 7.E(1) just landed real, tested behaviour in it. **Add the basemap as a second,
selectable view** — a toggle or tab alongside the existing raster-only map — rather than
replacing the raster map's rendering path outright. This lets the basemap ship, get
evaluated, and be reverted without touching code the dispatch board depends on today.

The venue *editor* legitimately stays percent-native regardless of how this phase
resolves: control points are placed against image pixels by definition, and there is no
basemap-relative way to ask "where on this raster is this control point" that makes more
sense than the current pixel-click interaction.

#### 8.E — What a basemap does not give you

This subsection has no code to build — it is a framing warning, not a deliverable — and
it applies unchanged now that Phase 8 has shipped. If anything it is more relevant: a
toggle now exists that makes the venue map look, at a glance, exactly like Apple/Google
Maps.

It does not give floors. It does not give 3D in the sense most people picture when they
hear the word. And it will make the map *look* far more capable than it is — the single
change in this entire plan most likely to be misread as "we have a GIS now" (§2.2). Ship
it with that framing stated out loud, not left implicit.

#### 8.F — Georeference is not a precondition in basemap view — ✅ built

**Shipped as specified, gate written as `effectiveBasemap || currentLayerCalibrated`
rather than `viewMode === 'raster' && !currentLayerCalibrated`** — the two are
equivalent (`effectiveBasemap` already encodes "in basemap view and a basemap is actually
rendering"), guarding `UncalibratedLayerNotice` in `venuemapmodal.tsx`. The basemap-view
click path is `placeCallPinFromLatLon()`, a new function in `callPositionUtils.ts` with
11 tests, that — unlike `placeCallPin` — never refuses on an uncalibrated layer, because
a `map.unproject()` result needs no calibration to be a real coordinate. A new
`writeCallPinPlacement` helper is shared by both the raster and basemap click handlers so
the two paths cannot silently diverge in what they write to `Call.position`. Sharpen a
distinction §8.C's coordinate boundary implies but never states as a UI
consequence. In **raster** view, a click is a percentage of an image and genuinely has
no lat/lon without a solved `Georeference` — the refusal at `venuemapmodal.tsx:1990` is
**correct and stays exactly as it is.** In **basemap** view (§8.D's second, selectable
view), a click is `map.unproject(e.point)` — a real coordinate by construction,
supplied by MapLibre's own projection, not by anything `geoUtils` or a control point
produced. There is nothing to calibrate before that number can be trusted, and
`UncalibratedLayerNotice` must not render there.

**The precise consequence, because it is easy to overstate:** control points remain
required to overlay the raster — that is what `layerImageCorners` (§8.C) consumes, and
an ungeoreferenced layer still has no four corners to hand MapLibre's `ImageSource`.
They are no longer required to drop a pin. An ungeoreferenced layer, viewed in basemap
mode, shows the tile basemap with no raster overlay on top of it, and full
pin-dropping against real map coordinates. Those are two different capabilities — "show
my venue image here" and "let the dispatcher mark a point" — that today share one
boolean (`currentLayerCalibrated`) gating both. 8.F is the change that stops conflating
them.

**The implementation boundary, stated so it cannot be built the easy-and-wrong way:**
the gate becomes `viewMode === 'raster' && !currentLayerCalibrated`, not a deletion of
the check. Deleting `isLayerCalibrated` outright would let a raster-view click fabricate
a coordinate from a percentage that was never tied to a lat/lon — exactly the failure
the "Consequence, accepted deliberately" paragraph on `CallPosition` in `app/types.ts`
(`types.ts:299`) exists to prevent: *"There is no percent-only degraded mode. A call
position that cannot be expressed as lat/lon cannot be published to TAK... Supporting it
would make calibration look optional when calibration is the entire mechanism."* That
paragraph is still correct for raster view. It was never true for basemap view — basemap
view did not exist when it was written.

**This is the first time the codebase has had two coordinate-acquisition paths for the
same click**, and §8.C's one-way boundary is unaffected by having two: `geoUtils`
remains the sole authority for pixel↔latlon conversion on the raster side, and MapLibre
is still never asked to convert an image percentage — it is only ever handed a screen
point it already owns, which is what `unproject` does natively. The two paths do not
call into each other; a raster-view pin still goes through `placeCallPin`/`geoUtils`,
a basemap-view pin goes through `map.unproject` directly, and both still write the same
`CallPosition` lat/lon.

#### 8.G — Device GPS as a control-point source, and why it is not a free win — 🟡 built for use #2, not wired for use #1

**`useDeviceLocation` shipped** (`src/hooks/useDeviceLocation.ts`, 276 lines: the hook
plus `classifyPositionError`, `classifyAccuracyQuality`, `getGeolocationUnsupportedReason`,
11 tests). Of the two uses scoped below, only the second is actually reachable by a
dispatcher today:

1. **A "you are here" self-marker in basemap view — built at the component level, not
   wired.** `BasemapView.tsx` accepts a `deviceLocation` prop and draws the dot plus a
   to-scale accuracy circle its own doc comment describes. But `venuemapmodal.tsx` never
   calls `useDeviceLocation()` and never passes the prop, so in practice no dispatcher
   sees this today — the capability exists in the component and stops there (§0.3(58)).
2. **A "Use my location" affordance on control-point entry — built and wired.**
   `GeoreferenceSection.tsx` and `venues/management/page.client.tsx` gained one
   `useDeviceLocation()` instance per control-point row. This is the part that answers
   the first half of report 2.

The gap this section originally opened with — no `navigator.geolocation` call anywhere in
the codebase — is closed for use #2 and still effectively open for use #1 in the sense
that matters to an operator: there is still no self-marker anyone can see.

**The honest cost, addressed as required, not waved through:** `coords.accuracy` is
surfaced at the moment of capture, and a fix worse than `MAX_ACCEPTABLE_RESIDUAL_METRES`
(25 m, `geoUtils.ts:391`) shows a coarse-fix warning — **it warns and never disables**,
which was a deliberate choice: a 30 m fix is still better than typing a guess, and
refusing it outright would push the operator toward the worse alternative. `ControlPoint`
gained `accuracy?: number` on `types.ts`, exactly as called for below. **One bug found and
fixed while wiring this through:** `buildGeoreferenceForSave` (`page.client.tsx`) was
silently stripping `accuracy` from every control point on save — the field survived
placement and display but never reached the persisted record, which would have made the
whole point of this section (a residual readout that stops overstating GPS-seeded points)
false the moment anyone reloaded the venue editor. Fixed in the same change; see §0.3(57).

The original scoping, recorded as drafted:

The gap: no `navigator.geolocation` call exists anywhere in this codebase (`grep -rn
"navigator.geolocation\|getCurrentPosition\|watchPosition"` over `core/src` and the root
`src`, zero hits in both, confirmed 2026-08-18). Add a `useDeviceLocation` hook wrapping
it.

Two uses:

1. **A "you are here" self-marker in basemap view** — the first position on the map
   that belongs to the person looking at the screen, rather than to a phone somewhere
   else on the venue network. This could not have existed before Phase 8: a raster
   percent has no relationship to the browser's own GPS fix, so there was no coordinate
   space to draw it in.
2. **A "Use my location" affordance on control-point entry** in `GeoreferenceSection` —
   calibration becomes "stand at a corner, tap it on the raster, tap Use my location"
   instead of typing coordinates by hand. This is what the first half of report 2 is
   actually asking for, even though it phrased it as a premise ("you already know where
   I am") rather than a request.

**The honest cost, which must not be waved through:** `GeolocationPosition.coords.
accuracy` is in metres — typically ±5 m outdoors under open sky, and ±20–50 m in an
urban canyon or indoors, which describes a stadium concourse under a roof or a stand's
underside about as well as anything does. `MAX_ACCEPTABLE_RESIDUAL_METRES` is 25
(`geoUtils.ts:391`). A control point seeded from a poor fix can therefore produce a
georeference whose residual readout (§0.3, `GeoreferenceSection`) reports a fit that
looks better than the input deserves — residuals measure the control points'
self-consistency, not their agreement with the ground truth. Requirement, not a
nice-to-have: `coords.accuracy` must be surfaced to the operator at the moment of
capture, a fix worse than the residual threshold must warn before the point is
accepted, and the accuracy has to be stored alongside the point so the fit-quality
readout can stop overstating itself on GPS-seeded points. That needs a
`ControlPoint.accuracy?: number` field addition to `types.ts:15-21` — record it as a
§5-family data-model addition, alongside `CallPosition` and `TakPinReport` (§5.2).

**This does not make control points obsolete in the raster editor.** GPS gives you
*where you are standing*; it does not tell the app *which pixel of the raster that is*.
The operator still has to click the raster to say "this GPS fix is this corner of the
image" — GPS replaces typing the lat/lon, not the click. Only basemap view (§8.F)
removes the need for a control point entirely, because there the click itself is
already a coordinate.

**Deployment consideration:** `navigator.geolocation` requires a secure context (HTTPS,
or `localhost`). It will not work served over plain HTTP on a LAN address, which — given
`core/CLAUDE.md`'s own note about running the dev server on a pinned port for TAK work,
and the offline/stadium-network premise §8.B already had to take seriously — is a
plausible deployment shape for this project. Flag it now rather than discover it
on-site: whatever serves the venue's local network segment needs a certificate story, or
`useDeviceLocation` degrades to unavailable, silently, the same way §8.B requires the
basemap itself to degrade.

**Effort (as estimated, and roughly borne out):** 8.A S (library selection and wiring was
mechanical once chosen), 8.B M–L (the PMTiles pipeline and the offline-serving story were
the real work), 8.C M (the new `geoUtils` helper plus the existing Mercator-conformance
test), 8.D M (dual-view scaffolding, no data-model change), 8.F S (a gate condition and
its addition to one render path), 8.G M (`useDeviceLocation` and the venue-editor
affordance landed at that size; the self-marker did not — it stopped one prop-wire short
of "M", which is a smaller gap than the estimate implies but a real one). None of it
needed a phone, a spike, or IC-EMS — confirmed by it having shipped without any of the
three. **What the effort estimate did not price in:** committing the work, running
`scripts/fetch-basemap.sh` against a real deployment, and a human actually looking at the
rendered map. The last of those has now happened — see §8.H — and cost four bug fixes
that the estimate above did not anticipate either, because none of them were visible
until a browser actually tried to render the thing.

#### 8.H — Visual verification, and the four bugs it caught — ✅ done

**The map has now been looked at in a browser, for the first time, against the local
Berkeley PMTiles extract.** Everything in §8.A–§8.G above was type-checked and unit-tested
but not one line of it had been visually confirmed to actually draw a map — §0.3(52)'s
warning that "verified" in this document has only ever meant "the tests pass" applied to
Phase 8 more than to anything before it, because a rendering canvas is exactly the kind of
surface a type-checker and a unit-test suite cannot see. Getting to a working render found
four real bugs, none of which any prior check caught, all now fixed:

1. **`maplibre-gl` 6.x silently drops all vector tile data.** The most important of the
   four — see the callout in §8.A and §0.3(59) for the full mechanism. Fixed by pinning
   to `^5.24.0` in both `package.json` files. This is now a hard constraint on the
   dependency, not a version that happened to be chosen first.
2. **Sprite/glyph URLs must be absolutised in the browser, with string concatenation, not
   `new URL()`.** §0.3(60). Fixed in `src/lib/basemap/style.ts`'s new `absoluteUrl()`
   helper.
3. **The map container must be `h-full w-full`, not `absolute inset-0`**, because
   MapLibre's own stylesheet loads after Tailwind's and wins the specificity tie.
   §0.3(61). Fixed in `src/components/dispatch/BasemapView.tsx`.
4. **The initial camera must be passed to the `Map` constructor, not fitted inside
   `once('load')`**, because `load` never fires while the camera sits somewhere the
   PMTiles extract has no tiles. §0.3(62). Fixed in `BasemapView.tsx`; also removed
   `reducedMotionEnabledRef` as dead code.

**What rendered, once all four were fixed:** streets, buildings, parks, POI icons, and
place labels drawing from the local extract; the georeferenced venue raster composited on
top at 0.85 opacity; Protomaps place labels correctly drawing *over* the raster —
confirming the §8.A base → raster → labels layer order holds in a real browser, not just
in the style JSON; both post markers placed correctly; `© OpenStreetMap` attribution
present per §9. Tile decode confirmed at zoom 15: 659 road features, 10,530 buildings,
4,284 POIs, 30 render buckets built.

**Two environment facts confirmed and cleared while doing this, recorded so they aren't
re-investigated:** the PMTiles archive is Protomaps Basemap schema v4.15.2 against an
installed `@protomaps/basemaps@5.7.2` — checked and confirmed to be a non-issue, all nine
source-layer names match and tiles decode correctly (§0.3(63)); and the extract's real max
zoom is 15, not the 16 `scripts/fetch-basemap.sh` requests — the upstream Protomaps daily
build tops out there for this region (§0.3(64)). Separately, `core/.env.local` had to be
created from the root copy before any of this could even be run — §0.3(65).

**Full verification suite after all four fixes, all green:** core `npm run type-check`
clean; root `npx tsc --noEmit` exit 0; `npm run test:unit` 320/320 across 14 files; core
`npm run lint` 0 errors (pre-existing warnings only); root `npm run build` succeeds with
`maplibre-gl` confined to async chunks only — zero occurrences in the shared first-load
chunks — which is the concrete evidence behind §8.B's requirement that a deployment with
no basemap configured never pays for the renderer.

**What this does not close:** the code is still entirely uncommitted (§0.1), no basemap
asset bundle is committed (`public/basemap/` stays gitignored by design, §8.B), there is
still no Playwright coverage for the basemap view or `useDeviceLocation`, and 8.G's
self-marker use case is still unwired (§0.3(58)). Visual verification closes the "does it
actually render" question; it does not close the "is it committed" or "is it tested at the
component level" questions, which remain open exactly as §0.1 states them.


#### 8.I — `Venue.basemapCamera` and the initial-camera precedence chain — ✅ BUILT (`b6d3dc9`, `a78421a`)

**Shipped as two commits, contract first:** `b6d3dc9` landed the shared type —
`BasemapCamera` on `app/types.ts:107-119` plus `Venue.basemapCamera?` — and a bare
`initialCamera` prop on `BasemapView`, so the type could settle before either consumer
(dispatch-side read in this sub-item, editor-side write in §8.J) was written against a
moving target. `a78421a` landed the actual resolution logic eight minutes later.

**What `Venue.basemapCamera` is:** a saved opening camera — `{ center: { lat, lon },
zoom, bearing?, pitch?, updatedAt? }` — persisted on the venue, not the layer, "because
layers are floors of one building and share a single real-world footprint, so a
per-layer camera would be the same numbers repeated with an opportunity to disagree"
(`types.ts:107-109`). It is deliberately **view state, not position state**, and the
type's own doc comment states why that distinction is what makes it safe at all:

> This is VIEW state, not position state, and the distinction is the whole reason it is
> safe: §8.C requires every marker to derive from lat/lon via `geoUtils`, never from
> anything the map library owns. A camera never becomes a marker — nothing reads these
> numbers to place anything — so storing MapLibre's own view parameters here does not
> open the door §8.C closes.

**Why it exists**, in the same comment, is the same motivating case §8.B and §8.D
already worried about in the abstract, now named exactly:

> It exists because the alternative is inference. `BasemapView` otherwise frames itself
> from the venue raster's corners or from already-located markers, and a venue that has
> NEITHER — a campus-scale venue with no uploaded image and no georeference, which is
> the case that motivated this — leaves MapLibre at its built-in world view, where a
> venue-sized PMTiles extract has no tiles at all.

That is: a brand-new venue with nothing uploaded and nothing calibrated has no raster
corners and no located markers to frame from, so without this, MapLibre opens at its own
default world view — and a venue-scale PMTiles extract has no tiles anywhere near world
zoom, so the operator sees a blank grey map with no way to navigate to their own venue.

**The precedence chain**, in `src/lib/basemap/camera.ts`'s `resolveInitialCamera()`, is
four levels, tried in order and returning at the first that has anything to offer:

1. **Saved camera** — `Venue.basemapCamera`, passed in as `initialCamera`. An explicit
   operator choice always wins over anything the module could infer.
2/3. **Raster corners, or (no raster) located markers** — collapsed into one level
   because by the time a camera is being picked they're handled identically: both arrive
   as a `geometryPoints: [number, number][]` array that `BasemapView` has already
   resolved before calling in, and the module just extends an `LngLatBounds` to fit them.
4. **The PMTiles archive's own coverage bounds** — parsed and validated from the
   archive's header by `parseArchiveCoverage()`, the last resort for a venue with no
   image, no georeference, and no located staff/calls either: better to open somewhere
   the archive actually has tiles than at MapLibre's blank world view.

Beyond level 4, if the archive has no usable coverage bounds either, resolution returns
`{ source: 'none' }` and `BasemapView` falls through to MapLibre's own built-in default —
the module doesn't manufacture a fifth camera for that case.

As `a78421a`'s commit message states, every resolved camera is **passed to the `Map`
constructor, never fitted inside a `load` handler** — the same constraint §8.H's bug #4
already established, restated here because it governs this module's contract too:
fitting on `load` deadlocks, since `load` needs every source loaded and the extract has
no tiles at world view to load into.

**`onCoverageWarning`** fires — and only ever fires, it never renders anything itself —
when the resolved camera's `venueCentre` (levels 1 and 2/3 carry one; level 4, the
archive's own coverage, cannot be "outside" itself so carries none) falls outside the
archive's coverage bounds via `isOutsideCoverage()`. The rationale is the same
indistinguishability problem §8.B's degrade-to-nothing discipline keeps citing: a venue
sited outside the archive's coverage renders a blank map that looks identical to a
broken one, so the mismatch needs to be signaled rather than silently rendered as
nothing. **No consumer yet** — the prop exists on `BasemapView` and is wired to fire, but
nothing in `venuemapmodal.tsx` or the dispatch page passes a handler for it.

**Tests:** `src/lib/__tests__/basemap/camera.test.ts`, 22 tests (commit message says 26;
counted and run directly — `npx vitest run` reports 22 passed). `camera.ts` is pure and
synchronous — no `maplibre-gl`, no `pmtiles`, no network — the same test-without-a-browser
trade-off `src/lib/basemap/config.ts` already documents for itself, load-bearing here
because, per `a78421a`'s message, "this repo has no component-test harness."

**Consumer wiring landed in the same commit:** `venuemapmodal.tsx` now passes
`initialCamera={basemapCamera}` (sourced from `event.venue.basemapCamera`) into its
`BasemapView`, with the call site's own comment noting the camera is "read once at
construction and never re-applied, so re-framing the map out from under a dispatcher who
has deliberately panned somewhere is avoided." The dispatch page (`page.tsx`) now threads
`basemapCamera={event.venue.basemapCamera}` into both the main map and Quick Call's
draft-pick picker. This closes the **read** side for the dispatch board; the venue
editor's own read/write path is §8.J.

Camera is view state and never becomes a coordinate, so §8.C's one-way boundary is
untouched by any of this — restated in both commit messages because it is the property
the rest of Phase 8 depends on staying true.

#### 8.J — Basemap in the venue editor, and "Set default view" — ✅ BUILT (`40342f5`)

Ports §8.D's raster/basemap toggle from `venuemapmodal.tsx` into
`venues/management/page.client.tsx` — the venue *editor*, which §8.D had explicitly
scoped out ("The venue editor legitimately stays percent-native... there is no
basemap-relative way to ask 'where on this raster is this control point' that makes more
sense than the current pixel-click interaction"). That scoping still holds for control
points; this sub-item does not touch marker/control-point placement. What it adds is a
second, selectable map view for the editor's own preview panel, plus a way for an
operator to capture and save `Venue.basemapCamera` from inside the editor rather than
only reading it (§8.I covers reading it into the dispatch board).

**A separate storage key, deliberately.** `EDITOR_VIEW_MODE_STORAGE_KEY =
'crowdcad.venueEditor.viewMode'`, distinct from the modal's
`'crowdcad.venueMap.viewMode'`. The file's own comment states why conflating them would
be wrong: "the editor's default-view logic differs from the modal's... so conflating the
two browser preferences would let one screen's choice silently override the other's."

**The default differs from the modal's on purpose.** §8.D's modal defaults to basemap
only when `isBasemapConfigured() && currentLayerCalibrated` — deliberately *not* opening
an uncalibrated layer straight into a bare basemap. The editor inverts the uncalibrated
case: it defaults to basemap when `isBasemapConfigured() && !hasMapUrl` — no uploaded
image at all. This is the same bootstrap case §8.I's doc comment names ("a campus-scale
venue with no uploaded image and no georeference"), but from the editor's side: showing
the raster-upload dropzone with no way past it would strand that flow entirely, where a
layer that already has an image still defaults to it unchanged, so reopening an
already-calibrated floor plan isn't surprised by a real-world map in its place. The
initial guess (computed before venue data has loaded) is re-synced once the venue loads
and its actual `mapUrl` is known — but only when no stored preference exists yet, since
the pre-load guess "is not itself a preference to respect."

**`handleBasemapUnavailable`** is the same fail-to-raster contract as the modal's
identical handler (§8.B's degrade-to-nothing, applied here to the editor instead of the
dispatch map): set once, permanently, the first time `BasemapView` reports it can't
draw, and force `viewMode` back to `'raster'`.

**`effectiveBasemap`** is the single source of truth for "is the basemap actually on
screen right now" — `isBasemapConfigured() && !basemapFailed && viewMode === 'basemap'`
— mirroring the modal's own `effectiveBasemap`, read at every render site instead of
each one re-deriving it from the three inputs separately. It also gates marker/control-
point UI off the raster panel: control-point placement operates on `handleImageClick`, a
pixel click against the raster `<Image>`, which has no meaning once the basemap is what's
on screen.

**`sanitizeBasemapCameraForSave()`**, split out to `src/lib/basemapCameraUtils.ts`
specifically so it could be unit-tested at all — "this repo has no component-test
harness... pure extraction is the established way to get anything under test at all,"
per the file's own header. It normalizes a live-read camera before it's written to
`venueData.basemapCamera`: `bearing`/`pitch` are omitted entirely rather than set to
`undefined` when the camera is north-up/flat (Firestore rejects `undefined` at any depth
— the same pattern `buildGeoreferenceForSave` already uses for `label`/`updatedBy`), and
`updatedAt` is always stamped fresh from `Date.now()` rather than trusted from the input,
since it records when *this capture* happened. Four tests in
`src/lib/__tests__/basemapCameraUtils.test.ts` cover the omission, the pass-through case,
the fresh-stamp override, and that a real `0` for bearing/pitch is kept rather than
treated as unset. The save path itself (`handleSave` in `page.client.tsx`) then omits the
`basemapCamera` key from `dataToSave` entirely when unset, rather than writing
`undefined` — the same Firestore constraint, applied at the top-level write.

**The defect this shipped with, and how it was closed — ✅ `40342f5`.** As first
written, "Set default view" was inert. The button calls `handleSetDefaultView`, which
reads `liveBasemapCameraRef.current` and writes it into `venueData.basemapCamera` via
`sanitizeBasemapCameraForSave`. That ref is kept current by `handleBasemapCameraChange`,
passed to `BasemapView` as an `onCameraChange` prop — but `BasemapViewProps` had no such
prop, so it was smuggled through a type cast and `BasemapView` never called it.
`hasLiveCamera` therefore never became `true`, the button stayed permanently disabled,
and `handleSetDefaultView`'s body was unreachable in practice. **This is why 8.J was
landed together with §10.D rather than on its own**: committing the editor toggle alone
would have shipped a visible control that could not work, and a disabled button with no
explanation is indistinguishable from a broken one. §10.D added the prop, the cast is
gone, and the capture path now runs end to end.
---

### Phase 9 — Multi-level venues, and what TAK can honestly carry — ⛔ NOT STARTED

#### 9.A — Model the level in CrowdCAD first

This is the true blocker, and it contains no TAK content at all. `Layer`
(`core/src/app/types.ts:54-60`) is `{ id, name, mapUrl?, posts, georeference? }` — no
elevation, no floor number, no ordering field beyond array index. Nothing downstream can
carry level information that CrowdCAD's own model does not have.

Propose adding an explicit, optional level descriptor:
`level?: { ordinal: number; label: string; elevationMetresAgl?: number }`. **`ordinal` is
the load-bearing field**, not `label` — it must be a sortable integer where ground level
is `0` and mezzanines or basements are representable, because everything that needs to
*order* or *filter* levels (a layer switcher, a CoT `<detail>` extension, a stacked-plate
renderer in §9.C(ii)) needs a comparable value, not a string a human typed. `label` stays
free text for what a person reads ("Main Concourse", "Suite Level").
`elevationMetresAgl` is optional and explicitly **advisory**: it is a building fact
someone enters once, not a GPS measurement, and it must never be compared against a
device's `hae` — the same discipline §2.2 already applies to TAK's DTED elevation model,
which has no idea what a building floor is.

Migration: existing layers have no `level`. The array index is the only ordering that
currently exists, and inferring `ordinal` from it is a reasonable default — but it must
be **surfaced for confirmation**, not silently written, because array order was never
intentionally a floor order and a venue with layers added out of sequence would get a
wrong ordinal nobody asked to check.

#### 9.B — What TAK can carry, stated without overselling

§2.2's claim stands unchanged: TAK cannot *compute* a floor. GPS altitude cannot separate
stadium concourse levels, and DTED has no concept of one. But a CoT event can *carry* a
level, and a TAK operator can *filter* on one, which is a materially smaller claim than
"TAK shows floors." Concretely, once 9.A exists: the level label already belongs in
`<remarks>` per the existing plan; a callsign suffix; a per-level group/channel so an
operator can select a level the way channels already gate teams today; and a CoT
`<detail>` extension carrying the numeric `ordinal` for any client sophisticated enough
to read it. **A receiving client will still stack every level at one lat/lon unless the
operator actively filters** — this is a client-side selection story, not a rendering one,
and no CoT payload changes that. The sentence to say to IC-EMS out loud: *"TAK can tell
your operator which floor a team is on if they filter for it; it cannot show them a floor
plan."*

#### 9.C — What "3D" would actually mean, three different things

The request conflates three distinct things, and they need to be separated because only
one of them is what this plan can honestly deliver:

- **(i) Map pitch/tilt.** Free with MapLibre once Phase 8 lands — tilting the camera
  looks three-dimensional and costs nothing extra. It carries **zero floor information**;
  it is a camera angle, not a data model.
- **(ii) Stacked or extruded floor plates.** Genuinely achievable: each `Layer`'s raster,
  once 9.A gives it an `elevationMetresAgl`, can be extruded to that height and rendered
  as a plate in MapLibre's 3D scene. **This is the honest interpretation of "3D maps for
  multiple levels" that software can actually deliver**, and it depends on both 9.A (the
  elevation field) and Phase 8 (a 3D-capable renderer).
- **(iii) A 3D digital twin with seating wireframes.** Unchanged from §2.2: a
  LiDAR/photogrammetry surveying engagement producing a georeferenced model, a vendor
  procurement rather than a software feature. Nothing in Phase 8 or Phase 9 moves toward
  it.

**Recommend (ii) as the deliverable**, and say plainly to IC-EMS that (iii) is what most
people picture when they hear "3D maps" — the gap between what gets built and what gets
imagined is the same gap §2.2 already warned about for the basemap generally (§8.E), and
it is sharper here because "3D" is the literal word in the request.

#### 9.D — Multi-level in CrowdCAD's own map

Independent of TAK entirely: showing more than one `Layer` at once, z-stacked with the
active layer opaque and the others dimmed, is something `LayerControlBar` cannot do today
— it offers only prev/next chevrons and exactly one layer renders at a time
(`venuemapmodal.tsx:1011-1013`). This is valuable to dispatch on its own terms — a
supervisor glancing at "who is above or below this incident" — regardless of whether TAK
ever sees a level.

**Effort and ordering:** 9.A is S–M and **gates everything else in this phase** — no
ordinal, no filtering, no extrusion, no confirmation UI. 9.B is S once 9.A exists (it is
threading an already-modelled value through mapping code that already threads the layer
name). 9.C(ii) is M–L and **depends on Phase 8** for the 3D renderer; 9.C(i) is free with
Phase 8 and needs no 9.A. 9.D is M and depends on 9.A for a meaningful stacking order but
not on TAK or Phase 8 at all. None of Phase 9 needs hardware — the entire phase is data
modelling and rendering; only §7.D's pin-type spike and any future device testing of the
`<detail>` extension in TAK clients would need a phone, and that testing is optional
confirmation rather than a blocker to shipping 9.A–9.D.

---

### Phase 10 — Map-first venues: creating a venue that has no picture — 🟡 PARTLY BUILT

> **Origin.** Raised 2026-08-19 from the running app: creating a venue at
> `/venues/management` offers "Upload Venue Map — Optional, click to select an image" and
> a Georeference tab reading "Not georeferenced — place at least 2 points." There is no
> control anywhere in that flow that says *this venue is a real place, show me a map*.
> The basemap Phase 8 built is real, committed, and invisible from the one screen where a
> venue is brought into existence.

Phase 8 asked "can we put a real basemap under the venue raster?" and answered yes. Phase
10 asks the question Phase 8 deliberately did not: **what about a venue that has no
raster to put it under?** Every IC-EMS product shown on 2026-08-19 (§0.6, Phase 11) is
built on venue geometry that is lat/lon-native — their 134 stadium locations are a CSV of
`Lat`/`Long` before they are anything else. CrowdCAD's creation flow inverts that: an
image is the entry point and coordinates are an optional calibration applied afterward,
which means the coordinate-native path is reachable only by first walking the
image-native one.

This phase is the blocking work. Phase 11 is what makes CrowdCAD legible to a GIS
agency; Phase 10 is what lets an operator create a usable venue at all without a
photograph.

#### 10.A — Why there is no map option, precisely

Three independent causes, each on its own sufficient to produce the screen the operator
saw. They must be named separately because fixing any one of them alone changes nothing.

- **The editor was never given the toggle.** Phase 8.D put the raster/basemap switch into
  the *dispatch* modal (`venuemapmodal.tsx`), not the venue editor. The editor is
  raster-only by construction, and remained so until the uncommitted 8.J diff began
  porting the same pattern across. The feature existed; the screen that needed it did not
  import it.
- **Post placement is bound to the `<img>` element.** `MarkerModeToggleButton` renders
  only behind `{previewUrl && !effectiveBasemap && (` (`page.client.tsx:1484`), and
  placement runs `onClick` on the raster image through `pixelToPercent()`
  (`markerUtils.ts:18`) against that image's bounding rect. With no image there is no
  click target and therefore no way to place a location. The georeference flow inherits
  the same dependency — control points are placed *on the image*, so "place at least 2
  points" is not merely unmet but **unsatisfiable** without an upload. Note the gate's
  second clause: even in the uncommitted 8.J state, turning the basemap *on* in the
  editor **hides the marker tool**. Basemap view in the editor is currently look-only.
- **`Post` has no coordinate of record.** `Post` is
  `string | { name, x, y, isClinic? }` (`types.ts:1-8`) where `x`/`y` are explicitly
  "percentage of width/height". A post on a map-first venue has no image to be a
  percentage *of*. This is the actual data-model blocker, and it is why 10.C — not the
  UI work — is the load-bearing item in this phase.

The creation button itself is **not** a cause and should not be blamed: it gates on the
name alone (`isDisabled={!venueData.name.trim()}`, `page.client.tsx:1447`) and the map
field is already labelled `(Optional)` (`:1466`). A venue with no image already saves
fine. It is simply useless afterward, which is the more precise complaint.

#### 10.B — The precedent already exists: do for `Post` what 7.A did for `Call`

This phase should not invent a design. Phase 7.A already faced this exact asymmetry and
resolved it: `CallPosition` (`types.ts:368`) stores **lat/lon as the system of record**
with `x`/`y` percent *derived on read* and permitted to be `null` when the point falls
outside the layer. The stated reason (§7.A) was that a call can arrive from a phone that
never saw the venue image, so lat/lon is the only representation both ends share.

A post on a map-first venue is the same object under a different name: authored against a
real map, meaningful without any image, and required to survive the venue later gaining
or swapping a raster. **The correct move is to give `Post` the `CallPosition` treatment,
not to invent a second convention.** Two coordinate philosophies in one document is a bug
factory; three is a rewrite.

#### 10.C — `Post` gains a coordinate of record — ✅ BUILT (uncommitted)

Propose extending the object form of `Post` with an optional geographic position, leaving
both the bare-string form and the percent-only form untouched:

- `lat`/`lon` present → this post is coordinate-native; `x`/`y` are derived per-layer via
  `pixelToLatLon`'s inverse and may be `null` when the post falls outside the raster.
- `lat`/`lon` absent → unchanged legacy behaviour; `x`/`y` remain the record, exactly as
  today.

**Do not migrate existing venues automatically.** An ungeoreferenced percent post has no
true lat/lon, and synthesising one from a guessed extent would produce a marker that
looks authoritative and is wrong — the identical failure `TAK_DECISIONS.md` §6 refuses
when it records off-map positions as `onMap: false` rather than clamping them, because
"a clamped marker is a confident lie." A georeferenced venue *can* have lat/lon computed
for its posts, and that computation already exists (`postLatLon`/`layerPostsLatLon`), but
writing the result back as the record is a one-way door and should be an explicit,
confirmed operator action, not a migration that runs while nobody is watching.

The `string` form of `Post` must keep working. It is load-bearing in scheduling
(`PostAssignment` is keyed by post *name*, `types.ts:408`) and this phase has no business
touching that.

**Built as scoped, plus one accessor the scoping did not name.** `Post`'s object form
gained `lat?: number` / `lon?: number`; `geoUtils` gained `postGeoPosition(post)` as the
validating reader (mirroring `postPercent`'s null/NaN discipline so no caller re-derives
those checks), and `postLatLon` / `layerPostsLatLon` now let a **stored** coordinate win
before the georeference is consulted at all.

Two implementation decisions are worth recording because neither is obvious from the
scoping text.

First, a coordinate-native post returns `georeferenceVersion: undefined`, not the layer's
current version. The field means *which calibration produced these numbers* — and for a
stored coordinate the answer is "none did." Stamping the layer's version onto a value the
layer did not compute would make `georeferenceStaleness` report a freshness it has no
basis for.

Second, `layerPostsLatLon` now solves the georeference **lazily**, on the first post that
actually needs derivation. The whole reason that function exists alongside `postLatLon` is
to amortize one `solveGeoreference` across a layer; on a map-first venue where every post
is coordinate-native, the honest amortized cost is zero solves, not one.

The accessor the scoping did not name is **`postPercentOnLayer(layer, post)`** — the read
path for *drawing* a coordinate-native post on a raster. Percent-native posts pass through
`postPercent` unchanged; coordinate-native posts derive percent through the layer's
georeference and return `null` — never a clamped value — when the layer has no usable
calibration or the point falls outside the image. It was needed the moment the two
representations had to coexist on one screen, and its absence is what would otherwise make
a map-placed post silently vanish in venue-image view.

`geoUtils.test.ts` went from 70 tests to 85: `postGeoPosition`'s validation table, a
coordinate-native post returning its stored value verbatim *even with no georeference on
the layer at all*, a mixed layer (string + percent-native + coordinate-native) returning
three entries in order, and `postPercentOnLayer`'s four cases including the far-outside one
that must return `null` rather than clamp.

#### 10.D — Close 8.J's inert button: `onCameraChange` on `BasemapView` — ✅ BUILT (`40342f5`)

The smallest change in the phase and the one that unblocks the most. `BasemapView`
exposes `onMapClick`, `onSelectCall`, `onUnavailable` and `onCoverageWarning`
(`BasemapView.tsx:84-140`) but **no camera reporting**. The uncommitted editor passes one
anyway through a type cast (`page.client.tsx:1536`) so that "Set default view" (`:1589`)
compiles; `BasemapView` never calls it, so the button is inert and the saved
`Venue.basemapCamera` is never written from the UI.

Add `onCameraChange?: (camera: BasemapCamera) => void`, fired on `moveend` and held
through a ref like every other callback in that file (`:437-445`) so a re-render storm
cannot follow the map. This matters more than its size suggests: 8.I's precedence chain
falls back through raster corners → located markers → archive coverage → **MapLibre's
world view**, and a venue with no image, no georeference and no saved camera lands on
that last rung, where a venue-sized PMTiles extract has no tiles and the operator sees
grey. The saved camera is the only rung a map-first venue can reach at creation time.

**Shipped as scoped, with two decisions worth recording.** `onCameraChange` fires on
`moveend` and *also once when the map first becomes ready*. The mount emit was not in the
original scoping and is the difference between a usable button and a riddle: without it,
an operator who is happy with the camera §8.I already resolved for them cannot save it,
because the capture button stays disabled until they nudge the map to prove a camera
exists — which is a strange thing to have to do in order to accept a default. One
listener covers pan, zoom, rotate and pitch, since MapLibre routes all four through the
same move lifecycle, and `moveend` rather than `move` means a drag reports once on
release instead of on every animation frame.

Second: the readout deliberately does **not** stamp `updatedAt`. It reports what the
camera *is*; when a reading became a saved preference is the write path's concern, and
`sanitizeBasemapCameraForSave()` already stamps it there. Stamping in both places would
give two timestamps that mean different things and agree only by accident.

No test accompanies this. `BasemapView` is a component and this repo has no
component-test harness (§8.I) — the emit is four `map.get*()` calls behind a ref, and the
pure part it feeds (`sanitizeBasemapCameraForSave`) is already covered. Verified in a
browser instead; see the note at the end of this phase.

#### 10.E — Placement against the basemap in the editor — ✅ BUILT (uncommitted)

`BasemapView` already delivers what is needed: a map click hands
`{ lat: e.lngLat.lat, lon: e.lngLat.lng }` to `onMapClick` (`BasemapView.tsx:717`), and
§8.F already established that a basemap click needs no georeference because
`map.unproject()` yields real coordinates directly. The dispatch modal consumes this
today (`venuemapmodal.tsx:1817-1834`); **the editor simply never passes the prop.**

So the work is: wire `onMapClick` in the editor, change the marker-tool gate at
`page.client.tsx:1484` from `previewUrl && !effectiveBasemap` to admit the basemap case,
and route the resulting lat/lon into a post — which is only possible once 10.C exists.
**10.C and 10.E are one change split across two files**; sequencing 10.E first produces a
click handler with nowhere to put its answer.

`PendingMarkerDialog` needs no structural change, but it should show the captured lat/lon
so the operator can see what was recorded before naming it.

**Built, and the gate was split rather than widened.** The scoping said to change
`previewUrl && !effectiveBasemap` to "admit the basemap case", which read as one condition
to relax. It is two buttons with genuinely different requirements, and collapsing them
would have been wrong:

- **"Add Markers"** is now `previewUrl || effectiveBasemap`. The raster path still derives
  `x`/`y` from an image-pixel click through `handleImageClick`; the new
  `handleBasemapMapClick` is handed a lat/lon directly and needs no image pixel space at
  all.
- **"Add Control Point" stays raster-only, deliberately.** A control point *is* a
  correspondence between an image pixel and a ground coordinate. In basemap view there is
  no image to place one on, so the button is not hidden because it is inconvenient — it is
  hidden because it is meaningless. The comment at the gate says so, because the next
  reader will otherwise "fix" it.

`handleBasemapMapClick` builds the post as `{ name: '', x: null, y: null, lat, lon }` with
every key explicitly present. That is not stylistic: the venue save path strips `undefined`
only at the *top level of each layer*, and post objects inside `layer.posts` are written to
Firestore verbatim, so an omitted-vs-`null` slip here surfaces as a failed write rather
than a bad value.

`pendingMarker` widened to `x: number | null, y: number | null` plus optional `lat`/`lon`.
An audit of all eight of its use sites found that **none** of them read `.x`/`.y` — every
one keys off `layerIdx`/`postIdx` alone — so the widening is inert everywhere except the
new coordinate readout. `PendingMarkerDialog` gained optional `lat`/`lon` and renders them
to six decimal places above the name field, showing nothing extra on the raster path.

The sidebar's "located" icon needed fixing too: it tested `post.x !== null && post.y !==
null`, which reads a coordinate-native post — `x: null` by design — as *not placed*. It now
also consults `postGeoPosition`.

**Two consequences the scoping missed, both closed in the same change.**

*A map-placed post was invisible on every raster.* Both raster renderers — the dispatch
modal's (`venuemapmodal.tsx`, in `PostMarker`, `EquipmentMarker`, `TeamMarker`, and the
label-collision pass) and the editor's own (`page.client.tsx`) — read `post.x`/`post.y`
raw. A coordinate-native post has `x: null` by design, so an operator would place a pin on
the map, flip to venue-image view, and watch it vanish *even on a properly georeferenced
venue where its position was derivable the whole time*. Both now resolve through
`postPercentOnLayer`, memoized once per render per layer rather than solving the
georeference once per marker. A `null` result is skipped entirely — no marker, no label, no
`NaN` in a style value, and no clamping to an edge.

*Dragging a coordinate-native post is disabled, deliberately.* The editor's drag handler
writes a new percent back onto the post. Doing that to a post whose record is `lat`/`lon`
would leave the two representations disagreeing, with the percent silently winning on one
screen and the coordinate on another. Moving one correctly means inverse-projecting the
drop point through the layer's georeference and writing *that* back — real work, and out of
scope here. Until then a coordinate-native post renders, hovers and renames normally but
does not drag, and the cursor says so. This is a stated limitation, not an oversight.

#### 10.E(1) — A pre-existing index bug, found while wiring the above — ✅ FIXED (uncommitted)

Not caused by this phase, and worth recording separately because it was **live in
production and silently destructive**.

The editor's raster marker renderer read:

```ts
venueData.layers[currentLayer].posts
  .filter(/* keeps only posts with numeric x AND y */)
  .map((post, idx) => ...)
```

`idx` is the index into the *filtered* array. It was then passed to `renamePost`,
`onMarkerMouseDown`, `draggingIdx`, `hoverId` and the `pendingMarker.postIdx` comparison —
every one of which indexes into the **full** `posts` array. Any post the filter dropped
shifted every index after it.

Dropped posts are not exotic. A text-only location added through the "Locations" field is
`{ name, x: null, y: null }` and is dropped; so is any legacy bare-string post. So on a
layer with a text location listed before a placed marker — the exact shape of the venue in
the 2026-08-19 screenshot — **dragging or renaming a marker acted on a different post than
the one clicked.** A rename silently retitled the wrong location; a drag wrote coordinates
onto it.

Fixed by capturing the original index *before* the filter
(`.map((post, originalIdx) => ({ post, originalIdx, percent })).filter(...)`) and threading
it through every consumer. Coordinate-native posts made this worse — they are dropped from
the raster too — which is how it surfaced, but the bug predates them entirely.

#### 10.E(2) — A no-image venue crashed the dispatch modal's console — ✅ FIXED (uncommitted)

Reported from the running app on 2026-08-19, alongside the "cannot mark locations" report.
`VenueMapWithPosts` rendered `<Image src={mapUrl} />` where `mapUrl` is
`layers[currentLayer]?.mapUrl || ''`. Phase 10 makes "a venue with no image" a *supported*
shape rather than a degenerate one, so that empty string is now reachable by design, and
Next.js logs two errors for it — including a warning that an empty `src` makes the browser
re-download the whole page.

The `<Image>` is now omitted entirely (not handed `null`) when there is no map URL, with a
muted "No venue image for this layer" in its place. `shouldRenderMarkers` already gated on
`imageLoaded && rect.width > 0`, so the no-image path could not produce mispositioned
markers — that part was already correct and was left alone.

#### 10.F — Locating the venue at creation, without assuming internet

Three ways to answer "where is this venue", in ascending cost:

- **Device GPS.** Already built for control-point capture in 8.G (`useDeviceLocation.ts`,
  the "Use my location" control in `GeoreferenceSection`). Correct and free when the
  venue is created on site.
- **Typed coordinates.** A lat/lon pair, which is exactly what IC-EMS already has in a
  spreadsheet column. Trivially implementable and it composes with 11.B's CSV import.
- **Pan and zoom, then capture.** The 8.J "Set default view" flow, live once 10.D lands.

**Recommend against a geocoder search box as the default path.** §8.B's requirement is
that the basemap "degrade to nothing" because stadium connectivity is a premise of this
project, not an edge case; a location search that silently requires internet is a trap
sprung at precisely the moment it is needed, and it would be the only online dependency
in an otherwise offline-first map stack. If one is added later it belongs behind the same
`readBasemapConfig()`-style presence check that already makes the basemap itself optional
— available when configured, absent without error when not.

#### 10.G — Tile coverage is per-venue, and nothing generates it

`scripts/fetch-basemap.sh` extracts **one bounding box** into `public/basemap/venue.pmtiles`
— default `-122.30,37.845,-122.23,37.895`, which is UC Berkeley, at `MAXZOOM=16`, about
5 MB, and gitignored so a fresh clone has no tiles at all. A venue in Bloomington, Indiana
has no coverage whatsoever, and the operator's symptom would be a grey rectangle rather
than an error.

8.I already built the detector — `parseArchiveCoverage`/`isOutsideCoverage` and the
`onCoverageWarning` callback — but in the editor it currently has nowhere to surface.
**Creation is the cheapest possible moment to catch a coverage mistake**, so the warning
belongs in the creation flow as visible text, not a console line. Beyond that this is an
ops question rather than a code one: either a wider archive, or a per-venue extract keyed
to the venue's saved camera, plus a runbook entry. Note the sizing constraint recorded in
the script's own header — archive size grows with *area*, "not much with maxzoom" — so
widening the box is the expensive axis and deepening it is not.

#### 10.H — What this does not solve

In the spirit of §8.E, stated before anyone is disappointed:

- **It does not give floors.** A map-first venue is as flat as a raster one. Multi-level
  is Phase 9 and 9.A still gates it.
- **It does not make a diagram venue geographic.** A hand-drawn floor plan with no
  control points has no coordinates, and this phase adds no way to conjure them.
- **It does not replace the georeferenced raster overlay.** IC-EMS keeps their stadium
  diagram layered *on top of* the basemap for a reason: OSM knows where Memorial Stadium
  is, and does not know where section 24 is. A map-first venue with meaningful interior
  structure will still want a raster overlay eventually — Phase 10 removes the raster as
  a *precondition*, not as a capability.

**Effort:** 10.A none (diagnosis, written). 10.D S and unblocks the most per line changed
— do it first. 10.C M and is the real work of the phase. 10.E S–M but is not separable
from 10.C. 10.F S for GPS and typed coordinates, and explicitly out of scope for a
geocoder. 10.G S in code, ops question otherwise. 10.H none.

**Ordering:** 10.D → 10.C → 10.E is the critical path; 10.F and 10.G are independent and
can land in any order around it. Landing 8.J first (or concurrently) is a prerequisite for
all of it, since the editor has no basemap surface at all until that diff is committed.

**Exit criteria:** an operator can create a venue with no image, see a real map, place
named locations on it that persist with real coordinates, save an opening camera the
venue reopens at, and be told plainly at creation time if the venue falls outside tile
coverage — with every existing percent-only venue continuing to behave exactly as it does
today.

---

### Phase 11 — What IC-EMS actually showed us: GIS interchange and after-action analytics — ⛔ NOT STARTED

**Phase 11 is not the blocking work.** Phase 10 — map-first venue creation, scoped
separately — is what unblocks the operator: it is the difference between a venue that
takes an afternoon of clicking and one that does not exist yet. Phase 11 is what makes
CrowdCAD *legible* to an agency that already lives in ArcGIS, and it is deliberately
sequenced after Phase 10 because every item below depends on venue geometry being
lat/lon-native — a `Post` with only a percentage-of-image `x`/`y` and no coordinate has
nothing to interchange.

#### 11.A — A location taxonomy that survives the round trip

`Post` (`core/src/app/types.ts:1-7`) is today `string | { name, x, y, isClinic? }` — a
flat name and one boolean special case. IC-EMS's 134-row attribute table carries three
separate fields — `Category` (`Gate`, `Facility`, `Lot`), `Subcategory` (`East`, `North`,
`South`, `Interior`, `Purple`), `Label` (`Gate E5`, `NEZ Gate`, `K1`–`K5`) — and none of
it survives a round trip through CrowdCAD's model today: it would all get flattened into
`name`.

Propose an optional structured classification alongside the existing string form —
something in the shape of `classification?: { category: string; subcategory?: string }`
— so nothing that already reads `Post` as `string | { name, x, y }` breaks. The point
worth making plainly: `isClinic` is already a special-cased category sitting beside the
general model rather than inside it, and a real taxonomy should *subsume* `isClinic`
(clinic becomes a `category` value, not a parallel boolean), not add a fourth field next
to it.

**Warn against inventing a CrowdCAD-only vocabulary.** `Purple` is a parking-lot colour
at IU's Memorial Stadium. It means nothing at any other venue, and a hardcoded enum of
`Category`/`Subcategory` values would be wrong the first time this ships to a second
customer. The taxonomy has to be operator-defined per venue — free-text fields with
autocomplete-from-existing-values, not a fixed dropdown — or Phase 11 reproduces the
exact mistake it is trying to interoperate around.

#### 11.B — CSV and GeoJSON interchange, in both directions

**This is the highest-value, lowest-risk item in the phase**, and it should be treated
as such when this phase gets prioritized against Phase 10 and everything else in flight.

Import: a CSV with lat/long/label columns (plus, once 11.A exists, category/subcategory
columns) creates `Post`s directly. This is IC-EMS's own workflow, verbatim — a CSV of
`Lat`, `Long`, `Category`, `Subcategory`, `Label` fed through ArcGIS's `XY Table To
Point` tool to build a feature layer — replayed as a CrowdCAD import instead of an
ArcGIS one. It means a venue with 134 locations does not get hand-clicked into
existence one marker at a time. CSV import is, in fact, the fastest available answer to
"I do not want to place 134 pins by hand," and it substantially substitutes for editor
UI that would otherwise have to be built for bulk placement.

Export: a GeoJSON `FeatureCollection` of posts, calls, and tracks, which ArcGIS Pro
opens natively with no conversion step — this is the mechanism that lets IC-EMS keep
building their season-scale products (§11.E) in the tool they already know, using data
that originated in CrowdCAD.

KML/KMZ is the secondary format worth supporting — it is TAK's own native geographic
container, not just ArcGIS's — and a KMZ/GeoTIFF of the real venue is already an
outstanding ask *from* IC-EMS, tracked as an open item in
`core/docs/TAK_OPEN_QUESTIONS.md` §6 ("Georeferenced venue overlay"). 11.B's export side
and that open question are the same underlying need pointed in opposite directions:
§6 asks CrowdCAD to *consume* a KMZ/GeoTIFF IC-EMS already has of the stadium; 11.B
would let CrowdCAD *produce* one from data it holds.

#### 11.C — Track history, and the honest gap

CrowdCAD stores current team position only — `Staff.position` is a last-known mirror,
and the `positions` collection described in §6.2 is itself throttled and retention-capped
(30 days by default, §8 item 8), not an archive. There is no breadcrumb history anywhere
in the system today.

IC-EMS's per-callsign polylines — full-shift movement traces for `East Stands Row 24`,
`Supervisor`, `Code Truck`, `MR-12 Gator`, and the rest, drawn one colour per callsign
across the entire game — were the single most visually striking thing demonstrated, and
they are pure history: nothing about them exists at any single instant, only as a
trace over time. Building the equivalent means keeping what §6.2 currently throttles
*away* from being kept, which is a direct collision with the write-rate constraint that
section exists to enforce — more positions written, and now durably, is exactly the cost
§6.2 was designed to avoid, not a free add-on to it.

State the storage-cost problem plainly rather than assuming it away: a season of
full-shift tracks at even a modest sample rate, retained rather than expired, is a
different order of data volume than anything else this document has scoped. And track
history is not merely a storage question — a position history that can be joined to a
call (which team responded, tracked minute-by-minute, to which incident) is
PHI-adjacent in exactly the way §8 already treats inbound free text: the position itself
is not clinical data, but the join can reconstruct clinically sensitive context. Any
track-history design needs to sit inside §8's retention and access rules from the start,
not be bolted on after the fact.

#### 11.D — Call symbology by run type

CrowdCAD already has call types; the map does not symbolise pins by them the way
IC-EMS's product does (Medical / Trauma / Other / Intoxication, distinct icon and colour
per class, with counts in the legend). Small and self-contained relative to the rest of
this phase, and it depends on Phase 7's call pins already being on the map at all.

`core/src/lib/statusColors.ts` is the existing centralised colour authority
(`STATUS_COLORS`, `getStatusColor()`) for dispatch UI generally — this should extend
that map with a run-type axis rather than introduce a second, parallel colour system
that the rest of the app does not know about.

#### 11.E — Density surfaces and season-scale review

IC-EMS's heat map ("EMS Calls For Service 2023-2024 — Density of Calls By Area") spans
an entire season across multiple events, not one game. Every other query in CrowdCAD is
scoped to a single event — `Event` is the unit everything else in this document
(§6.2's write path, §6.4's bridge, the org-scoping in Firestore rules) is built around.
A cross-event query is a genuinely new access pattern, not a variant of an existing one,
and it raises its own Firestore-rules and org-scoping questions: which org members can
see aggregate call data across events they did not personally staff, and whether that
aggregate view needs the same PHI discipline §8 applies to a single call.

**This is the largest and least urgent item in the phase.** A defensible first version
is not CrowdCAD reimplementing kernel density estimation — it is the GeoJSON export from
11.B, applied across events, letting IC-EMS keep doing this analysis in ArcGIS Pro with
data CrowdCAD supplied. Building an in-app density surface is a legitimate later
ambition, not a first cut.

**Effort:** 11.A is S–M and is a prerequisite for the category/subcategory columns in
11.B's import, though 11.B's lat/long-only import works without it. 11.B is S for CSV
import, M for GeoJSON/KML export (S if scoped to posts only; M once calls and tracks are
included). 11.C is L, blocked on resolving its conflict with §6.2's write-rate
constraint before any storage design is written, and its access-control design is
blocked on §8. 11.D is S and depends only on Phase 7. 11.E is L, and its honest first
version (export-only) is closer to S once 11.B exists.

**Exit criteria:** A venue with 100+ locations can be created from a CSV without manual
pin placement (11.B); a `Post` can carry an operator-defined category without breaking
existing string-form posts (11.A); posts, calls, and tracks can be exported as GeoJSON
and opened in ArcGIS Pro without a conversion step (11.B); call pins are colour- and
icon-coded by run type using `statusColors.ts` (11.D). Track history (11.C) and
cross-event density (11.E) are explicitly not required for this phase to be called done
— they are the two items where the honest scope is "designed and sequenced," not
"shipped."

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

**Inbound pins keep the device's UID; they never borrow CrowdCAD's namespace.** A pin
accepted into a call is republished under `crowdcad.{eventId}.call.{callId}` like any
other call, and the originating device UID is retained only as
`CallPosition.takUid` provenance (§5.2). Two reasons this matters, both load-bearing:

1. Echo suppression is a prefix test on `crowdcad.` (§2.5). A pin that entered under a
   device UID and left under a CrowdCAD UID is correctly filtered on the way back in;
   one that kept the device UID on republish would be filtered on the way *out* of the
   bridge's perspective and could round-trip.
2. The originating device still owns its own marker. CrowdCAD publishing a *second*
   marker at the same point under a different UID is correct and expected — one is "a
   responder marked this spot", the other is "dispatch opened a call here". Collapsing
   them would let CrowdCAD silently mutate a marker it does not own.

### 7.3 Type codes — **verify before trusting**

| CrowdCAD entity | Proposed CoT type | Confidence |
|---|---|---|
| Staff team | `a-f-G-U-C` (friendly ground unit) | High — standard for personnel/teams |
| Supervisor | `a-f-G-U-C` + `role="Team Lead"` in `__group` | High |
| Post (static) | `b-m-p-w` (waypoint) | Medium |
| Call / incident | `b-r-f-h-c` (CASEVAC / 9-line) or a generic point | **Low — verify** |
| Emergency beacon | `b-a-o-tbl` / `b-a-o-pan` / `b-a-o-can` | Medium |

**Status 2026-08-16:** ⛔ spike STILL NOT run — in *either* branch (see §0.45; the
sibling effort's "verified end to end" refers to a home-made Leaflet viewer, not a
TAK client, and does not settle this). The candidate codes are committed as constants
in `src/lib/tak/types.ts`, each annotated with its confidence level and sitting behind
a prominent UNVERIFIED warning. `mapping.ts` now consumes them, but nothing
*transmits*: `COT_TYPE_CODES_VERIFIED = false` rides on every `MappingResult`, and the
feed route and bridge are required to refuse transmission while it is false (§0.3(10)).

The spike's deliverable is concrete and small: publish one marker of each candidate
type, look at the icons on a real client, correct the constants, resolve `b-m-p-w`
vs the sibling branch's `b-m-p-s-m`, flip `COT_TYPE_CODES_VERIFIED` to `true`, delete
the warning. The equipment now exists — §0.45.

**Added 7th observation, for Phase 7.D:** *drop a pin by hand in iTAK and record the
CoT type it emits.* This is the same `b-m-p-w` vs `b-m-p-s-m` question from the other
direction, and answering it is the whole gate on inbound pin-drop. It costs one line on
a sheet somebody is already holding a phone to fill in. Record the answer as a named
constant next to the others, because the bridge must be able to tell a hand-dropped pin
from a self-reported position — today it cannot, and misfiles the former as the latter
(Phase 7.D). Note the type may differ between iTAK and ATAK-CIV; capture both if both
are on hand, since the bridge has to accept either.

**The harness now exists too** — `dev/freetakserver/spike-typecodes.mjs`, written
this session. It was the missing half nobody had noticed: the spike was described
for months as "one afternoon with a phone", but nothing in either branch could
publish a marker of a caller-chosen type code. `seed-berkeley.py` sends a fixed
set; the bridge only ever emits its own announce; `b-m-p-w` and `b-r-f-h-c` — the
two codes the spike exists to settle — appeared nowhere in `dev/` at all. The
afternoon with the phone could not have happened. See §0.3(30).

What it does, and why each part is the way it is:

- Publishes one marker per candidate over plain TCP 8087, laid out on a grid
  (default 150 m spacing) so they are individually clickable at a normal zoom.
- **The callsign IS the type code** (`03 b-m-p-w`), so the observer can identify a
  marker from the label without cross-referencing anything while holding a phone.
- Prints the **expected** rendering next to a blank for the **observed** one. An
  observation sheet that only asks "what do you see" invites recording what you
  expected to see.
- Includes a **control**: `a-h-G-U-C` (hostile), which must render as a red diamond
  obviously distinct from `team`. If the control renders the same as `team`, the
  client is not doing symbol lookup by type and every other answer on the sheet is
  meaningless. The checklist says to check it first.
- Imports core's real `buildCotXml` and the real constants from `types.ts` rather
  than reimplementing them, so it cannot drift from the thing it verifies — the
  first time §1.1's purity constraint has actually been cashed in (§0.3(31)).
- Opens a **second client before publishing** and reports which of its own markers
  came back. Without this, a silent relay failure is indistinguishable from a bad
  type code — which is not hypothetical; it is the state the local server was found
  in this session (§0.3(34)).
- Carries a **stop the bridge first** warning, because a running bridge writes a
  `tak_positions` record for every `a-*` and `b-m-p-*` marker it sees, matched team
  or not (§0.3(33)).

Emergency beacons are behind `--include-beacons` and off by default: on a real
client they can raise alarm UI. Verified end-to-end in `--dry-run`; the live run
still needs a phone.

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

9. **Inbound free text is a PHI carrier, and §8 previously only looked outward.**
   Every rule above governs what CrowdCAD *publishes*. Phase 7.D opens a channel in the
   other direction: a hand-dropped pin in iTAK carries an operator-typed label and
   remarks, and a responder standing over a patient will type what they see. That text
   arrives from a device on a volunteer-managed fleet, over a channel other agencies may
   also be on, and lands in CrowdCAD's datastore.

   Consequences, all of which belong in Phase 7.D rather than being discovered later:

   - `TakPinReport.label` / `.remarks` are **untrusted input**, stored for a dispatcher
     to read and never auto-copied into any `Call` field. The accept action requires a
     human to type the chief complaint (Phase 7.D) — that requirement is a PHI boundary,
     not merely a data-quality one.
   - A pin's remarks must **never be echoed back out** in a republished call marker.
     `applyRedaction` already rebuilds output remarks from an allowlist and discards
     input remarks wholesale (§0.3(6)); that behaviour now protects against inbound text
     as well as a future upstream mapping bug, and the redaction test's worst-case
     simulation should gain an inbound-sourced case.
   - Pin reports need the **same retention treatment as positions** (item 8): dismissed
     and accepted reports should not outlive the event.
   - Per `core/CLAUDE.md`, no `console.*` of these fields. The bridge is the most likely
     place to violate this, because its whole debugging idiom is logging what it
     received — and it runs with `--verbose` in exactly the situations where somebody is
     watching output.

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
| 1 — read-only feed | 🟡 1.1–1.2 done | M | 0 + KML spike | One URL into WinTAK, live-ish picture |
| 2 — bridge | 🟡 inbound ✅, outbound ⛔ | L | 1 + type-code spike | Real-time CoT both directions |
| 3 — inbound + dispatch map | ✅ | M | 2 (inbound half) | Field positions on the dispatch board |
| 4 — field PWA | ⛔ | L | 3 (schema only) | **The thing IC-EMS actually needs** |
| 5 — ops docs | ⛔ | S | 2 | Deployers can self-serve |
| 6 — ATAK plugin | ⛔ deferred | XL | — | Revisit after a full season |
| **7 — call pins + coordinate-first map** | 🟡 7.A–7.C, 7.E(1), 7.E(2) ✅ | **M** | **0 only** (7.D also on spike b) | **Calls have real positions, in both directions** |
| **8 — a real basemap** | 🟡 8.A–8.F ✅ + visually verified (uncommitted), 8.G partial | **M–L** | **nothing** | A map with context under the venue raster, offline-capable |
| **9 — multi-level venues** | ⛔ NOT STARTED | **M** | 9.A nothing; 9.C(ii) on 8 | Floors modelled, filterable in TAK, stackable in CrowdCAD |

**Phases 7, 8 and 9 are the exception to the "everything is gated" reading of this
table.** 7.A–7.C and 7.E depend on Phase 0, which is done; only 7.D waits on spike (b).
**Phase 8, added and then largely built 2026-08-18, depended on nothing at all** — no
phone, no spike, no IC-EMS answer — shipped the same day, and was visually verified
working in a browser later the same day after four bugs were found and fixed (all still
uncommitted; §0.1, §0.5, §8.H). Phase 9 still depends on nothing and is still unbuilt. 7.E(2) was a latent data-integrity
bug rather than a feature (swapping a venue image silently moved every post), which is
why it was done regardless of the TAK schedule; the same argument does not apply to 9,
which is genuinely new capability and should be sequenced against IC-EMS's priorities
rather than the plan's.

⚠️ **Phase 8 reverses a decision §2.2 and §7.E both recorded.** The table above is not
the place to argue it — see §0.6.2 and §0.3(53) — but a reader working from this table
alone should know the refusal exists and has been overridden, not overlooked.

**Spike status — both still outstanding, and they are now the critical path:**

| Spike | Gates | Status |
|---|---|---|
| (a) KML network-link support on WinTAK / ATAK-CIV | `kml.ts`, feed route (1.3) | ⛔ NOT RUN |
| (b) CoT type-code icon rendering | transmission of anything `mapping.ts` produces | ⛔ NOT RUN |

Neither needs a development environment — they need a TAK client and a test server,
**and as of §0.45 both now exist on this machine**: a Dockerized FreeTAKServer and a
working TLS iTAK data package on `feature/tak-integration`. What is missing is a
person with a phone and an afternoon.

Spike (b)'s gate moved on 2026-08-16. It used to block `mapping.ts` from being
written at all; it now blocks only *transmission*, enforced by
`COT_TYPE_CODES_VERIFIED` (§0.3(10)). Phase 1 can therefore proceed as far as the
event-settings UI (1.4) without it — but not one step past that.

**If the season is short and only one thing ships: Phase 0 + Phase 4.** That
delivers the operational need — field providers reporting status without radio —
and leaves the TAK export as a follow-on that reuses everything already built.

---

## 13. File manifest

✅ = landed as of 2026-08-16. Unmarked = still outstanding.

New:

```
✅ src/lib/tak/types.ts                    CoT domain model, COT_UNKNOWN, candidate type codes
✅ src/lib/tak/cot.ts                      escapeXml, formatCotTime, buildCotXml, parseCotXml
✅ src/lib/tak/uid.ts                      deterministic UID helpers + echo-suppression test
✅ src/lib/tak/redaction.ts                applyRedaction — the PHI allowlist
✅ src/lib/tak/mapping.ts                  eventToCotEvents — Event+Venue -> CoT markers
✅ src/lib/tak/settings.ts                 defaults, withTakDefaults, skip-reason presentation (§1.4)
✅ src/lib/__tests__/tak/{cot,uid,redaction,mapping,settings}.test.ts
✅ src/lib/takInterpolation.ts             arc-length tween along a position's `path` (inbound)
✅ src/hooks/useTakTween.ts                drives the tween in map percentages, never pixels
✅ src/hooks/useTakPositions.ts            live position subscription for the dispatch map
✅ src/components/event-create/TakSection.tsx   the §1.4 settings panel; renders MappingResult.skipped
✅ docs/TAK_INTEGRATION_PLAN.md            this document, moved here from the root wrapper
   src/lib/tak/kml.ts                      gated on the §1.5 KML spike
   src/app/api/tak/[eventId]/feed.kml/route.ts   MUST honour typeCodesVerified — §0.3(10)
   src/app/api/tak/[eventId]/feed.cot/route.ts   MUST honour typeCodesVerified — §0.3(10)
   docs/TAK_DEPLOYMENT.md
   tests/e2e/features/{tak-config,tak-positions}.feature
```

Phase 7 (call pins + coordinate-first map) — new:

```
   src/lib/callPosition.ts                 resolve a lat/lon to a layer + percent coords;
                                           containment tests, version-staleness check (7.A, 7.E)
   src/lib/__tests__/callPosition.test.ts  pure, so it gets the same vitest treatment as geoUtils
   src/components/dispatch/CallMarker.tsx  status-coloured via getStatusColor() — 7.B
   src/components/dispatch/OffMapIndicator.tsx  edge bearing/distance affordance — 7.E(1)
   src/components/dispatch/PinReviewQueue.tsx   accept/dismiss inbound pins — 7.D
```

Phase 7 — modified:

```
   src/app/types.ts                                     CallPosition, Call.position, TakPinReport (§5.2)
   src/lib/tak/mapping.ts                               buildCallEvent prefers call.position — 7.C
   src/components/modals/event/venuemapmodal.tsx        placement mode, CallMarker, off-map indicators
   src/components/modals/event/quickcallmodal.tsx       optional drop-pin; free text STAYS primary — 7.B
   src/lib/geoUtils.ts                                  containment / inverse-solve helpers if not already covered
   firestore.rules                                      tak_pin_reports, mirroring positions (§5.1)
   scripts/setup-pocketbase.js                          tak_pin_reports collection
```

Phase 7 — modified in the **root wrapper** (the inbound half):

```
   dev/crowdcad-tak-bridge/cot.js          SPLIT a-* (position) from b-m-p-* (map pin) — 7.D.
                                           BEHAVIOUR CHANGE: pins are misfiled as positions today.
   dev/crowdcad-tak-bridge/cot.test.js     the classification tests that encode the old behaviour
   dev/crowdcad-tak-bridge/bridge.test.js  ditto — the change must be visible in the diff
   dev/crowdcad-tak-bridge/pocketbase.js   write tak_pin_reports, separate from tak_positions
```

In the **root wrapper** repo, not `core` (see §0.45 — this is the inbound half,
and it is a standalone Node sidecar rather than part of the Next.js app):

```
✅ dev/crowdcad-tak-bridge/**              bridge.js, cot.js, georef.js, pocketbase.js + their .test.js
✅ dev/freetakserver/**                    Dockerized FTS, cert tooling, iTAK TLS package, probe scripts
✅ dev/TAK_DECISIONS.md                    load-bearing constraints — core/CLAUDE.md says read this first
✅ dev/TAK_INTEGRATION_PLAN.md             the RIVAL plan doc — different phase numbering, see §0.45
```

**Never commit** `dev/freetakserver/certs-export/`, `fts-itak-tls.zip`, or
`fts-local-tcp.zip` — they contain a private CA key that can mint client
certificates the server will trust. They are gitignored; keep it that way.

Phase 8 (basemap, §8.F/§8.G) — new. **✅ (uncommitted)** below means built and
type-checked/tested this session per §0.1, but not yet `git add`-ed — distinct from
the ✅ = "landed as of 2026-08-16" legend at the top of this section:

```
✅ (uncommitted) src/lib/basemap/config.ts                 PMTiles URL config, presence check, degrade-to-nothing gate — §8.B
✅ (uncommitted) src/lib/basemap/style.ts                  buildBasemapStyle() — base/raster/labels layer order — §8.C.
                                                            Also holds absoluteUrl(), added during §8.H verification to fix
                                                            sprite/glyph URLs — §0.3(60)
✅ (uncommitted) src/components/dispatch/BasemapView.tsx   the second, selectable map view — §8.D. Accepts an unwired
                                                            `deviceLocation` prop for the §8.G self-marker — see below.
                                                            Also fixed during §8.H verification: container sizing
                                                            (§0.3(61)) and constructor-time camera bounds, which removed
                                                            reducedMotionEnabledRef as dead code (§0.3(62))
✅ (uncommitted) src/hooks/useDeviceLocation.ts            navigator.geolocation wrapper, exposes coords.accuracy — §8.G
✅ (uncommitted) src/lib/__tests__/basemap/config.test.ts  30 tests
✅ (uncommitted) src/lib/__tests__/deviceLocation.test.ts  11 tests
   scripts/fetch-basemap.sh                                builds public/basemap/ (gitignored) — not a source file,
                                                            listed here for completeness; nothing it produces is committed
```

Phase 8 — modified:

```
✅ (uncommitted) src/lib/geoUtils.ts                                      layerImageCorners(transform) — §8.C
✅ (uncommitted) src/lib/__tests__/geoUtils.test.ts                       dedicated layerImageCorners tests — §8.C
                                                                          (Mercator-conformance is covered separately by
                                                                          the pre-existing geoUtils.mercator-conformance.test.ts)
✅ (uncommitted) src/lib/callPositionUtils.ts                             placeCallPinFromLatLon() — §8.F basemap-side writer
✅ (uncommitted) src/components/modals/event/venuemapmodal.tsx           raster/basemap view toggle; the 8.F gate,
                                                                          `effectiveBasemap || currentLayerCalibrated`
                                                                          (equivalent to the planned
                                                                          `viewMode === 'raster' && !currentLayerCalibrated`).
                                                                          Does NOT wire `deviceLocation` into BasemapView — §8.G gap
✅ (uncommitted) src/components/venue-management/GeoreferenceSection.tsx  "Use my location" + accuracy display — §8.G
✅ (uncommitted) src/app/(main)/venues/management/page.client.tsx         wiring for the above; also fixes a pre-existing bug
                                                                          where buildGeoreferenceForSave silently dropped
                                                                          ControlPoint.accuracy on save
✅ (uncommitted) src/app/types.ts                                         ControlPoint.accuracy — §8.G
✅ (uncommitted) package.json                                             BOTH root and core — maplibre-gl (pinned ^5.24.0,
                                                                          NOT 6.x — §0.3(59)), pmtiles, @protomaps/basemaps
✅ (uncommitted) .gitignore                                               BOTH root and core — public/basemap/, .cache/
```

**Correction, 2026-08-19.** Every `✅ (uncommitted)` marker in the two Phase 8 blocks
above is now stale: those files landed in `0e030bc`. They are left as written so the
session history reads honestly, but read them as committed. The 8.I entries below are
committed; only the 8.J entries are genuinely still uncommitted.

Phase 8 — §8.I and §8.J:

```
✅ src/app/types.ts                                       BasemapCamera, Venue.basemapCamera — §8.I (`b6d3dc9`)
✅ src/components/dispatch/BasemapView.tsx                initialCamera prop (`b6d3dc9`); the 4-level resolution call and
                                                           onCoverageWarning (`a78421a`) — §8.I
✅ src/lib/basemap/camera.ts                              resolveInitialCamera(), parseArchiveCoverage(),
                                                           coverageToPoints(), isOutsideCoverage() — pure, §8.I (`a78421a`)
✅ src/lib/__tests__/basemap/camera.test.ts                22 tests — §8.I (`a78421a`)
✅ src/components/modals/event/venuemapmodal.tsx          basemapCamera prop threaded into BasemapView as
                                                           initialCamera — §8.I (`a78421a`)
✅ src/app/(main)/events/[eventId]/dispatch/page.tsx      event.venue.basemapCamera threaded to both the main map and
                                                           Quick Call's draft-pick picker — §8.I (`a78421a`)
✅ src/app/(main)/venues/management/page.client.tsx        raster/basemap toggle ported into the editor;
                                                           "Set default view"/"Clear default view"; EDITOR_VIEW_MODE_
                                                           STORAGE_KEY — §8.J (`40342f5`)
✅ src/lib/basemapCameraUtils.ts                           sanitizeBasemapCameraForSave() — §8.J (`40342f5`)
✅ src/lib/__tests__/basemapCameraUtils.test.ts            4 tests — §8.J (`40342f5`)
✅ src/components/dispatch/BasemapView.tsx                 onCameraChange, fired on moveend + once on ready;
                                                           removed the type cast at the editor call site — §10.D (`40342f5`)
```

**Dependency decision:** MapLibre GL JS, pmtiles 4.x, `@protomaps/basemaps` 5.x —
**now actually installed in both `package.json` files, confirmed 2026-08-18** (see
§0.1, §0.5), reversing the "absent, confirmed again today" finding in §0.6.6, which
was accurate only as of when it was written earlier the same day. **`maplibre-gl` was
first installed at `^6.4.1` and then downgraded to `^5.24.0` after visual verification
found 6.x silently breaks vector tile loading (§0.3(59), §8.A, §8.H) — 6.x must not be
reintroduced.** Tiles are a local
PMTiles extract under `public/basemap/` (gitignored), configured by
`NEXT_PUBLIC_BASEMAP_PMTILES_URL`, absent by default — per §8.B, the basemap degrades to
nothing when that variable is unset, and no asset bundle is committed, so a fresh clone
still renders nothing until `scripts/fetch-basemap.sh` is run and the env var is set.

Modified:

```
✅ src/app/types.ts                                  TakPublishSettings, TakPosition/TakPositionRecord, takCallsign, Event.tak
✅ src/lib/geoUtils.ts                               georeferenceResiduals + threshold constants (Phase 0.3)
✅ src/lib/__tests__/geoUtils.test.ts                residual tests
✅ src/app/(main)/venues/management/page.client.tsx  derived lat/lon readout (Phase 0.2)
✅ src/components/venue-management/GeoreferenceSection.tsx  residual readout (Phase 0.3)
✅ src/app/(main)/events/[eventId]/create/page.tsx   TAK tab hosting TakSection (§1.4)
✅ src/app/(main)/events/[eventId]/dispatch/page.tsx position overlay
✅ src/components/modals/event/addteammodal.tsx      Staff.takCallsign device binding
✅ core/CLAUDE.md                                    the TAK / live GPS positions section
   firestore.rules                                   tak_positions collection — deferred to Phase 2/3, see §0.2
   scripts/setup-pocketbase.js                       tak_positions collection — deferred to Phase 2/3
   docker-compose.yml                                opt-in tak-bridge service
   docs/ARCHITECTURE.md                              document the bridge boundary
```
