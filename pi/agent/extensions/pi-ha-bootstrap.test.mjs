import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { default as bootstrap, isGatewayEntry, nextEntries, startupModelError } from "./pi-ha-bootstrap.mjs";

function setup(t) {
  const home = mkdtempSync(join(tmpdir(), "pi-ha-bootstrap-"));
  writeFileSync(join(home, "ha.json"), JSON.stringify({
    defaultGroup: "testing",
    groups: {
      testing: { entries: [{ id: "cliproxyapi/primary" }, { id: "cliproxyapi/backup" }] },
    },
  }));
  process.env.PI_CODING_AGENT_DIR = home;
  t.after(() => {
    delete process.env.PI_CODING_AGENT_DIR;
    rmSync(home, { recursive: true, force: true });
  });
}

test("startup model errors are recognized for fallback", () => {
  assert.equal(startupModelError("unknown provider for model claude-opus-5-5"), true);
  assert.equal(startupModelError("network timeout"), false);
});

test("automatic failover accepts only CLIProxyAPI entries", () => {
  assert.equal(isGatewayEntry({ id: "cliproxyapi/backup" }), true);
  assert.equal(isGatewayEntry({ id: "anthropic/claude" }), false);
  assert.equal(isGatewayEntry({ id: "opencode-go/cat-jam-free" }), false);
});

test("fallback candidates fail closed for an unknown current entry", () => {
  const entries = [{ id: "cliproxyapi/primary" }, { id: "cliproxyapi/backup" }];
  assert.deepEqual(nextEntries(entries, "cliproxyapi/primary"), [entries[1]]);
  assert.deepEqual(nextEntries(entries, "missing"), []);
  assert.deepEqual(nextEntries(entries, null), entries);
});

test("session startup selects the first available matrix model", async (t) => {
  setup(t);
  const handlers = {};
  const selected = [];
  const pi = {
    on(name, handler) { handlers[name] = handler; },
    async setModel(model) { selected.push(model); return true; },
  };
  const ctx = {
    model: undefined,
    modelRegistry: { find: (provider, id) => ({ provider, id }) },
  };
  bootstrap(pi);
  await handlers.session_start({}, ctx);
  assert.deepEqual(selected, [{ provider: "cliproxyapi", id: "primary" }]);
});

test("session startup recovers an unavailable configured model from the matrix", async (t) => {
  setup(t);
  const handlers = {};
  const selected = [];
  const pi = {
    on(name, handler) { handlers[name] = handler; },
    async setModel(model) { selected.push(model); return true; },
  };
  const ctx = {
    model: { provider: "other", id: "missing" },
    modelRegistry: { find: (provider, id) => provider === "cliproxyapi" ? { provider, id } : undefined },
  };
  bootstrap(pi);
  await handlers.session_start({}, ctx);
  assert.deepEqual(selected, [{ provider: "cliproxyapi", id: "primary" }]);
});

test("turn errors select the next model and replay the failed prompt once", async (t) => {
  setup(t);
  const handlers = {};
  const selected = [];
  const messages = [];
  const pi = {
    on(name, handler) { handlers[name] = handler; },
    async setModel(model) { selected.push(model); return true; },
    sendUserMessage(...args) { messages.push(args); },
  };
  const ctx = {
    model: { provider: "cliproxyapi", id: "primary" },
    modelRegistry: { find: (provider, id) => ({ provider, id }) },
  };
  bootstrap(pi);
  await handlers.before_agent_start({ messageType: "user", prompt: "continue the task" }, ctx);
  await handlers.turn_end({ message: { role: "assistant", errorMessage: "unknown provider" } }, ctx);
  assert.deepEqual(selected, [{ provider: "cliproxyapi", id: "backup" }]);
  assert.deepEqual(messages, [["continue the task", { deliverAs: "followUp" }]]);
});
