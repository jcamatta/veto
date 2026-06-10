# Git installability: `npm i -D github:jcamatta/veto` must work

## Motivation

veto is not published to npm; the natural install path for other projects
is the GitHub repo. Today that install is broken: for a git dependency npm
installs the repo's devDependencies and runs the `prepare` script to build
the package from source, then packs only the `files` whitelist (`dist/`).
Our `prepare` runs `husky` — nothing builds `dist/`, so the consumer gets
an empty package, and `husky` itself errors in the extracted tarball
context where no `.git` exists.

## Behavior

- `npm i -D github:jcamatta/veto` (and `#<branch|tag|commit>` refs) yields
  a working package: `dist/cli.js` built during install, `veto` bin wired.
- A normal dev checkout (`npm i` inside the repo) still installs the husky
  hooks exactly as today.
- A build failure must fail the install loudly — do not mask `tsup` errors
  behind `|| true`.

## Implementation notes (for a cold start)

- Replace `"prepare": "husky"` in `package.json` with
  `"prepare": "node scripts/prepare.mjs"`.
- `scripts/prepare.mjs` (plain Node, ESM, no deps):
  1. Run the build: `execSync('npx tsup', { stdio: 'inherit' })` — always,
     so both git installs and dev checkouts produce `dist/`.
  2. Install hooks only in a real checkout: if `existsSync('.git')` (and
     not CI, if desired), dynamically `import('husky')` and run it;
     otherwise skip silently. This is the husky-documented guard pattern.
  3. Exit non-zero if the build throws (default `execSync` behavior).
- `scripts/` is outside `src/**`, so eslint hexagon rules and the
  src-only limits do not apply; keep the script under ~25 lines anyway.
- The commit-size hook counts `scripts/prepare.mjs` + `package.json` as
  source, but the total stays well under the 30-line tests-required
  threshold; no unit tests are expected for the install script.

## Verification (do this before opening the PR)

- `npm pack` in the repo → the tarball contains `dist/cli.js`.
- From a temp directory, install the **branch** ref before merge:
  `npm i github:jcamatta/veto#<this-branch>` → `npx veto --help` prints the
  CLI help; `node_modules/veto/dist/cli.js` exists.
- `npm i` in the repo itself still installs hooks (`.husky/_` refreshed)
  and a test commit on the branch still runs the pre-commit gates.

## Steps

- [x] 1. `scripts/prepare.mjs` + `package.json` `prepare` swap.
- [x] 2. Run the verification list above and record results in the PR body.
- [x] 3. Docs: README Install section gains the GitHub install command
  (with a note on pinning `#<tag|commit>`), FILES.md entries for
  `scripts/prepare.mjs` and the `package.json` description update.
