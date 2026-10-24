import { Type } from "typebox";
import {
  defineWorkflowFunction,
  registerWorkflowExtension,
  type WorkflowExtension,
} from "pi-extensible-workflows";

/**
 * parallelReviewAndSecurity — runs code and security analysis in parallel,
 * applies the findings with the developer role, then synthesises a verdict with
 * the architect role.
 *
 * Roles used: architect, reviewer, security (all canonical).
 */
export const parallelReviewAndSecurity = defineWorkflowFunction({
  description:
    "Run parallel code review and security analysis, then synthesise a verdict",
  async run({ target, context: ctx = "" }, { agent, parallel, prompt, phase }) {
    phase("parallel-analysis");

    const reviewPrompt = prompt(
      `You are a code reviewer. Review the following for correctness, style, and maintainability.
Target: {target}
{context}
Return your findings as a concise list.`,
      { target, context: ctx },
    );

    const securityPrompt = prompt(
      `You are a security analyst. Audit the following for vulnerabilities, unsafe patterns, and attack surface.
Target: {target}
{context}
Return your findings as a concise list.`,
      { target, context: ctx },
    );

    const { review, security } = await parallel("analysis", {
      review: () => agent(reviewPrompt, { role: "reviewer" }),
      security: () => agent(securityPrompt, { role: "security" }),
    });

    phase("fix");
    const fix = await agent(
      prompt(
        `You are the developer. Address the actionable findings in the current target.
Make the smallest safe changes needed for critical and high-severity issues, then report what you changed.
<review>{review}</review>
<security>{security}</security>`,
        { review, security },
      ),
      { role: "developer" },
    );

    phase("verdict");
    const verdict = await agent(
      prompt(
        `You are the architect. Synthesise the parallel findings and developer result into a single verdict.
State which findings are critical, which are minor, what was fixed, and what remains.
<review>{review}</review>
<security>{security}</security>
<fix>{fix}</fix>`,
        { review, security, fix },
      ),
      { role: "architect", tools: [] },
    );

    return { review, security, fix, verdict };
  },
  input: Type.Object(
    {
      target: Type.String({ description: "Scope to review: path, branch, or description" }),
      context: Type.Optional(Type.String({ description: "Additional context for reviewers" })),
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    {
      review: Type.Any(),
      security: Type.Any(),
      fix: Type.Any(),
      verdict: Type.Any(),
    },
    { additionalProperties: false },
  ),
});

const extension: WorkflowExtension = {
  version: "1.0.0",
  headline: "Parallel review and security analysis",
  functions: { parallelReviewAndSecurity },
};

export default function (): void {
  registerWorkflowExtension(extension);
}
