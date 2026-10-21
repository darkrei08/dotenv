import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import commandArtifactsExtension, {
  DEFAULT_MAX_BYTES,
  DEFAULT_LS_LIMIT,
  DEFAULT_GREP_LIMIT,
  executeLs,
  executeGrep,
  isBlockedPath,
  saveArtifact,
  truncateGrepLine,
  createLsTool,
  createGrepTool,
} from "./command-artifacts";

describe("command-artifacts", () => {
  describe("isBlockedPath", () => {
    test("detects sensitive and secret paths", () => {
      expect(isBlockedPath(".env")).toBe(true);
      expect(isBlockedPath(".env.local")).toBe(true);
      expect(isBlockedPath("/foo/bar/.env.production")).toBe(true);
      expect(isBlockedPath("auth.json")).toBe(true);
      expect(isBlockedPath("/root/.pi/agent/auth.json")).toBe(true);
      expect(isBlockedPath("ha.json")).toBe(true);
      expect(isBlockedPath("/tmp/ha.json.bak")).toBe(true);
      expect(isBlockedPath("credentials.json")).toBe(true);
      expect(isBlockedPath("credential.yml")).toBe(true);
      expect(isBlockedPath("secrets.json")).toBe(true);
      expect(isBlockedPath("secret.toml")).toBe(true);
      expect(isBlockedPath("/home/user/.ssh/id_rsa")).toBe(true);
      expect(isBlockedPath("/root/.aws/credentials")).toBe(true);
      expect(isBlockedPath("/root/.gnupg/secring.gpg")).toBe(true);

      // Safe paths
      expect(isBlockedPath("README.md")).toBe(false);
      expect(isBlockedPath("src/index.ts")).toBe(false);
      expect(isBlockedPath("pi/agent/settings.json")).toBe(false);
      expect(isBlockedPath("pi/agent/package.json")).toBe(false);
    });
  });

  describe("saveArtifact", () => {
    test("stores content-addressed local artifact with safe permissions", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-artifact-"));
      try {
        const text = "sample artifact content";
        const res1 = await saveArtifact("test", text, testDir);
        expect(res1.path).toContain("test-");
        expect(res1.hash).toBeDefined();

        const fileContent = await Bun.file(res1.path).text();
        expect(fileContent).toBe(text);

        // Same content gives identical hash
        const res2 = await saveArtifact("test", text, testDir);
        expect(res2.path).toBe(res1.path);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("ls", () => {
    test("lists empty directory with (empty directory)", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-ls-empty-"));
      try {
        const result = await executeLs("1", { path: testDir }, undefined, undefined, { cwd: testDir });
        expect(result.content[0].text).toBe("(empty directory)");
        expect(result.details).toBeUndefined();
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("stdout-equivalent content: directory entries sorted with / suffix for dirs", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-ls-normal-"));
      try {
        await writeFile(join(testDir, "b.txt"), "b");
        await writeFile(join(testDir, "a.txt"), "a");
        await mkdir(join(testDir, "subDir"));

        const result = await executeLs("1", { path: testDir }, undefined, undefined, { cwd: testDir });
        const lines = result.content[0].text.split("\n");
        expect(lines).toEqual(["a.txt", "b.txt", "subDir/"]);
        expect(result.details).toBeUndefined();
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("deterministic ordering and Unicode support", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-ls-unicode-"));
      try {
        await writeFile(join(testDir, "café.txt"), "coffee");
        await writeFile(join(testDir, "apple.txt"), "apple");
        await writeFile(join(testDir, "Apple.txt"), "Apple");
        await writeFile(join(testDir, "日本語.txt"), "japanese");
        await mkdir(join(testDir, "📁_folder"));

        const result = await executeLs("1", { path: testDir }, undefined, undefined, { cwd: testDir });
        const lines = result.content[0].text.split("\n");
        expect(lines).toContain("café.txt");
        expect(lines).toContain("日本語.txt");
        expect(lines).toContain("📁_folder/");

        // Check case-insensitive tie break
        const appleIndex = lines.indexOf("apple.txt");
        const capAppleIndex = lines.indexOf("Apple.txt");
        expect(appleIndex).not.toBe(-1);
        expect(capAppleIndex).not.toBe(-1);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("stderr/errors: non-existent path and non-directory", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-ls-err-"));
      try {
        const filePath = join(testDir, "file.txt");
        await writeFile(filePath, "data");

        // Non-existent
        expect(
          executeLs("1", { path: join(testDir, "does-not-exist") }, undefined, undefined, { cwd: testDir })
        ).rejects.toThrow("Path not found");

        // Non-directory
        expect(
          executeLs("1", { path: filePath }, undefined, undefined, { cwd: testDir })
        ).rejects.toThrow("Not a directory");
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("secrets protection: blocks blocked paths", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-ls-sec-"));
      try {
        const envDir = join(testDir, ".env");
        await mkdir(envDir);

        expect(
          executeLs("1", { path: envDir }, undefined, undefined, { cwd: testDir })
        ).rejects.toThrow("Access denied");
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("entry limit reached: returns bounded preview, artifact path, and exact pagination", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-ls-limit-"));
      const artifactDir = await mkdtemp(join(tmpdir(), "pi-test-ls-art-"));
      try {
        // Create 15 files
        for (let i = 1; i <= 15; i++) {
          const num = String(i).padStart(2, "0");
          await writeFile(join(testDir, `item_${num}.txt`), `item ${num}`);
        }

        const limit = 5;
        const result = await executeLs(
          "1",
          { path: testDir, limit },
          undefined,
          undefined,
          { cwd: testDir },
          { artifactDir }
        );

        const text = result.content[0].text;
        expect(text).toContain("5 entries limit reached");
        expect(text).toContain("Full output: ");
        expect(text).toContain("read(path=");
        expect(text).toContain("offset=6");
        expect(result.details?.entryLimitReached).toBe(5);
        expect(result.details?.totalEntries).toBe(15);
        expect(result.details?.artifactPath).toBeDefined();

        // Read the artifact directly to verify zero data loss
        const artifactContent = await Bun.file(result.details!.artifactPath!).text();
        const artifactLines = artifactContent.split("\n");
        expect(artifactLines.length).toBe(15);
        expect(artifactLines[0]).toBe("item_01.txt");
        expect(artifactLines[14]).toBe("item_15.txt");

        // Verify pagination reconstructs full results without data loss
        const previewPart = text.split("\n\n[")[0].split("\n");
        expect(previewPart.length).toBe(5);
        const paginatedPart = artifactLines.slice(5); // offset=6 (1-indexed)
        const reconstructed = [...previewPart, ...paginatedPart];
        expect(reconstructed).toEqual(artifactLines);
      } finally {
        await rm(testDir, { recursive: true, force: true });
        await rm(artifactDir, { recursive: true, force: true });
      }
    });

    test("byte limit reached: returns bounded preview and artifact", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-ls-bytes-"));
      const artifactDir = await mkdtemp(join(tmpdir(), "pi-test-ls-art2-"));
      try {
        // Create 300 files with 180-character names (300 * 180 > 54KB > 51200 bytes)
        for (let i = 0; i < 300; i++) {
          const name = `file_${String(i).padStart(3, "0")}_${"x".repeat(170)}.txt`;
          await writeFile(join(testDir, name), "x");
        }

        const result = await executeLs(
          "1",
          { path: testDir, limit: 1000 },
          undefined,
          undefined,
          { cwd: testDir },
          { artifactDir }
        );

        const text = result.content[0].text;
        expect(text).toContain("50.0KB limit reached");
        expect(result.details?.artifactPath).toBeDefined();

        const artifactContent = await Bun.file(result.details!.artifactPath!).text();
        const artifactLines = artifactContent.split("\n");
        expect(artifactLines.length).toBe(300);
      } finally {
        await rm(testDir, { recursive: true, force: true });
        await rm(artifactDir, { recursive: true, force: true });
      }
    });
  });

  describe("grep", () => {
    test("empty output / no matches found returns No matches found", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-none-"));
      try {
        await writeFile(join(testDir, "test.txt"), "hello world");
        const result = await executeGrep(
          "1",
          { pattern: "nonexistent_string_12345", path: testDir },
          undefined,
          undefined,
          { cwd: testDir }
        );
        expect(result.content[0].text).toBe("No matches found");
        expect(result.details).toBeUndefined();
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("stdout-equivalent content: matches lines with file path and line number", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-match-"));
      try {
        await writeFile(join(testDir, "test1.txt"), "foo\nbar\nfoo bar\n");
        await writeFile(join(testDir, "test2.txt"), "baz\nfoo\n");

        const result = await executeGrep(
          "1",
          { pattern: "foo", path: testDir },
          undefined,
          undefined,
          { cwd: testDir }
        );

        const lines = result.content[0].text.split("\n");
        expect(lines).toContain("test1.txt:1: foo");
        expect(lines).toContain("test1.txt:3: foo bar");
        expect(lines).toContain("test2.txt:2: foo");
        expect(result.details).toBeUndefined();
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("stderr/errors: invalid regex and non-existent path", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-err-"));
      try {
        await writeFile(join(testDir, "test.txt"), "sample");

        // Non-existent path
        expect(
          executeGrep("1", { pattern: "sample", path: join(testDir, "missing") }, undefined, undefined, { cwd: testDir })
        ).rejects.toThrow("Path not found");

        // Invalid regex
        expect(
          executeGrep("1", { pattern: "[unclosed", path: testDir }, undefined, undefined, { cwd: testDir })
        ).rejects.toThrow();
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("deterministic ordering: matches sorted by path then line number", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-order-"));
      try {
        await writeFile(join(testDir, "z.txt"), "match 1\nmatch 2\n");
        await writeFile(join(testDir, "a.txt"), "match 10\nmatch 20\n");

        const result = await executeGrep(
          "1",
          { pattern: "match", path: testDir },
          undefined,
          undefined,
          { cwd: testDir }
        );

        const lines = result.content[0].text.split("\n");
        expect(lines[0]).toBe("a.txt:1: match 10");
        expect(lines[1]).toBe("a.txt:2: match 20");
        expect(lines[2]).toBe("z.txt:1: match 1");
        expect(lines[3]).toBe("z.txt:2: match 2");
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("Unicode support: matches and preserves multi-byte characters", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-uni-"));
      try {
        await writeFile(join(testDir, "i18n.txt"), "hello 世界\nbonjour café ☕\n");

        const result = await executeGrep(
          "1",
          { pattern: "世界|café", path: testDir },
          undefined,
          undefined,
          { cwd: testDir }
        );

        const lines = result.content[0].text.split("\n");
        expect(lines).toContain("i18n.txt:1: hello 世界");
        expect(lines).toContain("i18n.txt:2: bonjour café ☕");
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    test("long lines: preview truncates to 500 chars, artifact keeps full line", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-long-"));
      const artifactDir = await mkdtemp(join(tmpdir(), "pi-test-grep-art-"));
      try {
        const longText = "PREFIX_" + "A".repeat(1200) + "_SUFFIX";
        await writeFile(join(testDir, "long.txt"), `${longText}\n`);

        const result = await executeGrep(
          "1",
          { pattern: "PREFIX_", path: testDir },
          undefined,
          undefined,
          { cwd: testDir },
          { artifactDir }
        );

        const text = result.content[0].text;
        expect(text).toContain("Some lines truncated to 500 chars in preview");
        expect(text).toContain("... [truncated]");
        expect(result.details?.linesTruncated).toBe(true);
        expect(result.details?.artifactPath).toBeDefined();

        // Artifact has complete full line without loss
        const artifactContent = await Bun.file(result.details!.artifactPath!).text();
        expect(artifactContent).toContain(longText);
        expect(artifactContent).toContain("_SUFFIX");
      } finally {
        await rm(testDir, { recursive: true, force: true });
        await rm(artifactDir, { recursive: true, force: true });
      }
    });

    test("match limit reached: returns preview, artifact path, and exact pagination", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-limit-"));
      const artifactDir = await mkdtemp(join(tmpdir(), "pi-test-grep-art2-"));
      try {
        const fileLines: string[] = [];
        for (let i = 1; i <= 25; i++) {
          fileLines.push(`line ${i}: target_token`);
        }
        await writeFile(join(testDir, "all.txt"), fileLines.join("\n"));

        const limit = 10;
        const result = await executeGrep(
          "1",
          { pattern: "target_token", path: testDir, limit },
          undefined,
          undefined,
          { cwd: testDir },
          { artifactDir }
        );

        const text = result.content[0].text;
        expect(text).toContain("10 matches limit reached");
        expect(text).toContain("Full output: ");
        expect(text).toContain("read(path=");
        expect(text).toContain("offset=11");
        expect(result.details?.matchLimitReached).toBe(10);
        expect(result.details?.totalMatches).toBe(25);
        expect(result.details?.artifactPath).toBeDefined();

        // Check artifact has all 25 lines
        const artifactContent = await Bun.file(result.details!.artifactPath!).text();
        const artifactLines = artifactContent.split("\n");
        expect(artifactLines.length).toBe(25);

        // Pagination check: lines 1-10 from preview, lines 11-25 from artifact
        const previewLines = text.split("\n\n[")[0].split("\n");
        expect(previewLines.length).toBe(10);
        const paginatedLines = artifactLines.slice(10); // offset=11 (1-indexed)
        expect(paginatedLines.length).toBe(15);
        expect([...previewLines, ...paginatedLines]).toEqual(artifactLines);
      } finally {
        await rm(testDir, { recursive: true, force: true });
        await rm(artifactDir, { recursive: true, force: true });
      }
    });

    test("secrets protection: directory search excludes secret files automatically", async () => {
      const testDir = await mkdtemp(join(tmpdir(), "pi-test-grep-sec-"));
      try {
        await writeFile(join(testDir, ".env"), "SECRET_KEY=12345");
        await writeFile(join(testDir, "auth.json"), '{"token": "secret12345"}');
        await writeFile(join(testDir, "credentials.json"), '{"pass": "secret12345"}');
        await writeFile(join(testDir, "public.txt"), "SECRET_KEY in normal file");

        const result = await executeGrep(
          "1",
          { pattern: "SECRET_KEY|secret12345", path: testDir },
          undefined,
          undefined,
          { cwd: testDir }
        );

        const text = result.content[0].text;
        expect(text).toContain("public.txt:1: SECRET_KEY in normal file");
        expect(text).not.toContain(".env");
        expect(text).not.toContain("auth.json");
        expect(text).not.toContain("credentials.json");

        // Explicit search directly on .env is blocked
        expect(
          executeGrep("1", { pattern: "SECRET_KEY", path: join(testDir, ".env") }, undefined, undefined, { cwd: testDir })
        ).rejects.toThrow("Access denied");
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("Extension registration", () => {
    test("registers ls and grep tools with expected names and parameter schemas", () => {
      const registeredTools: any[] = [];
      const mockPi: any = {
        registerTool: (tool: any) => registeredTools.push(tool),
      };

      commandArtifactsExtension(mockPi);
      expect(registeredTools.length).toBe(2);
      const toolNames = registeredTools.map((t) => t.name);
      expect(toolNames).toContain("ls");
      expect(toolNames).toContain("grep");

      const lsTool = registeredTools.find((t) => t.name === "ls");
      expect(lsTool.parameters.properties).toHaveProperty("path");
      expect(lsTool.parameters.properties).toHaveProperty("limit");

      const grepTool = registeredTools.find((t) => t.name === "grep");
      expect(grepTool.parameters.properties).toHaveProperty("pattern");
      expect(grepTool.parameters.properties).toHaveProperty("path");
      expect(grepTool.parameters.properties).toHaveProperty("glob");
      expect(grepTool.parameters.properties).toHaveProperty("ignoreCase");
      expect(grepTool.parameters.properties).toHaveProperty("literal");
      expect(grepTool.parameters.properties).toHaveProperty("context");
      expect(grepTool.parameters.properties).toHaveProperty("limit");
    });
  });
});


