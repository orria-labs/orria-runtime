import { Elysia } from "elysia";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { importFreshModule, isOrriaTempModulePath } from "@orria-labs/runtime";

import { isHttpPluginDefinition } from "./plugins/shared.ts";
import { isHttpHandlerDefinition } from "./router/shared.ts";
import { isHttpWsRouteDefinition } from "./router/ws-shared.ts";
import type {
  DiscoverHttpTransportOptions,
  HttpHandlerDefinition,
  HttpMethod,
  HttpPluginDefinition,
  HttpWsRouteDefinition,
  ResolvedHttpPluginModule,
  ResolvedHttpRouteModule,
  ResolvedHttpWsRouteModule,
} from "./types.ts";

const DEFAULT_ROUTES_DIR = path.join("src", "transport", "http", "router");
const DEFAULT_PLUGINS_DIR = path.join("src", "transport", "http", "plugins");
const SUPPORTED_FILE_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs"]);
const HTTP_METHODS = new Set<HttpMethod>([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);

export async function discoverHttpRoutes(
  options: DiscoverHttpTransportOptions,
): Promise<HttpHandlerDefinition[]> {
  const modules = await discoverHttpRouteModules(options);
  return modules.map((entry) => entry.route);
}

export async function discoverHttpRouteModules(
  options: DiscoverHttpTransportOptions,
): Promise<ResolvedHttpRouteModule[]> {
  const routesRootDir = path.resolve(
    options.rootDir,
    options.routesDir ?? DEFAULT_ROUTES_DIR,
  );
  const filePaths = await collectFiles(routesRootDir);
  const modules: ResolvedHttpRouteModule[] = [];

  for (const filePath of filePaths) {
    const discovered = normalizeHttpTransportFile(routesRootDir, filePath);
    if (discovered.kind !== "http") {
      continue;
    }

    const routeModule = await importFreshModule<Record<string, unknown>>(filePath);
    const route = extractRoute(routeModule, filePath, discovered);

    modules.push({
      filePath,
      id: `${route.method} ${route.path}`,
      route,
    });
  }

  return modules;
}

export async function discoverHttpWsRouteModules(
  options: DiscoverHttpTransportOptions,
): Promise<ResolvedHttpWsRouteModule[]> {
  const routesRootDir = path.resolve(
    options.rootDir,
    options.routesDir ?? DEFAULT_ROUTES_DIR,
  );
  const filePaths = await collectFiles(routesRootDir);
  const modules: ResolvedHttpWsRouteModule[] = [];

  for (const filePath of filePaths) {
    const discovered = normalizeHttpTransportFile(routesRootDir, filePath);
    if (discovered.kind !== "ws") {
      continue;
    }

    const routeModule = await importFreshModule<Record<string, unknown>>(filePath);
    const resolved = extractWsRoute(routeModule, filePath, discovered.path);

    modules.push({
      filePath,
      id: resolved.route?.path ? `WS ${resolved.route.path}` : `WS ${filePath}`,
      ...resolved,
    });
  }

  return modules;
}

export async function discoverHttpPlugins(
  options: DiscoverHttpTransportOptions,
): Promise<ResolvedHttpPluginModule[]> {
  const pluginsRootDir = path.resolve(
    options.rootDir,
    options.pluginsDir ?? DEFAULT_PLUGINS_DIR,
  );
  const filePaths = await collectFiles(pluginsRootDir);
  const modules: ResolvedHttpPluginModule[] = [];

  for (const filePath of filePaths) {
    const pluginModule = await importFreshModule<Record<string, unknown>>(filePath);
    const name = normalizePluginName(pluginsRootDir, filePath);
    const plugin = extractPlugin(pluginModule, filePath, name);

    modules.push({
      filePath,
      name,
      plugin,
    });
  }

  return modules;
}

export function validateHttpRoutes(routes: HttpHandlerDefinition[]): void {
  const ids = new Set<string>();

  for (const route of routes) {
    if (!route.method || !HTTP_METHODS.has(route.method)) {
      throw new Error(`HTTP route must define a valid method`);
    }

    if (!route.path || !route.path.startsWith("/")) {
      throw new Error(`HTTP route "${route.method}" must define an absolute path`);
    }

    const id = `${route.method} ${route.path}`;
    if (ids.has(id)) {
      throw new Error(`Duplicate HTTP route "${id}"`);
    }

    ids.add(id);
  }
}

export function validateHttpPlugins(plugins: ResolvedHttpPluginModule[]): void {
  const names = new Set<string>();

  for (const plugin of plugins) {
    const refs = new Set([plugin.name, ...(plugin.plugin.refs ?? [])]);

    for (const ref of refs) {
      if (!ref.trim()) {
        throw new Error(`HTTP plugin in "${plugin.filePath}" has an empty ref`);
      }

      if (names.has(ref)) {
        throw new Error(`Duplicate HTTP plugin ref "${ref}"`);
      }

      names.add(ref);
    }
  }
}

export function normalizeHttpRouteFile(
  routesRootDir: string,
  filePath: string,
): { method: HttpMethod; path: string } {
  const discovered = normalizeHttpTransportFile(routesRootDir, filePath);
  if (discovered.kind !== "http") {
    throw new Error(
      `HTTP route file "${filePath}" must end with .<method>.ts or be named <method>.ts`,
    );
  }

  return {
    method: discovered.method,
    path: discovered.path,
  };
}

function normalizeHttpTransportFile(
  routesRootDir: string,
  filePath: string,
):
  | { kind: "http"; method: HttpMethod; path: string }
  | { kind: "ws"; path: string } {
  const relativePath = path.relative(routesRootDir, filePath);
  const extension = path.extname(relativePath);
  const withoutExtension = relativePath.slice(0, -extension.length);
  const segments = withoutExtension.split(path.sep);
  const lastSegment = segments.pop();

  if (!lastSegment) {
    throw new Error(`Unable to resolve route from "${filePath}"`);
  }

  const wsMatch = lastSegment.match(/^(.*)\.ws$/i);
  if (wsMatch) {
    const rawName = wsMatch[1];
    if (!rawName) {
      throw new Error(`Unable to resolve WebSocket route file "${filePath}"`);
    }

    return {
      kind: "ws",
      path: resolveRoutePath([...segments, rawName]),
    };
  }

  if (/^ws$/i.test(lastSegment)) {
    return {
      kind: "ws",
      path: resolveRoutePath([...segments, lastSegment]),
    };
  }

  const methodMatch = lastSegment.match(/^(.*)\.(get|post|put|patch|delete|options|head)$/i);
  if (methodMatch) {
    const rawName = methodMatch[1];
    const rawMethod = methodMatch[2];
    if (!rawName || !rawMethod) {
      throw new Error(`Unable to resolve HTTP route file "${filePath}"`);
    }

    return {
      kind: "http",
      method: rawMethod.toUpperCase() as HttpMethod,
      path: resolveRoutePath([...segments, rawName]),
    };
  }

  const methodOnlyMatch = lastSegment.match(/^(get|post|put|patch|delete|options|head)$/i);
  if (methodOnlyMatch) {
    const [, rawMethod] = methodOnlyMatch;
    if (!rawMethod) {
      throw new Error(`Unable to resolve HTTP route file "${filePath}"`);
    }

    return {
      kind: "http",
      method: rawMethod.toUpperCase() as HttpMethod,
      path: resolveRoutePath(segments),
    };
  }

  throw new Error(
    `HTTP route file "${filePath}" must end with .<method>.ts, be named <method>.ts, or end with .ws.ts`,
  );
}

function resolveRoutePath(segments: string[]): string {
  const pathSegments = segments
    .map((segment) => normalizeRouteSegment(segment))
    .filter(Boolean);

  if (pathSegments[pathSegments.length - 1] === "index") {
    pathSegments.pop();
  }

  return pathSegments.length === 0 ? "/" : `/${pathSegments.join("/")}`;
}

function normalizeRouteSegment(segment: string): string {
  if (segment === "index") {
    return segment;
  }

  if (/^\[\.\.\.[^\]]+\]$/.test(segment)) {
    return `*`;
  }

  if (/^\[[^\]]+\]$/.test(segment)) {
    return `:${segment.slice(1, -1)}`;
  }

  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9-:_*]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizePluginName(pluginsRootDir: string, filePath: string): string {
  const relativePath = path.relative(pluginsRootDir, filePath);
  const extension = path.extname(relativePath);

  return relativePath
    .slice(0, -extension.length)
    .split(path.sep)
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(".");
}

async function collectFiles(rootDir: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const filePaths: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      filePaths.push(...await collectFiles(absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (isOrriaTempModulePath(absolutePath)) {
      continue;
    }

    const extension = path.extname(entry.name);
    if (!SUPPORTED_FILE_EXTENSIONS.has(extension) || entry.name.endsWith(".d.ts")) {
      continue;
    }

    filePaths.push(absolutePath);
  }

  return filePaths.sort((left, right) => left.localeCompare(right));
}

function extractRoute(
  moduleExports: Record<string, unknown>,
  filePath: string,
  discovered: { method: HttpMethod; path: string },
): HttpHandlerDefinition {
  for (const value of Object.values(moduleExports)) {
    if (isHttpHandlerDefinition(value)) {
      return {
        ...value,
        method: value.method ?? discovered.method,
        path: value.path ?? discovered.path,
      };
    }
  }

  throw new Error(`HTTP route module "${filePath}" does not export a handler`);
}

function extractWsRoute(
  moduleExports: Record<string, unknown>,
  filePath: string,
  discoveredPath: string,
): Pick<ResolvedHttpWsRouteModule, "route" | "app"> {
  for (const value of Object.values(moduleExports)) {
    if (isHttpWsRouteDefinition(value)) {
      return {
        route: {
          ...value,
          path: value.path ?? discoveredPath,
        } satisfies HttpWsRouteDefinition,
      };
    }

    if (isElysiaApp(value)) {
      return {
        app: value,
      };
    }
  }

  throw new Error(`WebSocket route module "${filePath}" does not export a ws route`);
}

function isElysiaApp(value: unknown): value is Elysia {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as Elysia).use === "function" &&
    typeof (value as Elysia).route === "function" &&
    typeof (value as Elysia).ws === "function",
  );
}

function extractPlugin(
  moduleExports: Record<string, unknown>,
  filePath: string,
  name: string,
): HttpPluginDefinition {
  for (const value of Object.values(moduleExports)) {
    if (isHttpPluginDefinition(value)) {
      return {
        ...value,
        name: value.name ?? name,
      };
    }
  }

  throw new Error(`HTTP plugin module "${filePath}" does not export a plugin`);
}
