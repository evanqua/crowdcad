# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CrowdCAD is a browser-based Computer-Aided Dispatch (CAD) system for volunteer EMS / event medical teams — a single Next.js (App Router) app at the repo root (`src/`), no monorepo. It ships in two modes from the same codebase:

- **Cloud mode** (`src/app/(main)/...`) — full multi-user app: auth, org/event management, shared venues, dispatch. Backed by Firebase or PocketBase (see below).
- **Lite mode** (`src/app/lite/...`) — single-device, local-only dispatch workflow (data in browser storage, no backend account needed). Shares dispatch UI with cloud mode; see `src/lib/liteEventStore.ts`, `liteEventAdapters.ts`, `LiteContext.tsx`.

The public landing page (`src/app/page.tsx`) links to both: sign-in for cloud mode, `/lite` for local-only mode.

## Commands

```bash
npm install
npm run dev          # next dev, http://localhost:3000
npm run build
npm run start
npm run lint          # next lint
npm run type-check    # tsc --noEmit

npm run test:e2e            # bddgen + playwright test, Firebase backend (spins up Firebase emulators + a prod Next build automatically)
npm run test:e2e:pocketbase # same, against playwright.config.pocketbase.ts
npm run test:e2e:ui         # Playwright UI mode
npm run test:e2e:debug      # Playwright inspector
```

E2E tests are BDD-style: `.feature` files + step definitions under `tests/e2e/`, compiled by `bddgen` (playwright-bdd) before `playwright test` runs. To run a single feature/scenario, target its generated spec via Playwright's own filters (e.g. `playwright test -g "<scenario name>"`) after `npx bddgen`.

Docker (`docker-compose.yml`, `Dockerfile`, `Dockerfile.pocketbase`) is available for both backends — see `README.md` Quickstart for the exact `docker compose` invocations and first-run steps (superadmin creation, `scripts/setup-pocketbase.js` for PocketBase collections).

## Backend: Firebase vs PocketBase

The app is backend-agnostic by design, selected at build time via `NEXT_PUBLIC_BACKEND` (`firebase` default, or `pocketbase`):

- `src/lib/services/{IAuthService,IDbService,IStorageService}.ts` — interfaces.
- `src/lib/services/firebase/*` and `src/lib/services/pocketbase/*` — concrete adapters.
- `src/lib/services/factory.ts` — picks the adapter from `NEXT_PUBLIC_BACKEND` (inlined at build time so Next.js tree-shakes the unused backend out of the production bundle). Import `authService` / `dbService` / `storageService` from `src/lib/services` rather than reaching into either adapter directly, and check `isPocketbaseBackend` before doing anything backend-specific.
- `src/app/firebase.ts` still exists as the raw Firebase SDK init (guarded against duplicate init via `getApps()`) — the PocketBase client equivalent is `src/lib/services/pocketbase/client.ts`.
- Firestore has no `undefined` support; PocketBase doesn't share that restriction, but `stripUndefined()` (`src/lib/utils.ts`) is used broadly before writes regardless of backend.
- `dataconnect/` is a Firebase Data Connect (Postgres/Cloud SQL) schema scaffold that is **not** part of either live backend path — don't assume it's wired into the running app without checking call sites first.

## Architecture

- **Stack**: Next.js 15 (App Router, React 19, TypeScript strict), Tailwind CSS, HeroUI + Radix primitives, shadcn-style `components.json` (`new-york` style, alias `@/*` → `src/*`).
- **Routing**: `src/app/(main)/...` (cloud shell) has `events/[eventId]/{create,dispatch,summary}`, `venues/{management,selection}`, `admin`, `orgs/[orgId]`, `profile`. `src/app/lite/...` mirrors the dispatch/create flow for local-only mode. `src/app/api/contact/route.ts` is the one server route (uses `nodemailer`).
- **Domain types**: `src/app/types.ts` is the source of truth for the data model (`Event`, `Venue`, `Call`, `Staff`, `Supervisor`, `Equipment`, `Layer`/`Post`, `InteractionSession`). Both Firestore and PocketBase records follow these shapes; there's no schema-validation layer, so treat this file as authoritative.
- **Components** (`src/components/`) are organized by role, not flat:
  - `modals/` — `auth/`, `event/`, `venue/` subfolders; naming convention `*modal.tsx`.
  - `dispatch/` — dispatch board UI, including shared composition primitives `trackingtablebase.tsx` (shared table shell for call/clinic tracking), `trackingtextentry.tsx` (shared inline text entry), `motioncell.tsx` (animated cell wrapper). Reuse these before adding new table/entry logic to a card.
  - `event-create/` and `venue-management/` — page-level flows decomposed into focused section components (metadata, staffing, schedule, posts/equipment, layers, marker placement).
  - `layout/` — `appnavbar.tsx` (cloud), `litenavbar.tsx` (lite), `appshell.tsx`, `homepagestreaks.tsx`.
  - `ui/` — shadcn/Radix primitives plus shared interaction chrome: `map-pan-surface.tsx`, `map-zoom-controls.tsx`, `portal-dropdown.tsx`, `loading-screen.tsx`.
  - Status colors are centralized in `src/lib/statusColors.ts` — team chips and dispatch rows should read from there, not local class maps.
- **`src/hooks/`**: `useauth.ts` (auth + `ccad_auth` cookie sync for future middleware use), `useDataCollection.ts` (per-event mouse/keystroke telemetry batched into the event doc every 30s / on unload — UX telemetry, not app logic), `useZoomPan`, `useScheduleGeneration`, `useTeamForm`, `useCallTrackingState`, `useListCollection`, `use-mobile.tsx`.
- **`src/lib/`**: `utils.ts` (`cn()`, `stripUndefined()`), `uploadUtils.ts` (upload retry w/ backoff, transient-error detection), `zoomPanUtils.ts` (viewport clamp math), `markerUtils.ts`, `scheduleUtils.ts`, `analyticsUtils.ts`, `statusColors.ts`, and the lite-mode trio `LiteContext.tsx` / `liteEventStore.ts` / `liteEventAdapters.ts` / `liteUtils.ts`.
- **CI/CD**: `.github/workflows/{ci.yml,cd.yml,release-drafter.yml}` — build/lint/type-check/E2E against both backends, plus automated release drafting. `.github/copilot-instructions.md` also exists; check it if working on anything Copilot-specific, but this file is the primary guidance doc.

## Working in this repo

- Client components (hooks, state, browser APIs) need `'use client'` at the top — pages under `src/app` are server components by default.
- Prefer composing from the existing `dispatch/`, `event-create/`, and `venue-management/` section components over adding new page-local monoliths — this is an explicit, actively-enforced convention (see `docs/ARCHITECTURE.md`, `docs/COMPONENTS.md`).
- When touching auth/db/storage code, go through `src/lib/services` (backend-agnostic interfaces), not Firebase or PocketBase APIs directly, unless you're inside one of the two adapter implementations themselves.
- HIPAA/PHI conventions (per `docs/FIREBASE_SETUP.md`, `docs/DEPLOYMENT.md`): no analytics/telemetry that could capture PHI, respect `DISABLE_TELEMETRY`, don't log call/patient details (`Call`/`Staff`/`Supervisor` fields) to `console.*`.
- `docs/ARCHITECTURE.md` and `docs/COMPONENTS.md` are kept current with the actual component layout — trust them over guessing from folder names alone when planning cross-cutting changes.
