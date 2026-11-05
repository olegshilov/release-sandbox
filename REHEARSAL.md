# Rehearsal

Run the scenarios in order: each one starts from the versions the previous one
left. `R` = the open "chore(release): version packages" PR. Read the registry
with `npm view <pkg> dist-tags versions --registry=https://npm.pkg.github.com`
(needs `read:packages` in `~/.npmrc`).

Record for every scenario: the Release run URL, what the release PR showed,
and anything that differed from "Expected".

## 0. One-time setup

1. **Private repository.** `gh repo view olegshilov/release-sandbox --json visibility`
   must say `PRIVATE` before anything is pushed (a package first published
   from a public repository may come out public, and a published version can
   never be re-published):
   `gh repo edit olegshilov/release-sandbox --visibility private --accept-visibility-change-consequences`.
2. **Push the scaffold to main** (the only direct push; no ruleset exists yet).
   - Expected: Release run green. `pack` logs `was not found in the registry`
     and `skip … @0.0.0: never released` for all three; `publish` publishes
     nothing; `version` is skipped and the run shows the warning "Release PR
     not updated". No package, tag or PR.
   - This run answers the first live question: `GITHUB_TOKEN` (repository
     scoped, `packages: read`) asking for packages that do not exist yet. A
     404 counts as "not published" (verified with a PAT). Anything else (403)
     stops `pack` red, fail-closed, and nothing can ever publish. Fallback:
     a classic PAT with `read:packages` as secret `PACKAGES_READ_TOKEN`, and
     in `pack`'s "authenticate" step `NODE_AUTH_TOKEN: ${{ secrets.PACKAGES_READ_TOKEN || github.token }}`
     (direct push; the ruleset is not on yet). Record which it was.
3. **Repository settings.**
   ```sh
   gh api -X PATCH repos/olegshilov/release-sandbox \
     -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
     -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
     -F delete_branch_on_merge=true -F allow_auto_merge=false -F allow_update_branch=true
   gh api -X PUT repos/olegshilov/release-sandbox/actions/permissions/workflow \
     -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
   gh label create no-release --color ededed --description "Changes package files without releasing them"
   gh label create preview --color 1d76db --description "Publish snapshot versions under the pr-<N> dist-tag"
   ```
4. **GitHub App** (personal account, no org admin needed): Settings → Developer
   settings → GitHub Apps → New. Name e.g. `olegshilov-release-bot`; webhook
   off; repository permissions **Contents: read & write**, **Pull requests:
   read & write** (Metadata: read is implied); "Only on this account".
   Install it on `release-sandbox` only. Generate a private key, then:
   ```sh
   gh variable set RELEASE_APP_CLIENT_ID --body <Client ID from the App page>
   gh secret set RELEASE_APP_KEY < ~/Downloads/<app>.private-key.pem
   ```
5. **Ruleset.** `gh api -X POST repos/olegshilov/release-sandbox/rulesets --input .github/rulesets/main.json`
   - A 403 "Upgrade to GitHub Pro or make this repository public" means the
     account is on GitHub Free: rulesets and CODEOWNERS are not enforced on
     private repositories. Either rehearse gating by convention (never merge a
     red PR; approve R before merging it) and mark scenarios 2-4 "observed,
     not enforced", or make the repository public for the rehearsal **only if
     Oleg agrees**. Nothing else changes.
6. **First release PR.** Actions → Release → Run workflow (main).
   - Expected: R opens, authored by the App: alpha, beta, gamma `0.0.0 → 0.1.0`,
     three CHANGELOG.md with `## 0.1.0 / ### Minor Changes / - First release.`,
     `.changeset/initial-release.md` deleted. `ci` runs on it (an App push
     triggers workflows) and passes: "Release PR: versions, changelogs and
     changesets may change." Gamma's peer stays `^0.1.0`.
   - With the ruleset on: R's merge box says a code owner review is required.
     If it does not, `require_code_owner_review` is ignored at 0 required
     approvals: set `required_approving_review_count` to 1 in the ruleset and
     record it (a solo owner then cannot merge his own feature PRs without a
     second account).

## 1. First publish

Steps: try to merge R without a review, then approve it and squash-merge.

Expected:

- Before the approval, merging is blocked (code owner review required).
- Release run: publishes `alpha@0.1.0, beta@0.1.0, gamma@0.1.0` with
  `GITHUB_TOKEN` (`--access restricted`; this creates the three packages),
  creates tags
  `@olegshilov/sandbox-{alpha,beta,gamma}@0.1.0` on the merge commit and three
  GitHub Releases whose body is the `## 0.1.0` section. `version` is skipped
  (no changesets left) without a warning.
- Registry: `latest` = `0.1.0` for each. Package pages: private, linked to
  `release-sandbox`. `npm view @olegshilov/sandbox-beta@0.1.0 dependencies`
  → `{ '@olegshilov/sandbox-alpha': '0.1.0' }`; gamma's peer `^0.1.0`.
- Then **Re-run all jobs** on that run: green, publishes nothing, creates
  nothing (idempotence).

## 2. PR without a changeset, then a patch

Steps: branch `s2`, add a line to `packages/alpha/src/index.ts` (e.g. a JSDoc
sentence), PR titled `fix(alpha): clarify greet docs`. Then
`pnpm changeset` → alpha → patch, push.

Expected:

- First push: `ci` red at "changesets and release files": "Changed without a
  changeset in this PR: @olegshilov/sandbox-alpha." Merge blocked.
- After the changeset: green. Squash-merge (no approval needed: no owned file).
- Release run: nothing to publish; R opens: **alpha 0.1.1, beta 0.1.1**
  ("Updated dependencies"). **Gamma is not bumped** (0.1.1 is inside its
  `^0.1.0` peer; its dev dependency never bumps it): no version, no changelog.
  But `packages/gamma/package.json` **is** in R: its peer is narrowed
  `^0.1.0 → ^0.1.1`. Changesets rewrites a literal peer range on every alpha
  release, whether or not gamma itself is released
  (`onlyUpdatePeerDependentsWhenOutOfRange` defaults to false); the registry
  keeps `gamma@0.1.0` with `^0.1.0`. web-libs is not affected: server-client's
  peer is `workspace:^`, which Changesets never rewrites.

## 3. `no-release` label

Steps: approve R (do not merge it). Branch `s3`, add a comment line to
`packages/gamma/src/index.ts`, PR `chore(gamma): comment`. Watch `ci` fail;
add the `no-release` label; merge.

Expected: `ci` red, then re-runs on `labeled` and passes: "no-release label:
not releasing @olegshilov/sandbox-gamma." After the merge the App re-pushes R
with the same diff (still alpha 0.1.1, beta 0.1.1). Record whether R's
approval survived: GitHub dismisses stale approvals only for pushes that
change the diff. A README-only PR (append a line to
`packages/alpha/README.md`) needs neither changeset nor label.

## 4. Approval dismissed by an update

Steps: make sure R is approved. Branch `s4`: add
`export function greetBoth(a: string, b: string)` to `packages/beta/src/index.ts`,
changeset beta → minor, PR `feat(beta): greetBoth`, merge.

Expected: the Release run force-pushes R to **alpha 0.1.1, beta 0.2.0**; the
approval is dismissed and merging is blocked again. Re-approve, merge →
publishes `alpha@0.1.1`, `beta@0.2.0` (two tags, two releases). Gamma stays
`0.1.0` (its narrowed peer line from scenario 2 rides along in R, unreleased).

## 5. Minor on alpha: dependents and the peer case

Steps: branch `s5`: add `export function farewell(name: string)` to alpha,
changeset alpha → minor, PR `feat(alpha): farewell`, merge, then approve and
merge R.

Expected R: **alpha 0.2.0, beta 0.2.1, gamma 0.1.1**, and gamma's
`package.json` diff rewrites the peer `^0.1.1 → ^0.2.0`. This is the row that
chose Changesets v3: v2 made gamma `1.0.0` here. Published `gamma@0.1.1` has
peer `^0.2.0`.

## 6. Multi-package PR

Steps: one branch `s6` changing `packages/alpha/src/index.ts` and
`packages/gamma/src/index.ts`, with a changeset naming only alpha → patch.
Watch `ci`; then add `'@olegshilov/sandbox-gamma': minor` to the same
changeset (or a second file), merge, approve and merge R.

Expected: `ci` red first: "Changed without a changeset in this PR:
@olegshilov/sandbox-gamma." Then green. R: **alpha 0.2.1, beta 0.2.2, gamma
0.2.0** (gamma's own minor, not a dependent bump; its peer is still narrowed
`^0.2.0 → ^0.2.1`). One merge publishes three packages.

## 7. Stale release PR merge (and dropped runs)

Steps:

1. Branch `s7a`: alpha patch (src line + changeset), merge. R becomes **alpha
   0.2.2, beta 0.2.3** (and gamma's peer `→ ^0.2.2`, gamma not bumped). Do
   not merge R yet.
2. `gh workflow disable release.yml` (pushes now start no Release run).
3. Branch `s7b`: beta src change + changeset beta → minor, merge.
4. Approve and merge R as it is: it predates `s7b`, so it is stale. The
   ruleset does not require up-to-date branches, so GitHub allows it.
5. `gh workflow enable release.yml && gh workflow run release.yml`.

Expected: the single dispatched run publishes **alpha 0.2.2, beta 0.2.3** from
the current main (nothing lost to the two pushes that started no run), tags and
releases them, then opens a new R: **beta 0.3.0** from s7b's changeset. No
version is skipped or burned. Known consequence: s7b's code shipped inside
beta 0.2.3, while its changelog line arrives with 0.3.0.

## 8. Failed publish, recovery by re-run

Steps:

1. Branch `s8a`: alpha patch, merge. R: **alpha 0.2.3, beta 0.3.0** (gamma's
   peer `→ ^0.2.3`).
2. Break beta only: https://github.com/users/olegshilov/packages/npm/sandbox-beta/settings
   → Manage Actions access → set `release-sandbox` to **Read** (if the role
   cannot be lowered, remove the repository and add it back in step 6).
3. Approve and merge R.
4. While it is broken, merge `s8b`: gamma src change + changeset gamma → patch.
5. On the failed run of step 3, press **Re-run failed jobs**.
6. Restore beta's access to **Write** (or Admin). On the same run, press
   **Re-run all jobs**. Then re-run all jobs on the run of step 4 (or Run
   workflow).

Expected:

- 3: `publish` red. alpha 0.2.3 published (it is in the first chunk), beta
  0.3.0 fails with 403. No tags, no GitHub Releases (that step never ran);
  `version` skipped.
- 4: run red again (beta 0.3.0 still missing); **no release PR for gamma**:
  versions are not stacked on top of an unpublished one.
- 5: red with a conflict on alpha 0.2.3 (verdaccio answers `409 Conflict`;
  record GitHub Packages' wording): the stale plan from the first attempt is
  replayed. This is why the rule is "Re-run all jobs".
- 6: the plan is now only beta 0.3.0; it publishes, then `github-releases`
  creates **both** `alpha@0.2.3` and `beta@0.3.0` releases and tags (state, not
  this run's events). The step-4 run then opens R: **gamma 0.2.1**. Merge it.

## 9. Snapshot release (phase 2)

Steps: branch `s9`: alpha src change + changeset alpha → minor, PR
`feat(alpha): preview me`. Add the `preview` label. Push one more commit.
Remove the label, close the PR unmerged.

Expected: Preview run publishes `0.0.0-pr-<N>-<datetime>` of alpha, beta and
gamma (gamma's peer is out of range of a 0.0.0 snapshot) under the dist-tag
`pr-<N>`; the run summary lists them. `dist-tags` shows `latest` unchanged
(alpha `0.2.3`) and `pr-<N>` at the snapshot. The second push publishes a new
snapshot and moves `pr-<N>`. Nothing on main, no tag, no GitHub Release, R
unaffected. **If `latest` moved, stop**: GitHub Packages ignores dist-tags and
previews must stay off. Clean up the versions afterwards (needs
`gh auth refresh -s read:packages,delete:packages`):
`gh api /user/packages/npm/sandbox-alpha/versions --jq '.[] | [.id, .name] | @tsv'`
then `gh api -X DELETE /user/packages/npm/sandbox-alpha/versions/<id>`.

## 10. Major via changeset

Steps: branch `s10`: add `export const API_VERSION = 1;` to alpha (any
change; beta must keep building), changeset alpha → **major** "Declare the
API stable.", PR `feat(alpha)!: declare the API stable`, merge, approve and
merge R.

Expected R: **alpha 1.0.0, beta 0.3.1, gamma 0.2.2** with gamma's peer
rewritten to `^1.0.0`. Publishes; `latest` of alpha = `1.0.0`. The `!`
in the title is cosmetic: only the changeset decides the bump.

## After the rehearsal

Write down per scenario: pass, or what differed. The open questions it answers
for web-libs: `GITHUB_TOKEN` publishing, `--access restricted`, the 404 on a
new package, 409 on a re-publish, dist-tags, code-owner review at 0 required
approvals, and approval dismissal on a same-diff re-push.
