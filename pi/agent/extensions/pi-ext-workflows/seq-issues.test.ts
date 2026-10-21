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
  const context = {
    agent: async (value: string, options: Record<string, unknown>) => {
      if (value.startsWith("Analyze these issue details")) {
        plannerOptions = options;
        return { batches: [[1]] };
      }
      return null;
    },
    invoke: async (name: string) => {
      if (name === "fetchIssueDetails") {
        return {
          issueDetails: [{ number: 1, title: "Issue 1", content: "content", comments: [] }],
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
        return {
          "issue-1": {
            devRes: { pass: true, iterations: 1, devResult: null, review: { pass: true, findings: [] } },
            integration: { issue: 1, status: "integrated", stage: "complete", findings: [] },
            worktree: { path: "/worktrees/issue-1", branch: "issue-1" },
          },
        };
      }
      throw new Error(`unexpected parallel: ${name}`);
    },
    run: { cwd: "/repo" },
  } as unknown as Parameters<typeof devIssuesInBatches.run>[1];

  const result = await devIssuesInBatches.run({ issues: [1], maxIterations: 1 }, context);

  expect(result.batches).toEqual([[1]]);
  expect(plannerOptions?.role).toBe("architect");
  expect(plannerOptions?.tools).toEqual([]);
  expect(plannerOptions?.outputSchema).toBeDefined();
  expect(plannerOptions?.model).toBeUndefined();
});
