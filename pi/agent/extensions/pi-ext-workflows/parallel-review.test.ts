// @ts-ignore Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
// @ts-ignore Bun loads the TypeScript source directly.
import { parallelReviewAndSecurity } from "./parallel-review.ts";

function prompt(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

function context(
  agentImpl: (p: string, opts: Record<string, unknown>) => Promise<unknown>,
  parallelImpl: (
    name: string,
    tasks: Record<string, () => Promise<unknown>>,
  ) => Promise<Record<string, unknown>>,
) {
  return {
    agent: agentImpl,
    parallel: parallelImpl,
    prompt,
    phase: () => {},
    log: () => {},
    shell: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    invoke: async () => null,
    run: { cwd: "/repo", sessionId: "s1", runId: "r1", workflow: { name: "parallelReviewAndSecurity", version: "1.0.0" }, args: {}, signal: new AbortController().signal },
    settings: {},
  } as unknown as Parameters<typeof parallelReviewAndSecurity.run>[1];
}

test("runs reviewer and security agents in parallel and returns both results plus verdict", async () => {
  const calls: Array<{ prompt: string; role: string }> = [];

  const agentImpl = async (p: string, opts: Record<string, unknown>) => {
    calls.push({ prompt: p, role: String(opts.role ?? "") });
    if (opts.role === "architect") return "verdict: looks good";
    return `findings for role ${String(opts.role)}`;
  };

  const parallelImpl = async (
    _name: string,
    tasks: Record<string, () => Promise<unknown>>,
  ): Promise<Record<string, unknown>> => {
    const results: Record<string, unknown> = {};
    await Promise.all(
      Object.entries(tasks).map(async ([key, task]) => {
        results[key] = await task();
      }),
    );
    return results;
  };

  const result = await parallelReviewAndSecurity.run(
    { target: "./src" },
    context(agentImpl, parallelImpl),
  );

  expect(result.review).toBeTruthy();
  expect(result.security).toBeTruthy();
  expect(result.fix).toBeTruthy();
  expect(result.verdict).toBeTruthy();

  const roles = calls.map((c) => c.role);
  expect(roles).toContain("reviewer");
  expect(roles).toContain("security");
  expect(roles).toContain("developer");
  expect(roles).toContain("architect");
});

test("reviewer role is called with the target in the prompt", async () => {
  const reviewerPrompts: string[] = [];

  const agentImpl = async (p: string, opts: Record<string, unknown>) => {
    if (opts.role === "reviewer") reviewerPrompts.push(p);
    return "ok";
  };

  const parallelImpl = async (
    _name: string,
    tasks: Record<string, () => Promise<unknown>>,
  ) => {
    const results: Record<string, unknown> = {};
    for (const [key, task] of Object.entries(tasks)) results[key] = await task();
    return results;
  };

  await parallelReviewAndSecurity.run(
    { target: "src/auth.ts", context: "auth module" },
    context(agentImpl, parallelImpl),
  );

  expect(reviewerPrompts.length).toBeGreaterThan(0);
  expect(reviewerPrompts[0]).toContain("src/auth.ts");
});

test("security role is called with the target in the prompt", async () => {
  const securityPrompts: string[] = [];

  const agentImpl = async (p: string, opts: Record<string, unknown>) => {
    if (opts.role === "security") securityPrompts.push(p);
    return "ok";
  };

  const parallelImpl = async (
    _name: string,
    tasks: Record<string, () => Promise<unknown>>,
  ) => {
    const results: Record<string, unknown> = {};
    for (const [key, task] of Object.entries(tasks)) results[key] = await task();
    return results;
  };

  await parallelReviewAndSecurity.run(
    { target: "src/auth.ts" },
    context(agentImpl, parallelImpl),
  );

  expect(securityPrompts.length).toBeGreaterThan(0);
  expect(securityPrompts[0]).toContain("src/auth.ts");
});

test("developer receives both findings before the architect verdict", async () => {
  const developerPrompts: string[] = [];
  const architectPrompts: string[] = [];

  const agentImpl = async (p: string, opts: Record<string, unknown>) => {
    if (opts.role === "developer") developerPrompts.push(p);
    if (opts.role === "architect") architectPrompts.push(p);
    if (opts.role === "reviewer") return "review-finding";
    if (opts.role === "security") return "security-finding";
    if (opts.role === "developer") return "fixed-finding";
    return "verdict";
  };

  const parallelImpl = async (
    _name: string,
    tasks: Record<string, () => Promise<unknown>>,
  ) => {
    const results: Record<string, unknown> = {};
    for (const [key, task] of Object.entries(tasks)) results[key] = await task();
    return results;
  };

  await parallelReviewAndSecurity.run(
    { target: "." },
    context(agentImpl, parallelImpl),
  );

  expect(developerPrompts.length).toBeGreaterThan(0);
  expect(developerPrompts[0]).toContain("review-finding");
  expect(developerPrompts[0]).toContain("security-finding");
  expect(architectPrompts.length).toBeGreaterThan(0);
  expect(architectPrompts[0]).toContain("review-finding");
  expect(architectPrompts[0]).toContain("security-finding");
  expect(architectPrompts[0]).toContain("fixed-finding");
});

test("architect is called with tools: [] (no tool calls allowed during verdict)", async () => {
  let architectTools: unknown;

  const agentImpl = async (p: string, opts: Record<string, unknown>) => {
    if (opts.role === "architect") architectTools = opts.tools;
    return "ok";
  };

  const parallelImpl = async (
    _name: string,
    tasks: Record<string, () => Promise<unknown>>,
  ) => {
    const results: Record<string, unknown> = {};
    for (const [key, task] of Object.entries(tasks)) results[key] = await task();
    return results;
  };

  await parallelReviewAndSecurity.run(
    { target: "." },
    context(agentImpl, parallelImpl),
  );

  expect(architectTools).toEqual([]);
});
