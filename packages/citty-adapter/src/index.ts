export { createCliAdapter } from "./transport/cli/adapter.ts";
export {
  generateCliCommandRegistryArtifacts,
  orriaAdapterCodegen,
} from "./transport/cli/codegen/generate-command-registry.ts";
export {
  discoverCliCommandModules,
  discoverCliCommands,
  normalizeCommandSegment,
  resolveCliPackageMeta,
  validateCliCommands,
} from "./transport/cli/discovery.ts";
export { defineCommand } from "./transport/cli/command/index.ts";
export type {
  CliAdapterInstance,
  CliAdapterWatchOptions,
  CliCommandDefinition,
  CliCommandHandlerContext,
  CliCommandAliasRegistry,
  CliCommandRegistry,
  CliCommandMeta,
  CliProgrammaticArgs,
  CreateCliAdapterOptions,
  DiscoverCliCommandsOptions,
  RegisteredCliCommandArgs,
  ResolvedCliCommandModule,
} from "./transport/cli/types.ts";
