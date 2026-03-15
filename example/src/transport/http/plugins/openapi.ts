import openapi from "@elysiajs/openapi";
import { definePlugin } from "@orria-labs/runtime-elysia";

export default definePlugin({
  refs: ["spec"],
  setup: ({ app }) =>
    app.use(openapi({
      path: "/docs",
      provider: "scalar",
      scalar: {
        layout: "classic",
        telemetry: false,
        showDeveloperTools: "never",
      },
      documentation: {
        info: {
          title: "Example Service",
          version: "0.1.0",
          description: "Supper interesting description",
        },
      },
    }))
});
