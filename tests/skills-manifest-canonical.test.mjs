// Regression tests for skill declarations that have no canonical source.
//
// link-skills.mjs reports a declared skill whose canonical SKILL.md is absent as
// a conflict (dry-run) or a verify failure, and exits non-zero. Declaring such a
// skill in agents/skills.manifest.json therefore breaks `--verify` for every
// harness root. These tests pin both halves of the rule:
//   - the linker keeps rejecting a missing canonical entry (conflict, not skip);
//   - the manifest declares no managed skill that nothing in the repository
//     installs or consumes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST_PATH = join(REPO, 'agents', 'skills.manifest.json');
const LINKER = join(REPO, 'agents', 'link-skills.mjs');

// Skills used by the fixture: one the fixture provides, one it does not.
const PROVIDED = 'phantom-ui';
const MISSING = 'humanizer';

function makeFixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'skills-manifest-canonical-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const canonical = join(home, '.agents', 'skills');
  mkdirSync(join(canonical, PROVIDED), { recursive: true });
  writeFileSync(join(canonical, PROVIDED, 'SKILL.md'), '# phantom-ui canonical');
  return { home, canonical };
}

function runLinker(args, home) {
  return spawnSync(process.execPath, [LINKER, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

test('linker reports a declared skill with no canonical SKILL.md as a conflict', (t) => {
  const { home, canonical } = makeFixture(t);

  const provided = runLinker(['--skill', PROVIDED, '--root', canonical], home);
  assert.equal(provided.status, 0, `a satisfied declaration must not conflict:\n${provided.stdout}${provided.stderr}`);

  const missing = runLinker(['--skill', MISSING, '--root', canonical], home);
  assert.equal(missing.status, 1, `a missing canonical entry must exit 1:\n${missing.stdout}${missing.stderr}`);
  assert.match(missing.stdout, new RegExp(`conflict\\s+${MISSING}`), 'the missing skill must be a conflict');
  assert.match(missing.stdout, /missing from the canonical root/, 'the conflict detail must name the cause');

  const verified = runLinker(['--verify', '--skill', MISSING, '--root', canonical], home);
  assert.equal(verified.status, 1, `verify must fail on a missing canonical entry:\n${verified.stdout}${verified.stderr}`);
  assert.match(verified.stdout, new RegExp(`canonical/${MISSING}: SKILL\\.md is missing`));

  assert.deepEqual(readdirSync(home), ['.agents'], 'reporting and verifying must not write outside the fixture canonical root');
});

test('every managed manifest skill is installed or consumed by a tracked file', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const managed = Object.entries(manifest.skills)
    .filter(([, policy]) => policy.managed !== false)
    .map(([name]) => name);

  // The manifest is the declaration under test, and MODELS.md only shows an
  // example agent filename for model pinning; neither installs a skill.
  const EXCLUDED = new Set(['agents/skills.manifest.json', 'pi/agent/MODELS.md']);
  const listing = spawnSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(listing.status, 0, 'git ls-files must succeed');
  const corpus = listing.stdout
    .split('\0')
    .filter((file) => file && !EXCLUDED.has(file) && existsSync(join(REPO, file)))
    .map((file) => readFileSync(join(REPO, file), 'utf8'))
    .join('\n');

  const orphans = managed.filter((name) => !new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(corpus));
  assert.deepEqual(orphans, [], 'a managed skill must be provided by an installer or consumed by a tracked file');
});
