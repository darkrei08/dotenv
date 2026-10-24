import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextEntries } from "./pi-ha-bootstrap.mjs";

const config = JSON.parse(readFileSync(new URL("../ha-failover.example.json", import.meta.url), "utf8"));

test("returns the configured HA entries after a known model", () => {
  assert.deepEqual(nextEntries(config, "cliproxyapi/claude-sonnet-4-6:off"), [
    { id: "cliproxyapi/gpt-6-luna:high" },
    { id: "cliproxyapi/gpt-6-sol:medium" },
    { id: "cliproxyapi/gpt-6-astra:medium" }
  ]);
});

test("normalizes effort suffixes and keeps unknown models fail closed", () => {
  assert.equal(nextEntries(config, "cliproxyapi/claude-sonnet-4-6").length, 3);
  assert.deepEqual(nextEntries(config, "unknown/provider-model"), []);
  assert.deepEqual(nextEntries(config, ""), []);
});

console.log("HA bootstrap checks passed");
