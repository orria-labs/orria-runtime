import type {
  BusTypesContract,
  DatabaseAdapter,
} from "@orria-labs/runtime";
import type { ArgsDef } from "citty";

import type { CliCommandDefinition } from "../types.ts";
import { brandCliCommand } from "./shared.ts";

export function defineCommand<
  TArgs extends ArgsDef = ArgsDef,
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>(
  command: CliCommandDefinition<TArgs, TBuses, TDatabase>,
): CliCommandDefinition<TArgs, TBuses, TDatabase> {
  return brandCliCommand(command) as CliCommandDefinition<TArgs, TBuses, TDatabase>;
}
