import type { HttpPluginDefinition } from "../types.ts";

const HTTP_PLUGIN_SYMBOL = Symbol.for("orria.http.plugin");

type HttpPluginBrand = {
  readonly [HTTP_PLUGIN_SYMBOL]: true;
};

export type BrandedHttpPluginDefinition = HttpPluginDefinition & HttpPluginBrand;

export function brandHttpPlugin<TPlugin extends object>(
  plugin: TPlugin,
): TPlugin & HttpPluginBrand {
  return Object.freeze({
    ...plugin,
    [HTTP_PLUGIN_SYMBOL]: true,
  });
}

export function isHttpPluginDefinition(value: unknown): value is BrandedHttpPluginDefinition {
  return Boolean(
    value &&
    typeof value === "object" &&
    HTTP_PLUGIN_SYMBOL in (value as Record<PropertyKey, unknown>),
  );
}
