import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync, constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./link-skills.mjs', import.meta.url));

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'link-skills-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const canonical = join(home, 'canonical');
  const claude = join(home, '.claude', 'skills');
  for (const path of [
    join(canonical, 'humanizer'),
    join(canonical, 'design-taste-frontend'),
    join(canonical, 'heroui-react'),
    join(canonical, 'branch-pr'),
    claude,
  ]) {
    mkdirSync(path, { recursive: true });
  }
  for (const name of ['humanizer', 'design-taste-frontend', 'heroui-react']) {
    writeFileSync(join(canonical, name, 'SKILL.md'), 'selected skill');
  }
  writeFileSync(join(canonical, 'branch-pr', 'SKILL.md'), 'canonical copy');
  mkdirSync(join(claude, 'branch-pr'));
  writeFileSync(join(claude, 'branch-pr', 'SKILL.md'), 'unrelated user copy');

  return { home, canonical, claude };
}

function run(args, { home }) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

test('skill filter plans, applies, and verifies only selected skills', (t) => {
  const paths = fixture(t);
  const args = [
    '--root', paths.canonical,
    '--skill', 'humanizer',
    '--skill', 'design-taste-frontend',
    '--skill', 'heroui-react',
  ];

  const plan = run(args, paths);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /link\s+humanizer/);
  assert.match(plan.stdout, /link\s+design-taste-frontend/);
  assert.match(plan.stdout, /link\s+heroui-react/);
  assert.doesNotMatch(plan.stdout, /branch-pr/);

  const applied = run(['--apply', ...args], paths);
  assert.equal(applied.status, 0, applied.stderr);
  for (const name of ['humanizer', 'design-taste-frontend', 'heroui-react']) {
    assert.equal(realpathSync(join(paths.claude, name)), join(paths.canonical, name));
  }
  assert.equal(lstatSync(join(paths.claude, 'branch-pr')).isSymbolicLink(), false);
  assert.equal(readFileSync(join(paths.claude, 'branch-pr', 'SKILL.md'), 'utf8'), 'unrelated user copy');
  assert.doesNotMatch(applied.stdout, /branch-pr/);

  const verified = run(['--verify', ...args], paths);
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /verify: OK, 3 link\(s\) checked/);
});

test('skill and harness filters compose', (t) => {
  const paths = fixture(t);
  const args = ['--root', paths.canonical, '--only', 'claude', '--skill', 'humanizer'];

  const plan = run(args, paths);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /link\s+humanizer/);
  assert.doesNotMatch(plan.stdout, /design-taste-frontend|heroui-react|branch-pr/);

  const applied = run(['--apply', ...args], paths);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(realpathSync(join(paths.claude, 'humanizer')), join(paths.canonical, 'humanizer'));
  assert.equal(lstatSync(join(paths.claude, 'branch-pr')).isSymbolicLink(), false);
  assert.doesNotMatch(applied.stdout, /design-taste-frontend|heroui-react|branch-pr/);

  const verified = run(['--verify', ...args], paths);
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /verify: OK, 1 link\(s\) checked/);
});

test('dangling harness links are reported as conflicts', (t) => {
  const paths = fixture(t);
  symlinkSync(join(paths.home, 'missing'), join(paths.claude, 'humanizer'), 'dir');

  const result = run(['--root', paths.canonical, '--only', 'claude', '--skill', 'humanizer'], paths);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /conflict\s+humanizer/);
  assert.doesNotMatch(result.stderr, /ENOENT|realpathSync/);
});

test('a parent config directory does not count as an installed harness', (t) => {
  const paths = fixture(t);
  rmSync(paths.claude, { recursive: true, force: true });
  const result = run(['--root', paths.canonical, '--only', 'claude', '--skill', 'humanizer'], paths);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skip\s+harness\s+not installed/);
  assert.doesNotMatch(result.stdout, /link\s+humanizer/);
});

test('skill filter rejects names absent from the manifest', (t) => {
  const paths = fixture(t);
  const result = run(['--root', paths.canonical, '--skill', 'not-a-skill'], paths);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no skill named not-a-skill/);
});

// --- S6: exclusive process lock for --apply ----------------------------------

test('concurrent --apply is rejected with an informative error', (t) => {
  const paths = fixture(t);
  const args = ['--apply', '--root', paths.canonical, '--only', 'claude', '--skill', 'humanizer'];

  // Place a lock file before running --apply to simulate a concurrent process.
  const lockDir = join(paths.home, '.pi');
  const lockFile = join(lockDir, 'link-skills.lock');
  mkdirSync(lockDir, { recursive: true });
  const fd = openSync(lockFile, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL);
  writeFileSync(fd, '99999');
  // fd intentionally not closed — lock file presence is what matters for O_EXCL;
  // the OS will close fd when the test process exits.
  try {
    const result = run(args, paths);
    assert.equal(result.status, 2, `expected exit 2, got ${result.status}\nstderr: ${result.stderr}`);
    assert.match(result.stderr, /already running/);
  } finally {
    try { unlinkSync(lockFile); } catch { /* ignore */ }
  }
});

test('lock file is removed after a successful --apply', (t) => {
  const paths = fixture(t);
  const args = ['--apply', '--root', paths.canonical, '--only', 'claude', '--skill', 'humanizer'];
  const lockFile = join(paths.home, '.pi', 'link-skills.lock');

  const result = run(args, paths);
  assert.equal(result.status, 0, result.stderr);
  // Lock must not persist after a clean run.
  let lockExists = false;
  try { lstatSync(lockFile); lockExists = true; } catch { /* expected */ }
  assert.equal(lockExists, false, 'lock file was not cleaned up after --apply');
});

// --- S5: no missing-path window, canonical and harness copies preserved ---

test('identical harness copies remain explicit conflicts for manual reconciliation', (t) => {
  const paths = fixture(t);
  mkdirSync(join(paths.claude, 'humanizer'));
  writeFileSync(join(paths.claude, 'humanizer', 'SKILL.md'), 'selected skill');

  const args = ['--root', paths.canonical, '--only', 'claude', '--skill', 'humanizer'];
  const plan = run(args, paths);
  assert.equal(plan.status, 1, plan.stderr);
  assert.match(plan.stdout, /conflict\s+humanizer/);
  assert.match(plan.stdout, /identical copy requires manual reconciliation/);

  const result = run(['--apply', ...args], paths);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(existsSync(join(paths.claude, 'humanizer')), true, 'original copy must remain available');
  assert.equal(readFileSync(join(paths.claude, 'humanizer', 'SKILL.md'), 'utf8'), 'selected skill');
  assert.equal(existsSync(join(paths.home, '.pi', 'backups')), false, 'conflict must not create a backup');
});

test('Pi-local links outside the canonical skill remain explicit conflicts', (t) => {
  const paths = fixture(t);
  const external = join(paths.home, 'external-skills', 'humanizer');
  mkdirSync(external, { recursive: true });
  writeFileSync(join(external, 'SKILL.md'), 'external skill');
  const piSkill = join(paths.home, '.pi', 'agent', 'skills', 'humanizer');
  mkdirSync(join(paths.home, '.pi', 'agent', 'skills'), { recursive: true });
  symlinkSync(external, piSkill, 'dir');

  const result = run(
    ['--apply', '--root', paths.canonical, '--only', 'pi', '--skill', 'humanizer'],
    paths,
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /conflict\s+humanizer/);
  assert.equal(lstatSync(piSkill).isSymbolicLink(), true);
  assert.equal(realpathSync(piSkill), external);
});

test('external canonical symlinks are preserved as explicit conflicts', (t) => {
  const paths = fixture(t);
  // Build a canonical root where humanizer is a symlink to an external dir.
  const external = join(paths.home, 'external-skills', 'humanizer');
  mkdirSync(external, { recursive: true });
  writeFileSync(join(external, 'SKILL.md'), 'external canonical');

  // Replace the already-created canonical/humanizer dir with a symlink to external.
  rmSync(join(paths.canonical, 'humanizer'), { recursive: true, force: true });
  symlinkSync(external, join(paths.canonical, 'humanizer'), 'dir');

  // --apply must refuse the external fold-in rather than unlinking the canonical
  // symlink and leaving a missing-path window if replacement fails.
  const result = run(
    ['--apply', '--root', paths.canonical, '--only', 'claude', '--skill', 'humanizer'],
    paths,
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /external link; refusing automatic fold-in/);
  assert.equal(lstatSync(join(paths.canonical, 'humanizer')).isSymbolicLink(), true);
  assert.equal(existsSync(join(paths.claude, 'humanizer')), false, 'canonical conflicts must block harness linking');

  // External target must still exist and remain unchanged.
  const extStat = lstatSync(external);
  assert.equal(extStat.isDirectory(), true, 'external target was destroyed');
  assert.equal(readFileSync(join(external, 'SKILL.md'), 'utf8'), 'external canonical');
});

// --- path safety: unsafe manifest skill name components ----------------------

test('manifest skill name with path traversal is rejected', (t) => {
  const paths = fixture(t);
  // Write a temporary manifest with a dangerous skill name.
  const badManifest = join(paths.home, 'bad-manifest.json');
  const goodManifest = JSON.parse(readFileSync(
    new URL('./skills.manifest.json', import.meta.url),
    'utf8',
  ));
  goodManifest.skills['../evil'] = { default: true };
  writeFileSync(badManifest, JSON.stringify(goodManifest));

  // Patch the script invocation to use our bad manifest by symlinking the
  // manifest path. The script reads MANIFEST_PATH = join(SCRIPT_DIR, 'skills.manifest.json')
  // so we create a temporary script copy in a dir that has our bad manifest.
  const tmpScriptDir = join(paths.home, 'tmp-script');
  mkdirSync(tmpScriptDir, { recursive: true });
  const scriptSrc = readFileSync(new URL('./link-skills.mjs', import.meta.url), 'utf8');
  writeFileSync(join(tmpScriptDir, 'link-skills.mjs'), scriptSrc);
  writeFileSync(join(tmpScriptDir, 'skills.manifest.json'), JSON.stringify(goodManifest));

  const result = spawnSync(process.execPath, [join(tmpScriptDir, 'link-skills.mjs'), '--root', paths.canonical], {
    encoding: 'utf8',
    env: { ...process.env, HOME: paths.home, USERPROFILE: paths.home },
  });
  assert.equal(result.status, 2, `expected exit 2 for unsafe skill name\nstderr: ${result.stderr}`);
  assert.match(result.stderr, /unsafe path component/);
});
