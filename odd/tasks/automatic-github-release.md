# Automatic GitHub releases

## Goal
Publish a patch GitHub Release automatically for every push to `main`, without requiring an interactive push/release confirmation for each change.

## Decision
Use a GitHub Actions workflow triggered by pushes to `main`. It creates the next `vMAJOR.MINOR.PATCH` tag, pushes it, and publishes generated release notes. The workflow is idempotent when rerun for a commit that already has a tag.

## Scope
- Add `.github/workflows/auto-release.yml`.
- Do not change application or Pi runtime configuration.
- Keep the workflow limited to repository contents and release metadata.

## Acceptance checks
- Workflow runs only on `main` pushes.
- Workflow has `contents: write` permission and uses `GITHUB_TOKEN` through `gh`.
- Patch version increments from the latest stable `v*` tag.
- Existing tags/releases are not duplicated on rerun.

## Startup test follow-up
- Real Pi RPC startup failed because `npm:@juicesharp/rpiv-ask-user-question` and `gentle-pi/extensions/ask-user-question.ts` both register `ask_user_question`.
- Remove the redundant package from the tracked package manifest and Pi settings; keep the package-owned Gentle AI tool.
- Retest startup before publishing the workflow change.
