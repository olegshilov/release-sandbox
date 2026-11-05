import { defineConfig } from 'oxfmt';

// The options of entry-fi/web-libs (themselves xyz-web's), so code moves
// between the repositories without churn.
export default defineConfig({
  printWidth: 80,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  sortPackageJson: false,
  ignorePatterns: [
    '**/dist',
    // Written by Changesets (`changeset add`, `changeset version`) in its own
    // format; formatting them here would fail CI on the release PR.
    '.changeset/*.md',
    '**/CHANGELOG.md',
  ],
});
