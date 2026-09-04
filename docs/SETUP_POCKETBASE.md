# PocketBase Setup for CrowdCAD

This guide explains how to configure PocketBase for local development and self-hosted/LAN deployments — one of two supported backends, alongside Firebase (see [`SETUP_FIREBASE.md`](SETUP_FIREBASE.md)). PocketBase is a good fit when you want all data to stay on your own machine or LAN with no cloud account required; see [`DEPLOYMENT.md`](DEPLOYMENT.md) for a side-by-side comparison to help you choose. This guide complements `src/lib/services/pocketbase/client.ts` and `src/lib/services/pocketbase/PocketbaseAuthService.ts`, which contain the runtime client and auth adapter, and `docker-compose.yml` / `Dockerfile.pocketbase`, which define the Docker setup path used below.

Important: do not commit secrets (admin passwords or `.env.local`) to the repository. Use environment files for local development and your own secret store for production.

## Prerequisites

- **Docker Desktop** — required for the recommended setup path below. Available for Windows, macOS, and Linux. Download from [docker.com](https://www.docker.com/products/docker-desktop/), or on Windows install it via `winget`:

  ```bash
  winget install -e --id Docker.DockerDesktop
  ```

  On Windows, this installs the WSL2 backend Docker Desktop depends on; a **system restart is typically required** afterward before Docker Desktop can start.
- Node.js and npm — only needed for `node scripts/setup-pocketbase.js` (and, if you're not using Docker for the app itself, `npm install` / `npm run dev`).
- All `docker` and `npm` commands in this guide are run in a **bash-compatible shell** — Git Bash on Windows, Terminal (or your shell of choice) on macOS/Linux. Commands are the same across platforms, with one Windows-specific exception called out below: Git Bash auto-converts Unix-style path arguments, which breaks the `docker exec ... pocketbase superuser upsert` command unless prefixed with `MSYS_NO_PATHCONV=1` (see step 4 and Troubleshooting).

## Setup (Docker + PocketBase)

**1. Fork and clone the repository**

Since this is a shared project, start by creating your own copy rather than working directly against the upstream repository. Go to https://github.com/evanqua/crowdcad and click **Fork** to create a copy under your own GitHub account, then clone your fork (not the upstream repo):

```bash
git clone https://github.com/YOUR_USERNAME/crowdcad.git
cd crowdcad
```

Add the original repository as an `upstream` remote so you can pull in future updates — this is recommended so your fork doesn't fall behind:

```bash
git remote add upstream https://github.com/evanqua/crowdcad.git
```

If you already have a Firebase-configured checkout of this repo and want to try PocketBase alongside it, clone into a separate directory instead of reusing the existing one — each checkout has its own `.env.local` and `.pb-data/`, and running both from the same directory will collide.

**2. Configure environment variables**

```bash
cp .env.example .env.local
```

In `.env.local`, set:

```env
NEXT_PUBLIC_BACKEND=pocketbase
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=YourPassword!
```

`NEXT_PUBLIC_POCKETBASE_URL` is read by the app at runtime; `PB_URL`, `PB_ADMIN_EMAIL`, and `PB_ADMIN_PASSWORD` are read only by `scripts/setup-pocketbase.js` in step 5, not by the app itself.

**3. Build and start the containers**

```bash
docker compose --env-file .env.local up -d --build
```

This starts two services: `web` (the Next.js app, port 3000) and `pocketbase` (port 8090, data persisted to `./.pb-data`).

**4. Create the PocketBase superadmin**

First time only — this account is stored in `.pb-data/` and persists across restarts, so it's skippable on subsequent runs.

```bash
docker exec pocketbase /pb/pocketbase superuser upsert admin@example.com YourPassword!
```

Use the same email and password as `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` in `.env.local`.

On Windows with Git Bash specifically, Git Bash rewrites the leading `/pb/...` argument as if it were a Windows path, which breaks this command. Prefix it with `MSYS_NO_PATHCONV=1`:

```bash
MSYS_NO_PATHCONV=1 docker exec pocketbase /pb/pocketbase superuser upsert admin@example.com YourPassword!
```

**5. Create the required collections**

```bash
node scripts/setup-pocketbase.js
```

This creates the `venues`, `events`, `dispatchLogs`, `_storage`, and `settings` collections, plus an `isAdmin` field on the built-in `users` auth collection, and applies the access rules that keep editing or deleting someone else's venue, or ending someone else's event, restricted to that record's owner or an admin (mirrors this repo's `firestore.rules` — see the rule constants at the top of the script for exactly what each collection allows). It's idempotent — safe to run again any time, and re-applies those rules on every run even to collections that already existed, so a manual rule change made in the admin UI afterward will be reverted the next time this runs; change the script itself instead if you need different rules. **Do not skip this step**: without it, the `users` auth collection has no matching app schema yet, and signing up will fail with a "Failed to create record" error.

**6. Run the app**

The app is available at `http://localhost:3000`. The PocketBase admin UI is at `http://localhost:8090/_/`.

**7. (Optional) Grant yourself admin access**

One-time bootstrap step for Profile > Admin (e.g. managing the certification list):

```bash
PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=YourPassword! \
node scripts/setAdminPocketbase.js you@example.com
```

After signing in, that user can grant or revoke admin access for others from Profile > Admin > Manage Admins — the script is only needed once per deployment.

**8. Stopping and restarting**

```bash
docker compose down
```

Data (collections, records, and the superadmin account) persists in `.pb-data/` between restarts, so bringing the stack back up does not require repeating steps 4–5:

```bash
docker compose --env-file .env.local up -d
```

## Forgot-password emails & SMTP configuration

`PocketbaseAuthService.sendPasswordResetEmail` and `confirmPasswordReset` (`src/lib/services/pocketbase/PocketbaseAuthService.ts`) call PocketBase's built-in `requestPasswordReset` / `confirmPasswordReset` APIs directly — there is no custom reset-password backend logic layered on top in this repo (no `pb_hooks` directory is present; `Dockerfile.pocketbase` only copies `pb_hooks`/`pb_migrations` into the image if you uncomment those lines yourself). The app does add its own `/reset-password` page (`src/app/reset-password/page.tsx`) that reads a `token` (or `oobCode`) query parameter and submits it to `confirmPasswordReset` — this is what the reset email's link needs to point at.

Two things must be configured before "forgot password" actually works for your users, and neither is set automatically:

1. **Point the reset email at this app, not PocketBase's admin UI.** By default, PocketBase's built-in reset-password email template links to its own admin UI. In the admin UI (`/_/`), go to **Collections > users > Options > Email templates > Reset password** and change the action URL to:

   ```
   {APP_URL}/reset-password?token={TOKEN}
   ```

   replacing `{APP_URL}` with your deployed app's URL (e.g. `http://localhost:3000` for local dev).

2. **Configure outbound SMTP.** PocketBase does not send email out of the box. In the admin UI, go to **Settings > Mail settings** and enter your mail provider's SMTP host, port, and credentials (whatever provider your organization uses — PocketBase does not ship with one configured). This repo does not expose SMTP settings as environment variables or in `docker-compose.yml`; they're configured entirely through the admin UI and stored in `.pb-data/`, so they persist across `docker compose down` / `up` like everything else in that volume.

`scripts/setup-pocketbase.js` also prints a reminder of both of these steps after it finishes.

## Troubleshooting

- **`docker: command not found`** — Docker Desktop isn't installed, or isn't running. Confirm it's installed (see Prerequisites) and open before running any `docker compose` or `docker exec` command.
- **"Failed to create record" on sign-up** — the required collections haven't been created yet. Run `node scripts/setup-pocketbase.js` (step 5 above).
- **Sign-up rejects an otherwise-valid password** — PocketBase's default auth collection requires passwords to be at least 8 characters. This isn't currently enforced client-side, so a shorter password will fail at the PocketBase API instead of showing until submitted.
- **`docker exec pocketbase /pb/pocketbase superuser upsert ...` fails or behaves unexpectedly on Windows** — Git Bash is rewriting the `/pb/...` path. Prefix the command with `MSYS_NO_PATHCONV=1` as shown in step 4.

For a comparison against the Firebase path, see [`DEPLOYMENT.md`](DEPLOYMENT.md). For more guidance see `README.md`'s Quickstart section.
