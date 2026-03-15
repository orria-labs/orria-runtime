import type {
  BusTypesContract,
  DatabaseAdapter,
} from "@orria-labs/runtime";

import type {
  HttpPluginRef,
  HttpWsRouteDefinition,
  HttpWsRouteOptions,
} from "../types.ts";
import { brandHttpWsRoute } from "./ws-shared.ts";

function defineTypedWsRoute<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  const TPath extends string | undefined = string,
  const TOptions extends HttpWsRouteOptions = HttpWsRouteOptions,
  const TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
    TBuses,
    TDatabase
  >[],
>(
  route: HttpWsRouteDefinition<TBuses, TDatabase, TPath, TOptions, TPlugins>,
): HttpWsRouteDefinition<TBuses, TDatabase, TPath, TOptions, TPlugins> {
  return brandHttpWsRoute(route) as HttpWsRouteDefinition<
    TBuses,
    TDatabase,
    TPath,
    TOptions,
    TPlugins
  >;
}

export function defineWs<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>() {
  return function defineInferredWsRoute<
    const TPath extends string | undefined = string,
    const TOptions extends HttpWsRouteOptions = HttpWsRouteOptions,
    const TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
      TBuses,
      TDatabase
    >[],
  >(
    route: HttpWsRouteDefinition<TBuses, TDatabase, TPath, TOptions, TPlugins>,
  ): HttpWsRouteDefinition<TBuses, TDatabase, TPath, TOptions, TPlugins> {
    return defineTypedWsRoute<TBuses, TDatabase, TPath, TOptions, TPlugins>(route);
  };
}

export function createWsFactory<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  const TGlobalPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = undefined,
>(
  options?: {
    plugins?: TGlobalPlugins;
  },
) {
  void options;

  return defineWs<TBuses, TDatabase>();
}

export const defineWebsocket = defineWs;
