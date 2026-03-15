import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { initializeProjectScaffold } from "./init.ts";

describe("initializeProjectScaffold gitignore", () => {
  it("creates the default gitignore when the file is empty", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-init-gitignore-empty-"));

    try {
      await writeFile(path.join(rootDir, ".gitignore"), "", "utf8");

      await initializeProjectScaffold({
        dir: rootDir,
        name: "demo-app",
        adapters: [],
        version: "1.0.0-rc.1",
      });

      const gitIgnore = await readFile(path.join(rootDir, ".gitignore"), "utf8");

      expect(gitIgnore).toContain("# dependencies (bun install)");
      expect(gitIgnore).toContain("node_modules");
      expect(gitIgnore).toContain("# output");
      expect(gitIgnore).toContain("dist");
      expect(gitIgnore).toContain("# Finder (MacOS) folder config");
      expect(gitIgnore).toContain(".DS_Store");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("merges missing gitignore entries into an existing file", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-init-gitignore-merge-"));

    try {
      await writeFile(path.join(rootDir, ".gitignore"), "custom-cache\nnode_modules\n", "utf8");

      await initializeProjectScaffold({
        dir: rootDir,
        name: "demo-app",
        adapters: [],
        version: "1.0.0-rc.1",
      });

      const gitIgnore = await readFile(path.join(rootDir, ".gitignore"), "utf8");

      expect(gitIgnore).toContain("custom-cache");
      expect(gitIgnore).toContain("# output");
      expect(gitIgnore).toContain("out");
      expect(gitIgnore).toContain("dist");
      expect(gitIgnore).toContain("# dotenv environment variable files");
      expect(gitIgnore).toContain(".env.local");
      expect(gitIgnore.match(/^node_modules$/gm)?.length).toBe(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
