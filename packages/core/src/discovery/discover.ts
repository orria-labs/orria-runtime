import { readdir } from "node:fs/promises";
import path from "node:path";

import { isCoreDeclaration } from "../define.ts";
import { importFreshModule, isOrriaTempModulePath } from "../module.ts";
import type { CoreDeclaration, HandlerKind } from "../types.ts";
import type { GeneratedManifest, GeneratedManifestEntry } from "../registry/types.ts";

interface DiscoveryTarget {
  kind: HandlerKind;
  baseDir: string;
  suffix: string;
}

export interface DiscoveryOptions {
  rootDir?: string;
  modulesDir?: string;
}

export async function discoverManifest(
  options: DiscoveryOptions = {},
): Promise<GeneratedManifest> {
  const rootDir = options.rootDir ?? process.cwd();
  const modulesDir = options.modulesDir ?? "src/modules";
  const entries: GeneratedManifestEntry[] = [];

  const targets: DiscoveryTarget[] = [
    { kind: "action", baseDir: modulesDir, suffix: ".action.ts" },
    { kind: "query", baseDir: modulesDir, suffix: ".query.ts" },
    { kind: "workflow", baseDir: modulesDir, suffix: ".workflow.ts" },
    { kind: "event", baseDir: modulesDir, suffix: ".event.ts" },
  ];

  for (const target of targets) {
    const absoluteBaseDir = path.join(rootDir, target.baseDir);
    const filePaths = await walkFiles(absoluteBaseDir);
    const discoveredEntries = await Promise.all(
      filePaths
        .filter((filePath) => filePath.endsWith(target.suffix))
        .map(async (filePath) => {
          const declaration = await loadDeclaration(filePath, target.kind);
          const relativeFilePath = toPosixPath(path.relative(rootDir, filePath));
          const relativeHandlerPath = toPosixPath(path.relative(absoluteBaseDir, filePath));
          const logicalName = handlerSegments(relativeHandlerPath, target.suffix).join(".");

          return {
            key: `${target.kind}.${logicalName}`,
            kind: target.kind,
            logicalName,
            modulePath: relativeFilePath,
            declaration,
          } satisfies GeneratedManifestEntry;
        }),
    );

    entries.push(...discoveredEntries);
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

async function loadDeclaration(
  filePath: string,
  expectedKind: HandlerKind,
): Promise<CoreDeclaration> {
  const imported = await importFreshModule<{ default?: unknown }>(filePath);
  const declaration: unknown = imported.default;

  if (!isCoreDeclaration(declaration)) {
    throw new Error(`File "${filePath}" must export a core declaration as default export`);
  }

  if (declaration.kind !== expectedKind) {
    throw new Error(
      `File "${filePath}" uses suffix for "${expectedKind}" but exports "${declaration.kind}" declaration`,
    );
  }

  return declaration;
}

async function walkFiles(rootDir: string): Promise<string[]> {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walkFiles(entryPath)));
        continue;
      }

      if (entry.isFile() && !isOrriaTempModulePath(entryPath)) {
        files.push(entryPath);
      }
    }

    return files.sort();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }
}

function handlerSegments(relativePath: string, suffix: string): string[] {
  const withoutSuffix = relativePath.slice(0, -suffix.length);
  const segments = withoutSuffix
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(normalizeSegment);

  if (segments.length === 0) {
    throw new Error(`Unable to derive handler name from "${relativePath}"`);
  }

  return segments;
}

function normalizeSegment(segment: string): string {
  const withBoundaries = segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const cleaned = withBoundaries.replace(/[^a-zA-Z0-9]+/g, " ");
  const words = cleaned.split(" ").filter(Boolean);

  if (words.length === 0) {
    throw new Error(`Invalid path segment "${segment}"`);
  }

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) {
        return lower;
      }

      return lower[0]!.toUpperCase() + lower.slice(1);
    })
    .join("");
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
