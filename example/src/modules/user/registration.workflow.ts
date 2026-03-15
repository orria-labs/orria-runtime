import { defineWorkflow } from "@orria-labs/runtime";

import { exampleDb } from "../../shared.ts";
import type { ExampleContext } from "../../shared.ts";

interface RegistrationWorkflowInput {
  userId: string;
  email: string;
}

export default defineWorkflow<RegistrationWorkflowInput, void, ExampleContext>({
  kind: "workflow",
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
