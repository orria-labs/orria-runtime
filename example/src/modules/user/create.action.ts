import { defineAction } from "@orria-labs/runtime";

import { createUserId, exampleDb } from "../../shared.ts";
import type { ExampleContext } from "../../shared.ts";

export interface CreateUserInput {
  email: string;
}

export interface CreateUserOutput {
  id: string;
  email: string;
}

export default defineAction<CreateUserInput, CreateUserOutput, ExampleContext>({
  kind: "action",
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
