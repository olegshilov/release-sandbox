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
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const sha = process.env.GITHUB_SHA;
if (!sha) throw new Error('GITHUB_SHA is not set');

const gh = (...args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

for (const dir of readdirSync('packages')) {
  const pkg = JSON.parse(readFileSync(`packages/${dir}/package.json`, 'utf8'));
  if (pkg.private || pkg.version === '0.0.0') continue;

  const tag = `${pkg.name}@${pkg.version}`;
  try {
    gh('release', 'view', tag, '--json', 'tagName');
    continue; // already released
  } catch {
    // no release yet: create it below
  }

  const changelog = readFileSync(`packages/${dir}/CHANGELOG.md`, 'utf8');
  gh(
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
  console.log(`released ${tag}`);
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
