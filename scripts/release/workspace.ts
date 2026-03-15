import { readFile } from "node:fs/promises";
import path from "node:path";

export interface ReleasePackageConfig {
  dir: string;
  entries: Record<string, string>;
  bin?: Record<string, string>;
}

export interface PackageManifest {
  name: string;
  version: string;
  type?: string;
  description?: string;
  keywords?: string[];
  license?: string;
  author?: string | Record<string, unknown>;
  homepage?: string;
  repository?: string | Record<string, unknown>;
  bugs?: string | Record<string, unknown>;
  sideEffects?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, unknown>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  publishConfig?: Record<string, unknown>;
}

export const releasePackages = [
  {
    dir: "packages/core",
    entries: {
      index: "src/index.ts",
      "cli/main": "src/cli/main.ts",
    },
    bin: {
      "orria-runtime": "./cli/main.js",
    },
  },
  {
    dir: "packages/elysia-adapter",
    entries: {
      index: "src/index.ts",
    },
  },
  {
    dir: "packages/citty-adapter",
    entries: {
      index: "src/index.ts",
    },
  },
  {
    dir: "packages/croner-adapter",
    entries: {
      index: "src/index.ts",
    },
  },
] satisfies ReleasePackageConfig[];

export const releasePackageByDir = new Map(
  releasePackages.map((entry) => [normalizeSlashes(entry.dir), entry]),
);

export async function readPackageManifest(packageDir: string): Promise<PackageManifest> {
  const packageJsonPath = path.join(packageDir, "package.json");
  return JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageManifest;
}

export async function readWorkspaceVersions(rootDir: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();

  for (const entry of releasePackages) {
    const manifest = await readPackageManifest(path.join(rootDir, entry.dir));
    versions.set(manifest.name, manifest.version);
  }

  return versions;
}

export function normalizeSlashes(value: string): string {
  return value.replaceAll("\\", "/");
}

export function resolveWorkspaceDependencyVersion(
  range: string,
  dependencyName: string,
  workspaceVersions: Map<string, string>,
): string {
  if (!range.startsWith("workspace:")) {
    return range;
  }

  const version = workspaceVersions.get(dependencyName);

  if (!version) {
    throw new Error(`Unknown workspace dependency: ${dependencyName}`);
  }

  const workspaceRange = range.slice("workspace:".length);

  if (workspaceRange === "*" || workspaceRange === "") {
    return `^${version}`;
  }

  if (workspaceRange === "^" || workspaceRange === "~") {
    return `${workspaceRange}${version}`;
  }

  return workspaceRange.replace("*", version);
}
