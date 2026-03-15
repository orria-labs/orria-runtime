import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type InitAdapterName = "http" | "cli" | "cron";

export interface InitializeProjectOptions {
  dir?: string;
  name?: string;
  adapters?: InitAdapterName[];
  force?: boolean;
  version?: string;
}

export interface InitializeProjectResult {
  rootDir: string;
  packageName: string;
  adapters: InitAdapterName[];
  createdFiles: string[];
}

interface RenderScaffoldOptions {
  packageName: string;
  adapters: InitAdapterName[];
  version: string;
}

const DEFAULT_ADAPTERS: InitAdapterName[] = ["http", "cli", "cron"];
const SUPPORTED_ADAPTERS = new Set<InitAdapterName>(["http", "cli", "cron"]);

export function parseInitAdapters(value?: string): InitAdapterName[] {
  if (!value) {
    return [...DEFAULT_ADAPTERS];
  }

  const rawItems = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (rawItems.length === 1 && rawItems[0] === "none") {
    return [];
  }

  const adapters = rawItems.map((item) => {
    if (!SUPPORTED_ADAPTERS.has(item as InitAdapterName)) {
      throw new Error(
        `Unsupported adapter "${item}". Expected one of: ${Array.from(SUPPORTED_ADAPTERS).join(", ")}`,
      );
    }

    return item as InitAdapterName;
  });

  return Array.from(new Set(adapters));
}

export async function initializeProjectScaffold(
  options: InitializeProjectOptions = {},
): Promise<InitializeProjectResult> {
  const rootDir = path.resolve(options.dir ?? ".");
  const adapters = options.adapters ?? [...DEFAULT_ADAPTERS];
  const packageName = normalizePackageName(options.name ?? path.basename(rootDir));
  const version = options.version ?? "0.1.0";
  const files = renderScaffoldFiles({
    packageName,
    adapters,
    version,
  });

  await mkdir(rootDir, { recursive: true });

  if (!options.force) {
    for (const relativeFilePath of Object.keys(files)) {
      const absoluteFilePath = path.join(rootDir, relativeFilePath);

      try {
        await stat(absoluteFilePath);
        throw new Error(
          `Refusing to overwrite existing file "${relativeFilePath}". Re-run with --force to replace scaffold files.`,
        );
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ENOENT") {
          continue;
        }

        throw error;
      }
    }
  }

  const createdFiles: string[] = [];

  for (const [relativeFilePath, content] of Object.entries(files)) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath);
    await mkdir(path.dirname(absoluteFilePath), { recursive: true });
    await writeFile(absoluteFilePath, content, "utf8");
    createdFiles.push(relativeFilePath);
  }

  createdFiles.sort((left, right) => left.localeCompare(right));

  return {
    rootDir,
    packageName,
    adapters,
    createdFiles,
  };
}

function renderScaffoldFiles(options: RenderScaffoldOptions): Record<string, string> {
  const hasHttp = options.adapters.includes("http");
  const hasCli = options.adapters.includes("cli");
  const hasCron = options.adapters.includes("cron");

  return {
    ".gitignore": renderGitIgnore(),
    "package.json": renderPackageJson(options),
    "tsconfig.json": renderTsconfig(),
    "src/config.ts": renderConfigFile(),
    "src/database.ts": renderDatabaseFile(),
    "src/index.ts": renderIndexFile(options.adapters),
    "src/modules/system/info.query.ts": renderInfoQuery(),
    "src/modules/system/heartbeat.workflow.ts": renderHeartbeatWorkflow(),
    "src/generated/core/.gitkeep": "",
    "src/generated/http/.gitkeep": "",
    "src/generated/cli/.gitkeep": "",
    "src/generated/cron/.gitkeep": "",
    "src/transport/http/router/.gitkeep": "",
    "src/transport/http/plugins/.gitkeep": "",
    "src/transport/cli/command/.gitkeep": "",
    "src/transport/cron/schedules/.gitkeep": "",
    ...(hasHttp ? {
      "src/transport/http/adapter.ts": renderHttpAdapterFile(),
      "src/transport/http/router/health.get.ts": renderHttpHealthRoute(),
    } : {}),
    ...(hasCli ? {
      "src/transport/cli/adapter.ts": renderCliAdapterFile(),
      "src/transport/cli/command/system/info.ts": renderCliInfoCommand(),
    } : {}),
    ...(hasCron ? {
      "src/transport/cron/adapter.ts": renderCronAdapterFile(),
      "src/transport/cron/schedules/system-heartbeat.ts": renderCronSchedule(),
    } : {}),
  };
}

function renderGitIgnore(): string {
  return `node_modules
.DS_Store
`;
}

function renderPackageJson(options: RenderScaffoldOptions): string {
  const dependencies: Record<string, string> = {
    "@orria-labs/runtime": `^${options.version}`,
  };

  if (options.adapters.includes("http")) {
    dependencies["@orria-labs/runtime-elysia"] = `^${options.version}`;
    dependencies.elysia = "^1.4.27";
  }

  if (options.adapters.includes("cli")) {
    dependencies["@orria-labs/runtime-citty"] = `^${options.version}`;
    dependencies.citty = "^0.2.1";
  }

  if (options.adapters.includes("cron")) {
    dependencies["@orria-labs/runtime-croner"] = `^${options.version}`;
    dependencies.croner = "^10.0.1";
  }

  return `${JSON.stringify({
    name: options.packageName,
    private: true,
    type: "module",
    scripts: {
      dev: "bun --watch ./src/index.ts",
      generate: "orria-runtime generate --root . --out src/generated/core",
      typecheck: "tsc --noEmit",
      start: "bun ./src/index.ts",
    },
    dependencies,
    devDependencies: {
      "@types/bun": "latest",
      typescript: "^5.8.2",
    },
  }, null, "\t")}
`;
}

function renderTsconfig(): string {
  return `${JSON.stringify({
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "Bundler",
      allowImportingTsExtensions: true,
      noEmit: true,
      strict: true,
      types: ["bun-types"],
      skipLibCheck: true,
    },
    include: ["src/**/*.ts"],
  }, null, "\t")}
`;
}

function renderConfigFile(): string {
  return `import { createConfig } from "@orria-labs/runtime";

// Держим runtime-конфигурацию в одном маленьком модуле, чтобы все transport
// adapters читали один и тот же источник правды, а будущую валидацию env
// можно было централизовать в одном месте.
export const config = createConfig({
  APP_NAME: "orria-app",
});
`;
}

function renderDatabaseFile(): string {
  return `import { defineDatabaseAdapter } from "@orria-labs/runtime";

export interface AppDatabaseClient {
  kind: "memory-db";
}

export type AppDatabaseAdapter = ReturnType<typeof createDatabaseAdapter>;

function createDatabaseAdapter() {
  const client: AppDatabaseClient = {
    kind: "memory-db",
  };

  return defineDatabaseAdapter({
    client: () => client,
  });
}

// Адаптер нарочно остаётся маленьким: новый проект сможет заменить его на
// Prisma, Drizzle или внешний service client без переписывания module-labs/runtime контрактов.
export const database = createDatabaseAdapter();
`;
}

function renderIndexFile(adapters: InitAdapterName[]): string {
  const imports = [
    'import { createApplication } from "@orria-labs/runtime";',
    'import { config } from "./config.ts";',
    'import { database } from "./database.ts";',
    'import { manifest } from "./generated/core/index.ts";',
  ];
  const adapterImports: string[] = [];
  const adapterEntries: string[] = [];

  if (adapters.includes("http")) {
    adapterImports.push('import { httpAdapter } from "./transport/http/adapter.ts";');
    adapterEntries.push("  http: httpAdapter,");
  }

  if (adapters.includes("cli")) {
    adapterImports.push('import { cliAdapter } from "./transport/cli/adapter.ts";');
    adapterEntries.push("  cli: cliAdapter,");
  }

  if (adapters.includes("cron")) {
    adapterImports.push('import { cronAdapter } from "./transport/cron/adapter.ts";');
    adapterEntries.push("  cron: cronAdapter,");
  }

  const mainBody = [
    adapters.includes("cli")
      ? `  if (rawArgs.length > 0) {
    await app.adapter.cli.run(rawArgs);
    process.exit(0);
  }
`
      : "",
    adapters.includes("cron")
      ? `  await app.adapter.cron.start();

`
      : "",
    adapters.includes("http")
      ? `  app.adapter.http.listen({ port: 3000 });
  console.log("HTTP server is listening on http://localhost:3000");`
      : `  console.log(await app.ctx.query.system.info({}));`,
  ].join("");
  const adapterArgument = adapterEntries.length > 0
    ? `,
  {
${adapterEntries.join("\n")}
  }`
    : "";

  return `${imports.join("\n")}
${adapterImports.join("\n")}

export const app = await createApplication(
  {
    config,
    database,
    manifest,
    setGlobalCtx: true,
  }${adapterArgument}
);

if (import.meta.main) {
  const rawArgs = process.argv.slice(2);

${mainBody}
}
`;
}

function renderInfoQuery(): string {
  return `import { defineQuery } from "@orria-labs/runtime";

export default defineQuery<void, { app: unknown; database: string }>({
  kind: "query",
  handle: ({ ctx }) => ({
    app: ctx.config.get("APP_NAME"),
    database: ctx.database.client().kind,
  }),
});
`;
}

function renderHeartbeatWorkflow(): string {
  return `import { defineWorkflow } from "@orria-labs/runtime";

export default defineWorkflow<{ source: string }, { ok: true; source: string }>({
  kind: "workflow",
  handle: ({ ctx, input }) => {
    // Небольшой наблюдаемый workflow даёт cron transport рабочую цель сразу
    // после scaffold и оставляет понятную точку расширения для orchestration-логики.
    ctx.console.log("Heartbeat workflow invoked from", input.source);

    return {
      ok: true,
      source: input.source,
    };
  },
});
`;
}

function renderHttpAdapterFile(): string {
  return `import path from "node:path";

import {
  defineHttpAdapter,
  type RegisteredHttpPluginRef,
} from "@orria-labs/runtime-elysia";

import type { AppDatabaseAdapter } from "../../database.ts";
import type { GeneratedBusTypes } from "../../generated/core/index.ts";

export const httpGlobalPlugins = [] as const satisfies readonly RegisteredHttpPluginRef[];

// Новый проект сразу получает co-located HTTP bootstrap: adapter и defineHandler
// живут в одном файле и поэтому не расходятся по typing global plugins.
export const { adapter: httpAdapter, defineHandler } =
  defineHttpAdapter<GeneratedBusTypes, AppDatabaseAdapter>()({
    rootDir: path.resolve(import.meta.dir, "../../.."),
    plugins: httpGlobalPlugins,
  });
`;
}

function renderHttpHealthRoute(): string {
  return `import { defineHandler } from "../adapter.ts";

export default defineHandler({
  handle: ({ ctx }) => ctx.query.system.info({}),
});
`;
}

function renderCliAdapterFile(): string {
  return `import path from "node:path";

import { createCliAdapter } from "@orria-labs/runtime-citty";

export const cliAdapter = createCliAdapter({
  rootDir: path.resolve(import.meta.dir, "../../.."),
});
`;
}

function renderCliInfoCommand(): string {
  return `import { defineCommand } from "@orria-labs/runtime-citty";

export default defineCommand({
  meta: {
    description: "Prints application information",
  },
  run: ({ ctx }) => ctx.query.system.info({}),
});
`;
}

function renderCronAdapterFile(): string {
  return `import path from "node:path";

import { createCronAdapter } from "@orria-labs/runtime-croner";

export const cronAdapter = createCronAdapter({
  rootDir: path.resolve(import.meta.dir, "../../.."),
});
`;
}

function renderCronSchedule(): string {
  return `import { defineCron, workflowTarget } from "@orria-labs/runtime-croner";

export default defineCron({
  name: "system.heartbeat",
  schedule: "0 * * * * *",
  target: workflowTarget("workflow.system.heartbeat", {
    source: "cron",
  }),
});
`;
}

function normalizePackageName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "orria-app";
}
