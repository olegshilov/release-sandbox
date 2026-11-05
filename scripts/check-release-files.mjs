// The pull request's half of the release contract, run by the `ci` job.
//
// Main publishes whatever versions it holds, so:
// 1. every package whose released files changed (`changedFilePatterns` in
//    .changeset/config.json) must be named by a changeset this PR adds,
//    unless the PR carries the `no-release` label;
// 2. outside the release PR, nothing may change a `version`, write a
//    CHANGELOG.md or delete a pending changeset (except a `no-release` revert),
//    and a new package starts at 0.0.0 (its first version comes from a
//    release PR);
// 3. the release PR changes nothing but those: anything else on its branch
//    was pushed there by hand and would skip checks 1 and 2.
//
// HEAD is the PR's merge commit; HEAD^1 is the main commit it merges into, so
// the diff is exactly what the squash will add, whatever else landed meanwhile.
//
// Env: HEAD_REF, AUTHOR_TYPE, LABELS (JSON array of label names).
import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { basename, dirname, matchesGlob } from 'node:path';

const BASE = 'HEAD^1';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const isReleasePr =
  process.env.HEAD_REF === 'changeset-release/main' &&
  process.env.AUTHOR_TYPE === 'Bot';
const labels = JSON.parse(process.env.LABELS || '[]');
const { changedFilePatterns } = readJson('.changeset/config.json');
const packages = new Map(
  globSync('packages/*/package.json').map((file) => [
    basename(dirname(file)),
    readJson(file),
  ]),
);
const packageNames = new Set([...packages.values()].map((pkg) => pkg.name));

const changes = git('diff', '--name-status', '--no-renames', BASE, 'HEAD')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [status, path] = line.split('\t');
    return { status, path };
  });

const errors = [];
const isChangeset = (path) =>
  /^\.changeset\/[^/]+\.md$/.test(path) && path !== '.changeset/README.md';

// 3. The release PR is `changeset version` output and nothing else.
if (isReleasePr) {
  const foreign = changes.filter(
    ({ status, path }) =>
      !(status === 'D' && isChangeset(path)) &&
      !(
        status !== 'D' &&
        /^packages\/[^/]+\/(CHANGELOG\.md|package\.json)$/.test(path)
      ),
  );
  if (foreign.length > 0) {
    console.error(
      'The release PR changes only versions, changelogs and the changesets it ' +
        'consumed. Not from `changeset version`:\n' +
        foreign.map(({ status, path }) => `- ${status} ${path}`).join('\n'),
    );
    process.exit(1);
  }
  console.log('Release PR: versions, changelogs and consumed changesets only.');
  process.exit(0);
}

// 2. Release files belong to the release PR.
for (const { status, path } of changes) {
  // The one exception: reverting a change that was never released drops its
  // changeset, and says so with the same label that skips the coverage check.
  if (status === 'D' && isChangeset(path) && !labels.includes('no-release')) {
    errors.push(
      `${path} is deleted: only the release PR consumes changesets ` +
        '(label the PR `no-release` if it reverts an unreleased change).',
    );
  }
  if (/^packages\/[^/]+\/CHANGELOG\.md$/.test(path)) {
    errors.push(`${path} changed: only the release PR writes changelogs.`);
  }
  const manifest = /^packages\/([^/]+)\/package\.json$/.exec(path);
  if (manifest && status !== 'D') {
    const now = packages.get(manifest[1]).version;
    const before =
      status === 'A'
        ? '0.0.0'
        : JSON.parse(git('show', `${BASE}:${path}`)).version;
    if (now !== before) {
      errors.push(
        `${path}: version ${before} -> ${now}. Only the release PR changes versions` +
          (status === 'A' ? '; a new package starts at 0.0.0.' : '.'),
      );
    }
  }
}

// 1. Every changed package is named by a changeset this PR adds.
const named = new Set();
const versionOf = new Map(
  [...packages.values()].map((pkg) => [pkg.name, pkg.version]),
);
for (const { status, path } of changes) {
  if (status !== 'A' || !isChangeset(path)) continue;
  for (const { name, bump } of releasesIn(path)) {
    if (!packageNames.has(name)) {
      errors.push(`${path} names ${name}, which is not a workspace package.`);
      continue;
    }
    named.add(name);
    // Changesets has no zero-major mode: `major` on 0.x publishes 1.0.0. In
    // 0.x a breaking change is a `minor`; 1.0.0 is a decision, so it is a label.
    const version = versionOf.get(name);
    if (
      bump === 'major' &&
      version.startsWith('0.') &&
      !labels.includes('release-1.0')
    ) {
      errors.push(
        `${path}: major for ${name} ${version} would publish 1.0.0. ` +
          'In 0.x a breaking change is `minor`; label the PR `release-1.0` ' +
          'if 1.0.0 is intended.',
      );
    }
  }
}

const changed = new Set();
for (const { path } of changes) {
  const match = /^packages\/([^/]+)\/(.+)$/.exec(path);
  const pkg = match && packages.get(match[1]);
  if (pkg && isReleased(match[2])) changed.add(pkg.name);
}

const missing = [...changed].filter((name) => !named.has(name));
if (missing.length > 0 && !labels.includes('no-release')) {
  errors.push(
    `Changed without a changeset in this PR: ${missing.join(', ')}.\n` +
      '  Run `pnpm changeset` and commit the file, or label the PR `no-release`\n' +
      '  if this change must not be released.',
  );
} else if (missing.length > 0) {
  console.log(`no-release label: not releasing ${missing.join(', ')}.`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}
console.log(`OK. Released by this PR: ${[...named].join(', ') || 'nothing'}.`);

// changedFilePatterns as Changesets applies them (@changesets/git
// globMatchSome): in order, a later `!pattern` can take a match back.
function isReleased(file) {
  return changedFilePatterns.reduce(
    (hit, pattern) =>
      pattern.startsWith('!')
        ? hit && !matchesGlob(file, pattern.slice(1))
        : hit || matchesGlob(file, pattern),
    false,
  );
}

// The releases in a changeset's front matter ("'@scope/name': minor").
function releasesIn(path) {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n?---/.exec(
    readFileSync(path, 'utf8'),
  );
  if (!frontMatter) {
    errors.push(`${path} has no front matter.`);
    return [];
  }
  return frontMatter[1]
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const release =
        /^\s*(['"]?)(.+?)\1\s*:\s*(major|minor|patch|none)\s*$/.exec(line);
      if (!release) errors.push(`${path}: cannot read "${line}".`);
      return release && { name: release[2], bump: release[3] };
    })
    .filter(Boolean);
}
