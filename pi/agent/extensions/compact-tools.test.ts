import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { imageSourcesForResult, redactSensitive } from "./compact-rendering.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const PNG_BYTES = Buffer.from(PNG_BASE64, "base64");

type ClipboardImage = { bytes: Uint8Array; mimeType: string };
type ClipboardImageReader = (options?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}) => Promise<ClipboardImage | null>;

type ClipboardMode = "empty" | "png" | "powershell-png" | "powershell-error";

const configuredClipboardModule = process.env.PI_TEST_CLIPBOARD_IMAGE_MODULE;
const clipboardTest =
  configuredClipboardModule && existsSync(configuredClipboardModule)
    ? test
    : test.skip;

async function loadClipboardImageReader(): Promise<ClipboardImageReader> {
  const module = await import(
    pathToFileURL(configuredClipboardModule!).href
  );
  return module.readClipboardImage as ClipboardImageReader;
}

function writeExecutable(directory: string, name: string, source: string): void {
  const path = join(directory, name);
  writeFileSync(path, `#!/usr/bin/env node\n${source}`);
  chmodSync(path, 0o755);
}

async function withFakeClipboard(
  mode: ClipboardMode,
  callback: (readClipboardImage: ClipboardImageReader) => Promise<void>,
): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), "dotenv-clipboard-test-"));
  const previousPath = process.env.PATH;
  const previousHome = process.env.HOME;
  const previousPiDir = process.env.PI_CODING_AGENT_DIR;
  const previousWsl = process.env.WSL_DISTRO_NAME;
  const previousWayland = process.env.WAYLAND_DISPLAY;
  const previousMode = process.env.FAKE_CLIPBOARD_MODE;

  writeExecutable(
    directory,
    "wl-paste",
    `
const mode = process.env.FAKE_CLIPBOARD_MODE;
if (process.argv.includes("--list-types")) {
  process.stdout.write(mode === "png" ? "image/png\\n" : "");
} else if (mode === "png") {
  process.stdout.write(Buffer.from(${JSON.stringify(PNG_BASE64)}, "base64"));
}
`,
  );
  writeExecutable(
    directory,
    "wslpath",
    'process.stdout.write(process.argv.at(-1) ?? "");',
  );
  writeExecutable(
    directory,
    "xclip",
    'if (process.argv.includes("TARGETS")) process.stdout.write("UTF8_STRING\\n");',
  );
  writeExecutable(
    directory,
    "powershell.exe",
    `
const mode = process.env.FAKE_CLIPBOARD_MODE;
if (mode === "powershell-error") process.exit(1);
if (mode === "empty") {
  process.stdout.write("empty\\n");
  process.exit(0);
}
const command = process.argv.at(-1) ?? "";
const match = command.match(/\\$path = '([^']+)'/);
if (!match) process.exit(1);
require("node:fs").writeFileSync(
  match[1],
  Buffer.from(${JSON.stringify(PNG_BASE64)}, "base64"),
);
process.stdout.write("ok\\n");
`,
  );

  process.env.PATH = `${directory}:${previousPath ?? "/usr/bin:/bin"}`;
  process.env.HOME = directory;
  process.env.PI_CODING_AGENT_DIR = directory;
  process.env.WSL_DISTRO_NAME = "Ubuntu";
  process.env.WAYLAND_DISPLAY = "wayland-0";
  process.env.FAKE_CLIPBOARD_MODE = mode;

  try {
    await callback(await loadClipboardImageReader());
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousPiDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousPiDir;
    if (previousWsl === undefined) delete process.env.WSL_DISTRO_NAME;
    else process.env.WSL_DISTRO_NAME = previousWsl;
    if (previousWayland === undefined) delete process.env.WAYLAND_DISPLAY;
    else process.env.WAYLAND_DISPLAY = previousWayland;
    if (previousMode === undefined) delete process.env.FAKE_CLIPBOARD_MODE;
    else process.env.FAKE_CLIPBOARD_MODE = previousMode;
    rmSync(directory, { recursive: true, force: true });
  }
}

test("WezTerm hands the screenshot to Pi instead of copying a path string", () => {
  const config = readFileSync(
    new URL("../../../.wezterm.lua", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(config, /Set-Clipboard -Value/);
  assert.match(config, /act\.SendKey\(\{ key = "v", mods = "ALT" \}\)/);
});

test("image payloads: empty and valid PNG blocks are handled explicitly", () => {
  assert.deepEqual(
    imageSourcesForResult(
      { content: [{ type: "image", data: "", mimeType: "image/png" }] },
      true,
      60,
      { images: "kitty" },
    ),
    [],
  );

  assert.deepEqual(
    imageSourcesForResult(
      {
        content: [
          { type: "image", data: PNG_BASE64, mimeType: "image/png" },
        ],
      },
      true,
      60,
      { images: "kitty" },
    ),
    [{ data: PNG_BASE64, mimeType: "image/png", widthCells: 60 }],
  );
});

test("image payloads: incompatible terminals keep the text fallback", () => {
  assert.deepEqual(
    imageSourcesForResult(
      { content: [{ type: "image", data: PNG_BASE64, mimeType: "image/png" }] },
      true,
      60,
      { images: null },
    ),
    [],
  );
});

clipboardTest("clipboard fallback: reads a valid PNG from Wayland", async () => {
  await withFakeClipboard("png", async (readClipboardImage) => {
    const image = await readClipboardImage({
      env: { WSL_DISTRO_NAME: "Ubuntu", WAYLAND_DISPLAY: "wayland-0" },
      platform: "linux",
    });
    assert.ok(image);
    assert.equal(image.mimeType, "image/png");
    assert.deepEqual(Buffer.from(image.bytes), PNG_BYTES);
  });
});

clipboardTest("clipboard fallback: empty payload produces no image", async () => {
  await withFakeClipboard("empty", async (readClipboardImage) => {
    const image = await readClipboardImage({
      env: { WSL_DISTRO_NAME: "Ubuntu", WAYLAND_DISPLAY: "wayland-0" },
      platform: "linux",
    });
    assert.equal(image, null);
  });
});

clipboardTest("clipboard fallback: reads a PNG through PowerShell when Wayland is empty", async () => {
  await withFakeClipboard("powershell-png", async (readClipboardImage) => {
    const image = await readClipboardImage({
      env: { WSL_DISTRO_NAME: "Ubuntu", WAYLAND_DISPLAY: "wayland-0" },
      platform: "linux",
    });
    assert.ok(image);
    assert.equal(image.mimeType, "image/png");
    assert.deepEqual(Buffer.from(image.bytes), PNG_BYTES);
  });
});

clipboardTest("clipboard fallback: PowerShell failures produce an empty result", async () => {
  await withFakeClipboard("powershell-error", async (readClipboardImage) => {
    const image = await readClipboardImage({
      env: { WSL_DISTRO_NAME: "Ubuntu", WAYLAND_DISPLAY: "wayland-0" },
      platform: "linux",
    });
    assert.equal(image, null);
  });
});

test("details: redacts credentials before compact rendering", () => {
  assert.equal(
    redactSensitive(
      "token=secret-value Authorization: Bearer abc123 sk-12345678",
    ),
    "token=[redacted] Authorization: Bearer [redacted] [redacted]",
  );
});
