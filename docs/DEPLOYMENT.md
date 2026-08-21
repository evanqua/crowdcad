# Deployment / Self-Hosting Guide

CrowdCAD supports two backends. Both are first-class, fully supported deployment paths — pick whichever fits your organization's requirements and preferences. This guide helps you choose; once you've decided, follow the matching step-by-step setup guide:

- **[`SETUP_FIREBASE.md`](SETUP_FIREBASE.md)** — managed cloud backend on Firebase/GCP.
- **[`SETUP_POCKETBASE.md`](SETUP_POCKETBASE.md)** — self-hosted backend on your own machine or LAN, via Docker.

> **Fork recommended.** If you plan to customize CrowdCAD for your organization, fork [`evanqua/crowdcad`](https://github.com/evanqua/crowdcad) on GitHub before cloning, regardless of which backend you choose. Forking keeps your changes attributable, lets you receive upstream updates, and makes collaboration visible to the community. If you only want a read-only copy, cloning is fine.

## Choosing a backend

| | **Firebase** | **PocketBase** |
|---|---|---|
| Infrastructure | Managed by Google Cloud | Self-hosted (Docker, your machine or LAN) |
| Cloud account required | Yes (Firebase/GCP project) | No |
| HIPAA path | Signed Google BAA covers Firestore, Auth, Storage, Hosting | No managed BAA — your organization owns compliance for infrastructure it runs |
| Ops responsibility | Google manages uptime, scaling, patching | Your organization manages the server, backups, and updates |
| Cost model | Usage-based cloud billing | Your own hosting cost (can be $0 on existing hardware) |
| Good fit for | Organizations that want a managed cloud backend and are prepared to sign a Google BAA for PHI | Organizations that want full data locality (e.g., no data leaving a venue's LAN), no recurring cloud cost, or no cloud account at all |
| Setup guide | [`SETUP_FIREBASE.md`](SETUP_FIREBASE.md) | [`SETUP_POCKETBASE.md`](SETUP_POCKETBASE.md) |

Neither option is the "default" — both are maintained in parallel (`NEXT_PUBLIC_BACKEND=firebase` or `pocketbase`), and the choice comes down to your organization's infrastructure, compliance, and operational preferences rather than a technical limitation of the app itself.

## Common prerequisites

- Git, Node.js (18+), npm
- A fork of the repo (recommended) or a direct clone

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

From here, follow [`SETUP_FIREBASE.md`](SETUP_FIREBASE.md) or [`SETUP_POCKETBASE.md`](SETUP_POCKETBASE.md) for backend-specific environment variables, local setup, and deployment steps — each guide is self-contained through to a running production deployment.

## General operational guidance (both backends)

- **Security rules / access control** — Firebase enforces access via Firestore/Storage security rules; PocketBase enforces access via collection rules. Test both with their respective tooling before allowing real users.
- **Authentication** — enforce strong passwords and MFA for admin accounts where the backend supports it.
- **Telemetry & logs** — set `DISABLE_TELEMETRY=true` in production and review the app for `console.log` or analytics calls that might capture PHI.
- **Backups** — ensure backups and any export destinations are encrypted and, if handling PHI under Firebase, covered by BAAs.
- **Least privilege** — scope service accounts and admin roles narrowly regardless of backend.

## Post-deploy checks (both backends)

- Confirm the hosting URL and environment variables are correct.
- Run basic end-to-end checks: sign in, create an event, and create a sample dispatch log.
- Verify security rules (Firestore/Storage rules, or PocketBase collection rules) are active in the production environment.

## Notes

- Each organization must supply its own backend credentials — never reuse another organization's Firebase project or PocketBase instance.
- If you want the maintainers to host for you (SaaS), a separate BAA and an operational HIPAA program is required on the maintainer side; this is independent of which backend you self-host.
