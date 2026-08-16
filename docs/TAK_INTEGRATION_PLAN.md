# TAK Integration — Implementation Plan

**Status:** In progress — Phase 0 complete, Phase 1.1–1.2 complete, inbound bridge complete, 1.3–1.5 blocked (see §0)
**Target:** CrowdCAD (`core/`), general-purpose capability; IC-EMS is the first deployer
**Author:** drafted 2026-08-11
**Last updated:** 2026-08-16
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

Everything in the first block above (rows through the vitest harness) was built in
earlier sessions and sat **uncommitted** on `feature/tak-georeference`; the first act
of the 2026-08-15 session was to commit it as `9fe8de6` so it could not be lost and
so an isolated branch could be cut from it.

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

**~~What is safe to start right now~~ — the event-settings UI (§1.4) — was built
2026-08-16.** It is no longer available as the answer to this question, and that
changes the shape of the project: *every remaining item in this plan is now gated
on something that is not typing.* Three of the four are one afternoon with a phone;
the fourth is an email to IC-EMS. Nobody is blocked on a hard technical problem.

If you have arrived here looking for code to write and cannot run a spike, the
honest answer is that there is very little left that is both safe and useful, and
the temptation to build the feed route "ready for when the spike lands" should be
resisted for the reason §1.5 gives in its own text: the spike may return "network
links are unreliable on the target release", which changes what the feed route
*is*. Writing it first means writing it twice. Better uses of a session with no
hardware: turn the §11 open questions into a written list for whoever can answer
them, or reconcile the two georeference models (§0.3(19)) — the one piece of real
technical debt the merge knowingly left behind.

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

- **Two georeference models coexist.** `core/src/lib/geoUtils.ts` (control points →
  least-squares affine, with a 25 m residual gate) and the bridge's `georef.js`
  (image-percentage projection). They are not in conflict at the code level — nothing
  imports both — so the merge did not force a choice. One should eventually win, and
  the affine solver is the better-specified of the two, but that is Phase 2/3 work and
  it is not urgent.
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
| 1 — read-only feed | 🟡 1.1–1.2 done | M | 0 + KML spike | One URL into WinTAK, live-ish picture |
| 2 — bridge | 🟡 inbound ✅, outbound ⛔ | L | 1 + type-code spike | Real-time CoT both directions |
| 3 — inbound + dispatch map | ✅ | M | 2 (inbound half) | Field positions on the dispatch board |
| 4 — field PWA | ⛔ | L | 3 (schema only) | **The thing IC-EMS actually needs** |
| 5 — ops docs | ⛔ | S | 2 | Deployers can self-serve |
| 6 — ATAK plugin | ⛔ deferred | XL | — | Revisit after a full season |

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
