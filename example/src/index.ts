import { createApplication } from "@orria-labs/runtime";
import { config } from "./config.ts";
import { database } from "./database.ts";
import { manifest } from "./generated/core/index.ts";
import { cliAdapter } from "./transport/cli/adapter.ts";
import { cronAdapter } from "./transport/cron/adapter.ts";
import { httpAdapter } from "./transport/http/adapter.ts";

export const app = await createApplication({
  config,
  database,
  manifest,
  setGlobalCtx: true,
}, {
  cli: cliAdapter,
  http: httpAdapter,
  cron: cronAdapter,
});

export type ExampleApp = typeof app;

if (import.meta.main) {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length > 0) {
    await app.adapter.cli.run(rawArgs);
    process.exit(0);
  } else {
    const created = await app.ctx.action.user.create({
      email: "hello@orria.dev",
    });
    await app.adapter.cron.trigger("user.replay-registration");

    app.adapter.http.listen({
      port: 3000,
    });

    console.log("Created user", created);
    console.log("DB", app.ctx.database.client());
  }
}
