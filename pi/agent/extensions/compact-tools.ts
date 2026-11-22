// tested
/**
 * Compact rendering for read and edit tools.
 *
 * Pi's built-in tools fall back to verbose output. We monkey-patch
 * ToolExecutionComponent.prototype.updateDisplay to render them as a single
 * compact line instead.
 *
 * When expanded (ctrl+o) the original updateDisplay runs normally.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { realpathSync } from "fs";
import { createRequire } from "module";
import { homedir } from "os";
import { dirname, join } from "path";
import { pathToFileURL } from "url";
import {
  imageSourcesForResult,
  redactSensitive,
  type ImageSource,
} from "./compact-rendering.js";

const PATCH_FLAG = "__compactToolsPatched" as const;

function shortenPath(p: string): string {
  const home = homedir();
  return p?.startsWith(home) ? `~${p.slice(home.length)}` : (p ?? "");
}

type Themed = {
  fg(color: string, text: string): string;
  bold(text: string): string;
  bg(color: string, text: string): string;
};

type PatchableProto = typeof ToolExecutionComponent.prototype & {
  [PATCH_FLAG]?: boolean;
  toolName: string;
  args: Record<string, unknown>;
  expanded: boolean;
  result?: {
    isError?: boolean;
    content: Array<{
      type: string;
      text?: string;
      data?: string;
      mimeType?: string;
    }>;
  };
  isPartial: boolean;
  showImages: boolean;
  imageWidthCells: number;
  imageComponents: unknown[];
  imageSources: ImageSource[];
  imageSpacers: unknown[];
  addChild(c: unknown): void;
  removeChild(c: unknown): void;
  contentText: {
    setText(s: string): void;
    setCustomBgFn(fn: (s: string) => string): void;
  };
  contentBox: {
    clear(): void;
    addChild(c: unknown): void;
    setBgFn(fn: (s: string) => string): void;
  };
  hideComponent: boolean;
  hasRendererDefinition(): boolean;
  getRenderShell(): string;
  invalidate(): void;
  ui: {
    requestRender(): void;
    notify?(message: string, level: "info" | "warning" | "error"): void;
  };
  __originalUpdateDisplay?(): void;
};

const COMPACT_TOOLS = new Set(["read", "edit", "write", "bash"]);

// By default bash shows full output when Ctrl+O expanded (original behaviour).
// Set PI_COMPACT_BASH=1 or COMPACT_BASH=1 to keep bash compact even when expanded.
const BASH_ALWAYS_COMPACT =
  process.env.PI_COMPACT_BASH === "1" || process.env.COMPACT_BASH === "1";

function truncateSingleLine(text: string, max = 96): string {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}

function extractTextOutput(result: PatchableProto["result"]): string {
  return (
    result?.content
      .filter(
        (entry) => entry.type === "text" && typeof entry.text === "string",
      )
      .map((entry) => entry.text)
      .join("\n") ?? ""
  );
}

function buildCompactLabel(
  toolName: string,
  args: Record<string, unknown>,
  t: Themed,
): string {
  if (toolName === "read") {
    const path = t.fg("accent", shortenPath(args.path as string));
    let suffix = "";
    if (args.offset !== undefined || args.limit !== undefined) {
      const start = (args.offset as number) ?? 1;
      const end =
        args.limit !== undefined ? start + (args.limit as number) - 1 : "";
      suffix = `:${start}${end !== "" ? `-${end}` : ""}`;
    }
    return `${t.fg("toolTitle", t.bold("read"))} ${path}${suffix}`;
  }
  if (toolName === "edit" || toolName === "write") {
    const path = t.fg("accent", shortenPath(args.path as string));
    return `${t.fg("toolTitle", t.bold(toolName))} ${path}`;
  }
  if (toolName === "bash") {
    const command = typeof args.command === "string" ? args.command : "";
    const lineCount = command.split("\n").length;
    const summary =
      lineCount > 1
        ? `${lineCount} lines`
        : truncateSingleLine(redactSensitive(command)) || "command";
    return `${t.fg("toolTitle", t.bold("bash"))} ${t.fg("accent", summary)}`;
  }
  return t.fg("toolTitle", t.bold(toolName));
}

function buildExpandedBashText(
  args: Record<string, unknown>,
  result: PatchableProto["result"],
  t: Themed,
): string {
  const command = redactSensitive(
    typeof args.command === "string" ? args.command : "",
  );
  const output = redactSensitive(extractTextOutput(result));
  const sections = [t.fg("toolTitle", t.bold("bash"))];
  if (command) sections.push(t.fg("muted", `$ ${command}`));
  if (output) sections.push(t.fg("toolOutput", output));
  return sections.join("\n\n");
}

const piAgentDistIndex = realpathSync(
  process.argv[1]?.startsWith("/$bunfs/")
    ? process.execPath
    : (process.argv[1] ?? process.execPath),
);

let _theme: Themed | undefined;
function getTheme(): Themed {
  if (!_theme) {
    const req = createRequire(piAgentDistIndex);
    _theme = req("./modes/interactive/theme/theme.js").theme as Themed;
  }
  return _theme!;
}

type PatchStatus = "applied" | "already-patched" | "missing-update-display";

let pngTranscoderWarned = false;

function requestPngTranscoder(component: PatchableProto): void {
  try {
    const requireRuntime = createRequire(piAgentDistIndex);
    const packageEntry = requireRuntime.resolve(
      "@earendil-works/pi-coding-agent",
    );
    const modulePath = join(dirname(packageEntry), "utils/image-convert.js");
    void import(pathToFileURL(modulePath).href)
      .then((module) => {
        const { ensurePngTranscoder } = module as {
          ensurePngTranscoder?: (onRegistered: () => void) => void;
        };
        ensurePngTranscoder?.(() => {
          component.invalidate();
          component.ui.requestRender();
        });
      })
      .catch(() => {
        if (pngTranscoderWarned) return;
        pngTranscoderWarned = true;
        component.ui.notify?.(
          "compact-tools: PNG transcoder unavailable; image text fallback remains",
          "warning",
        );
      });
  } catch {
    if (pngTranscoderWarned) return;
    pngTranscoderWarned = true;
    component.ui.notify?.(
      "compact-tools: PNG transcoder unavailable; image text fallback remains",
      "warning",
    );
  }
}

function isPatchActive(): boolean {
  const proto = ToolExecutionComponent.prototype as PatchableProto;
  return (
    proto[PATCH_FLAG] === true &&
    typeof proto.__originalUpdateDisplay === "function"
  );
}

function formatStatusMessage(lastStatus: PatchStatus): string {
  const proto = ToolExecutionComponent.prototype as PatchableProto;
  return [
    `compact-tools: ${isPatchActive() ? "active" : "inactive"}`,
    `last load: ${lastStatus}`,
    `patch flag: ${proto[PATCH_FLAG] === true ? "yes" : "no"}`,
    `original updateDisplay: ${typeof proto.__originalUpdateDisplay === "function" ? "yes" : "no"}`,
    `tools: ${Array.from(COMPACT_TOOLS).join(", ")}`,
    `note: Ctrl+O on bash shows full output by default; set PI_COMPACT_BASH=1 to keep it compact`,
  ].join("\n");
}

function applyPatch(): PatchStatus {
  const proto = ToolExecutionComponent.prototype as PatchableProto;
  if (proto[PATCH_FLAG]) return "already-patched";

  const original = proto.updateDisplay;
  if (typeof original !== "function") return "missing-update-display";

  proto.__originalUpdateDisplay = original;
  proto.updateDisplay = function patchedUpdateDisplay(this: PatchableProto) {
    if (
      !COMPACT_TOOLS.has(this.toolName) ||
      (this.expanded && this.toolName !== "bash")
    ) {
      original.call(this);
      return;
    }

    const t = getTheme();
    const bgFn = this.isPartial
      ? (s: string) => t.bg("toolPendingBg", s)
      : this.result?.isError
        ? (s: string) => t.bg("toolErrorBg", s)
        : (s: string) => t.bg("toolSuccessBg", s);

    this.hideComponent = false;

    if (this.hasRendererDefinition() && this.getRenderShell() !== "self") {
      this.contentBox.setBgFn(bgFn);
      this.contentBox.clear();
      this.contentBox.addChild(
        new Text(
          !BASH_ALWAYS_COMPACT && this.expanded && this.toolName === "bash"
            ? buildExpandedBashText(this.args, this.result, t)
            : buildCompactLabel(this.toolName, this.args, t),
          0,
          0,
        ),
      );
    } else {
      this.contentText.setCustomBgFn(bgFn);
      this.contentText.setText(
        !BASH_ALWAYS_COMPACT && this.expanded && this.toolName === "bash"
          ? buildExpandedBashText(this.args, this.result, t)
          : buildCompactLabel(this.toolName, this.args, t),
      );
    }

    const previousImages = this.imageComponents ?? [];
    const previousSources = this.imageSources ?? [];
    for (const img of previousImages) this.removeChild(img);
    this.imageComponents = [];
    this.imageSources = [];
    for (const sp of this.imageSpacers ?? []) this.removeChild(sp);
    this.imageSpacers = [];

    const piTuiPath = createRequire(piAgentDistIndex).resolve(
      "@earendil-works/pi-tui/dist/index.js",
    );
    const { getCapabilities, Image, Spacer } =
      createRequire(piTuiPath)(piTuiPath);
    const caps = getCapabilities();
    const imageSources = imageSourcesForResult(
      this.result,
      this.showImages,
      this.imageWidthCells,
      caps,
    );
    for (const source of imageSources) {
      const spacer = new Spacer(1);
      this.addChild(spacer);
      this.imageSpacers.push(spacer);
      const index = this.imageComponents.length;
      const previous = previousSources[index];
      const imageComponent =
        previous?.data === source.data &&
        previous.mimeType === source.mimeType &&
        previous.widthCells === source.widthCells
          ? previousImages[index]
          : new Image(
              source.data,
              source.mimeType,
              { fallbackColor: (s: string) => t.fg("toolOutput", s) },
              { maxWidthCells: source.widthCells },
            );
      if (source.mimeType !== "image/png") requestPngTranscoder(this);
      this.imageComponents.push(imageComponent);
      this.imageSources.push(source);
      this.addChild(imageComponent);
    }
  };

  proto[PATCH_FLAG] = true;
  return "applied";
}

export default function compactToolsExtension(pi: ExtensionAPI) {
  // Opt-in: the renderer patch is OFF by default while inline image truncation
  // in WezTerm/Kitty rendering is still being debugged. Set
  // PI_ENABLE_COMPACT_TOOLS=1 to turn it on. (Kept off-by-default on purpose;
  // the previous PI_DISABLE_COMPACT_TOOLS!="0" double-negative did the same but
  // read as always-disabled.)
  const enabled = process.env.PI_ENABLE_COMPACT_TOOLS === "1";
  if (!enabled) {
    return;
  }
  const patchStatus = applyPatch();

  pi.registerCommand("compact-tools-status", {
    description: "Show compact-tools renderer patch status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        formatStatusMessage(patchStatus),
        isPatchActive() ? "info" : "warning",
      );
    },
  });

  if (patchStatus === "missing-update-display") {
    let warned = false;
    pi.on("session_start", async (_event, ctx) => {
      if (warned || !ctx.hasUI) return;
      warned = true;
      ctx.ui.notify(
        "compact-tools: failed to patch ToolExecutionComponent",
        "warning",
      );
    });
  }
}
