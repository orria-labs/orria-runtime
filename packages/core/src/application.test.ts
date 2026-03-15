import { describe, expect, it } from "bun:test";

import { createApplication } from "./application.ts";
import type {
  ConfigStore,
  CreateApplicationAdapterContext,
  DatabaseAdapter,
  EmptyBusTypes,
} from "./types.ts";

describe("createApplication", () => {
  it("registers adapters and exposes them on app.adapter", async () => {
    const app = await createApplication(
      {
        config: createConfigStore(),
        database: createDatabaseAdapter(),
        manifest: {
          version: 1,
          generatedAt: new Date().toISOString(),
          entries: [],
        },
      },
      {
        http: ({
          ctx,
          registry,
          runtime,
        }: CreateApplicationAdapterContext<EmptyBusTypes, DatabaseAdapter>) => ({
          kind: "http" as const,
          listen: () => "listening",
          ctx,
          registry,
          runtime,
        }),
      },
    );

    expect(app.adapter.http.kind).toBe("http");
    expect(app.adapter.http.listen()).toBe("listening");
    expect(app.adapter.http.ctx).toBe(app.ctx);
    expect(app.adapter.http.registry).toBe(app.registry);
    expect(app.adapter.http.runtime).toBe(app.runtime);
  });
});

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
