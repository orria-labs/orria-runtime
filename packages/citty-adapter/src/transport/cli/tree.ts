import type { ArgsDef, CommandDef } from "citty";

import type {
  CliCommandDefinition,
  CliCommandMeta,
} from "./types.ts";

type CliCommandNode = CliCommandDefinition & {
  name: string;
  path: string[];
  meta?: CliCommandMeta;
  subCommands?: Record<string, CliCommandNode>;
};

export function buildCliCommandTree(
  rootCommand: CliCommandDefinition,
  commands: CliCommandDefinition[],
): CliCommandDefinition {
  const rootNode = createNode({
    ...rootCommand,
    name: rootCommand.name ?? rootCommand.meta?.name ?? "app",
    path: [],
  });

  for (const command of commands) {
    insertCommand(rootNode, command);
  }

  return rootNode;
}

export function createAliasedSubCommands(
  subCommands: Record<string, CommandDef<ArgsDef>>,
  sourceCommands: CliCommandDefinition[],
): Record<string, CommandDef<ArgsDef>> {
  const output = { ...subCommands };

  for (const command of sourceCommands) {
    const name = command.name;
    if (!name) {
      continue;
    }

    const commandDef = subCommands[name];
    if (!commandDef) {
      continue;
    }

    for (const alias of command.aliases ?? command.meta?.aliases ?? []) {
      if (output[alias] && output[alias] !== commandDef) {
        throw new Error(`CLI alias conflict for "${alias}"`);
      }

      output[alias] = commandDef;
    }
  }

  return output;
}

function insertCommand(
  rootNode: CliCommandNode,
  command: CliCommandDefinition,
): void {
  const pathSegments = resolveCommandPath(command);

  if (pathSegments.length === 0) {
    mergeNode(rootNode, command, []);
    return;
  }

  let currentNode = rootNode;

  for (let index = 0; index < pathSegments.length; index += 1) {
    const segment = pathSegments[index]!;
    const isLeaf = index === pathSegments.length - 1;

    currentNode.subCommands ??= {};
    currentNode.subCommands[segment] ??= createNode({
      name: segment,
      path: pathSegments.slice(0, index + 1),
    });

    currentNode = currentNode.subCommands[segment]!;

    if (isLeaf) {
      mergeNode(currentNode, command, pathSegments);
    }
  }
}

function mergeNode(
  target: CliCommandNode,
  command: CliCommandDefinition,
  pathSegments: string[],
): void {
  if (command.args) {
    target.args = command.args;
  }

  if (command.setup) {
    target.setup = command.setup;
  }

  if (command.cleanup) {
    target.cleanup = command.cleanup;
  }

  if (command.run) {
    target.run = command.run;
  }

  if (command.meta) {
    target.meta = {
      ...target.meta,
      ...command.meta,
    };
  }

  if (command.aliases) {
    target.aliases = [...new Set([...(target.aliases ?? []), ...command.aliases])];
  }

  if (command.subCommands) {
    target.subCommands ??= {};

    for (const [name, child] of Object.entries(command.subCommands)) {
      target.subCommands[name] ??= createNode({
        name,
        path: [...pathSegments, name],
      });

      mergeNode(target.subCommands[name]!, child, [...pathSegments, name]);
    }
  }
}

function resolveCommandPath(command: CliCommandDefinition): string[] {
  if (Array.isArray(command.path)) {
    return command.path;
  }

  if (typeof command.path === "string") {
    return command.path.split("/").filter(Boolean);
  }

  if (command.name) {
    return [command.name];
  }

  return [];
}

function createNode(command: CliCommandDefinition & { name: string; path: string[] }): CliCommandNode {
  return {
    ...command,
    name: command.name,
    path: command.path,
    meta: command.meta,
    subCommands: command.subCommands as Record<string, CliCommandNode> | undefined,
  };
}
