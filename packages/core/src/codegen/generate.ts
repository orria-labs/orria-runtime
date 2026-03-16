import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { discoverManifest } from "../discovery/discover.ts";
import { createRegistry } from "../registry/registry.ts";
import type {
  GeneratedManifest,
  GeneratedManifestEntry,
} from "../registry/types.ts";

export interface GenerateCoreArtifactsOptions {
  rootDir?: string;
  modulesDir?: string;
  outDir?: string;
}

export async function generateCoreArtifacts(
  options: GenerateCoreArtifactsOptions = {},
): Promise<GeneratedManifest> {
  const rootDir = options.rootDir ?? process.cwd();
  const modulesDir = options.modulesDir ?? "src/modules";
  const outDir = options.outDir ?? "src/generated/core";
  const manifest = await discoverManifest({ rootDir, modulesDir });

  createRegistry(manifest);

  const absoluteOutDir = path.join(rootDir, outDir);
  await mkdir(absoluteOutDir, { recursive: true });

  await writeFile(
    path.join(absoluteOutDir, "manifest.ts"),
    renderManifest(manifest, outDir),
    "utf8",
  );
  await writeFile(
    path.join(absoluteOutDir, "bus.d.ts"),
    renderBusTypes(manifest.entries, outDir),
    "utf8",
  );
  await writeFile(path.join(absoluteOutDir, "index.ts"), renderGeneratedIndex(), "utf8");

  return manifest;
}

function renderManifest(manifest: GeneratedManifest, outDir: string): string {
  const imports = manifest.entries
    .map((entry) => {
      const identifier = declarationIdentifier(entry);
      return `import ${identifier} from "${relativeGeneratedImport(outDir, entry.modulePath)}";`;
    })
    .join("\n");

  const body = manifest.entries
    .map((entry) => {
      const identifier = declarationIdentifier(entry);
      return `    {
      key: "${entry.key}",
      kind: "${entry.kind}",
      logicalName: "${entry.logicalName}",
      modulePath: "${entry.modulePath}",
      declaration: ${identifier},
    },`;
    })
    .join("\n");

  return `import type { GeneratedManifest } from "@orria-labs/runtime";
import type { GeneratedBusTypes } from "./bus";
${imports ? `${imports}\n` : ""}
export const manifest: GeneratedManifest<GeneratedBusTypes> = {
  version: 1,
  generatedAt: "${manifest.generatedAt}",
  entries: [
${body}
  ],
};

export default manifest;
`;
}

function renderBusTypes(entries: GeneratedManifestEntry[], outDir: string): string {
  const imports = entries
    .map((entry) => {
      const identifier = declarationIdentifier(entry);
      return `type ${identifier} = typeof import("${relativeGeneratedImport(outDir, entry.modulePath)}").default;`;
    })
    .join("\n");

  const grouped = {
    action: entries.filter((entry) => entry.kind === "action"),
    query: entries.filter((entry) => entry.kind === "query"),
    workflow: entries.filter((entry) => entry.kind === "workflow"),
    event: entries.filter((entry) => entry.kind === "event"),
  };

  return `import type {
  EventBusMethod,
  ExecutableBusMethod,
  BusTypesContract,
} from "@orria-labs/runtime";
${imports ? `${imports}\n` : ""}
${renderNestedInterface("ActionBusShape", grouped.action, "executable")}
${renderNestedInterface("QueryBusShape", grouped.query, "executable")}
${renderNestedInterface("WorkflowBusShape", grouped.workflow, "executable")}
${renderNestedInterface("EventBusShape", grouped.event, "event")}

export interface GeneratedBusTypes extends BusTypesContract {
  action: ActionBusShape;
  query: QueryBusShape;
  workflow: WorkflowBusShape;
  event: EventBusShape;
}
`;
}

function renderGeneratedIndex(): string {
  return `export { manifest } from "./manifest.ts";
export type {
  ActionBusShape,
  EventBusShape,
  GeneratedBusTypes,
  QueryBusShape,
  WorkflowBusShape,
} from "./bus";
`;
}

function renderNestedInterface(
  name: string,
  entries: GeneratedManifestEntry[],
  mode: "executable" | "event",
): string {
  const tree: Record<string, unknown> = {};

  for (const entry of entries) {
    assignTree(tree, entry.logicalName.split("."), functionSignature(entry, mode));
  }

  return `export interface ${name} ${renderTree(tree, 0)}\n`;
}

function renderTree(tree: Record<string, unknown>, depth: number): string {
  const indent = "  ".repeat(depth);
  const childIndent = "  ".repeat(depth + 1);
  const parts = Object.entries(tree)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([segment, value]) => {
      if (typeof value === "string") {
        return `${childIndent}${segment}: ${value};`;
      }

      return `${childIndent}${segment}: ${renderTree(value as Record<string, unknown>, depth + 1)};`;
    });

  if (parts.length === 0) {
    return "{}";
  }

  return `{\n${parts.join("\n")}\n${indent}}`;
}

function functionSignature(
  entry: GeneratedManifestEntry,
  mode: "executable" | "event",
): string {
  const identifier = declarationIdentifier(entry);

  if (mode === "event") {
    return `EventBusMethod<${identifier}>`;
  }

  return `ExecutableBusMethod<${identifier}>`;
}

function declarationIdentifier(entry: GeneratedManifestEntry): string {
  return entry.key
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part, partIndex) => {
      const lower = part.toLowerCase();
      if (partIndex === 0) {
        return lower;
      }

      return lower[0]!.toUpperCase() + lower.slice(1);
    })
    .join("");
}

function relativeGeneratedImport(outDir: string, modulePath: string): string {
  const relative = path.posix.relative(outDir, modulePath);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function assignTree(
  root: Record<string, unknown>,
  segments: string[],
  signature: string,
): void {
  let cursor = root;

  for (const segment of segments.slice(0, -1)) {
    const value = cursor[segment];
    if (!value || typeof value !== "object") {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments.at(-1)!] = signature;
}
