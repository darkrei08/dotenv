// Starts the local tuxevil-rotator gateway when a Pi session opens and nothing answers
// on its port. The dotenv Gemini aliases (gemini-flash-*, gemini-pro-*) point at
// tuxevil-rotator, so without the gateway every one of them fails at launch.
//
// Idempotent and quiet by design: an answering gateway costs one local request and no
// notification, and a gateway that never comes up is reported once per session instead
// of failing silently at the first Gemini call. Concurrent sessions coordinate through
// one start claim, so N sessions opening at once produce one start, not N.
// TUXEVIL_ROTATOR_URL and TUXEVIL_ROTATOR_BIN override the probe and the binary, which
// is how the test exercises the loop without a real gateway.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, rmSync, statSync, writeSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";

const PROBE_URL = process.env.TUXEVIL_ROTATOR_URL ?? "http://localhost:51200/v1/models";
const BINARY = process.env.TUXEVIL_ROTATOR_BIN ?? "tuxevil-rotator";
const PROBE_TIMEOUT_MS = 1500;
const READY_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;
const LOCK_PATH = join(tmpdir(), "pi-tuxevil-rotator-autostart.lock");
const GATEWAY_LOG = join(homedir(), ".tuxevil-rotator", "gateway.log");

export type GatewayOutcome = "already-up" | "started" | "unreachable" | "start-failed";

export async function probe(): Promise<boolean> {
  try {
    const res = await fetch(PROBE_URL, {
      headers: { Authorization: "Bearer tuxevil" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function writeLockFile(): void {
  const fd = openSync(LOCK_PATH, "wx");
  try {
    writeSync(fd, `${process.pid} ${Date.now()}\n`);
  } finally {
    closeSync(fd);
  }
}

// One claim at a time, taken with an exclusive create so concurrent sessions cannot both
// win it. A claim older than the readiness window belongs to a session that died before
// the gateway answered, so it is taken over.
// ponytail: two sessions can observe the same stale claim and one can delete the other's
// fresh file, costing one duplicate spawn that exits on the busy port. A real mutex is
// not worth that.
export function acquireStart(): boolean {
  try {
    writeLockFile();
    return true;
  } catch {
    try {
      if (Date.now() - statSync(LOCK_PATH).mtimeMs <= READY_TIMEOUT_MS) return false;
      rmSync(LOCK_PATH, { force: true });
      writeLockFile();
      return true;
    } catch {
      return false;
    }
  }
}

export function releaseStart(): void {
  try {
    rmSync(LOCK_PATH, { force: true });
  } catch {
    // Nothing to release.
  }
}

export function startDetached(): boolean {
  let logFd: number | undefined;
  try {
    mkdirSync(dirname(GATEWAY_LOG), { recursive: true });
    logFd = openSync(GATEWAY_LOG, "a");
  } catch {
    // An unwritable log must never stop the gateway; its output is then discarded.
    logFd = undefined;
  }
  try {
    // A .cmd shim on Windows cannot be executed without a shell; elsewhere the binary is
    // spawned directly so no shell lives between the gateway and this session. Output goes
    // to the shared log, which is where a second session's busy-port error becomes visible.
    const child = spawn(BINARY, ["start"], {
      detached: true,
      stdio: logFd === undefined ? "ignore" : ["ignore", logFd, logFd],
      windowsHide: true,
      shell: process.platform === "win32",
    });
    // A missing binary surfaces as an async spawn error, and an unhandled error event
    // would take the session down with it.
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  } finally {
    if (logFd !== undefined) closeSync(logFd);
  }
}

export async function ensureGateway(opts: {
  probe: () => Promise<boolean>;
  start: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  readyTimeoutMs?: number;
  acquireStart?: () => boolean;
  releaseStart?: () => void;
}): Promise<GatewayOutcome> {
  if (await opts.probe()) return "already-up";
  const acquire = opts.acquireStart ?? acquireStart;
  const release = opts.releaseStart ?? releaseStart;
  const mine = acquire();
  if (mine && !opts.start()) {
    release();
    return "start-failed";
  }
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + (opts.readyTimeoutMs ?? READY_TIMEOUT_MS);
  try {
    while (now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      if (await opts.probe()) return "started";
    }
    return "unreachable";
  } finally {
    if (mine) release();
  }
}

export default function rotatorAutostart(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    const outcome = await ensureGateway({ probe, start: startDetached });
    if (outcome === "start-failed" || outcome === "unreachable") {
      ctx.ui.notify(
        `tuxevil-rotator is not answering at ${PROBE_URL} (${outcome}); the gemini-* aliases will fail. Run 'tuxevil-rotator login' once, or start it with 'tuxevil-rotator start'. Log: ${GATEWAY_LOG}`,
        "warning",
      );
    }
  });
}
