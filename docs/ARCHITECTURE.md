# Architecture Overview

This document gives a concise overview of CrowdCAD's architecture and where key pieces live in the repository.

High level
- Frontend: Next.js (App Router), TypeScript, React (server components by default). UI built using TailwindCSS and HeroUI components.
- Backend / persistence: Firebase (Authentication, Firestore, Cloud Storage). Dataconnect schema exists for connector integration.
- Hosting / CI: Firebase Hosting is used for deployment; CI commonly uses GitHub Actions.

Repository layout (important folders)

- `src/app/` — Next.js App Router source: top-level layouts and pages (server components by default). Key files:
  - `src/app/layout.tsx` — root layout and providers
  - `src/app/firebase.ts` — Firebase initialization (Auth, Firestore, Storage)
  - `src/app/types.ts` — core TypeScript domain types used across the app

- `src/components/` — UI components grouped by role:
  - `src/components/modals/` — modal components (modal files follow `*modal.tsx` naming)
  - `src/components/dispatch/` — dispatch-specific UI (cards, tracking widgets)
  - `src/components/layout/` — layout-level components (navbar, etc.)
  - `src/components/ui/` — small reusable primitives (Button, Input, Tooltip, Sidebar)

- `src/hooks/` — shared React hooks (auth, mobile helpers, data collection)
- `src/lib/` — utilities (e.g., `utils.ts` and `cn()` helpers)
- `dataconnect/` — GraphQL schema and connector definitions used for backend connectors
- `docs/` — user and developer documentation (this folder)

Key architectural decisions

- App Router / Server Components: Pages under `src/app` are server components by default. Client interactivity (hooks, event handlers) requires the `'use client'` directive at the top of the file.
- Firebase-first: The app uses Firebase for auth, realtime persistence, storage and hosting. `src/app/firebase.ts` centralizes initialization and should not be edited lightly.
- Component-first UI: UI is organized around modular components and small primitives in `src/components/ui` so features compose cleanly.
- Tailwind + HeroUI: Tailwind utility classes are used for styling; HeroUI provides higher-level components.

Data model and types

- Core domain types are stored in `src/app/types.ts` and are used throughout pages and components.
- Firestore documents follow shapes referenced in the frontend and enforced by Firestore rules (deployed per-organization).
- For backend connector integrations, see `dataconnect/schema/schema.gql`.

Authentication & security

- Firebase Authentication is used for user identity; `useauth.ts` in `src/hooks` wraps auth state for components.
- Sensitive production configuration (service accounts, BAAs) must be handled per-organization — see `docs/FIREBASE_SETUP.md` and `docs/DEPLOYMENT.md` for guidance.

Development & testing

- Local development: run `npm install` then `npm run dev` from the repository root.
- Emulator Suite: use the Firebase Emulator Suite for testing Firestore, Auth, and Storage rules locally.

Build & Deploy

- Build scripts are defined in `package.json` (`dev`, `build`, `start`).
- Deploy with the Firebase CLI (`firebase deploy`) or from CI using a `FIREBASE_TOKEN` or Workload Identity Federation.

Where to look for examples

- Client-side modal example: `src/components/modals/event/quickcallmodal.tsx`
- UI primitives: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`
- Dispatch widgets: `src/components/dispatch/teamcard.tsx` and `calltrackingcard.tsx`

Maintainers & contact

- Maintainers: Evan Passalacqua (`@evanqua`) and Ivan Zhang (`@iv-zhang`).
- Security reports: `support@crowdcad.org` or GitHub Security Advisories.

Notes

- Keep changes small and scoped; add tests for backend rules when modifying data shapes.
- When adding client components, remember to add `'use client'` and import only client-safe modules.
