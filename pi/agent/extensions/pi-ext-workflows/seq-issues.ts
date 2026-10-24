import { Type, type Static } from "typebox";
import { Value } from "typebox/value";
import {
  defineWorkflowFunction,
  registerWorkflowExtension,
  type WorkflowExtension,
} from "pi-extensible-workflows";
import {
  fetchIssueDetailsInputSchema,
  fetchIssueDetailsOutputSchema,
} from "./fetch-issue-details.js";
import {
  developIssues,
  developIssuesOutputSchema,
  integrateReviewedIssues,
  integrateReviewedIssuesOutputSchema,
} from "./develop-issues.js";
import { reviewLoopInputSchema } from "./review-loop.js";

const masterNarrativeSchema = Type.Object(
  { summary: Type.String() },
  { additionalProperties: false },
);

export const masterSummarySchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("completed"),
      Type.Literal("partial"),
      Type.Literal("failed"),
    ]),
    totalIssues: Type.Integer({ minimum: 0 }),
    integratedIssues: Type.Integer({ minimum: 0 }),
    notApprovedIssues: Type.Integer({ minimum: 0 }),
    failedIssues: Type.Integer({ minimum: 0 }),
    batchCount: Type.Integer({ minimum: 0 }),
    summary: Type.String(),
  },
  { additionalProperties: false },
);

const batchResultSchema = Type.Object(
  {
    issues: developIssuesOutputSchema.properties.issues,
    issueResults: developIssuesOutputSchema.properties.issueResults,
    integrationOrder: developIssuesOutputSchema.properties.integrationOrder,
    summary: developIssuesOutputSchema.properties.summary,
    cleanup: integrateReviewedIssuesOutputSchema.properties.cleanup,
  },
  { additionalProperties: false },
);

export const devIssuesInBatches = defineWorkflowFunction({
  description:
    "Analyze issue dependencies and invoke parallel issue development once per sequential batch",
  async run({ issues, maxIterations = 5 }, context) {
    const { agent, invoke, log, phase, prompt } = context;

    phase("fetch");
    const fetched = await invoke("fetchIssueDetails", { issues });
    if (!Value.Check(fetchIssueDetailsOutputSchema, fetched))
      throw new Error("fetchIssueDetails returned an unexpected result");
    const issueDetails = fetched.issueDetails;

    const batchPlanSchema = Type.Object(
      {
        batches: Type.Array(
          Type.Array(Type.Integer({ minimum: 1 }), { minItems: 1 }),
          { minItems: 1 },
        ),
      },
      { additionalProperties: false },
    );
    const plan = await agent(
      prompt(
        `Analyze these issue details and group issues into dependency batches. Issues in the same batch can be developed in parallel. Later batches depend on earlier batches, so put a prerequisite issue in an earlier batch than any issue that depends on it. Include every requested issue exactly once and do not invent issues.

Issue details:
{issueDetails}`,
        { issueDetails },
      ),
      { role: "architect", tools: [], outputSchema: batchPlanSchema },
    );
    validateBatches(plan.batches, issues);

    const detailsByNumber = new Map(
      issueDetails.map((issue) => [issue.number, issue]),
    );
    const batchResults: Static<typeof batchResultSchema>[] = [];
    for (const [index, batch] of plan.batches.entries()) {
      phase(`batch-${index + 1}`);
      log(`Developing batch ${index + 1}/${plan.batches.length}`);
      const batchDetails = batch.map((issue) => {
        const detail = detailsByNumber.get(issue);
        if (!detail)
          throw new Error(
            `Missing fetched details for issue #${String(issue)}`,
          );
        return detail;
      });
      const batchResult = await developIssues.run(
        { issueDetails: batchDetails, maxIterations },
        context,
      );
      const integrated = await invoke("integrateReviewedIssues", {
        issueResults: batchResult.issueResults,
        integrationOrder: batchResult.integrationOrder,
        issueDetails: batchDetails,
        maxIterations,
      });
      if (!Value.Check(integrateReviewedIssuesOutputSchema, integrated))
        throw new Error(
          "integrateReviewedIssues returned an unexpected result",
        );
      batchResults.push({
        ...batchResult,
        issueResults: integrated.issueResults,
        cleanup: integrated.cleanup,
      });
    }

    phase("master-summary");
    const issueResults = batchResults.flatMap((batchResult) =>
      Object.values(batchResult.issueResults),
    );
    const integratedIssues = issueResults.filter(
      (result) => result.integration.status === "integrated",
    ).length;
    const notApprovedIssues = issueResults.filter(
      (result) => result.integration.status === "not-approved",
    ).length;
    const failedIssues = issueResults.filter(
      (result) => result.integration.status === "failed",
    ).length;
    const cleanupIncomplete = batchResults.some(
      (batchResult) =>
        batchResult.cleanup.failed.length > 0 ||
        batchResult.cleanup.skipped.length > 0,
    );
    const status = cleanupIncomplete || failedIssues > 0
      ? "failed"
      : notApprovedIssues > 0 || integratedIssues !== issues.length
        ? "partial"
        : "completed";
    const narrative = await agent(
      prompt(
        `You are the master architect. Summarize the completed sequential issue batches into one parent result. Do not change files. Mention the status, integrated issues, not-approved issues, failed issues, and any remaining findings.\n\nIssues:\n{issues}\n\nBatches:\n{batches}\n\nChild results:\n{batchResults}`,
        { issues, batches: plan.batches, batchResults },
      ),
      { role: "architect", tools: [], outputSchema: masterNarrativeSchema },
    );
    if (!Value.Check(masterNarrativeSchema, narrative))
      throw new Error("Master architect returned an unexpected summary");

    const masterSummary = {
      status,
      totalIssues: issues.length,
      integratedIssues,
      notApprovedIssues,
      failedIssues,
      batchCount: plan.batches.length,
      summary: narrative.summary,
    };
    if (!Value.Check(masterSummarySchema, masterSummary))
      throw new Error("Master result failed schema validation");

    return { issues, batches: plan.batches, batchResults, masterSummary };
  },
  input: Type.Object(
    {
      issues: fetchIssueDetailsInputSchema.properties.issues,
      maxIterations: reviewLoopInputSchema.properties.maxIterations,
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    {
      issues: Type.Array(Type.Integer()),
      batches: Type.Array(Type.Array(Type.Integer())),
      batchResults: Type.Array(batchResultSchema),
      masterSummary: masterSummarySchema,
    },
    { additionalProperties: false },
  ),
});

export const seqIssuesOutputSchema = devIssuesInBatches.output;

const extension: WorkflowExtension = {
  version: "1.0.0",
  headline: "Batch issue development",
  functions: { devIssuesInBatches, integrateReviewedIssues },
};

export default function (): void {
  registerWorkflowExtension(extension);
}

function validateBatches(batches: number[][], issues: number[]): void {
  const flattened = batches.flat();
  const expected = new Set(issues);
  if (
    flattened.length !== issues.length ||
    new Set(flattened).size !== issues.length ||
    flattened.some((issue) => !expected.has(issue))
  )
    throw new Error(
      `Agent returned an invalid issue batch plan: ${JSON.stringify(batches)}`,
    );
}
