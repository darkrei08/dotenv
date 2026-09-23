# Skill linking

Skills are installed once and linked, never copied into two harness roots. A
linked skill cannot drift from its brothers, because there is only one file.

## Layout

- `~/.agents/skills` is the canonical root: the single physical copy of every
  shared skill.
- `~/.claude/skills`, `~/.codex/skills`, `~/.config/opencode/skills`,
  `~/.gemini/skills` and `~/.gemini/antigravity-cli/skills` hold one directory
  junction (Windows) or symlink (POSIX) per skill, pointing at the canonical
  entry. `mklink /J` needs no elevation.
- `~/.pi/agent/skills` is the exception. Pi reads the canonical root as well as
  its own, so its own root keeps only skills that must not be shared. A shared
  skill that appears there is a duplicate and Pi would list it twice.
- `agents/skills.manifest.json` declares the canonical root, the harness roots
  and each skill's policy:
  - `{ "default": true }` links the skill into every harness root.
  - `{ "default": true, "except": ["codex"] }` skips the named harnesses.
  - `{ "default": false }` links the skill nowhere (canonical only).
  - `{ "managed": false, "reason": "..." }` leaves a skill alone entirely.
  - A harness marked `"readsCanonical": true` (pi) never gets links, and a
    shared skill in its root is dropped.

## Commands

```bash
node agents/link-skills.mjs              # dry run: report what --apply would do
node agents/link-skills.mjs --apply      # reconcile the tree
node agents/link-skills.mjs --verify     # check the layout, change nothing
node agents/link-skills.mjs --only pi    # restrict to one harness
node agents/link-skills.mjs --skill humanizer # restrict to one skill
node agents/link-skills.mjs --skill humanizer --skill heroui-react # multiple skills
node agents/link-skills.mjs --root <dir> # canonical root override
node agents/link-skills.mjs --backup-dir <dir>
```

Dry-run is the default; only `--apply` mutates. `--skill <name>` can be repeated;
requested names must exist in the manifest, and the filter limits planning, apply,
and verification to those skills. It composes with `--only <harness>`. Exit status
is `0` when there is nothing to do or everything is in place, `1` when at least
one conflict was reported, and `2` for a bad invocation.

## Actions

| Action | Meaning |
| --- | --- |
| `link` | create the junction/symlink |
| `already-linked` | the link already resolves to the canonical entry |
| `replace-copy-with-link` | move the identical real directory to a backup, then link |
| `drop-copy` | move an identical duplicate out of a canonical-reading root (pi); no link is created |
| `drop-link` | remove a redundant link from a canonical-reading root |
| `fold-in` | a canonical entry was a symlink outside the canonical root; move the real directory in |
| `conflict` | something differs; nothing is changed and the run exits non-zero |
| `skip` | unmanaged or excluded entry, or a harness that is not installed |

Backups default to `~/.pi/backups/link-skills-<timestamp>/<harness>/<skill>`. A
new directory is created per run, so a repeated `--apply` cannot overwrite an
earlier backup. The linker never deletes anything.

## When a conflict is reported

A conflict means a real directory differs from the canonical entry or a link
points somewhere else. The linker leaves it exactly as it was. Resolve it by
hand:

1. Read the reported path and compare it with the canonical entry.
2. If the harness copy is stale, delete it or move it aside and re-run the
   linker.
3. If the difference is deliberate, add `{ "managed": false }` to that skill in
   `agents/skills.manifest.json` with a short reason and record it below.
4. Re-run `node agents/link-skills.mjs --apply` until `--verify` reports
   `verify: OK`.

## After installing a new skill

1. Install it once, from its upstream installer or by hand, into
   `~/.agents/skills/<name>/` (with a `SKILL.md`).
2. Add it to `agents/skills.manifest.json` and list the harnesses that must not
   receive it under `except`.
3. Review with `node agents/link-skills.mjs --skill <name>`, then apply with
   `node agents/link-skills.mjs --apply --skill <name>`.
4. Verify with `node agents/link-skills.mjs --verify --skill <name>`.

`agents/install-agent-extensions.sh` copies the skills this repository ships
(for example `phantom-ui`) into every harness root. That is compatible: the next
`--apply` sees an identical copy and folds it back into a link. Run the linker
after that installer when a copy must become a link again.

## What is not managed, and why

- `_shared/` is a support directory, not an invokable skill: it has no
  `SKILL.md`. Its `review-ledger-contract.md` is parameterized per agent runtime
  (`--agent codex`, `--agent claude`, ...), so each harness legitimately keeps
  its own copy. The linker ignores the whole directory.
- `impeccable` is installed by its own installer per provider. Each harness copy
  is provider-specific (paths and command prefixes differ), so the manifest
  marks it `managed: false`.
- Pi-only skills (`~/.pi/agent/skills/<name>`) are not in the canonical root and
  are never linked into another harness.

## `~/skills-canonical`

`find-skills` was moved to `~/skills-canonical/find-skills` during the junction
tests, with a symlink left at `~/.agents/skills/find-skills`. The linker does
not adopt that directory as a second canonical root. On `--apply` it treats any
canonical entry that is a symlink to outside the canonical root as `fold-in`:
the real directory is moved to `~/.agents/skills/<name>` and the symlink is
replaced. After that, `~/skills-canonical` is empty and can be removed by hand;
the linker itself never deletes a directory.

## Caveats

- Junction discovery in `~/.agents/skills` is verified for Pi. For the other
  harnesses this repository records where they are expected to read skills from;
  a harness that ignores junctions in its own root is not something the linker
  can detect. Run `--verify` and start each harness once after `--apply`.
