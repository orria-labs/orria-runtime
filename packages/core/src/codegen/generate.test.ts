import { afterEach, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createTempProject } from "../test-utils.ts";
import { generateCoreArtifacts } from "./generate.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

describe("generateCoreArtifacts", () => {
  it("writes generated manifest and typed bus declarations", async () => {
    const project = await projectWithFiles({
      "src/modules/user/create.action.ts": declarationModule("action"),
      "src/modules/user/registered.event.ts": declarationEventModule(),
    });

    await generateCoreArtifacts({ rootDir: project.rootDir });

    const busSource = await readFile(path.join(project.rootDir, "src/generated/core/bus.d.ts"), "utf8");
    const manifestSource = await readFile(path.join(project.rootDir, "src/generated/core/manifest.ts"), "utf8");

    expect(busSource).toContain("export interface ActionBusShape");
    expect(busSource).toContain("create: ExecutableBusMethod<actionUserCreate>");
    expect(busSource).not.toContain(": any");
    expect(manifestSource).toContain('key: "action.user.create"');
    expect(manifestSource).toContain('import actionUserCreate from "../../modules/user/create.action.ts";');
  });

  it("fails when file suffix and declaration kind do not match", async () => {
    const project = await projectWithFiles({
      "src/modules/user/broken.action.ts": wrongDeclarationModule(),
    });

    await expect(generateCoreArtifacts({ rootDir: project.rootDir })).rejects.toThrow(
      'uses suffix for "action" but exports "query" declaration',
    );
  });
});

async function projectWithFiles(files: Record<string, string>) {
  const project = await createTempProject(files);
  cleanups.push(project.cleanup);
  return project;
}

function declarationModule(kind: "action"): string {
  const defineImport = path.join(import.meta.dir, "..", "define.ts").split(path.sep).join("/");

  return `import { defineAction } from "${defineImport}";

export default defineAction<{ email: string }, string>({
  handle: ({ input }) => input.email,
});
`;
}

function declarationEventModule(): string {
  const defineImport = path.join(import.meta.dir, "..", "define.ts").split(path.sep).join("/");

  return `import { defineEvent } from "${defineImport}";

export default defineEvent<{ email: string }>({
  version: 1,
});
`;
}

function wrongDeclarationModule(): string {
  const defineImport = path.join(import.meta.dir, "..", "define.ts").split(path.sep).join("/");

  return `import { defineQuery } from "${defineImport}";

export default defineQuery<{ email: string }, string>({
  handle: ({ input }) => input.email,
});
`;
}
