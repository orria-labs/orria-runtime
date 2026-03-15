import { defineCommand } from "@orria-labs/runtime-citty";
import type { ExampleDatabaseAdapter } from "../../../../database.ts";
import type { GeneratedBusTypes } from "../../../../generated/core/index.ts";

export default defineCommand<{}, GeneratedBusTypes, ExampleDatabaseAdapter>({
  meta: {
    description: "Show application runtime info",
  },
  run: ({ ctx, adapterContext }) => ({
    app: ctx.config.get("APP_NAME"),
    manifestVersion: adapterContext.manifest.version,
  }),
});
