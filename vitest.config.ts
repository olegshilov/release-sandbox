import { defineConfig } from 'vitest/config';

// One project per package. Tests import workspace siblings through their
// package.json exports, i.e. from dist: `pnpm test` runs `tsc -b` first.
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
