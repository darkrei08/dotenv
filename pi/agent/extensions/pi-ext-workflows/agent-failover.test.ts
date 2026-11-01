// @ts-ignore Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
// @ts-ignore Bun loads the TypeScript source directly.
import { agentWithFailover } from "./agent-failover.ts";

function context(
  agentImpl: (p: string, opts: Record<string, unknown>) => Promise<unknown>,
) {
  return {
    agent: agentImpl,
    parallel: async () => ({}),
    prompt: (template: string) => template,
    phase: () => {},
    log: () => {},
    shell: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    invoke: async () => null,
    run: { cwd: "/repo", sessionId: "s1", runId: "r1", workflow: { name: "agentWithFailover", version: "1.0.0" }, args: {}, signal: new AbortController().signal },
    settings: {},
  } as unknown as Parameters<typeof agentWithFailover.run>[1];
}

test("fails over to the second model after a provider error", async () => {
  const calls: Array<{ task: string; options: Record<string, unknown> }> = [];
  const agentImpl = async (task: string, options: Record<string, unknown>) => {
    calls.push({ task, options });
    if (options.model === "first-model") throw new Error("429 quota exhausted");
    return "second result";
  };

  const result = await agentWithFailover.run(
    { models: ["first-model", "second-model"], task: "do the task", label: "worker" },
    context(agentImpl),
  );

  expect(result.model).toBe("second-model");
  expect(result.result).toBe("second result");
  expect(result.attempts).toEqual([{ model: "first-model", error: "429 quota exhausted" }]);
  expect(calls[1]).toEqual({
    task: "do the task",
    options: { model: "second-model", label: "worker", retries: 0 },
  });
});

test("rethrows non-provider errors without calling the next model", async () => {
  const calls: string[] = [];
  const error = new TypeError("bad agent input");
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    calls.push(String(options.model));
    throw error;
  };

  await expect(
    agentWithFailover.run(
      { models: ["first-model", "second-model"], task: "do the task" },
      context(agentImpl),
    ),
  ).rejects.toBe(error);
  expect(calls).toEqual(["first-model"]);
});

test("reports every provider failure when all models fail", async () => {
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    throw new Error(`${String(options.model)} quota exhausted`);
  };

  await expect(
    agentWithFailover.run(
      { models: ["first-model", "second-model"], task: "do the task" },
      context(agentImpl),
    ),
  ).rejects.toThrow(
    "all failover models failed: first-model: first-model quota exhausted | second-model: second-model quota exhausted",
  );
});
