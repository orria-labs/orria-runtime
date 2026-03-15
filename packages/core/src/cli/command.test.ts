import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { readPackageVersion } from "./command.ts";

describe("readPackageVersion", () => {
  it("finds the runtime package manifest in source layout", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-cli-src-"));

    try {
      await mkdir(path.join(rootDir, "src", "cli"), { recursive: true });
      await writeFile(
        path.join(rootDir, "package.json"),
        JSON.stringify({ name: "@orria-labs/runtime", version: "1.2.3-src" }),
        "utf8",
      );

      const version = await readPackageVersion(new URL(path.join(rootDir, "src", "cli", "command.ts"), "file:").href);

      expect(version).toBe("1.2.3-src");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("finds the runtime package manifest in published dist layout", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-cli-dist-"));

    try {
      await mkdir(path.join(rootDir, "cli"), { recursive: true });
      await writeFile(
        path.join(rootDir, "package.json"),
        JSON.stringify({ name: "@orria-labs/runtime", version: "1.2.3-dist" }),
        "utf8",
      );

      const version = await readPackageVersion(new URL(path.join(rootDir, "cli", "main.js"), "file:").href);

      expect(version).toBe("1.2.3-dist");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
