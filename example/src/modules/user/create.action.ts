import z from "zod";
import { defineAction } from "@orria-labs/runtime";

import { createUserId, exampleDb } from "../../shared.ts";
import type { ExampleContext } from "../../shared.ts";

const createUserInputSchema = z.object({
  email: z.email(),
});

const createUserOutputSchema = z.object({
  id: z.string(),
  email: z.email(),
});

export default defineAction<ExampleContext>()({
  input: createUserInputSchema,
  returns: createUserOutputSchema,
  description: "Creates a user record and emits user.registered",
  handle: async ({ ctx, input }) => {
    const user = {
      id: createUserId(input.email),
      email: input.email,
    };

    exampleDb(ctx).users.set(user.id, user);

    await ctx.event.user.registered({
      userId: user.id,
      email: user.email,
    });

    return user;
  },
});
