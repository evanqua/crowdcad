# Contributing to CrowdCAD

Thank you for helping improve CrowdCAD — contributions of all kinds are welcome.

Please read this document together with `CODE_OF_CONDUCT.md`, `LICENSE.md`, and `SECURITY.md` before contributing.

## Table of contents

- Ways to contribute
- Getting started (local dev)
- Branching & commit guidelines
- Issues and pull request templates
- Testing & quality
- Documentation contributions
- Code of conduct and license
- Maintainers & contact

## Ways to contribute

- Report bugs or unexpected behaviour.
- Propose or implement features.
- Improve documentation, examples, and tutorials.
- Fix bugs and add or extend tests.
- Improve accessibility, UX, and performance.

## Getting started (local development)

1. Fork the repository on GitHub and clone your fork locally:

```bash
git clone https://github.com/<your-username>/crowdcad.git
cd crowdcad
```

2. Install dependencies and run the development server from the app folder:

```bash
cd dispatch-app
npm install
npm run dev
```

The app runs using Next.js (App Router). See `dispatch-app/README.md` or the top-level `README.md` for more details about Firebase configuration.

## Branching & commit guidelines

- Create a feature branch named with one of these prefixes: `feature/`, `fix/`, `chore/`, `docs/`, `test/`.
- Example: `git checkout -b feature/add-venue-search`.
- Keep pull requests focused and small when possible.
- Write clear commit messages: a short subject in imperative mood, blank line, and an optional longer body. Example:

```
feat(events): add venue search by radius

Adds a simple radius-based venue search used by event organizers.
```

## Issues

- Search existing issues before opening a new one to avoid duplicates.
- For bug reports include: steps to reproduce, expected vs actual behavior, environment details (CrowdCAD version/commit, OS, browser), and relevant logs or screenshots (avoid secrets).
- For feature requests describe the problem, proposed solution, and any UX considerations.
- If you discover a security issue, do NOT open a public issue — see `SECURITY.md` for reporting instructions.

## Pull requests

When opening a PR, include:

- A short title and descriptive summary of the change.
- The motivation: why this change is needed.
- Any related issue references (e.g., `Fixes #123`).
- A checklist in the PR description (example):

```
- [ ] I have tested these changes locally
- [ ] I added/updated tests where applicable
- [ ] I updated documentation where applicable
- [ ] This change follows the repository's coding style
```

Small PRs are easier to review. If work is exploratory, prefer opening a draft PR and request feedback.

## Testing & quality

- Run linters and tests before opening a PR (if applicable):

```bash
cd dispatch-app
npm run lint
# run tests if the project has a test script
npm test
```

- Add unit or integration tests for new features when possible.

## Documentation contributions

- Improve or expand the top-level `README.md` or `dispatch-app` documentation.
- Prefer linking to public feature pages (for screenshots and demos): https://crowdcad.org/features
- Keep documentation clear, concise, and accessible.

## Code of conduct and license

By contributing you agree that your contributions will be licensed under the project license (GNU Affero General Public License v3.0 — see `LICENSE.md`). If you cannot license your contribution under AGPL‑3.0, please discuss it with the maintainers before submitting.

Please follow `CODE_OF_CONDUCT.md` when interacting with the project, maintainers, and community.

## Maintainers & contact

- Evan Passalacqua — @evanqua
- Ivan Zhang — @iv-zhang

If you need help or have questions about contributions, open an issue labeled `question` or contact the maintainers directly. For security reports, follow `SECURITY.md`.

Thank you — we appreciate your time and help!