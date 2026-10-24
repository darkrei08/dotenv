// @ts-ignore Bun supplies the test module at runtime.
import { expect, test } from "bun:test";
import { devIssuesInBatches } from "./seq-issues.ts";

function prompt(template: string, values: Record<string, unknown>): string {
  return template.replace(/{(\w+)}/g, (_match, key: string) => {
    const value = values[key];
    return typeof value === "string" ? value : JSON.stringify(value);
  });
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
    invoke: async (name: string) => {
      if (name === "fetchIssueDetails") {
        return {
          issueDetails: [
            { number: 1, title: "Issue 1", content: "content", comments: [] },
            { number: 2, title: "Issue 2", content: "content", comments: [] },
          ],
        };
      }
      throw new Error(`unexpected invoke: ${name}`);
    },
    prompt,
    phase: () => {},
    log: () => {},
    shell: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    withWorktree: async () => ({ path: "/worktrees/issue-1", branch: "issue-1" }),
    parallel: async (name: string) => {
      if (name === "issues") {
        parallelCalls += 1;
        return {
          [`issue-${parallelCalls}`]: {
            devRes: { pass: true, iterations: 1, devResult: null, review: { pass: true, findings: [] } },
            integration: { issue: parallelCalls, status: "integrated", stage: "complete", findings: [] },
            worktree: { path: `/worktrees/issue-${parallelCalls}`, branch: `issue-${parallelCalls}` },
          },
        };
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

test("rejects a malformed master summary instead of propagating it", async () => {
  const context = {
    agent: async (value: string) => {
      if (value.startsWith("Analyze these issue details")) return { batches: [[1]] };
      if (value.startsWith("You are the master architect")) return { wrong: true };
      return null;
    },
    invoke: async () => ({ issueDetails: [{ number: 1, title: "Issue 1", content: "content", comments: [] }] }),
    prompt,
    phase: () => {},
    log: () => {},
    shell: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    withWorktree: async () => ({ path: "/worktrees/issue-1", branch: "issue-1" }),
    parallel: async () => ({
      "issue-1": {
        devRes: { pass: true, iterations: 1, devResult: null, review: { pass: true, findings: [] } },
        integration: { issue: 1, status: "integrated", stage: "complete", findings: [] },
        worktree: { path: "/worktrees/issue-1", branch: "issue-1" },
      },
    }),
    run: { cwd: "/repo" },
  } as unknown as Parameters<typeof devIssuesInBatches.run>[1];

  await expect(devIssuesInBatches.run({ issues: [1], maxIterations: 1 }, context)).rejects.toThrow(
    "Master architect returned an unexpected summary",
  );
});
