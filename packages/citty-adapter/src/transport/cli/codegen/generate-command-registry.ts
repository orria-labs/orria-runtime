import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AdapterCodegen } from "@orria-labs/runtime";

import {
  discoverCliCommands,
  normalizeCommandSegment,
} from "../discovery.ts";
import { buildCliCommandTree } from "../tree.ts";
import type { CliCommandDefinition } from "../types.ts";

interface RegistryEntry {
  key: string;
  rawArgs: string[];
}

export interface GenerateCliCommandRegistryOptions {
  rootDir?: string;
  commandsDir?: string;
  outFile?: string;
}

export async function generateCliCommandRegistryArtifacts(
  options: GenerateCliCommandRegistryOptions = {},
): Promise<{
  commandPaths: string[];
  aliasPaths: string[];
  outFile: string;
}> {
  const rootDir = options.rootDir ?? process.cwd();
  const outFile = options.outFile ?? path.join("src", "generated", "cli", "command-registry.d.ts");
  const commands = await discoverCliCommands({
    rootDir,
    commandsDir: options.commandsDir,
  });
  const rootCommand = buildCliCommandTree({ name: "app" }, commands);
  const collected = collectCommandEntries(rootCommand);
  const absoluteOutFile = path.join(rootDir, outFile);

  await mkdir(path.dirname(absoluteOutFile), { recursive: true });
  await writeFile(
    absoluteOutFile,
    renderCliCommandRegistry(collected),
    "utf8",
  );

  return {
    commandPaths: collected.commandPaths.map((entry) => entry.key),
    aliasPaths: collected.aliasPaths.map((entry) => entry.key),
    outFile,
  };
}

export const orriaAdapterCodegen: AdapterCodegen = {
  name: "cli-command-registry",
  async generate({ rootDir }) {
    const result = await generateCliCommandRegistryArtifacts({ rootDir });

    return {
      name: "cli-command-registry",
      outputs: [result.outFile],
    };
  },
};

function collectCommandEntries(rootCommand: CliCommandDefinition): {
  commandPaths: RegistryEntry[];
  aliasPaths: RegistryEntry[];
} {
  const commandPaths = new Map<string, RegistryEntry>();
  const aliasPaths = new Map<string, RegistryEntry>();

  visitCommandNode(rootCommand, [], [[]], commandPaths, aliasPaths);

  return {
    commandPaths: Array.from(commandPaths.values()).sort((left, right) => left.key.localeCompare(right.key)),
    aliasPaths: Array.from(aliasPaths.values()).sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function visitCommandNode(
  node: CliCommandDefinition,
  canonicalPath: string[],
  rawPathVariants: string[][],
  commandPaths: Map<string, RegistryEntry>,
  aliasPaths: Map<string, RegistryEntry>,
): void {
  for (const child of Object.values(node.subCommands ?? {})) {
    if (!child.name) {
      continue;
    }

    const segmentVariants = [
      child.name,
      ...new Set((child.aliases ?? child.meta?.aliases ?? []).map((alias) => normalizeCommandSegment(alias))),
    ].filter(Boolean);
    const nextCanonicalPath = [...canonicalPath, child.name];
    const nextRawVariants = expandRawVariants(rawPathVariants, segmentVariants);
    const canonicalKey = nextCanonicalPath.join(".");
    const canonicalRawArgs = [...nextCanonicalPath, "...string[]"];

    commandPaths.set(canonicalKey, {
      key: canonicalKey,
      rawArgs: canonicalRawArgs,
    });

    for (const rawVariant of nextRawVariants) {
      const aliasKey = rawVariant.join(".");

      if (aliasKey === canonicalKey) {
        continue;
      }

      aliasPaths.set(aliasKey, {
        key: aliasKey,
        rawArgs: [...rawVariant, "...string[]"],
      });
    }

    visitCommandNode(child, nextCanonicalPath, nextRawVariants, commandPaths, aliasPaths);
  }
}

function expandRawVariants(base: string[][], additions: string[]): string[][] {
  const output: string[][] = [];

  for (const current of base) {
    for (const addition of additions) {
      output.push([...current, addition]);
    }
  }

  return output;
}

function renderCliCommandRegistry(args: {
  commandPaths: RegistryEntry[];
  aliasPaths: RegistryEntry[];
}): string {
  const renderEntry = (entry: RegistryEntry) =>
    `    ${JSON.stringify(entry.key)}: [${entry.rawArgs.map((item) =>
      item === "...string[]" ? item : JSON.stringify(item)).join(", ")}];`;

  return `declare module "@orria-labs/runtime-citty" {
  interface CliCommandRegistry {
${args.commandPaths.map(renderEntry).join("\n")}
  }

  interface CliCommandAliasRegistry {
${args.aliasPaths.map(renderEntry).join("\n")}
  }
}

export {};
`;
}
