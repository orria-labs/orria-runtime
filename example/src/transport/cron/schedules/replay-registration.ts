import { defineCron, workflowTarget } from "@orria-labs/runtime-croner";

import type { GeneratedBusTypes } from "../../../generated/core/index.ts";

export default defineCron<GeneratedBusTypes>({
  name: "user.replay-registration",
  schedule: "0 * * * *",
  target: workflowTarget<GeneratedBusTypes>(
    "workflow.user.registration",
    () => ({
      userId: "scheduled_user",
      email: "cron@example.com",
    }),
  ),
  options: {
    timezone: "UTC",
    paused: true,
  },
});
