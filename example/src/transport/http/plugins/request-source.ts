import { definePlugin } from "@orria-labs/runtime-elysia";

export const requestSourcePlugin = definePlugin({
  setup: ({ app }) =>
    app.derive(({ request }) => {
      return {
        requestSource: request.headers.get("x-source") ?? "http",
      };
    }),
});

export default requestSourcePlugin;
