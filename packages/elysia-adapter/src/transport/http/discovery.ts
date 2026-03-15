import { readdir } from "node:fs/promises";
import path from "node:path";
import { importFreshModule, isOrriaTempModulePath } from "@orria-labs/runtime";

import { isHttpPluginDefinition } from "./plugins/shared.ts";
import { isHttpHandlerDefinition } from "./router/shared.ts";
import type {
  DiscoverHttpTransportOptions,
  HttpHandlerDefinition,
  HttpMethod,
  HttpPluginDefinition,
  ResolvedHttpPluginModule,
  ResolvedHttpRouteModule,
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
    const routeModule = await importFreshModule<Record<string, unknown>>(filePath);
    const route = extractRoute(routeModule, filePath, routesRootDir);

    modules.push({
      filePath,
      id: `${route.method} ${route.path}`,
      route,
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
  const relativePath = path.relative(routesRootDir, filePath);
  const extension = path.extname(relativePath);
  const withoutExtension = relativePath.slice(0, -extension.length);
  const segments = withoutExtension.split(path.sep);
  const lastSegment = segments.pop();

  if (!lastSegment) {
    throw new Error(`Unable to resolve route from "${filePath}"`);
  }

  const methodMatch = lastSegment.match(/^(.*)\.(get|post|put|patch|delete|options|head)$/i);
  if (!methodMatch) {
    throw new Error(`HTTP route file "${filePath}" must end with .<method>.ts`);
  }

  const rawName = methodMatch[1];
  const rawMethod = methodMatch[2];
  if (!rawName || !rawMethod) {
    throw new Error(`Unable to resolve HTTP route file "${filePath}"`);
  }
  const pathSegments = [...segments, rawName]
    .map((segment) => normalizeRouteSegment(segment))
    .filter(Boolean);

  if (pathSegments[pathSegments.length - 1] === "index") {
    pathSegments.pop();
  }

  return {
    method: rawMethod.toUpperCase() as HttpMethod,
    path: pathSegments.length === 0 ? "/" : `/${pathSegments.join("/")}`,
  };
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
  routesRootDir: string,
): HttpHandlerDefinition {
  for (const value of Object.values(moduleExports)) {
    if (isHttpHandlerDefinition(value)) {
      const discovered = normalizeHttpRouteFile(routesRootDir, filePath);

      return {
        ...value,
        method: value.method ?? discovered.method,
        path: value.path ?? discovered.path,
      };
    }
  }

  throw new Error(`HTTP route module "${filePath}" does not export a handler`);
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
