import z from "zod";
import { defineQuery } from "@orria-labs/runtime";

import { exampleDb } from "../../shared.ts";
import type { ExampleContext } from "../../shared.ts";

const getUserInputSchema = z.object({
  userId: z.string(),
});

const getUserOutputSchema = z.object({
  userId: z.string(),
  email: z.string().nullable(),
  loadedFrom: z.string(),
});

export default defineQuery<ExampleContext>()({
  input: getUserInputSchema,
  returns: getUserOutputSchema,
  description: "Reads a user from the example in-memory database",
  handle: ({ ctx, input }) => {
    const user = exampleDb(ctx).users.get(input.userId) ?? null;

    return {
      userId: input.userId,
      email: user?.email ?? null,
      loadedFrom: "memory-db",
    };
  },
});
