import type { ApplicationContext } from "@orria-labs/runtime";
import type { ExampleDatabaseAdapter } from "./database.ts";
import type { GeneratedBusTypes } from "./generated/core/index.ts";

export type ExampleContext = ApplicationContext<GeneratedBusTypes, ExampleDatabaseAdapter>;

export function exampleDb(
  ctx: Pick<ExampleContext, "database">,
) {
  return ctx.database.client();
}

export function createUserId(email: string): string {
  return `user_${email.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}
