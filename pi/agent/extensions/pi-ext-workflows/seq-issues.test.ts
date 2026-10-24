// @ts-ignore Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
import { devIssuesInBatches } from "./seq-issues.ts";

function prompt(template: string, values: Record<string, unknown>): string {
  return template.replace(/{(\w+)}/g, (_match, key: string) => {
    const value = values[key];
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

function approved() {
  return {
    pass: true,
    iterations: 1,
    devResult: null,
    review: { pass: true, findings: [] },
  };
}

function workflowShell(command: string) {
  if (command.includes("status --porcelain"))
    return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
  if (command.includes("rev-parse"))
    return Promise.resolve({
      exitCode: 0,
      stdout: `${command.includes("PI_MAIN_PATH") ? "main-head" : "branch-head"}\n`,
      stderr: "",
    });
  if (command.includes("merge-base --is-ancestor"))
    return Promise.resolve({
      exitCode: command.includes("PI_MAIN_PATH") ? 1 : 0,
      stdout: "",
      stderr: "",
    });
  return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
}

test("plans issue batches with the architect role and no model override", async () => {
  let plannerOptions: Record<string, unknown> | undefined;
  let parallelCalls = 0;
  const context = {
    agent: async (value: string, options: Record<string, unknown>) => {
      if (value.startsWith("Analyze these issue details")) {
        plannerOptions = options;
        return { batches: [[1], [2]] };
      }
      if (value.startsWith("You are the master architect")) return { summary: "master summary" };
      return null;
    },
    invoke: async (name: string, input: Record<string, unknown>) => {
      if (name === "fetchIssueDetails") {
        return {
          issueDetails: [
            { number: 1, title: "Issue 1", content: "content", comments: [] },
            { number: 2, title: "Issue 2", content: "content", comments: [] },
          ],
        };
      }
      if (name === "developUntilApproved") return approved();
      if (name === "integrateReviewedIssues") {
        const issueResults = Object.fromEntries(
          Object.entries(input.issueResults as Record<string, { integration: Record<string, unknown> }>).map(
            ([key, value]) => [
              key,
              {
                ...value,
                integration: {
                  ...value.integration,
                  status: "integrated",
                  stage: "fast-forward",
                },
              },
            ],
          ),
        );
        return {
          issueResults,
          cleanup: { removed: [], skipped: [], failed: [] },
        };
      }
      throw new Error(`unexpected invoke: ${name}`);
    },
    prompt,
    phase: () => {},
    log: () => {},
    shell: workflowShell,
    withWorktree: async (
      name: string,
      callback: (reference: { path: string; branch: string }) => Promise<unknown>,
    ) => callback({ path: `/worktrees/${name}`, branch: name }),
    parallel: async (name: string, tasks: Record<string, () => Promise<unknown>>) => {
      if (name === "issues") {
        parallelCalls += 1;
        return Object.fromEntries(
          await Promise.all(
            Object.entries(tasks).map(async ([key, task]) => [key, await task()]),
          ),
        );
      }
      throw new Error(`unexpected parallel: ${name}`);
    },
    run: { cwd: "/repo" },
  } as unknown as Parameters<typeof devIssuesInBatches.run>[1];

  const result = await devIssuesInBatches.run({ issues: [1, 2], maxIterations: 1 }, context);

  expect(result.batches).toEqual([[1], [2]]);
  expect(plannerOptions?.role).toBe("architect");
  expect(plannerOptions?.tools).toEqual([]);
  expect(plannerOptions?.outputSchema).toBeDefined();
  expect(plannerOptions?.model).toBeUndefined();
  expect(result.masterSummary).toEqual({
    status: "completed",
    totalIssues: 2,
    integratedIssues: 2,
    notApprovedIssues: 0,
    failedIssues: 0,
    batchCount: 2,
    summary: "master summary",
  });
});

test("marks the master result failed when cleanup is incomplete", async () => {
  const context = {
    agent: async (value: string) => {
      if (value.startsWith("Analyze these issue details")) return { batches: [[1]] };
      if (value.startsWith("You are the master architect")) return { summary: "master summary" };
      return null;
    },
    invoke: async (name: string, input: Record<string, unknown>) => {
      if (name === "fetchIssueDetails")
        return { issueDetails: [{ number: 1, title: "Issue 1", content: "content", comments: [] }] };
      if (name === "developUntilApproved") return approved();
      if (name === "integrateReviewedIssues")
        return {
          issueResults: input.issueResults,
          cleanup: { removed: [], skipped: ["branch-issue-1: dirty"], failed: [] },
        };
      throw new Error(`unexpected invoke: ${name}`);
    },
    prompt,
    phase: () => {},
    log: () => {},
    shell: workflowShell,
    withWorktree: async (
      name: string,
      callback: (reference: { path: string; branch: string }) => Promise<unknown>,
    ) => callback({ path: `/worktrees/${name}`, branch: name }),
    parallel: async (
      _name: string,
      tasks: Record<string, () => Promise<unknown>>,
    ) =>
      Object.fromEntries(
        await Promise.all(
          Object.entries(tasks).map(async ([key, task]) => [key, await task()]),
        ),
      ),
    run: { cwd: "/repo" },
  } as unknown as Parameters<typeof devIssuesInBatches.run>[1];

  const result = await devIssuesInBatches.run({ issues: [1], maxIterations: 1 }, context);

  expect(result.masterSummary.status).toBe("failed");
  expect(result.batchResults[0]?.cleanup.skipped).toEqual(["branch-issue-1: dirty"]);
});

test("rejects a malformed master summary instead of propagating it", async () => {
  const context = {
    agent: async (value: string) => {
      if (value.startsWith("Analyze these issue details")) return { batches: [[1]] };
      if (value.startsWith("You are the master architect")) return { wrong: true };
      return null;
    },
    invoke: async (name: string, input: Record<string, unknown>) => {
      if (name === "fetchIssueDetails")
        return { issueDetails: [{ number: 1, title: "Issue 1", content: "content", comments: [] }] };
      if (name === "developUntilApproved") return approved();
      if (name === "integrateReviewedIssues")
        return {
          issueResults: input.issueResults,
          cleanup: { removed: [], skipped: [], failed: [] },
        };
      throw new Error(`unexpected invoke: ${name}`);
    },
    prompt,
    phase: () => {},
    log: () => {},
    shell: workflowShell,
    withWorktree: async (
      name: string,
      callback: (reference: { path: string; branch: string }) => Promise<unknown>,
    ) => callback({ path: `/worktrees/${name}`, branch: name }),
    parallel: async (
      _name: string,
      tasks: Record<string, () => Promise<unknown>>,
    ) =>
      Object.fromEntries(
        await Promise.all(
          Object.entries(tasks).map(async ([key, task]) => [key, await task()]),
        ),
      ),
    run: { cwd: "/repo" },
  } as unknown as Parameters<typeof devIssuesInBatches.run>[1];

  await expect(devIssuesInBatches.run({ issues: [1], maxIterations: 1 }, context)).rejects.toThrow(
    "Master architect returned an unexpected summary",
  );
});
