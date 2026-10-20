# Change & refactor log

> Notable changes and refactors, newest first. This is memory, not a release
> changelog: capture *why* and *what to know next time*, not every commit.
> `aimem save "<title>" "<body>"` appends here.

<!-- ## YYYY-MM-DD — <title>
     What changed, why, and any gotcha a future contributor must know. -->

## 2026-10-19 — Commit 8729043bc96cfcd74c807c646dab5af50384f7b6: fix(pi): align model policy and GGA routing

Commit: 8729043bc96cfcd74c807c646dab5af50384f7b6
Subject: fix(pi): align model policy and GGA routing
Parent: c00547f0ceb74e99f0f260ef98444823ce10bdea
Task/spec: pi orchestration model-fit and Guardian Angel Pi routing alignment
Changed paths: .gga; README.md; REVIEW_RULES.md; agents/gga-pi.test.mjs; agents/gga-pi/bin/kilo; check-config.sh; docs/gentle-ai-gga.md; docs/pi-configuration.md; odd/tasks/pi-orchestration-model-fit-skillopt.md; pi/agent/MODELS.md; pi/agent/README.md; pi/agent/extensions/answer.ts; pi/agent/modes.json; pi/agent/pi-ext-roles/settings.json; pi/agent/settings.json; pi/agent/subagents.json; reports/2026-10-19-skillopt-model-policy.md
Verification: git diff --cached --check; node --experimental-strip-types --check pi/agent/extensions/answer.ts; node --test agents/gga-pi.test.mjs (10 passed); bash check-config.sh; GGA pre-commit review passed.
Scope: CLIProxyAPI-first role/model routing, GGA Pi bridge failover, explicit unavailable-model handling, policy/docs/tests.
Review: GGA v2.10.1 passed after correcting native catalog documentation and removing the silent answer-extension fallback.
Blockers: none for this commit; upstream Guardian Angel issue #131 remains separately unapproved.

## 2026-10-19 — Commit 7513b2dfd059b95a7058371527465fa8345a234d: feat(pi): bind workflow roles to HA groups

Commit: 7513b2dfd059b95a7058371527465fa8345a234d
Subject: feat(pi): bind workflow roles to HA groups
Parent: 8729043bc96cfcd74c807c646dab5af50384f7b6
Task/spec: pi-role-matrix-reconciliation.md, T2-T4; guardian-angel-pworkflow-integration.md tracking
Changed paths: role HA map, six role HA extensions, lifecycle binder and tests, 12 Pi workflow role bindings, ODD task documents, Herdr visual audit.
Verification: git diff --cached --check; node --experimental-strip-types --test pi/agent/extensions/pi-ha-role-groups/bind.test.mjs (4 passed); node --experimental-strip-types --check pi/agent/extensions/pi-ha-role-groups/bind.ts; bash -n check-config.sh; bash check-config.sh; role alias/group/extension assertions; GGA pre-commit review passed.
Scope: explicit hybrid role-to-HA mapping, CLIProxyAPI-first role aliases, oracle/reviewer alignment, ordered lifecycle-safe PI_HA_GROUP binding, and accurate model audit documentation.
Review: GGA v2.10.1 passed after correcting stale documentation, explicit cheap-role aliases, oracle alias parity, and out-of-order binding restoration.
Blockers: dotenv issues #25/#29 still require owner compactor choice; Guardian Angel issue #131 remains unapproved and no upstream Pi commit is present.

## 2026-10-19 — Commit 8599a3bd7dd4fc5fc7ae66c4c60c82052d0c6937: docs(memory): add commit-indexed memory directives

Commit: 8599a3bd7dd4fc5fc7ae66c4c60c82052d0c6937
Subject: docs(memory): add commit-indexed memory directives
Parent: 7513b2dfd059b95a7058371527465fa8345a234d
Task/spec: commit-indexed memory directive
Changed paths: .ai/ repository memory source, .engram/chunks synchronized cache, root and Pi AGENTS directives, CLAUDE.md, GEMINI.md, and ephemeral-state gitignore entries.
Verification: git diff --cached --check; aimem status (26 local chunks, no pending import); final check-config.sh; HA binder tests (4 passed); GGA bridge tests (10 passed); safe source/live role parity; GGA pre-commit review passed.
Scope: durable repository memory bootstrap and a testable post-commit full-hash indexing protocol with secret redaction and delivery-gate separation.
Review: GGA pre-commit review passed.
Blockers: issue #25/#29 compactor choice and Guardian Angel #131 approval remain external decisions; no push, PR, merge, or issue closure performed.
