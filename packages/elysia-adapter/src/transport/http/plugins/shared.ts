import type { HttpPluginDefinition } from "../types.ts";

const HTTP_PLUGIN_SYMBOL = Symbol.for("orria.http.plugin");
export const HTTP_PLUGIN_CODEGEN_SYMBOL = Symbol.for("orria.http.plugin.codegen");

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

export function registerHttpPluginCodegen<TPlugin extends object>(
  plugin: TPlugin,
  metadata: {
    baseDir: string;
    importPath: string;
    exportName?: string;
  },
): TPlugin {
  return Object.freeze({
    ...plugin,
    [HTTP_PLUGIN_CODEGEN_SYMBOL]: Object.freeze({
      baseDir: metadata.baseDir,
      importPath: metadata.importPath,
      exportName: metadata.exportName,
    }),
  });
}

export function getHttpPluginCodegenImport(value: unknown): {
  baseDir: string;
  importPath: string;
  exportName?: string;
} | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const metadata = (value as Record<PropertyKey, unknown>)[HTTP_PLUGIN_CODEGEN_SYMBOL];
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const { baseDir, importPath, exportName } = metadata as {
    baseDir?: unknown;
    importPath?: unknown;
    exportName?: unknown;
  };

  if (typeof baseDir !== "string" || typeof importPath !== "string") {
    return undefined;
  }

  if (exportName !== undefined && typeof exportName !== "string") {
    return undefined;
  }

  return {
    baseDir,
    importPath,
    exportName,
  };
}
