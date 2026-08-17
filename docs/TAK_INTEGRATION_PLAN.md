# TAK Integration — Implementation Plan

**Status:** In progress — Phase 0 complete, Phase 1.1–1.2 and 1.4 complete, inbound bridge complete, 1.3/1.5 blocked, **Phase 7 (call pins + coordinate-first map) newly scoped and mostly unblocked** (see §0)
**Target:** CrowdCAD (`core/`), general-purpose capability; IC-EMS is the first deployer
**Author:** drafted 2026-08-11
**Last updated:** 2026-08-17
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
| **7.B** | **Pin-drop UI: placement mode + drag-to-correct + clear on `venuemapmodal.tsx`, a `CallMarker` coloured through `getStatusColor()`, an optional draft-pin affordance on Quick Call, and the new pure `src/lib/callPositionUtils.ts` (`placeCallPin` refuses on an uncalibrated layer; `resolveCallPinPercent` re-derives x/y from the layer's current transform on every read). `Call.position` finally has a writer. 20 new tests, suite 173 → 193** | **Done** | `4dc00c8` |

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

### 0.4 Recommended next steps, in order

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

1c. **Phase 7.E(1) — off-map edge indicators. ← START HERE.** Now unblocked: 7.B has
    landed, so the file contention below is gone, and this is **the last unblocked item
    in Phase 7** (7.D's remaining half needs a phone). Both edit
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
- **Stopped here:** 7.E(1) is now the only unblocked item in Phase 7 and is next
  (§0.4(1c)) — note it must now cover **two** off-map populations, teams *and* call pins.
  The root wrapper's `core` submodule pointer is still unbumped, deliberately held so it
  is one pointer move.
- `COT_TYPE_CODES_VERIFIED` remains **false**. Nothing transmits. **Not pushed.**

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
- **A real basemap for CrowdCAD's own map.** Georeferencing a venue image (Phase 0)
  gives every placed thing a true lat/lon, and Phase 7 makes calls first-class in that
  coordinate space. Neither turns the venue map into a GIS: there are no OSM/satellite
  tiles, no vector layers, and no panning beyond the image. The raster stays the
  backdrop; what changes is that coordinates — not pixels — become the system of record.
  Anyone who hears "the map is dynamic now" and pictures Google Maps has the wrong
  picture. Phase 7.E says what it would actually take.
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
> 7.E(1) ⛔ (now the only unblocked item left in Phase 7) · 7.E(2) ✅ `47157a4` +
> `dbb7dce` + `a46de5c`. The text below is the original scoping and is kept as
> written; each sub-item carries its own status line. Per-decision notes in
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

   ⛔ **Still open (7.E(1)).** Sequenced after 7.B — both edit `venuemapmodal.tsx`. Two
   constraints when it is picked up: the indicator must carry **bearing *and* distance**
   (an arrow alone says "not here" without saying where, which is today's state), and it
   must **not clamp** the marker onto the image edge — a clamped dot is precisely the lie
   `onMap: false` exists to prevent.
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

**Explicitly not in scope: a real basemap.** No OSM/satellite tiles, no vector layers,
no panning beyond the image. Georeferencing yields coordinates, not a GIS. Tiles would
mean a tile source and its licensing, an offline story (stadium connectivity is a
premise of this project, not an edge case), and reconciling a projection with
`geoUtils`'s deliberately flat tangent-plane model, whose venue-scale assumption is
documented at `METRES_PER_DEGREE_LATITUDE`. That is its own project. Recorded here so
nobody reads "coordinate-first map" as a promise of one — §2.2 exists for exactly this
kind of expectation-setting.

**Effort:** 7.A S, 7.B M, 7.C S, 7.D M (behaviour change plus a review-queue UI), 7.E M.
7.E(1) and 7.E(2) are independently shippable and improve the map whether or not calls
ever get pins.

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
| **7 — call pins + coordinate-first map** | ⛔ | **M** | **0 only** (7.D also on spike b) | **Calls have real positions, in both directions** |

**Phase 7 is the exception to the "everything is gated" reading of this table.** 7.A–7.C
and 7.E depend on Phase 0, which is done; only 7.D waits on spike (b). It is therefore
the one place where a session with no phone and no IC-EMS response can do substantial
work — and 7.E(2) is a latent data-integrity bug (swapping a venue image silently moves
every post), not a feature, which argues for doing it regardless of the TAK schedule.

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
