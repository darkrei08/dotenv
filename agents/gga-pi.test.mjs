import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
  assert.ok(argv.includes('--offline'), 'CLIProxyAPI must use the Keeper-backed catalog cache');

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

test('fails over to the next reviewer model when the primary model fails', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gga-pi-failover-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const haPath = join(dir, 'ha.json');
  writeFileSync(haPath, JSON.stringify({
    groups: {
      reviewer: {
        entries: [{ id: 'provider/primary-model' }, { id: 'provider/fallback-model' }]
      }
    }
  }));

  const fakePi = join(dir, 'pi');
  writeFileSync(fakePi, `#!/usr/bin/env bash
for arg in "$@"; do
  if [ "$arg" = "provider/primary-model" ]; then
    printf 'quota exceeded\\n' >&2
    exit 1
  elif [ "$arg" = "provider/fallback-model" ]; then
    printf 'STATUS: PASSED\\n'
    exit 0
  fi
done
exit 2
`);
  chmodSync(fakePi, 0o755);

  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, PI_HA_CONFIG: haPath };
  const result = spawnSync(shim, ['run', '--auto', '--model', 'provider/primary-model'], {
    env, input: 'review prompt', encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'STATUS: PASSED\n');
  assert.match(result.stderr, /failing over to provider\/fallback-model/);
});

test('uses the tracked HA template when live HA lacks the reviewer primary', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gga-pi-template-failover-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const home = join(dir, 'home');
  const extension = join(home, 'npm/node_modules/@router-for-me/pi-cliproxyapi-provider/extensions/index.ts');
  mkdirSync(dirname(extension), { recursive: true });
  writeFileSync(extension, '');

  const haPath = join(dir, 'ha.json');
  writeFileSync(haPath, JSON.stringify({
    groups: { reviewer: { entries: [{ id: 'cliproxyapi/old-reviewer' }] } }
  }));
  const modelsPath = join(dir, 'models');
  const fakePi = join(dir, 'pi');
  writeFileSync(fakePi, `#!/usr/bin/env bash
model=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '--model' ]; then shift; model=$1; fi
  shift
done
printf '%s\\n' "$model" >> '${modelsPath}'
if [ "$model" = 'cliproxyapi/gemini-3.8-flash-high:high' ]; then exit 1; fi
printf 'STATUS: PASSED\\n'
`);
  chmodSync(fakePi, 0o755);

  const env = {
    ...process.env,
    PATH: `${dir}:${process.env.PATH}`,
    PI_HA_CONFIG: haPath,
    PI_CODING_AGENT_DIR: home,
  };
  const result = spawnSync(shim, ['run', '--auto', '--model', 'cliproxyapi/gemini-3.8-flash-high:high'], {
    env, input: 'review prompt', encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'STATUS: PASSED\n');
  assert.match(result.stderr, /using the tracked HA template/);
  assert.deepEqual(readFileSync(modelsPath, 'utf8').trim().split('\n').slice(0, 2), [
    'cliproxyapi/gemini-3.8-flash-high:high',
    'cliproxyapi/gpt-6.2-sol',
  ]);

  writeFileSync(haPath, JSON.stringify({
    groups: { reviewer: { entries: [
      { id: 'cliproxyapi/gemini-3.8-flash-high:medium' },
      { id: 'cliproxyapi/local-fallback' },
    ] } }
  }));
  writeFileSync(modelsPath, '');
  const suffixedLive = spawnSync(shim, ['run', '--auto', '--model', 'cliproxyapi/gemini-3.8-flash-high:high'], {
    env, input: 'review prompt', encoding: 'utf8',
  });
  assert.equal(suffixedLive.status, 0, suffixedLive.stderr);
  assert.doesNotMatch(suffixedLive.stderr, /using the tracked HA template/);
  assert.deepEqual(readFileSync(modelsPath, 'utf8').trim().split('\n').slice(0, 2), [
    'cliproxyapi/gemini-3.8-flash-high:high',
    'cliproxyapi/local-fallback',
  ]);

  rmSync(haPath);
  writeFileSync(modelsPath, '');
  const missingLive = spawnSync(shim, ['run', '--auto', '--model', 'cliproxyapi/gemini-3.8-flash-high:high'], {
    env, input: 'review prompt', encoding: 'utf8',
  });
  assert.equal(missingLive.status, 0, missingLive.stderr);
  assert.match(missingLive.stderr, /using the tracked HA template/);
  assert.equal(readFileSync(modelsPath, 'utf8').trim().split('\n')[1], 'cliproxyapi/gpt-6.2-sol');

  writeFileSync(haPath, '{not json');
  writeFileSync(modelsPath, '');
  const invalidLive = spawnSync(shim, ['run', '--auto', '--model', 'cliproxyapi/gemini-3.8-flash-high:high'], {
    env, input: 'review prompt', encoding: 'utf8',
  });
  assert.notEqual(invalidLive.status, 0, 'invalid HA configuration must fail');
  assert.match(invalidLive.stderr, /invalid HA configuration/);
  assert.doesNotMatch(invalidLive.stderr, /using the tracked HA template/);
  assert.equal(readFileSync(modelsPath, 'utf8'), '');

  for (const badConfig of [
    '{"groups":{"reviewer":{"entries":42}}}',
    '{"groups":{"reviewer":{"entries":false}}}',
    '{"groups":{"reviewer":{"entries":null}}}',
    '{"groups":{"reviewer":{"entries":[{}]}}}',
    '{"groups":{"reviewer":{"entries":[null]}}}',
    '{"groups":{"reviewer":{"entries":[{"id":123}]}}}',
    '{"groups":{"reviewer":{"entries":[{"id":false,"route":"cliproxyapi/legacy"}]}}}',
    '{"groups":{"reviewer":{"entries":[{"id":""}]}}}',
    '[]',
    '{} {}',
  ]) {
    writeFileSync(haPath, badConfig);
    writeFileSync(modelsPath, '');
    const malformed = spawnSync(shim, ['run', '--auto', '--model', 'cliproxyapi/gemini-3.8-flash-high:high'], {
      env, input: 'review prompt', encoding: 'utf8',
    });
    assert.notEqual(malformed.status, 0, `malformed HA must fail: ${badConfig}`);
    assert.match(malformed.stderr, /invalid HA configuration/);
    assert.doesNotMatch(malformed.stderr, /using the tracked HA template/);
    assert.equal(readFileSync(modelsPath, 'utf8'), '');
  }

  // Without jq the reviewer chain cannot be resolved, so the review must fail closed.
  const jqlessBin = join(dir, 'jqless');
  mkdirSync(jqlessBin, { recursive: true });
  for (const cmd of ['mktemp', 'cat', 'tr', 'sed', 'dirname', 'rm']) {
    const resolved = execSync(`command -v ${cmd}`, { encoding: 'utf8' }).trim();
    symlinkSync(resolved, join(jqlessBin, cmd));
  }
  symlinkSync(fakePi, join(jqlessBin, 'pi'));
  writeFileSync(haPath, JSON.stringify({ groups: { reviewer: { entries: [{ id: 'cliproxyapi/old-reviewer' }] } } }));
  writeFileSync(modelsPath, '');
  const jqless = spawnSync('/bin/bash', [shim, 'run', '--auto', '--model', 'cliproxyapi/gemini-3.8-flash-high:high'], {
    env: { ...env, PATH: jqlessBin }, input: 'review prompt', encoding: 'utf8',
  });
  assert.notEqual(jqless.status, 0, 'missing jq must fail closed');
  assert.match(jqless.stderr, /jq is required/);
  assert.equal(jqless.stdout, '');
  assert.equal(readFileSync(modelsPath, 'utf8'), '');
});
