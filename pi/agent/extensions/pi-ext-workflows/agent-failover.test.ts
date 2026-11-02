// @ts-ignore Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore Bun loads the TypeScript source directly.
import { agentWithFailover, resolveRoleChain } from "./agent-failover.ts";

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

function createAgentDir() {
  const dir = mkdtempSync(join(tmpdir(), "agent-failover-"));
  mkdirSync(join(dir, "pi-ext-roles"));
  writeFileSync(
    join(dir, "pi-ext-roles", "settings.json"),
    JSON.stringify({
      modelAliases: {
        "reviewer-model": "provider/primary:high",
        "summarizer-model": "provider/summary:low",
        "architect-model": "provider/architect:medium",
      },
    }),
  );
  writeFileSync(
    join(dir, "pi-ha-role-groups.json"),
    JSON.stringify({
      roleGroups: { reviewer: "reviewer", summarizer: "summary" },
    }),
  );
  writeFileSync(
    join(dir, "ha.json"),
    JSON.stringify({
      groups: {
        reviewer: {
          entries: [
            { id: "provider/second" },
            { id: "provider/primary" },
            { id: "provider/third:low" },
          ],
        },
        summary: {
          entries: [
            { id: "provider/summary" },
            { id: "provider/backup" },
          ],
        },
      },
    }),
  );
  return dir;
}

async function withAgentDir<T>(dir: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
  }
}

async function inTemporaryAgentDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = createAgentDir();
  try {
    return await withAgentDir(dir, () => run(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

test("resolves the reviewer role chain in order", async () => {
  await inTemporaryAgentDir(async () => {
    expect(resolveRoleChain("reviewer")).toEqual([
      "provider/primary:high",
      "provider/second:high",
      "provider/third:low",
    ]);
  });
});

test("inherits the role effort for bare HA entries", async () => {
  const calls: string[] = [];
  await inTemporaryAgentDir(async () => {
    const result = await agentWithFailover.run(
      { role: "summarizer", task: "summarize" },
      context(async (_task, options) => {
        calls.push(String(options.model));
        if (options.model === "provider/summary:low")
          throw new Error("429 quota exhausted");
        return "backup result";
      }),
    );

    expect(result.model).toBe("provider/backup:low");
    expect(calls).toEqual(["provider/summary:low", "provider/backup:low"]);
    expect(calls.every((model) => model.includes(":"))).toBe(true);
  });
});

test("deduplicates a repeated role alias while keeping its alias form", async () => {
  await inTemporaryAgentDir(async () => {
    expect(resolveRoleChain("reviewer")).toEqual([
      "provider/primary:high",
      "provider/second:high",
      "provider/third:low",
    ]);
  });
});

test("puts explicit models before the role chain and deduplicates them", async () => {
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    throw new Error(`${String(options.model)} quota exhausted`);
  };

  await inTemporaryAgentDir(async () => {
    await expect(
      agentWithFailover.run(
        {
          models: ["provider/manual:high", "provider/primary:medium"],
          role: "reviewer",
          task: "review",
        },
        context(agentImpl),
      ),
    ).rejects.toThrow(
      "all failover models failed: provider/manual:high: provider/manual:high quota exhausted | provider/primary:medium: provider/primary:medium quota exhausted | provider/second:high: provider/second:high quota exhausted | provider/third:low: provider/third:low quota exhausted",
    );
  });
});

test("rejects an unknown role before calling agent", async () => {
  const calls: string[] = [];
  await inTemporaryAgentDir(async () => {
    await expect(
      agentWithFailover.run(
        { role: "missing", task: "review" },
        context(async (_task, options) => {
          calls.push(String(options.model));
          return "unexpected";
        }),
      ),
    ).rejects.toThrow("unknown role: missing (known roles: architect, reviewer, summarizer)");
    expect(calls).toEqual([]);
  });
});

test("reports missing role files before calling agent", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-failover-missing-"));
  const calls: string[] = [];
  try {
    await expect(
      withAgentDir(dir, () =>
        agentWithFailover.run(
          { role: "reviewer", task: "review" },
          context(async (_task, options) => {
            calls.push(String(options.model));
            return "unexpected";
          }),
        ),
      ),
    ).rejects.toThrow("cannot resolve role chain:");
    expect(calls).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fails over from a provider error in the role primary", async () => {
  const calls: string[] = [];
  await inTemporaryAgentDir(async () => {
    const result = await agentWithFailover.run(
      { role: "reviewer", task: "review" },
      context(async (_task, options) => {
        const model = String(options.model);
        calls.push(model);
        if (model === "provider/primary:high")
          throw new Error("AGENT_FAILED: rate limit");
        return "first fallback result";
      }),
    );

    expect(result.model).toBe("provider/second:high");
    expect(result.result).toBe("first fallback result");
    expect(result.attempts).toEqual([
      { model: "provider/primary:high", error: "AGENT_FAILED: rate limit" },
    ]);
    expect(calls).toEqual(["provider/primary:high", "provider/second:high"]);
  });
});
