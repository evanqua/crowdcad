
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project follows [Semantic Versioning](https://semver.org/).

> **Versioning convention:**
> - `MAJOR` — breaking changes or major platform shifts
> - `MINOR` — new features, backward-compatible
> - `PATCH` — bug fixes, copy/style tweaks, dependency bumps

---

## [Unreleased]

---

## [1.5.0] - 2026-08-24

### Added

- **Availability tracking and surge notifications** — a new availability/surge strip in the dispatch sidebar (and mobile/tablet layout) buckets teams into Available / On Break-Clinic / On Calls and shows a percent-on-calls meter that shifts from green to red at the event's configurable surge limit (`Event.surgeLimitPercent`, default 70%). Crossing the limit fires a one-time warning toast (also fixes react-toastify's `ToastContainer` never having been mounted on the dispatch page, which had silently no-opped every existing `toast.*` call).
- **Multiple named clinics (complete)** — follow-up to the 1.4.0 foundation. `events.clinics` is now a real, schema-backed field (was silently dropped on PocketBase before) and is kept in sync with the venue's clinic-flagged posts via stable per-post `clinicId`s that survive a clinic being renamed. When a team is marked Transporting on a multi-clinic event, dispatch now prompts for which clinic the team is heading to instead of always routing to the first one; the chosen clinic is written onto the call immediately. Team-status pills, call chips, resolved/"Delivered" chips, activity logs, and the venue map's team tooltip all reflect the destination clinic; single-clinic events are visually unchanged. Map-builder clinic markers (canvas, location list, and the dispatch-side venue map) now consistently use a clinic icon driven by the real `isClinic` flag instead of a name-string heuristic in one of the three spots.
- **Reversible call resolution and transport unit capture** — resolving a call is no longer a one-way action, and a new transport-unit modal captures which unit a team transported with, threaded through the dispatch vocabulary and tracking table.
- **Centrally configurable status-card colors and opacities** — dispatch status-card colors and opacities now live in a single `src/lib/colorTokens.js` source of truth, consumed by `statusColors.ts` and `tailwind.config.js`, instead of being scattered across individual components.
- PocketBase data interface control document (`docs/ICD.md`) — a backend-agnostic description of the PocketBase collections/fields and REST/SSE access, written so external integrations (including the in-progress TAK/ATAK integration) can read and write CrowdCAD data without depending on CrowdCAD's own frontend.
- Dispatch vocabulary presets and terms from the profile refactor, including French translations for the new surge/availability strings.

### Changed

- Profile refactor: significant cleanup of the profile flow and its surrounding UI (see `#19` for full detail).

### Removed

- User avatar and profile photo upload/display logic, removed as part of the profile refactor.

### Fixed

- Equipment status select no longer flakes in E2E under rapid status changes.
- Clinic call rows now align with call-tracking table behavior/columns.
- PocketBase backend now persists the dispatch language preset on the users collection instead of losing it.
- Event/venue creation UI colors now adapt correctly to light mode.
- E2E suite no longer hangs on `networkidle` waits caused by a Firestore write firing on every page load.

### Maintenance

- Dependency updates within existing semver ranges; `@playwright/test` held back to fix a CI break it introduced.

---

## [1.4.0] - 2026-08-11

### Added

- **Multiple named clinics (foundation)** — venues can now designate specific locations as clinics (`Post.isClinic`), and an event can define multiple clinics (`Event.clinics`). Dispatch renders one named tab per clinic instead of a single hardcoded "Clinic" tab, and calls carry a `clinicId` field. Picking which specific clinic a call routes to is intentionally deferred to a follow-up — this release lays the data-model and UI foundation only.
- **CSV bulk upload for teams and supervisors** — download a template, fill it out, and import via a new split "Add Team"/"Add Supervisor" button (download template → upload → validated preview → import), instead of adding staff one at a time.
- **Loading feedback on "Start New Event"** — the button now shows a spinner and disables itself while the draft event is being created, instead of giving no feedback during the write.
- New Claude Code skill (`event-venue-creation-design`) documenting the design conventions for event- and venue-creation surfaces, scoped to keep them out of the dispatch page's own visual language.

### Fixed

- Teams/Supervisors/Posts/Equipment tabs on the event-create page no longer end their blurred panel at different heights — replaced a duplicated viewport-relative magic number with real flexbox fill, so every tab's content area shares an identical bottom edge.
- Lite mode's staffing panel blur now matches cloud mode's (it previously read "washed out" from a Tailwind opacity class colliding with HeroUI's `isBlurred` styling at equal specificity).
- Cloud mode's Add Team / Add Supervisor buttons now carry visible text labels instead of being icon-only.
- Cloud event-create page no longer scrolls vertically — it now uses the same `100dvh - 3.5rem` height calculation as lite mode (accounting for the app navbar's actual rendered height), and its tabs span the full width of the panel like lite's do.
- Unified list-item card, chip color, button color, and header spacing between lite and cloud event-create surfaces, and matched bottom panel padding so tab content no longer touches the edge of the screen.

---

## [1.3.0] - 2026-07-09

### Added

- **PocketBase self-hosted backend support** — opt-in via `NEXT_PUBLIC_BACKEND=pocketbase`, giving LAN/local deployments a no-cloud-account option alongside Firebase. Implemented as a backend-agnostic service layer (`src/lib/services` — `IAuthService`/`IDbService`/`IStorageService` interfaces with `firebase/` and `pocketbase/` adapters selected by `factory.ts`), plus `docker-compose.yml`, `Dockerfile.pocketbase`, and `scripts/setup-pocketbase.js` for collection setup.
- Docker production and development environment (`Dockerfile`, `Dockerfile.pocketbase`, `docker-compose.yml`).
- GitHub Actions CI/CD pipeline (build, lint, type-check, E2E against both backends) and automated release drafting (`.github/workflows/`).
- BDD end-to-end test suite bootstrap (Playwright + `playwright-bdd`, Firebase emulators) covering dispatch, event creation, venue management, auth, and profile flows, with a parallel PocketBase E2E configuration.
- Roles are now fetched from the persisted store instead of hardcoded values.
- Dispatch tracking composition utilities added under `src/components/dispatch/`:
  - `trackingtablebase.tsx` — shared table shell and row rendering structure used by call and clinic tracking.
  - `trackingtextentry.tsx` — shared inline text entry control used across team, call, and clinic flows.
  - `motioncell.tsx` — shared animation-aware table cell wrapper for smoother row transitions.
- Shared animation utilities now drive add/remove and collapse/expand transitions in dispatch cards and tracking rows with reduced-motion support.

- Foundation refactor: extracted core utilities to `src/lib/` for reuse across features:
  - `uploadUtils.ts` — file upload with exponential backoff retry logic (transient error detection, original error preservation).
  - `zoomPanUtils.ts` — viewport math utilities (`clampScale`, `clampPanPosition`) for consistent zoom/pan behavior.
  - `markerUtils.ts` — marker detection and placement helpers.
- Shared React hooks extracted to `src/hooks/` for reuse:
  - `useZoomPan` — manages zoom/pan state and mouse/wheel event handlers for map-based interfaces.
  - `useScheduleGeneration` — generates shift schedules from event duration and team coverage.
  - `useTeamForm` — team/supervisor form submission and validation.
- Shared UI primitives added to `src/components/ui/`:
  - `map-zoom-controls.tsx` — zoom in/out/reset button cluster with accessibility labels (reused across event create and venue management).
  - `map-pan-surface.tsx` — reusable pan/wheel interaction surface for canvas-based viewers.
- Event creation flow decomposed into focused section components under `src/components/event-create/`:
  - `MetadataSection.tsx` — event name, date, and venue selection.
  - `TeamStaffingSection.tsx` — team roster assignment.
  - `SupervisorStaffingSection.tsx` — supervisor roster assignment.
  - `PostingScheduleSection.tsx` — shift schedule generation and management.
  - `PostsEquipmentSection.tsx` — posts and equipment selection with multi-select state.
- Venue management flow decomposed into focused section components under `src/components/venue-management/`:
  - `EquipmentManagementSection.tsx` — add/edit/delete equipment with stable React keys.
  - `LayerControlBar.tsx` — layer navigation (previous/next/add/delete) with accessibility labels.
  - `MarkerModeToggleButton.tsx` — toggle marker placement mode.
  - `PendingMarkerDialog.tsx` — marker naming dialog.
  - `MarkerPlacementInstruction.tsx` — on-screen guidance during marker placement.
- Lite event drafts now persist a `postingScheduleEnabled` flag to keep posting schedule behavior consistent between setup and dispatch.

### Changed

- Navbar refresh: increased contrast in light mode, resized/recolored for greater contrast and more compact viewing, and realigned mobile navbar buttons for consistency.
- Color and opacity constants centralized in config instead of scattered literals.
- Dispatch right panel now uses browser-style secondary tabs with active counts and a compact header action bar (`Add Call` with keyboard shortcut hint).
- Call and clinic tracking now share aligned table and card visual language, including unified shells, spacing, and row structure.
- Team cards received a UI refresh: transparent shell, square corners, divider structure, chevron expand indicator, refined map pin sizing, and clearer member/cert formatting.
- Team card expand/collapse now uses smooth row height and opacity animation with reduced-motion fallbacks.
- Status color logic is centralized in `src/lib/statusColors.ts` and reused across team chips and dispatch status rendering.
- Tracking text fields for chief complaint and location were resized and standardized through shared `TrackingTextEntry` usage.
- Status box text area was expanded for better readability of longer status updates.

- Event creation page (`src/app/(main)/events/[eventId]/create/page.tsx`) now uses decomposed section components instead of a monolithic page layout, improving maintainability and testability.
- Venue management page (`src/app/(main)/venues/management/page.client.tsx`) now uses decomposed section components and shared map controls instead of page-local implementations.
- Dispatch call tracking page now threads styling through `rowClassName` prop to restore per-status visual differentiation.
- Pan math in `zoomPanUtils.clampPanPosition` corrected to properly clamp against scaled image overflow (fixes off-by-factor error at different zoom levels).
- Lite setup Locations/Equipment add row now uses an attached input + action button style with aligned corner radii and consistent spacing.
- Teams and Supervisors panel actions in Lite setup now use explicit `Add Team` and `Add Supervisor` buttons.
- Lite dispatch navbar now hides `Posting Schedule` when posting schedule is disabled in event setup.
- Lite navbar primary links were simplified to focus on Lite routes (`Lite Home`, `Create`).
- Landing page copy and CTA text were refined (`CrowdCAD Lite` footer label and Lite subtitle wording), and Lite CTA iconography was simplified.
- Updated `public/logo.svg` artwork/viewBox for refined logo rendering.

### Fixed

- Calls tab now visually matches the Clinic tab: shares the `TrackingTableBase` scaffold and header/button chrome, and `Add Call` (a pill button matching Clinic's `Add Patient`) replaces the old icon-only `+`. This also fixed a header/body column-count mismatch that had misaligned every column from Status onward.
- Resolved calls (Delivered, NMM, Unable to Locate, Refusal, etc.) no longer show a stale "Pending" team marker just because their team was detached.
- The call actions (3-dot) menu no longer force-closes on resolved calls when "Show Resolved Calls" is enabled.
- Team-status dropdown no longer closes spuriously from a stray upstream self-close race in the popover library.
- Fixed a dispatch dual-mount bug and E2E test-data collisions in seed data, and corrected a nested-dialog Playwright locator.
- Backend-agnostic bypass logic (`src/app/firebase.ts`) now checks `NEXT_PUBLIC_BACKEND === 'pocketbase'` explicitly rather than inferring it from other env vars, so the app never silently falls back to the wrong backend.
- Profile edit no longer passes `photoURL` to `updateProfile()` in PocketBase mode, where the adapter doesn't support it.
- E2E seed-db `bulkCreate()` document IDs no longer collide across chunks (ID now incorporates chunk index and item index).
- CI workflow `contents: write` permission scoped to the publish-report job instead of top-level.
- Repaired a broken PocketBase client initialization path and hardcoded CI E2E test credentials.
- Resolved-row action menus now close correctly when rows are resolved and hidden, preventing orphaned dropdown menus.
- Removed ghost/shadow rendering artifact in tracking text entry fields while scrolling.

- Upload retry logic now only retries on transient Firebase Storage errors (`storage/retry-limit-exceeded`, `storage/unknown`) to avoid masking real failures, and preserves original error for diagnostics.
- Removed initial navbar mount flicker/layout shift on page reload by rendering the main app navbar in the initial render path instead of client-only lazy loading.
- Equipment list now uses stable React keys (`item.id`) instead of array indices to prevent component state loss on edit/delete operations.

---

## [1.1.0] - 2026-03-19

### Added

- Lite mode local-only workflow for event setup and dispatch, including browser-local persistence without Firebase sync.
- Lite dispatch navbar controls for Posting Schedule, Clear Event, and Export Summary actions.

### Changed

- Unified Lite and Cloud dispatch onto a shared dispatch UI flow to reduce duplication and keep feature parity.
- Lite dispatch navbar behavior now mirrors main app navbar behavior (clock placement, auth controls, desktop/mobile parity).
- Lite dispatch route now uses a lightweight wrapper that delegates to the shared dispatch page.

### Fixed

- Resolved Next.js route export/type issues on dispatch pages that could fail production builds.
- Cleared lint/type build blockers across dispatch, venue management, profile, and modal components.
- Updated venue map icon rendering to satisfy Next.js image lint requirements.
- Suppressed non-actionable React hydration mismatch warnings in development when browser extensions inject attributes on root HTML/body before client hydration.

---

## [1.0.0] - 2026-02-28

Initial public release of **CrowdCAD** — an open-source, browser-based Computer-Aided Dispatch system for volunteer EMS and event medical teams.

### Core Platform

- **Next.js 15 App Router** frontend with TypeScript, TailwindCSS, and HeroUI component library.
- **Firebase** backend: Email/password authentication, Firestore real-time database, Firebase Hosting deployment pipeline.
- **Firebase Data Connect** schema (Cloud SQL / PostgreSQL) for structured event, unit, and incident data.
- **Dark-mode** design system with a custom token palette (`surface`, `accent`, `status.*`) applied globally via Tailwind.

### Event Management

- Create and configure events with name, date, venue, and posting schedule.
- Per-event posting schedules: define time slots, assign teams to posts, and edit times inline.
- Scheduled auto-post sync: at each posting-time boundary the system automatically prepares teams to be moved to their assigned posts.
- Event summary page with activity charts (`SummaryCharts`).
- Share modal to grant other authenticated users access to an event.
- End-event modal with summary navigation.

### Venue Management

- Create and edit venues with metadata (equipment capacity, medical post definitions).
- Image-based interactive venue maps with named layers; markers for teams and equipment are customizable.
- Equipment staging locations attached to posts.

### Dispatch Interface

- **Call tracking table** — live call log with columns for call number, chief complaint, age/sex, location, status, and assigned teams.
- **Clinic tracking** — separate table for walk-up patients with walkup-entry modal.
- Quick-call entry form for rapid incident creation.
- Priority call flagging (visual highlight and sort).
- Duplicate call detection and resolution workflow.
- Cell-level inline editing for call fields with click-to-edit UX.
- Per-call team assignment with status tracking and log entries.
- Resolved-call archive toggle (show/hide resolved rows).

### Team & Supervisor Management

- Add, edit, and delete field teams with named members and certification levels (FR, FA); lead designation per member.
- Add, edit, and delete supervisors with call sign and certification.
- Team status and location controls; per-team status timer derived from activity log.
- Sort teams by availability, name (A→Z / Z→A).
- Condensed team card view mode for high team-count events.

### Equipment Tracking

- Equipment cards with status (Available / Deployed / In Use / Maintenance), current location, and staging location.
- Add venue-defined equipment to the dispatch board.
- Inline location editing with commit-on-blur.
- Equipment reset-to-staging-location bulk action.
- Soft-delete equipment from active board.

### Infrastructure & Documentation

- `.env.example` with all required Firebase and SMTP environment variables documented.
- `firebase.json.template` for self-hosted Firebase Hosting setup.
- `firestore.rules` with baseline security rules.
- `scripts/backfillOrgIds.js` migration helper.
- Full documentation suite: `ARCHITECTURE.md`, `COMPONENTS.md`, `DEPLOYMENT.md`, `FIREBASE_SETUP.md`, `USER_GUIDE.md`.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE.md` (AGPL-3.0).

---

*For upgrade notes and migration steps, see the relevant release on GitHub. For security vulnerabilities, follow the process in [SECURITY.md](SECURITY.md).*

[Unreleased]: https://github.com/evanqua/crowdcad/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/evanqua/crowdcad/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/evanqua/crowdcad/compare/v1.2.0...v1.3.0
[1.1.0]: https://github.com/evanqua/crowdcad/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/evanqua/crowdcad/releases/tag/v1.0.0

