import { describe, expect, it } from "bun:test";

import { databaseClient } from "./database.ts";
import { app } from "./index.ts";

describe("example app", () => {
  it("creates users, resolves queries and runs workflow subscriptions", async () => {
    databaseClient.users.clear();
    databaseClient.auditLog.length = 0;

    const created = await app.ctx.action.user.create({
      email: "user_1@example.com",
    });
    const loaded = await app.ctx.query.user.get({
      userId: created.id,
    });

    expect(created).toEqual({
      id: "user_user_1_example_com",
      email: "user_1@example.com",
    });
    expect(loaded).toEqual({
      userId: "user_user_1_example_com",
      email: "user_1@example.com",
      loadedFrom: "memory-db",
    });
    expect(databaseClient.auditLog).toEqual(["registered:user_user_1_example_com"]);
  });

  it("runs discovered cron schedules through adapter", async () => {
    databaseClient.auditLog.length = 0;

    await app.adapter.cron.trigger("user.replay-registration");

    expect(databaseClient.auditLog).toEqual(["registered:scheduled_user"]);
    expect(app.adapter.cron.jobs["user.replay-registration"]?.lastExecution?.status).toBe(
      "succeeded",
    );
  });

  it("runs discovered cli commands through adapter", async () => {
    databaseClient.users.clear();

    const created = await app.adapter.cli.invoke([
      "user",
      "new",
      "--email",
      "cli@example.com",
    ]);
    const info = await app.adapter.cli.invoke(["system", "info"]);

    expect(created).toEqual({
      id: "user_cli_example_com",
      email: "cli@example.com",
    });
    expect(info).toEqual({
      app: "oap-example",
      manifestVersion: 1,
    });
  });

  it("runs discovered http routes through adapter", async () => {
    databaseClient.users.clear();

    const healthResponse = await app.adapter.http.handle(
      new Request("http://localhost/health"),
    );
    const createResponse = await app.adapter.http.handle(
      new Request("http://localhost/user/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-source": "example-test",
        },
        body: JSON.stringify({ email: "http@example.com" }),
      }),
    );
    const statusResponse = await app.adapter.http.handle(
      new Request("http://localhost/v1/user-status?userId=user_http_example_com"),
    );

    expect(await healthResponse.json()).toEqual({
      ok: true,
      app: "oap-example",
    });
    expect(await createResponse.json()).toEqual({
      id: "user_http_example_com",
      email: "http@example.com",
      source: "example-test",
    });
    expect(await statusResponse.json()).toEqual({
      userId: "user_http_example_com",
      email: "http@example.com",
      loadedFrom: "memory-db",
    });
  });
});
