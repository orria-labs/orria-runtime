import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  discoverHttpRouteModules,
  discoverHttpWsRouteModules,
} from "../discovery.ts";

export interface GenerateHttpAppRegistryOptions {
  rootDir?: string;
  routesDir?: string;
  outFile?: string;
  registryOutFile?: string;
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
}): string {
  const imports = [
    `import { Elysia } from "elysia";`,
    ...args.routes.map((entry, index) =>
      `import route${index} from ${JSON.stringify(relativeImport(args.outFile, entry.filePath))};`
    ),
    ...args.wsRoutes.map((entry, index) =>
      `import wsRoute${index} from ${JSON.stringify(relativeImport(args.outFile, entry.filePath))};`
    ),
  ];

  const routeLines = args.routes.map((entry, index) => {
    const method = entry.route.method!.toLowerCase();
    return [
      `  // @ts-expect-error generated route typing mirrors adapter-mounted handlers`,
      `  .${method}(${JSON.stringify(entry.route.path)}, route${index}.handle, route${index}.options)`
    ].join("\n");
  });

  const wsLines = args.wsRoutes.map((entry, index) => {
    if (entry.app) {
      return `  .use(wsRoute${index})`;
    }

    return `  .ws(${JSON.stringify(entry.route?.path ?? "/")}, wsRoute${index}.options)`;
  });

  const chain = [...routeLines, ...wsLines].join("\n");

  return `${imports.join("\n")}

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
