import { execFile as execFileCallback } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
export const DEFAULT_REFRESH_MS = 15 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 35 * 1000;
const MAX_TIMEOUT_MS = 5 * 60 * 1000;
const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
export const DEFAULT_HA_CONFIG_PATH = join(homedir(), ".pi", "agent", "ha.json");
const CONFIG_LOCK_OPTIONS = {
  retries: { retries: 10, factor: 2, minTimeout: 100, maxTimeout: 10_000, randomize: true },
  stale: 30_000,
  realpath: false,
};

export function normalizeRouteId(value) {
  return String(value ?? "").replace(/:(off|minimal|low|medium|high|xhigh|max)$/, "");
}

export function routeKey(model) {
  const provider = model?.provider;
  const id = model?.modelId ?? model?.id;
  if (!provider || !id) return null;
  return `${provider}/${normalizeRouteId(id)}`;
}

export function isFresh(report, now = Date.now()) {
  return Number.isFinite(Date.parse(report?.expiresAt ?? "")) && Date.parse(report.expiresAt) > now;
}

function isUsableReport(report, now) {
  return isFresh(report, now) && report?.probe?.status === "ok";
}

export function getRefreshIntervalMs(value = process.env.PI_MODEL_PREFLIGHT_REFRESH_MS) {
  const parsed = Number(value ?? DEFAULT_REFRESH_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_REFRESH_MS;
  return Math.max(60_000, parsed);
}

export function getTimeoutMs(value = process.env.PI_MODEL_PREFLIGHT_TIMEOUT_MS) {
  const parsed = Number(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, parsed);
}

function routeEntryId(entry) {
  return entry?.id ?? entry?.route;
}

export function findGroupForRoute(report, currentRoute) {
  if (!currentRoute) return null;
  for (const [groupId, group] of Object.entries(report?.matrix ?? {})) {
    if ((group.entries ?? []).some((entry) => normalizeRouteId(routeEntryId(entry)) === currentRoute)) return groupId;
  }
  return null;
}

export function isReady(report, groupId) {
  return report?.probe?.status === "ok" && groupId != null && report.matrix?.[groupId]?.state === "ready";
}

export function chooseFallback(report, currentRoute, groupId = findGroupForRoute(report, currentRoute)) {
  if (!isReady(report, groupId)) return null;
  const group = report.matrix[groupId];
  const current = (group.entries ?? []).find((entry) => normalizeRouteId(routeEntryId(entry)) === currentRoute);
  if (!current || current.state === "reachable") return null;
  return group.selected?.state === "reachable" ? group.selected : null;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRouteEntry(value) {
  return isRecord(value) &&
    typeof value.route === "string" &&
    (value.id == null || typeof value.id === "string") &&
    typeof value.state === "string" &&
    (value.effort == null || THINKING_LEVELS.has(value.effort));
}

export function parsePreflightOutput(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) throw new Error("invalid model preflight output: empty output");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("invalid model preflight output: malformed JSON");
  }
  if (!isRecord(value) || !isRecord(value.probe) || typeof value.probe.status !== "string" || !isRecord(value.matrix)) {
    throw new Error("invalid model preflight output");
  }
  for (const group of Object.values(value.matrix)) {
    if (!isRecord(group) || typeof group.state !== "string" || !Array.isArray(group.entries) || !group.entries.every(isRouteEntry)) {
      throw new Error("invalid model preflight output: invalid failover route");
    }
    if (group.selected !== undefined && (!isRouteEntry(group.selected) || typeof group.selected.provider !== "string" || typeof group.selected.model !== "string")) {
      throw new Error("invalid model preflight output: invalid selected route");
    }
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
  let resolvedScript;
  try {
    resolvedScript = realpathSync(script);
    if (!statSync(resolvedScript).isFile()) throw new Error("not a regular file");
  } catch {
    throw new Error("pi-model-fit preflight script is unavailable");
  }
  const cache = env.PI_MODEL_PREFLIGHT_CACHE ?? join(env.XDG_CACHE_HOME ?? join(env.HOME ?? homedir(), ".cache"), "pi-model-fit", "preflight.json");
  // Resolve the real path so process.argv[1] matches import.meta.url even when the script is a symlink.
  const args = [resolvedScript, "--json"];
  if (refresh) args.push("--refresh");
  args.push("--cache", cache);
  args.push("--ha-config", env.PI_MODEL_PREFLIGHT_HA_CONFIG ?? DEFAULT_HA_CONFIG_PATH);
  const result = await execImpl("node", args, {
    encoding: "utf8",
    timeout: getTimeoutMs(env.PI_MODEL_PREFLIGHT_TIMEOUT_MS),
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
    env,
  });
  const stdout = typeof result === "string" ? result : result?.stdout;
  return parsePreflightOutput(stdout ?? "");
}

export function applyMatrixToConfig(config, report) {
  if (report?.probe?.status !== "ok") throw new Error("cannot apply an unknown model matrix");
  const matrix = report.matrix ?? {};
  if (Object.keys(matrix).length === 0) throw new Error("cannot apply an empty model matrix");
  const groups = { ...(config.groups ?? {}) };
  for (const [groupId, group] of Object.entries(matrix)) {
    if (group?.state !== "ready") throw new Error(`cannot apply blocked failover group: ${groupId}`);
    const entries = (group.entries ?? [])
      .filter((entry) => entry.state === "reachable" && entry.route)
      .map((entry) => ({ id: entry.route }));
    if (entries.length === 0) throw new Error(`cannot apply failover group without reachable routes: ${groupId}`);
    groups[groupId] = {
      ...(config.groups?.[groupId] ?? {}),
      name: group.name ?? config.groups?.[groupId]?.name ?? groupId,
      entries,
    };
  }
  return { ...config, groups };
}

async function loadLockfile(lockImpl) {
  if (lockImpl) return lockImpl;
  try {
    const module = await import("proper-lockfile");
    return module.default ?? module;
  } catch {
    throw new Error("proper-lockfile is unavailable; refusing to modify the HA config");
  }
}

function writeAtomicFile(path, content, mode, randomBytesImpl = randomBytes) {
  const temporaryPath = `${path}.${randomBytesImpl(6).toString("hex")}.tmp`;
  let fd;
  let temporaryCreated = false;
  try {
    fd = openSync(temporaryPath, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 0o600);
    temporaryCreated = true;
    try {
      writeFileSync(fd, content, { encoding: "utf8" });
    } finally {
      closeSync(fd);
      fd = undefined;
    }
    chmodSync(temporaryPath, mode);
    renameSync(temporaryPath, path);
    temporaryCreated = false;
  } catch (error) {
    if (fd !== undefined) {
      try { closeSync(fd); } catch {}
    }
    if (temporaryCreated) {
      try { unlinkSync(temporaryPath); } catch (cleanupError) {
        if (cleanupError?.code !== "ENOENT") {
          const originalMessage = error instanceof Error ? error.message : "unknown HA config error";
          const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "unknown cleanup error";
          throw new Error(`${originalMessage}; could not remove temporary HA config: ${cleanupMessage}`);
        }
      }
    }
    throw error;
  }
}

async function restoreHaConfig({ configPath, content, mode, lockImpl }) {
  const lockfile = await loadLockfile(lockImpl);
  if (!lockfile?.lock) throw new Error("HA config locking is unavailable; refusing to restore the HA config");
  const release = await lockfile.lock(configPath, CONFIG_LOCK_OPTIONS);
  try {
    writeAtomicFile(configPath, content, mode);
  } finally {
    await release();
  }
}

export async function applyMatrixToHaConfig({
  configPath = DEFAULT_HA_CONFIG_PATH,
  report,
  lockImpl,
  randomBytesImpl,
} = {}) {
  const lockfile = await loadLockfile(lockImpl);
  if (!lockfile?.lock) throw new Error("HA config locking is unavailable; refusing to modify the HA config");
  const release = await lockfile.lock(configPath, CONFIG_LOCK_OPTIONS);
  try {
    const currentBytes = readFileSync(configPath, "utf8");
    const current = JSON.parse(currentBytes);
    const originalMode = statSync(configPath).mode & 0o777;
    const privateMode = originalMode & 0o700;
    const updated = applyMatrixToConfig(current, report);
    // Create privately with O_EXCL, then widen only after the complete content is written.
    writeAtomicFile(configPath, `${JSON.stringify(updated, null, 2)}\n`, privateMode, randomBytesImpl);
    return { updated, currentBytes, originalMode };
  } finally {
    await release();
  }
}

function statusMessage(report) {
  const groups = Object.values(report?.matrix ?? {});
  const ready = groups.filter((group) => group?.state === "ready").length;
  return `Model preflight: ${report?.probe?.status ?? "unknown"}; ${report?.probe?.modelCount ?? 0} models; ${ready}/${groups.length} ready failover groups`;
}

export default function modelPreflight(pi, options = {}) {
  const runCommand = options.runCommand ?? runPreflightCommand;
  const now = options.now ?? (() => Date.now());
  const haConfigPath = options.haConfigPath ?? DEFAULT_HA_CONFIG_PATH;
  const lockImpl = options.lockImpl;
  let report = null;
  let refreshPromise = null;
  let timer = null;

  const refresh = async (force = false) => {
    if (!refreshPromise) {
      refreshPromise = runCommand({ refresh: force })
        .then((value) => {
          if (!isUsableReport(value, now())) throw new Error("model preflight returned stale or unknown evidence");
          report = value;
          return value;
        })
        .catch((error) => {
          report = null;
          throw error;
        })
        .finally(() => { refreshPromise = null; });
    }
    const value = await refreshPromise;
    if (!isUsableReport(value, now())) {
      report = null;
      throw new Error("model preflight returned stale or unknown evidence");
    }
    return value;
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
    description: "Refresh and show the redacted model matrix; use 'apply' to update HA routes",
    handler: async (args, ctx) => {
      try {
        const value = await refresh(true);
        if (String(args ?? "").trim().toLowerCase() === "apply") {
          if (typeof ctx.reload !== "function") throw new Error("runtime reload is unavailable; refusing to leave HA state stale");
          const { updated, currentBytes, originalMode } = await applyMatrixToHaConfig({ configPath: haConfigPath, report: value, lockImpl });
          try {
            await ctx.reload();
          } catch (reloadError) {
            try {
              await restoreHaConfig({ configPath: haConfigPath, content: currentBytes, mode: originalMode, lockImpl });
            } catch (rollbackError) {
              throw new Error(
                `HA config reload failed and rollback failed: ${reloadError instanceof Error ? reloadError.message : "unknown reload error"}; ${rollbackError instanceof Error ? rollbackError.message : "unknown rollback error"}`,
                { cause: reloadError },
              );
            }
            throw new Error(
              `HA config rolled back: reload failed: ${reloadError instanceof Error ? reloadError.message : "unknown error"}`,
              { cause: reloadError },
            );
          }
          ctx.ui.notify(`${statusMessage(updated)}; applied reachable routes to HA`, "info");
          return;
        }
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
    const refreshMs = getRefreshIntervalMs();
    timer = setInterval(() => {
      refresh(false).catch((error) => {
        report = null;
        ctx.ui.notify(`Model preflight refresh failed: ${error instanceof Error ? error.message : "unavailable"}`, "warning");
      });
    }, refreshMs);
    timer.unref?.();
  });

  pi.on("before_agent_start", async (_event, ctx) => {
    if (!isUsableReport(report, now())) {
      report = null;
      try { await refresh(true); } catch (error) { throw new Error(`model preflight unavailable: ${error instanceof Error ? error.message : "unknown error"}`); }
    }
    if (!isUsableReport(report, now())) throw new Error("model preflight unavailable: stale or unknown evidence");
    const currentRoute = routeKey(ctx.model);
    const groupId = findGroupForRoute(report, currentRoute);
    if (!groupId) throw new Error(`model preflight blocked: ${currentRoute ?? "current model"} is not bound to a failover group`);
    if (!isReady(report, groupId)) throw new Error(`model preflight blocked: ${groupId} evidence is stale, unknown, or has no reachable fallback`);
    const current = report.matrix[groupId].entries.find((entry) => normalizeRouteId(routeEntryId(entry)) === currentRoute);
    if (current?.state !== "reachable" && !(await applyFallback(ctx, currentRoute, groupId))) {
      throw new Error(`model preflight blocked: no reachable fallback for ${currentRoute}`);
    }
  });

  pi.on("session_shutdown", () => {
    if (timer) clearInterval(timer);
    timer = null;
  });
}
