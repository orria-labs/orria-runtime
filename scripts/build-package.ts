import { chmod, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { build } from "tsup";

import {
  normalizeSlashes,
  readPackageManifest,
  readWorkspaceVersions,
  releasePackageByDir,
  resolveWorkspaceDependencyVersion,
  type PackageManifest,
} from "./release/workspace.ts";

const rootDir = path.resolve(import.meta.dir, "..");
const targetDir = path.resolve(process.cwd(), process.argv[2] ?? ".");
const relativeTargetDir = normalizeSlashes(path.relative(rootDir, targetDir) || ".");
const releaseConfig = releasePackageByDir.get(relativeTargetDir);

if (!releaseConfig) {
  throw new Error(`Unsupported release package: ${relativeTargetDir}`);
}

const distDir = path.join(targetDir, "dist");
const manifest = await readPackageManifest(targetDir);
const workspaceVersions = await readWorkspaceVersions(rootDir);

// Перед публикацией каждый пакет собирается в изолированный dist-каталог,
// чтобы npm получал только минимальный runtime bundle и декларации типов.
await rm(distDir, { recursive: true, force: true });

await build({
  entry: Object.fromEntries(
    Object.entries(releaseConfig.entries).map(([name, entryPath]) => [
      name,
      path.join(targetDir, entryPath),
    ]),
  ),
  outDir: distDir,
  format: ["esm"],
  dts: true,
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  clean: false,
  treeshake: true,
  target: "esnext",
  skipNodeModulesBundle: true,
  external: [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ],
  silent: true,
});

if (releaseConfig.bin) {
  await Promise.all(
    Object.values(releaseConfig.bin).map(async (entryPath) => {
      const relativeFilePath = entryPath.replace(/^\.\//, "");
      const absoluteFilePath = path.join(distDir, relativeFilePath);
      const source = await readFile(absoluteFilePath, "utf8");

      if (!source.startsWith("#!/usr/bin/env bun")) {
        await writeFile(absoluteFilePath, `#!/usr/bin/env bun\n${source}`, "utf8");
      }

      await chmod(absoluteFilePath, 0o755);
    }),
  );
}

await mkdir(distDir, { recursive: true });
await copyIfExists(path.join(targetDir, "README.md"), path.join(distDir, "README.md"));
await writeFile(
  path.join(distDir, "package.json"),
  `${JSON.stringify(createPublishedManifest(manifest, workspaceVersions), null, 2)}\n`,
  "utf8",
);

function createPublishedManifest(
  sourceManifest: PackageManifest,
  versions: Map<string, string>,
): PackageManifest & {
  exports: { ".": { types: string; import: string; default: string } };
  main: string;
  module: string;
  types: string;
  bin?: Record<string, string>;
} {
  const publishedManifest = {
    name: sourceManifest.name,
    version: sourceManifest.version,
    description: sourceManifest.description,
    type: "module",
    keywords: sourceManifest.keywords,
    license: sourceManifest.license,
    author: sourceManifest.author,
    homepage: sourceManifest.homepage,
    repository: sourceManifest.repository,
    bugs: sourceManifest.bugs,
    sideEffects: sourceManifest.sideEffects,
    main: "./index.js",
    module: "./index.js",
    types: "./index.d.ts",
    exports: {
      ".": {
        types: "./index.d.ts",
        import: "./index.js",
        default: "./index.js",
      },
    },
    bin: normalizeBinMap(releaseConfig.bin),
    dependencies: rewriteDependencyMap(sourceManifest.dependencies, versions),
    peerDependencies: sourceManifest.peerDependencies,
    peerDependenciesMeta: sourceManifest.peerDependenciesMeta,
    optionalDependencies: rewriteDependencyMap(sourceManifest.optionalDependencies, versions),
    engines: sourceManifest.engines,
    publishConfig: {
      access: "public",
      ...(sourceManifest.publishConfig ?? {}),
    },
  };

  return removeUndefinedFields(publishedManifest);
}

function rewriteDependencyMap(
  dependencies: Record<string, string> | undefined,
  versions: Map<string, string>,
): Record<string, string> | undefined {
  if (!dependencies) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(dependencies).map(([dependencyName, range]) => [
      dependencyName,
      resolveWorkspaceDependencyVersion(range, dependencyName, versions),
    ]),
  );
}

function removeUndefinedFields<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
}

function normalizeBinMap(bin: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!bin) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(bin).map(([name, entryPath]) => [name, entryPath.replace(/^\.\//, "")]),
  );
}

async function copyIfExists(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await copyFile(sourcePath, targetPath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
}
