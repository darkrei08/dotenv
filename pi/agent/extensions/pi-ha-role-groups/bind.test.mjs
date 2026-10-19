import assert from "node:assert/strict";
import test from "node:test";
import { bindHaGroup } from "./bind.ts";

function extensionApi(handler) {
  return { on(event, callback) {
    assert.equal(event, "session_shutdown");
    handler.value = callback;
  } };
}

test("binds the group and restores the prior environment", () => {
  const previous = process.env.PI_HA_GROUP;
  delete process.env.PI_HA_GROUP;
  const handler = { value: undefined };

  bindHaGroup(extensionApi(handler), "research");
  assert.equal(process.env.PI_HA_GROUP, "research");
  handler.value();
  assert.equal(process.env.PI_HA_GROUP, undefined);

  if (previous === undefined) delete process.env.PI_HA_GROUP;
  else process.env.PI_HA_GROUP = previous;
});

test("overrides an inherited group and restores it", () => {
  const previous = process.env.PI_HA_GROUP;
  process.env.PI_HA_GROUP = "reviewer";
  const handler = { value: undefined };

  bindHaGroup(extensionApi(handler), "research");
  assert.equal(process.env.PI_HA_GROUP, "research");
  handler.value();
  assert.equal(process.env.PI_HA_GROUP, "reviewer");

  if (previous === undefined) delete process.env.PI_HA_GROUP;
  else process.env.PI_HA_GROUP = previous;
});

test("restores the original group after multiple bindings", () => {
  const previous = process.env.PI_HA_GROUP;
  process.env.PI_HA_GROUP = "fast";
  const first = { value: undefined };
  const second = { value: undefined };

  bindHaGroup(extensionApi(first), "research");
  bindHaGroup(extensionApi(second), "reviewer");
  assert.equal(process.env.PI_HA_GROUP, "reviewer");
  first.value();
  assert.equal(process.env.PI_HA_GROUP, "reviewer");
  second.value();
  assert.equal(process.env.PI_HA_GROUP, "fast");

  if (previous === undefined) delete process.env.PI_HA_GROUP;
  else process.env.PI_HA_GROUP = previous;
});

test("restores the remaining active group when shutdown is out of order", () => {
  const previous = process.env.PI_HA_GROUP;
  delete process.env.PI_HA_GROUP;
  const first = { value: undefined };
  const second = { value: undefined };

  bindHaGroup(extensionApi(first), "research");
  bindHaGroup(extensionApi(second), "reviewer");
  second.value();
  assert.equal(process.env.PI_HA_GROUP, "research");
  first.value();
  assert.equal(process.env.PI_HA_GROUP, undefined);

  if (previous === undefined) delete process.env.PI_HA_GROUP;
  else process.env.PI_HA_GROUP = previous;
});
