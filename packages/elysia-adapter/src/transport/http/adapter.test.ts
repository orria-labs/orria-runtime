import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createApplication, defineAction, defineQuery, importFreshModule } from "@orria-labs/runtime";
import type {
  ApplicationContext,
  BusTypesContract,
  ConfigStore,
  CreateApplicationOptions,
  DatabaseAdapter,
  HandlerInvocationMeta,
} from "@orria-labs/runtime";

import { createHttpAdapter } from "./adapter.ts";
import { generateHttpAppRegistryArtifacts } from "./codegen/generate-app-registry.ts";
import { generateHttpPluginRegistryArtifacts } from "./codegen/generate-plugin-registry.ts";
import {
  discoverHttpPlugins,
  discoverHttpRouteModules,
  discoverHttpRoutes,
  discoverHttpWsRouteModules,
  normalizeHttpRouteFile,
  validateHttpPlugins,
  validateHttpRoutes,
} from "./discovery.ts";

interface TestBusTypes extends BusTypesContract {
  action: {
    user: {
      create: (
        input: { email: string },
        meta?: HandlerInvocationMeta,
      ) => Promise<{ id: string; email: string }>;
    };
  };
  query: {
    user: {
      get: (
        input: { userId: string },
        meta?: HandlerInvocationMeta,
      ) => Promise<{ userId: string; loadedFrom: string }>;
    };
  };
  workflow: {};
  event: {};
}

type TestContext = ApplicationContext<TestBusTypes>;

describe("elysia adapter", () => {
  it("discovers routes/plugins and normalizes file-based method/path", async () => {
    const elysiaImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "src/transport/http/plugins/request-source.ts": `import { definePlugin } from "${elysiaImport}";

export default definePlugin({
  refs: ["source"],
  setup: ({ app }) => app,
});
`,
      "src/transport/http/router/v1/user-status.get.ts": `import { defineHandler } from "${elysiaImport}";

export default defineHandler()({
  handle: () => ({ ok: true }),
});
`,
      "src/transport/http/router/v1/user/post.ts": `import { defineHandler } from "${elysiaImport}";

export default defineHandler()({
  handle: () => ({ created: true }),
});
`,
      "src/transport/http/router/chat.ws.ts": `import { defineWs } from "${elysiaImport}";

export default defineWs()({
  options: {
    message(ws, message) {
      ws.send(message);
    },
  },
});
`,
      "src/transport/http/router/index.ws.ts": `import { defineWs } from "${elysiaImport}";

export default defineWs()({
  options: {
    message(ws, message) {
      ws.send(message);
    },
  },
});
`,
    });

    try {
      const routeModules = await discoverHttpRouteModules({ rootDir: project.rootDir });
      const routes = await discoverHttpRoutes({ rootDir: project.rootDir });
      const wsRoutes = await discoverHttpWsRouteModules({ rootDir: project.rootDir });
      const plugins = await discoverHttpPlugins({ rootDir: project.rootDir });

      expect(routeModules.map((entry) => entry.id)).toEqual(["GET /v1/user-status", "POST /v1/user"]);
      expect(routes.map((entry) => `${entry.method} ${entry.path}`)).toEqual([
        "GET /v1/user-status",
        "POST /v1/user",
      ]);
      expect(wsRoutes.map((entry) => entry.route?.path)).toEqual(["/chat", "/"]);
      expect(plugins.map((entry) => entry.name)).toEqual(["request-source"]);
      expect(
        normalizeHttpRouteFile(
          path.join(project.rootDir, "src/transport/http/router"),
          path.join(project.rootDir, "src/transport/http/router/v1/user-status.get.ts"),
        ),
      ).toEqual({ method: "GET", path: "/v1/user-status" });
      expect(
        normalizeHttpRouteFile(
          path.join(project.rootDir, "src/transport/http/router"),
          path.join(project.rootDir, "src/transport/http/router/v1/user/post.ts"),
        ),
      ).toEqual({ method: "POST", path: "/v1/user" });

      expect(() =>
        validateHttpRoutes([
          { method: "GET", path: "/health", handle: () => null },
          { method: "GET", path: "/health", handle: () => null },
        ]),
      ).toThrow('Duplicate HTTP route "GET /health"');

      expect(() =>
        validateHttpPlugins([
          {
            filePath: "a.ts",
            name: "auth",
            plugin: { name: "auth", setup: ({ app }) => app },
          },
          {
            filePath: "b.ts",
            name: "auth",
            plugin: { name: "auth", setup: ({ app }) => app },
          },
        ]),
      ).toThrow('Duplicate HTTP plugin ref "auth"');
    } finally {
      await project.cleanup();
    }
  });

  it("mounts discovered routes, parses body, resolves plugins and extends app", async () => {
    const elysiaImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "src/transport/http/plugins/request-source.ts": `import { definePlugin } from "${elysiaImport}";

export default definePlugin({
  refs: ["source"],
  setup: ({ app, ctx }) => app.derive(({ request }) => ({
    requestSource: request.headers.get("x-source") ?? "http",
    appName: ctx.config.get("APP_NAME"),
  })),
});
`,
      "src/transport/http/router/health.get.ts": `import { defineHandler } from "${elysiaImport}";

export default defineHandler()({
  handle: ({ ctx }) => ({ ok: true, app: ctx.config.get("APP_NAME") }),
});
`,
      "src/transport/http/router/user/create.post.ts": `import { defineHandler } from "${elysiaImport}";

export default defineHandler()({
  plugins: ["request-source"],
  handle: async ({ ctx, body, transportContext }) => ({
    created: await ctx.action.user.create(body),
    source: transportContext.requestSource,
    app: transportContext.appName,
  }),
});
`,
      "src/transport/http/router/v1/user-status.get.ts": `import { defineHandler } from "${elysiaImport}";

export default defineHandler()({
  handle: ({ ctx, query }) => ctx.query.user.get({ userId: String(query.userId ?? "") }),
  options: {
    detail: {
      summary: "Reads user status",
    },
  },
});
`,
      "src/transport/http/router/chat.ws.ts": `import { defineWs } from "${elysiaImport}";

export default defineWs()({
  options: {
    message(ws, message) {
      ws.send(message);
    },
  },
});
`,
      "src/transport/http/router/index.ws.ts": `import { defineWs } from "${elysiaImport}";

export default defineWs()({
  options: {
    message(ws, message) {
      ws.send(message);
    },
  },
});
`,
    });

    try {
      const options: CreateApplicationOptions<TestBusTypes, DatabaseAdapter> = {
        config: createConfigStore(),
        database: createDatabaseAdapter(),
        manifest: {
          version: 1,
          generatedAt: new Date().toISOString(),
          entries: [
            {
              key: "action.user.create",
              kind: "action" as const,
              logicalName: "user.create",
              modulePath: "memory",
              declaration: defineAction<{ email: string }, { id: string; email: string }, TestContext>({
                handle: ({ input }) => ({
                  id: `user:${input.email}`,
                  email: input.email,
                }),
              }),
            },
            {
              key: "query.user.get",
              kind: "query" as const,
              logicalName: "user.get",
              modulePath: "memory",
              declaration: defineQuery<{ userId: string }, { userId: string; loadedFrom: string }, TestContext>({
                handle: ({ input }) => ({
                  userId: input.userId,
                  loadedFrom: "memory-db",
                }),
              }),
            },
          ],
        },
      };

      const app = await createApplication(options, {
        http: createHttpAdapter({
          rootDir: project.rootDir,
          extend: ({ app }) =>
            app.get("/extended", () => ({ extended: true })),
        }),
      });

      const healthResponse = await app.adapter.http.handle(
        new Request("http://localhost/health"),
      );
      const createResponse = await app.adapter.http.handle(
        new Request("http://localhost/user/create", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-source": "test-suite",
          },
          body: JSON.stringify({ email: "dev@example.com" }),
        }),
      );
      const queryResponse = await app.adapter.http.handle(
        new Request("http://localhost/v1/user-status?userId=user%3Adev@example.com"),
      );
      const extendedResponse = await app.adapter.http.handle(
        new Request("http://localhost/extended"),
      );

      expect(await healthResponse.json()).toEqual({ ok: true, app: "orria-runtime" });
      expect(await createResponse.json()).toEqual({
        created: {
          id: "user:dev@example.com",
          email: "dev@example.com",
        },
        source: "test-suite",
        app: "orria-runtime",
      });
      expect(await queryResponse.json()).toEqual({
        userId: "user:dev@example.com",
        loadedFrom: "memory-db",
      });
      expect(await extendedResponse.json()).toEqual({ extended: true });
    } finally {
      await project.cleanup();
    }
  });

  it("generates typed plugin registry for string refs", async () => {
    const elysiaImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "src/transport/http/plugins/request-source.ts": `import { definePlugin } from "${elysiaImport}";

export default definePlugin({
  refs: ["source"],
  setup: ({ app }) => app.derive(() => ({
    requestSource: "http",
  })),
});
`,
    });

    try {
      const result = await generateHttpPluginRegistryArtifacts({ rootDir: project.rootDir });
      const output = await readFile(
        path.join(project.rootDir, "src/generated/http/plugin-registry.d.ts"),
        "utf8",
      );

      expect(result.refs).toEqual(["request-source", "source"]);
      expect(output).toContain('"request-source": typeof import("../../transport/http/plugins/request-source.ts").default;');
      expect(output).toContain('"source": typeof import("../../transport/http/plugins/request-source.ts").default;');
    } finally {
      await project.cleanup();
    }
  });

  it("generates typed app registry for discovered routes and plugins", async () => {
    const elysiaImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "src/transport/http/plugins/request-source.ts": `import { definePlugin } from "${elysiaImport}";

export default definePlugin({
  setup: ({ app }) => app.derive(() => ({
    requestSource: "http",
  })),
});
`,
      "src/transport/http/router/health.get.ts": `import { defineHandler } from "${elysiaImport}";

export default defineHandler()({
  handle: () => ({ ok: true }),
});
`,
      "src/transport/http/router/chat.ws.ts": `import { defineWs } from "${elysiaImport}";

export default defineWs()({
  options: {
    message(ws, message) {
      ws.send(message);
    },
  },
});
`,
    });

    try {
      const result = await generateHttpAppRegistryArtifacts({
        rootDir: project.rootDir,
        globalPlugins: ["request-source"],
      });
      const output = await readFile(
        path.join(project.rootDir, result.outFile),
        "utf8",
      );
      const registryOutput = await readFile(
        path.join(project.rootDir, result.registryOutFile),
        "utf8",
      );

      expect(output).toContain('declare const globalPlugin0: ResolveGeneratedPluginApp<"request-source">;');
      expect(output).toContain('declare const routeBase0: ResolveGeneratedRouteBaseApp<typeof route0>;');
      expect(output).toContain('.use(routeBase0.route("GET", "/health",');
      expect(output).toContain('.use(wsRouteBase0.ws("/chat", wsRoute0.options))');
      expect(registryOutput).toContain('interface HttpDiscoveredAppRegistry');
      expect(registryOutput).toContain('app: typeof import("./app.ts").app;');
    } finally {
      await project.cleanup();
    }
  });

  it("generates typed app registry for explicit global plugin objects", async () => {
    const elysiaImport = path
      .join(import.meta.dir, "..", "..", "index.ts")
      .split(path.sep)
      .join("/");

    const project = await createTempProject({
      "src/transport/http/plugins/request-source.ts": `import { definePlugin } from "${elysiaImport}";

export const requestSourcePlugin = definePlugin({
  setup: ({ app }) => app.derive(() => ({
    requestSource: "http",
  })),
});
`,
      "src/transport/http/router/health.get.ts": `import { defineHandler } from "${elysiaImport}";

export default defineHandler()({
  handle: ({ requestSource }) => ({ ok: requestSource === "http" }),
});
`,
    });

    try {
      const pluginFilePath = path.join(
        project.rootDir,
        "src/transport/http/plugins/request-source.ts",
      );
      const pluginModule = await importFreshModule<Record<string, unknown>>(pluginFilePath);
      const { defineCodegenPlugin } = await import(path.join(import.meta.dir, "..", "..", "index.ts"));
      const globalPlugin = defineCodegenPlugin(
        pluginModule.requestSourcePlugin as Parameters<typeof defineCodegenPlugin>[0],
        {
          baseDir: path.dirname(pluginFilePath),
          importPath: "./request-source.ts",
          exportName: "requestSourcePlugin",
        },
      );

      const result = await generateHttpAppRegistryArtifacts({
        rootDir: project.rootDir,
        globalPlugins: [globalPlugin],
      });
      const output = await readFile(
        path.join(project.rootDir, result.outFile),
        "utf8",
      );

      expect(output).toContain('import { requestSourcePlugin as globalPluginModule0 } from "../../transport/http/plugins/request-source.ts";');
      expect(output).toContain('declare const globalPlugin0: ResolveGeneratedPluginApp<typeof globalPluginModule0>;');
      expect(output).toContain('.use(globalPlugin0)');
    } finally {
      await project.cleanup();
    }
  });
});

async function createTempProject(
  files: Record<string, string>,
): Promise<{ rootDir: string; cleanup: () => Promise<void> }> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "orria-http-"));

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
