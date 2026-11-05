# release-sandbox

A rehearsal of the release process planned for entry-fi/web-libs, on three
tiny packages published to GitHub Packages:

| Package                     | Shape                                            |
| --------------------------- | ------------------------------------------------ |
| `@olegshilov/sandbox-alpha` | a leaf: exports `greet()`                        |
| `@olegshilov/sandbox-beta`  | depends on alpha (`workspace:*`)                 |
| `@olegshilov/sandbox-gamma` | optional peer of alpha (`^0.1.0`), dev dep on it |

## How a change is released

1. A pull request changes code and adds a changeset (`pnpm changeset`) naming
   each package it changes and the bump. CI (`ci`) fails if a changed package
   is not named, unless the PR is labelled `no-release`.
2. After it merges, the Release workflow opens or updates the
   **"chore(release): version packages"** PR: versions, changelogs and the
   consumed changesets, nothing else.
3. Merging that PR (one owner approval, re-required after every update) puts
   the new versions on main. The Release workflow publishes every version the
   registry does not have yet, then tags `<name>@<version>` and creates a
   GitHub Release from the changelog section.

Publishing follows state, not events: any run publishes whatever is missing,
so a failed or skipped run is repaired by the next one. Recovery is
**Re-run all jobs** (or "Run workflow" on Release), never "Re-run failed jobs".
Only a run of the newest main commit updates the release PR, so re-running an
old run is safe.

## Files that make up the release process

| File                              | Role                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `.changeset/config.json`          | Changesets v3: changelog format, what counts as a change                                    |
| `.github/workflows/ci.yml`        | the `ci` check on every PR                                                                  |
| `.github/workflows/release.yml`   | pack, publish, release PR                                                                   |
| `.github/workflows/preview.yml`   | snapshot versions of a PR labelled `preview`                                                |
| `scripts/check-release-files.mjs` | PR side: changesets cover changes; versions are the release PR's, and it holds nothing else |
| `scripts/check-publish-plan.mjs`  | never publish 0.0.0 or a version without a changelog entry                                  |
| `scripts/github-releases.mjs`     | tag and GitHub-release every published version                                              |
| `.github/rulesets/main.json`      | branch rules for main (applied with `gh api`)                                               |
| `.github/CODEOWNERS`              | the release PR needs the owner's approval                                                   |

The rehearsal itself is in [REHEARSAL.md](REHEARSAL.md).

## Development

```sh
pnpm install
pnpm check   # format, lint, build, test
```

Node 24 (`.nvmrc`), pnpm 12 (`packageManager`), TypeScript 7 (`tsc -b`),
vitest, oxlint, oxfmt.
