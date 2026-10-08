import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const shim = fileURLToPath(new URL('./gga-pi/bin/kilo', import.meta.url));
const wrapper = fileURLToPath(new URL('./gga-pi/run-gga.sh', import.meta.url));

// A fake `pi` records its argv and stdin, then answers like a successful or failing run.
function fixture(t, { exit = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gga-pi-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fake = join(dir, 'pi');
  writeFileSync(fake, `#!/usr/bin/env bash
printf '%s\\n' "$@" > "${dir}/argv"
cat > "${dir}/stdin"
printf 'warning: noisy startup\\n' >&2
if [ ${exit} -eq 0 ]; then printf 'STATUS: PASSED\\n'; else printf 'provider failed\\n' >&2; fi
exit ${exit}
`);
  chmodSync(fake, 0o755);
  return { dir, env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } };
}

function run(t, args, input, options) {
  const { dir, env } = fixture(t, options);
  const result = spawnSync(shim, args, { env, input, encoding: 'utf8' });
  return { dir, result };
}

test('forwards the model to pi and returns only the review on stdout', (t) => {
  const { dir, result } = run(t, ['run', '--auto', '--model', 'anthropic/claude-sonnet-5-5:high'], 'the prompt');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'STATUS: PASSED\n');
  assert.equal(result.stderr, '', 'pi startup noise must not reach GGA');
  assert.equal(readFileSync(join(dir, 'stdin'), 'utf8'), 'the prompt');
  const argv = readFileSync(join(dir, 'argv'), 'utf8').split('\n');
  assert.ok(argv.includes('--print'));
  assert.ok(argv.includes('--no-tools'));
  assert.equal(argv[argv.indexOf('--model') + 1], 'anthropic/claude-sonnet-5-5:high');
});

test('cliproxyapi models load only the CLIProxyAPI provider extension', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'gga-pi-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const ext = join(home, 'npm/node_modules/@router-for-me/pi-cliproxyapi-provider/extensions/index.ts');
  mkdirSync(dirname(ext), { recursive: true });
  writeFileSync(ext, '');
  const { dir, env } = fixture(t);
  const result = spawnSync(shim, ['run', '--auto', '--model', 'cliproxyapi/claude-opus-5-5:high'], {
    env: { ...env, PI_CODING_AGENT_DIR: home }, input: 'p', encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const argv = readFileSync(join(dir, 'argv'), 'utf8').split('\n');
  assert.equal(argv[argv.indexOf('-e') + 1], ext);
  assert.ok(argv.includes('--no-extensions'));

  const missing = spawnSync(shim, ['run', '--auto', '--model', 'cliproxyapi/x'], {
    env: { ...env, PI_CODING_AGENT_DIR: join(home, 'none') }, input: 'p', encoding: 'utf8',
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /provider extension not found/);
});

test('a failing pi call surfaces its diagnostics and a non-zero status', (t) => {
  const { result } = run(t, ['run', '--auto', '--model', 'anthropic/claude-sonnet-5-5'], 'p', { exit: 3 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /provider failed/);
});

test('a missing model is a configuration error', (t) => {
  const { result } = run(t, ['run', '--auto'], 'p');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /PROVIDER="kilo:<pi-model>/);
});

test('unsupported arguments are rejected instead of ignored', (t) => {
  const { result } = run(t, ['run', '--model', 'm', '--dangerous'], 'p');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unsupported argument: --dangerous/);
});

test('a missing pi binary is reported', () => {
  const result = spawnSync('/bin/bash', [shim, 'run', '--auto', '--model', 'm'], {
    env: { PATH: '/nonexistent' },
    input: 'p',
    encoding: 'utf8',
  });
  assert.equal(result.status, 127);
  assert.match(result.stderr, /pi is not on PATH/);
});

test('run-gga.sh puts the bridge ahead of any real kilo on PATH', (t) => {
  const { dir, env } = fixture(t);
  const fakeGga = join(dir, 'gga');
  writeFileSync(fakeGga, '#!/usr/bin/env bash\ncommand -v kilo\n');
  chmodSync(fakeGga, 0o755);
  const result = spawnSync(wrapper, ['run'], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), shim);
});
