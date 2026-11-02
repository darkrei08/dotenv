import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";
import {
  defineWorkflowFunction,
  registerWorkflowExtension,
  type WorkflowExtension,
} from "pi-extensible-workflows";

const DEFAULT_AGENT_DIR = join(homedir(), ".pi", "agent");
const EFFORTS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
const PROVIDER_ERROR = /429|quota|rate limit|rate_limit|usage limit|resource_exhausted|too many requests|model_cooldown|unknown model|AGENT_FAILED/i;

type JsonObject = Record<string, unknown>;

function cannotResolve(path: string, reason: string): never {
  throw new Error(`cannot resolve role chain: ${path} ${reason}`);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    cannotResolve(path, error instanceof Error ? error.message : String(error));
  }
}

function object(value: unknown, path: string, reason: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    cannotResolve(path, reason);
  return value as JsonObject;
}

function modelParts(model: string): { base: string; effort?: string } {
  const suffix = model.lastIndexOf(":");
  if (suffix > model.lastIndexOf("/") && EFFORTS.has(model.slice(suffix + 1)))
    return { base: model.slice(0, suffix), effort: model.slice(suffix + 1) };
  return { base: model };
}

function deduplicate(models: string[]): string[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const base = modelParts(model).base;
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

export function resolveRoleChain(
  role: string,
  agentDir = process.env.PI_CODING_AGENT_DIR ?? DEFAULT_AGENT_DIR,
): string[] {
  const rolesPath = join(agentDir, "pi-ext-roles", "settings.json");
  const roleGroupsPath = join(agentDir, "pi-ha-role-groups.json");
  const haPath = join(agentDir, "ha.json");
  const settings = object(readJson(rolesPath), rolesPath, "expected an object");
  const modelAliases = object(settings.modelAliases, rolesPath, "missing modelAliases");
  const knownRoles = Object.keys(modelAliases)
    .filter((name) => name.endsWith("-model"))
    .map((name) => name.slice(0, -6))
    .sort();
  const aliasKey = `${role}-model`;
  if (!Object.prototype.hasOwnProperty.call(modelAliases, aliasKey))
    throw new Error(`unknown role: ${role} (known roles: ${knownRoles.join(", ")})`);
  const alias = modelAliases[aliasKey];
  if (typeof alias !== "string" || !alias.trim())
    cannotResolve(rolesPath, `model alias ${aliasKey} is malformed`);

  const roleGroups = object(readJson(roleGroupsPath), roleGroupsPath, "expected an object");
  const roleGroupMap = object(roleGroups.roleGroups, roleGroupsPath, "missing roleGroups");
  const groupName = roleGroupMap[role];
  if (typeof groupName !== "string" || !groupName.trim())
    cannotResolve(roleGroupsPath, `missing role group for ${role}`);

  const ha = object(readJson(haPath), haPath, "expected an object");
  const groups = object(ha.groups, haPath, "missing groups");
  const group = object(groups[groupName], haPath, `missing group ${groupName}`);
  if (!Array.isArray(group.entries)) cannotResolve(haPath, `group ${groupName} has malformed entries`);

  const primary = alias.trim();
  const primaryEffort = modelParts(primary).effort;
  const chain = [primary];
  for (const [index, entryValue] of group.entries.entries()) {
    const entry = object(entryValue, haPath, `group ${groupName} entry ${index} is malformed`);
    if (typeof entry.id !== "string" || !entry.id.trim())
      cannotResolve(haPath, `group ${groupName} entry ${index} is missing id`);
    const id = entry.id.trim();
    const entryEffort = modelParts(id).effort;
    chain.push(entryEffort || !primaryEffort ? id : `${id}:${primaryEffort}`);
  }
  return deduplicate(chain);
}

export const agentWithFailover = defineWorkflowFunction({
  description: "Run an agent task against ordered models with provider-error failover",
  async run({ models, role, task, label }, { agent }) {
    if (models === undefined && role === undefined)
      throw new Error("agentWithFailover requires at least one of role or models");
    const roleChain = role === undefined ? [] : resolveRoleChain(role);
    const modelChain = role === undefined ? models! : deduplicate([...(models ?? []), ...roleChain]);
    const attempts: Array<{ model: string; error: string }> = [];

    for (const model of modelChain) {
      try {
        //NOTE: retries: 0 avoids replaying an exhausted model; models already carry the alias or provider/model:effort, and only explicit provider markers, including AGENT_FAILED, continue while other errors rethrow so agent bugs are not masked.
        const result = await agent(task, { model, label, retries: 0 });
        return { model, result, attempts };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!PROVIDER_ERROR.test(message)) throw error;
        attempts.push({ model, error: message.slice(0, 300) });
      }
    }

    throw new Error(
      `all failover models failed: ${attempts.map(({ model, error }) => `${model}: ${error}`).join(" | ")}`,
    );
  },
  input: Type.Union([
    Type.Object(
      {
        models: Type.Array(Type.String(), { minItems: 1 }),
        role: Type.Optional(Type.String({ minLength: 1 })),
        task: Type.String(),
        label: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        models: Type.Optional(Type.Array(Type.String(), { minItems: 1 })),
        role: Type.String({ minLength: 1 }),
        task: Type.String(),
        label: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  ]),
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
