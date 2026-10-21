Feature: Clean SkillOpt-only delivery for dotenv PR #64
Issue: #54 (historical approved SkillOpt tracking issue)
Branch: fix/pr64-skillopt-clean

## Specs

S1. "prosegui con la risoluzione delle pr aperte"

S2. "ripubblica i commit prima localmente e dopo pusha tutto e anceh le realse e correggi npm"

S3. "Ripulire PR #64"

## Tasks

- T1 | S1-S3 | Isolate only the SkillOpt setup and documentation changes from PR #64 onto a clean origin/main branch | commit: pending
- T2 | S1-S3 | Verify the isolated delivery with repository checks and preserve the opt-in/privacy boundary | commit: pending
- T3 | S1-S2 | Publish the verified branch and PR delivery through the repository's ordinary GitHub flow; do not publish unrelated HA/config work | commit: pending

## Log

L1. User request: prosegui con la risoluzione delle pr aperte e ripubblica i commit prima localmente e dopo pusha tutto e anceh le realse e correggi npm
L2. User decision: Ripulire PR #64. Create a clean SkillOpt-only delivery; do not push the dirty mixed-scope worktree.
L3. Evidence: setup-ai v4.0.3 is already visible on npm and its GitHub Actions publication workflow succeeded; no additional npm publication is required for that release.
L4. T1-T2 implementation completed on the isolated branch. Parent verification passed: `bash -n setup_env.sh`, `git diff --check`, and `bash tests/role-tool-policy.sh`. The changed source surfaces are exactly `setup_env.sh`, `README.md`, and `docs/setup-reference.md`; no HA/config/runtime credentials were touched.
