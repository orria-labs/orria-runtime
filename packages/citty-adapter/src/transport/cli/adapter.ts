import {
  createPollingFileWatcher,
  defineTransportAdapter,
  isOrriaTempModulePath,
  type BusTypesContract,
  type CreateApplicationAdapterContext,
  type DatabaseAdapter,
} from "@orria-labs/runtime";
import path from "node:path";
import {
  createMain,
  defineCommand as defineCittyCommand,
  parseArgs,
  renderUsage,
  runCommand,
  type ArgsDef,
  type CommandDef,
  type CommandContext,
} from "citty";

import { generateCliCommandRegistryArtifacts } from "./codegen/generate-command-registry.ts";
import {
  discoverCliCommands,
  resolveCliPackageMeta,
  validateCliCommands,
} from "./discovery.ts";
import { buildCliCommandTree, createAliasedSubCommands } from "./tree.ts";
import type {
  CliAdapterInstance,
  CliAdapterWatchOptions,
  CliCommandDefinition,
  CliCommandHandlerContext,
  CreateCliAdapterOptions,
} from "./types.ts";

const DEFAULT_COMMANDS_DIR = path.join("src", "transport", "cli", "command");
const SUPPORTED_WATCH_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs"]);

export function createCliAdapter<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>(
  options: CreateCliAdapterOptions<TBuses, TDatabase> = {},
) {
  return defineTransportAdapter<CliAdapterInstance, TBuses, TDatabase>(async (adapterContext) => {
    let resolved = await buildCliRuntime(options, adapterContext);
    let watcher = createCliWatcher(options, adapterContext, async () => {
      resolved = await buildCliRuntime(options, adapterContext);

      if (options.rootDir) {
        await generateCliCommandRegistryArtifacts({
          rootDir: options.rootDir,
          commandsDir: options.commandsDir,
        });
      }
    });

    return {
      kind: "cli",
      get command() {
        return resolved.command;
      },
      get watching() {
        return watcher.active;
      },
      run: (rawArgs) => resolved.main({ rawArgs: rawArgs ? [...rawArgs] : undefined }),
      invoke: (rawArgs) => invokeCommand(resolved.command, rawArgs ? [...rawArgs] : []),
      renderUsage: () => renderUsage(resolved.command),
      reload: async () => {
        resolved = await buildCliRuntime(options, adapterContext);
      },
      watch: async (watchOptions) => {
        watcher = createCliWatcher(options, adapterContext, async () => {
          resolved = await buildCliRuntime(options, adapterContext);

          if (options.rootDir) {
            await generateCliCommandRegistryArtifacts({
              rootDir: options.rootDir,
              commandsDir: options.commandsDir,
            });
          }
        }, watcher, watchOptions);
        await watcher.start();
      },
      unwatch: () => {
        watcher.stop();
      },
    };
  });
}

async function buildCliRuntime<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  options: CreateCliAdapterOptions<TBuses, TDatabase>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
): Promise<{ command: CommandDef; main: ReturnType<typeof createMain> }> {
  const discoveredCommands = options.rootDir
    ? await discoverCliCommands({
        rootDir: options.rootDir,
        commandsDir: options.commandsDir,
      })
    : [];
  const packageMeta = options.rootDir
    ? await resolveCliPackageMeta(options.rootDir)
    : undefined;
  const commands = [
    ...discoveredCommands,
    ...(options.commands ?? []),
  ] as Array<CliCommandDefinition<ArgsDef, TBuses, TDatabase>>;

  validateCliCommands(commands);

  const rootCommand = buildCliCommandTree(
    {
      name: options.name ?? options.meta?.name ?? packageMeta?.name ?? "app",
      meta: {
        ...packageMeta,
        ...options.meta,
        name: options.name ?? options.meta?.name ?? packageMeta?.name ?? "app",
      },
      args: options.args,
      setup: options.setup,
      cleanup: options.cleanup,
      run: options.run,
    },
    commands,
  ) as CliCommandDefinition<ArgsDef, TBuses, TDatabase>;

  const command = toCittyCommand(rootCommand, adapterContext, []);

  return {
    command,
    main: createMain(command),
  };
}

function createCliWatcher<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  options: CreateCliAdapterOptions<TBuses, TDatabase>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  reload: () => Promise<void>,
  existingWatcher = createPollingFileWatcher({ roots: [], onChange: () => undefined }),
  watchOptions?: CliAdapterWatchOptions,
) {
  existingWatcher.stop();

  if (!options.rootDir) {
    return existingWatcher;
  }

  // Polling keeps nested file-based commands stable across Bun/Node platforms
  // and mirrors the same discovery paths used during the initial bootstrap.
  return createPollingFileWatcher({
    roots: [path.resolve(options.rootDir, options.commandsDir ?? DEFAULT_COMMANDS_DIR)],
    intervalMs: watchOptions?.intervalMs,
    includeFile: isCliSourceFile,
    onChange: reload,
    onError: (error) => {
      adapterContext.console.error("[orria:cli] watch reload failed", error);
    },
  });
}

function isCliSourceFile(filePath: string): boolean {
  const extension = path.extname(filePath);
  return (
    SUPPORTED_WATCH_EXTENSIONS.has(extension) &&
    !filePath.endsWith(".d.ts") &&
    !isOrriaTempModulePath(filePath)
  );
}

function toCittyCommand<
  TArgs extends ArgsDef,
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  command: CliCommandDefinition<TArgs, TBuses, TDatabase>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  commandPath: string[],
): CommandDef<TArgs> {
  const setup = command.setup;
  const cleanup = command.cleanup;
  const run = command.run;
  const childCommands = Object.values(command.subCommands ?? {}) as Array<
    CliCommandDefinition<ArgsDef, TBuses, TDatabase>
  >;
  const resolvedSubCommands = childCommands.length > 0
    ? Object.fromEntries(
        childCommands.map((child) => {
          const childName = child.name;

          if (!childName) {
            throw new Error(`CLI subcommand at "${commandPath.join(" ")}" is missing a name`);
          }

          return [
            childName,
            toCittyCommand(child, adapterContext, [...commandPath, childName]),
          ];
        }),
      )
    : undefined;

  return defineCittyCommand<TArgs>({
    meta: {
      ...command.meta,
      name: command.meta?.name ?? command.name,
    },
    args: command.args,
    subCommands: resolvedSubCommands
      ? createAliasedSubCommands(resolvedSubCommands, childCommands)
      : undefined,
    setup: setup
      ? (context) => setup(createHandlerContext(context, adapterContext, command, commandPath))
      : undefined,
    cleanup: cleanup
      ? (context) => cleanup(createHandlerContext(context, adapterContext, command, commandPath))
      : undefined,
    run: run
      ? (context) => run(createHandlerContext(context, adapterContext, command, commandPath))
      : undefined,
  });
}

function createHandlerContext<
  TArgs extends ArgsDef,
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  context: CommandContext<TArgs>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  command: CliCommandDefinition<TArgs, TBuses, TDatabase>,
  commandPath: string[],
): CliCommandHandlerContext<TArgs, TBuses, TDatabase> {
  return {
    ...context,
    ctx: adapterContext.ctx,
    adapterContext,
    command,
    commandPath,
  };
}

async function invokeCommand(
  command: CommandDef,
  rawArgs: string[],
): Promise<unknown> {
  const commandArgs = await resolveResolvable(command.args ?? {});
  const args = parseArgs(rawArgs, commandArgs as ArgsDef);
  const context: CommandContext = {
    rawArgs,
    args,
    cmd: command,
  };

  if (command.setup) {
    await command.setup(context);
  }

  let result: unknown;

  try {
    const subCommands = await resolveResolvable(command.subCommands);
    if (subCommands && Object.keys(subCommands).length > 0) {
      const subCommandArgIndex = rawArgs.findIndex((arg) => !arg.startsWith("-"));
      const subCommandName = rawArgs[subCommandArgIndex];

      if (subCommandName) {
        const subCommand = await resolveResolvable(subCommands[subCommandName]) as CommandDef | undefined;

        if (!subCommand) {
          const attempted = await runCommand(command, {
            rawArgs,
            showUsage: true,
          });

          return attempted.result;
        }

        context.subCommand = subCommand;
        result = await invokeCommand(
          subCommand,
          rawArgs.slice(subCommandArgIndex + 1),
        );
      }
    }

    if (command.run) {
      const ownResult = await command.run(context);
      if (ownResult !== undefined) {
        result = ownResult;
      }
    }
  } finally {
    if (command.cleanup) {
      await command.cleanup(context);
    }
  }

  return result;
}

async function resolveResolvable<TValue>(
  value: TValue | Promise<TValue> | (() => TValue) | (() => Promise<TValue>),
): Promise<TValue> {
  if (typeof value === "function") {
    return Promise.resolve((value as () => TValue | Promise<TValue>)());
  }

  return Promise.resolve(value);
}
