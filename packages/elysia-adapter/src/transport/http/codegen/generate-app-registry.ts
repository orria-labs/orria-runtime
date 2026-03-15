import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  discoverHttpRouteModules,
  discoverHttpWsRouteModules,
} from "../discovery.ts";
import type { HttpPluginRef } from "../types.ts";

export interface GenerateHttpAppRegistryOptions {
  rootDir?: string;
  routesDir?: string;
  outFile?: string;
  registryOutFile?: string;
  globalPlugins?: Array<string | HttpPluginRef>;
}

export async function generateHttpAppRegistryArtifacts(
  options: GenerateHttpAppRegistryOptions = {},
): Promise<{ outFile: string; registryOutFile: string }> {
  const rootDir = options.rootDir ?? process.cwd();
  const outFile = options.outFile ?? path.join("src", "generated", "http", "app.ts");
  const registryOutFile = options.registryOutFile ?? path.join("src", "generated", "http", "app-registry.d.ts");
  const routes = await discoverHttpRouteModules({
    rootDir,
    routesDir: options.routesDir,
  });
  const wsRoutes = await discoverHttpWsRouteModules({
    rootDir,
    routesDir: options.routesDir,
  });
  const absoluteOutFile = path.join(rootDir, outFile);
  const absoluteRegistryOutFile = path.join(rootDir, registryOutFile);

  await mkdir(path.dirname(absoluteOutFile), { recursive: true });
  await mkdir(path.dirname(absoluteRegistryOutFile), { recursive: true });

  await writeFile(
    absoluteOutFile,
    renderHttpAppFile({
      outFile: absoluteOutFile,
      routes,
      wsRoutes,
      globalPlugins: options.globalPlugins,
    }),
    "utf8",
  );

  await writeFile(
    absoluteRegistryOutFile,
    renderHttpAppRegistryFile({
      registryOutFile: absoluteRegistryOutFile,
      appOutFile: absoluteOutFile,
    }),
    "utf8",
  );

  return {
    outFile,
    registryOutFile,
  };
}

function renderHttpAppFile(args: {
  outFile: string;
  routes: Awaited<ReturnType<typeof discoverHttpRouteModules>>;
  wsRoutes: Awaited<ReturnType<typeof discoverHttpWsRouteModules>>;
  globalPlugins?: Array<string | HttpPluginRef>;
}): string {
  const imports = [
    `import { Elysia } from "elysia";`,
    `import type { HttpHandlerDefinition, HttpMethod, ResolveHttpPluginApp, ResolveHttpRouteBaseApp, ResolveHttpWsRouteBaseApp } from "@orria-labs/runtime-elysia";`,
    ...args.routes.map((entry, index) =>
      `import route${index} from ${JSON.stringify(relativeImport(args.outFile, entry.filePath))};`
    ),
    ...args.wsRoutes.map((entry, index) =>
      `import wsRoute${index} from ${JSON.stringify(relativeImport(args.outFile, entry.filePath))};`
    ),
  ];

  const pluginDecls = (args.globalPlugins ?? [])
    .map((pluginRef, index) => typeof pluginRef === "string"
      ? `declare const globalPlugin${index}: ResolveHttpPluginApp<${JSON.stringify(pluginRef)}>;`
      : undefined)
    .filter(Boolean);

  const handlerHelperDecls = args.routes.length > 0
    ? [
      `type ResolveGeneratedRouteHandler<TRoute extends HttpHandlerDefinition<any, any, any, any, any, any>, TMethod extends HttpMethod, TPath extends string> =`,
      `  ResolveHttpRouteBaseApp<TRoute>["route"] extends (`,
      `    method: TMethod,`,
      `    path: TPath,`,
      `    handler: infer THandler,`,
      `    hook?: TRoute["options"],`,
      `  ) => any ? THandler : never;`,
      `declare function toElysiaHandler<TRoute extends HttpHandlerDefinition<any, any, any, any, any, any>, TMethod extends HttpMethod, TPath extends string>(`,
      `  route: TRoute,`,
      `): ResolveGeneratedRouteHandler<TRoute, TMethod, TPath>;`,
    ]
    : [];

  const routeDecls = args.routes.map(
    (_entry, index) => `declare const routeBase${index}: ResolveHttpRouteBaseApp<typeof route${index}>;`,
  );

  const wsDecls = args.wsRoutes.map((entry, index) => {
    if (entry.app) {
      return undefined;
    }

    return `declare const wsRouteBase${index}: ResolveHttpWsRouteBaseApp<typeof wsRoute${index}>;`;
  }).filter(Boolean);

  const pluginLines = (args.globalPlugins ?? [])
    .map((pluginRef, index) => typeof pluginRef === "string"
      ? `  .use(globalPlugin${index})`
      : undefined)
    .filter(Boolean);

  const routeLines = args.routes.map(
    (entry, index) => `  .use(routeBase${index}.route(${JSON.stringify(entry.route.method!)}, ${JSON.stringify(entry.route.path)}, toElysiaHandler<typeof route${index}, ${JSON.stringify(entry.route.method!)}, ${JSON.stringify(entry.route.path)}>(route${index}), route${index}.options))`,
  );

  const wsLines = args.wsRoutes.map((entry, index) => {
    if (entry.app) {
      return `  .use(wsRoute${index})`;
    }

    return `  .use(wsRouteBase${index}.ws(${JSON.stringify(entry.route?.path ?? "/")}, wsRoute${index}.options))`;
  });

  const declarations = [...pluginDecls, ...handlerHelperDecls, ...routeDecls, ...wsDecls].join("\n");
  const chain = [...pluginLines, ...routeLines, ...wsLines].join("\n");

  return `${imports.join("\n")}

${declarations}

export const app = new Elysia()
${chain || ""};
`;
}

function renderHttpAppRegistryFile(args: {
  registryOutFile: string;
  appOutFile: string;
}): string {
  const importPath = relativeImport(args.registryOutFile, args.appOutFile);

  return `declare module "@orria-labs/runtime-elysia" {
  interface HttpDiscoveredAppRegistry {
    app: typeof import(${JSON.stringify(importPath)}).app;
  }
}

export {};
`;
}

function relativeImport(outFile: string, targetFilePath: string): string {
  const fromDir = path.dirname(outFile);
  const relativePath = path.relative(fromDir, targetFilePath).split(path.sep).join("/");

  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}
