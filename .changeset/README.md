# Changesets

A pull request that changes what a package ships (`src/**` or its
`package.json`) adds a changeset naming that package and the bump:

```sh
pnpm changeset
```

or by hand, as `.changeset/<any-name>.md`:

```md
---
'@olegshilov/sandbox-alpha': minor
'@olegshilov/sandbox-beta': patch
---

What changed, for the changelog.
```

`patch` fixes, `minor` adds, `major` breaks. Dependents are bumped for you.
A change that must not be released (or a revert of an unreleased one) gets the
`no-release` label instead. CI (`ci`) checks both.

Never run `changeset version` in a feature PR: the release PR does that.
