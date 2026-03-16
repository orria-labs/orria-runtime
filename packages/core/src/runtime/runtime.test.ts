import { describe, expect, it } from "bun:test";

import { defineAction, defineEvent, defineWorkflow } from "../define.ts";
import { createRegistry } from "../registry/registry.ts";
import type {
  ApplicationContext,
  BusTypesContract,
  ConfigStore,
  DatabaseAdapter,
  EventBusMethod,
  ExecutableBusMethod,
  HandlerInvocationMeta,
} from "../types.ts";
import { createRuntime, LocalEventTransport } from "./runtime.ts";

interface TestBusTypes extends BusTypesContract {
  action: {
    demo: {
      run: ExecutableBusMethod<{
        __types__?: {
          input: { email: string };
          output: { email: string; normalized: string };
          handlerInput: { email: string };
          handlerOutput: { email: string };
          inputSchema: unknown;
          returnsSchema: unknown;
        };
        kind: "action";
      }>;
    };
  };
  query: {};
  workflow: {
    demo: {
      registration: ExecutableBusMethod<{
        __types__?: {
          input: { email: string };
          output: void;
          handlerInput: { email: string };
          handlerOutput: void;
          inputSchema: unknown;
          returnsSchema: unknown;
        };
        kind: "workflow";
      }>;
    };
  };
  event: {
    demo: {
      created: EventBusMethod<{
        __types__?: {
          payload: { email: string };
          parsedPayload: { email: string };
          payloadSchema: unknown;
        };
        kind: "event";
      }>;
    };
  };
}

type TestContext = ApplicationContext<TestBusTypes>;

describe("runtime", () => {
  it("runs middleware and fan-outs local workflow subscriptions", async () => {
    const events: string[] = [];
    const messages: Array<{ level: string; payload: unknown }> = [];
    const logger = createLogger(messages);
    const config = createConfigStore();
    const database = createDatabaseAdapter();
    const actionInputSchema = createSchema<{ email: string }, { email: string }>((value) => {
      const input = value as { email: string };
      return { email: input.email.trim().toLowerCase() };
    });
    const actionOutputSchema = createSchema<
      { email: string },
      { email: string; normalized: string }
    >((value) => {
      const output = value as { email: string };
      return {
        email: output.email,
        normalized: output.email.toLowerCase(),
      };
    });
    const eventPayloadSchema = createSchema<{ email: string }, { email: string }>((value) => {
      const payload = value as { email: string };
      return { email: payload.email.trim().toLowerCase() };
    });
    const workflowInputSchema = createSchema<{ email: string }, { email: string }>((value) => {
      const input = value as { email: string };
      return { email: input.email.trim().toLowerCase() };
    });
    const voidSchema = createSchema<void, void>(() => undefined);

    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [
        {
          key: "action.demo.run",
          kind: "action" as const,
          logicalName: "demo.run",
          modulePath: "memory",
          declaration: defineAction<TestContext>()({
            input: actionInputSchema,
            returns: actionOutputSchema,
            middleware: [
              async ({ key }, next) => {
                events.push(`handler:before:${key}`);
                const result = await next();
                events.push(`handler:after:${key}`);
                return result;
              },
            ],
            handle: async ({ ctx, input }) => {
              events.push(`action:${input.email}`);
              await ctx.event.demo.created({ email: input.email });
              return { email: input.email };
            },
          }),
        },
        {
          key: "event.demo.created",
          kind: "event" as const,
          logicalName: "demo.created",
          modulePath: "memory",
          declaration: defineEvent({
            payload: eventPayloadSchema,
            version: 1,
          }),
        },
        {
          key: "workflow.demo.registration",
          kind: "workflow" as const,
          logicalName: "demo.registration",
          modulePath: "memory",
          declaration: defineWorkflow<TestContext>()({
            input: workflowInputSchema,
            returns: voidSchema,
            subscribesTo: ["event.demo.created"],
            handle: async ({ ctx, input, meta }) => {
              events.push(`workflow:${input.email}`);
              ctx.console.info("workflow", { input, meta });
            },
          }),
        },
      ],
    };

    const registry = createRegistry(manifest);
    let ctx!: TestContext;
    const runtime = createRuntime<TestContext, TestBusTypes>({
      registry,
      getContext: () => ctx,
      middleware: [
        async ({ key }, next) => {
          events.push(`global:before:${key}`);
          const result = await next();
          events.push(`global:after:${key}`);
          return result;
        },
      ],
      eventTransport: new LocalEventTransport(),
    });

    ctx = {
      console: logger,
      config,
      database,
      action: runtime.buses.action,
      query: runtime.buses.query,
      workflow: runtime.buses.workflow,
      event: runtime.buses.event,
    };

    const result = await ctx.action.demo.run({ email: " Dev@Example.com " });
    const actionMethod = runtime.buses.action.demo.run as typeof runtime.buses.action.demo.run & {
      $key: string;
      $schema: {
        input: unknown;
        returns: unknown;
      };
    };

    expect(result).toEqual({
      email: "dev@example.com",
      normalized: "dev@example.com",
    });
    expect(events).toEqual([
      "global:before:action.demo.run",
      "handler:before:action.demo.run",
      "action:dev@example.com",
      "global:before:workflow.demo.registration",
      "workflow:dev@example.com",
      "global:after:workflow.demo.registration",
      "handler:after:action.demo.run",
      "global:after:action.demo.run",
    ]);
    expect(messages).toHaveLength(1);
    expect(actionMethod.$key).toBe("action.demo.run");
    expect(actionMethod.$schema.input).toBe(actionInputSchema);
    expect(actionMethod.$schema.returns).toBe(actionOutputSchema);
  });

  it("supports unsafe bus calls without schema validation", async () => {
    const invocations: Array<{ stage: string; email: string }> = [];

    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: [
        {
          key: "action.demo.run",
          kind: "action" as const,
          logicalName: "demo.run",
          modulePath: "memory",
          declaration: defineAction<TestContext>()({
            input: createSchema<{ email: string }, { email: string }>((value) => {
              const input = value as { email: string };
              return { email: input.email.trim().toLowerCase() };
            }),
            returns: createSchema<{ email: string }, { email: string; normalized: string }>((value) => {
              const output = value as { email: string };
              return {
                email: output.email,
                normalized: output.email.toLowerCase(),
              };
            }),
            handle: async ({ ctx, input }) => {
              invocations.push({ stage: "action", email: input.email });
              await ctx.event.demo.created.unsafe({ email: input.email });
              return { email: input.email };
            },
          }),
        },
        {
          key: "event.demo.created",
          kind: "event" as const,
          logicalName: "demo.created",
          modulePath: "memory",
          declaration: defineEvent({
            payload: createSchema<{ email: string }, { email: string }>((value) => {
              const payload = value as { email: string };
              return { email: payload.email.trim().toLowerCase() };
            }),
            version: 1,
          }),
        },
        {
          key: "workflow.demo.registration",
          kind: "workflow" as const,
          logicalName: "demo.registration",
          modulePath: "memory",
          declaration: defineWorkflow<TestContext>()({
            input: createSchema<{ email: string }, { email: string }>((value) => {
              const input = value as { email: string };
              return { email: input.email.trim().toLowerCase() };
            }),
            returns: createSchema<void, void>(() => undefined),
            subscribesTo: ["event.demo.created"],
            handle: ({ input }) => {
              invocations.push({ stage: "workflow", email: input.email });
            },
          }),
        },
      ],
    };

    const registry = createRegistry(manifest);
    let ctx!: TestContext;
    const runtime = createRuntime<TestContext, TestBusTypes>({
      registry,
      getContext: () => ctx,
      eventTransport: new LocalEventTransport(),
    });

    ctx = {
      console,
      config: createConfigStore(),
      database: createDatabaseAdapter(),
      action: runtime.buses.action,
      query: runtime.buses.query,
      workflow: runtime.buses.workflow,
      event: runtime.buses.event,
    };

    const safeResult = await ctx.action.demo.run({ email: " Safe@Example.com " });
    const unsafeResult = await ctx.action.demo.run.unsafe({ email: "Unsafe@Example.com" });
    await ctx.event.demo.created({ email: " EventSafe@Example.com " });
    await ctx.event.demo.created.unsafe({ email: "EventUnsafe@Example.com" });

    expect(safeResult).toEqual({
      email: "safe@example.com",
      normalized: "safe@example.com",
    });
    expect(unsafeResult).toEqual({
      email: "Unsafe@Example.com",
    });
    expect(invocations).toEqual([
      { stage: "action", email: "safe@example.com" },
      { stage: "workflow", email: "safe@example.com" },
      { stage: "action", email: "Unsafe@Example.com" },
      { stage: "workflow", email: "Unsafe@Example.com" },
      { stage: "workflow", email: "eventsafe@example.com" },
      { stage: "workflow", email: "EventUnsafe@Example.com" },
    ]);
    expect(ctx.action.demo.run.unsafe.$key).toBe("action.demo.run");
    expect(ctx.event.demo.created.unsafe.$schema.payload).toBeDefined();
  });
});

function createSchema<TInput, TOutput>(
  parse: (value: unknown) => TOutput,
): {
  _input: TInput;
  _output: TOutput;
  parse(value: unknown): TOutput;
} {
  return {
    _input: undefined as TInput,
    _output: undefined as TOutput,
    parse,
  };
}

function createConfigStore(): ConfigStore {
  return {
    get(key) {
      if (key === "APP_NAME") {
        return "oap-test";
      }

      throw new Error(`Unknown config key ${key}`);
    },
    has(key) {
      return key === "APP_NAME";
    },
    all() {
      return Object.freeze({ APP_NAME: "oap-test" });
    },
  };
}

function createDatabaseAdapter(): DatabaseAdapter {
  return {
    client() {
      return "test-db";
    },
  };
}

function createLogger(
  messages: Array<{ level: string; payload: unknown }>,
): Console {
  return {
    log: (...payload) => {
      messages.push({ level: "log", payload });
    },
    info: (...payload) => {
      messages.push({ level: "info", payload });
    },
    warn: (...payload) => {
      messages.push({ level: "warn", payload });
    },
    error: (...payload) => {
      messages.push({ level: "error", payload });
    },
    debug: (...payload) => {
      messages.push({ level: "debug", payload });
    },
    trace: (...payload) => {
      messages.push({ level: "trace", payload });
    },
    dir: (...payload) => {
      messages.push({ level: "dir", payload });
    },
    dirxml: () => undefined,
    table: () => undefined,
    assert: () => undefined,
    clear: () => undefined,
    count: () => undefined,
    countReset: () => undefined,
    group: () => undefined,
    groupCollapsed: () => undefined,
    groupEnd: () => undefined,
    profile: () => undefined,
    profileEnd: () => undefined,
    time: () => undefined,
    timeEnd: () => undefined,
    timeLog: () => undefined,
    timeStamp: () => undefined,
  } as Console;
}
