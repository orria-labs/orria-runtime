import { defineHandler } from "../adapter.ts";

export default defineHandler({
  handle: ({ ctx }) => ({
    ok: true,
    app: ctx.config.get("APP_NAME"),
  }),
  options: {
    detail: {
      summary: "Checks if the application is healthy",
      description: "Checks if the application is healthy by returning a simple JSON object",
    },
  },
});
