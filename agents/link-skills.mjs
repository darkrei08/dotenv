#!/usr/bin/env node
//
// link-skills.mjs - keep one physical copy of every shared skill and make it
// reachable from each harness that reads only its own skills root.
//
// The canonical root holds the files. Every harness whose `readsCanonical` flag
// is false gets one directory junction (Windows) or symlink (POSIX) per skill.
// A harness that reads the canonical root itself (pi) must not also have the
// skill in its own root, because it would then load the same skill twice; such a
// copy is reported and, with --apply, moved to a backup directory.
//
// Dry-run by default: it reports what --apply would do and mutates nothing.
// Nothing is ever deleted. An identical copy is moved to a backup directory; a
// copy that differs from the canonical entry is reported as a conflict and left
// exactly as it is. A conflict makes the run exit non-zero.
//
// Usage:
//   node agents/link-skills.mjs                 report only (default)
//   node agents/link-skills.mjs --apply         reconcile the tree
//   node agents/link-skills.mjs --verify        check the layout, change nothing
//   node agents/link-skills.mjs --only pi       restrict to one harness
//   node agents/link-skills.mjs --root <dir>    canonical root override
//   node agents/link-skills.mjs --backup-dir <dir>
//
import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_WINDOWS = process.platform === 'win32';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(SCRIPT_DIR, 'skills.manifest.json');

// Actions that mutate the tree. `drop-copy` and `drop-link` remove a duplicate
// from a root that already reads the canonical root; `fold-in` replaces a
// canonical entry that is a symlink to somewhere else with the real directory.
const MUTATING = new Set(['link', 'replace-copy-with-link', 'drop-copy', 'drop-link']);

function fail(message) {
  process.stderr.write(`link-skills: ${message}\n`);
  process.exit(2);
}

function expandPath(value) {
  if (value === '~') return homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2));
  return resolve(value);
}

function parseArgs(argv) {
  const options = { apply: false, verify: false, only: null, root: null, backupDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) fail(`${arg} needs a value`);
      i += 1;
      return next;
    };
    if (arg === '--apply') options.apply = true;
    else if (arg === '--verify') options.verify = true;
    else if (arg === '--only') options.only = value();
    else if (arg === '--root') options.root = value();
    else if (arg === '--backup-dir') options.backupDir = value();
    else if (arg === '--help' || arg === '-h') options.help = true;
    else fail(`unknown argument: ${arg}`);
  }
  if (options.apply && options.verify) fail('--apply and --verify are mutually exclusive');
  return options;
}

function exists(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function isLink(path) {
  return lstatSync(path).isSymbolicLink();
}

// Windows junctions and POSIX symlinks can carry different casing; compare the
// resolved targets through one normal form.
function sameTarget(a, b) {
  const left = realpathSync(a);
  const right = realpathSync(b);
  return (IS_WINDOWS ? left.toLowerCase() : left) === (IS_WINDOWS ? right.toLowerCase() : right);
}

function isInside(root, path) {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function sameContent(a, b) {
  const aIsDir = statSync(a).isDirectory();
  if (aIsDir !== statSync(b).isDirectory()) return false;
  if (!aIsDir) return readFileSync(a).equals(readFileSync(b));
  const aNames = readdirSync(a).sort();
  const bNames = readdirSync(b).sort();
  if (aNames.join('\n') !== bNames.join('\n')) return false;
  return aNames.every((name) => sameContent(join(a, name), join(b, name)));
}

function createLink(linkPath, target) {
  mkdirSync(dirname(linkPath), { recursive: true });
  if (IS_WINDOWS) {
    // mklink /J creates a directory junction, which needs no elevation.
    execFileSync('cmd', ['/c', 'mklink', '/J', linkPath, target], { stdio: 'pipe' });
  } else {
    symlinkSync(target, linkPath, 'dir');
  }
}

function loadManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (typeof manifest.canonicalRoot !== 'string') fail('manifest has no canonicalRoot');
  if (manifest.harnesses === null || typeof manifest.harnesses !== 'object') fail('manifest has no harnesses');
  if (manifest.skills === null || typeof manifest.skills !== 'object') fail('manifest has no skills');
  for (const [name, harness] of Object.entries(manifest.harnesses)) {
    if (harness === null || typeof harness !== 'object' || typeof harness.root !== 'string') fail(`harness ${name} has no root`);
  }
  for (const [name, policy] of Object.entries(manifest.skills)) {
    if (policy === null || typeof policy !== 'object') fail(`skill ${name} has no policy`);
    for (const harnessName of policy.except ?? []) {
      if (!manifest.harnesses[harnessName]) fail(`skill ${name} excepts unknown harness ${harnessName}`);
    }
  }
  return manifest;
}

function harnessPresent(harness) {
  const root = expandPath(harness.root);
  return exists(root) || exists(dirname(root));
}

// A harness that reads the canonical root already reaches every skill there, so
// `want` is false and an existing entry in its own root is a duplicate.
function wanted(skill, harnessName, harness, manifest) {
  const policy = manifest.skills[skill];
  if (policy.managed === false) return null;
  if (harness.readsCanonical === true) return false;
  if (policy.default === false) return false;
  return !(policy.except ?? []).includes(harnessName);
}

function planCanonical(manifest, canonicalRoot) {
  const entries = [];
  for (const skill of Object.keys(manifest.skills).sort()) {
    if (manifest.skills[skill].managed === false) continue;
    const path = join(canonicalRoot, skill);
    if (!exists(path)) {
      entries.push({ action: 'conflict', name: skill, detail: `missing from the canonical root: ${path}` });
    } else if (isLink(path)) {
      const target = realpathSync(path);
      entries.push(isInside(canonicalRoot, target)
        ? { action: 'skip', name: skill, detail: `canonical entry is a link inside the canonical root: ${target}` }
        : { action: 'fold-in', name: skill, detail: `${target} -> ${path}` });
    }
  }
  return entries;
}

function planHarness(harnessName, harness, manifest, canonicalRoot) {
  const root = expandPath(harness.root);
  const entries = [];
  for (const skill of Object.keys(manifest.skills).sort()) {
    const policy = manifest.skills[skill];
    const canonicalPath = join(canonicalRoot, skill);
    const target = join(root, skill);
    const want = wanted(skill, harnessName, harness, manifest);
    const present = exists(target);

    if (want === null) {
      if (present) entries.push({ action: 'skip', name: skill, detail: `unmanaged (${policy.reason ?? 'no reason given'})` });
      continue;
    }
    if (!exists(canonicalPath)) {
      if (want) entries.push({ action: 'conflict', name: skill, detail: `missing from the canonical root: ${canonicalPath}` });
      continue;
    }

    if (want) {
      if (!present) entries.push({ action: 'link', name: skill, detail: '' });
      else if (isLink(target)) {
        entries.push(sameTarget(target, canonicalPath)
          ? { action: 'already-linked', name: skill, detail: '' }
          : { action: 'conflict', name: skill, detail: `link points at ${readlinkSync(target)}` });
      } else if (!statSync(target).isDirectory()) {
        entries.push({ action: 'conflict', name: skill, detail: 'existing entry is a file, not a directory' });
      } else if (sameContent(target, canonicalPath)) {
        entries.push({ action: 'replace-copy-with-link', name: skill, detail: '' });
      } else {
        entries.push({ action: 'conflict', name: skill, detail: 'existing copy differs from the canonical entry' });
      }
      continue;
    }

    if (!present) continue;
    if (harness.readsCanonical === true) {
      if (isLink(target)) entries.push({ action: 'drop-link', name: skill, detail: 'redundant link; the canonical root already reaches this harness' });
      else if (statSync(target).isDirectory() && sameContent(target, canonicalPath)) {
        entries.push({ action: 'drop-copy', name: skill, detail: 'identical duplicate; the canonical root already reaches this harness' });
      } else {
        entries.push({ action: 'conflict', name: skill, detail: 'duplicate differs from the canonical entry' });
      }
    } else {
      entries.push({ action: 'skip', name: skill, detail: 'excluded from this harness by the manifest' });
    }
  }
  return { root, entries };
}

function backupDirFor(options, harnessName, skill) {
  const root = options.backupDir
    ? expandPath(options.backupDir)
    : join(homedir(), '.pi', 'backups', `link-skills-${options.timestamp}`);
  return join(root, harnessName, skill);
}

function moveToBackup(options, path, harnessName, skill) {
  const destination = backupDirFor(options, harnessName, skill);
  mkdirSync(dirname(destination), { recursive: true });
  renameSync(path, destination);
  return destination;
}

function applyCanonical(entries, canonicalRoot, report) {
  for (const entry of entries) {
    if (entry.action !== 'fold-in') {
      report(entry.action, entry.name, entry.detail);
      continue;
    }
    const path = join(canonicalRoot, entry.name);
    const temporary = join(canonicalRoot, `.${entry.name}.fold-in-tmp`);
    const target = realpathSync(path);
    try {
      renameSync(target, temporary);
      unlinkSync(path);
      renameSync(temporary, path);
    } catch (error) {
      report('conflict', entry.name, `FAILED: ${error.message}`);
      continue;
    }
    report(entry.action, entry.name, `${target} -> ${path}; the source directory can now be removed`);
  }
}

function applyHarness(harnessName, planned, options, report) {
  for (const entry of planned.entries) {
    const target = join(planned.root, entry.name);
    const canonicalPath = join(options.canonicalRoot, entry.name);
    if (!MUTATING.has(entry.action)) {
      report(entry.action, entry.name, entry.detail);
      continue;
    }
    try {
      let detail = entry.detail;
      if (entry.action === 'link') {
        createLink(target, canonicalPath);
      } else if (entry.action === 'replace-copy-with-link') {
        detail = `backup ${moveToBackup(options, target, harnessName, entry.name)}`;
        createLink(target, canonicalPath);
      } else if (entry.action === 'drop-copy') {
        detail = `backup ${moveToBackup(options, target, harnessName, entry.name)}`;
      } else if (entry.action === 'drop-link') {
        unlinkSync(target);
      }
      report(entry.action, entry.name, detail);
    } catch (error) {
      report('conflict', entry.name, `FAILED: ${error.message}`);
    }
  }
}

function verify(manifest, canonicalRoot, harnesses) {
  const failures = [];
  let links = 0;
  for (const [harnessName, harness] of harnesses) {
    if (!harnessPresent(harness)) continue;
    const root = expandPath(harness.root);
    for (const skill of Object.keys(manifest.skills).sort()) {
      if (manifest.skills[skill].managed === false) continue;
      const want = wanted(skill, harnessName, harness, manifest);
      const target = join(root, skill);
      const canonicalPath = join(canonicalRoot, skill);
      if (want) {
        if (!exists(target)) failures.push(`${harnessName}/${skill}: no link`);
        else if (!isLink(target)) failures.push(`${harnessName}/${skill}: not a link`);
        else if (!exists(join(canonicalPath, 'SKILL.md'))) failures.push(`${harnessName}/${skill}: linked SKILL.md is missing`);
        else if (!sameTarget(target, canonicalPath)) failures.push(`${harnessName}/${skill}: link resolves elsewhere`);
        else links += 1;
      } else if (harness.readsCanonical === true && exists(target)) {
        failures.push(`${harnessName}/${skill}: reachable twice (canonical root plus its own root)`);
      }
    }
  }
  for (const skill of Object.keys(manifest.skills).sort()) {
    const policy = manifest.skills[skill];
    if (policy.managed === false) continue;
    const path = join(canonicalRoot, skill);
    if (!exists(join(path, 'SKILL.md'))) failures.push(`canonical/${skill}: SKILL.md is missing`);
    else if (isLink(path) && !isInside(canonicalRoot, realpathSync(path))) failures.push(`canonical/${skill}: entry is a link to ${realpathSync(path)}`);
  }
  return { failures, links };
}

function printVerify(result) {
  for (const failure of result.failures) process.stdout.write(`verify: FAIL ${failure}\n`);
  if (result.failures.length > 0) {
    process.stdout.write(`verify: ${result.failures.length} problem(s), ${result.links} link(s) checked\n`);
    return false;
  }
  process.stdout.write(`verify: OK, ${result.links} link(s) checked\n`);
  return true;
}

function usage() {
  const source = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  const header = source.slice(0, source.findIndex((line) => line.startsWith('import ')));
  return header.filter((line) => line.startsWith('// ')).map((line) => line.slice(3)).join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const manifest = loadManifest();
  const canonicalRoot = expandPath(options.root ?? manifest.canonicalRoot);
  const harnesses = Object.entries(manifest.harnesses).filter(([name]) => !options.only || name === options.only);
  if (harnesses.length === 0) fail(`no harness named ${options.only}`);

  if (options.verify) {
    if (!printVerify(verify(manifest, canonicalRoot, harnesses))) process.exit(1);
    return;
  }

  options.canonicalRoot = canonicalRoot;
  options.timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  process.stdout.write(`link-skills: canonical root ${canonicalRoot}\n`);
  process.stdout.write(options.apply ? 'link-skills: apply\n' : 'link-skills: dry-run (pass --apply to mutate)\n');

  const counts = new Map();
  const conflicts = [];
  const report = (action, name, detail) => {
    counts.set(action, (counts.get(action) ?? 0) + 1);
    process.stdout.write(`  ${action.padEnd(24)} ${name}${detail ? `  ${detail}` : ''}\n`);
    if (action === 'conflict') conflicts.push(`${name}  ${detail}`);
  };

  const canonicalPlan = options.only ? [] : planCanonical(manifest, canonicalRoot);
  if (canonicalPlan.length > 0) {
    process.stdout.write('\ncanonical\n');
    if (options.apply) applyCanonical(canonicalPlan, canonicalRoot, report);
    else for (const entry of canonicalPlan) report(entry.action, entry.name, entry.detail);
  }

  for (const [harnessName, harness] of harnesses) {
    process.stdout.write(`\n${harnessName}\n`);
    if (!harnessPresent(harness)) {
      report('skip', 'harness', `not installed (${harness.root})`);
      continue;
    }
    const planned = planHarness(harnessName, harness, manifest, canonicalRoot);
    if (planned.entries.length === 0) process.stdout.write('  (nothing to do)\n');
    if (options.apply) applyHarness(harnessName, planned, options, report);
    else for (const entry of planned.entries) report(entry.action, entry.name, entry.detail);
  }

  const summary = [...counts.entries()].map(([action, count]) => `${count} ${action}`).join(', ');
  process.stdout.write(`\nsummary: ${summary || 'nothing to do'}\n`);

  let failed = conflicts.length > 0;
  if (options.apply) {
    process.stdout.write('\n');
    if (!printVerify(verify(manifest, canonicalRoot, harnesses))) failed = true;
  }
  if (conflicts.length > 0) {
    for (const conflict of conflicts) process.stdout.write(`conflict: ${conflict}\n`);
    process.stdout.write(`link-skills: ${conflicts.length} conflict(s); resolve each one by hand, then re-run\n`);
  }
  if (failed) process.exit(1);
}

main();
