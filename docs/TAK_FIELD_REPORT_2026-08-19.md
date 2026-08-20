# TAK field report — 2026-08-19, and the plan to close it

**Status:** ✅ **CLOSED 2026-08-19.** §B decided **Option B (PocketBase)**; Stages 0,
1, 3 and 4 are built, Stage 2 is superseded by that decision, and Stage 5 is scoped
but deliberately not started. **One gate remains open — see the banner below.**
**Author:** drafted 2026-08-19 from three reports against the running app.
**Branch:** `feature/tak-integration` (both repos).
**Baseline at drafting:** `core` clean at `6b42e79`; `npm run type-check` clean;
`npm run test:unit` **361 passed across 16 files**. (§0.1's last recorded figure
was 260 — the tracker is behind the suite as well as behind the tree.)
**At close:** `type-check` clean in both repos, root `npm run build` green,
`npm run test:unit` **372 passed across 17 files**, bridge suite **29 passed**.
**Outcome is recorded in `TAK_INTEGRATION_PLAN.md` §0.7**, which is the live document.
This file is now history — read §0.7 for what is true.

> ### ⚠️ Stage 0 is still open, and it is the thing that matters
>
> Working §C turned up a **tenth root cause the diagnosis missed: the
> `tak_positions` collection does not exist on the running PocketBase instance.**
> §A.1 verified the bridge was *running*; it never verified a write *landed*. A live
> process, an ESTABLISHED socket and arriving CoT are all consistent with persisting
> nothing — which is exactly what has been happening.
>
> **Option B alone would not have produced a moving marker.** Two things are still
> required, and neither could be done in this session:
>
> 1. Create the collection — needs PocketBase superuser credentials:
>    `PB_ADMIN_EMAIL=… PB_ADMIN_PASSWORD=… node core/scripts/setup-pocketbase.js`
> 2. Then run Stage 0.1 for real — a phone, the bridge's live event, a marker
>    observed to move. **Nothing below is field-verified until that is recorded.**
>
> The bridge now refuses to start when the collection is missing, so this specific
> failure is loud from here on rather than silent.

---

## A. What was reported, and what is actually true

Three reports came in from the running app. All three are real. Two of them are
not the bug they look like from the outside, which is the reason this section
exists before the plan does.

| # | Reported | Actually |
|---|---|---|
| 1 | "Set default view isn't obviously working in venue manager" | The button works and saves nothing. It stages local React state that only reaches Firestore on the venue's main Save, with no feedback at either step. |
| 2 | "Can't edit teams after creation; want a TAK callsign at event creation" | Team editing exists on the **dispatch** page and does not exist on the **create** page. `AddTeamModal` already renders a TAK callsign field — the create page just never passes the props. |
| 3 | "Don't see myself on the map; no location or call markers in iTAK" | Two unrelated causes. Inbound works end-to-end into **PocketBase** while the app reads **Firebase**. Outbound has never existed — there is no code that transmits CoT to a TAK server. |

### A.1 Live diagnostics (verified on this machine, 2026-08-19)

These were run against the actual running system, not read from code.

- FreeTAKServer container `fts` is **up and healthy**. `8087` (plain TCP) and
  `8089` (TLS) are both open and reachable on `100.121.27.41`. The iTAK
  connection to `8089`/SSL is correct and is not the problem.
- FTS's REST API on `19023` is published as `127.0.0.1:19023` — **loopback
  only**. Anything that publishes to FTS over REST must run on this host.
- The bridge **is running**: `node bridge.js --event-id l9ecpuf1ag0cvzy --verbose`,
  started Thursday evening, holding an **ESTABLISHED** TCP connection to
  `127.0.0.1:8087`. It is receiving CoT.
- The bridge authenticated to PocketBase successfully. It exits at
  `bridge.js:459` when `PB_EMAIL`/`PB_PASSWORD` are absent and at
  `refreshEventContext()` when the event is missing, so the fact that it is
  still alive proves both the credentials and the event record exist.
- PocketBase container is up (6 days), healthy on `:8090`.
- The app is configured for **Firebase**. Neither `.env.local` nor
  `core/.env.local` sets `NEXT_PUBLIC_BACKEND`, so `factory.ts:13` resolves
  `dbService` to `FirebaseDbService`.
- The bridge was launched with **no `--bind` flag**, so callsign matching falls
  through to `Staff.takCallsign`, then exact team-name match (`bridge.js:411`).

### A.2 Root causes

**RC-1 — Backend mismatch. This is why you don't see yourself.**
`useTakPositions.ts:129` subscribes to `tak_positions` through the
backend-agnostic `dbService`, which is Firebase. The bridge writes
`tak_positions` **only** to PocketBase — `pocketbase.js` contains no Firebase
code path, and the bridge README says so outright ("Only the write step is
backend-specific; `pocketbase.js` is the seam to reimplement"). Positions are
landing in a database the browser never queries.

**RC-2 — Firestore has no `tak_positions` rule, and the failure is silent.**
`firestore.rules` scopes everything to `organizations/{orgId}`, `venues`,
`events`, `users`, `liteModeInterest`. There is **no `tak_positions` match
block**, and Firestore denies by default. So even after RC-1 is fixed, the
subscription would be permission-denied — and `useTakPositions.ts:141-145`
swallows the error and calls `setRecords([])`, with a comment that explicitly
treats a missing collection as normal on Firebase. A denied read and "nobody is
transmitting" are indistinguishable in the UI. **This masked RC-1 and would mask
its fix.**

**RC-3 — There is no outbound path at all. This is why iTAK shows nothing.**
`eventToCotEvents()` (`mapping.ts:359`) has exactly one non-test caller:
`TakSection.tsx:152`, which uses it to render a read-only preview panel. There
is no `/api/tak` route, no `kml.ts`, no socket or TLS client anywhere in
`core/src`. The bridge's only `socket.write()` (`bridge.js:673`) is the one-time
self-announce FTS requires before it will relay. Location markers and call
markers are not broken — **that feature has never been built.** This is the gap
the plan already calls "the round trip" (§0.6.4) and names the largest in the
project.

**RC-4 — "Set default view" is stage-only, silent, and hidden.**
`handleSetDefaultView` (`page.client.tsx:327`) mutates local state and nothing
else. The camera reaches the backend only via the venue's main Save
(`page.client.tsx:1235`), which itself gives no success feedback and navigates
away. The buttons render only inside the basemap branch
(`page.client.tsx:1608-1713`), while the editor defaults to **raster** view for
any venue that already has a map image (`page.client.tsx:280`) — so on a
calibrated venue the control is hidden behind a toggle with no on-screen hint.

**RC-5 — `<ToastContainer />` is mounted nowhere.** `react-toastify@11` is a
dependency of both repos and there are 24 `toast.*()` call sites in `core/src`,
but only the CSS is imported (`core/src/app/layout.tsx:3`). **Every toast in the
dispatch dashboard today renders nothing.** This is a pre-existing live bug,
unreported, and it is a prerequisite for any toast-based fix to RC-4.

**RC-6 — Team editing is missing on the create page only.** The dispatch page
has a complete flow: `handleEditTeam` (`dispatch/page.tsx:632`),
`handleSaveEditedTeam` (`:650`) including rename propagation through
`calls[].assignedTeam`/`detachedTeams`, and two `AddTeamModal` mounts. The
create page has `mode="create"` hardcoded (`create/page.tsx:822`), delete-only
affordances in `TeamStaffingSection.tsx:69`, and no edit state at all.

**RC-7 — TAK callsign is unwired at event creation, not unbuilt.**
`AddTeamModal` renders the TAK Callsign input whenever `setTakCallsign` is
passed (`addteammodal.tsx:147`). The create page's mount never passes it, and
`handleAddTeam` (`create/page.tsx:283`) never puts `takCallsign` on the `Staff`
object it constructs.

**RC-8 — Teams have no stable id.** `Staff` (`types.ts:331`) is keyed by the
`team` name string; there is no `id`. Every edit path must rename-propagate.
This constrains RC-6's fix and is called out here so it is not rediscovered.

**RC-9 — Supervisors never render on the map.** `venuemapmodal.tsx` has zero
references to the supervisor array. If you are set up as a supervisor rather
than a team, you would not see yourself even after RC-1 and RC-2 are fixed.

---

## B. The one decision that needs your approval

RC-1 forks. Everything downstream depends on which way it goes.

**Option A — teach the bridge to write Firebase.** Add `firebase.js` beside
`pocketbase.js` behind the same interface, plus the `tak_positions` Firestore
rule. Your real events, venues, and org live in Firestore (`dispatch-60ca7`);
this makes TAK work against the data you actually use, and is what a deployment
needs. Cost: a bridge-side credential (Admin SDK service account, or a normal
user login), Firestore write volume, and a rules deploy.

**Option B — run the app on PocketBase.** Set `NEXT_PUBLIC_BACKEND=pocketbase`.
Zero new code. But it is a separate data island: your Firestore events are not
there, and `core/scripts/setup-pocketbase.js` plus `seed-crowdcad.js` would have
to stand up equivalents.

**Recommendation: B first as a 15-minute proof, then A as the real fix.** B
costs one environment variable and tells you whether the entire inbound chain —
phone, TLS, FTS, bridge, georeference, matching, tween, marker — is sound. The
bridge is already pointed at a live PocketBase event, so this is close to a
free experiment. Build A knowing the pipe works rather than debugging two
unknowns at once. **Do not skip the proof and start with A**, because RC-2 means
a Firebase-side failure looks exactly like silence.

---

## C. Plan, in dependency order, with delegation

Model column: **H** = Haiku (mechanical, spec fully determined), **S** = Sonnet
(contained implementation against a written spec), **O** = Opus (design
judgment, cross-cutting, or a decision that is expensive to get wrong).

### Stage 0 — Prove the pipe (no code)

| # | Task | Model |
|---|---|---|
| 0.1 | Run the app with `NEXT_PUBLIC_BACKEND=pocketbase` against the bridge's live event; confirm a marker moves. Record the result either way. | O — the diagnosis branches on it |

Gate: **do not start Stage 2 until 0.1 has a recorded answer.**

### Stage 1 — Make failure visible (unblocks everything, tiny)

| # | Task | Model |
|---|---|---|
| 1.1 | Mount `<ToastContainer />` in both `core/src/app/layout.tsx` and root `src/app/layout.tsx`, themed to the surface tokens. Fixes RC-5 and 24 dead call sites. | H |
| 1.2 | Split `useTakPositions`'s error callback (RC-2): keep "empty collection" silent, but surface permission-denied / transport errors as a distinct state the dispatch page can show. **Never again let a denied read look like an idle one.** | S |
| 1.3 | Add the `tak_positions` match block to `firestore.rules` — read for org members of the owning event, write restricted to the bridge principal. Deploy separately. | O — a rules mistake is a data-exposure bug |

### Stage 2 — Close inbound (RC-1)

| # | Task | Model |
|---|---|---|
| 2.1 | Extract the store interface `pocketbase.js` already implies (`TakPositionStore`) into an explicit seam, unchanged in behaviour, with the existing tests still green. | S |
| 2.2 | Implement `dev/crowdcad-tak-bridge/firebase.js` against that seam. Same one-record-per-(eventId, callsign) shape, same trail batching, same movement gate. | S |
| 2.3 | Add `--backend firebase\|pocketbase` to the bridge CLI and README, defaulting to pocketbase so nothing existing changes. | H |
| 2.4 | End-to-end verification against the real Firestore event with a phone. | O |

### Stage 3 — Callsign binding where it belongs (RC-7, RC-6, RC-8)

| # | Task | Model |
|---|---|---|
| 3.1 | Wire `takCallsign`/`setTakCallsign` into the create page's `AddTeamModal` mount and include `takCallsign` on the `Staff` built by `handleAddTeam`. The modal already renders the field. | H |
| 3.2 | Port `handleEditTeam`/`handleSaveEditedTeam` from the dispatch page to the create page, **including the rename propagation** through `calls[].assignedTeam` and `detachedTeams` (RC-8). Add the edit affordance to `TeamStaffingSection`. | S |
| 3.3 | Show the bound callsign on each team row so an operator can confirm the binding without opening the modal. | H |
| 3.4 | Decide whether `Staff` should finally get a stable `id` rather than accreting a third rename-propagation site. Scoped as a question, not a task. | O |

### Stage 4 — "Set default view" (RC-4)

| # | Task | Model |
|---|---|---|
| 4.1 | Persist the camera immediately on click via `dbService.updateDocument` rather than staging it for the main Save, and confirm with a toast (needs 1.1). | S |
| 4.2 | Relabel to "Update default view" when one exists; show the saved center/zoom as a readout so the operator can verify what will reopen. | H |
| 4.3 | Surface the control in raster view too — either the button, or a hint that Map view is where it lives. Decide which; the current silence is the actual reported bug. | O |
| 4.4 | Reconcile the two parallel camera modules: `sanitizeBasemapCameraForSave` lives in `src/lib/basemapCameraUtils.ts` while `resolveInitialCamera` lives in `src/lib/basemap/camera.ts`. One of them should move. | H |

### Stage 5 — Open the round trip (RC-3) — the big one

This is the feature that does not exist. It is scoped here but is **not** a bug
fix, and it should not be started in the same sitting as Stages 1–4.

| # | Task | Model |
|---|---|---|
| 5.1 | Decide the transmit topology: bridge-as-publisher (a second socket to FTS:8087, reusing the connection it already holds) vs. a Next.js `/api/tak` route. **Bridge is recommended** — it already has the FTS connection, the georeference, and it keeps CoT-on-the-wire out of the browser. | O |
| 5.2 | `georef.unproject()` + `cot.buildEvent()` — the two halves the bridge README names as missing. | S |
| 5.3 | Publish venue posts as CoT markers, gated on `TakPublishSettings.publishPosts`. | S |
| 5.4 | Publish calls as CoT markers, honouring the `off`/`location-only`/`full` redaction levels already in `redaction.ts`. **PHI gate — review before it transmits.** | O |
| 5.5 | Enforce `COT_TYPE_CODES_VERIFIED` at the transmit boundary, per §0.3(10). Until the §7.3 type-code spike runs, markers may render as the wrong icon in iTAK. | O |

**Stage 5 is still gated on the §7.3 type-code spike** that §0.4 has listed as
top priority since 2026-08-15: one person, one phone, one afternoon. Publishing
before it runs means shipping markers whose icons are a guess.

---

## D. What this document changes in `TAK_INTEGRATION_PLAN.md`

On approval, apply these. They are corrections, not new work.

1. **New §0.7** — this field report, in the form §0.6 established.
2. **§0.1 drift — verified.** Lines **225–228** (Phases 10.C, 10.E, 10.E(1),
   10.E(2)) say "Done (uncommitted)". The core working tree is **clean**; all
   four were committed in `6b42e79`. §13 carries **17** stale `(uncommitted)`
   markers at lines 5563, 5568–5569, 5572, 5577–5579, 5587–5588, 5591–5592,
   5597–5598, 5601–5602, 5604, 5607.
3. **§0.1 drift** — the root wrapper still has the basemap dependencies
   (`maplibre-gl@^5.24.0`, `pmtiles`, `@protomaps/basemaps`), the `.env.example`
   Phase 8 block, and the `core` pointer bump **uncommitted**. This is the
   **third** recurrence of the uncommitted-work pattern §0.1 documents. Commit
   before anything else.
4. **Phase 2 heading** — "🟡 INBOUND BUILT, OUTBOUND NOT WIRED" is accurate but
   understates it: inbound is built *and cannot reach the default backend*. Say so.
5. **§0.2** — add RC-2 (`tak_positions` has no Firestore rule) and RC-5
   (no `ToastContainer`) as known live defects.
6. **§8.J** — record that "Set default view" ships stage-only with no feedback,
   and that 10.D closed the *inert* button without closing the *silent* one.
7. **§0.4** — re-order. Stage 0 and Stage 1 above outrank the type-code spike,
   because they are hours and they make every later failure legible.
