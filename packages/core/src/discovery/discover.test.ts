import { afterEach, describe, expect, it } from "bun:test";
import path from "node:path";

import { createRegistry } from "../registry/registry.ts";
import { createTempProject } from "../test-utils.ts";
import { discoverManifest } from "./discover.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

describe("discoverManifest", () => {
  it("builds typed keys from module paths", async () => {
    const project = await projectWithFiles({
      "src/modules/user/create.action.ts": declarationModule("action", "create"),
      "src/modules/user/get.query.ts": declarationModule("query", "get"),
      "src/modules/user/registered.event.ts": declarationModule("event", "registered"),
      "src/modules/user/registration.workflow.ts": declarationModule("workflow", "registration", {
        subscribesTo: ["event.user.registered"],
      }),
    });

    const manifest = await discoverManifest({ rootDir: project.rootDir });

    expect(manifest.entries.map((entry) => entry.key)).toEqual([
      "action.user.create",
      "event.user.registered",
      "query.user.get",
      "workflow.user.registration",
    ]);
  });

  it("rejects duplicate handler keys", async () => {
    const project = await projectWithFiles({
      "src/modules/user/create-user.action.ts": declarationModule("action", "createUser"),
      "src/modules/user/createUser.action.ts": declarationModule("action", "createUser"),
    });

    const manifest = await discoverManifest({ rootDir: project.rootDir });

    expect(() => createRegistry(manifest)).toThrow('Duplicate handler key "action.user.createUser"');
  });

  it("rejects subscriptions to missing events", async () => {
    const project = await projectWithFiles({
      "src/modules/user/create.action.ts": declarationModule("action", "create"),
      "src/modules/user/registration.workflow.ts": declarationModule("workflow", "registration", {
        subscribesTo: ["event.user.missing"],
      }),
    });

    const manifest = await discoverManifest({ rootDir: project.rootDir });

    expect(() => createRegistry(manifest)).toThrow(
      'Handler "workflow.user.registration" subscribes to unknown event "event.user.missing"',
    );
  });
});

async function projectWithFiles(files: Record<string, string>) {
  const project = await createTempProject(files);
  cleanups.push(project.cleanup);
  return project;
}

function declarationModule(
  kind: "action" | "query" | "workflow" | "event",
  name: string,
  options: { subscribesTo?: string[] } = {},
): string {
  const defineImport = path.join(import.meta.dir, "..", "define.ts").split(path.sep).join("/");

  if (kind === "event") {
    return `import { defineEvent } from "${defineImport}";

export default defineEvent<{ name: string }>({
  kind: "event",
  version: 1,
  description: "${name}",
});
`;
  }

  const helperName = {
    action: "defineAction",
    query: "defineQuery",
    workflow: "defineWorkflow",
  }[kind];

  const subscribeLine = options.subscribesTo
    ? `  subscribesTo: ${JSON.stringify(options.subscribesTo)},\n`
    : "";

  return `import { ${helperName} } from "${defineImport}";

export default ${helperName}<{ name: string }, string>({
  kind: "${kind}",
${subscribeLine}  description: "${name}",
  handle: ({ input }) => input.name,
});
`;
}
