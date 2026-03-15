import type {
  BusTypesContract,
  DatabaseAdapter,
} from "@orria-labs/runtime";
import type { Elysia } from "elysia";

import type {
  HttpBaseApp,
  HttpHandlerDefinition,
  HttpPluginRef,
  HttpRouteOptions,
  ResolveHttpHandlerApp,
} from "../types.ts";
import { brandHttpHandler } from "./shared.ts";

function defineTypedHandler<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TApp extends Elysia<any, any, any, any, any, any, any> = HttpBaseApp<TBuses, TDatabase>,
  const TPath extends string | undefined = string,
  const TOptions extends HttpRouteOptions | undefined = HttpRouteOptions,
  const TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
    TBuses,
    TDatabase
  >[],
>(
  handler: HttpHandlerDefinition<TBuses, TDatabase, TApp, TPath, TOptions, TPlugins>,
): HttpHandlerDefinition<TBuses, TDatabase, TApp, TPath, TOptions, TPlugins> {
  return brandHttpHandler(handler) as HttpHandlerDefinition<
    TBuses,
    TDatabase,
    TApp,
    TPath,
    TOptions,
    TPlugins
  >;
}

export function defineHandler<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TApp extends Elysia<any, any, any, any, any, any, any> = HttpBaseApp<TBuses, TDatabase>,
>() {
  return function defineInferredHttpHandler<
    const TPath extends string | undefined = string,
    const TOptions extends HttpRouteOptions | undefined = HttpRouteOptions,
    const TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
      TBuses,
      TDatabase
    >[],
  >(
    handler: HttpHandlerDefinition<TBuses, TDatabase, TApp, TPath, TOptions, TPlugins>,
  ): HttpHandlerDefinition<TBuses, TDatabase, TApp, TPath, TOptions, TPlugins> {
    return defineTypedHandler<TBuses, TDatabase, TApp, TPath, TOptions, TPlugins>(handler);
  };
}

export function createHandlerFactory<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  const TGlobalPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = undefined,
>(
  options?: {
    plugins?: TGlobalPlugins;
  },
) {
  void options;

  return defineHandler<
    TBuses,
    TDatabase,
    ResolveHttpHandlerApp<TBuses, TDatabase, HttpBaseApp<TBuses, TDatabase>, TGlobalPlugins>
  >();
}

export const defineHttpRoute = defineHandler;
