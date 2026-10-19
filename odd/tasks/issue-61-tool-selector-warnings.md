# Issue 61: Pi workflow tool-selector warnings

Implementation record for the approved local work unit. Remote push, merge, and issue closure are intentionally deferred.

## Specs

1. **S1** — "Add `defaultTools: [\"+tool_search\"]` to the canonical Pi settings. The additive selector preserves the existing built-in defaults while making the intended search tool available to workflow children."
2. **S2** — "Keep the role-level `tool_search` allowance and built-in extensions. Remove only `!replace`, `!insert`, and `!undo_last_change` from the researcher role; preserve its existing `!edit`, `!write`, and `!bash` restrictions."
3. **S3** — "Add regression checks to `check-config.sh`."
4. **S4** — "The canonical settings add `tool_search` without replacing the default `read`, `bash`, `edit`, and `write` tools."
5. **S5** — "The researcher role still excludes `edit`, `write`, and `bash`, and no longer references the three absent tools."
6. **S6** — "`bash check-config.sh` and `git diff --check` pass."
7. **S7** — "A fresh PiWorkflow researcher-role smoke emits none of the listed selector warnings, and `tool_search` can still discover configured MCP tools."

## Tasks

- T1 (S1-S7): Update canonical Pi tool activation, researcher selectors, and configuration regression checks; commit locally.

## Log

- L1: "prima soluzione"
- L2: Issue #61 is approved for implementation; open PR inventory is empty. Work is local-only until the user separately authorizes push, merge, and issue closure.
- L3: Implemented S1-S6: Added canonical defaultTools: ["+tool_search"], removed absent exclusions (!replace, !insert, !undo_last_change) from researcher role, and added regression checks in check-config.sh. Regression checks verified (RED -> GREEN). check-config.sh, git diff --check, and tests pass. Ready for parent review.
- L4: Fresh Pi smoke with `cliproxyapi/gemini-3.8-flash-high:medium` returned `mcp__context7__query_docs` through `tool_search` with exit code 0 and no selector-warning lines. The OpenCode Go Cat Jam variant was not used because its API key is expired; this is an environment limitation, not a code failure.
