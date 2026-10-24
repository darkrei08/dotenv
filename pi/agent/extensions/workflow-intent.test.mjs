import assert from "node:assert/strict";
import test from "node:test";
import {
  hasTrigger,
  KEYWORD_RULES,
  rankMatches,
  buildGuidance,
  buildDispatchInput,
  buildDispatchInstruction,
  WORKFLOW_DISPATCH_MARKER,
  default as workflowIntent,
} from "./workflow-intent.mjs";

// ---------------------------------------------------------------------------
// hasTrigger
// ---------------------------------------------------------------------------

test("hasTrigger: detects explicit workflow request", () => {
  // S5 examples verbatim
  assert.equal(hasTrigger("Review this repository, identify the critical problems and fix them."), true);
  assert.equal(hasTrigger("Launch parallel code review and security analysis."), true);
  assert.equal(hasTrigger("Use my architect, developer and reviewer roles to complete this issue."), true);
  assert.equal(hasTrigger("Run the canonical workflow for this task."), true);
  // Additional patterns
  assert.equal(hasTrigger("Start the tdd workflow for this feature."), true);
});

test("hasTrigger: ignores ordinary questions (S11)", () => {
  assert.equal(hasTrigger("What is the capital of France?"), false);
  assert.equal(hasTrigger("Can you help me write a function?"), false);
  assert.equal(hasTrigger("Explain how TypeScript generics work."), false);
  assert.equal(hasTrigger("How do I fix this bug?"), false);
  assert.equal(hasTrigger("Show me the file structure."), false);
});

// ---------------------------------------------------------------------------
// rankMatches
// ---------------------------------------------------------------------------

const catalogIndex = {
  functions: [
    {
      name: "parallelReviewAndSecurity",
      description: "Run parallel code review and security analysis",
      input: {
        type: "object",
        properties: {
          target: { description: "Path or scope" },
          context: { description: "Additional context" },
        },
        required: ["target"],
      },
    },
    {
      name: "developUntilApproved",
      description: "Develop a task until review passes",
      input: {
        type: "object",
        properties: {
          task: { description: "The task to implement" },
        },
        required: ["task"],
      },
    },
    {
      name: "tddDev",
      description: "Develop using TDD",
      input: {
        type: "object",
        properties: {
          task: { description: "Task description" },
          testCmd: { description: "Command to run tests" },
          maxAttempts: { description: "Max attempts" },
        },
        required: ["task", "testCmd", "maxAttempts"],
      },
    },
    {
      name: "fetchIssueDetails",
      description: "Fetch issue titles, content, and comments",
      input: {
        type: "object",
        properties: {
          issues: { description: "Issue numbers" },
        },
        required: ["issues"],
      },
    },
    {
      name: "devIssuesInBatches",
      description: "Develop issues in parallel batches",
      input: {
        type: "object",
        properties: {
          issues: { description: "Issue numbers" },
        },
        required: ["issues"],
      },
    },
  ],
};

test("rankMatches: parallel review and security request routes to parallelReviewAndSecurity (S8)", () => {
  const results = rankMatches(catalogIndex, "Launch parallel code review and security analysis.");
  assert.ok(results.length > 0, "should produce at least one match");
  assert.equal(results[0].name, "parallelReviewAndSecurity");
  assert.ok(results[0].score > 0);
});

test("rankMatches: TDD request routes to tddDev (S8)", () => {
  const results = rankMatches(catalogIndex, "Start the tdd workflow for this task.");
  assert.ok(results.length > 0);
  assert.equal(results[0].name, "tddDev");
});

test("rankMatches: develop until approved routes to developUntilApproved (S8)", () => {
  const results = rankMatches(catalogIndex, "Develop and implement this task until the reviewer approves it.");
  assert.ok(results.length > 0);
  assert.equal(results[0].name, "developUntilApproved");
});

test("rankMatches: returns empty array for unrecognized intent (S11)", () => {
  const results = rankMatches(catalogIndex, "What is the capital of France?");
  assert.deepEqual(results, []);
});

test("rankMatches: results are sorted by score descending (S9)", () => {
  const results = rankMatches(
    catalogIndex,
    "Launch parallel code review and security analysis for these issues in batches.",
  );
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score, "results must be sorted descending");
  }
});

test("rankMatches: empty catalog returns empty array", () => {
  assert.deepEqual(rankMatches({ functions: [] }, "launch parallel workflow"), []);
});

// ---------------------------------------------------------------------------
// buildGuidance
// ---------------------------------------------------------------------------

test("buildGuidance: returns empty string for no matches (S11)", () => {
  assert.equal(buildGuidance([]), "");
});

test("buildGuidance: single match includes workflow name, description, input, and run command (S13)", () => {
  const matches = [
    {
      name: "parallelReviewAndSecurity",
      description: "Run parallel code review and security analysis",
      input: {
        type: "object",
        properties: {
          target: { description: "Path or scope" },
          context: { description: "Additional context" },
        },
        required: ["target"],
      },
      score: 6,
    },
  ];
  const guidance = buildGuidance(matches);
  assert.ok(guidance.includes("parallelReviewAndSecurity"), "must name the matched workflow");
  assert.ok(guidance.includes("Run parallel code review and security analysis"), "must include description");
  assert.ok(guidance.includes("target"), "must include required input field");
  assert.ok(guidance.includes("/workflow parallelReviewAndSecurity"), "must include explicit run command (S13)");
  assert.ok(guidance.includes("context"), "must include optional input field");
  assert.ok(guidance.includes("required"), "must label required fields");
  assert.ok(guidance.includes("optional"), "must label optional fields");
  assert.ok(guidance.includes("diagnose"), "must include diagnostic hint (S13)");
});

test("buildGuidance: single match includes score in comment (S13)", () => {
  const matches = [{ name: "tddDev", description: "TDD dev", input: { properties: { task: {} }, required: ["task"] }, score: 5 }];
  const guidance = buildGuidance(matches);
  assert.ok(guidance.includes("score 5"), "must embed score for diagnostics");
});

test("buildGuidance: tied matches produce clarification note, not silent choice (S9)", () => {
  const matches = [
    { name: "parallelReviewAndSecurity", description: "Parallel review", input: { properties: { target: {} } }, score: 4 },
    { name: "developUntilApproved", description: "Dev loop", input: { properties: { task: {} } }, score: 4 },
  ];
  const guidance = buildGuidance(matches);
  assert.ok(guidance.includes("parallelReviewAndSecurity"), "must list first tied workflow");
  assert.ok(guidance.includes("developUntilApproved"), "must list second tied workflow");
  assert.ok(
    guidance.toLowerCase().includes("multiple") || guidance.toLowerCase().includes("clarif"),
    "must signal ambiguity",
  );
  // Must not silently pick one
  assert.ok(!guidance.includes("Workflow intent detected"), "must not silently route a tied result");
});

// ---------------------------------------------------------------------------
// workflowIntent extension (Pi integration) (S7, S10, S12)
// ---------------------------------------------------------------------------

function fakePi() {
  const handlers = new Map();
  const commands = new Map();
  return {
    handlers,
    commands,
    registerCommand(name, options) {
      commands.set(name, options);
    },
    on(name, handler) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(handler);
    },
    async fire(name, event, ctx = { ui: { notify() {} } }) {
      const hs = handlers.get(name) ?? [];
      let result;
      for (const h of hs) result = await h(event, ctx);
      return result;
    },
  };
}

test("workflowIntent registers workflow-intent command and input/before_agent_start handlers", () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  assert.ok(pi.commands.has("workflow-intent"), "must register the diagnostic command");
  assert.ok(pi.handlers.has("input"), "must register the input handler");
  assert.ok(pi.handlers.has("before_agent_start"), "must register before_agent_start handler");
});

test("buildDispatchInput: derives the current repository target safely", () => {
  const match = catalogIndex.functions[0];
  assert.deepEqual(
    buildDispatchInput(match, "Launch parallel code review and security analysis."),
    { target: ".", context: "Launch parallel code review and security analysis." },
  );
  assert.deepEqual(
    buildDispatchInput(match, "Launch parallel code review and security analysis for ./src."),
    { target: "./src", context: "Launch parallel code review and security analysis for ./src." },
  );
  assert.equal(buildDispatchInput(match, "Run a security review for the deployment plan."), null);
});

test("buildDispatchInput: requires parseable issue numbers", () => {
  const match = catalogIndex.functions.find((fn) => fn.name === "fetchIssueDetails");
  assert.deepEqual(buildDispatchInput(match, "Fetch issue #12 and #13 details."), { issues: [12, 13] });
  assert.equal(buildDispatchInput(match, "Fetch the latest issue details."), null);
});

test("buildDispatchInstruction: emits a deterministic native workflow-tool request", () => {
  const instruction = buildDispatchInstruction("parallelReviewAndSecurity", { target: "." });
  assert.ok(instruction.startsWith(WORKFLOW_DISPATCH_MARKER));
  assert.ok(instruction.includes("Workflow: parallelReviewAndSecurity"));
  assert.ok(instruction.includes('Input JSON: {"target":"."}'));
  assert.ok(!instruction.includes("/workflow parallelReviewAndSecurity"), "must not invent slash-command arguments");
});

test("workflowIntent: triggered NL request transforms before agent processing", async () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const result = await pi.fire("input", {
    source: "rpc",
    text: "Launch parallel code review and security analysis for ./src.",
  });
  assert.equal(result.action, "transform");
  assert.ok(result.text.includes(WORKFLOW_DISPATCH_MARKER));
  assert.ok(result.text.includes('Input JSON: {"target":"./src","context":"Launch parallel code review and security analysis for ./src."}'));
});

test("workflowIntent: explicit commands, ordinary questions, ambiguity, and missing fields are not transformed", async () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const explicit = await pi.fire("input", { source: "interactive", text: "/workflow parallelReviewAndSecurity {\"target\":\"./src\"}" });
  const ordinary = await pi.fire("input", { source: "interactive", text: "What is the capital of France?" });
  const missing = await pi.fire("input", { source: "interactive", text: "Fetch the latest issue details." });
  assert.deepEqual(explicit, { action: "continue" });
  assert.deepEqual(ordinary, { action: "continue" });
  assert.deepEqual(missing, { action: "continue" });

  const tiedCatalog = { functions: [catalogIndex.functions[0], { ...catalogIndex.functions[0] }] };
  const tiedPi = fakePi();
  workflowIntent(tiedPi, { catalogIndex: () => tiedCatalog });
  const tied = await tiedPi.fire("input", { source: "rpc", text: "Launch parallel code review and security analysis." });
  assert.deepEqual(tied, { action: "continue" });
});

test("workflowIntent: explicit /workflow command is never intercepted (S7)", async () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "/workflow parallelReviewAndSecurity {\"target\": \"./src\"}",
    systemPrompt: "",
  });
  assert.equal(result, undefined, "must not return guidance for explicit /workflow command");
});

test("workflowIntent: ordinary question produces no guidance (S11, S12)", async () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "What is the capital of France?",
    systemPrompt: "",
  });
  assert.equal(result, undefined, "must produce no guidance for ordinary questions");
});

test("workflowIntent: NL parallel review request injects guidance (S4, S8, S13)", async () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "Launch parallel code review and security analysis.",
    systemPrompt: "",
  });
  assert.ok(result?.systemPrompt, "must inject system prompt guidance");
  assert.ok(result.systemPrompt.includes("parallelReviewAndSecurity"), "must name the matched workflow");
  assert.ok(result.systemPrompt.includes("/workflow"), "must include run command");
});

test("workflowIntent: guidance is appended after existing system prompt, not replacing it (S10)", async () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const existing = "You are a helpful assistant.";
  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "Launch parallel code review and security analysis.",
    systemPrompt: existing,
  });
  assert.ok(result?.systemPrompt?.startsWith(existing), "must preserve existing system prompt");
  assert.ok(result.systemPrompt.length > existing.length, "must append guidance after existing prompt");
});

test("workflowIntent: non-user message type (custom) is ignored (S12)", async () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const result = await pi.fire("before_agent_start", {
    messageType: "custom",
    message: { content: "Launch parallel workflow" },
    systemPrompt: "",
  });
  assert.equal(result, undefined, "must not intercept non-user message types");
});

test("workflowIntent: diagnostic command handler is callable and returns catalog info", () => {
  const pi = fakePi();
  workflowIntent(pi, { catalogIndex: () => catalogIndex });
  const cmd = pi.commands.get("workflow-intent");
  assert.ok(cmd, "diagnostic command must be registered");
  let notified = "";
  const ctx = { ui: { notify(msg) { notified = msg; } } };
  cmd.handler("diagnose", ctx);
  assert.ok(notified.includes("parallelReviewAndSecurity"), "must list catalog functions");
  assert.ok(notified.includes("KEYWORD_RULES") || notified.includes("Keyword scoring"), "must describe scoring rules");
});

// ---------------------------------------------------------------------------
// KEYWORD_RULES completeness: every registered function name has a rule entry
// ---------------------------------------------------------------------------

test("KEYWORD_RULES covers all expected workflow names", () => {
  const expected = [
    "parallelReviewAndSecurity",
    "developUntilApproved",
    "devIssuesInBatches",
    "fetchIssueDetails",
    "tddDev",
  ];
  for (const name of expected) {
    assert.ok(name in KEYWORD_RULES, `KEYWORD_RULES must have an entry for ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Unavailable dependency path — fail-closed regression (catalog fallback)
// ---------------------------------------------------------------------------

test("workflowIntent: unavailable catalog injects visible diagnostic on NL trigger", async () => {
  const pi = fakePi();
  // Simulate session_start resolving with unavailable package (_catalogFn = false)
  // by injecting a catalogIndex that returns the unavailable marker.
  const unavailableCatalog = () => ({ functions: [], unavailable: true });
  workflowIntent(pi, { catalogIndex: unavailableCatalog });

  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "Launch parallel code review and security analysis.",
    systemPrompt: "",
  });

  assert.ok(result?.systemPrompt, "must inject system prompt when catalog is unavailable");
  assert.ok(
    result.systemPrompt.includes("pi-extensible-workflows"),
    "diagnostic must name the missing package",
  );
  assert.ok(
    result.systemPrompt.includes("unavailable") || result.systemPrompt.includes("could not be loaded"),
    "diagnostic must signal unavailability",
  );
  // Must NOT silently produce empty guidance or route to a workflow
  assert.ok(
    !result.systemPrompt.includes("Workflow intent detected"),
    "must not silently route when catalog is unavailable",
  );
});

test("workflowIntent: unavailable catalog does not intercept explicit /workflow commands", async () => {
  const pi = fakePi();
  const unavailableCatalog = () => ({ functions: [], unavailable: true });
  workflowIntent(pi, { catalogIndex: unavailableCatalog });

  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "/workflow parallelReviewAndSecurity {\"target\": \"./src\"}",
    systemPrompt: "",
  });

  // Native /workflow dispatch must never be intercepted even when catalog is unavailable
  assert.equal(result, undefined, "must not intercept native /workflow when catalog is unavailable");
});

test("workflowIntent: unavailable catalog does not inject guidance for ordinary questions", async () => {
  const pi = fakePi();
  const unavailableCatalog = () => ({ functions: [], unavailable: true });
  workflowIntent(pi, { catalogIndex: unavailableCatalog });

  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "What is the capital of France?",
    systemPrompt: "",
  });

  assert.equal(result, undefined, "must not inject anything for non-trigger messages even when unavailable");
});

test("workflowIntent: unavailable catalog preserves existing system prompt", async () => {
  const pi = fakePi();
  const unavailableCatalog = () => ({ functions: [], unavailable: true });
  workflowIntent(pi, { catalogIndex: unavailableCatalog });
  const existing = "You are a helpful assistant.";

  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "Launch parallel code review and security analysis.",
    systemPrompt: existing,
  });

  assert.ok(result?.systemPrompt?.startsWith(existing), "must preserve existing system prompt before diagnostic");
});

test("workflowIntent: not-yet-resolved catalog (undefined) does not inject unavailable diagnostic", async () => {
  // Before session_start fires, _catalogFn is undefined (not false).
  // unavailable is only true when _catalogFn === false (explicit failure).
  const pi = fakePi();
  // catalogIndex returning unavailable: false simulates the not-yet-attempted state
  const notYetResolved = () => ({ functions: [], unavailable: false });
  workflowIntent(pi, { catalogIndex: notYetResolved });

  const result = await pi.fire("before_agent_start", {
    messageType: "user",
    prompt: "Launch parallel code review and security analysis.",
    systemPrompt: "",
  });

  // No matches and no unavailable flag: nothing injected
  assert.equal(result, undefined, "must not inject diagnostic when catalog is not yet resolved");
});
