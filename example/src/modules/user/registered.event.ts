import { defineEvent } from "@orria-labs/runtime";

export interface UserRegisteredPayload {
  userId: string;
  email: string;
}

export default defineEvent<UserRegisteredPayload>({
  kind: "event",
  version: 1,
  description: "Published after a new user is stored in the system",
});
