import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { discoverHttpPlugins } from "../discovery.ts";

export interface GenerateHttpPluginRegistryOptions {
  rootDir?: string;
  pluginsDir?: string;
  outFile?: string;
}

export async function generateHttpPluginRegistryArtifacts(
  options: GenerateHttpPluginRegistryOptions = {},
): Promise<{ refs: string[]; outFile: string }> {
  const rootDir = options.rootDir ?? process.cwd();
  const outFile = options.outFile ?? path.join("src", "generated", "http", "plugin-registry.d.ts");
  const plugins = await discoverHttpPlugins({
    rootDir,
    pluginsDir: options.pluginsDir,
  });
  const absoluteOutFile = path.join(rootDir, outFile);

  await mkdir(path.dirname(absoluteOutFile), { recursive: true });
  await writeFile(
    absoluteOutFile,
    renderHttpPluginRegistry({
      outFile: absoluteOutFile,
      plugins,
    }),
    "utf8",
  );

  const refs = plugins.flatMap((entry) => [entry.name, ...(entry.plugin.refs ?? [])]);

  return {
    refs: Array.from(new Set(refs)).sort((left, right) => left.localeCompare(right)),
    outFile,
  };
}

function renderHttpPluginRegistry(args: {
  outFile: string;
  plugins: Awaited<ReturnType<typeof discoverHttpPlugins>>;
}): string {
  const entries = args.plugins.flatMap((entry) => {
    const refs = Array.from(new Set([entry.name, ...(entry.plugin.refs ?? [])]));
    const importPath = relativeImport(args.outFile, entry.filePath);

    return refs.map((ref) => `    ${JSON.stringify(ref)}: typeof import(${JSON.stringify(importPath)}).default;`);
  });

  return `declare module "@orria-labs/runtime-elysia" {
  interface HttpPluginRegistry {
${entries.join("\n")}
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
