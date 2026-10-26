#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$ROOT" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const root = process.env.ROOT;
const rolesDir = path.join(root, "pi/agent/pi-ext-roles/roles");
const failures = [];
const readOnlyRoles = ["scout", "researcher", "reviewer", "market-researcher", "marketing-strategist"];
const shellReadOnlyRoles = ["debugger", "verifier"];
const writeCapableRoles = ["developer", "tests-expert"];
const expectedTools = {
  scout: ["read", "grep", "find", "ls", "web_search", "tool_search"],
  researcher: ["read", "grep", "find", "ls", "web_search", "tool_search"],
  reviewer: ["read", "grep", "find", "ls", "view_image", "tool_search"],
  debugger: ["read", "grep", "find", "ls", "bash", "view_image", "tool_search"],
  verifier: ["read", "grep", "find", "ls", "bash", "view_image", "tool_search"],
  "market-researcher": ["read", "grep", "find", "ls", "web_search", "tool_search"],
  "marketing-strategist": ["read", "grep", "find", "ls", "web_search", "tool_search"],
  developer: ["read", "grep", "find", "ls", "bash", "edit", "write", "view_image", "tool_search"],
  "tests-expert": ["read", "grep", "find", "ls", "bash", "edit", "write", "view_image", "tool_search"],
};
const roleFiles = [...readOnlyRoles, ...shellReadOnlyRoles, ...writeCapableRoles];
const settings = JSON.parse(fs.readFileSync(path.join(root, "pi/agent/pi-ext-roles/settings.json"), "utf8"));
const rootSettings = JSON.parse(fs.readFileSync(path.join(root, "pi/agent/settings.json"), "utf8"));

function roleConfig(name) {
  const file = path.join(rolesDir, `${name}.md`);
  const content = fs.readFileSync(file, "utf8");
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error(`${name}: missing YAML frontmatter`);
  const model = frontmatter[1].match(/^model:\s*([^\s]+)\s*$/m)?.[1];
  const toolsText = frontmatter[1].match(/^tools:\s*\[([^\]]*)\]\s*$/m)?.[1];
  if (!toolsText) throw new Error(`${name}: missing inline tools selector`);
  const tools = toolsText.split(",").map((item) => item.trim().replace(/^['"]|['"]$/g, ""));
  return { model, tools };
}

for (const name of roleFiles) {
  const { model, tools } = roleConfig(name);
  if (!model || model.includes("/") || !settings.modelAliases?.[model]) {
    failures.push(`${name}: model must reference a configured alias, not a provider/model ID`);
  }
  if (tools[0] !== "!*") failures.push(`${name}: tools must start with an explicit !* allowlist`);
  const positive = tools.filter((tool) => !tool.startsWith("!"));
  if (positive.some((tool) => /[*?]/.test(tool))) failures.push(`${name}: positive wildcard selectors bypass the explicit allowlist`);

  const expected = expectedTools[name];
  if (positive.length !== expected.length || expected.some((tool) => !positive.includes(tool))) {
    failures.push(`${name}: tools must exactly match its role-specific allowlist`);
  }
  if (!positive.includes("tool_search")) failures.push(`${name}: tool_search must remain explicitly available for MCP discovery`);
  if (name === "researcher" && ["replace", "insert", "undo_last_change"].some((tool) => positive.includes(tool) || tools.includes(`!${tool}`))) {
    failures.push(`${name}: selector references an absent Pi tool`);
  }
  if (readOnlyRoles.includes(name) && positive.some((tool) => ["bash", "edit", "write"].includes(tool))) {
    failures.push(`${name}: read-only role must not allow shell, edit, or write tools`);
  }
  if (shellReadOnlyRoles.includes(name) && ["edit", "write"].some((tool) => positive.includes(tool))) {
    failures.push(`${name}: diagnostic role must not allow edit or write tools`);
  }
  if (writeCapableRoles.includes(name) && ["bash", "edit", "write"].some((tool) => !positive.includes(tool))) {
    failures.push(`${name}: write-capable role must explicitly allow bash, edit, and write`);
  }
}

if (!rootSettings.defaultTools?.includes("+tool_search")) failures.push("root settings: defaultTools must activate +tool_search");
for (const extension of ["builtin:codemode", "builtin:tool-search", "builtin:mcp"]) {
  if (!settings.extensions?.includes(extension)) failures.push(`global settings: missing MCP/workflow extension ${extension}`);
}
if (!settings.tools?.includes("tool_search")) failures.push("global settings: tool_search allowance was removed");

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}
console.log("PASS: role tool allowlists, model aliases, and MCP discovery policy");
NODE
