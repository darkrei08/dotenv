#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DEFAULT_RESERVE = 16_384;
const DEFAULT_KEEP_RECENT = 20_000;
const ROLE_RULES = {
  scout: { contextWindow: 200_000, maxTokens: 16_000 },
  developer: { contextWindow: 200_000, maxTokens: 32_000 },
  "tests-expert": { contextWindow: 200_000, maxTokens: 32_000 },
  reviewer: { contextWindow: 200_000, maxTokens: 32_000 },
  oracle: { contextWindow: 200_000, maxTokens: 32_000 },
  researcher: { contextWindow: 272_000, maxTokens: 32_000 },
  architect: { contextWindow: 200_000, maxTokens: 32_000 },
  security: { contextWindow: 200_000, maxTokens: 32_000 },
  sre: { contextWindow: 200_000, maxTokens: 32_000 },
  release: { contextWindow: 200_000, maxTokens: 32_000 },
  summarizer: { contextWindow: 128_000, maxTokens: 8_000 },
};

function usage() {
  console.error("Usage: pi-token-budget.mjs [--json] [--strict] [--root PATH]");
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }
}

function splitModelRef(value) {
  const match = value.match(/^(.*):([^:]+)$/);
  return match ? { model: match[1], effort: match[2] } : { model: value, effort: null };
}

function resolveAlias(value, aliases) {
  let current = value;
  let effort = null;
  for (let depth = 0; depth <= 10; depth += 1) {
    const split = splitModelRef(current);
    effort ??= split.effort;
    if (!aliases[split.model]) return { model: split.model, effort };
    current = aliases[split.model];
  }
  throw new Error(`model alias chain exceeds 10 steps: ${value}`);
}

function catalogModels(modelsConfig) {
  const models = new Map();
  for (const [provider, config] of Object.entries(modelsConfig.providers ?? {})) {
    for (const model of config.models ?? []) {
      models.set(`${provider}/${model.id}`, {
        contextWindow: Number(model.contextWindow) || 0,
        maxTokens: Number(model.maxTokens) || 0,
      });
    }
  }
  return models;
}

function reserveFor(contextWindow, percent, maxTokens) {
  return Math.max(DEFAULT_RESERVE, maxTokens, contextWindow - Math.floor(contextWindow * percent));
}

function evaluateModel(model, requirements) {
  if (!model) return { status: "unverified", reasons: ["model is not in the tracked catalog"] };
  const reasons = [];
  if (model.contextWindow < requirements.contextWindow) reasons.push(`contextWindow ${model.contextWindow} < ${requirements.contextWindow}`);
  if (model.maxTokens < requirements.maxTokens) reasons.push(`maxTokens ${model.maxTokens} < ${requirements.maxTokens}`);
  return { status: reasons.length === 0 ? "pass" : "fail", reasons };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const rootOption = args.findIndex((arg) => arg === "--root");
  const rootArg = rootOption >= 0 ? args[rootOption + 1] : args.find((arg) => arg.startsWith("--root="))?.slice("--root=".length);
  if (rootOption >= 0 && !rootArg) throw new Error("--root requires a path");
  const root = resolve(rootArg ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"));
  const [settings, modelsConfig, rolesConfig] = await Promise.all([
    readJson(join(root, "settings.json")),
    readJson(join(root, "models.json")),
    readJson(join(root, "pi-ext-roles", "settings.json")),
  ]);

  const reserveTokens = Number(settings.compaction?.reserveTokens ?? DEFAULT_RESERVE);
  const keepRecentTokens = Number(settings.compaction?.keepRecentTokens ?? DEFAULT_KEEP_RECENT);
  const catalog = catalogModels(modelsConfig);
  const roles = {};
  const warnings = [];
  for (const role of Object.keys(ROLE_RULES)) {
    const configured = rolesConfig.modelAliases?.[`${role}-model`] ?? rolesConfig.modelAliases?.[role];
    if (!configured) {
      warnings.push(`${role}: no configured alias`);
      continue;
    }
    const resolved = resolveAlias(configured, rolesConfig.modelAliases ?? {});
    const requirements = ROLE_RULES[role];
    const model = catalog.get(resolved.model);
    const evaluation = evaluateModel(model, requirements);
    roles[role] = {
      configured,
      model: resolved.model,
      effort: resolved.effort,
      contextWindow: model?.contextWindow ?? null,
      maxTokens: model?.maxTokens ?? null,
      requirements,
      ...evaluation,
    };
    if (evaluation.status === "unverified") warnings.push(`${role}: ${resolved.model} is gateway-dynamic`);
    if (evaluation.status === "fail") warnings.push(`${role}: ${evaluation.reasons.join("; ")}`);
  }

  const result = {
    root,
    policy: {
      trigger: "contextTokens > contextWindow - reserveTokens",
      defaultReserveTokens: DEFAULT_RESERVE,
      defaultKeepRecentTokens: DEFAULT_KEEP_RECENT,
      reserveFloor: "max(maxTokens, 16384)",
      toolHeavyTriggerTarget: "80-85%",
      gatewayCatalogIsAuthoritative: true,
    },
    compaction: {
      enabled: settings.compaction?.enabled === true,
      reserveTokens,
      keepRecentTokens,
      reserveFloorPass: reserveTokens >= DEFAULT_RESERVE,
    },
    staticModels: [...catalog.entries()].map(([id, model]) => ({
      id,
      ...model,
      reserve80: reserveFor(model.contextWindow, 0.8, model.maxTokens),
      reserve85: reserveFor(model.contextWindow, 0.85, model.maxTokens),
    })),
    roles,
    warnings,
  };
  const hardFailures = [
    !result.compaction.enabled && "compaction is disabled",
    !result.compaction.reserveFloorPass && `reserveTokens ${reserveTokens} < ${DEFAULT_RESERVE}`,
    ...Object.values(roles).filter((role) => role.status === "fail").map((role) => `${role.model}: ${role.reasons.join("; ")}`),
  ].filter(Boolean);
  result.status = hardFailures.length > 0 ? "fail" : strict && warnings.length > 0 ? "unverified" : "pass";
  result.failures = hardFailures;

  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Token budget: ${result.status}`);
    console.log(`Compaction: ${result.compaction.enabled ? "enabled" : "disabled"}, reserve=${reserveTokens}, keepRecent=${keepRecentTokens}`);
    for (const [role, evaluation] of Object.entries(roles)) {
      console.log(`${role}: ${evaluation.model} ${evaluation.status}`);
    }
    for (const warning of warnings) console.log(`WARN: ${warning}`);
  }
  if (result.status === "fail" || result.status === "unverified") process.exitCode = result.status === "fail" ? 1 : 3;
}

main().catch((error) => {
  console.error(`pi-token-budget: ${error.message}`);
  process.exitCode = 1;
});
