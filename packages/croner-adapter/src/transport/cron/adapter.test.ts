import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createApplication, defineWorkflow } from "@orria-labs/runtime";
import type {
  ApplicationContext,
  BusTypesContract,
  ConfigStore,
  CreateApplicationOptions,
  DatabaseAdapter,
  HandlerInvocationMeta,
} from "@orria-labs/runtime";

import { createCronAdapter } from "./adapter.ts";
import { generateCronScheduleRegistryArtifacts } from "./codegen/generate-schedule-registry.ts";
import {
  discoverCronSchedules,
  validateCronSchedules,
} from "./discovery.ts";
import { defineCron, workflowTarget } from "./schedules/index.ts";
import type { CronExecutionContext } from "./types.ts";

interface TestBusTypes extends BusTypesContract {
  action: {};
  query: {};
  workflow: {
    demo: {
      run: (
        input: { source: string },
        meta?: HandlerInvocationMeta,
      ) => Promise<string>;
    };
  };
  event: {};
}

type TestContext = ApplicationContext<TestBusTypes>;

describe("croner adapter", () => {
  it("discovers cron schedules from filesystem and validates duplicates", async () => {
    const cronImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "src/transport/cron/schedules/a.ts": `import { defineCron } from "${cronImport}";

export default defineCron({
  name: "demo.first",
  schedule: "* * * * *",
  target: "workflow.demo.run",
});
`,
      "src/transport/cron/schedules/b.ts": `import { defineCron } from "${cronImport}";

export const second = defineCron({
  name: "demo.second",
  schedule: "*/5 * * * *",
  target: "workflow.demo.run",
});
`,
    });

    try {
      const schedules = await discoverCronSchedules({ rootDir: project.rootDir });

      expect(schedules.map((entry) => entry.name)).toEqual([
        "demo.first",
        "demo.second",
      ]);

      expect(() =>
        validateCronSchedules([
          {
            name: "demo.first",
            schedule: "* * * * *",
          },
          {
            name: "demo.first",
            schedule: "0 * * * *",
          },
        ]),
      ).toThrow('Duplicate cron schedule name "demo.first"');
    } finally {
      await project.cleanup();
    }
  });

  it("triggers workflows through runtime and stores execution metadata", async () => {
    const invocations: Array<{ input: { source: string }; meta: HandlerInvocationMeta }> = [];

    const options: CreateApplicationOptions<TestBusTypes, DatabaseAdapter> = {
      config: createConfigStore(),
      database: createDatabaseAdapter(),
      manifest: {
        version: 1,
        generatedAt: new Date().toISOString(),
        entries: [
          {
            key: "workflow.demo.run",
            kind: "workflow" as const,
            logicalName: "demo.run",
            modulePath: "memory",
            declaration: defineWorkflow<{ source: string }, string, TestContext>({
              kind: "workflow",
              handle: ({ input, meta }) => {
                invocations.push({ input, meta });
                return `done:${input.source}`;
              },
            }),
          },
        ],
      },
    };

    const app = await createApplication(
      options,
      {
        cron: createCronAdapter({
          schedules: [
            defineCron<TestBusTypes>({
              name: "demo.run",
              schedule: "* * * * * *",
              target: workflowTarget<TestBusTypes>(
                "workflow.demo.run",
                ({ execution }: CronExecutionContext<TestBusTypes>) => ({
                  source: execution.source,
                }),
              ),
            }),
          ],
        }),
      },
    );

    const result = await app.adapter.cron.trigger("demo.run");
    const execution = app.adapter.cron.jobs["demo.run"]?.lastExecution;

    expect(result).toBe("done:manual");
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.input).toEqual({ source: "manual" });
    expect(invocations[0]?.meta.source).toBe("cron:demo.run");
    expect(invocations[0]?.meta.cronName).toBe("demo.run");
    expect(invocations[0]?.meta.cronSource).toBe("manual");
    expect(typeof invocations[0]?.meta.cronRunId).toBe("string");
    expect(execution?.status).toBe("succeeded");
    expect(execution?.source).toBe("manual");
  });

  it("boots jobs from discovered schedules and supports reload", async () => {
    const project = await createProjectWithScheduleFile();

    try {
      const options: CreateApplicationOptions<TestBusTypes, DatabaseAdapter> = {
        config: createConfigStore(),
        database: createDatabaseAdapter(),
        manifest: {
          version: 1,
          generatedAt: new Date().toISOString(),
          entries: [
            {
              key: "workflow.demo.run",
              kind: "workflow" as const,
              logicalName: "demo.run",
              modulePath: "memory",
              declaration: defineWorkflow<{ source: string }, string, TestContext>({
                kind: "workflow",
                handle: ({ input }) => `done:${input.source}`,
              }),
            },
          ],
        },
      };

      const app = await createApplication(
        options,
        {
          cron: createCronAdapter({ rootDir: project.rootDir }),
        },
      );

      await app.adapter.cron.start();

      expect(app.adapter.cron.started).toBe(true);
      expect(app.adapter.cron.jobs["demo.discovered"]?.running).toBe(true);
      expect(app.adapter.cron.jobs["demo.discovered"]?.nextRunAt).toBeInstanceOf(Date);

      await app.adapter.cron.reload();

      expect(app.adapter.cron.jobs["demo.discovered"]?.running).toBe(true);

      app.adapter.cron.stop();

      expect(app.adapter.cron.started).toBe(false);
      expect(app.adapter.cron.jobs["demo.discovered"]?.running).toBe(false);
    } finally {
      await project.cleanup();
    }
  });

  it("generates typed schedule registry", async () => {
    const project = await createProjectWithScheduleFile();

    try {
      const result = await generateCronScheduleRegistryArtifacts({ rootDir: project.rootDir });
      const output = await readFile(
        path.join(project.rootDir, "src/generated/cron/schedule-registry.d.ts"),
        "utf8",
      );

      expect(result.scheduleNames).toEqual(["demo.discovered"]);
      expect(output).toContain('"demo.discovered": true;');
    } finally {
      await project.cleanup();
    }
  });
});

async function createProjectWithScheduleFile() {
  const cronImport = path
    .join(import.meta.dir, "..", "..", "index.ts")
    .split(path.sep)
    .join("/");

  return createTempProject({
    "src/transport/cron/schedules/discovered.ts": `import { defineCron } from "${cronImport}";

export default defineCron({
  name: "demo.discovered",
  schedule: "* * * * * *",
  target: "workflow.demo.run",
  options: {
    timezone: "UTC",
  },
});
`,
  });
}

async function createTempProject(
  files: Record<string, string>,
): Promise<{ rootDir: string; cleanup: () => Promise<void> }> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-cron-"));

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
