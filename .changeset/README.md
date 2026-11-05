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

`patch` fixes, `minor` adds. While a package is 0.x, `minor` is also how a
breaking change is released: `major` would publish 1.0.0, so CI refuses it
without the `release-1.0` label. Dependents are bumped for you.
A change that must not be released (or a revert of an unreleased one) gets the
`no-release` label instead. CI (`ci`) checks both.

Never run `changeset version` in a feature PR: the release PR does that.
