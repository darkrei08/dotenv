// Regression tests for the skill collision / canonical-ownership rules (T1, S1-S3, S15, S19).
// Covers:
//   - project-memory is declared as managed in skills.manifest.json
//   - pi harness has readsCanonical:true so it never gets skill links
//   - link-skills --only pi detects a physical duplicate as drop-copy (not skip)
//   - link-skills --apply --only pi backs up the duplicate without deleting the backup (S19)
//   - setup_env.sh no longer passes 'pi' in --agent for the project-memory install
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST_PATH = join(REPO, 'agents', 'skills.manifest.json');
const LINKER = join(REPO, 'agents', 'link-skills.mjs');
const SETUP = join(REPO, 'setup_env.sh');

// ── manifest shape ───────────────────────────────────────────────────────────

test('project-memory is present in skills.manifest.json as a managed skill', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const policy = manifest.skills['project-memory'];
  assert.ok(policy !== undefined, 'project-memory must appear in the manifest');
  assert.ok(policy.managed !== false, 'project-memory must be managed (not managed:false)');
});

test('pi harness is marked readsCanonical in skills.manifest.json', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  assert.equal(manifest.harnesses?.pi?.readsCanonical, true, 'pi harness must have readsCanonical:true');
});

test('reusable-data-search is shared and pinned to the published skill', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  assert.deepEqual(manifest.skills['reusable-data-search'], { default: true });

  const src = readFileSync(SETUP, 'utf8');
  assert.match(src, /DATA_SEARCH_REF=7d19e656be75b2dc853d4edc7b3c29a9b839b8cf/);
  assert.ok(
    src.includes('--skill reusable-data-search --global --agent cline --yes'),
    'reusable-data-search must install into the canonical cline materialization',
  );
});

// ── setup_env.sh does not put project-memory into the Pi-local root ──────────

test('setup_env.sh project-memory install does not pass --agent pi', () => {
  const src = readFileSync(SETUP, 'utf8');
  // Collect only uncommented lines that contain the project-memory skills-add call.
  const liveLines = src
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .filter((l) => l.includes('project-memory') && l.includes('skills add'));
  assert.ok(liveLines.length > 0, 'must have at least one live skills-add line for project-memory');
  for (const line of liveLines) {
    assert.doesNotMatch(
      line,
      /--agent\s[^\n]*\bpi\b/,
      'project-memory skills install must not target the pi harness (would create a Pi-local duplicate)',
    );
  }
});

test('setup_env.sh skips shared-skill reconciliation when skill installation is disabled', () => {
  const src = readFileSync(SETUP, 'utf8');
  const guardStart = src.indexOf('if [[ "${SETUP_AI_SKIP_SKILLS:-0}" != "1" ]]; then');
  const linkCall = src.indexOf('node "$REPO_DIR/agents/link-skills.mjs" --apply', guardStart);
  const guardEnd = src.indexOf('\nfi', linkCall);
  assert.ok(guardStart >= 0 && linkCall > guardStart && guardEnd > linkCall, 'linker must be guarded by SETUP_AI_SKIP_SKILLS');
});

test('setup_env.sh guards the project-memory skill installation when skills are disabled', () => {
  const src = readFileSync(SETUP, 'utf8');
  const installCall = src.indexOf('npx skills add "darkrei08/ai-memory-kit#${AIMEM_REF}"');
  const guardStart = src.lastIndexOf('if [[ "${SETUP_AI_SKIP_SKILLS:-0}" != "1" ]]; then', installCall);
  const guardEnd = src.indexOf('\nfi', installCall);
  assert.ok(installCall >= 0 && guardStart >= 0 && guardEnd > installCall, 'project-memory install must be guarded by SETUP_AI_SKIP_SKILLS');
});

test('sync_pi normalizes live settings with a target-local temporary file', () => {
  const src = readFileSync(SETUP, 'utf8');
  assert.ok(
    src.includes('tmp_settings=$(mktemp "$target/settings.json.XXXXXX")'),
    'settings replacement must create its temporary file beside the live target',
  );
});

// ── linker fixture ───────────────────────────────────────────────────────────

function makeFixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'skill-collision-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));

  // Canonical root with a physical project-memory skill.
  const canonical = join(home, '.agents', 'skills');
  mkdirSync(join(canonical, 'project-memory'), { recursive: true });
  writeFileSync(join(canonical, 'project-memory', 'SKILL.md'), '# project-memory canonical');

  // Pi-local root with an identical physical duplicate (the old collision).
  const piLocal = join(home, '.pi', 'agent', 'skills');
  mkdirSync(join(piLocal, 'project-memory'), { recursive: true });
  writeFileSync(join(piLocal, 'project-memory', 'SKILL.md'), '# project-memory canonical');

  return { home, canonical, piLocal };
}

function runLinker(args, home) {
  return spawnSync(process.execPath, [LINKER, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

// Recursively find the first subdirectory whose basename matches target.
function locateDir(dir, target) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name === target) return full;
    const found = locateDir(full, target);
    if (found) return found;
  }
  return null;
}

// ── link-skills collision detection tests ────────────────────────────────────

test('link-skills dry-run detects Pi-local project-memory duplicate as drop-copy', (t) => {
  const { home, canonical } = makeFixture(t);
  const result = runLinker(['--only', 'pi', '--skill', 'project-memory', '--root', canonical], home);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /drop-copy\s+project-memory/,
    'dry-run must report drop-copy for the Pi-local duplicate',
  );
});

test('link-skills --apply --only pi moves duplicate to backup and preserves SKILL.md (S19)', (t) => {
  const { home, canonical, piLocal } = makeFixture(t);
  const result = runLinker(
    ['--apply', '--only', 'pi', '--skill', 'project-memory', '--root', canonical],
    home,
  );
  assert.equal(result.status, 0, result.stderr);

  // The pi-local entry must be gone from the Pi skills root.
  assert.equal(
    existsSync(join(piLocal, 'project-memory')),
    false,
    'Pi-local project-memory directory must be removed after --apply',
  );

  // A backup must have been created under ~/.pi/backups (linker's default).
  const backupsRoot = join(home, '.pi', 'backups');
  assert.ok(existsSync(backupsRoot), 'backup root must have been created by the linker');

  const backup = locateDir(backupsRoot, 'project-memory');
  assert.ok(backup, 'a project-memory backup directory must exist under ~/.pi/backups');
  assert.ok(
    existsSync(join(backup, 'SKILL.md')),
    'backed-up SKILL.md must be intact — linker must never delete user data (S19)',
  );
});
