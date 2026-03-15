import type {
  BusTypesContract,
  DatabaseAdapter,
} from "@orria-labs/runtime";

import type { HttpPluginDefinition } from "../types.ts";
import { brandHttpPlugin } from "./shared.ts";

export function definePlugin<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  const TPlugin extends HttpPluginDefinition<TBuses, TDatabase> = HttpPluginDefinition<
    TBuses,
    TDatabase
  >,
>(
  plugin: TPlugin,
): TPlugin {
  return brandHttpPlugin(plugin) as TPlugin;
}
