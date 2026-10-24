/**
 * workflow-intent — deterministic, catalog-backed natural-language workflow adapter.
 *
 * Spec coverage: S4-S13, S17.
 *
 * Design:
 *  - S7:  `/workflow <name>` commands pass through unchanged; this adapter never
 *         intercepts them.
 *  - S4/S5/S8: On every `before_agent_start` user event, the adapter checks the
 *         prompt against known NL trigger patterns and then keyword-scores the
 *         registered workflow catalog.
 *  - S11/S12: Ordinary questions (no trigger signal) are ignored entirely.
 *  - S9:  Multiple equal-scoring matches produce a clarification note rather
 *         than a silent choice.
 *  - S10: The adapter never replaces or intercepts native `/workflow` dispatch;
 *         it only adds request-scoped system guidance when a match is found.
 *  - S13: Injected guidance names the matched workflow, its description,
 *         required input fields, and an explicit run command.
 *  - S6:  Matching is deterministic keyword-scoring — no LLM call, no ambiguity.
 *
 * Diagnostic command: `/workflow-intent diagnose` lists the current catalog and
 * keyword rules so the user can see exactly what the adapter knows.
 */

// ---------------------------------------------------------------------------
// NL trigger patterns (S4, S11)
// A message must match at least one before keyword scoring runs.
// This prevents ordinary questions from reaching the catalog.
// ---------------------------------------------------------------------------
const TRIGGER_PHRASES = [
  /\b(?:run|launch|start|execute|invoke|use)\b.{0,60}\bworkflow\b/i,
  /\bparallel\b.{0,60}\b(?:review|analysis|audit)\b/i,
  /\b(?:review|audit)\b.{0,60}\bparallel\b/i,
  // S5: "Use my architect, developer and reviewer roles to complete this issue."
  /\b(?:architect|developer|reviewer|security)\b.{0,80}\b(?:role|roles|workflow|agent)\b/i,
  /\bcanonical workflow\b/i,
  /\b(?:code review|security analysis)\b.{0,60}\b(?:and|with)\b/i,
  /\bfix\b.{0,60}\bissues?\b.{0,60}\bworkflow\b/i,
  /\btdd\b.{0,40}\bworkflow\b/i,
  /\btdd\b.{0,80}\b(?:implement|develop|task|tests?)\b/i,
  /\b(?:fetch|get|retrieve)\b.{0,60}\bissues?\b/i,
  /\b(?:develop|implement)\b.{0,60}\b(?:until|approved|reviewer)\b/i,
  // S5: "Review this repository, identify the critical problems and fix them."
  /\breview\b.{0,80}\b(?:repository|repo|codebase|code|project)\b.{0,80}\b(?:fix|problem|issue|critical)\b/i,
  // S5: "Use my architect, developer and reviewer roles to complete this issue."
  /\buse\b.{0,40}\b(?:architect|developer|reviewer|security)\b.{0,40}\b(?:role|roles|complete|issue)\b/i,
];

/**
 * Returns true when the user message contains at least one NL workflow trigger.
 * @param {string} text
 * @returns {boolean}
 */
export function hasTrigger(text) {
  return TRIGGER_PHRASES.some((re) => re.test(text));
}

// ---------------------------------------------------------------------------
// Keyword scoring rules (S6, S8)
// Each key is a catalog function name; each entry is a list of {words, weight}.
// Scoring is fully deterministic.
// ---------------------------------------------------------------------------
export const KEYWORD_RULES = {
  parallelReviewAndSecurity: [
    { words: ["parallel", "concurrent"], weight: 3 },
    { words: ["security", "audit", "vulnerability", "vulnerabilities", "secure"], weight: 3 },
    { words: ["code review", "review"], weight: 2 },
    { words: ["analysis", "analyze", "analyse"], weight: 1 },
    { words: ["architect", "developer", "reviewer"], weight: 1 },
  ],
  developUntilApproved: [
    { words: ["develop", "implement", "fix", "complete"], weight: 3 },
    { words: ["review loop", "loop", "iteration", "iterations", "until approved"], weight: 3 },
    { words: ["developer", "reviewer"], weight: 2 },
    { words: ["task"], weight: 1 },
  ],
  devIssuesInBatches: [
    { words: ["issues", "batch", "batches", "multiple issues", "several issues"], weight: 3 },
    { words: ["parallel", "concurrent"], weight: 2 },
    { words: ["develop", "fix"], weight: 1 },
    { words: ["architect", "developer"], weight: 1 },
  ],
  fetchIssueDetails: [
    { words: ["fetch", "get", "retrieve", "load"], weight: 3 },
    { words: ["issue details", "issue", "details", "content"], weight: 3 },
    { words: ["comments", "title"], weight: 1 },
  ],
  tddDev: [
    { words: ["tdd", "test-driven", "test driven", "red green", "red-green"], weight: 4 },
    { words: ["tests first", "tests", "test command"], weight: 2 },
    { words: ["develop", "implement"], weight: 1 },
  ],
};

/**
 * Score a single catalog function against the lower-cased user message.
 * @param {string} name
 * @param {string} lower - already lower-cased text
 * @returns {number}
 */
function scoreFunction(name, lower) {
  const rules = KEYWORD_RULES[name];
  if (!rules) return 0;
  let score = 0;
  for (const { words, weight } of rules) {
    if (words.some((w) => lower.includes(w.toLowerCase()))) score += weight;
  }
  return score;
}

/**
 * Rank catalog functions against the user message.
 * Returns entries with score > 0, sorted descending.
 *
 * @param {{ functions: Array<{name: string, description: string, input: object}> }} catalogIndex
 * @param {string} text
 * @returns {Array<{name: string, description: string, input: object, score: number}>}
 */
export function rankMatches(catalogIndex, text) {
  const lower = text.toLowerCase();
  const results = [];
  for (const fn of catalogIndex.functions) {
    const score = scoreFunction(fn.name, lower);
    if (score > 0) results.push({ name: fn.name, description: fn.description, input: fn.input, score });
  }
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Describe required input fields from a JSON Schema object.
 * @param {object} inputSchema
 * @returns {string}
 */
function describeInput(inputSchema) {
  const props = inputSchema?.properties ?? {};
  const required = new Set(inputSchema?.required ?? Object.keys(props));
  const lines = Object.entries(props).map(([key, schema]) => {
    const req = required.has(key) ? "required" : "optional";
    const desc = schema.description ? ` — ${schema.description}` : "";
    return `  - ${key} (${req})${desc}`;
  });
  return lines.join("\n");
}

/**
 * Build the system guidance block to inject on a match (S13).
 * @param {Array<{name: string, description: string, input: object, score: number}>} matches
 * @returns {string}
 */
export function buildGuidance(matches) {
  if (matches.length === 0) return "";

  const top = matches[0];
  const tied = matches.filter((m) => m.score === top.score);

  if (tied.length > 1) {
    // S9: equal-scoring matches — request clarification instead of silent choice
    const names = tied.map((m) => `/workflow ${m.name}`).join(", ");
    return [
      `<!-- workflow-intent: clarification needed (score ${top.score}) -->`,
      `Multiple workflows match your request with equal confidence: ${names}.`,
      `Clarify which one to run, e.g. \`/workflow ${tied[0].name} {...}\`.`,
      `Run \`/workflow-intent diagnose\` to see the full catalog.`,
    ].join("\n");
  }

  const firstKey = Object.keys(top.input?.properties ?? {})[0] ?? "input";
  const runExample = `/workflow ${top.name} {"${firstKey}": "..."}`;
  const fields = describeInput(top.input);

  return [
    `<!-- workflow-intent: matched ${top.name} (score ${top.score}) -->`,
    `**Workflow intent detected.** Your request matches the \`${top.name}\` workflow.`,
    ``,
    `**Description:** ${top.description}`,
    ``,
    `**Input fields:**`,
    fields || "  (none)",
    ``,
    `**To run it explicitly:** \`${runExample}\``,
    ``,
    `> Diagnostic: \`/workflow-intent diagnose\` — shows catalog and scoring rules.`,
    `> If you did not intend a workflow, normal Pi behavior continues unchanged.`,
  ].join("\n");
}

export const WORKFLOW_DISPATCH_MARKER = "<!-- workflow-intent: dispatch -->";

function requiredInputNames(inputSchema) {
  const properties = inputSchema?.properties ?? {};
  return Array.isArray(inputSchema?.required) ? inputSchema.required : Object.keys(properties);
}

function uniqueIssueNumbers(text) {
  return [...new Set([...text.matchAll(/#(\d+)/g)].map((match) => Number(match[1])))];
}

function extractReviewTarget(text) {
  const explicit = text.match(/\b(?:for|on|in|at|target(?:ed)?(?:\s+at)?)\s+(`[^`]+`|"[^"]+"|'[^']+'|[./~A-Za-z0-9_-]+(?:\/[A-Za-z0-9_./-]+)?)/i);
  if (explicit?.[1]) {
    const candidate = explicit[1].replace(/^[`"']|[`"']$/g, "").replace(/[.,!?;:]+$/, "");
    if (!/^(?:these?|the|a|an|current|repository|repo|codebase|project|workspace)$/i.test(candidate)) return candidate;
  }
  if (/\b(?:this|current)\s+(?:repository|repo|codebase|project|workspace)\b/i.test(text)) return ".";
  if (/\bparallel\s+code\s+review\b.{0,60}\bsecurity\s+analysis\b/i.test(text)) return ".";
  return null;
}

function extractTestCommand(text) {
  const match = text.match(/\b(?:test\s+command|run\s+tests?\s+with|tests?\s+via)\s*(?:is|=|:)\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)'|([^\n]+))/i);
  return match ? (match[1] ?? match[2] ?? match[3] ?? match[4]).trim().replace(/[.,!?;:]+$/, "") : null;
}

function extractMaxAttempts(text) {
  const match = text.match(/\b(?:max(?:imum)?\s+)?attempts?\s*(?:is|=|:)\s*(\d+)\b/i);
  return match ? Number(match[1]) : 5;
}

export function buildDispatchInput(match, prompt) {
  const input = {};
  switch (match.name) {
    case "parallelReviewAndSecurity": {
      const target = extractReviewTarget(prompt);
      if (!target) return null;
      input.target = target;
      if (match.input?.properties?.context) input.context = prompt;
      break;
    }
    case "developUntilApproved":
      input.task = prompt;
      break;
    case "fetchIssueDetails":
    case "devIssuesInBatches": {
      const issues = uniqueIssueNumbers(prompt);
      if (issues.length === 0) return null;
      input.issues = issues;
      break;
    }
    case "tddDev": {
      const testCmd = extractTestCommand(prompt);
      if (!testCmd) return null;
      input.task = prompt;
      input.testCmd = testCmd;
      input.maxAttempts = extractMaxAttempts(prompt);
      break;
    }
    default:
      return null;
  }
  return requiredInputNames(match.input).every((key) => input[key] !== undefined && input[key] !== "") ? input : null;
}

export function buildDispatchInstruction(name, input) {
  return [
    WORKFLOW_DISPATCH_MARKER,
    "Execute the native `workflow` tool exactly once.",
    `Workflow: ${name}`,
    `Input JSON: ${JSON.stringify(input)}`,
    "Do not reinterpret the workflow name or input. Return the workflow result.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Pi extension entry point
// ---------------------------------------------------------------------------

/**
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi
 * @param {{ catalogIndex?: () => object }} [options] - injection point for tests
 */
export default function workflowIntent(pi, options = {}) {
  // Tracks whether pi-extensible-workflows resolved on session_start.
  // undefined = not yet attempted; false = unavailable; function = resolved.
  let _catalogFn = undefined;

  /** @returns {{ functions: Array<{name:string, description:string, input:object}>, unavailable?: boolean }} */
  function getCatalog() {
    if (options.catalogIndex) return options.catalogIndex();
    if (typeof _catalogFn === "function") return _catalogFn();
    // Unavailable: return an explicit marker so callers can surface a diagnostic.
    return { functions: [], unavailable: _catalogFn === false };
  }

  // Prime the catalog reference asynchronously so it is ready before the
  // first agent turn (session_start fires before any user message).
  pi.on("session_start", async () => {
    try {
      const mod = await import("pi-extensible-workflows");
      if (typeof mod.workflowCatalogIndex === "function") {
        _catalogFn = mod.workflowCatalogIndex;
      } else {
        // Package loaded but did not export the expected function.
        _catalogFn = false;
      }
    } catch {
      // pi-extensible-workflows is not installed or failed to load.
      _catalogFn = false;
    }
  });

  // S13: diagnostic command
  pi.registerCommand("workflow-intent", {
    description: "Show the workflow catalog and NL scoring rules (sub-command: diagnose)",
    handler: (_args, ctx) => {
      const catalog = getCatalog();
      const lines = [
        "## workflow-intent: catalog and scoring rules",
        "",
        "### Registered workflow functions",
        ...(catalog.functions.length
          ? catalog.functions.map((fn) => `- **${fn.name}**: ${fn.description}`)
          : ["  (none registered)"]),
        "",
        "### Keyword scoring rules",
        ...Object.entries(KEYWORD_RULES).flatMap(([name, rules]) => [
          `**${name}**:`,
          ...rules.map((r) => `  - [+${r.weight}] ${r.words.join(", ")}`),
        ]),
        "",
        "### NL trigger patterns",
        ...TRIGGER_PHRASES.map((re) => `- ${re.toString()}`),
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // S4, S7, S8, S10, S11, S12, S13: input and before-agent hooks
  pi.on("input", (event) => {
    const prompt = event.text ?? "";
    if (event.source !== "interactive" && event.source !== "rpc") return { action: "continue" };
    if (/^\s*\/workflow\b/.test(prompt) || prompt.includes(WORKFLOW_DISPATCH_MARKER)) return { action: "continue" };
    if (!hasTrigger(prompt)) return { action: "continue" };

    const catalog = getCatalog();
    if (catalog.unavailable) return { action: "continue" };
    const matches = rankMatches(catalog, prompt);
    if (matches.length === 0 || (matches[1] && matches[1].score === matches[0].score)) return { action: "continue" };
    const input = buildDispatchInput(matches[0], prompt);
    return input ? { action: "transform", text: buildDispatchInstruction(matches[0].name, input) } : { action: "continue" };
  });

  pi.on("before_agent_start", (event) => {
    // S7: explicit /workflow commands and already transformed dispatches are native-owned
    if (event.messageType !== "user") return;
    const prompt = event.prompt ?? "";
    if (/^\s*\/workflow\b/.test(prompt) || prompt.includes(WORKFLOW_DISPATCH_MARKER)) return;

    // S11: no trigger signal — ordinary question, leave Pi alone
    if (!hasTrigger(prompt)) return;

    const catalog = getCatalog();

    // Fail-closed: surface a user-visible diagnostic when the package is unavailable.
    if (catalog.unavailable) {
      const notice = [
        "<!-- workflow-intent: catalog unavailable -->",
        "**workflow-intent:** The `pi-extensible-workflows` package could not be loaded.",
        "Workflow matching is disabled. Install the package and restart Pi to enable it.",
        "> Run `/workflow-intent diagnose` for details.",
      ].join("\n");
      const existing = event.systemPrompt ?? "";
      return { systemPrompt: existing ? `${existing}\n\n${notice}` : notice };
    }

    const matches = rankMatches(catalog, prompt);
    if (matches.length === 0) return;

    const guidance = buildGuidance(matches);
    if (!guidance) return;

    // S10, S13: append guidance to system prompt for this turn only
    const existing = event.systemPrompt ?? "";
    return { systemPrompt: existing ? `${existing}\n\n${guidance}` : guidance };
  });
}
