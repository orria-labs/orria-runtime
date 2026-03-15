import type { HttpWsRouteDefinition } from "../types.ts";

const HTTP_WS_ROUTE_SYMBOL = Symbol.for("orria.http.ws-route");

type HttpWsRouteBrand = {
  readonly [HTTP_WS_ROUTE_SYMBOL]: true;
};

export type BrandedHttpWsRouteDefinition = HttpWsRouteDefinition & HttpWsRouteBrand;

export function brandHttpWsRoute<TRoute extends object>(
  route: TRoute,
): TRoute & HttpWsRouteBrand {
  return Object.freeze({
    ...route,
    [HTTP_WS_ROUTE_SYMBOL]: true,
  });
}

export function isHttpWsRouteDefinition(value: unknown): value is BrandedHttpWsRouteDefinition {
  return Boolean(
    value &&
    typeof value === "object" &&
    HTTP_WS_ROUTE_SYMBOL in (value as Record<PropertyKey, unknown>),
  );
}
