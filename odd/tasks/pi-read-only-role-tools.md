# Read-only Pi workflow role tool policies
Issue: darkrei08/dotenv#62. Scope: tighten the three read-only role allowlists without changing write-capable role requirements or the separate MCP discovery issue.

## Specs

- S1: "Give Scout, Researcher, and Reviewer explicit allowlists containing only verified read-only capabilities; exclude shell, edit, and write tools."
- S2: "Preserve explicit allowlists for Developer and Tests Expert, including only their necessary write capabilities."
- S3: "Preserve intended MCP discovery behavior and coordinate with, but do not duplicate, issue #61."
- S4: "Keep role model references alias-based; do not add provider-specific model IDs."
- S5: "A regression test proves Scout, Researcher, and Reviewer cannot receive shell, edit, or write tools and that Developer and Tests Expert retain explicit positive allowlists with their required write tools."
- S6: "The change preserves the intended MCP discovery path and does not regress the behavior tracked by #61."
- S7: "No provider-specific model IDs are added to role frontmatter."
- S8: Run `python -m json.tool pi/agent/pi-ext-roles/settings.json`, `bash ./check-config.sh`, `bash ./tests/role-tool-policy.sh`, and `git diff --check`.
- S9: "Workflow-engine concurrency validation and context metadata behavior are outside this issue."

## Tasks

- T1 [S1,S5,S6] Add a regression test for role tool permissions and observe RED before changing role files. Route: test-first; status: done (RED observed); commit: pending.
- T2 [S1-S4,S6-S7] Make Scout, Researcher, and Reviewer explicitly read-only while preserving Developer/Tests Expert write allowlists and MCP discovery. Route: role configuration; status: done (role-specific allowlists and MCP settings asserted by the passing focused test); commit: pending.
- T3 [S5-S8] Run focused tests, repository checks, and an independent security review of the exact candidate. Route: verification; status: done; commit: pending; evidence: independent security PASS for candidate sha256:68c07cd825289fa59f324353fb8b889e360ae54ead8ff8cf0b233aee5221bf11; JSON validation, check-config.sh, role-tool-policy.sh, and git diff --check passed.
- T4 [S1-S9] Create a reviewable issue-linked commit and PR, then merge only after required gates pass. Route: delivery; status: pending; commit: pending.

## Log

- L1: "esegui analsii aprofonditata da un veronteam di sviluppo suddividao in ruoli e che oeneetta di controlalre la corretta esecuzione di setup-ai e di migliroare il menu interazione ecetra esegui do anche citnrollo contro i limiti di donwload di github. Analizzando issue corruzioni e poi eseguendo commit merge push e release nuove"
- L2: "Procedi coi task"
- L3: The user selected "Estendi a dotenv" and directed that implementation wait for a dedicated issue to be approved.
- L4: The user explicitly approved issue #62; its `status:approved` label was applied and confirmed before implementation.
- L5: The user authorized local operations only in `/root/.herdr/worktrees/dotenv/worktree-issue-62`.
- L6: Issue #62 is distinct from open issue #61, which tracks tool_search warnings and stale selector names; no source files changed before approval.
- L7: The new `bash tests/role-tool-policy.sh` first failed against the original selectors for Scout, Researcher, and Reviewer, then passed after the three role frontmatters were updated. The test confirms `!*` role-specific allowlists, excludes `bash`/`edit`/`write` from read-only roles, preserves Developer/Tests Expert write tools, model aliases, and global MCP discovery selectors.
- L8: A fresh independent security review using `openai-codex/gpt-6-luna:high` passed the exact candidate `sha256:68c07cd825289fa59f324353fb8b889e360ae54ead8ff8cf0b233aee5221bf11` with no findings. Final checks passed: `python -m json.tool pi/agent/pi-ext-roles/settings.json`, `bash ./check-config.sh`, `bash ./tests/role-tool-policy.sh`, and `git diff --check`. No files were modified by the reviewer; Pi runtime/MCP activation was not started.
