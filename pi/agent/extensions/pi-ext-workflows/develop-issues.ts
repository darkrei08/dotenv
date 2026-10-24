import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import {
  defineWorkflowFunction,
  type JsonValue,
  type ShellResult,
  type WorkflowFunctionContext,
  type WorkflowWorktreeReference,
} from "pi-extensible-workflows";
import {
  fetchIssueDetailsOutputSchema,
  type IssueDetail,
} from "./fetch-issue-details.js";
import {
  reviewLoopInputSchema,
  reviewLoopOutputSchema,
} from "./review-loop.js";

const integrationResultSchema = Type.Object(
  {
    issue: Type.Integer(),
    status: Type.Union([
      Type.Literal("integrated"),
      Type.Literal("integration-ready"),
      Type.Literal("failed"),
      Type.Literal("not-approved"),
    ]),
    stage: Type.String(),
    findings: Type.Array(Type.String()),
    mainHead: Type.Optional(Type.String()),
    reviewedHead: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const developIssues = defineWorkflowFunction({
  description:
    "Develop issues in parallel worktrees and return reviewed branches for Master-owned integration",
  async run(
    { issueDetails, maxIterations = 5 },
    { agent, log, invoke, phase, shell, parallel, prompt, withWorktree, run },
  ) {
    const tasks: Record<string, () => Promise<IssueResult>> = {};
    let integrationTail: Promise<unknown> = Promise.resolve();
    const integrationOrder: number[] = [];

    const enqueueIntegration = (
      issue: IssueDetail,
      worktree: WorkflowWorktreeReference,
    ): Promise<IntegrationResult> => {
      integrationOrder.push(issue.number);
      const queued = integrationTail.then(async () => {
        const result = await integrateIssue(
          issue,
          worktree,
          run.cwd,
          maxIterations,
          { invoke, shell },
        );
        if (result.status === "failed")
          log(
            `Integration failed for issue #${String(result.issue)} at ${result.stage}: ${result.findings.join("; ")} Worktree retained: ${worktree.path} (${worktree.branch}).`,
          );
        return result;
      });
      integrationTail = queued;
      return queued;
    };

    for (const issue of issueDetails) {
      tasks[`issue-${issue.number}`] = () =>
        withWorktree(`issue-${issue.number}`, async (worktree) => {
          const devRes = reviewResult(
            await invoke("developUntilApproved", {
              task: issueTask(issue),
              maxIterations,
            }),
          );
          const integration = devRes.pass
            ? await enqueueIntegration(issue, worktree)
            : integrationResult(
                issue.number,
                "not-approved",
                "development",
                devRes.review.findings,
              );
          return { devRes, integration, worktree };
        });
    }

    phase("issues");
    log(`Developing ${issueDetails.length} issue(s) in parallel worktrees`);
    const issueResults = await parallel("issues", tasks);
    const entries = Object.entries(issueResults);
    const failedIssueNames = entries
      .filter(([, result]) => !result.devRes.pass)
      .map(([name]) => name);
    if (failedIssueNames.length > 0)
      log(`Skipping failed issue worktrees: ${failedIssueNames.join(", ")}`);

    phase("summary");
    const issues = issueDetails.map((issue) => issue.number);
    const summary = await agent(
      prompt(
        `Summarize what succeeded, what failed review, and what is ready for Master-owned integration. Do not change files.

Issues:
{issues}

Issue results:
{issueResults}

Failed issues:
{failedIssueNames}`,
        {
          issues,
          issueResults,
          failedIssueNames,
        },
      ),
      { role: "summarizer" },
    );

    return { issues, issueResults, integrationOrder, summary };
  },
  input: Type.Object(
    {
      issueDetails: fetchIssueDetailsOutputSchema.properties.issueDetails,
      maxIterations: reviewLoopInputSchema.properties.maxIterations,
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    {
      issues: Type.Array(Type.Integer()),
      issueResults: Type.Object(
        {},
        {
          additionalProperties: Type.Object(
            {
              devRes: reviewLoopOutputSchema,
              integration: integrationResultSchema,
              worktree: Type.Object(
                { path: Type.String(), branch: Type.String() },
                { additionalProperties: false },
              ),
            },
            { additionalProperties: false },
          ),
        },
      ),
      integrationOrder: Type.Array(Type.Integer()),
      summary: Type.Any(),
    },
    { additionalProperties: false },
  ),
});

export const developIssuesInputSchema = developIssues.input;
export const developIssuesOutputSchema = developIssues.output;
const issueResultsSchema = developIssues.output.properties.issueResults;
const cleanupSchema = Type.Object(
  {
    removed: Type.Array(Type.String()),
    skipped: Type.Array(Type.String()),
    failed: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

export const integrateReviewedIssues = defineWorkflowFunction({
  description:
    "Master-owned re-review, fast-forward, and cleanup for reviewed issue worktrees",
  async run(
    { issueResults, integrationOrder, issueDetails, maxIterations = 5 },
    { log, phase, shell, run, invoke },
  ) {
    const updatedResults = { ...issueResults } as Record<string, IssueResult>;
    const detailsByIssue = new Map(issueDetails.map((issue) => [issue.number, issue]));
    const integratedWorktrees: WorkflowWorktreeReference[] = [];

    phase("master-integration");
    for (const issue of integrationOrder) {
      const entry = Object.entries(updatedResults).find(
        ([, result]) => result.integration.issue === issue,
      );
      if (!entry) continue;
      const [name, result] = entry;
      if (result.integration.status === "integrated") {
        integratedWorktrees.push(result.worktree);
        continue;
      }
      if (result.integration.status !== "integration-ready") continue;

      const detail = detailsByIssue.get(issue);
      const reviewed = detail
        ? await integrateIssue(
            detail,
            result.worktree,
            run.cwd,
            maxIterations,
            { invoke, shell },
          )
        : integrationResult(
            issue,
            "failed",
            "master-precondition",
            ["Issue details were not supplied for Master re-review"],
          );
      const integration =
        reviewed.status === "integration-ready"
          ? await fastForwardIssue(reviewed, result.worktree, run.cwd, shell)
          : reviewed;
      updatedResults[name] = { ...result, integration };
      if (integration.status === "integrated")
        integratedWorktrees.push(result.worktree);
    }

    const cleanup = await cleanupMergedWorktrees(
      shell,
      run.cwd,
      integratedWorktrees,
    );
    log(`Master integration cleanup: ${JSON.stringify(cleanup)}`);
    return { issueResults: updatedResults, cleanup };
  },
  input: Type.Object(
    {
      issueResults: issueResultsSchema,
      integrationOrder: Type.Array(Type.Integer()),
      issueDetails: fetchIssueDetailsOutputSchema.properties.issueDetails,
      maxIterations: reviewLoopInputSchema.properties.maxIterations,
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    { issueResults: issueResultsSchema, cleanup: cleanupSchema },
    { additionalProperties: false },
  ),
});

export const integrateReviewedIssuesInputSchema = integrateReviewedIssues.input;
export const integrateReviewedIssuesOutputSchema = integrateReviewedIssues.output;

type IntegrationResult = Static<typeof integrationResultSchema>;

type IssueResult = {
  devRes: Static<typeof reviewLoopOutputSchema>;
  integration: IntegrationResult;
  worktree: { path: string; branch: string };
};

type WorktreeCleanup = {
  removed: string[];
  skipped: string[];
  failed: string[];
};

function reviewResult(value: JsonValue): Static<typeof reviewLoopOutputSchema> {
  if (!Value.Check(reviewLoopOutputSchema, value))
    throw new Error("developUntilApproved returned an unexpected result");
  return value;
}

function integrationResult(
  issue: number,
  status: IntegrationResult["status"],
  stage: string,
  findings: readonly string[],
): IntegrationResult {
  return { issue, status, stage, findings: [...findings] };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function integrateIssue(
  issue: IssueDetail,
  worktree: WorkflowWorktreeReference,
  mainPath: string,
  maxIterations: number,
  { invoke, shell }: Pick<WorkflowFunctionContext, "invoke" | "shell">,
): Promise<IntegrationResult> {
  let stage = "precondition";
  const fail = (findings: readonly string[]): IntegrationResult =>
    integrationResult(
      issue.number,
      "failed",
      stage,
      findings.length > 0 ? findings : ["Integration failed without findings"],
    );

  try {
    const options: { env: Record<string, string> } = {
      env: {
        PI_MAIN_PATH: mainPath,
        PI_WORKTREE_PATH: worktree.path,
        PI_WORKTREE_BRANCH: worktree.branch,
      },
    };
    const mainStatus = await shell(
      'git -C "$PI_MAIN_PATH" status --porcelain',
      options,
    );
    if (mainStatus.exitCode !== 0)
      return fail([shellFailure("main status", mainStatus)]);
    if (mainStatus.stdout.trim())
      return fail(["Main working tree is not clean"]);

    const mainHeadResult = await shell(
      'git -C "$PI_MAIN_PATH" rev-parse --verify HEAD',
      options,
    );
    if (mainHeadResult.exitCode !== 0)
      return fail([shellFailure("main HEAD", mainHeadResult)]);
    const capturedMainHead = mainHeadResult.stdout.trim();
    if (!capturedMainHead || /\s/.test(capturedMainHead))
      return fail(["Could not capture a single main HEAD"]);
    options.env.PI_MAIN_HEAD = capturedMainHead;

    const alreadyContained = await shell(
      'git -C "$PI_MAIN_PATH" merge-base --is-ancestor "$PI_WORKTREE_BRANCH" "$PI_MAIN_HEAD"',
      options,
    );
    if (alreadyContained.exitCode !== 0 && alreadyContained.exitCode !== 1)
      return fail([shellFailure("branch ancestry", alreadyContained)]);
    if (alreadyContained.exitCode === 0)
      return integrationResult(
        issue.number,
        "integrated",
        "already-integrated",
        [],
      );

    stage = "rebase";
    const rebase = await shell(
      'git -C "$PI_WORKTREE_PATH" rebase "$PI_MAIN_HEAD"',
      options,
    );
    const rebaseFindings =
      rebase.exitCode === 0
        ? "Rebase onto the captured main HEAD completed."
        : shellFailure("rebase", rebase);

    stage = "review";
    const review = reviewResult(
      await invoke("developUntilApproved", {
        task: `Integrate issue #${issue.number} in the current issue worktree only.

Issue title: ${issue.title}
Issue worktree: ${worktree.path}
Issue branch: ${worktree.branch}
Main worktree: ${mainPath}
Captured main HEAD: ${capturedMainHead}

A deterministic rebase onto the captured main HEAD was attempted before this developer/reviewer loop:
${rebaseFindings}

Resolve any rebase conflicts in the current issue worktree, complete the integration there, and run the relevant repository tests. The reviewer must check the rebased branch and test results. Do not modify the main worktree, create a merge commit, squash, cherry-pick, or fast-forward main. Main is moved only by the orchestrator after this integration review passes and all preconditions are rechecked.`,
        maxIterations,
      }),
    );
    if (!review.pass)
      return fail(
        review.review.findings.length > 0
          ? review.review.findings
          : ["Integration review did not pass"],
      );

    stage = "post-review";
    const worktreeStatus = await shell(
      'git -C "$PI_WORKTREE_PATH" status --porcelain',
      options,
    );
    if (worktreeStatus.exitCode !== 0)
      return fail([shellFailure("issue worktree status", worktreeStatus)]);
    if (worktreeStatus.stdout.trim())
      return fail(["Issue worktree is dirty after integration review"]);

    const rebased = await shell(
      'git -C "$PI_WORKTREE_PATH" merge-base --is-ancestor "$PI_MAIN_HEAD" "$PI_WORKTREE_BRANCH"',
      options,
    );
    if (rebased.exitCode !== 0)
      return fail([shellFailure("rebased branch ancestry", rebased)]);

    const worktreeHead = await shell(
      'git -C "$PI_WORKTREE_PATH" rev-parse --verify HEAD',
      options,
    );
    const branchHead = await shell(
      'git -C "$PI_WORKTREE_PATH" rev-parse --verify "$PI_WORKTREE_BRANCH"',
      options,
    );
    if (worktreeHead.exitCode !== 0 || branchHead.exitCode !== 0)
      return fail([
        shellFailure(
          "reviewed branch HEAD",
          worktreeHead.exitCode !== 0 ? worktreeHead : branchHead,
        ),
      ]);
    if (worktreeHead.stdout.trim() !== branchHead.stdout.trim())
      return fail(["Issue worktree HEAD is not the reviewed branch HEAD"]);
    options.env.PI_REVIEWED_HEAD = branchHead.stdout.trim();

    const mainStatusAfterReview = await shell(
      'git -C "$PI_MAIN_PATH" status --porcelain',
      options,
    );
    if (mainStatusAfterReview.exitCode !== 0)
      return fail([
        shellFailure("main status after review", mainStatusAfterReview),
      ]);
    if (mainStatusAfterReview.stdout.trim())
      return fail(["Main working tree changed during integration review"]);
    const mainHeadAfterReview = await shell(
      'git -C "$PI_MAIN_PATH" rev-parse --verify HEAD',
      options,
    );
    if (mainHeadAfterReview.exitCode !== 0)
      return fail([
        shellFailure("main HEAD after review", mainHeadAfterReview),
      ]);
    if (mainHeadAfterReview.stdout.trim() !== capturedMainHead)
      return fail(["Main HEAD changed during integration review"]);

    return {
      ...integrationResult(issue.number, "integration-ready", "review", []),
      mainHead: capturedMainHead,
      reviewedHead: branchHead.stdout.trim(),
    };
  } catch (error) {
    return fail([errorMessage(error)]);
  }
}

async function fastForwardIssue(
  prepared: IntegrationResult,
  worktree: WorkflowWorktreeReference,
  mainPath: string,
  shell: WorkflowFunctionContext["shell"],
): Promise<IntegrationResult> {
  let stage = "master-precondition";
  const fail = (findings: readonly string[]): IntegrationResult =>
    integrationResult(
      prepared.issue,
      "failed",
      stage,
      findings.length > 0 ? findings : ["Integration failed without findings"],
    );
  const options = {
    env: {
      PI_MAIN_PATH: mainPath,
      PI_WORKTREE_PATH: worktree.path,
      PI_WORKTREE_BRANCH: worktree.branch,
      PI_MAIN_HEAD: prepared.mainHead ?? "",
      PI_REVIEWED_HEAD: prepared.reviewedHead ?? "",
    },
  };

  if (!prepared.mainHead || !prepared.reviewedHead)
    return fail(["Reviewed integration evidence is incomplete"]);
  const mainStatus = await shell(
    'git -C "$PI_MAIN_PATH" status --porcelain',
    options,
  );
  if (mainStatus.exitCode !== 0)
    return fail([shellFailure("main status", mainStatus)]);
  if (mainStatus.stdout.trim()) return fail(["Main working tree is not clean"]);

  const mainHead = await shell(
    'git -C "$PI_MAIN_PATH" rev-parse --verify HEAD',
    options,
  );
  if (mainHead.exitCode !== 0)
    return fail([shellFailure("main HEAD", mainHead)]);
  if (mainHead.stdout.trim() !== prepared.mainHead)
    return fail(["Main HEAD changed after integration review"]);

  stage = "master-worktree";
  const worktreeStatus = await shell(
    'git -C "$PI_WORKTREE_PATH" status --porcelain',
    options,
  );
  if (worktreeStatus.exitCode !== 0)
    return fail([shellFailure("issue worktree status", worktreeStatus)]);
  if (worktreeStatus.stdout.trim())
    return fail(["Issue worktree is dirty after integration review"]);

  const branchHead = await shell(
    'git -C "$PI_WORKTREE_PATH" rev-parse --verify "$PI_WORKTREE_BRANCH"',
    options,
  );
  if (branchHead.exitCode !== 0)
    return fail([shellFailure("reviewed branch HEAD", branchHead)]);
  if (branchHead.stdout.trim() !== prepared.reviewedHead)
    return fail(["Reviewed branch HEAD changed after integration review"]);

  stage = "master-fast-forward";
  const ancestry = await shell(
    'git -C "$PI_MAIN_PATH" merge-base --is-ancestor "$PI_MAIN_HEAD" "$PI_REVIEWED_HEAD"',
    options,
  );
  if (ancestry.exitCode !== 0)
    return fail([shellFailure("reviewed branch ancestry", ancestry)]);
  const fastForward = await shell(
    'git -C "$PI_MAIN_PATH" merge --ff-only "$PI_REVIEWED_HEAD"',
    options,
  );
  if (fastForward.exitCode !== 0)
    return fail([shellFailure("fast-forward", fastForward)]);

  return {
    ...prepared,
    status: "integrated",
    stage: "fast-forward",
  };
}

function shellFailure(name: string, result: ShellResult): string {
  const detail =
    result.stderr || result.stdout || `git exited ${String(result.exitCode)}`;
  return `${name}: ${detail.trim()}`;
}

async function cleanupMergedWorktrees(
  shell: WorkflowFunctionContext["shell"],
  mainPath: string,
  references: readonly WorkflowWorktreeReference[],
): Promise<WorktreeCleanup> {
  const cleanup: WorktreeCleanup = { removed: [], skipped: [], failed: [] };

  for (const reference of references) {
    const name = reference.branch;
    const options = {
      env: {
        PI_MAIN_PATH: mainPath,
        PI_WORKTREE_BRANCH: reference.branch,
        PI_WORKTREE_PATH: reference.path,
      },
    };
    const ancestry = await shell(
      'git -C "$PI_MAIN_PATH" merge-base --is-ancestor "$PI_WORKTREE_BRANCH" HEAD',
      options,
    );

    if (ancestry.exitCode === 1) {
      cleanup.skipped.push(`${name}: not merged`);
      continue;
    }
    if (ancestry.exitCode !== 0) {
      cleanup.failed.push(shellFailure(name, ancestry));
      continue;
    }

    const status = await shell(
      'git -C "$PI_WORKTREE_PATH" status --porcelain',
      options,
    );
    if (status.exitCode !== 0) {
      cleanup.failed.push(shellFailure(name, status));
      continue;
    }
    if (status.stdout.trim()) {
      cleanup.skipped.push(`${name}: dirty`);
      continue;
    }

    const removal = await shell(
      'git worktree remove "$PI_WORKTREE_PATH"',
      options,
    );
    if (removal.exitCode === 0) cleanup.removed.push(name);
    else cleanup.failed.push(shellFailure(name, removal));
  }

  return cleanup;
}

function issueTask(issue: IssueDetail): string {
  return `Resolve issue #${issue.number} in the current repository. The final commit should reference the issue.
Issue details:
<issue_number>${issue.number}</issue_number>
<issue_title>${issue.title}</issue_title>
<issue_content>${issue.content}</issue_content>
<issue_comments>${JSON.stringify(issue.comments, null, 2)}</issue_comments>`;
}
