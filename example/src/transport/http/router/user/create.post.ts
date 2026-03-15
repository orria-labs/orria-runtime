import z from "zod";
import { defineHandler } from "../../adapter.ts";

export default defineHandler({
  options: {
    body: z.object({
      email: z.email(),
    }),
    detail: {
      summary: "Creates a user",
      description: "Creates a user in the example in-memory database",
    },
  },
  plugins: ["request-source"],
  handle: async ({ ctx, body, requestSource }) => {
    const created = await ctx.action.user.create(body);

    return {
      ...created,
      source: requestSource,
    };
  },
});
