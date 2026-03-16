import { createHandlerFactory } from "@orria-labs/runtime-elysia";
import type { ExampleDatabaseAdapter } from "../../database.ts";
import type { GeneratedBusTypes } from "../../generated/core/index.ts";

export const defineHandler = createHandlerFactory<
  GeneratedBusTypes,
  ExampleDatabaseAdapter,
  ["spec"]
>({
  plugins: ["spec"],
});
