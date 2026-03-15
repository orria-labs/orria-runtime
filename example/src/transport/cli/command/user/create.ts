import { defineCommand } from "@orria-labs/runtime-citty";
import type { ExampleDatabaseAdapter } from "../../../../database.ts";
import type { GeneratedBusTypes } from "../../../../generated/core/index.ts";

export default defineCommand<
  {
    email: {
      type: "string";
      required: true;
      description: "User email";
    };
  },
  GeneratedBusTypes,
  ExampleDatabaseAdapter
>({
  aliases: ["new"],
  meta: {
    description: "Create user through action bus",
  },
  args: {
    email: {
      type: "string",
      required: true,
      description: "User email",
    },
  },
  run: ({ ctx, args }) => ctx.action.user.create({ email: args.email }),
});
