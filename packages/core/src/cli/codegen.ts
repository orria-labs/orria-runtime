import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  AdapterCodegen,
  AdapterCodegenContext,
  GeneratedManifest,
} from "../index.ts";

interface ProjectPackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface InstalledPackageManifest {
  exports?: unknown;
  main?: string;
  module?: string;
}

export async function runInstalledAdapterCodegens(
  rootDir: string,
  manifest: GeneratedManifest,
): Promise<void> {
  const packageNames = await resolveProjectAdapterPackageNames(rootDir);

  for (const packageName of packageNames) {
    const entryFilePath = await resolveInstalledPackageEntryFile(rootDir, packageName);

    if (!entryFilePath) {
      continue;
    }

    const imported = await import(pathToFileURL(entryFilePath).href) as {
      orriaAdapterCodegen?: AdapterCodegen | AdapterCodegen[];
    };

    const codegens = normalizeCodegens(imported.orriaAdapterCodegen);
    const context: AdapterCodegenContext = {
      rootDir,
      manifest,
    };

    for (const codegen of codegens) {
      await codegen.generate(context);
    }
  }
}

async function resolveProjectAdapterPackageNames(rootDir: string): Promise<string[]> {
  const packageFilePath = path.join(rootDir, "package.json");

  try {
    const packageJson = JSON.parse(await readFile(packageFilePath, "utf8")) as ProjectPackageManifest;
    const names = new Set<string>();

    for (const dependencies of [
      packageJson.dependencies,
      packageJson.devDependencies,
      packageJson.optionalDependencies,
      packageJson.peerDependencies,
    ]) {
      for (const name of Object.keys(dependencies ?? {})) {
        if (name.startsWith("@orria-labs/") && name !== "@orria-labs/runtime") {
          names.add(name);
        }
      }
    }

    return Array.from(names).sort((left, right) => left.localeCompare(right));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function resolveInstalledPackageEntryFile(
  rootDir: string,
  packageName: string,
): Promise<string | undefined> {
  const packageDir = path.join(rootDir, "node_modules", ...packageName.split("/"));
  const packageFilePath = path.join(packageDir, "package.json");

  try {
    const packageJson = JSON.parse(await readFile(packageFilePath, "utf8")) as InstalledPackageManifest;
    const entry =
      resolveExportsEntry(packageJson.exports) ??
      packageJson.module ??
      packageJson.main;

    return entry ? path.join(packageDir, entry) : undefined;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function resolveExportsEntry(exportsField: unknown): string | undefined {
  if (typeof exportsField === "string") {
    return exportsField;
  }

  if (!exportsField || typeof exportsField !== "object") {
    return undefined;
  }

  const record = exportsField as Record<string, unknown>;

  for (const key of [".", "bun", "import", "default"]) {
    const candidate = record[key];
    const resolved = resolveExportsEntry(candidate);

    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function normalizeCodegens(
  codegen: AdapterCodegen | AdapterCodegen[] | undefined,
): AdapterCodegen[] {
  if (!codegen) {
    return [];
  }

  return Array.isArray(codegen) ? codegen : [codegen];
}
