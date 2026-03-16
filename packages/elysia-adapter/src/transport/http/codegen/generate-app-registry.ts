import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  discoverHttpRouteModules,
  discoverHttpWsRouteModules,
} from "../discovery.ts";
import type { HttpPluginRef } from "../types.ts";
import { getHttpPluginCodegenImport } from "../plugins/shared.ts";

export interface GenerateHttpAppRegistryOptions {
  rootDir?: string;
  routesDir?: string;
  outFile?: string;
  registryOutFile?: string;
  globalPlugins?: readonly (string | HttpPluginRef)[];
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
      rootDir,
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
  rootDir: string;
  outFile: string;
  routes: Awaited<ReturnType<typeof discoverHttpRouteModules>>;
  wsRoutes: Awaited<ReturnType<typeof discoverHttpWsRouteModules>>;
  globalPlugins?: readonly (string | HttpPluginRef)[];
}): string {
  const imports = [
    `import { Elysia } from "elysia";`,
    `import type { HttpBaseApp, HttpHandlerDefinition, HttpMethod, HttpPluginRegistry, HttpWsRouteDefinition, ResolveHttpHandlerApp } from "@orria-labs/runtime-elysia";`,
    ...(args.globalPlugins ?? []).flatMap((pluginRef, index) => {
      if (typeof pluginRef === "string") {
        return [];
      }

      const metadata = getHttpPluginCodegenImport(pluginRef);
      if (!metadata) {
        return [];
      }

      const importPath = relativeImport(
        args.outFile,
        resolveCodegenImportFilePath(metadata, args.rootDir),
      );

      return [renderPluginImport(`globalPluginModule${index}`, importPath, metadata.exportName)];
    }),
    ...args.routes.map((entry, index) =>
      `import route${index} from ${JSON.stringify(relativeImport(args.outFile, entry.filePath))};`
    ),
    ...args.wsRoutes.map((entry, index) =>
      `import wsRoute${index} from ${JSON.stringify(relativeImport(args.outFile, entry.filePath))};`
    ),
  ];

  const pluginDecls = (args.globalPlugins ?? [])
    .map((pluginRef, index) => {
      if (typeof pluginRef === "string") {
        return `declare const globalPlugin${index}: ResolveGeneratedPluginApp<${JSON.stringify(pluginRef)}>;`;
      }

      const metadata = getHttpPluginCodegenImport(pluginRef);
      if (!metadata) {
        return undefined;
      }

      return `declare const globalPlugin${index}: ResolveGeneratedPluginApp<typeof globalPluginModule${index}>;`;
    })
    .filter(Boolean);

  const handlerHelperDecls = args.routes.length > 0
    ? [
      `type ResolveGeneratedPluginDefinition<TPluginRef> = TPluginRef extends keyof HttpPluginRegistry ? HttpPluginRegistry[TPluginRef] : TPluginRef;`,
      `type ResolveGeneratedPluginApp<TPluginRef> = ResolveGeneratedPluginDefinition<TPluginRef> extends {`,
      `  setup: (...args: any[]) => infer TResult;`,
      `} ? Awaited<Exclude<TResult, void>> : Elysia;`,
      `type ResolveGeneratedRouteBaseApp<TRoute extends HttpHandlerDefinition<any, any, any, any, any, any>> =`,
      `  TRoute extends HttpHandlerDefinition<infer TBuses, infer TDatabase, infer TBaseApp, any, any, infer TPlugins>`,
      `    ? ResolveHttpHandlerApp<TBuses, TDatabase, TBaseApp, TPlugins>`,
      `    : Elysia;`,
      `type ResolveGeneratedWsRouteBaseApp<TRoute extends HttpWsRouteDefinition<any, any, any, any, any>> =`,
      `  TRoute extends HttpWsRouteDefinition<infer TBuses, infer TDatabase, any, any, infer TPlugins>`,
      `    ? ResolveHttpHandlerApp<TBuses, TDatabase, HttpBaseApp<TBuses, TDatabase>, TPlugins>`,
      `    : Elysia;`,
      `type ResolveGeneratedRouteHandler<TRoute extends HttpHandlerDefinition<any, any, any, any, any, any>, TMethod extends HttpMethod, TPath extends string> =`,
      `  ResolveGeneratedRouteBaseApp<TRoute>["route"] extends (`,
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
    (_entry, index) => `declare const routeBase${index}: ResolveGeneratedRouteBaseApp<typeof route${index}>;`,
  );

  const wsDecls = args.wsRoutes.map((entry, index) => {
    if (entry.app) {
      return undefined;
    }

    return `declare const wsRouteBase${index}: ResolveGeneratedWsRouteBaseApp<typeof wsRoute${index}>;`;
  }).filter(Boolean);

  const pluginLines = (args.globalPlugins ?? [])
    .map((pluginRef, index) => {
      if (typeof pluginRef === "string") {
        return `  .use(globalPlugin${index})`;
      }

      const metadata = getHttpPluginCodegenImport(pluginRef);
      if (!metadata) {
        return undefined;
      }

      return `  .use(globalPlugin${index})`;
    })
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

function resolveCodegenImportFilePath(
  metadata: {
    baseDir: string;
    importPath: string;
  },
  rootDir: string,
): string {
  if (path.isAbsolute(metadata.importPath)) {
    return metadata.importPath;
  }

  if (metadata.importPath.startsWith(".")) {
    return path.resolve(metadata.baseDir, metadata.importPath);
  }

  return path.resolve(rootDir, metadata.importPath);
}

function renderPluginImport(
  localName: string,
  importPath: string,
  exportName?: string,
): string {
  if (!exportName || exportName === "default") {
    return `import ${localName} from ${JSON.stringify(importPath)};`;
  }

  return `import { ${exportName} as ${localName} } from ${JSON.stringify(importPath)};`;
}
