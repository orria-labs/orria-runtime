import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createApplication, defineAction } from "@orria-labs/runtime";
import type {
  ApplicationContext,
  BusTypesContract,
  ConfigStore,
  CreateApplicationOptions,
  DatabaseAdapter,
  HandlerInvocationMeta,
} from "@orria-labs/runtime";

import { createCliAdapter } from "./adapter.ts";
import { generateCliCommandRegistryArtifacts } from "./codegen/generate-command-registry.ts";
import {
  discoverCliCommandModules,
  discoverCliCommands,
  validateCliCommands,
} from "./discovery.ts";

interface TestBusTypes extends BusTypesContract {
  action: {
    user: {
      create: (
        input: { email: string },
        meta?: HandlerInvocationMeta,
      ) => Promise<string>;
    };
  };
  query: {};
  workflow: {};
  event: {};
}

type TestContext = ApplicationContext<TestBusTypes>;

describe("citty adapter", () => {
  it("discovers commands from filesystem and validates duplicates", async () => {
    const cliImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "package.json": JSON.stringify({ name: "cli-app", version: "1.2.3" }),
      "src/transport/cli/command/user/create.ts": `import { defineCommand } from "${cliImport}";

export default defineCommand({
  aliases: ["new"],
  run: () => "ok",
});
`,
      "src/transport/cli/command/system/version.ts": `import { defineCommand } from "${cliImport}";

export default defineCommand({
  run: () => "1.2.3",
});
`,
    });

    try {
      const modules = await discoverCliCommandModules({ rootDir: project.rootDir });
      const commands = await discoverCliCommands({ rootDir: project.rootDir });

      expect(modules.map((entry) => entry.path.join(" "))).toEqual([
        "system version",
        "user create",
      ]);
      expect(commands.map((entry) => (entry.path as string[]).join(" "))).toEqual([
        "system version",
        "user create",
      ]);

      expect(() =>
        validateCliCommands([
          { path: ["user", "create"] },
          { path: ["user", "create"] },
        ]),
      ).toThrow('Duplicate CLI command path "user create"');
    } finally {
      await project.cleanup();
    }
  });

  it("builds nested command tree, supports aliases and injects ctx", async () => {
    const cliImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "package.json": JSON.stringify({
        name: "cli-app",
        version: "2.0.0",
        description: "Test CLI",
      }),
      "src/transport/cli/command/user/create.ts": `import { defineCommand } from "${cliImport}";

export default defineCommand({
  aliases: ["new"],
  args: {
    email: {
      type: "string",
      required: true,
    },
  },
  run: async ({ ctx, args, commandPath }) => {
    const created = await ctx.action.user.create({ email: args.email });
    return created + ":" + commandPath.join(" ");
  },
});
`,
      "src/transport/cli/command/system/info.ts": `import { defineCommand } from "${cliImport}";

export default defineCommand({
  run: ({ ctx, adapterContext }) => ({
    app: ctx.config.get("APP_NAME"),
    manifestVersion: adapterContext.manifest.version,
  }),
});
`,
    });

    try {
      const options: CreateApplicationOptions<TestBusTypes, DatabaseAdapter> = {
        config: createConfigStore(),
        database: createDatabaseAdapter(),
        manifest: {
          version: 7,
          generatedAt: new Date().toISOString(),
          entries: [
            {
              key: "action.user.create",
              kind: "action" as const,
              logicalName: "user.create",
              modulePath: "memory",
              declaration: defineAction<{ email: string }, string, TestContext>({
                kind: "action",
                handle: ({ input }) => `created:${input.email}`,
              }),
            },
          ],
        },
      };

      const app = await createApplication(options, {
        cli: createCliAdapter({ rootDir: project.rootDir }),
      });

      const created = await app.adapter.cli.invoke([
        "user",
        "new",
        "--email",
        "cli@example.com",
      ]);
      const info = await app.adapter.cli.invoke(["system", "info"]);
      const usage = await app.adapter.cli.renderUsage();

      expect(created).toBe("created:cli@example.com:user create");
      expect(info).toEqual({ app: "orria-runtime", manifestVersion: 7 });
      expect(usage).toContain("user");
      expect(usage).toContain("system");
    } finally {
      await project.cleanup();
    }
  });

  it("generates typed command and alias registry", async () => {
    const cliImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "src/transport/cli/command/system/info.ts": `import { defineCommand } from "${cliImport}";

export default defineCommand({
  aliases: ["details"],
  run: () => "ok",
});
`,
    });

    try {
      const result = await generateCliCommandRegistryArtifacts({ rootDir: project.rootDir });
      const output = await readFile(
        path.join(project.rootDir, "src/generated/cli/command-registry.d.ts"),
        "utf8",
      );

      expect(result.commandPaths).toEqual(["system", "system.info"]);
      expect(result.aliasPaths).toEqual(["system.details"]);
      expect(output).toContain('"system.info": ["system", "info", ...string[]];');
      expect(output).toContain('"system.details": ["system", "details", ...string[]];');
    } finally {
      await project.cleanup();
    }
  });
});

async function createTempProject(
  files: Record<string, string>,
): Promise<{ rootDir: string; cleanup: () => Promise<void> }> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-cli-"));

  for (const [relativeFilePath, content] of Object.entries(files)) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath);
    await mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await writeFile(absoluteFilePath, content, "utf8");
  }

  return {
    rootDir,
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
}

function createConfigStore(): ConfigStore {
  return {
    get(key) {
      if (key === "APP_NAME") {
        return "orria-runtime";
      }

      throw new Error(`Unknown config key ${key}`);
    },
    has(key) {
      return key === "APP_NAME";
    },
    all() {
      return Object.freeze({ APP_NAME: "orria-runtime" });
    },
  };
}

function createDatabaseAdapter(): DatabaseAdapter {
  return {
    client() {
      return "memory-db";
    },
  };
}
