import type {
  BusTypesContract,
  DatabaseAdapter,
} from "@orria-labs/runtime";

import type { HttpPluginDefinition } from "../types.ts";
import { registerHttpPluginCodegen } from "./shared.ts";

export function defineCodegenPlugin<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  const TPlugin extends HttpPluginDefinition<TBuses, TDatabase> = HttpPluginDefinition<
    TBuses,
    TDatabase
  >,
>(
  plugin: TPlugin,
  metadata: {
    baseDir: string;
    importPath: string;
    exportName?: string;
  },
): TPlugin {
  return registerHttpPluginCodegen(plugin, metadata) as TPlugin;
}
