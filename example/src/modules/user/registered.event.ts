import z from "zod";
import { defineEvent } from "@orria-labs/runtime";

export default defineEvent({
  payload: z.object({
    userId: z.string(),
    email: z.email(),
  }),
  version: 1,
  description: "Published after a new user is stored in the system",
});
