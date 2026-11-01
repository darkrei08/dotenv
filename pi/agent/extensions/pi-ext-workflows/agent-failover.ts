import { Type } from "typebox";
import {
  defineWorkflowFunction,
  registerWorkflowExtension,
  type WorkflowExtension,
} from "pi-extensible-workflows";

export const agentWithFailover = defineWorkflowFunction({
  description: "Run an agent task against ordered models with provider-error failover",
  async run({ models, task, label }, { agent }) {
    const attempts: Array<{ model: string; error: string }> = [];

    for (const model of models) {
      try {
        //NOTE: retries: 0 avoids replaying an exhausted model; models already carry the alias or provider/model:effort, and only explicit provider markers, including AGENT_FAILED, continue while other errors rethrow so agent bugs are not masked.
        const result = await agent(task, { model, label, retries: 0 });
        return { model, result, attempts };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/429|quota|rate limit|rate_limit|usage limit|resource_exhausted|too many requests|model_cooldown|unknown model|AGENT_FAILED/i.test(message))
          throw error;
        attempts.push({ model, error: message.slice(0, 300) });
      }
    }

    throw new Error(
      `all failover models failed: ${attempts.map(({ model, error }) => `${model}: ${error}`).join(" | ")}`,
    );
  },
  input: Type.Object(
    {
      models: Type.Array(Type.String(), { minItems: 1 }),
      task: Type.String(),
      label: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  output: Type.Object(
    {
      model: Type.String(),
      result: Type.Any(),
      attempts: Type.Array(
        Type.Object(
          { model: Type.String(), error: Type.String() },
          { additionalProperties: false },
        ),
      ),
    },
    { additionalProperties: false },
  ),
});

const extension: WorkflowExtension = {
  source: import.meta.url,
  dependencies: ["typebox"],
  version: "1.0.0",
  headline: "Ordered model failover for workflow agents",
  functions: { agentWithFailover },
};

export default function (): void {
  registerWorkflowExtension(extension);
}
