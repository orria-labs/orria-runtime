const CLI_COMMAND_SYMBOL = Symbol.for("orria.cli.command");

type CliCommandBrand = {
  readonly [CLI_COMMAND_SYMBOL]: true;
};

export type BrandedCliCommandDefinition = CliCommandBrand & {
  name?: string;
  path?: string | string[];
};

export function brandCliCommand<TCommand extends object>(
  command: TCommand,
): TCommand & CliCommandBrand {
  return Object.freeze({
    ...command,
    [CLI_COMMAND_SYMBOL]: true,
  });
}

export function isCliCommandDefinition(value: unknown): value is BrandedCliCommandDefinition {
  return Boolean(
    value &&
    typeof value === "object" &&
    CLI_COMMAND_SYMBOL in (value as Record<PropertyKey, unknown>),
  );
}
