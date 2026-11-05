// The last check before a version number is burned on the registry.
//
// Reads the plan written by `changeset publish-plan --output <file>` and
// rewrites it in place: a package still at 0.0.0 has never been released (its
// first version comes from a release PR) and is dropped; any other version
// must have a `## <version>` section in its CHANGELOG.md, or nothing publishes
// (a trailing ` (date)`, as nx wrote them in web-libs, is accepted).
//
// Usage: node scripts/check-publish-plan.mjs <plan.json>
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const file = process.argv[2];
const plan = JSON.parse(readFileSync(file, 'utf8'));

const dirOf = new Map(
  globSync('packages/*/package.json').map((manifest) => [
    JSON.parse(readFileSync(manifest, 'utf8')).name,
    dirname(manifest),
  ]),
);

const problems = [];
plan.plan = plan.plan
  .map((chunk) =>
    chunk.filter((release) => {
      if (release.kind !== 'publish') return true;
      const id = `${release.name}@${release.version}`;
      if (release.version === '0.0.0') {
        console.log(`skip     ${id}: never released`);
        return false;
      }
      const changelog = readFileSync(
        `${dirOf.get(release.name)}/CHANGELOG.md`,
        'utf8',
      );
      if (!heading(release.version).test(changelog)) {
        problems.push(`${id}: no "## ${release.version}" in its CHANGELOG.md`);
      }
      console.log(`publish  ${id}`);
      return true;
    }),
  )
  .filter((chunk) => chunk.length > 0);

if (problems.length > 0) {
  console.error(`Refusing to publish:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);

function heading(version) {
  return new RegExp(`^## ${version.replaceAll('.', '\\.')}( .*)?$`, 'm');
}
