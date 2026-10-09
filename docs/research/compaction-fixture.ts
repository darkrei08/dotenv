// Disposable compaction fixture (docs/compaction-evaluation.md).
// Plants 12 facts in a 260-turn synthetic session, compacts it, and measures which facts survive.
//
//   PI_PKG=<dir of @earendil-works/pi-coding-agent> VCC_PKG=<dir of @sting8k/pi-vcc> \
//   [SCEN=prose|tool] [NATIVE=1 MODEL=openai-codex/gpt-6-luna RUNS=3 [EXT=none|ctx|vcc]] bun run fixture.ts
//
// Runs on a temporary copy of the Pi config (removed on exit) and never opens a live session. NATIVE=1 makes billable model calls.
const PI_PKG = process.env.PI_PKG ?? "";
const VCC_PKG = process.env.VCC_PKG ?? "";
const CTX_PKG = process.env.CTX_PKG ?? new URL("../../pi/agent/packages/pi-codex-context", import.meta.url).pathname;
// Run against a throwaway copy of the Pi config so setModel/thinking changes can never persist to the live one.
import { mkdtempSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const LIVE_DIR = process.env.PI_CODING_AGENT_DIR ?? `${process.env.HOME}/.pi/agent`;
const AGENT_DIR = mkdtempSync(join(tmpdir(), "compaction-fixture-"));
for (const f of ["auth.json", "models.json", "settings.json"]) if (existsSync(join(LIVE_DIR, f))) copyFileSync(join(LIVE_DIR, f), join(AGENT_DIR, f));
process.on("exit", () => rmSync(AGENT_DIR, { recursive: true, force: true }));
if (!PI_PKG || !VCC_PKG) throw new Error("set PI_PKG and VCC_PKG");
const pi = (p: string) => import(`${PI_PKG}/dist/${p}`);
const { SessionManager, estimateTokens, DEFAULT_COMPACTION_SETTINGS, createAgentSession, DefaultResourceLoader } = await pi("index.js");
const { prepareCompaction } = await pi("core/compaction/compaction.js");
const { compile, compileRanked } = await import(`${VCC_PKG}/src/core/summarize.ts`);

type Fact = { id: string; weight: number; at: number; kind: string; probe: string; text: string };

// `at` = fraction of the session (0 = start). probe = token a faithful summary must keep.
const FACTS: Fact[] = [
  { id: "pref-lang", weight: 3, at: 0.02, kind: "user-pref", probe: "Italian", text: "From now on always answer me in Italian, no emojis, no em dashes." },
  { id: "constraint-docker", weight: 3, at: 0.05, kind: "constraint", probe: "down -v", text: "Never run docker compose down -v on the cliproxyapi stack, it deletes OAuth data." },
  { id: "decision-routing", weight: 3, at: 0.10, kind: "decision", probe: "cliproxyapi", text: "Decision: Claude goes through cliproxyapi because the Anthropic OAuth login is expired (invalid_grant)." },
  { id: "id-lineage", weight: 2, at: 0.15, kind: "identifier", probe: "review-d0c5783079ccafb1", text: "The approved review lineage is review-d0c5783079ccafb1." },
  { id: "error-fix", weight: 3, at: 0.22, kind: "error+fix", probe: "EALLOWSCRIPTS", text: "npm error code EALLOWSCRIPTS --allow-scripts is not allowed in project-scoped installs; fix: put allowScripts in package.json." },
  { id: "file-edit", weight: 2, at: 0.30, kind: "file-edit", probe: "pi-ext-roles/settings.json", text: "Created pi/agent/pi-ext-roles/settings.json with modelAliases, skills and extensions." },
  { id: "number-port", weight: 1, at: 0.38, kind: "number", probe: "8190", text: "Trajectory viewer port is 8190, set in extensionSettings.trajectory." },
  { id: "commit", weight: 2, at: 0.46, kind: "commit", probe: "fix(gga): review with the CLIProxyAPI mirror", text: "Committed: fix(gga): review with the CLIProxyAPI mirror of the reviewer role" },
  { id: "pref-pr", weight: 2, at: 0.54, kind: "user-pref", probe: "one PR per work unit", text: "Reminder: one PR per work unit, reference the issue, never merge without CI green." },
  { id: "todo-open", weight: 3, at: 0.62, kind: "open-todo", probe: "issue #46", text: "Still pending: migrate roles to pi-ext-roles (issue #46), then verify the legacy warning is gone." },
  { id: "decision-herdr", weight: 2, at: 0.70, kind: "decision", probe: "@piewf/herdr", text: "Decision: install @piewf/herdr only; skip @piewf/cli and @piewf/pi-ext-roles." },
  { id: "late-secret-rule", weight: 3, at: 0.93, kind: "constraint", probe: "never print tokens", text: "Constraint: never print tokens from ha.json in any output." },
];

const FILLER = Array.from({ length: 12 }, (_, i) => `line ${i}: export const value${i} = computeThing(${i}, "alpha-${i * 7}", { retries: ${i % 5}, verbose: false });`).join("\n");
const N = 260; // turns; each turn = user + assistant(toolCall) + toolResult

const SCEN = process.env.SCEN ?? "prose";
function toolCallFor(f: Fact) {
  if (SCEN !== "tool") return null;
  if (f.id === "commit") return { name: "bash", args: { command: `git commit -m "${f.probe} of the reviewer role"` }, result: `[main abc1234] ${f.probe} of the reviewer role\n 3 files changed`, isError: false };
  if (f.id === "file-edit") return { name: "write", args: { path: "pi/agent/pi-ext-roles/settings.json", content: "{}" }, result: "Wrote pi/agent/pi-ext-roles/settings.json", isError: false };
  if (f.id === "error-fix") return { name: "bash", args: { command: "npm install -g --allow-scripts x" }, result: "npm error code EALLOWSCRIPTS\nnpm error --allow-scripts is not allowed in project-scoped installs", isError: true };
  return null;
}
function build() {
  const sm = SessionManager.inMemory("/fixture");
  const byTurn = new Map<number, Fact[]>();
  for (const f of FACTS) { const t = Math.min(N - 1, Math.floor(f.at * N)); byTurn.set(t, [...(byTurn.get(t) ?? []), f]); }
  for (let i = 0; i < N; i++) {
    const planted = byTurn.get(i) ?? [];
    const userText = `step ${i}: please continue the work on module ${i % 13}.` + planted.filter((f) => f.kind.startsWith("user") || f.kind === "constraint").map((f) => " " + f.text).join("");
    sm.appendMessage({ role: "user", content: [{ type: "text", text: userText }], timestamp: Date.now() } as any);
    const special = planted.map((f) => ({ f, tc: toolCallFor(f) })).filter((x) => x.tc);
    const asstFacts = planted.filter((f) => !(f.kind.startsWith("user") || f.kind === "constraint") && !special.some((x) => x.f === f));
    sm.appendMessage({
      role: "assistant", provider: "fixture", model: "fixture", stopReason: "toolUse", api: "fixture",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      content: [
        { type: "text", text: `Working on module ${i % 13}. ` + asstFacts.map((f) => f.text).join(" ") },
        { type: "toolCall", id: `c${i}`, name: "read", arguments: { path: `src/module${i % 13}/file${i}.ts` } },
      ], timestamp: Date.now(),
    } as any);
    sm.appendMessage({ role: "toolResult", toolCallId: `c${i}`, toolName: "read", isError: false, content: [{ type: "text", text: FILLER }], timestamp: Date.now() } as any);
    for (const { tc } of special) {
      const id = `s${i}-${tc!.name}`;
      sm.appendMessage({ role: "assistant", provider: "fixture", model: "fixture", stopReason: "toolUse", api: "fixture", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, content: [{ type: "toolCall", id, name: tc!.name, arguments: tc!.args }], timestamp: Date.now() } as any);
      sm.appendMessage({ role: "toolResult", toolCallId: id, toolName: tc!.name, isError: tc!.isError, content: [{ type: "text", text: tc!.result }], timestamp: Date.now() } as any);
    }
  }
  return sm;
}

const has = (text: string, probe: string) => text.toLowerCase().includes(probe.toLowerCase());
const survive = (text: string, ids: Set<string>) => {
  const hit = FACTS.filter((f) => ids.has(f.id) && has(text, f.probe));
  const tot = FACTS.filter((f) => ids.has(f.id));
  const w = (a: Fact[]) => a.reduce((s, f) => s + f.weight, 0);
  return { hit: hit.length, of: tot.length, weighted: tot.length ? +(w(hit) / w(tot)).toFixed(2) : NaN, missed: tot.filter((f) => !hit.includes(f)).map((f) => f.id) };
};

const sm = build();
const entries = sm.getBranch();
const totalTokens = entries.reduce((s: number, e: any) => s + (e.type === "message" ? estimateTokens(e.message) : 0), 0);
console.log(JSON.stringify({ turns: N, entries: entries.length, estTokens: totalTokens }));

// (1) keepRecentTokens sweep: which facts fall in the summarized span vs the kept tail.
const sweep: any[] = [];
for (const keep of [5_000, 10_000, 20_000, 40_000, 80_000]) {
  const prep = prepareCompaction(entries as any, { ...DEFAULT_COMPACTION_SETTINGS, keepRecentTokens: keep });
  if (!prep) { sweep.push({ keep, note: "nothing to compact" }); continue; }
  const kept = entries.findIndex((e: any) => e.id === prep.firstKeptEntryId);
  const keptText = JSON.stringify(entries.slice(kept).map((e: any) => e.message ?? {}));
  const keptIds = new Set(FACTS.filter((f) => has(keptText, f.probe)).map((f) => f.id));
  sweep.push({ keep, summarizedMsgs: prep.messagesToSummarize.length, keptEntries: entries.length - kept, factsInKeptTail: [...keptIds], factsToSummarize: FACTS.length - keptIds.size });
}
console.log("SWEEP", JSON.stringify(sweep));

// (2) compare methods on the default policy.
const prep = prepareCompaction(entries as any, DEFAULT_COMPACTION_SETTINGS)!;
const kept = entries.findIndex((e: any) => e.id === prep.firstKeptEntryId);
const keptText = JSON.stringify(entries.slice(kept).map((e: any) => e.message ?? {}));
const inSpan = new Set(FACTS.filter((f) => !has(keptText, f.probe)).map((f) => f.id));
console.log("DEFAULT", JSON.stringify({ messagesToSummarize: prep.messagesToSummarize.length, factsInSummarizedSpan: [...inSpan] }));

const report: any = {};
const t0 = performance.now();
const vcc = compile({ messages: prep.messagesToSummarize as any, fileOps: prep.fileOps as any });
report["pi-vcc compile"] = { ms: Math.round(performance.now() - t0), chars: vcc.length, estTokens: Math.round(vcc.length / 4), llmCalls: 0, ...survive(vcc, inSpan) };
const vccR = compileRanked({ messages: prep.messagesToSummarize as any, fileOps: prep.fileOps as any });
report["pi-vcc compileRanked"] = { chars: vccR.length, estTokens: Math.round(vccR.length / 4), llmCalls: 0, ...survive(vccR, inSpan) };
// repeated compaction: feed the previous summary back with the same span
const vcc2 = compile({ messages: prep.messagesToSummarize as any, fileOps: prep.fileOps as any, previousSummary: vcc });
report["pi-vcc 2nd pass"] = { chars: vcc2.length, ...survive(vcc2, inSpan) };

{ // on-demand recall: can the agent get each fact back after compaction? (pi-vcc vcc_recall over raw messages)
  const { searchEntries } = await import(`${VCC_PKG}/src/core/search-entries.ts`);
  const msgs = prep.messagesToSummarize as any[];
  const found = FACTS.filter((f) => inSpan.has(f.id)).filter((f) => (searchEntries(msgs, f.probe) as any[]).length > 0);
  report["pi-vcc vcc_recall (on demand)"] = { chars: 0, llmCalls: 0, hit: found.length, of: inSpan.size, weighted: +(found.reduce((a, f) => a + f.weight, 0) / FACTS.filter((f) => inSpan.has(f.id)).reduce((a, f) => a + f.weight, 0)).toFixed(2), missed: [...inSpan].filter((id) => !found.some((f) => f.id === id)) };
}
if (process.env.NATIVE === "1") {
  for (let run = 1; run <= (Number(process.env.RUNS) || 1); run++) {
    const sm2 = build();
    const EXT = process.env.EXT; // "none" = stock Pi compaction; "ctx" = pi-codex-context only; "vcc" = pi-vcc only
    const paths = EXT === "ctx" ? [CTX_PKG] : EXT === "vcc" ? [VCC_PKG] : [];
    const loader = new (DefaultResourceLoader as any)({ cwd: "/fixture", agentDir: AGENT_DIR, noExtensions: true, additionalExtensionPaths: paths, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true });
    await loader.reload();
    const { session } = await createAgentSession({ sessionManager: sm2, cwd: "/fixture", agentDir: AGENT_DIR, noTools: "all", thinkingLevel: "high", resourceLoader: loader } as any);
    const want = (process.env.MODEL ?? "cliproxyapi/claude-sonnet-5-5").split("/");
    const m = (session as any).modelRuntime.getModel(want[0], want[1]);
    if (!m) throw new Error("model not found: " + want.join("/"));
    await (session as any).setModel(m);
    console.log("SUMMARIZER", session.model?.provider + "/" + session.model?.id);
    const t = performance.now();
    const res: any = await session.compact();
    const text: string = res?.summary ?? "";
    report[`${process.env.EXT ?? "none"} compact run${run}`] = { ms: Math.round(performance.now() - t), chars: text.length, estTokens: Math.round(text.length / 4), llmCalls: ">=1", ...survive(text, inSpan) };
    if (text.length < 400) console.log("NATIVE_RAW", JSON.stringify(res).slice(0, 400), "model:", session.model?.provider + "/" + session.model?.id);
    session.dispose();
  }
}
for (const [k, v] of Object.entries<any>(report)) console.log(`${k.padEnd(30)} chars=${String(v.chars).padEnd(6)} hit=${v.hit}/${v.of} weighted=${v.weighted} ms=${v.ms ?? "-"} missed=${JSON.stringify(v.missed)}`);
