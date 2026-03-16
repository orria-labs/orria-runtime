import { Elysia } from "elysia";
import type { HttpBaseApp, HttpHandlerDefinition, HttpMethod, HttpPluginRegistry, HttpWsRouteDefinition, ResolveHttpHandlerApp } from "@orria-labs/runtime-elysia";
import route0 from "../../transport/http/router/health.get.ts";
import route1 from "../../transport/http/router/user/create.post.ts";
import route2 from "../../transport/http/router/v1/user-status.get.ts";
import route3 from "../../transport/http/router/v1/user/:id/status.get.ts";

declare const globalPlugin0: ResolveGeneratedPluginApp<"spec">;
type ResolveGeneratedPluginDefinition<TPluginRef> = TPluginRef extends keyof HttpPluginRegistry ? HttpPluginRegistry[TPluginRef] : TPluginRef;
type ResolveGeneratedPluginApp<TPluginRef> = ResolveGeneratedPluginDefinition<TPluginRef> extends {
  setup: (...args: any[]) => infer TResult;
} ? Awaited<Exclude<TResult, void>> : Elysia;
type ResolveGeneratedRouteBaseApp<TRoute extends HttpHandlerDefinition<any, any, any, any, any, any>> =
  TRoute extends HttpHandlerDefinition<infer TBuses, infer TDatabase, infer TBaseApp, any, any, infer TPlugins>
    ? ResolveHttpHandlerApp<TBuses, TDatabase, TBaseApp, TPlugins>
    : Elysia;
type ResolveGeneratedWsRouteBaseApp<TRoute extends HttpWsRouteDefinition<any, any, any, any, any>> =
  TRoute extends HttpWsRouteDefinition<infer TBuses, infer TDatabase, any, any, infer TPlugins>
    ? ResolveHttpHandlerApp<TBuses, TDatabase, HttpBaseApp<TBuses, TDatabase>, TPlugins>
    : Elysia;
type ResolveGeneratedRouteHandler<TRoute extends HttpHandlerDefinition<any, any, any, any, any, any>, TMethod extends HttpMethod, TPath extends string> =
  ResolveGeneratedRouteBaseApp<TRoute>["route"] extends (
    method: TMethod,
    path: TPath,
    handler: infer THandler,
    hook?: TRoute["options"],
  ) => any ? THandler : never;
declare function toElysiaHandler<TRoute extends HttpHandlerDefinition<any, any, any, any, any, any>, TMethod extends HttpMethod, TPath extends string>(
  route: TRoute,
): ResolveGeneratedRouteHandler<TRoute, TMethod, TPath>;
declare const routeBase0: ResolveGeneratedRouteBaseApp<typeof route0>;
declare const routeBase1: ResolveGeneratedRouteBaseApp<typeof route1>;
declare const routeBase2: ResolveGeneratedRouteBaseApp<typeof route2>;
declare const routeBase3: ResolveGeneratedRouteBaseApp<typeof route3>;

export const app = new Elysia()
  .use(globalPlugin0)
  .use(routeBase0.route("GET", "/health", toElysiaHandler<typeof route0, "GET", "/health">(route0), route0.options))
  .use(routeBase1.route("POST", "/user/create", toElysiaHandler<typeof route1, "POST", "/user/create">(route1), route1.options))
  .use(routeBase2.route("GET", "/v1/user-status", toElysiaHandler<typeof route2, "GET", "/v1/user-status">(route2), route2.options))
  .use(routeBase3.route("GET", "/v1/user/:id/status", toElysiaHandler<typeof route3, "GET", "/v1/user/:id/status">(route3), route3.options));
