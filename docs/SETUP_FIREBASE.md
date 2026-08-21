# Firebase Setup for CrowdCAD

This guide explains how to configure Firebase for local development and production deployments — one of two supported backends, alongside PocketBase (see [`SETUP_POCKETBASE.md`](SETUP_POCKETBASE.md)). Firebase is a good fit when your organization wants a managed cloud backend with HIPAA-eligible infrastructure (via a signed Google BAA); see [`DEPLOYMENT.md`](DEPLOYMENT.md) for a side-by-side comparison to help you choose. This guide complements `src/app/firebase.ts`, which contains the runtime initialization code.

Important: do not commit secrets (API keys or service account JSON) to the repository. Use environment files for local development and CI secrets for production.

## Required Firebase products

- Authentication (Email/Password, SSO providers as needed)
- Firestore (Realtime DB is not required by default)
- Cloud Storage (for uploaded assets)
- Hosting (for the frontend)

Optional: Cloud Functions if you add server-side integrations.

## Create a Firebase project

1. Go to https://console.firebase.google.com/ and create a new project.
2. Add a Web App; copy the config values from Project Settings.
3. Enable Firestore, Authentication providers you need, and Storage.

Record the Project ID — you will use it in `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and CI secrets.

## Fork and clone the repository

Since this is a shared project, start by creating your own copy rather than working directly against the upstream repository:

1. Go to https://github.com/evanqua/crowdcad and click **Fork** to create a copy under your own GitHub account.
2. Clone your fork (not the upstream repo):

```bash
git clone https://github.com/YOUR_USERNAME/crowdcad.git
cd crowdcad
```

3. Add the original repository as an `upstream` remote so you can pull in future updates — this is recommended so your fork doesn't fall behind:

```bash
git remote add upstream https://github.com/evanqua/crowdcad.git
```

Do all local development, environment configuration, and deployment described below from your fork.

## Local environment variables

Create a `.env.local` file in the project root with these variables (copy from `.env.example`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...your_api_key...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXX # optional
DISABLE_TELEMETRY=true
```

- `DISABLE_TELEMETRY=true` is recommended for production hosting when handling PHI to avoid accidental analytics capture.
- Firebase client config values (including the API key) are intentionally exposed to the browser — this is expected and normal for Firebase web apps. Access control is enforced by Firestore and Storage security rules, not by keeping the config secret. Service-account credentials and private keys must never appear in client code or be committed to the repository.

## Emulator Suite (recommended for testing rules)

Install and run the Firebase Emulator Suite for safe local testing of Firestore, Auth and Storage:

```bash
npm install -g firebase-tools
firebase emulators:start --only firestore,auth,storage
```

Use the emulators when developing Firestore rules and client workflows.

## Firestore & Storage security rules

- Design rules that enforce per-event authorization (e.g., documents contain `eventId` and reads/writes are allowed only when the user is a member of that event).
- Test rules with the Emulator or the `firebase rules:test` command.
- Example rule considerations:
  - Allow only authenticated users to write event logs.
  - Limit Storage uploads size and content type.

## Authentication

- For production consider enabling SSO providers (Google, OIDC) and enforce MFA for admin users.
- Create service accounts for CI and server-side tasks with least privilege.

## Granting admin access

CrowdCAD's app-level admin role (Profile > Admin — manages the certification list and other admins) is separate from Firebase IAM/service accounts above. It's a boolean `isAdmin` field on the user's `users/{uid}` Firestore document.

There's no signup-time or console way to set it, so the first admin on a deployment must be bootstrapped with a script:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
node scripts/setAdmin.js admin@example.com
```

This requires a service account JSON (Firebase Console > Project Settings > Service Accounts > Generate new private key). Once the first admin signs in, they can grant or revoke admin access for other users from the "Manage Admins" panel in Profile > Admin — the script is only needed once per deployment.

## Forgot-password emails

The "Forgot password?" link on the login screen uses Firebase Auth's built-in `sendPasswordResetEmail` — Firebase sends and delivers the email itself, no SMTP config needed. The only requirement is that your deployed domain (and `localhost` for local dev) is listed under **Authentication > Settings > Authorized domains** in the Firebase Console — this is usually already the case for any domain you're using to sign in, since Firebase Auth requires it for sign-in to work at all.

## Deploy to Firebase Hosting

Once local development is working, deploy with the Firebase CLI, setting the project explicitly:

```bash
firebase login
firebase use --add <PROJECT_ID>
npm run build
firebase deploy --project <PROJECT_ID>
```

**CI & production deploys**

- Store `FIREBASE_PROJECT` and `FIREBASE_TOKEN` (generated with `firebase login:ci`, or use Workload Identity Federation for tighter security) in your CI secrets.
- Keep the deployable build deterministic by pinning dependencies (`package-lock.json`).

Example GitHub Actions deploy snippet (minimal):

```yaml
name: Deploy
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
        env:
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.NEXT_PUBLIC_FIREBASE_API_KEY }}
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ secrets.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }}
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT }}
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ secrets.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }}
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
          NEXT_PUBLIC_FIREBASE_APP_ID: ${{ secrets.NEXT_PUBLIC_FIREBASE_APP_ID }}
      - name: Deploy to Firebase Hosting
        run: npx firebase-tools deploy --only hosting --project ${{ secrets.FIREBASE_PROJECT }} --token ${{ secrets.FIREBASE_TOKEN }}
```

**Post-deploy checks**

- Verify Firestore rules and Storage rules are active in the production project.
- Confirm the hosting URL and environment variables are correct.
- Run basic end-to-end checks: sign in, create an event, and create a sample dispatch log.

## Firewalls, BAAs, and compliance

- If you will manage PHI in Firestore/Storage, obtain a signed Google BAA for the Firebase/GCP project and ensure all third-party integrations are covered by BAAs. This managed-BAA path is the main reason organizations choose Firebase over PocketBase for PHI-handling deployments — see [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full comparison.
- Do not send PHI to analytics, crash-reporting, or third-party services unless there's a signed BAA covering them.

## Production checklist

- Signed Google BAA (if processing PHI).
- Firestore & Storage rules reviewed and tested.
- Admin accounts enforce MFA; service accounts follow least privilege.
- Telemetry disabled (`DISABLE_TELEMETRY=true`) or sanitized.
- Backups and exports configured, encrypted, and covered by BAAs where applicable.
- Documented incident response and breach notification plans; workforce HIPAA training as needed.

## Troubleshooting

- If Auth fails locally, ensure the emulator is running and your app is pointed at emulator endpoints.
- If Firestore rules block valid operations, run the Emulator with `FIREBASE_DEBUG=true` to collect logs.

For a comparison against the PocketBase path, see [`DEPLOYMENT.md`](DEPLOYMENT.md). For more guidance see the top-level `README.md`.
