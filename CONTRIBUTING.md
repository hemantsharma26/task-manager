# Contributing

## Branches

| Branch        | Purpose                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `main`        | Always releasable. Every commit on it is a tested, tagged-or-taggable release.            |
| `develop`     | Integration branch. Features land here first and are tested together.                     |
| `feature/*`   | One feature each, branched from `develop`, merged back by pull request.                   |
| `fix/*`       | A bug fix, branched from `develop` (or from `main` for an urgent `hotfix/*`).             |
| `chore/*`     | Tooling, dependencies, docs.                                                              |

Releases: when `develop` is ready, open a pull request `develop` → `main`, let CI pass, merge, and tag it
`vMAJOR.MINOR.PATCH` (semantic versioning). `v1.0.0` is the first release.

`main` and `develop` are protected: changes arrive through pull requests with a green CI run.

## Commits

Short, imperative subject (`Add column limit`), and a body that says **why** when it is not obvious.
Conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`) are welcome.

## Before opening a pull request

```bash
npm run typecheck
npm test
```

Both must pass (CI runs them too). New behaviour needs a test. Anything configurable goes through
`server/.env.example`, and strings belong in `server/src/constants/`.
