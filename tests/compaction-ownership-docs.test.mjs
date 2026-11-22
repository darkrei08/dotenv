// Documentation invariants for the Pi compaction and codemode ownership model.
//
// One compaction owner per profile, codemode as the sole script executor, and
// two mutually exclusive alternates. The versions are exact on purpose: the
// docs are the only place that states which owner an installation follows.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
const flat = (rel) => read(rel).replace(/\s+/g, ' ');

const DOCS = ['docs/pi-configuration.md', 'docs/agent-skill-priority.md'];

for (const doc of DOCS) {
  test(`${doc} states the single compaction owner and codemode executor`, () => {
    const text = flat(doc);
    assert.match(text, /compaction owner/i, 'names the compaction owner');
    assert.match(text, /npm:@sting8k\/pi-vcc@0\.11\.2/, 'pins the installed owner version');
    assert.match(text, /Pi 1\.5\.0/, 'pins the Pi release that ships codemode');
    assert.match(text, /codemode/, 'names codemode');
    assert.match(text, /sole script executor/i, 'codemode is the only script executor');
    assert.match(text, /pi-vcc-codemode@0\.1\.6/, 'pins the first alternate');
    assert.match(text, /@rochecompaan\/pi-context-paging@0\.3\.11/, 'pins the second alternate');
    assert.match(text, /mutually exclusive/i, 'the alternates are mutually exclusive');
    assert.match(text, /two compaction engines are never installed together/i, 'states the prohibition');
  });
}

test('the versioned configuration installs exactly one compaction owner', () => {
  const settings = JSON.parse(read('pi/agent/settings.json'));
  const manifest = JSON.parse(read('pi/agent/npm/package.json'));
  const packages = read('pi/agent/pi-packages.txt')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  assert.ok(settings.packages.includes('npm:@sting8k/pi-vcc'), 'settings.json registers the owner');
  assert.ok(packages.includes('npm:@sting8k/pi-vcc'), 'pi-packages.txt registers the owner');
  assert.ok('@sting8k/pi-vcc' in manifest.dependencies, 'the npm manifest tracks the owner');

  const alternates = ['pi-vcc-codemode', '@rochecompaan/pi-context-paging'];
  const installed = [
    ...packages,
    ...settings.packages.map((entry) => (typeof entry === 'string' ? entry : entry.source)),
    ...Object.keys(manifest.dependencies),
  ].join('\n');
  for (const alternate of alternates) {
    assert.ok(!installed.includes(alternate), `${alternate} must not be installed next to the owner`);
  }
});
