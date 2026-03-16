import path from "node:path";
import { defineHttpAdapter } from "@orria-labs/runtime-elysia";
import type { ExampleDatabaseAdapter } from "../../database.ts";
import type { GeneratedBusTypes } from "../../generated/core/index.ts";

export const {
  adapter: httpAdapter,
} = defineHttpAdapter<GeneratedBusTypes, ExampleDatabaseAdapter>()({
  rootDir: path.resolve(import.meta.dir, "../../.."),
  plugins: ["spec"],
});

/// Альтернативный вариант: можно передать plugins прямо в конфиг adapter
// import type {
//   HttpPluginRef,
//   RegisteredHttpPluginRef,
// } from "@orria-labs/runtime-elysia";
// import { requestSourcePlugin } from "./plugins/request-source.ts";

// export const httpGlobalPlugins = [
//   "spec",
//   requestSourcePlugin,
// ] as const satisfies readonly (
//   | RegisteredHttpPluginRef
//   | HttpPluginRef<GeneratedBusTypes, ExampleDatabaseAdapter>
// )[];
