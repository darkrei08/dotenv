import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function configPath() {
  const agentDir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
  return join(agentDir, "ha.json");
}

export function startupModelError(message) {
  return /unknown provider|unknown model|model .* not found|unsupported model|model .* unavailable/i.test(message || "");
}

export function isGatewayEntry(entry) {
  return String(entry?.id || "").split("/", 1)[0] === "cliproxyapi";
}

export function nextEntries(entries, currentId) {
  if (currentId == null) return entries;
  const index = entries.findIndex((entry) => entry.id === currentId);
  return index < 0 ? [] : entries.slice(index + 1);
}

function activeEntries() {
  try {
    const config = JSON.parse(readFileSync(configPath(), "utf8"));
    const groupName = process.env.PI_HA_GROUP || config.activeGroup || config.defaultGroup;
    const group = config.groups?.[groupName];
    return (Array.isArray(group?.entries) ? group.entries : []).filter(isGatewayEntry);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[HA] Cannot load failover matrix from ${configPath()}: ${detail}`);
    return [];
  }
}

function currentId(ctx) {
  return ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : null;
}

async function selectFallback(pi, ctx, entries, current) {
  for (const entry of nextEntries(entries, current)) {
    const [provider, ...modelParts] = String(entry.id || "").split("/");
    const model = provider && modelParts.length > 0
      ? ctx.modelRegistry.find(provider, modelParts.join("/"))
      : undefined;
    if (model && await pi.setModel(model)) {
      ctx.ui?.notify(`[HA] Selected fallback model ${entry.id}.`, "warning");
      return true;
    }
  }
  return false;
}

export default function (pi) {
  let lastPrompt = null;
  let retriedPrompt = null;

  pi.on("before_agent_start", (event) => {
    if (event.messageType === "user") lastPrompt = event.prompt;
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = activeEntries();
    if (!entries.length) return;
    const current = currentId(ctx);
    if (current && ctx.modelRegistry.find(ctx.model.provider, ctx.model.id)) return;
    await selectFallback(pi, ctx, entries, null);
  });

  pi.on("turn_end", async (event, ctx) => {
    const message = event.message;
    if (message?.role !== "assistant") return;
    if (!startupModelError(message.errorMessage)) {
      retriedPrompt = null;
      return;
    }

    const switched = await selectFallback(pi, ctx, activeEntries(), currentId(ctx));
    if (!switched || !lastPrompt || retriedPrompt === lastPrompt) return;
    retriedPrompt = lastPrompt;
    pi.sendUserMessage(lastPrompt, { deliverAs: "followUp" });
  });
}
