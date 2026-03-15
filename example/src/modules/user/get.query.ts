import { defineQuery } from "@orria-labs/runtime";

import { exampleDb } from "../../shared.ts";
import type { ExampleContext } from "../../shared.ts";

export interface GetUserInput {
  userId: string;
}

export interface GetUserOutput {
  userId: string;
  email: string | null;
  loadedFrom: string;
}

export default defineQuery<GetUserInput, GetUserOutput, ExampleContext>({
  kind: "query",
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
