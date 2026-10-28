import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const init = fileURLToPath(new URL('./init-repo.sh', import.meta.url));
const source = realpathSync(fileURLToPath(new URL('.', import.meta.url)));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'gga-init-'));
  const repo = join(root, 'repo');
  const bin = join(root, 'bin');
  mkdirSync(repo, { recursive: true });
  mkdirSync(bin, { recursive: true });
  assert.equal(spawnSync('git', ['init', '-q', repo]).status, 0);
  const fakeGga = join(bin, 'gga');
  writeFileSync(fakeGga, `#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = install ]; then
  root=$(git rev-parse --show-toplevel)
  mkdir -p "$(git rev-parse --git-common-dir)/hooks"
  printf '#!/usr/bin/env bash\\n# existing hook\\ngga run || exit 1\\n' > "$(git rev-parse --git-common-dir)/hooks/pre-commit"
  chmod +x "$(git rev-parse --git-common-dir)/hooks/pre-commit"
fi
`);
  chmodSync(fakeGga, 0o755);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, repo, bin };
}

test('initializes a repository with shared GGA and an idempotent Pi bridge hook', (t) => {
  const { repo, bin } = fixture(t);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
  const first = spawnSync(init, [repo], { env, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(realpathSync(join(repo, '.gga')), join(source, 'profiles/reviewer.gga'));
  assert.equal(realpathSync(join(repo, 'agents/gga-pi')), source);
  const hook = readFileSync(join(repo, '.git/hooks/pre-commit'), 'utf8');
  assert.equal((hook.match(/run-gga\.sh/g) ?? []).length, 1);
  assert.match(hook, /if \[ -x "\$gga_pi" \]; then/);

  const second = spawnSync(init, [repo], { env, encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr);
  const repeatedHook = readFileSync(join(repo, '.git/hooks/pre-commit'), 'utf8');
  assert.equal(repeatedHook, hook);
});

test('refuses to replace a regular repository config without --replace', (t) => {
  const { repo, bin } = fixture(t);
  writeFileSync(join(repo, '.gga'), 'PROVIDER="codex"\n');
  const result = spawnSync(init, [repo], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /already exists/);
  assert.equal(readFileSync(join(repo, '.gga'), 'utf8'), 'PROVIDER="codex"\n');
});

test('rejects more than one repository argument', (t) => {
  const { repo, bin } = fixture(t);
  const result = spawnSync(init, [repo, repo], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8',
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Only one repository/);
});
