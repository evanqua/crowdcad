# CrowdCAD

[![CI](https://github.com/evanqua/crowdcad/workflows/CI/badge.svg)](https://github.com/evanqua/crowdcad/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE.md)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](CHANGELOG.md)
CrowdCAD is an open-source, browser-based Computer-Aided Dispatch (CAD) system for volunteer EMS and event medical teams. Full developer and operational documentation lives in the `docs/` folder and in policy files. The demo with further information can be found [crowdcad.org](https://crowdcad.org)

#### Quick links

- **User guide:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Component patterns:** [docs/COMPONENTS.md](docs/COMPONENTS.md)
- **Firebase & setup:** [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
- **Self-hosting:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Contributing guide:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Code of Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- **Changelog / Releases:** [CHANGELOG.md](CHANGELOG.md)
- **Security & reporting:** [SECURITY.md](SECURITY.md)
- **License:** [LICENSE.md](LICENSE.md)

#### Quickstart

1. Clone the repo and open the `dispatch-app` workspace:

```bash
git clone git@github.com/evanqua/crowdcad.git
cd dispatch-app
npm install
npm run dev
```

2. The dev server typically runs at `http://localhost:3000`.

3. For Firebase configuration, follow the instructions in [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md). The runtime initializer is at `dispatch-app/src/app/firebase.ts`.

Environment example

Copy ` .env.example` to `.env.local` and fill your Firebase values before running locally. Do not commit your `.env.local`:

```bash
cp .env.example .env.local
# edit .env.local and paste values from your Firebase project settings
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