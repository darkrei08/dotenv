// Optionally starts the local tuxevil-rotator gateway when a Pi session opens and
// nothing answers on its port. Set TUXEVIL_ROTATOR_AUTOSTART=1 to opt in.
//
// Idempotent and quiet by design: an answering gateway costs one local request and no
// notification, and a gateway that never comes up is reported once per session instead
// of failing silently at the first rotator-gemini call. Concurrent sessions coordinate
// through one start claim, so N sessions opening at once produce one start, not N.
// TUXEVIL_ROTATOR_URL, TUXEVIL_ROTATOR_BIN and TUXEVIL_ROTATOR_LOCK override the probe,
// the binary and the start-claim file, which is how the test exercises the loop without
// a real gateway and without touching a live claim.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";

const PROBE_URL = process.env.TUXEVIL_ROTATOR_URL ?? "http://localhost:51200/v1/models";
const BINARY = process.env.TUXEVIL_ROTATOR_BIN ?? "tuxevil-rotator";
const API_KEY = process.env.TUXEVIL_ROTATOR_API_KEY ?? "";
const PROBE_TIMEOUT_MS = 1500;
const READY_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;
export const LOCK_PATH = process.env.TUXEVIL_ROTATOR_LOCK ?? join(tmpdir(), "pi-tuxevil-rotator-autostart.lock");
const GATEWAY_LOG = join(homedir(), ".tuxevil-rotator", "gateway.log");

export type GatewayOutcome = "already-up" | "started" | "unreachable" | "start-failed";

export async function probe(): Promise<boolean> {
  try {
    const res = await fetch(PROBE_URL, {
      headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : undefined,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let lockToken: string | undefined;

function writeLockFile(token: string): void {
  const fd = openSync(LOCK_PATH, "wx");
  try {
    writeSync(fd, `${token}\n`);
  } finally {
    closeSync(fd);
  }
}

// One claim at a time, taken with an exclusive create so concurrent sessions cannot both
// win it. Existing claims are never reclaimed automatically: deleting a stale path is a
// TOCTOU race that can remove a fresh owner's lock. A crashed session therefore requires
// manual removal of LOCK_PATH before another session can start the gateway.
export function acquireStart(): boolean {
  const token = `${process.pid}-${randomUUID()}`;
  try {
    writeLockFile(token);
    lockToken = token;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      console.warn(`tuxevil-rotator lock could not be created: ${String(error)}`);
    }
    return false;
  }
}

export function releaseStart(): void {
  const token = lockToken;
  lockToken = undefined;
  if (!token) return;
  try {
    if (readFileSync(LOCK_PATH, "utf8") !== `${token}\n`) return;
    rmSync(LOCK_PATH, { force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`tuxevil-rotator lock could not be released: ${String(error)}`);
    }
  }
}

export function startDetached(binary = BINARY): Promise<boolean> {
  let logFd: number | undefined;
  try {
    mkdirSync(dirname(GATEWAY_LOG), { recursive: true });
    logFd = openSync(GATEWAY_LOG, "a");
  } catch (error) {
    console.warn(`tuxevil-rotator log is unavailable; gateway output will be discarded: ${String(error)}`);
    logFd = undefined;
  }
  try {
    // A .cmd shim on Windows cannot be executed without a shell; elsewhere the binary is
    // spawned directly so no shell lives between the gateway and this session. Output goes
    // to the shared log, which is where a second session's busy-port error becomes visible.
    const child = spawn(binary, ["start"], {
      detached: true,
      stdio: logFd === undefined ? "ignore" : ["ignore", logFd, logFd],
      windowsHide: true,
      shell: process.platform === "win32",
    });
    // A missing binary surfaces as an async spawn error; resolve false so callers
    // report the actual start failure instead of waiting for readiness to time out.
    return new Promise((resolve) => {
      child.once("error", () => resolve(false));
      child.once("spawn", () => resolve(true));
      child.unref();
    });
  } catch (error) {
    console.warn(`tuxevil-rotator could not be spawned: ${String(error)}`);
    return Promise.resolve(false);
  } finally {
    if (logFd !== undefined) closeSync(logFd);
  }
}

export async function ensureGateway(opts: {
  probe: () => Promise<boolean>;
  start: () => boolean | Promise<boolean>;
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
  if (mine && !(await opts.start())) {
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
  if (process.env.TUXEVIL_ROTATOR_AUTOSTART !== "1") return;
  pi.on("session_start", async (_event, ctx) => {
    const outcome = await ensureGateway({ probe, start: startDetached });
    if (outcome === "start-failed" || outcome === "unreachable") {
      ctx.ui.notify(
        `tuxevil-rotator is not answering at ${PROBE_URL} (${outcome}); the rotator-gemini-* aliases will fail. Run 'tuxevil-rotator login' once, or start it with 'tuxevil-rotator start'. Log: ${GATEWAY_LOG}`,
        "warning",
      );
    }
  });
}
