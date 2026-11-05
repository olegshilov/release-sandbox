# Rehearsal

The live rehearsal of the release process on GitHub. Do **Setup** once, then
the scenarios in order: each starts from the versions the previous one left.

- `R` is the open "chore(release): version packages" pull request.
- Read the registry from this checkout (its `.npmrc` maps the scope) with a
  classic PAT that has `read:packages` in `~/.npmrc`
  (`//npm.pkg.github.com/:_authToken=<PAT>`):
  `npm view @olegshilov/sandbox-alpha dist-tags versions peerDependencies dependencies`.
- For every scenario record: the Release run URL, R's diff, and anything that
  differed from **Expected**. Where a step says "record", the answer is one of
  the open questions for web-libs (listed at the end).

## Setup on GitHub

1. **The repository** is public, by the user's choice (2026-11-05), so the
   packages published from it come out public too — harmless for three
   README-only libraries. web-libs stays private; open question 2 is answered
   there, not here.
   ```sh
   gh repo view olegshilov/release-sandbox --json visibility   # PUBLIC
   git remote add origin git@github.com:olegshilov/release-sandbox.git
   ```
2. **Repository settings, labels.**
   ```sh
   gh api -X PATCH repos/olegshilov/release-sandbox \
     -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
     -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
     -F delete_branch_on_merge=true -F allow_auto_merge=false -F allow_update_branch=true
   gh api -X PUT repos/olegshilov/release-sandbox/actions/permissions/workflow \
     -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
   gh label create no-release --color ededed --description "Changes package files without releasing them"
   gh label create preview --color 1d76db --description "Publish snapshot versions under the pr-<N> dist-tag"
   gh label create release-1.0 --color b60205 --description "Allows a major changeset on a 0.x package (publishes 1.0.0)"
   ```
3. **First push** (the only direct push to main; no ruleset exists yet):
   `git push -u origin main`.
   - Expected Release run, green: `pack` logs `was not found in the registry`
     and `skip … @0.0.0: never released` for all three; `publish` logs "No
     unpublished projects to publish."; no package and no tag. The App
     (Setup 4) was set up before this push, so `version` runs and opens the
     first `R` from `.changeset/initial-release.md`: 0.1.0 for all three. If the
     App is missing, `version` is skipped with the warning **"Release PR not
     updated"** instead.
   - Record: the `GITHUB_TOKEN` (`packages: read`) asked for three packages
     that do not exist. 404 means "not published" and the run is green. A 403
     stops `pack` red, and nothing can ever publish. Fallback: a classic PAT
     with `read:packages` as secret `PACKAGES_READ_TOKEN`, and in `pack`'s
     "authenticate" step
     `NODE_AUTH_TOKEN: ${{ secrets.PACKAGES_READ_TOKEN || github.token }}`
     (a direct push: the ruleset is not on yet).
   - Record: the `pack` artifact holds only `publish-plan.json`, and
     `publish` downloads it without error.
4. **The release App** — done on 2026-11-05: `olegshilov-release-sandbox`,
   installed on this repository only, variable `RELEASE_APP_CLIENT_ID` and
   secret `RELEASE_APP_KEY` set. To redo it, on the personal account (no
   organisation admin involved): Settings → Developer settings → GitHub Apps →
   New GitHub App.
   - Name e.g. `olegshilov-release-bot`, homepage the repository URL, webhook
     off.
   - Repository permissions: **Contents: Read and write**, **Pull requests:
     Read and write** (Metadata: Read is implied). "Only on this account".
   - Install it on `release-sandbox` only. Generate a private key.
   ```sh
   gh variable set RELEASE_APP_CLIENT_ID --body <Client ID from the App page>
   gh secret set RELEASE_APP_KEY < ~/Downloads/<app>.private-key.pem
   ```
   The client ID is a variable, not a secret: `create-github-app-token` v3
   takes `client-id` and has deprecated `app-id`.
5. **Ruleset for main**, from the file in this repository:
   `gh api -X POST repos/olegshilov/release-sandbox/rulesets --input .github/rulesets/main.json`.

   | Rule                                                      | Setting                                                                          | Why                                                                                        |
   | --------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
   | `pull_request`                                            | squash only; 0 approvals; code owner review; stale approvals dismissed on push   | R needs the owner (it is the only PR that touches a CHANGELOG.md); feature PRs need nobody |
   | `required_status_checks`                                  | `ci` from GitHub Actions (`integration_id` 15368), branch need not be up to date | a red PR cannot merge; a stale R can (scenario 9)                                          |
   | `deletion`, `non_fast_forward`, `required_linear_history` | on                                                                               | main is append-only                                                                        |
   | `bypass_actors`                                           | none                                                                             | nobody, the App included, pushes to main                                                   |

   If the API answers **403 "Upgrade to GitHub Pro or make this repository
   public"**, the account is on GitHub Free, where rulesets and CODEOWNERS are
   not enforced on private repositories. Pick one:
   - GitHub Pro (enforces rulesets, CODEOWNERS and environments on private
     repositories);
   - rehearse by convention: never merge a red PR, approve R before merging
     it, and mark the "blocked" expectations in scenarios 2-6 "observed, not
     enforced";
   - make the repository public **only if Oleg agrees**, and only after
     scenario 2 has created the packages and their settings page shows
     **Private**.

6. **Packages**, after scenario 2 created them. For each of
   `https://github.com/users/olegshilov/packages/npm/sandbox-{alpha,beta,gamma}/settings`:
   visibility **Private**; "Manage Actions access" lists `release-sandbox`
   with **Write** or **Admin** and no other repository; the package page links
   to the repository. Record what GitHub set by itself.

## 1. First release PR

Steps:

1. Check the dispatch guard: `git switch -c dispatch-check && git push -u origin dispatch-check`,
   then `gh workflow run release.yml --ref dispatch-check`. Delete the branch
   afterwards.
2. `gh workflow run release.yml` (on main).

Expected:

- 1: a Release run whose three jobs are all **skipped**: a dispatch from any
  branch but main publishes nothing and opens no PR.
- 2: R opens, authored by the App: alpha, beta, gamma `0.0.0 → 0.1.0`, three
  CHANGELOG.md with `## 0.1.0 / ### Minor Changes / - First release.`,
  `.changeset/initial-release.md` deleted. Gamma's peer stays `^0.1.0`.
- `ci` runs on R (a push by an App triggers workflows) and passes with
  "Release PR: versions, changelogs and consumed changesets only."
- Record the changelog-github format on a private repository (commit and PR
  links, the "Thanks @…" line).
- With the ruleset on: R's merge box says a code owner review is required.
  If it does not, `require_code_owner_review` is ignored at 0 required
  approvals: set `required_approving_review_count` to 1 and record it (a sole
  owner then cannot merge his own feature PRs without a bypass).

## 2. First publish

Steps: try to merge R without a review; approve it; squash-merge.

Expected:

- Before the approval merging is blocked.
- Release run: publishes `alpha@0.1.0`, `beta@0.1.0`, `gamma@0.1.0` with
  `GITHUB_TOKEN` and `--access restricted`, which creates the three packages.
  Tags `@olegshilov/sandbox-{alpha,beta,gamma}@0.1.0` on the merge commit, three
  GitHub Releases whose body is the `## 0.1.0` section. `version` is skipped
  (no changesets left), without a warning.
- Registry: `latest` = `0.1.0` for each; `beta@0.1.0` depends on
  `@olegshilov/sandbox-alpha: 0.1.0`; gamma's peer is `^0.1.0`, optional.
- Record: `gh` is on the runner, `gh release create --target` created each tag
  on `GITHUB_SHA`.
- Then **Re-run all jobs** on that run: green, publishes nothing, creates
  nothing.
- Now do Setup step 6.

## 3. PR without a changeset, then a patch

Steps: branch `s3`, add a JSDoc sentence to `packages/alpha/src/index.ts`, PR
`fix(alpha): clarify greet docs`. Then `pnpm changeset` → alpha → patch, push.

Expected:

- First push: `ci` red at "changesets and release files": "Changed without a
  changeset in this PR: @olegshilov/sandbox-alpha." Merge blocked.
- With the changeset: green. Squash-merge (no approval: no owned file).
- Release run publishes nothing, then R opens: **alpha 0.1.1, beta 0.1.1**
  (beta: "Updated dependencies"). **Gamma is not bumped**, but
  `packages/gamma/package.json` is in R with its peer narrowed
  `^0.1.0 → ^0.1.1` (see "Known behaviour").

## 4. A hand-made commit on the release PR

Steps: with R open, push a source change onto its branch:

```sh
git fetch origin changeset-release/main && git switch changeset-release/main
echo '// not from changeset version' >> packages/alpha/src/index.ts
git commit -am "chore: sneak a change into the release PR" && git push
```

Then `gh workflow run release.yml`.

Expected:

- `ci` on R is red: "The release PR changes only versions, changelogs and the
  changesets it consumed. Not from `changeset version`: M
  packages/alpha/src/index.ts". Merge blocked.
- The dispatched run rebuilds R from main (force-push by the App): the stray
  commit is gone, `ci` green, R as in scenario 3.

## 5. `no-release` label, README-only PR

Steps: approve R, do not merge it. Branch `s5`: a comment line in
`packages/gamma/src/index.ts`, PR `chore(gamma): comment`. Watch `ci` fail, add
the `no-release` label, merge. Then a PR that only appends a line to
`packages/alpha/README.md`, merge.

Expected:

- `ci` red, then re-run on `labeled` and green: "no-release label: not
  releasing @olegshilov/sandbox-gamma."
- After each merge the App re-pushes R with the same diff. Record whether R's
  approval survived: stale approvals are dismissed only by pushes that change
  the diff.
- The README-only PR needs neither changeset nor label.

## 6. Approval dismissed by an update

Steps: make sure R is approved. Branch `s6`: add
`export function greetBoth(a: string, b: string)` to `packages/beta/src/index.ts`,
changeset beta → minor, PR `feat(beta): greetBoth`, merge.

Expected: R becomes **alpha 0.1.1, beta 0.2.0**; the approval is dismissed and
merging is blocked again. Re-approve, merge: publishes `alpha@0.1.1`,
`beta@0.2.0` (two tags, two releases). Gamma stays `0.1.0`; its narrowed peer
line is now on main, unreleased.

## 7. Minor on alpha: dependents and the peer rule

Steps: branch `s7`: add `export function farewell(name: string)` to alpha,
changeset alpha → minor, PR `feat(alpha): farewell`, merge, then approve and
merge R.

Expected: R is **alpha 0.2.0, beta 0.2.1, gamma 0.1.1**; gamma's peer becomes
`^0.2.0`. This is the row that chose Changesets v3: v2 makes gamma `1.0.0`
here. The published `gamma@0.1.1` has peer `^0.2.0`.

## 8. Multi-package PR

Steps: branch `s8` changing `packages/alpha/src/index.ts` and
`packages/gamma/src/index.ts`, with a changeset naming only alpha → patch.
Watch `ci`, then add `'@olegshilov/sandbox-gamma': minor` to the changeset,
merge, approve and merge R.

Expected: `ci` red first: "Changed without a changeset in this PR:
@olegshilov/sandbox-gamma.", then green. R: **alpha 0.2.1, beta 0.2.2, gamma
0.2.0** (gamma's own minor; its peer becomes `^0.2.1`). One merge publishes
three packages.

## 9. Stale release PR and dropped runs

Steps:

1. Branch `s9a`: alpha patch (source line + changeset), merge. R: **alpha
   0.2.2, beta 0.2.3** (gamma's peer `→ ^0.2.2`, gamma not bumped). Do not
   merge R.
2. `gh workflow disable release.yml`: pushes now start no Release run.
3. Branch `s9b`: beta source change + changeset beta → minor, merge.
4. Approve and merge R as it is. It predates `s9b`, so it is stale; the
   ruleset does not require up-to-date branches, so GitHub allows it.
5. `gh workflow enable release.yml && gh workflow run release.yml`.

Expected: the dispatched run publishes **alpha 0.2.2, beta 0.2.3** from the
current main (the two pushes that started no run lose nothing), tags and
releases them, then opens R: **beta 0.3.0** from s9b's changeset. No version is
skipped or burned. Known consequence: s9b's code shipped inside beta 0.2.3,
and its changelog line arrives with 0.3.0.

## 10. Failed publish, recovery by re-run

Steps:

1. Branch `s10a`: alpha patch, merge. R: **alpha 0.2.3, beta 0.3.0** (gamma's
   peer `→ ^0.2.3`).
2. Break beta only: on beta's package settings → Manage Actions access, set
   `release-sandbox` to **Read**. If the role cannot be lowered, remove the
   repository and add it back in step 6.
3. Approve and merge R.
4. While beta is broken, merge `s10b`: gamma source change + changeset gamma →
   patch.
5. On the failed run of step 3 press **Re-run failed jobs**.
6. Restore beta's access to **Write**. On the run of step 3 press **Re-run
   all jobs**, then do the same on the run of step 4.
7. On the dispatched run of scenario 9 (step 5) press **Re-run all jobs**.

Expected:

- 3: `publish` red. `alpha@0.2.3` is published (first chunk), `beta@0.3.0`
  fails with 403. No tags, no GitHub Releases; `version` skipped.
- 4: red again (beta 0.3.0 still missing) and **no release PR for gamma**:
  versions are never stacked on an unpublished one.
- 5: red with a conflict on alpha 0.2.3: the stale plan of the first attempt is
  replayed. Record GitHub Packages' wording (verdaccio said `409 Conflict`,
  "this package is already present"). This is why the rule is "Re-run all
  jobs".
- 6, run of step 3: the plan is only beta 0.3.0; it publishes, then
  `github-releases` creates releases and tags for **both** `alpha@0.2.3` and
  `beta@0.3.0` on that run's commit. The notice "Release PR left alone"
  appears, because main has moved on. Run of step 4: R opens with **gamma
  0.2.1**.
- 7: green, publishes nothing, "Release PR left alone"; R still shows gamma
  0.2.1. Without that check this old commit, which still holds s9b's
  changeset, would have rebuilt R as an already-published beta 0.3.0.
- Approve and merge R: publishes `gamma@0.2.1`.

## 11. Snapshot release (phase 2)

Steps:

1. Branch `s11`: alpha source change + changeset alpha → minor, PR
   `feat(alpha): preview me`. Add the `preview` label.
2. Push one more commit, and a third one while the Preview run of the second
   is still running.
3. Remove the label, close the PR unmerged.
4. A README-only PR with the `preview` label; close it.

Expected:

- 1: the Preview run publishes `0.0.0-pr-<N>-<datetime>` of alpha, beta and
  gamma (gamma's peer is out of range of a snapshot) under the dist-tag
  `pr-<N>`; the run summary lists them. `latest` stays where it was (alpha
  `0.2.3`), `pr-<N>` points at the snapshot. **If `latest` moved, stop**:
  GitHub Packages ignores dist-tags and previews must stay off.
- 2: the third push's run waits for the second instead of cancelling it; each
  publishes a full set and moves `pr-<N>`.
- Nothing on main, no tag, no GitHub Release, R unaffected.
- 4: `pack` red at "snapshot versions": "No unreleased changesets found."
- Clean up (needs `gh auth refresh -s read:packages,delete:packages`):
  `gh api /user/packages/npm/sandbox-alpha/versions --jq '.[] | [.id, .name] | @tsv'`,
  then `gh api -X DELETE /user/packages/npm/sandbox-alpha/versions/<id>` per
  snapshot.

## 12. A breaking change in 0.x

The packages stay 0.x (decided 2026-11-05: no 1.0 jump). Changesets has no
zero-major mode, so a `major` changeset on a 0.x package publishes 1.0.0; a
breaking change is a `minor` instead, and `ci` refuses a `major` on 0.x unless
the PR carries the `release-1.0` label.

Steps: branch `s12`: rename alpha's export (a breaking change), changeset
alpha → **major** "Rename the export.", PR `feat(alpha)!: rename the export`.
Then change the changeset to **minor** and push.

Expected:

- `ci` red first: "major for @olegshilov/sandbox-alpha 0.x would publish
  1.0.0. In 0.x a breaking change is `minor` …".
- Green after the change to `minor`. Merge, approve and merge R: alpha's next
  minor, beta and gamma a patch each, gamma's peer rewritten to alpha's new
  minor. Nothing reaches 1.0.0.

## Known behaviour

- **Gamma's literal peer is narrowed on every alpha release**, released or
  not: Changesets rewrites it (`onlyUpdatePeerDependentsWhenOutOfRange` is
  off by default), and gamma's next release publishes it. `workspace:^`, as
  server-client uses in web-libs, narrows the same way, at publish time. The
  experimental option `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.onlyUpdatePeerDependentsWhenOutOfRange`
  stops it; not used.
- **An alpha minor gives gamma only a patch** (scenarios 7 and 12), even when
  that minor is breaking (0.x) and gamma's peer moves past it. That is the v3
  rule that replaced v2's major cascade. When a dependent's consumers must
  notice, its author adds a changeset for it.
- **A tag lands on the commit of the run that creates it**: after a failed
  publish (scenario 10) that is the commit of the re-run, not necessarily the
  one that raised the version.
- **R stays open when its last changeset is reverted** (a `no-release` PR
  deleting it): `version` does not run with no changesets. Close R by hand.
- A `no-release` PR may delete any pending changeset, someone else's
  included; the deletion is in its diff. A changeset entry `'<pkg>': none`
  covers a package without releasing it, like the label for one package.
- Any edit to `packages/*/package.json`, a devDependency bump included, needs
  a changeset or the label. In web-libs that means Dependabot PRs (open item
  in the migration plan).

## Open questions this answers for web-libs

1. `GITHUB_TOKEN` with `packages: read` on a package that does not exist yet:
   404 or 403 (Setup 3).
2. `GITHUB_TOKEN` with `packages: write` creates a package in the user
   namespace and `--access restricted` is accepted (scenario 2, Setup 6).
   Private-by-default only shows in web-libs: this repository is public.
3. GitHub Packages' wording for a re-publish (scenario 10).
4. GitHub Packages honours dist-tags and leaves `latest` alone (scenario 11).
5. `require_code_owner_review` at 0 required approvals (scenario 1).
6. Whether an approval survives a push that does not change the diff
   (scenario 5).
7. Rulesets on this account's plan (Setup 5).
8. Whether a repository's role in "Manage Actions access" can be lowered
   (scenario 10).
9. `gh` on the runner and `gh release create --target` (scenario 2).
10. changelog-github on a private repository; an App push triggers `ci`
    (scenario 1).
11. The upload/download of an artifact holding only `publish-plan.json`
    (Setup 3).
12. GitHub accepts `concurrency.queue: max` (any Release run starts at all).
13. The "App not configured" path: a warning, `version` skipped (Setup 3).

## Results (2026-11-05)

All twelve scenarios ran on this repository, PRs #1–#20. Final state: alpha
0.3.0, beta 0.3.1, gamma 0.2.2 (peer `^0.3.0`), every version tagged and
released, no version skipped or burned.

Answers to the open questions:

1. `GITHUB_TOKEN` with `packages: read` on a package that does not exist yet:
   **404**, so "not published" and the run is green. No read PAT needed.
2. `GITHUB_TOKEN` with `packages: write` created the three packages, linked
   them to this repository and gave it the **Admin** role under "Manage
   Actions access" by itself. (Public here because the repository is.)
3. Re-publishing an existing version: `409 Conflict`,
   `{"error":"Cannot publish over existing version"}`. "Re-run failed jobs"
   hits it (stale plan); "Re-run all jobs" recovers.
4. Dist-tags are honoured: snapshots went to `pr-17`, `latest` never moved.
5. `require_code_owner_review` at 0 required approvals blocks the release PR
   until the owner approves; feature PRs merge without a review.
6. An approval survives the App's re-push of R when the diff is unchanged
   (#3 after #4 and #5) and is dismissed when it changes (#3 after #6).
7. Rulesets work on this public personal repository.
8. The repository's package role can be lowered (Admin → Read) and restored;
   a lowered role fails `publish` with `403 permission_denied: write_package`.
9. `gh` is on the runner; `gh release create --target` tags `GITHUB_SHA`.
10. changelog-github links the PR, the squash commit and the author
    (`[#2] [f7dc703] Thanks @olegshilov!`); an App push triggers `ci`.
11. An artifact holding only `publish-plan.json` uploads and downloads fine.
12. GitHub accepts `concurrency.queue: max`.
13. With the App configured, the very first push opened R (Setup 3).

Observed, worth deciding for web-libs:

- A dependent's literal peer is rewritten on every release of the package it
  peers on, even when the dependent itself is not released (#3, #13).
- GitHub's repository-wide "Latest" release badge lands on whichever package
  was released last; cosmetic in a monorepo.
- Merging R the moment it is approved, while `ci` is still running on the
  App's last push, is refused; wait for `ci`.
- Snapshot versions stay on the registry under `pr-<N>` until deleted
  (needs `delete:packages`).
