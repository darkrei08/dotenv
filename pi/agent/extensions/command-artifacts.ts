import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const DEFAULT_MAX_BYTES = 51200; // 50KB
export const DEFAULT_LS_LIMIT = 500;
export const DEFAULT_GREP_LIMIT = 100;
export const GREP_MAX_LINE_LENGTH = 500;

export const lsSchema = {
  type: "object" as const,
  properties: {
    path: { type: "string" as const, description: "Directory to list (default: current directory)" },
    limit: { type: "number" as const, description: "Maximum number of entries to return (default: 500)" },
  },
};

export const grepSchema = {
  type: "object" as const,
  required: ["pattern" as const],
  properties: {
    pattern: { type: "string" as const, description: "Search pattern (regex or literal string)" },
    path: { type: "string" as const, description: "Directory or file to search (default: current directory)" },
    glob: { type: "string" as const, description: "Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'" },
    ignoreCase: { type: "boolean" as const, description: "Case-insensitive search (default: false)" },
    literal: { type: "boolean" as const, description: "Treat pattern as literal string instead of regex (default: false)" },
    context: { type: "number" as const, description: "Number of lines to show before and after each match (default: 0)" },
    limit: { type: "number" as const, description: "Maximum number of matches to return (default: 100)" },
  },
};

const BLOCKED_PATH_PATTERNS = [
  /(?:^|[\\/])\.env(?:\..+)?$/i,
  /(?:^|[\\/])auth\.json(?:\..+)?$/i,
  /(?:^|[\\/])ha\.json(?:\..+)?$/i,
  /(?:^|[\\/])(?:credentials?|secrets?)(?:\.[^\\/]+)?$/i,
  /(?:^|[\\/])\.(?:ssh|aws|gnupg)(?:[\\/]|$)/i,
];

export function isBlockedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function truncateGrepLine(line: string, maxChars = GREP_MAX_LINE_LENGTH): { text: string; wasTruncated: boolean } {
  if (line.length <= maxChars) {
    return { text: line, wasTruncated: false };
  }
  return { text: `${line.slice(0, maxChars)}... [truncated]`, wasTruncated: true };
}

export function getArtifactDir(): string {
  return process.env.PI_COMMAND_ARTIFACTS_DIR || join(tmpdir(), "pi-command-artifacts");
}

export async function saveArtifact(
  prefix: string,
  content: string,
  customDir?: string
): Promise<{ path: string; hash: string }> {
  const dir = customDir || getArtifactDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const hash = createHash("sha256").update(content, "utf-8").digest("hex").slice(0, 16);
  const artifactPath = join(dir, `${prefix}-${hash}.txt`);
  await writeFile(artifactPath, content, { encoding: "utf-8", mode: 0o600 });
  return { path: artifactPath, hash };
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details?: Record<string, unknown>;
  isError?: boolean;
}

export interface ExecutionOptions {
  artifactDir?: string;
}

export async function executeLs(
  _toolCallId: string,
  params: { path?: string; limit?: number },
  signal?: AbortSignal,
  _onUpdate?: unknown,
  ctx?: { cwd?: string },
  options?: ExecutionOptions
): Promise<ToolResult> {
  if (signal?.aborted) throw new Error("Operation aborted");

  const cwd = ctx?.cwd ?? process.cwd();
  const rawPath = params.path || ".";
  const targetPath = resolve(cwd, rawPath);

  if (isBlockedPath(targetPath)) {
    throw new Error(`Access denied: "${rawPath}" matches a blocked sensitive/secret path.`);
  }

  let dirStat;
  try {
    dirStat = await stat(targetPath);
  } catch {
    throw new Error(`Path not found: ${targetPath}`);
  }

  if (!dirStat.isDirectory()) {
    throw new Error(`Not a directory: ${targetPath}`);
  }

  let rawEntries: string[];
  try {
    rawEntries = await readdir(targetPath);
  } catch (err: any) {
    throw new Error(`Cannot read directory: ${err.message}`);
  }

  // Deterministic sorting with Unicode support
  rawEntries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) || a.localeCompare(b));

  const fullResults: string[] = [];
  for (const entry of rawEntries) {
    if (signal?.aborted) throw new Error("Operation aborted");
    const fullEntryPath = join(targetPath, entry);
    let suffix = "";
    try {
      const entryStat = await stat(fullEntryPath);
      if (entryStat.isDirectory()) {
        suffix = "/";
      }
    } catch {
      // NOTE: broken symlinks or unreadable entries keep plain name without slash
    }
    fullResults.push(entry + suffix);
  }

  if (fullResults.length === 0) {
    return { content: [{ type: "text", text: "(empty directory)" }] };
  }

  const effectiveLimit = Math.max(1, params.limit ?? DEFAULT_LS_LIMIT);
  const fullContent = fullResults.join("\n");
  const totalEntries = fullResults.length;
  const totalBytes = Buffer.byteLength(fullContent, "utf-8");
  const entryLimitReached = totalEntries > effectiveLimit;
  const byteLimitReached = totalBytes > DEFAULT_MAX_BYTES;

  if (!entryLimitReached && !byteLimitReached) {
    return { content: [{ type: "text", text: fullContent }] };
  }

  const { path: artifactPath } = await saveArtifact("ls", fullContent, options?.artifactDir);

  const previewEntries: string[] = [];
  let previewBytes = 0;
  for (let i = 0; i < Math.min(totalEntries, effectiveLimit); i++) {
    const entry = fullResults[i];
    const entryBytes = Buffer.byteLength(entry, "utf-8") + (i > 0 ? 1 : 0);
    if (previewBytes + entryBytes > DEFAULT_MAX_BYTES && previewEntries.length > 0) {
      break;
    }
    previewEntries.push(entry);
    previewBytes += entryBytes;
  }

  const previewCount = previewEntries.length;
  const previewText = previewEntries.join("\n");
  const nextOffset = previewCount + 1;
  const remaining = totalEntries - previewCount;

  const notices: string[] = [];
  if (entryLimitReached) {
    notices.push(`${effectiveLimit} entries limit reached`);
  }
  if (byteLimitReached) {
    notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
  }
  const noticeHeader = notices.join(". ");
  const paginationMsg = `\n\n[${noticeHeader} (showing 1-${previewCount} of ${totalEntries} entries). Full output: ${artifactPath}. Use read tool: read(path="${artifactPath}", offset=${nextOffset}, limit=${Math.min(remaining, effectiveLimit)}) to continue.]`;

  return {
    content: [{ type: "text", text: previewText + paginationMsg }],
    details: {
      entryLimitReached: entryLimitReached ? effectiveLimit : undefined,
      truncation: byteLimitReached ? { truncated: true, maxBytes: DEFAULT_MAX_BYTES } : undefined,
      artifactPath,
      fullOutputPath: artifactPath,
      totalEntries,
      previewCount,
    },
  };
}

export async function executeGrep(
  _toolCallId: string,
  params: {
    pattern: string;
    path?: string;
    glob?: string;
    ignoreCase?: boolean;
    literal?: boolean;
    context?: number;
    limit?: number;
  },
  signal?: AbortSignal,
  _onUpdate?: unknown,
  ctx?: { cwd?: string },
  options?: ExecutionOptions
): Promise<ToolResult> {
  if (signal?.aborted) throw new Error("Operation aborted");

  const cwd = ctx?.cwd ?? process.cwd();
  const rawPath = params.path || ".";
  const targetPath = resolve(cwd, rawPath);

  if (isBlockedPath(targetPath)) {
    throw new Error(`Access denied: "${rawPath}" matches a blocked sensitive/secret path. Refusing to search secrets.`);
  }

  let targetStat;
  try {
    targetStat = await stat(targetPath);
  } catch {
    throw new Error(`Path not found: ${targetPath}`);
  }

  const isDirectory = targetStat.isDirectory();
  const contextValue = params.context && params.context > 0 ? params.context : 0;
  const effectiveLimit = Math.max(1, params.limit ?? DEFAULT_GREP_LIMIT);

  const formatPath = (filePath: string) => {
    if (isDirectory) {
      const rel = relative(targetPath, filePath);
      if (rel && !rel.startsWith("..")) {
        return rel.replace(/\\/g, "/");
      }
    }
    return basename(filePath);
  };

  const rgArgs = ["--json", "--line-number", "--color=never", "--hidden"];
  rgArgs.push(
    "--glob", "!**/.env*",
    "--glob", "!**/auth.json*",
    "--glob", "!**/ha.json*",
    "--glob", "!**/*credential*",
    "--glob", "!**/*secret*",
    "--glob", "!**/.ssh/**",
    "--glob", "!**/.aws/**",
    "--glob", "!**/.gnupg/**"
  );

  if (params.ignoreCase) rgArgs.push("--ignore-case");
  if (params.literal) rgArgs.push("--fixed-strings");
  if (params.glob) rgArgs.push("--glob", params.glob);
  rgArgs.push("--", params.pattern, targetPath);

  const rgCmd = process.env.RG_PATH || "rg";
  const child = spawn(rgCmd, rgArgs, { stdio: ["ignore", "pipe", "pipe"] });

  const rl = createInterface({ input: child.stdout });
  let stderr = "";
  const rawMatches: Array<{ filePath: string; lineNumber: number; lineText?: string }> = [];

  const onAbort = () => {
    if (!child.killed) child.kill();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      if (event.type === "match") {
        const filePath = event.data?.path?.text;
        const lineNumber = event.data?.line_number;
        const lineText = event.data?.lines?.text;
        if (filePath && typeof lineNumber === "number" && !isBlockedPath(filePath)) {
          rawMatches.push({ filePath, lineNumber, lineText });
        }
      }
    } catch (err: any) {
      // NOTE: ignore non-JSON diagnostic lines from ripgrep output stream: ${err?.message}
    }
  });

  const exitCode: number = await new Promise((res, rej) => {
    child.on("error", (err) => {
      rl.close();
      signal?.removeEventListener("abort", onAbort);
      rej(new Error(`Failed to run ripgrep: ${err.message}`));
    });
    child.on("close", (code) => {
      rl.close();
      signal?.removeEventListener("abort", onAbort);
      res(code ?? 0);
    });
  });

  if (signal?.aborted) throw new Error("Operation aborted");

  if (exitCode !== 0 && exitCode !== 1) {
    const errorMsg = stderr.trim() || `ripgrep exited with code ${exitCode}`;
    throw new Error(errorMsg);
  }

  if (rawMatches.length === 0) {
    return { content: [{ type: "text", text: "No matches found" }] };
  }

  // Deterministic ordering by path then line number
  rawMatches.sort((a, b) => {
    const pCmp = a.filePath.toLowerCase().localeCompare(b.filePath.toLowerCase()) || a.filePath.localeCompare(b.filePath);
    if (pCmp !== 0) return pCmp;
    return a.lineNumber - b.lineNumber;
  });

  const fileLinesCache = new Map<string, string[]>();
  const getFileLines = async (filePath: string): Promise<string[]> => {
    let cached = fileLinesCache.get(filePath);
    if (!cached) {
      if (isBlockedPath(filePath)) return [];
      try {
        const fileContent = await readFile(filePath, "utf-8");
        cached = fileContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      } catch (err: any) {
        // NOTE: unreadable file context falls back to empty lines: ${err?.message}
        cached = [];
      }
      fileLinesCache.set(filePath, cached);
    }
    return cached;
  };

  interface MatchFormatItem {
    fullLines: string[];
    previewLines: string[];
    hasLineTruncation: boolean;
  }

  const formatItems: MatchFormatItem[] = [];

  for (const match of rawMatches) {
    const relPath = formatPath(match.filePath);
    if (contextValue === 0 && match.lineText !== undefined) {
      const sanitized = match.lineText.replace(/\r\n/g, "\n").replace(/\r/g, "").replace(/\n$/, "");
      const fullLine = `${relPath}:${match.lineNumber}: ${sanitized}`;
      const truncated = truncateGrepLine(sanitized);
      const previewLine = `${relPath}:${match.lineNumber}: ${truncated.text}`;
      formatItems.push({
        fullLines: [fullLine],
        previewLines: [previewLine],
        hasLineTruncation: truncated.wasTruncated,
      });
    } else {
      const lines = await getFileLines(match.filePath);
      const fullBlock: string[] = [];
      const previewBlock: string[] = [];
      let blockTruncated = false;

      if (!lines.length) {
        const errorLine = `${relPath}:${match.lineNumber}: (unable to read file)`;
        fullBlock.push(errorLine);
        previewBlock.push(errorLine);
      } else {
        const start = contextValue > 0 ? Math.max(1, match.lineNumber - contextValue) : match.lineNumber;
        const end = contextValue > 0 ? Math.min(lines.length, match.lineNumber + contextValue) : match.lineNumber;
        for (let current = start; current <= end; current++) {
          const lineText = (lines[current - 1] ?? "").replace(/\r/g, "");
          const isMatchLine = current === match.lineNumber;
          const sep = isMatchLine ? ":" : "-";
          const fullLine = `${relPath}${sep}${current}${sep} ${lineText}`;
          const truncated = truncateGrepLine(lineText);
          if (truncated.wasTruncated) blockTruncated = true;
          const previewLine = `${relPath}${sep}${current}${sep} ${truncated.text}`;
          fullBlock.push(fullLine);
          previewBlock.push(previewLine);
        }
      }
      formatItems.push({
        fullLines: fullBlock,
        previewLines: previewBlock,
        hasLineTruncation: blockTruncated,
      });
    }
  }

  const allFullLines = formatItems.flatMap((item) => item.fullLines);
  const fullRawText = allFullLines.join("\n");
  const totalMatches = rawMatches.length;
  const totalFullLines = allFullLines.length;

  const matchLimitReached = totalMatches > effectiveLimit;
  const byteLimitReached = Buffer.byteLength(fullRawText, "utf-8") > DEFAULT_MAX_BYTES;

  // Build preview items up to effectiveLimit matches and DEFAULT_MAX_BYTES
  const previewLines: string[] = [];
  let previewBytes = 0;
  let previewMatches = 0;
  let previewHasTruncatedLines = false;

  for (let i = 0; i < Math.min(totalMatches, effectiveLimit); i++) {
    const item = formatItems[i];
    const itemLines = item.previewLines;
    const itemBytes = Buffer.byteLength(itemLines.join("\n"), "utf-8") + (previewLines.length > 0 ? 1 : 0);

    if (previewBytes + itemBytes > DEFAULT_MAX_BYTES && previewLines.length > 0) {
      break;
    }

    previewLines.push(...itemLines);
    previewBytes += itemBytes;
    previewMatches++;
    if (item.hasLineTruncation) {
      previewHasTruncatedLines = true;
    }
  }

  const needsArtifact = matchLimitReached || byteLimitReached || previewHasTruncatedLines;

  if (!needsArtifact) {
    return { content: [{ type: "text", text: fullRawText }] };
  }

  const { path: artifactPath } = await saveArtifact("grep", fullRawText, options?.artifactDir);

  const nextOffset = previewLines.length + 1;
  const remaining = totalFullLines - previewLines.length;

  const notices: string[] = [];
  if (matchLimitReached) {
    notices.push(`${effectiveLimit} matches limit reached`);
  }
  if (byteLimitReached) {
    notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`);
  }
  if (previewHasTruncatedLines) {
    notices.push(`Some lines truncated to ${GREP_MAX_LINE_LENGTH} chars in preview`);
  }

  const noticeHeader = notices.join(". ");
  const paginationMsg = `\n\n[${noticeHeader} (showing 1-${previewMatches} of ${totalMatches} matches, ${previewLines.length} lines). Full output: ${artifactPath}. Use read tool: read(path="${artifactPath}", offset=${nextOffset}, limit=${Math.min(remaining, 100)}) to continue.]`;

  return {
    content: [{ type: "text", text: previewLines.join("\n") + paginationMsg }],
    details: {
      matchLimitReached: matchLimitReached ? effectiveLimit : undefined,
      truncation: byteLimitReached ? { truncated: true, maxBytes: DEFAULT_MAX_BYTES } : undefined,
      linesTruncated: previewHasTruncatedLines,
      artifactPath,
      fullOutputPath: artifactPath,
      totalMatches,
      previewMatches,
    },
  };
}

export function createLsTool(options?: ExecutionOptions) {
  return {
    name: "ls",
    label: "ls",
    description: `List directory contents. Returns entries sorted alphabetically, with '/' suffix for directories. Includes dotfiles. Output is truncated to ${DEFAULT_LS_LIMIT} entries or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). When limits are reached, the complete result is preserved in a readable local artifact.`,
    parameters: lsSchema,
    async execute(toolCallId: string, params: { path?: string; limit?: number }, signal?: AbortSignal, onUpdate?: unknown, ctx?: { cwd?: string }) {
      return executeLs(toolCallId, params, signal, onUpdate, ctx, options);
    },
  };
}

export function createGrepTool(options?: ExecutionOptions) {
  return {
    name: "grep",
    label: "grep",
    description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore and excludes secret files. Output is truncated to ${DEFAULT_GREP_LIMIT} matches or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Long lines are truncated in preview. When limits are reached, the complete result is preserved in a readable local artifact.`,
    parameters: grepSchema,
    async execute(
      toolCallId: string,
      params: {
        pattern: string;
        path?: string;
        glob?: string;
        ignoreCase?: boolean;
        literal?: boolean;
        context?: number;
        limit?: number;
      },
      signal?: AbortSignal,
      onUpdate?: unknown,
      ctx?: { cwd?: string }
    ) {
      return executeGrep(toolCallId, params, signal, onUpdate, ctx, options);
    },
  };
}

export default function commandArtifactsExtension(pi: ExtensionAPI) {
  pi.registerTool(createLsTool());
  pi.registerTool(createGrepTool());
}
