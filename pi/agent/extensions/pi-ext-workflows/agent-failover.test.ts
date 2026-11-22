// @ts-ignore Bun supplies the test module at runtime.
import { beforeEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore Bun loads the TypeScript source directly.
import {
  agentWithFailover,
  clearFailoverCooldowns,
  resolveRoleChain,
  setFailoverClock,
} from "./agent-failover.ts";

beforeEach(() => {
  clearFailoverCooldowns();
  setFailoverClock(() => Date.now());
});

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

test("deduplicates explicit models without a role", async () => {
  const calls: string[] = [];
  const result = await agentWithFailover.run(
    {
      models: ["provider/same:high", "provider/same:low", "provider/next"],
      task: "do the task",
    },
    context(async (_task, options) => {
      calls.push(String(options.model));
      if (options.model === "provider/same:high") throw new Error("429 quota exhausted");
      return "served";
    }),
  );

  expect(result.model).toBe("provider/next");
  expect(calls).toEqual(["provider/same:high", "provider/next"]);
});

test("skips a cooling model and uses the next model", async () => {
  let now = 1000;
  setFailoverClock(() => now);
  const calls: string[] = [];
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    calls.push(String(options.model));
    if (options.model === "provider/first:high") throw new Error("429 quota exhausted");
    return "served";
  };

  await agentWithFailover.run(
    { models: ["provider/first:high", "provider/second:low"], task: "first", cooldownMs: 30000 },
    context(agentImpl),
  );
  const result = await agentWithFailover.run(
    { models: ["provider/first:high", "provider/second:low"], task: "second", cooldownMs: 30000 },
    context(agentImpl),
  );

  expect(result.model).toBe("provider/second:low");
  expect(calls).toEqual(["provider/first:high", "provider/second:low", "provider/second:low"]);
});

test("retries a cooling model after its cooldown expires", async () => {
  let now = 1000;
  setFailoverClock(() => now);
  const calls: string[] = [];
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    calls.push(String(options.model));
    if (calls.length === 1) throw new Error("429 quota exhausted");
    return "served";
  };

  await expect(
    agentWithFailover.run(
      { models: ["provider/first-model"], task: "first", cooldownMs: 100 },
      context(agentImpl),
    ),
  ).rejects.toThrow("all failover models failed:");
  now += 100;
  const result = await agentWithFailover.run(
    { models: ["provider/first-model"], task: "second", cooldownMs: 100 },
    context(agentImpl),
  );

  expect(result.result).toBe("served");
  expect(calls).toEqual(["provider/first-model", "provider/first-model"]);
});

test("attempts every cooling model in order and reports that state", async () => {
  let now = 1000;
  setFailoverClock(() => now);
  const models = ["provider/first-model", "provider/second-model"];
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    throw new Error(`${String(options.model)} quota exhausted`);
  };

  await expect(
    agentWithFailover.run({ models, task: "prime", cooldownMs: 30000 }, context(agentImpl)),
  ).rejects.toThrow("all failover models failed:");
  const calls: string[] = [];
  await expect(
    agentWithFailover.run(
      { models, task: "retry", cooldownMs: 30000 },
      context(async (_task, options) => {
        calls.push(String(options.model));
        throw new Error(`${String(options.model)} quota exhausted`);
      }),
    ),
  ).rejects.toThrow("all models cooling down: provider/first-model, provider/second-model");

  expect(calls).toEqual(models);
});

test("cooldownMs zero disables cooldown memory", async () => {
  const calls: string[] = [];
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    calls.push(String(options.model));
    throw new Error("429 quota exhausted");
  };

  for (const task of ["first", "second"])
    await expect(
      agentWithFailover.run({ models: ["provider/first-model"], task, cooldownMs: 0 }, context(agentImpl)),
    ).rejects.toThrow("all failover models failed:");

  expect(calls).toEqual(["provider/first-model", "provider/first-model"]);
});

test("passes timeoutMs to the agent when supplied", async () => {
  const calls: Array<{ task: string; options: Record<string, unknown> }> = [];
  const result = await agentWithFailover.run(
    { models: ["first-model"], task: "do the task", timeoutMs: 5000 },
    context(async (task, options) => {
      calls.push({ task, options });
      return "served";
    }),
  );

  expect(result.result).toBe("served");
  expect(calls).toEqual([
    {
      task: "do the task",
      options: { model: "first-model", label: undefined, retries: 0, timeoutMs: 5000 },
    },
  ]);
});

test("omits timeoutMs when it is not supplied", async () => {
  const calls: Array<{ task: string; options: Record<string, unknown> }> = [];
  const result = await agentWithFailover.run(
    { models: ["first-model"], task: "do the task" },
    context(async (task, options) => {
      calls.push({ task, options });
      return "served";
    }),
  );

  expect(result.result).toBe("served");
  expect(calls).toEqual([
    {
      task: "do the task",
      options: { model: "first-model", label: undefined, retries: 0 },
    },
  ]);
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

test("includes earlier attempts when rethrowing a later non-provider error", async () => {
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    if (options.model === "first-model") throw new Error("first quota exhausted");
    throw new TypeError("bad agent input");
  };

  await expect(
    agentWithFailover.run(
      { models: ["first-model", "second-model"], task: "do the task" },
      context(agentImpl),
    ),
  ).rejects.toThrow("bad agent input (attempts: first-model: first quota exhausted)");
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

test("keeps the first explicit model when its base matches the role alias", async () => {
  const calls: string[] = [];
  await inTemporaryAgentDir(async () => {
    await expect(
      agentWithFailover.run(
        { models: ["provider/primary:low"], role: "reviewer", task: "review" },
        context(async (_task, options) => {
          calls.push(String(options.model));
          throw new Error(`${String(options.model)} quota exhausted`);
        }),
      ),
    ).rejects.toThrow("all failover models failed:");
  });

  expect(calls).toEqual([
    "provider/primary:low",
    "provider/second:high",
    "provider/third:low",
  ]);
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

test("resolves a role alias that omits the -model suffix", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-failover-suffix-"));
  mkdirSync(join(dir, "pi-ext-roles"));
  writeFileSync(
    join(dir, "pi-ext-roles", "settings.json"),
    JSON.stringify({ modelAliases: { "tests-expert": "provider/expert:high" } }),
  );
  writeFileSync(
    join(dir, "pi-ha-role-groups.json"),
    JSON.stringify({ roleGroups: { "tests-expert": "testing" } }),
  );
  writeFileSync(
    join(dir, "ha.json"),
    JSON.stringify({ groups: { testing: { entries: [{ id: "provider/bare" }] } } }),
  );

  expect(resolveRoleChain("tests-expert", dir)).toEqual([
    "provider/expert:high",
    "provider/bare:high",
  ]);
  rmSync(dir, { recursive: true, force: true });
});

test("advances past an effort the route cannot serve", async () => {
  const calls: string[] = [];
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    calls.push(String(options.model));
    if (options.model === "provider/no-thinking:high")
      throw new Error("unknown effort: thinking is not supported by this model");
    return "served";
  };

  const result = await agentWithFailover.run(
    { models: ["provider/no-thinking:high", "provider/live:high"], task: "do the task" },
    context(agentImpl),
  );

  expect(result.model).toBe("provider/live:high");
  expect(result.attempts).toHaveLength(1);
  expect(calls).toEqual(["provider/no-thinking:high", "provider/live:high"]);
});

test("advances on the exact 429 body our gateway returns", async () => {
  const realBody =
    '{"error":{"code":"model_cooldown","last_upstream_error":"{\\n  \\"error\\": {\\n    \\"code\\": 429, \\"status\\": \\"RESOURCE_EXHAUSTED\\"",' +
    '"message":"All credentials for model claude-sonnet-4-6 are cooling down","model":"claude-sonnet-4-6","reset_seconds":261154}}';
  const agentImpl = async (_task: string, options: Record<string, unknown>) => {
    if (options.model === "provider/exhausted:off") throw new Error(realBody);
    return "served";
  };

  const result = await agentWithFailover.run(
    { models: ["provider/exhausted:off", "provider/live:high"], task: "do the task" },
    context(agentImpl),
  );

  expect(result.model).toBe("provider/live:high");
  expect(result.attempts[0]?.error).toContain("model_cooldown");
});

test("advances on transport failures and timeouts", async () => {
  for (const message of ["ETIMEDOUT", "socket hang up", "fetch failed", "request timed out", "502 Bad Gateway", "unsupported route", "route unavailable"]) {
    const agentImpl = async (_task: string, options: Record<string, unknown>) => {
      if (options.model === "provider/dead:high") throw new Error(message);
      return "served";
    };
    const result = await agentWithFailover.run(
      { models: ["provider/dead:high", "provider/live:high"], task: "do the task" },
      context(agentImpl),
    );
    expect(result.model).toBe("provider/live:high");
  }
});

test("the extension barrel registers without throwing", async () => {
  // @ts-ignore Bun loads the TypeScript source directly.
  const barrel = await import("../piextworkflows.ts");
  expect(() => barrel.default()).not.toThrow();
});
