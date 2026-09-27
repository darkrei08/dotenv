import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./ensure-claude-root-mode.sh', import.meta.url));

function fixture(t, settings) {
  const home = mkdtempSync(join(tmpdir(), 'dotenv-claude-root-mode-'));
  const claude = join(home, '.claude');
  mkdirSync(claude);
  chmodSync(home, 0o755);
  chmodSync(claude, 0o755);
  if (settings !== undefined) writeFileSync(join(claude, 'settings.json'), settings);
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return { home, settingsPath: join(claude, 'settings.json') };
}

function run(home, overrides = {}) {
  return spawnSync(script, [], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, ...overrides },
  });
}

function runWithFailingReadback(home) {
  const bin = join(home, 'bin');
  mkdirSync(bin);
  const jq = spawnSync('sh', ['-c', 'command -v jq'], { encoding: 'utf8' }).stdout.trim();
  assert.ok(jq);
  const wrapper = join(bin, 'jq');
  writeFileSync(wrapper, `#!/usr/bin/env bash
if [ "${'${1:-}'}" = "-e" ]; then
  printf 'simulated readback failure\\n' >&2
  exit 42
fi
exec ${JSON.stringify(jq)} "${'${@}'}"
`);
  chmodSync(wrapper, 0o755);
  return run(home, { PATH: `${bin}:${process.env.PATH}` });
}

function runAsNonRoot(home) {
  if (process.getuid?.() !== 0) return run(home);
  return spawnSync('runuser', ['-u', 'nobody', '--', 'env', `HOME=${home}`, `USERPROFILE=${home}`, script], {
    encoding: 'utf8',
  });
}

test('root setup updates Claude mode and preserves unrelated settings', (t) => {
  if (process.getuid?.() !== 0) return t.skip('root-specific test requires root');

  const paths = fixture(t, JSON.stringify({
    '$schema': 'https://json.schemastore.org/claude-code-settings.json',
    permissions: {
      allow: ['Bash(git status)'],
      deny: ['Read(.env*)'],
      defaultMode: 'plan',
    },
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'true' }] }] },
    customSetting: { keep: true },
  }, null, 2));

  const result = run(paths.home);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(paths.settingsPath, 'utf8')), {
    '$schema': 'https://json.schemastore.org/claude-code-settings.json',
    permissions: {
      allow: ['Bash(git status)'],
      deny: ['Read(.env*)'],
      defaultMode: 'default',
    },
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'true' }] }] },
    customSetting: { keep: true },
  });
});

test('root setup safely creates missing Claude settings', (t) => {
  if (process.getuid?.() !== 0) return t.skip('root-specific test requires root');

  const paths = fixture(t);
  const result = run(paths.home);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(paths.settingsPath, 'utf8')), {
    permissions: { defaultMode: 'default' },
  });
});

test('non-root setup does not change Claude settings', (t) => {
  const original = JSON.stringify({ permissions: { defaultMode: 'plan' }, hooks: { keep: true } }, null, 2);
  const paths = fixture(t, original);
  const result = runAsNonRoot(paths.home);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(paths.settingsPath, 'utf8'), original);
});

test('root setup is idempotent', (t) => {
  if (process.getuid?.() !== 0) return t.skip('root-specific test requires root');

  const paths = fixture(t, JSON.stringify({ permissions: { defaultMode: 'plan' }, other: ['value'] }));
  const first = run(paths.home);
  assert.equal(first.status, 0, first.stderr);
  const afterFirst = readFileSync(paths.settingsPath, 'utf8');
  const second = run(paths.home);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(paths.settingsPath, 'utf8'), afterFirst);
});

test('root setup fails when persisted mode cannot be verified', (t) => {
  if (process.getuid?.() !== 0) return t.skip('root-specific test requires root');

  const paths = fixture(t, JSON.stringify({ permissions: { defaultMode: 'plan' } }));
  const result = runWithFailingReadback(paths.home);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /failed to verify.*default/i);
  assert.equal(JSON.parse(readFileSync(paths.settingsPath, 'utf8')).permissions.defaultMode, 'default');
});

test('invalid Claude settings fail closed without truncating the original', (t) => {
  if (process.getuid?.() !== 0) return t.skip('root-specific test requires root');

  const original = '{"permissions": {"defaultMode": "plan"},';
  const paths = fixture(t, original);
  const result = run(paths.home);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(paths.settingsPath, 'utf8'), original);
});
