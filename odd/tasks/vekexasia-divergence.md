# Divergence index: `darkrei08/dotenv` (ours) vs `vekexasia/dotenv` (his)

- **Purpose:** one place to answer "what does upstream have that we do not, what do we have that it
  does not, and why", so a future comparison starts from a classification instead of a fresh diff.
- **Recorded:** 2026-09-18. Ours `origin/master`; his `upstream/master` = `202143e`.
- **Status:** the two accepted items are integrated on `chore/vekexasia-alignment`; the rest is
  classified as rejected with a reason.

## How to regenerate the mechanical half

```sh
cd ~/git/personale/dotenv
git fetch upstream
git diff --name-status upstream/master origin/master        # added / modified / deleted
git diff --numstat     upstream/master origin/master        # how much, per file
git log --oneline origin/master..upstream/master --name-only # which of his commits did it
```

Any path that appears there and is not classified below is **unclassified** and has to be added
here with a verdict before it can be copied. An entry may name a directory or a glob
(`roles/{developer,reviewer,scout}.md`, `pi-codex-context/**`), in which case every path under it is
covered by that verdict. That is the whole contract: the diff is mechanical, the verdict is not.

Legend for direction: **OURS-ONLY** exists only here; **HIS-ONLY** exists only there;
**DIVERGED** both have it and they differ.

## 1. OURS-ONLY: present here, absent upstream

| path | introduced by | why it exists |
|---|---|---|
| `.gga` | `789f4de` | review gate config: rules file `AGENTS.md`, patterns `*.sh,*.ps1,*.mjs,*.js`, exclusions `logs/*,*.log,*.jsonl`. Upstream has no review gate |
| `REVIEW_RULES.md` | `789f4de` | cross-file parity rules for the Pi config (e.g. `settings.json` must agree with `pi/agent/npm/package.json`) |
| `agents/` (`LINKING.md`, `link-skills.mjs`, `install-agent-extensions.sh`, `skills.manifest.json`, `skills/phantom-ui/*`) | `5d119c0` | one physical copy of every skill, linked into each harness root instead of duplicated |
| `check-config.sh` | `a2a6e50` | the fresh-machine regression check for `settings.json` + `setup_env.sh` (5 assertions) |
| `docs/resource-discipline.md` | `97b1269` | how many Pi sessions a 16 GB host can carry, how to launch them, `autoMemoryReclaim` |
| `pi/agent/MODELS.md` | `1de3a06` | the thinking level each OpenCode Go model actually accepts |
| `pi/agent/extensions/gentle-bar.ts` | `5dd56e8` | our own status bar. That commit **deleted `footer.ts` (370 lines) and added this (363)**, so upstream's `footer.ts` is the file we replaced |
| `pi/agent/extensions/rotator-autostart/` | `6f68729` | start the tuxevil-rotator gateway when a session opens, so the `gemini-*` aliases resolve |
| `pi/agent/pi-packages.txt` | `b9452cc` | the declarative package manifest that `setup-ai`'s `pi-packages` module reads and verifies |
| `pi/agent/skills/container-test-matrix/**` | `4074fba` | the platform-matrix rule: run the affected commands in every distro the project claims |
| `pi/agent/skills/issue-ops/**` | `be51dbd` | the issue/PR method skill, wired into `AGENTS.md` and the roles |
| `pi/agent/pi-extensible-workflows/roles/oracle.md`, `roles/researcher.md` | — | upstream deleted these roles; the workflow skill still asks for them |

## 2. HIS-ONLY: present upstream, absent here

| path | his commit | why we do not take it |
|---|---|---|
| `pi/agent/extensions/footer.ts` | carried by `836f689 updates` | it is the bar `5dd56e8` deleted and replaced with `gentle-bar.ts`. Taking it puts two competing bars in the tree |
| `pi/agent/extensions/pi-openai-fast.json` | carried by `836f689 updates` | config for a `pi-openai-fast` extension that is not installed here: no consumer. Dropped in `789f4de` |
| `pi/agent/packages/pi-codex-context/RESEARCH-sol-pi-benchmark.md`, `test/replay-benchmark.mjs` | `202143e`, `6c0205e` | **TAKEN** with the package below |

## 3. DIVERGED: both have it, ours is the one to keep

`ours -> his` line counts are `git diff --numstat upstream/master origin/master` inverted, so a large
`-` means copying his version would delete that many lines of ours.

| path | ours -> his | his last commit | why ours wins |
|---|---|---|---|
| `pi/agent/settings.json` | `+7 -19` | `202143e`, `836f689` | his version restores `../../git/personale/pi-workflows` (+ its herdr extension) and `npm:@sting8k/pi-vcc`, and drops `npm:pi-extensible-workflows`, `npm:gentle-pi`, `npm:pi-mcp-adapter`, `npm:gentle-engram`, `packages/pi-codex-context`. Taking it reintroduces the C2 bug the fork just fixed and the P0 tool-name conflict |
| `setup_env.sh` | `+27 -234` | `836f689` | his is 234 lines older: no `sync_pi` allowlist, no `39f2dec` GitHub API 403 resilience |
| `pi/agent/models.json` | `+0 -92` | `40b31ff a` | his dropped the whole `tuxevil-rotator` provider block, which is what serves the `gemini-*` aliases |
| `pi/agent/pi-extensible-workflows/settings.json` | `+5 -28` | `836f689` | his kept 8 model aliases and 1 skill; ours has 17 aliases (tuxevil-rotator Gemini, opencode-go) and 7 skills. His own issue #4 about the missing aliases was closed as mis-filed "belongs in the fork" |
| `pi/agent/pi-extensible-workflows/roles/{developer,reviewer,scout}.md` | ~20 each | `836f689` | his are leaner: no `issue-ops` skill, shorter rules |
| `pi/agent/AGENTS.md` | `+47 -110` | `9acf68d agents` | his is 110 lines shorter: the pre-directive version |
| `README.md` | `+5 -357` | `836f689` | his is 357 lines shorter |
| `pi/agent/README.md` | `+1 -45` | `836f689` | same |
| `pi/agent/.gitignore` | `+57 -63` | `836f689` | different, shorter allowlist; ours matches the tracked set |
| `pi/agent/extensions/compact-tools.ts` | `+5 -9` | `836f689` | his reverts the opt-in to the older double negative `PI_DISABLE_COMPACT_TOOLS != "0"` with a garbled comment; ours is `PI_ENABLE_COMPACT_TOOLS=1` |
| `pi/agent/modes.json` | `+2 -7` | `836f689`, `faa40b4 a` | his drops the `opencode-max` mode and leaves broken formatting (tab-indented brace, trailing whitespace) |
| `pi/agent/npm/package.json` | `+3 -3` | `202143e`, `836f689` | his three bumps: two accepted, one rejected (below) |
| `pi/agent/packages/pi-codex-context/**` | 11 files, `+2391 -175` | `202143e`, `6c0205e` | **TAKEN** — the one genuine advance upstream |

## 4. Taken this round, with the verification

| item | commit here | verification |
|---|---|---|
| `pi-codex-context` package (`798e760`) | `798e760` | `npm run typecheck` exit 0; `npm test` **39/39 pass**, 0 fail, 2.2s; the package's own `.gitignore` keeps `node_modules/` out of `git status` |
| `@sting8k/pi-vcc` ^0.7.3, `pi-markdown-preview` ^0.17.0 | same branch | lock regenerated locally, 5 lines added / 5 removed; resolved to 0.7.3 and 0.17.1 |

## 5. Rejected this round, with the reproduction

| item | why |
|---|---|
| `pi-btw` ^0.5.0 | `npm install` fails with `ERESOLVE`: `pi-btw@0.5.0` peers `@earendil-works/pi-tui@">=0.85.1 <1"`, which does not resolve against the rest of this tree. `--legacy-peer-deps` would accept a resolution npm itself rejects. Stays at ^0.4.1 |
| upstream's `pi/agent/npm/package-lock.json` | 78k-line diff from a different resolution history; the lock is regenerated locally instead of copied |

## 6. Checked and identical: no action needed

These paths are byte-identical in both trees, so a future comparison can skip them:

`pi/agent/extensions/`: `answer.ts`, `deep-think.ts`, `fork-out.ts`, `herdr-nvim-blocked/index{,.test}.ts`,
`learning-opportunities-auto.ts`, `live-dashboard.ts`, `pi-ext-workflows/*.ts`,
`piextworkflows.ts`, `questionnaire.ts`, `show-system-prompt.ts`, `tmux-progress.ts`, `vim-editor.ts`.

## 7. Pinned `vekexasia/*` packages: nothing to take

| pin | upstream state | verdict |
|---|---|---|
| `pi-notify@feat/customizable-notifications` | branch is **3 ahead, 0 behind** `master` | pin is the newer line |
| `chrome-cdp-skill@feat/cdp-ws-url` | branch is **8 ahead, 0 behind** `main` | pin is the newer line |
| `pi-high-availability` | last pushed 2026-05-01 | nothing newer |
| `npm:pi-extensible-workflows` | `main` pushed 2026-09-18; latest GitHub release `v5.14.0`; npm `5.15.0`; installed `5.15.0` carries `renameWithRetry` | current |

## 8. Issue trackers

| repository | state |
|---|---|
| `vekexasia/dotenv` | one issue, #4 (Pi aliases / rotator gateway), closed as "Opened in the wrong repository by mistake: this belongs in the fork (darkrei08/dotenv)" |
| `vekexasia/dotenv` PRs | #2, #3 opened from this fork and closed unmerged; #1 merged |
| `darkrei08/dotenv` | #6, #8, #10, #12, #14 all closed; #8 is the fork's copy of upstream #4 |

The fork is the canonical repository for this configuration; there is no upstream backlog to inherit.

## 9. Follow-ups this comparison surfaced

1. `roles/*.md` here and upstream still declare `tools: [..., replace, undo_last_change, ...]`, names
   Pi no longer exposes (`edit`, `write`). The live harness migrates them in `~/.pi/agent` at run
   time, but `sync_pi` copies the stale names back on every run, so the migration repeats forever.
2. The context-rollover reminder threshold is hard-coded, `max(32_000, 10% of contextWindow)`, in
   `pi-codex-context/extensions/index.ts`, and upstream exposes no setting for it. On a 1M window it
   fires at roughly 900k used, so it is not a 250k ceiling: enforcing a lower ceiling needs a local
   patch or a reduced model window, not an alignment.
