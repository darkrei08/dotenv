import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const DEFAULT_REFRESH_MS = 15 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 35 * 1000;

export function routeKey(model) {
  const provider = model?.provider;
  const id = model?.modelId ?? model?.id;
  if (!provider || !id) return null;
  return String(id).replace(/:([A-Za-z][A-Za-z0-9_-]*)$/, "")
    ? `${provider}/${String(id).replace(/:([A-Za-z][A-Za-z0-9_-]*)$/, "")}`
    : null;
}

export function isFresh(report, now = Date.now()) {
  return Number.isFinite(Date.parse(report?.expiresAt ?? "")) && Date.parse(report.expiresAt) > now;
}

export function findGroupForRoute(report, currentRoute) {
  if (!currentRoute) return null;
  for (const [groupId, group] of Object.entries(report?.matrix ?? {})) {
    if ((group.entries ?? []).some((entry) => entry.id === currentRoute)) return groupId;
  }
  return null;
}

export function isReady(report, groupId) {
  return report?.probe?.status === "ok" && groupId != null && report.matrix?.[groupId]?.state === "ready";
}

export function chooseFallback(report, currentRoute, groupId = findGroupForRoute(report, currentRoute)) {
  if (!isReady(report, groupId)) return null;
  const group = report.matrix[groupId];
  const current = (group.entries ?? []).find((entry) => entry.id === currentRoute);
  if (!current || current.state === "reachable") return null;
  return group.selected?.state === "reachable" ? group.selected : null;
}

export function parsePreflightOutput(stdout) {
  let value;
  try {
    value = JSON.parse(String(stdout ?? "").trim());
  } catch (error) {
    throw new Error(`invalid model preflight output: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
  if (!value || typeof value !== "object" || !value.probe || !value.matrix) {
    throw new Error("invalid model preflight output");
  }
  return value;
}

function scriptPath(env = process.env) {
  const candidates = [
    env.PI_MODEL_PREFLIGHT_SCRIPT,
    env.PI_MODEL_FIT_ROOT && join(env.PI_MODEL_FIT_ROOT, "scripts", "preflight.mjs"),
    join(env.HOME ?? homedir(), ".agents", "skills", "pi-model-fit", "scripts", "preflight.mjs"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export async function runPreflightCommand({
  env = process.env,
  refresh = false,
  execImpl = execFile,
} = {}) {
  const script = scriptPath(env);
  if (!script || !existsSync(script)) throw new Error("pi-model-fit preflight script is unavailable");
  const cache = env.PI_MODEL_PREFLIGHT_CACHE ?? join(env.XDG_CACHE_HOME ?? join(env.HOME ?? homedir(), ".cache"), "pi-model-fit", "preflight.json");
  const args = [script, "--json"];
  if (refresh) args.push("--refresh");
  args.push("--cache", cache);
  if (env.PI_MODEL_PREFLIGHT_HA_CONFIG) args.push("--ha-config", env.PI_MODEL_PREFLIGHT_HA_CONFIG);
  const result = await execImpl("node", args, {
    encoding: "utf8",
    timeout: Number(env.PI_MODEL_PREFLIGHT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
    env,
  });
  return parsePreflightOutput(result.stdout ?? result);
}

function statusMessage(report) {
  const groups = Object.values(report?.matrix ?? {});
  const ready = groups.filter((group) => group?.state === "ready").length;
  return `Model preflight: ${report?.probe?.status ?? "unknown"}; ${report?.probe?.modelCount ?? 0} models; ${ready}/${groups.length} ready failover groups`;
}

export default function modelPreflight(pi, options = {}) {
  const runCommand = options.runCommand ?? runPreflightCommand;
  const now = options.now ?? (() => Date.now());
  let report = null;
  let refreshPromise = null;
  let timer = null;

  const refresh = async (force = false) => {
    if (!refreshPromise) {
      refreshPromise = runCommand({ refresh: force })
        .then((value) => { report = value; return value; })
        .finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  };

  const applyFallback = async (ctx, currentRoute, groupId) => {
    const fallback = chooseFallback(report, currentRoute, groupId);
    if (!fallback) return false;
    const model = ctx.modelRegistry?.find?.(fallback.provider, fallback.model);
    if (!model) throw new Error(`model preflight selected an unavailable registry route: ${fallback.id}`);
    if (!(await pi.setModel(model))) throw new Error(`model preflight could not select fallback route: ${fallback.id}`);
    if (fallback.effort) pi.setThinkingLevel(fallback.effort);
    return true;
  };

  pi.registerCommand("model-preflight", {
    description: "Refresh and show the redacted model availability matrix",
    handler: async (_args, ctx) => {
      try {
        const value = await refresh(true);
        ctx.ui.notify(statusMessage(value), value.probe.status === "ok" ? "info" : "warning");
      } catch (error) {
        ctx.ui.notify(`Model preflight blocked: ${error instanceof Error ? error.message : "unavailable"}`, "error");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    try {
      const value = await refresh(true);
      ctx.ui.notify(statusMessage(value), value.probe.status === "ok" ? "info" : "warning");
    } catch (error) {
      report = null;
      ctx.ui.notify(`Model preflight blocked: ${error instanceof Error ? error.message : "unavailable"}`, "error");
    }
    const refreshMs = Math.max(60_000, Number(process.env.PI_MODEL_PREFLIGHT_REFRESH_MS ?? DEFAULT_REFRESH_MS));
    timer = setInterval(() => { refresh(false).catch(() => { report = null; }); }, refreshMs);
    timer.unref?.();
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    if (!report || !isFresh(report, now())) {
      report = null;
      try { await refresh(true); } catch (error) { throw new Error(`model preflight unavailable: ${error instanceof Error ? error.message : "unknown error"}`); }
    }
    const currentRoute = routeKey(ctx.model);
    const groupId = findGroupForRoute(report, currentRoute);
    if (!groupId) throw new Error(`model preflight blocked: ${currentRoute ?? "current model"} is not bound to a failover group`);
    if (!isReady(report, groupId)) throw new Error(`model preflight blocked: ${groupId} evidence is stale, unknown, or has no reachable fallback`);
    const current = report.matrix[groupId].entries.find((entry) => entry.id === currentRoute);
    if (current?.state !== "reachable" && !(await applyFallback(ctx, currentRoute, groupId))) {
      throw new Error(`model preflight blocked: no reachable fallback for ${currentRoute}`);
    }
  });

  pi.on("session_shutdown", () => {
    if (timer) clearInterval(timer);
    timer = null;
  });
}
