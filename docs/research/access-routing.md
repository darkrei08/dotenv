# Research access routing

Which source to use for which target, so an authenticated page is never read as if it were public and a public page never pays the cost of a browser session.

## Decision table

| Target | Use | Never |
| --- | --- | --- |
| GitHub repository, issue, PR, release, commit, file content | `gh` (`gh api`, `gh repo view`, `gh pr list`) | Firecrawl, anonymous `curl` |
| Page behind a login (dashboard, admin panel, private app, forum, webmail) | BrowserOS neo (`browseros-neo` MCP, deferred tools) | Firecrawl |
| Public page, docs site, blog, changelog, spec | `firecrawl-local` scrape or crawl | neo, unless JS rendering or a session is required |
| Discovery ("which packages exist", "who wrote about X") | `exa` or `web_search` | scraping a search page |
| Large structured extraction from a known public site | `firecrawl-local` extract or map | manual page-by-page reading |

## Why Firecrawl is anonymous and neo is not

- Firecrawl runs inside `data-research-stack-firecrawl-api-1`. It is an HTTP crawler in a container: no browser profile, no cookies, no session store. Every request is anonymous.
- BrowserOS neo runs a Chromium with a persistent profile, so the logins are already there. Its MCP endpoint is `http://127.0.0.1:9010/mcp`.
- GitHub answers `404` to an anonymous request for a private repository. That is indistinguishable from a repository that does not exist, and it is the reason an anonymous scrape is never evidence about a repository's existence or state. Verify repository facts with `gh`, which is authenticated.

Consequence: a `404` page fetched without a session proves nothing. Use `gh api repos/<owner>/<name>` and read the HTTP status it returns.

## neo usage rules

1. `tabs` first, to get the group id, then open pages inside that group.
2. Read with `snapshot` or `read`. Use `evaluateInPage` only when the answer needs programmatic page access, and say why.
3. The neo profile carries the operator's sessions. Do not sign out, change credentials, or open pages outside the task.
4. A restarted neo container keeps the profile on disk; the browser session is lost until the page is reopened. Expect that after an image update.

## Firecrawl usage rules

- Preferred for bounded reads of public documentation and for crawl or map batches.
- Do not use it to judge whether a private resource exists, is archived, or was deleted.
- Passing cookies or headers by hand to reach an authenticated page is fragile and out of policy: use neo instead.

## Verified limits worth remembering

- YouTube captions are not reliably reachable without a PO token: for `video 3lHC5cWKl2E` the only track was `it:asr`, and the timedtext endpoint answered `200` with an empty body. `yt-dlp` returned `429` on subtitles even with `--js-runtimes node --remote-components ejs:github`.
- No local ASR engine or model is installed: no `whisper`, `whisper.cpp`, `faster-whisper`, `vosk`, and no `ggml` or `safetensors` weights.
- The working path for a specific video segment is a bounded audio download followed by an external transcription step:

```sh
uvx yt-dlp --js-runtimes node --remote-components ejs:github \
  -f bestaudio/best --download-sections "*48:40-54:20" \
  -o "/tmp/yt/seg.%(ext)s" "https://www.youtube.com/watch?v=3lHC5cWKl2E"
ffmpeg -v error -y -i /tmp/yt/seg.webm -ac 1 -ar 16000 -f f32le /tmp/yt/seg16k.f32
uvx --with faster-whisper --with 'av<16' python3 /tmp/yt/asr.py
```

Three details cost an attempt each and are worth keeping:

- `faster-whisper` transcribe fails on a file path with `TypeError: open() got an unexpected keyword argument 'metadata_errors'`; pin `av<16`, and prefer decoding with `ffmpeg` to raw `f32le` and passing a NumPy array.
- `yt-dlp` needs a JS runtime for the n-challenge; without `--js-runtimes node` the download errors out.
- Media distillation in `media-distillation-toolkit` still has no ASR lane: `micio-distill` exposes `validate`, `render`, `enqueue`, `subtitles`, `reconcile` only. Its subtitle lane needs captions that actually download.

## Related

- `docs/pi-configuration.md` for package and settings ownership.
- `agents/skills.manifest.json` for which harness receives which skill.
