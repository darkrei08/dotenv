import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The lock path is read at import time, so point it at a private directory first: the
// stale-lock test must never touch a live start claim in the shared temp directory.
const lockDir = mkdtempSync(join(tmpdir(), "rotator-lock-test-"));
process.env.TUXEVIL_ROTATOR_LOCK = join(lockDir, "claim.lock");
const { acquireStart, ensureGateway, LOCK_PATH, startDetached } = await import("./index");

// A fake clock keeps the readiness loop instant and makes the timeout observable.
function fakeClock() {
  let elapsed = 0;
  return { now: () => elapsed, sleep: async (ms: number) => { elapsed += ms; } };
}

test("an answering gateway is never started", async () => {
  let starts = 0;
  const outcome = await ensureGateway({
    probe: async () => true,
    start: () => { starts += 1; return true; },
  });
  expect(outcome).toBe("already-up");
  expect(starts).toBe(0);
});

test("a start that then answers is reported as started", async () => {
  const clock = fakeClock();
  let answers = false;
  const outcome = await ensureGateway({
    ...clock,
    acquireStart: () => true,
    releaseStart: () => {},
    probe: async () => answers,
    start: () => { answers = true; return true; },
  });
  expect(outcome).toBe("started");
});

test("a start that never answers stops at the readiness timeout", async () => {
  const clock = fakeClock();
  const outcome = await ensureGateway({
    ...clock,
    acquireStart: () => true,
    releaseStart: () => {},
    probe: async () => false,
    start: () => true,
    readyTimeoutMs: 2000,
  });
  expect(outcome).toBe("unreachable");
  expect(clock.now()).toBe(2000);
});

test("a binary that cannot be spawned is reported as start-failed", async () => {
  const outcome = await ensureGateway({
    acquireStart: () => true,
    releaseStart: () => {},
    probe: async () => false,
    start: () => false,
  });
  expect(outcome).toBe("start-failed");
});

test("a missing gateway binary resolves as a failed start", async () => {
  expect(await startDetached("/definitely/missing/tuxevil-rotator")).toBe(false);
});

test("an existing stale lock is never reclaimed", () => {
  writeFileSync(LOCK_PATH, "stale-owner\n");
  try {
    expect(acquireStart()).toBe(false);
  } finally {
    rmSync(LOCK_PATH, { force: true });
  }
});

test("a peer that already claimed the start prevents a second spawn", async () => {
  const clock = fakeClock();
  let probes = 0;
  let starts = 0;
  let releases = 0;
  const outcome = await ensureGateway({
    ...clock,
    acquireStart: () => false,
    releaseStart: () => { releases += 1; },
    probe: async () => { probes += 1; return probes > 1; },
    start: () => { starts += 1; return true; },
  });
  expect(outcome).toBe("started");
  expect(starts).toBe(0);
  expect(releases).toBe(0);
});

test("the start claim is released after the readiness wait", async () => {
  const clock = fakeClock();
  let releases = 0;
  const outcome = await ensureGateway({
    ...clock,
    acquireStart: () => true,
    releaseStart: () => { releases += 1; },
    probe: async () => false,
    start: () => true,
    readyTimeoutMs: 2000,
  });
  expect(outcome).toBe("unreachable");
  expect(releases).toBe(1);
});

test("the start claim is released even when the spawn fails", async () => {
  let releases = 0;
  const outcome = await ensureGateway({
    acquireStart: () => true,
    releaseStart: () => { releases += 1; },
    probe: async () => false,
    start: () => false,
  });
  expect(outcome).toBe("start-failed");
  expect(releases).toBe(1);
});

test("no claim is taken when the gateway already answers", async () => {
  let acquires = 0;
  const outcome = await ensureGateway({
    acquireStart: () => { acquires += 1; return true; },
    releaseStart: () => {},
    probe: async () => true,
    start: () => true,
  });
  expect(outcome).toBe("already-up");
  expect(acquires).toBe(0);
});
