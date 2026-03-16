import { getRegistryEntry } from "../registry/registry.ts";
import type {
  CoreRegistry,
  EventRegistryEntry,
  ExecutableRegistryEntry,
} from "../registry/types.ts";
import type {
  ApplicationContext,
  BusTypesContract,
  CoreMiddleware,
  CoreRuntime,
  EventTransport,
  ExecutableKind,
  HandlerInvocationMeta,
  PublishedEventEnvelope,
} from "../types.ts";

interface CreateRuntimeOptions<
  TContext extends ApplicationContext<TBuses>,
  TBuses extends BusTypesContract,
> {
  registry: CoreRegistry;
  getContext: () => TContext;
  middleware?: Array<CoreMiddleware<TContext>>;
  eventTransport: EventTransport;
}

export class LocalEventTransport implements EventTransport {
  async publish(_event: PublishedEventEnvelope): Promise<void> {}
}

export function createRuntime<
  TContext extends ApplicationContext<TBuses>,
  TBuses extends BusTypesContract,
>(
  options: CreateRuntimeOptions<TContext, TBuses>,
): CoreRuntime<TBuses> {
  const runtime = new Runtime(options);

  return {
    registry: options.registry,
    buses: runtime.createBuses(),
    invoke(kind, key, input, meta) {
      return runtime.invoke(kind, key, input, meta);
    },
    publish(key, payload, meta) {
      return runtime.publish(key, payload, meta);
    },
  };
}

class Runtime<
  TContext extends ApplicationContext<TBuses>,
  TBuses extends BusTypesContract,
> {
  readonly #registry: CoreRegistry;
  readonly #getContext: () => TContext;
  readonly #middleware: Array<CoreMiddleware<TContext>>;
  readonly #eventTransport: EventTransport;

  constructor(options: CreateRuntimeOptions<TContext, TBuses>) {
    this.#registry = options.registry;
    this.#getContext = options.getContext;
    this.#middleware = options.middleware ?? [];
    this.#eventTransport = options.eventTransport;
  }

  createBuses(): CoreRuntime<TBuses>["buses"] {
    return {
      action: this.#buildExecutableBus("action") as TBuses["action"],
      query: this.#buildExecutableBus("query") as TBuses["query"],
      workflow: this.#buildExecutableBus("workflow") as TBuses["workflow"],
      event: this.#buildEventBus() as TBuses["event"],
    };
  }

  async invoke(
    kind: ExecutableKind,
    key: string,
    input: unknown,
    meta: HandlerInvocationMeta = {},
  ): Promise<unknown> {
    const entry = getRegistryEntry(this.#registry, key);
    if (entry.kind !== kind) {
      throw new Error(`Handler "${key}" is registered as "${entry.kind}", expected "${kind}"`);
    }

    return this.#invokeExecutable(entry, input, meta);
  }

  async publish(
    key: string,
    payload: unknown,
    meta: HandlerInvocationMeta = {},
  ): Promise<void> {
    const entry = getRegistryEntry(this.#registry, key);
    if (entry.kind !== "event") {
      throw new Error(`Handler "${key}" is not an event declaration`);
    }

    const parsedPayload = await this.#parsePayload(entry, payload);
    const normalizedMeta = { ...meta };

    await this.#eventTransport.publish({
      key,
      payload: parsedPayload,
      meta: normalizedMeta,
      version: entry.declaration.version,
    });

    const subscribers = this.#registry.eventSubscribers.get(key) ?? [];
    for (const subscriber of subscribers) {
      await this.invoke("workflow", subscriber.key, parsedPayload, {
        ...normalizedMeta,
        source: key,
        eventKey: key,
      });
    }
  }

  async #invokeExecutable(
    entry: ExecutableRegistryEntry,
    input: unknown,
    meta: HandlerInvocationMeta,
  ): Promise<unknown> {
    const ctx = this.#getContext();
    const parsedInput = await this.#parseInput(entry, input);
    const middleware = [...this.#middleware, ...(entry.declaration.middleware ?? [])];

    let index = -1;
    const run = async (): Promise<unknown> => {
      index += 1;
      const current = middleware[index];

      if (!current) {
        return entry.declaration.handle({ ctx, input: parsedInput, meta });
      }

      return current(
        {
          kind: entry.kind,
          key: entry.key,
          input: parsedInput,
          ctx,
          meta,
        },
        run,
      );
    };

    const result = await run();

    return this.#parseOutput(entry, result);
  }

  #buildExecutableBus(kind: ExecutableKind) {
    const root: Record<string, unknown> = {};

    for (const entry of this.#registry.byKind[kind]) {
      assignPath(root, entry.segments, createExecutableBusMethod(entry, (input, meta) =>
        this.invoke(kind, entry.key, input, meta),
      ));
    }

    return root;
  }

  #buildEventBus() {
    const root: Record<string, unknown> = {};

    for (const entry of this.#registry.byKind.event) {
      assignPath(root, entry.segments, createEventBusMethod(entry, (payload, meta) =>
        this.publish(entry.key, payload, meta),
      ));
    }

    return root;
  }

  async #parseInput(entry: ExecutableRegistryEntry, input: unknown): Promise<unknown> {
    if (entry.declaration.input) {
      return parseWithSchema(entry.declaration.input, input);
    }

    return entry.declaration.parser ? entry.declaration.parser(input) : input;
  }

  async #parseOutput(entry: ExecutableRegistryEntry, output: unknown): Promise<unknown> {
    if (entry.declaration.returns) {
      return parseWithSchema(entry.declaration.returns, output);
    }

    return output;
  }

  async #parsePayload(entry: EventRegistryEntry, payload: unknown): Promise<unknown> {
    if (entry.declaration.payload) {
      return parseWithSchema(entry.declaration.payload, payload);
    }

    return entry.declaration.parser ? entry.declaration.parser(payload) : payload;
  }
}

function createExecutableBusMethod(
  entry: ExecutableRegistryEntry,
  invoke: (input: unknown, meta?: HandlerInvocationMeta) => Promise<unknown>,
) {
  const method = (input: unknown, meta?: HandlerInvocationMeta) => invoke(input, meta);

  return Object.assign(method, {
    $key: entry.key,
    $kind: entry.kind,
    $definition: entry.declaration,
    $schema: {
      input: entry.declaration.input,
      returns: entry.declaration.returns,
    },
  });
}

function createEventBusMethod(
  entry: EventRegistryEntry,
  publish: (payload: unknown, meta?: HandlerInvocationMeta) => Promise<void>,
) {
  const method = (payload: unknown, meta?: HandlerInvocationMeta) => publish(payload, meta);

  return Object.assign(method, {
    $key: entry.key,
    $kind: entry.kind,
    $definition: entry.declaration,
    $schema: {
      payload: entry.declaration.payload,
    },
  });
}

async function parseWithSchema(
  schema: { parse(value: unknown): unknown; parseAsync?(value: unknown): Promise<unknown> },
  value: unknown,
): Promise<unknown> {
  if (typeof schema.parseAsync === "function") {
    return schema.parseAsync(value);
  }

  return schema.parse(value);
}

function assignPath(
  root: Record<string, unknown>,
  segments: string[],
  value: unknown,
): void {
  let cursor = root;

  for (const segment of segments.slice(0, -1)) {
    const current = cursor[segment];
    if (!current || typeof current !== "object") {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments.at(-1)!] = value;
}
