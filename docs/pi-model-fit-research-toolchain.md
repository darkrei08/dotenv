# Pi Model Fit research toolchain

This document defines the setup boundary for future model-fit catalog and community research. It does not install tools, copy credentials, or authorize logged-in browser automation.

## Hierarchical router

```text
PI MASTER
  -> WEB ROUTER
     -> HTTP: curl / Node fetch
        -> CRAWLER: Crawl4AI or Firecrawl
           -> BROWSER: Lightpanda or authorized BrowserOS
              -> Chromium + Playwright/Puppeteer fallback
```

Escalate only when the previous layer cannot provide reliable evidence:

1. HTTP for APIs, RSS, JSON, static HTML and known URLs.
2. Crawl4AI for self-hosted Markdown, structured extraction, PDFs and deep crawling.
3. Firecrawl for search, map, crawl, batch, parse, MCP and difficult web extraction; hosted or self-hosted.
4. Lightpanda for lightweight JavaScript/CDP rendering.
5. BrowserOS for explicitly authorized logged-in, interactive sessions with visible/replayable side effects.
6. Chromium plus Playwright/Puppeteer when compatibility, screenshots or complex interaction require a full browser.

## Research pipeline

`discover -> extract -> normalize -> deduplicate -> verify -> skeptic -> score -> report`

The verifier/skeptic pair follows the existing Judgment-Day dual-review idea. It must record URL, source type, author/date, exact claim, model/effort, task setup, plan/billing boundary, limitations and confidence. Community and video sources are leads, not entitlement, quota, quality or route-health proof.

Model families are ranked by task-matched benchmark results, capability, effort support, context/output, measured speed/usage, cost boundary and community evidence. Version number alone never determines ranking.

## Tool placement

| Tool | Placement | Default role | Install state |
|---|---|---|---|
| `curl` / Node fetch / `jq` | host | HTTP evidence collection | present on current host |
| Crawl4AI | Python environment or Docker service | crawler/extractor | not installed/verified |
| Firecrawl | Docker Compose service or hosted endpoint | search/crawl/extract/MCP | not installed/verified |
| Lightpanda | host binary or Docker service on CDP | lightweight browser | not installed/verified |
| BrowserOS | host desktop application | logged-in interactive browser | not installed/verified |
| Chromium + Playwright/Puppeteer | host/CI | compatibility fallback | Chromium present; client stack not verified |

Do not add these binaries or secrets to `pi/agent/pi-packages.txt`. A future setup work unit should add a declarative, idempotent tool manifest and platform-specific checks, then install only the approved subset.

## Sources

- https://github.com/unclecode/crawl4ai
- https://github.com/lightpanda-io/browser
- https://github.com/lightpanda-io/awesome-lightpanda
- https://github.com/browseros-ai/BrowserOS
- https://github.com/firecrawl/firecrawl
- https://github.com/firecrawl/firecrawl-mcp-server
