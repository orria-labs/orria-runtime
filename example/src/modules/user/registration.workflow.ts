import z from "zod";
import { defineWorkflow } from "@orria-labs/runtime";

import { exampleDb } from "../../shared.ts";
import type { ExampleContext } from "../../shared.ts";

const registrationWorkflowInputSchema = z.object({
  userId: z.string(),
  email: z.email(),
});

export default defineWorkflow<ExampleContext>()({
  input: registrationWorkflowInputSchema,
  returns: z.void(),
  description: "Handles the local reaction to user.registered",
  subscribesTo: ["event.user.registered"],
  handle: async ({ ctx, input, meta }) => {
    exampleDb(ctx).auditLog.push(`registered:${input.userId}`);
    ctx.console.info("user.registration", {
      userId: input.userId,
      email: input.email,
      source: meta.source,
    });
  },
});
