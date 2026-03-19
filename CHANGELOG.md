
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

- Add, edit, and delete field teams with named members and certification levels (CPR, EMT-B, EMT-A, EMT-P, RN, MD/DO); lead designation per member.
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

[Unreleased]: https://github.com/evanqua/crowdcad/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/evanqua/crowdcad/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/evanqua/crowdcad/releases/tag/v1.0.0

