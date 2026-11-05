import { defineConfig } from 'oxlint';

// Copied from entry-fi/web-libs, minus the rules that only exist for its code.
export default defineConfig({
  plugins: [
    'typescript',
    'unicorn',
    'import',
    'oxc',
    'promise',
    'node',
    'vitest',
  ],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'error',
  },
  rules: {
    'typescript/consistent-type-imports': 'error',
    'typescript/no-explicit-any': 'warn',
    'import/no-unassigned-import': 'off',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
});
