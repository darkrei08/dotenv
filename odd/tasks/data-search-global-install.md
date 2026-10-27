# Global Data Search skill integration
Feature specification and work log for installing the published Data Search Pi skill into dotenv's canonical shared-skill setup.
Source of truth for local installation, linker configuration, verification, and publication.

## Specs

1. **S1**: "Questa nuova estensione quindi deve essere installata nel mio repo.emp e quindi aggiornata anche localmente in modo tale che tutte le sessioni agent possano usarla e poi pubblicare il commit dopodiché possiamo salvare tutto in memoria e chiudere questa sessione"
2. **S2**: "Si confermo"
3. **S3**: Install the published `reusable-data-search` skill from `https://github.com/darkrei08/pi-data-search` into the canonical `~/.agents/skills` root, declare it in dotenv's `agents/skills.manifest.json`, link it to supported agent harnesses, verify the result, and publish only the scoped dotenv integration changes.
4. **S4**: Preserve unrelated dirty changes in `/root/git/personale/dotenv`; do not copy credentials or duplicate the shared skill into Pi's local skill root.

## Tasks

- T1 (S1-S4): Install the published skill at the canonical root and add a default shared-skill manifest entry plus provenance documentation. Route: `agents/skills.manifest.json`, `docs/skills-and-agents.md`, `setup_env.sh`. Commit: `HEAD` (`feat(skills): install reusable data search globally`).
- T2 (S1-S4): Run linker dry-run/apply/verify and focused config tests without changing unrelated worktree state. Route: canonical global roots and dotenv checks. Commit: `HEAD` (`feat(skills): install reusable data search globally`).
- T3 (S1-S4): Inspect scoped diff/status, commit the integration branch, push it, and record the public commit/branch. Route: repository delivery. Commit: `HEAD` (`feat(skills): install reusable data search globally`); published at `origin/feat/data-search-global-install`.

## Log

L1: Questa nuova estensione quindi deve essere installata nel mio repo.emp e quindi aggiornata anche localmente in modo tale che tutte le sessioni agent possano usarla e poi pubblicare il commit dopodiché possiamo salvare tutto in memoria e chiudere questa sessione
L2: 2026-10-27: User clarified the target repository as `/root/git/personale/dotenv` and confirmed proceeding, including possible global activation. Work is isolated in `/root/git/personale/dotenv/.worktrees/data-search-global-install` on `feat/data-search-global-install` because the parent dotenv worktree contains unrelated dirty changes.
L3: 2026-10-27: The published skill source is `darkrei08/pi-data-search` merged commit `1feafcd7`; dotenv's canonical policy requires one physical copy under `~/.agents/skills`, manifest declaration, linker reconciliation, and no Pi-local duplicate.
L4: 2026-10-27: Installed the canonical skill from publication commit `7d19e656` at `~/.agents/skills/reusable-data-search`; linker dry-run/apply/verify passed with 5 links and Pi having no duplicate. Focused tests passed 21/21, `PI_CODING_AGENT_DIR="$PWD/pi/agent" bash check-config.sh` passed, `bash -n setup_env.sh` passed, `node --check agents/link-skills.mjs` passed, and `git diff --check` passed. Existing Cursor absence was reported as a skip, not a failure.
L5: 2026-10-27: Committed as the current `HEAD` (`feat(skills): install reusable data search globally`) after the repository GGA hook passed. The integration branch was ready to publish; unrelated dirty changes remain only in the parent worktree.
L6: 2026-10-27: Published `fa45597671bc2e716ac188bfc0e1911c60d60d73` to `origin/feat/data-search-global-install` with a normal fast-forward. The canonical skill and five harness links remain verified.

## Commit Evidence

- T1: `fa45597671bc2e716ac188bfc0e1911c60d60d73` (`feat(skills): install reusable data search globally`)
- T2: `fa45597671bc2e716ac188bfc0e1911c60d60d73` (`feat(skills): install reusable data search globally`)
- T3: `fa45597671bc2e716ac188bfc0e1911c60d60d73` (`feat(skills): install reusable data search globally`), published at `origin/feat/data-search-global-install`
