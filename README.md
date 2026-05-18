# CrowdCAD

[![CI](https://github.com/evanqua/crowdcad/workflows/CI/badge.svg)](https://github.com/evanqua/crowdcad/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE.md)
[![Version](https://img.shields.io/badge/version-1.2.0-green.svg)](CHANGELOG.md)
[![DOI](https://zenodo.org/badge/1169795235.svg)](https://doi.org/10.5281/zenodo.18864888)


CrowdCAD is an open-source, browser-based Computer-Aided Dispatch (CAD) system for volunteer EMS and event medical teams. Full developer and operational documentation lives in the `docs/` folder and in policy files. The demo with further information can be found at [crowdcad.org](https://crowdcad.org)

#### Quick links

- **User guide:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Component patterns:** [docs/COMPONENTS.md](docs/COMPONENTS.md)
- **Firebase & setup:** [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
- **Self-hosting (Firebase):** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Self-hosting (PocketBase):** see [PocketBase section](#pocketbase-self-hosted--lan) below
- **Contributing guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Code of Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- **Changelog / Releases:** [CHANGELOG.md](CHANGELOG.md)
- **Security & reporting:** [SECURITY.md](SECURITY.md)
- **License:** [LICENSE.md](LICENSE.md)

#### Quickstart

**With Docker + PocketBase (Recommended for local/LAN, no cloud account required)**

1. Copy and configure the environment file:
```bash
cp .env.example .env.local
```

In `.env.local`, set the following values:
```env
NEXT_PUBLIC_BACKEND=pocketbase
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=YourPassword!
```

2. Build and start the containers:
```bash
docker compose --env-file .env.local up -d --build
```

3. Create the PocketBase superadmin (first time only — skippable on subsequent runs since data is persisted in `.pb-data/`):
```bash
docker exec pocketbase /pb/pocketbase superuser upsert admin@example.com YourPassword!
```
> Use the same email and password as defined in `PB_ADMIN_EMAIL` and `PB_ADMIN_PASSWORD` in your `.env.local`.

4. Create the required collections (first time only):
```bash
node scripts/setup-pocketbase.js
```

5. The app is available at `http://localhost:3000` and the PocketBase admin UI at `http://localhost:8090/_/`.

To stop the stack: `docker compose down`. Your data is preserved in `.pb-data/` and will be available on the next `docker compose up`.

**With Docker + Firebase**

1. Secure your environment variables (see Firebase setup below):
```bash
cp .env.example .env.local
# Edit .env.local and paste values from your Firebase project settings
# Leave NEXT_PUBLIC_BACKEND unset or set it to "firebase"
```

2. Build and run the container:
```bash
docker compose --env-file .env.local up --build -d
```

3. The dev server will run at `http://localhost:3000`. To stop it, run `docker compose down`.

**Without Docker**

1. Fork then clone (recommended — preserves attribution and lets you receive upstream updates):

```bash
# Fork via GitHub first: https://github.com/evanqua/crowdcad
# Then clone your fork:
git clone https://github.com/<your-github-username>/crowdcad.git
cd crowdcad
npm install
npm run dev
```

Or clone directly without forking:

```bash
git clone https://github.com/evanqua/crowdcad.git
cd crowdcad
npm install
npm run dev
```

2. The dev server runs at `http://localhost:3000`.

3. For Firebase configuration, follow the instructions in [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md). The runtime initializer is at `src/app/firebase.ts`.

Environment example

Copy `.env.example` to `.env.local` and fill your Firebase values before running locally. Do not commit your `.env.local`:

```bash
cp .env.example .env.local
# edit .env.local and paste values from your Firebase project settings
```


#### PocketBase (self-hosted / LAN)

PocketBase is the recommended backend for local or LAN deployments — no cloud account required and all data stays on your machine.

**1. Download PocketBase**

Download the binary for your platform from [pocketbase.io/docs](https://pocketbase.io/docs) and place it at the root of the project (or anywhere — adjust the path accordingly).

**2. Create the superadmin and start the server**

```bash
# Create (or update) the superadmin account
./pocketbase superuser upsert admin@example.com YourPassword!

# Start PocketBase accessible on the whole LAN (port 8090)
./pocketbase serve --http=0.0.0.0:8090
```

The admin UI is available at `http://<LAN-IP>:8090/_/`.

**3. Set environment variables**

```bash
cp .env.example .env.local
```

In `.env.local`:

```env
NEXT_PUBLIC_BACKEND=pocketbase
NEXT_PUBLIC_POCKETBASE_URL=http://192.168.x.x:8090   # LAN IP of the machine running PocketBase
DISABLE_TELEMETRY=true

# Used by the setup script (not read by the app)
PB_URL=http://192.168.x.x:8090
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=YourPassword!
```

Use the LAN IP address (not `localhost`) so every device on the network can connect.

**4. Create collections**

Run the setup script once after PocketBase starts. It creates all required collections and is fully idempotent (safe to run multiple times):

```bash
node scripts/setup-pocketbase.js
```

**5. Run the app**

```bash
npm install
npm run dev
# or for production:
npm run build && npm start
```

The app will be available at `http://localhost:3000` and will communicate with PocketBase via the URL you configured.

#### Testing

The E2E suite uses Playwright BDD with Firebase emulators. The test runner starts the emulators and a production build of Next.js automatically — no manual server setup required.

**Prerequisites**

- [Firebase CLI](https://firebase.google.com/docs/cli) installed globally (`npm install -g firebase-tools`)
- Playwright browsers installed: `npx playwright install --with-deps chromium`

**First-time setup**

```bash
cp .env.test.local.example .env.test.local
# .env.test.local already contains working defaults for the emulator — no edits needed
```

**Run the full suite**

```bash
npm run test:e2e
```

This runs `bddgen` (generates Playwright spec files from the `.feature` files) then `playwright test`. The emulators and app server start and stop automatically.

**Other modes**

```bash
npm run test:e2e:ui     # Playwright UI — interactive test explorer
npm run test:e2e:debug  # Step through tests with the Playwright inspector
```

After a run, an HTML report is generated in `playwright-report/`. Open it with:

```bash
npx playwright show-report
```

#### When to read the other docs

- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before making cross-cutting changes.
- Read [docs/COMPONENTS.md](docs/COMPONENTS.md) before adding UI components or modals.
- Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) for self-hosting and compliance guidance (BAA, rules, backups).
- See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for operator-facing workflows and screenshots.

#### Reporting and policies

- Report security issues per [SECURITY.md](SECURITY.md).
- Community expectations are in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

#### Contributing

Please consult [CONTRIBUTING.md](CONTRIBUTING.md) for workflow and PR guidance. For small changes, open a branch, push and create a PR for review.

#### Community & visibility

CrowdCAD's mission is to make volunteer event medical services safer and more effective. To help the project reach as many organizations as possible:

- Please fork the repository on GitHub when adopting or modifying CrowdCAD. Forks preserve attribution and make upstream collaboration visible.
- Star and watch the repo if you use it; forks, stars and PRs are public signals that help discoverability.
- If you use CrowdCAD for your organization, consider linking back to this repository in your README or site to help others find the project.

#### Support / Contact

For questions, security reports, or hosting inquiries, email: support@crowdcad.org

#### Acknowledgements

CrowdCAD is built by volunteers and maintainers listed in the project metadata. See the individual docs for maintainers and contact details.

CrowdCAD is an open-source software framework. It does not provide HIPAA compliance out of the box. Organizations hosting CrowdCAD are solely responsible for ensuring their implementation meets applicable legal and regulatory requirements, including HIPAA.

CrowdCAD contributors assume no responsibility for how this software is used.
