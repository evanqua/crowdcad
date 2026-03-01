# Firebase Setup for CrowdCAD

This guide explains how to configure Firebase for local development and production deployments. It complements `src/app/firebase.ts` which contains the runtime initialization code.

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

## CI & production deploys

- Store `FIREBASE_PROJECT` and `FIREBASE_TOKEN` (or use Workload Identity Federation) in your CI secrets.
- Use the GitHub Actions snippet in `docs/DEPLOYMENT.md` or your preferred CI provider to run `npm run build` and `firebase deploy` from the project root.

## Firewalls, BAAs, and compliance

- If you will manage PHI in Firestore/Storage, obtain a signed Google BAA for the Firebase/GCP project and ensure all third-party integrations are covered by BAAs.

## Production checklist

- Signed Google BAA (if processing PHI).
- Firestore & Storage rules reviewed and tested.
- Admin accounts enforce MFA.
- Service accounts follow least privilege.
- Telemetry disabled or sanitized.
- Backups and exports configured and encrypted.

## Troubleshooting

- If Auth fails locally, ensure the emulator is running and your app is pointed at emulator endpoints.
- If Firestore rules block valid operations, run the Emulator with `FIREBASE_DEBUG=true` to collect logs.

For more deployment guidance see `docs/DEPLOYMENT.md` and the top-level `README.md`.
