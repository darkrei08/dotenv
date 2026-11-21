import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextEntries } from "./pi-ha-bootstrap.mjs";

const config = JSON.parse(readFileSync(new URL("../ha-failover.example.json", import.meta.url), "utf8"));

test("returns the configured HA entries after a known model", () => {
  assert.deepEqual(nextEntries(config, "cliproxyapi/claude-sonnet-4-6:off", "development"), [
    { id: "cliproxyapi/gemini-3.8-flash-tiered" },
    { id: "cliproxyapi/gpt-6.1-sol" },
    { id: "cliproxyapi/gpt-6.2-sol" },
    { id: "cliproxyapi/gpt-6-luna" }
  ]);
});

test("normalizes effort suffixes and keeps unknown models fail closed", () => {
  assert.equal(nextEntries(config, "cliproxyapi/claude-sonnet-4-6", "development").length, 4);
  assert.deepEqual(nextEntries(config, "unknown/provider-model"), []);
  assert.deepEqual(nextEntries(config, ""), []);
});

test("shared models require an explicit group even when defaultGroup is set", () => {
  assert.deepEqual(nextEntries(config, "cliproxyapi/claude-sonnet-4-6"), []);
  assert.deepEqual(nextEntries(config, "cliproxyapi/claude-sonnet-4-6", "missing"), []);
});

console.log("HA bootstrap checks passed");
