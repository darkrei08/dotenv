import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
    env: { ...process.env, HOME: home },
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

test('skill filter rejects names absent from the manifest', (t) => {
  const paths = fixture(t);
  const result = run(['--root', paths.canonical, '--skill', 'not-a-skill'], paths);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no skill named not-a-skill/);
});
