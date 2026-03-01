# Copilot / AI Agent Instructions for CrowdCAD (Dispatch)

<<<<<<< HEAD
Purpose: Give AI coding agents immediate, actionable context about this repo so they can make safe, consistent changes.

## Quick Start (dev/build)

- Install deps: `npm install`
- Run dev server: `npm run dev` (Next.js App Router under `src/app`)
- Build for production: `npm run build` and `npm start`
- Deploy: Firebase Hosting (configured in `firebase.json`, region `us-west1`)

## Big Picture Architecture

**Tech Stack**: Next.js 15 (App Router) + Firebase (Auth/Firestore) + TypeScript + TailwindCSS + HeroUI components

**Domain**: Computer-Aided Dispatch (CAD) system for volunteer EMS teams at live events. Core entities: Events, Venues, Units/Teams, Incidents, Dispatch Logs.

**Key architectural layers**:

- **Pages/Routes**: `src/app` follows App Router conventions — server components by default, client components marked with `'use client'`
- **Domain routes**: `src/app/(main)/events`, `src/app/(main)/venues`, `src/app/(main)/admin` contain feature-specific pages with `[eventId]` dynamic segments
- **Shared UI**: `src/components` houses reusable modal components (naming pattern: `*modal.tsx`) and UI primitives (`ui/`)
- **State/Auth**: Custom hooks in `src/hooks` (`useAuth.ts` wraps Firebase Auth, `useDataCollection.ts` handles interaction logging)
- **Backend**: Firebase (Auth + Firestore) initialized in `src/app/firebase.ts`; Data Connect schema in `dataconnect/schema/schema.gql` (Cloud SQL Postgres, service `CrowdCAD`, location `us-west2`)

## Key Integration Points & Environment

**Firebase Configuration** (`src/app/firebase.ts`):

- Uses `NEXT_PUBLIC_FIREBASE_API_KEY` environment variable (only API key is env-based)
- Hard-coded project ID: `dispatch-60ca7`, storage bucket: `dispatch-60ca7.firebasestorage.app`
- ⚠️ **NEVER change** Firebase project identifiers or bucket names without coordinating env updates

**Image Handling** (`next.config.js`):

- Firebase Storage domains whitelisted in `images.remotePatterns`:
  - `firebasestorage.googleapis.com/v0/b/**`
  - `storage.googleapis.com/**`
  - `dispatch-60ca7.firebasestorage.app/**`
  - `*.firebasestorage.app/**`
- When adding new image sources, update `remotePatterns` or Next.js will block them

**Data Connect** (`dataconnect/dataconnect.yaml`):

- Service: `CrowdCAD`, Cloud SQL Postgres instance: `crowdcad-db`, location: `us-west2`
- GraphQL schema: `dataconnect/schema/schema.gql` defines User, Event, Unit, Incident, DispatchLog types
- Schema syncs with Postgres; connector config in `dataconnect/connector/connector.yaml`

## Project-Specific Conventions

**File Organization**:

- Dynamic routes: `src/app/(main)/events/[eventId]/create/page.tsx` — event-specific pages use `[eventId]` param
- Modal components: Always live in `src/components` with `*modal.tsx` naming (e.g., `createvenuemodal.tsx`, `sharemodal.tsx`)
- Client components: Must include `'use client'` directive at top (most modals, interactive UI are client-side)
- Server components: Default in App Router; avoid client directives unless using hooks/interactivity

**TypeScript Patterns**:

- Core domain types in `src/app/types.ts`: `Event`, `Venue`, `Staff`, `Supervisor`, `Call`, `Post`, `Layer`, etc.
- Always import from `@/app/types` when working with domain entities
- Use TypeScript strictly; avoid `any` — add proper types to `types.ts` when needed

**Authentication & Data Access**:

- Auth hook: `useAuth()` from `src/hooks/useauth.ts` returns `{ user, ready }` (wraps Firebase `onAuthStateChanged`)
- Sets cookie `ccad_auth=1` when authenticated (7-day expiry), `ccad_auth=0` when logged out
- Firestore operations: Import `db` from `@/app/firebase`, use `collection()`, `doc()`, `getDoc()`, `updateDoc()` patterns

**UI Component Library**:

- Primary: HeroUI (`@heroui/react`) — use Modal, Button, Input, Select components from HeroUI
- Styling: TailwindCSS + `tailwind-merge` utility in `src/lib/utils.ts` (use `cn()` helper for conditional classes)
- Icons: `lucide-react` for consistent iconography
- Toasts: `react-toastify` (import from `react-toastify`, configure in `src/app/layout.tsx`)

**State Management Patterns**:

- Interaction logging: `useDataCollection` hook tracks mouse clicks/keystrokes, saves to Firestore `events` collection
- Local state: Prefer React hooks (`useState`, `useEffect`) over external state libs
- Data fetching: Client-side Firestore queries (no React Query/SWR in use currently)

## Coding & PR Guidance

**Safe Change Principles**:

1. **Keep changes scoped**: Modify `src/app/(main)/*` routes for feature work, `src/components` for UI, `src/hooks` for shared logic
2. **Preserve types**: Update `src/app/types.ts` when adding/modifying domain entities (e.g., adding fields to `Event`)
3. **Don't touch Firebase config**: Avoid editing project IDs, bucket names, or `firebase.ts` without explicit instruction
4. **Client vs Server**: Add `'use client'` only when using hooks, event handlers, or browser APIs; otherwise keep server components

**Common Patterns to Follow**:

- Modal creation: Copy structure from existing `*modal.tsx` files (use HeroUI Modal components, handle `onClose` callback)
- Route protection: Check `useAuth().ready` before rendering protected content (see `src/app/(main)/events/[eventId]/dispatch/page.tsx`)
- Image uploads: Use Firebase Storage (`getStorage()`, `uploadBytes()`, `getDownloadURL()`) — see venue creation flows
- Firestore updates: Use `updateDoc()` with `arrayUnion()` for array fields (e.g., adding staff to event)

**Testing Changes Locally**:

1. Run `npm run dev` and navigate to affected routes
2. Test authentication flows (login/logout) if touching auth
3. Verify Firestore writes in Firebase Console if modifying data operations
4. Check browser console for errors (especially React hydration warnings in App Router)

## Files to Inspect When Modifying Behavior

**Core Infrastructure**:

- [src/app/firebase.ts](src/app/firebase.ts) — Firebase initialization (Auth, Firestore)
- [next.config.js](next.config.js) — Next.js config (image domains, React strict mode)
- [src/app/layout.tsx](src/app/layout.tsx) — Root layout (HeroUI provider, navbar, global styles)
- [package.json](package.json) — Dependencies & scripts

**Data Layer**:

- [src/app/types.ts](src/app/types.ts) — TypeScript type definitions for all domain entities
- [dataconnect/schema/schema.gql](dataconnect/schema/schema.gql) — GraphQL schema (User, Event, Unit, Incident)
- [dataconnect/dataconnect.yaml](dataconnect/dataconnect.yaml) — Data Connect configuration

**Key Feature Examples**:

- [src/app/(main)/events/[eventId]/dispatch/page.tsx](<src/app/(main)/events/[eventId]/dispatch/page.tsx>) — Main dispatch interface (reference for complex state management)
- [src/hooks/useAuth.ts](src/hooks/useAuth.ts) — Authentication hook (reference for Firebase Auth patterns)
- [src/components/sharemodal.tsx](src/components/sharemodal.tsx) — Modal example (reference for HeroUI modal structure)

## Pre-PR Checklist

Before submitting changes:

1. ✅ Run `npm run dev` and manually test changed flows
2. ✅ Verify no accidental edits to Firebase config or `next.config.js` image patterns
3. ✅ Confirm imports use `@/` alias for `src/` (e.g., `@/app/types`, `@/hooks/useAuth`)
4. ✅ Check that new modals follow `*modal.tsx` naming and use HeroUI components
5. ✅ If adding remote images, update `next.config.js` `remotePatterns`
6. ✅ Ensure TypeScript compiles without errors (`npm run build`)

## When to Ask the Human

- Clarification on Firebase project/environment (is this prod or staging?)
- Data Connect / Cloud SQL credentials or schema migration steps
- Deployment process beyond `firebase deploy`
- Business logic decisions (e.g., "Should clinic patients auto-discharge after X hours?")

---

**Need More Context?** Start with these files:

- Domain logic: `src/app/types.ts`, `dataconnect/schema/schema.gql`
- Auth patterns: `src/hooks/useAuth.ts`, `src/app/firebase.ts`
- UI patterns: `src/components/sharemodal.tsx`, `src/components/venuemapmodal.tsx`
- Route structure: `src/app/(main)/events/[eventId]/create/page.tsx`
=======
Purpose: give AI coding agents the minimal, precise orientation to be productive in this repo.

Quick start

- Project root contains two primary workspaces: the app at `dispatch-app/` and some shared metadata at repository root. Use `dispatch-app/` for local dev.
- Start dev server (from repo root):

  cd dispatch-app
  npm install
  npm run dev

What this repo is

- Next.js 13 (app router) TypeScript frontend in `dispatch-app/src/app` — entry: [dispatch-app/src/app/layout.tsx](dispatch-app/src/app/layout.tsx#L1).
- UI components in `dispatch-app/src/components` (lots of `*modal.tsx` and `*card.tsx` files — e.g. `teamcard.tsx`).
- Hooks in `dispatch-app/src/hooks` (notable: `useauth.ts`, `useDataCollection.ts`).
- Shared helpers in `dispatch-app/src/lib` (`utils.ts`).
- Firebase integration: `dispatch-app/src/app/firebase.ts` and `firebase.json` drive hosting; CI uses GitHub Actions under `.github/workflows/*.yml`.
- Dataconnect: `dataconnect/` and `dispatch-app/dataconnect/` contain `dataconnect.yaml`, connector definitions and GraphQL schema — changes here affect backend connector behavior.

Important patterns and conventions

- Use the `app/` router (Next.js 13): pages and layout are under `dispatch-app/src/app` and use server+client components patterns. Prefer adding routes under the same structure.
- Components: files end with `.tsx` and typically export a default React component. Many files are modal-based (e.g., `createvenuemodal.tsx`, `endeventmodal.tsx`) — follow existing props patterns when adding modals.
- Type declarations: several `*.d.ts` files exist (e.g., `react-img-mapper.d.ts`, `events.d.ts`) — add global types here when necessary.
- Styling: Tailwind CSS is used (`tailwind.config.js`, `postcss.config.mjs`, `globals.css`). Use utility classes; prefer existing design tokens.
- State + data: local hooks (e.g., `useauth.ts`) are used for auth state; existing components expect those hooks. `useDataCollection.ts` is used for event/venue data flows.

Build / CI / deploy

- Dev: `npm run dev` (in `dispatch-app/`).
- Build for production: `npm run build` then `npm run start` (confirm via `dispatch-app/package.json`).
- CI: `.github/workflows/*` contains Firebase hosting deploy steps; changes to hosting or build steps should also update those workflows.

Integration points

- Firebase (auth, hosting, DB): check `dispatch-app/src/app/firebase.ts` and `firebase.json`.
- Dataconnect connectors and GraphQL schema: `dispatch-app/dataconnect/connector/connector.yaml` and `dispatch-app/dataconnect/schema/schema.gql`.
- Public/static assets live under `dispatch-app/public/`.

Where to look for examples

- Page layout, top-level routes: [dispatch-app/src/app/layout.tsx](dispatch-app/src/app/layout.tsx#L1)
- Firebase usage: [dispatch-app/src/app/firebase.ts](dispatch-app/src/app/firebase.ts#L1)
- Component patterns: [dispatch-app/src/components/createvenuemodal.tsx](dispatch-app/src/components/createvenuemodal.tsx#L1) and `teamcard.tsx` (current working file)

Agent behavior guidance (practical, repo-specific)

- Prefer minimal, focused edits; follow existing file style (no large refactors without PR discussion).
- When adding routes/components, mirror naming and folder structure in `dispatch-app/src/app` and `dispatch-app/src/components`.
- Update `dispatch-app/components.json` if adding new standalone components referenced by tooling.
- If changing dataconnect schema or connectors, include matching updates to `dispatch-app/dataconnect/*` and briefly note needed deploy steps for connectors in PR description.

If uncertain

- Run the app locally (`cd dispatch-app && npm run dev`) and inspect runtime errors. Many types are defined in `dispatch-app/src/app/types.ts`.
- Ask maintainers to confirm changes to dataconnect or Firebase config before modifying deployment workflows.

Contact / next steps

- After edits, run the local dev server and ensure UI pages that touch changed components load without TypeScript or runtime errors.

---

This file was generated/updated by an AI to accelerate PRs; please edit if project conventions change.
>>>>>>> recovered-local
