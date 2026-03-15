import type {
  ApplicationContext,
  BusTypesContract,
  CreateApplicationAdapterContext,
  DatabaseAdapter,
} from "@orria-labs/runtime";
import type {
  ArgsDef,
  CommandContext,
  CommandDef,
  CommandMeta,
} from "citty";

export interface CliCommandRegistry {}

export interface CliCommandAliasRegistry {}

type RegistryValues<TRegistry> = TRegistry[Extract<keyof TRegistry, string>];

export type RegisteredCliCommandArgs =
  | RegistryValues<CliCommandRegistry>
  | RegistryValues<CliCommandAliasRegistry>;

export type CliProgrammaticArgs = [RegisteredCliCommandArgs] extends [never]
  ? string[]
  : RegisteredCliCommandArgs;

type ResolveCliArgs<TArgs extends readonly string[]> = string[] extends TArgs
  ? string[]
  : TArgs extends CliProgrammaticArgs
    ? TArgs
    : never;

export interface CliAdapterWatchOptions {
  intervalMs?: number;
}

export interface CliCommandMeta extends CommandMeta {
  aliases?: string[];
}

export interface CliCommandHandlerContext<
  TArgs extends ArgsDef = ArgsDef,
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> extends CommandContext<TArgs> {
  ctx: ApplicationContext<TBuses, TDatabase>;
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>;
  command: CliCommandDefinition<TArgs, TBuses, TDatabase>;
  commandPath: string[];
}

export interface CliCommandDefinition<
  TArgs extends ArgsDef = ArgsDef,
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  name?: string;
  path?: string | string[];
  aliases?: string[];
  meta?: CliCommandMeta;
  args?: TArgs;
  subCommands?: Record<string, CliCommandDefinition<ArgsDef, TBuses, TDatabase>>;
  setup?(
    context: CliCommandHandlerContext<TArgs, TBuses, TDatabase>,
  ): Promise<unknown> | unknown;
  cleanup?(
    context: CliCommandHandlerContext<TArgs, TBuses, TDatabase>,
  ): Promise<unknown> | unknown;
  run?(
    context: CliCommandHandlerContext<TArgs, TBuses, TDatabase>,
  ): Promise<unknown> | unknown;
}

export interface CreateCliAdapterOptions<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  rootDir?: string;
  commandsDir?: string;
  meta?: CliCommandMeta;
  args?: ArgsDef;
  name?: string;
  commands?: Array<CliCommandDefinition<ArgsDef, TBuses, TDatabase>>;
  setup?(
    context: CliCommandHandlerContext<ArgsDef, TBuses, TDatabase>,
  ): Promise<unknown> | unknown;
  cleanup?(
    context: CliCommandHandlerContext<ArgsDef, TBuses, TDatabase>,
  ): Promise<unknown> | unknown;
  run?(
    context: CliCommandHandlerContext<ArgsDef, TBuses, TDatabase>,
  ): Promise<unknown> | unknown;
}

export interface DiscoverCliCommandsOptions {
  rootDir: string;
  commandsDir?: string;
}

export interface ResolvedCliCommandModule {
  filePath: string;
  path: string[];
  command: CliCommandDefinition;
}

export interface CliAdapterInstance {
  kind: "cli";
  command: CommandDef;
  readonly watching: boolean;
  run<const TArgs extends readonly string[]>(rawArgs?: ResolveCliArgs<TArgs>): Promise<void>;
  invoke<const TArgs extends readonly string[]>(rawArgs?: ResolveCliArgs<TArgs>): Promise<unknown>;
  renderUsage(): Promise<string>;
  reload(): Promise<void>;
  watch(options?: CliAdapterWatchOptions): Promise<void>;
  unwatch(): void;
}
