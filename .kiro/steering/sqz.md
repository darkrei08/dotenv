---
inclusion: always
---
<!-- sqz-kiro-steering (auto-installed by sqz init) -->

# sqz — Token-Optimized Output

When running shell commands whose output may be long (git log/diff, test
runners, build logs, `ls -la`, `docker ps`), pipe the output through
`sqz compress` to cut token consumption:

```bash
git status 2>&1 | /usr/local/bin/sqz compress
cargo test 2>&1 | /usr/local/bin/sqz compress
```

Do NOT pipe interactive commands (REPLs, `ssh`), compound commands with
shell operators (`&&`, `>`, `;`), or output that is already short.

The `sqz` MCP server is configured in `.kiro/settings/mcp.json`. Prefer
its tools when they fit:

- `sqz_read_file` / `sqz_grep` / `sqz_list_dir` — file access with
  caching; repeat reads of unchanged content cost ~13 tokens.
- `compress` — compress a blob of text you already have.
- `passthrough` — return text unchanged (escape hatch).
- `expand` — resolve a `§ref:HASH§` token back to the original bytes.
  `§ref:HASH:L40-80§` means lines 40-80 of content you already have in
  full; `expand` on it returns just those lines.
- `sqz_recall` — full-text search over everything sqz has compressed
  (recover context lost to compaction).

If you see a `§ref:HASH§` token you can't parse, run
`/usr/local/bin/sqz expand <prefix>` or set `SQZ_NO_DEDUP=1` on the command.
If a `«A1»` symbol replaced a value you need verbatim, re-run with
`SQZ_NO_ABBREV=1` (or `--no-abbrev`).
