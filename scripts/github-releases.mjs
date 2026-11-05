// Gives every released version its git tag and GitHub Release.
//
// Runs only after `changeset publish` succeeded, when every package version on
// this commit (other than a never-released 0.0.0) is on the registry. It works
// from that state rather than from what this run published, so a re-run also
// repairs a version whose publish succeeded but whose release step did not:
// `changeset publish` never revisits a version the registry already has.
//
// Needs GH_TOKEN with contents: write. `gh release create --target` creates the
// `<name>@<version>` tag on this commit when it does not exist yet.
import { spawnSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const sha = process.env.GITHUB_SHA;
if (!sha) throw new Error('GITHUB_SHA is not set');

for (const manifest of globSync('packages/*/package.json')) {
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  if (pkg.private || pkg.version === '0.0.0') continue;

  const tag = `${pkg.name}@${pkg.version}`;
  if (released(tag)) continue;

  const changelog = readFileSync(`${dirname(manifest)}/CHANGELOG.md`, 'utf8');
  const create = gh(
    'release',
    'create',
    tag,
    '--target',
    sha,
    '--title',
    tag,
    '--notes',
    section(changelog, pkg.version),
    ...(pkg.version.includes('-') ? ['--prerelease'] : []),
  );
  if (!create.ok) fail(`gh release create ${tag}: ${create.stderr}`);
  console.log(`released ${tag}`);
}

// Only gh's "release not found" means "not released"; any other failure (the
// token, the network) stops the run rather than guessing.
function released(tag) {
  const view = gh('release', 'view', tag, '--json', 'tagName');
  if (view.ok) return true;
  if (view.stderr.includes('release not found')) return false;
  fail(`gh release view ${tag}: ${view.stderr}`);
}

function gh(...args) {
  const run = spawnSync('gh', args, { encoding: 'utf8' });
  if (run.error) throw run.error; // gh itself is missing
  return { ok: run.status === 0, stderr: run.stderr.trim() };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function section(changelog, version) {
  const heading = new RegExp(
    `^## ${version.replaceAll('.', '\\.')}( .*)?$`,
    'm',
  ).exec(changelog);
  if (!heading) throw new Error(`no "## ${version}" in CHANGELOG.md`);
  const start = heading.index + heading[0].length;
  const end = changelog.indexOf('\n## ', start);
  return changelog.slice(start, end === -1 ? undefined : end).trim();
}
