# Skills and other agents

How shared skills are installed, linked and attributed, and how the non-Pi agent CLIs are configured. See also [`agents/LINKING.md`](../agents/LINKING.md).

## Skills layout: one physical copy

There is exactly one physical copy of each shared skill. `~/.agents/skills` is the canonical root; every other harness root holds a directory junction (Windows) or symlink (POSIX) per skill:

| Root | Mechanism |
| --- | --- |
| `~/.agents/skills` | Canonical root, real files |
| `~/.claude/skills` | Junction / symlink |
| `~/.codex/skills` | Junction / symlink |
| `~/.config/opencode/skills` | Junction / symlink |
| `~/.gemini/skills` | Junction / symlink |
| `~/.gemini/antigravity-cli/skills` | Junction / symlink |
| `~/.pi/agent/skills` | Exception: holds only Pi-specific skills, because Pi reads the canonical root as well. A shared skill here would be listed twice. |

`agents/link-skills.mjs` reconciles the tree, driven by `agents/skills.manifest.json`, which declares the canonical root, the harness roots and each skill's policy:

| Policy | Meaning |
| --- | --- |
| `{ "default": true }` | Link the skill into every harness root. |
| `{ "default": true, "except": ["codex"] }` | Skip the named harnesses. |
| `{ "default": false }` | Link nowhere; canonical only. |
| `{ "managed": false, "reason": "..." }` | Leave the skill alone entirely (`impeccable`). |
| `"readsCanonical": true` | The harness never gets links, and a shared skill in its root is dropped. Only `pi` sets this. |

Commands, with the exact flags the script accepts:

```bash
node agents/link-skills.mjs              # dry run: report what --apply would do
node agents/link-skills.mjs --apply      # reconcile the tree
node agents/link-skills.mjs --verify     # check the layout, change nothing
node agents/link-skills.mjs --only pi    # restrict to one harness
node agents/link-skills.mjs --root <dir> # canonical root override
node agents/link-skills.mjs --backup-dir <dir>
```

Dry-run is the default; only `--apply` mutates. Exit status is `0` when there is nothing to do or everything is in place, `1` when at least one conflict was reported, and `2` for a bad invocation. Backups default to `~/.pi/backups/link-skills-<timestamp>/<harness>/<skill>`, a new directory per run. The linker never deletes anything.

The rule for agents working in this repository:

1. Install a skill **once**, from its upstream installer or by hand, into `~/.agents/skills/<name>/` with a `SKILL.md`.
2. Add it to `agents/skills.manifest.json`, listing under `except` the harnesses that must not receive it.
3. Run `node agents/link-skills.mjs` to review, then `--apply`.
4. Confirm with `node agents/link-skills.mjs --verify`.

Never copy the same skill into two roots, and never edit a linked skill in place: the link points at the canonical copy, so the edit is the canonical edit, but the duplicate you also copied elsewhere will drift. `agents/install-agent-extensions.sh` copies the skills this repository ships (`phantom-ui`) into every harness root; that is compatible, and the next `--apply` sees an identical copy and folds it back into a link.

[`agents/LINKING.md`](../agents/LINKING.md) documents the actions (`link`, `already-linked`, `replace-copy-with-link`, `drop-copy`, `drop-link`, `fold-in`, `conflict`, `skip`), the conflict procedure, and the two unmanaged cases: `_shared/` is a support directory with no `SKILL.md` and a per-runtime copy per harness, and `impeccable` is installed per provider by its own installer, so each harness copy legitimately differs.

## Skill provenance

| Upstream | Skills | Installer |
| --- | --- | --- |
| `herdrdev/herdr` | `herdr` | `npx skills add ... --global --agent pi cline --yes` (`setup_env.sh`) |
| `mattpocock/skills` | First-party engineering set, including `setup-matt-pocock-skills`, `code-review`, `diagnosing-bugs`, `tdd`, planning, research, and implementation skills | `npx skills@latest add ... --global --agent pi cline --yes` |
| `pedronauck/skills` | `typescript-advanced` | `npx skills add` |
| `humanlayer/skills` | `show-me` | `npx skills add` |
| `micio86dev/Engineering-Excellence` | `engineering-excellence` | `npx skills@latest add` |
| `darkrei08/ai-memory-kit` (tag `v0.1.0`) | `project-memory` | Pinned `npx skills add "...#v0.1.0"`; setup fails closed if the tag cannot be fetched. The `aimem` CLI installer runs with `--no-skill` |
| `h3nryprod01/design-taste` | `design-taste` | `npx skills@latest add ... --global --agent <agent> --copy --yes`, per detected CLI, in `install-agent-extensions.sh` |
| `pbakaus/impeccable` | `impeccable` | `npx impeccable install --providers=... --scope=global`, run in a scratch directory; engine binary lands in `~/.impeccable/bin` |
| `DietrichGebert/ponytail` | `ponytail` (plus its commands) | Per-host plugin installers in `install-agent-extensions.sh`; for Pi, `git:github.com/DietrichGebert/ponytail` in `pi-packages.txt` |
| this repository | `phantom-ui` (`agents/skills/phantom-ui`, MIT build, provenance in `VENDORED.md`) | `agents/install-agent-extensions.sh` copies it into every existing non-Pi harness root and the shared canonical root |
| this repository | `issue-ops`, `learning-opportunities`, `orient`, `tigerstyle` | Tracked directly under `pi/agent/skills/`, Pi-only |
| `pi` examples | `questionnaire` tool | Copied into `pi/agent/extensions/questionnaire.ts` |

## Non-Pi agents

`agents/install-agent-extensions.sh` targets every agent CLI it finds on `PATH` and logs a skip for the ones that are absent:

| Agent | How it is configured |
| --- | --- |
| Codex CLI | `codex plugin marketplace add DietrichGebert/ponytail`, then `codex plugin add ponytail@ponytail` |
| Antigravity CLI (`agy`) or Gemini CLI | `agy plugin install <ponytail URL>`, falling back to `gemini extensions install <ponytail URL>` |
| Copilot CLI | `copilot plugin marketplace add ...` then `copilot plugin install ponytail@ponytail` |
| OpenCode | adds `@dietrichgebert/ponytail` to the `plugin` array of `~/.config/opencode/opencode.json` through a small Node edit that refuses to rewrite a config that is not plain JSON |
| Claude Code | Not scriptable: the script prints the two interactive `/plugin` commands as a manual step |
| pi | Not handled here; Pi installs ponytail from `pi/agent/pi-packages.txt` |

The same script installs `design-taste` and `impeccable` through their upstream installers, and copies `phantom-ui` into each existing non-Pi harness skills root (`claude-code`, `codex`, `gemini-cli`, `cursor`, `antigravity`, `opencode`, plus `~/.agents/skills`). Pi reads the canonical root. Differing copies are moved to `~/.pi/backups/install-agent-extensions.*` before replacement; one failing host is logged and does not stop the run, and the exit status is 1 when an attempted step failed. Skills themselves are single-sourced and junctioned as described above.

Other harnesses this repository configures indirectly: `~/.codex`, `~/.claude`, `~/.gemini`, `~/.config/opencode` are only written by the skills installer and the linker; the one exception is that `setup_env.sh`, when run as root, sets `permissions.defaultMode` to `default` in `~/.claude/settings.json` and preserves every other setting.
