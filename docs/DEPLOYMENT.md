# Deployment / Self‑Hosting Guide

This guide helps organizations deploy CrowdCAD into their own Firebase/GCP project so they retain full control of data (recommended for HIPAA).

> **Fork recommended.** If you plan to customize CrowdCAD for your organization, fork [`evanqua/crowdcad`](https://github.com/evanqua/crowdcad) on GitHub before cloning. Forking keeps your changes attributable, lets you receive upstream updates, and makes collaboration visible to the community. If you only want a read-only copy, cloning is fine.

Prerequisites
- Git, Node.js (18+), npm
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase/GCP project (create in Firebase Console)
- A signed Google BAA for the target Firebase/GCP project (required for HIPAA)

1) Fork then clone (recommended)

```bash
# Fork via GitHub UI first: https://github.com/evanqua/crowdcad
# Then clone your fork:
git clone https://github.com/<your-github-username>/crowdcad.git
cd crowdcad
```

Or clone directly (no fork):

```bash
git clone https://github.com/evanqua/crowdcad.git
cd crowdcad
```

2) Create a Firebase project (per-organization)
- In Firebase Console, click "Add project" → follow prompts.
- Note the **Project ID** (used as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`).
- Ensure Firestore, Firebase Authentication and Cloud Storage (for uploads) are enabled.
- Contact Google to sign the Google BAA for this project (must cover Firestore, Auth, Storage, Hosting, Cloud Functions if used).

3) Local environment variables
- Copy the example file and populate values from your Firebase project settings.

```bash
cp .env.example .env.local
# edit .env.local and paste values from Firebase Console > Project Settings > Your apps
```

Key vars (in `.env.local`)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
- `DISABLE_TELEMETRY=true` (recommended to prevent accidental PHI leakage to analytics)

4) Security rules (critical)
- Before allowing users, configure Firestore and Storage rules to enforce per-event authorization.
- Example: allow reads/writes only to authenticated users and only for documents where `eventId` equals a user’s permitted event membership. Customize to your org's model.
- Test rules with the Firebase Emulator or `firebase rules:test`.

5) Authentication
- Configure Firebase Authentication providers you need (email, SSO).
- Enforce strong passwords and enable MFA for admin accounts.
- Create a small list of admin service accounts with least-privilege IAM roles in GCP.

6) Install & run locally

```bash
npm install
npm run dev
# dev server runs at http://localhost:3000
```

7) Deploy to Firebase Hosting (optional)
- Use the Firebase CLI and set the project explicitly:

```bash
firebase login
firebase use --add <PROJECT_ID>
firebase deploy --project <PROJECT_ID>
```

For CI/CD (GitHub Actions): use a `FIREBASE_TOKEN` secret (generated with `firebase login:ci`) and run `firebase deploy --project $PROJECT_ID` in the workflow.

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

8) Disable telemetry and remove PHI from logs
- Set `DISABLE_TELEMETRY=true` in production env to prevent client-side telemetry.
- Review the app for `console.log` or analytics calls that might capture PHI; redact or guard them.

9) Backups, exports & third parties
- Ensure backups and any export destinations are encrypted and covered by BAAs.
- Do NOT send PHI to analytics, crash-reporting, or third-party services unless there's a signed BAA.

## CI & reproducible builds

- Keep the deployable build deterministic by pinning dependencies in `package.json` (`package-lock.json`).
- Store production Firebase project id in the CI secret `FIREBASE_PROJECT` and set `FIREBASE_TOKEN` or use GitHub's Workload Identity Federation for tighter security.

## Post-deploy checks

- Verify Firestore rules and Storage rules are active in the production project.
- Confirm hosting URL and environment variables are correct.
- Run basic end-to-end checks: sign-in, create an event, and create a sample dispatch log.

10) Operational & security checklist (minimum)
- Signed Google BAA for the project.
- MFA for admin users and strong IAM roles for service accounts.
- Firestore & Storage rules tested and enforced.
- Audit logging enabled and retained per policy.
- Encrypted backups with access controls.
- Documented incident response and breach notification plans.
- Workforce HIPAA training.

Notes
- This repo uses `NEXT_PUBLIC_` env vars for Firebase config. Each organization must supply values from their own Firebase project — never reuse another project's credentials.
- If you want the maintainers to host for you (SaaS), a separate BAA and an operational HIPAA program is required on the maintainer side.
