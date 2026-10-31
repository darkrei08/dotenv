import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextEntries } from "./pi-ha-bootstrap.mjs";

const config = JSON.parse(readFileSync(new URL("../ha-failover.example.json", import.meta.url), "utf8"));
const [firstDevEntry, ...restDevEntries] = config.groups.development.entries;

test("returns the configured HA entries after a known model", () => {
  assert.ok(restDevEntries.length > 0);
  assert.deepEqual(nextEntries(config, `${firstDevEntry.id}:off`, "development"), restDevEntries);
});

test("normalizes effort suffixes and keeps unknown models fail closed", () => {
  assert.equal(nextEntries(config, firstDevEntry.id, "development").length, restDevEntries.length);
  assert.deepEqual(nextEntries(config, "unknown/provider-model"), []);
  assert.deepEqual(nextEntries(config, ""), []);
});

test("shared models require an explicit group even when defaultGroup is set", () => {
  const sharedModel = Object.values(config.groups)
    .flatMap((group) => group.entries.map((entry) => entry.id))
    .find((id, index, array) => array.indexOf(id) !== array.lastIndexOf(id));
  assert.ok(sharedModel);
  assert.deepEqual(nextEntries(config, sharedModel), []);
  assert.deepEqual(nextEntries(config, sharedModel, "missing"), []);
});

console.log("HA bootstrap checks passed");
