import type { HttpHandlerDefinition } from "../types.ts";

const HTTP_HANDLER_SYMBOL = Symbol.for("orria.http.handler");

type HttpHandlerBrand = {
  readonly [HTTP_HANDLER_SYMBOL]: true;
};

export type BrandedHttpHandlerDefinition = HttpHandlerDefinition & HttpHandlerBrand;

export function brandHttpHandler<THandler extends object>(
  handler: THandler,
): THandler & HttpHandlerBrand {
  return Object.freeze({
    ...handler,
    [HTTP_HANDLER_SYMBOL]: true,
  });
}

export function isHttpHandlerDefinition(value: unknown): value is BrandedHttpHandlerDefinition {
  return Boolean(
    value &&
    typeof value === "object" &&
    HTTP_HANDLER_SYMBOL in (value as Record<PropertyKey, unknown>),
  );
}
