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
  readonly #middlewareCache = new WeakMap<
    ExecutableRegistryEntry,
    Array<CoreMiddleware<TContext>>
  >();
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
    return this.#runExecutable(this.#getExecutableEntry(key, kind), input, meta);
  }

  async publish(
    key: string,
    payload: unknown,
    meta: HandlerInvocationMeta = {},
  ): Promise<void> {
    return this.#publishEvent(this.#getEventEntry(key), payload, meta, false);
  }

  async #invokeExecutableUnsafe(
    entry: ExecutableRegistryEntry,
    input: unknown,
    meta: HandlerInvocationMeta,
  ): Promise<unknown> {
    return this.#runExecutable(entry, input, meta, true);
  }

  async #publishUnsafe(
    key: string,
    payload: unknown,
    meta: HandlerInvocationMeta = {},
  ): Promise<void> {
    return this.#publishEvent(this.#getEventEntry(key), payload, meta, true);
  }

  async #runExecutable(
    entry: ExecutableRegistryEntry,
    input: unknown,
    meta: HandlerInvocationMeta,
    unsafe = false,
  ): Promise<unknown> {
    const ctx = this.#getContext();
    const resolvedInput = unsafe ? input : await this.#parseInput(entry, input);
    const middleware = this.#resolveMiddleware(entry);

    let index = -1;
    const run = async (): Promise<unknown> => {
      index += 1;
      const current = middleware[index];

      if (!current) {
        return entry.declaration.handle({ ctx, input: resolvedInput, meta });
      }

      return current(
        {
          kind: entry.kind,
          key: entry.key,
          input: resolvedInput,
          ctx,
          meta,
        },
        run,
      );
    };

    const result = await run();

    return unsafe ? result : this.#parseOutput(entry, result);
  }

  async #publishEvent(
    entry: EventRegistryEntry,
    payload: unknown,
    meta: HandlerInvocationMeta,
    unsafe: boolean,
  ): Promise<void> {
    const resolvedPayload = unsafe ? payload : await this.#parsePayload(entry, payload);
    const normalizedMeta = { ...meta };

    await this.#eventTransport.publish({
      key: entry.key,
      payload: resolvedPayload,
      meta: normalizedMeta,
      version: entry.declaration.version,
    });

    const subscribers = this.#registry.eventSubscribers.get(entry.key) ?? [];
    for (const subscriber of subscribers) {
      await this.#runExecutable(subscriber, resolvedPayload, {
        ...normalizedMeta,
        source: entry.key,
        eventKey: entry.key,
      }, unsafe);
    }
  }

  #getExecutableEntry(key: string, kind: ExecutableKind): ExecutableRegistryEntry {
    const entry = getRegistryEntry(this.#registry, key);
    if (entry.kind !== kind) {
      throw new Error(`Handler "${key}" is registered as "${entry.kind}", expected "${kind}"`);
    }

    return entry;
  }

  #getEventEntry(key: string): EventRegistryEntry {
    const entry = getRegistryEntry(this.#registry, key);
    if (entry.kind !== "event") {
      throw new Error(`Handler "${key}" is not an event declaration`);
    }

    return entry;
  }

  #resolveMiddleware(entry: ExecutableRegistryEntry): Array<CoreMiddleware<TContext>> {
    const cached = this.#middlewareCache.get(entry);
    if (cached) {
      return cached;
    }

    const entryMiddleware = entry.declaration.middleware ?? [];
    const resolved = entryMiddleware.length === 0
      ? this.#middleware
      : this.#middleware.length === 0
      ? entryMiddleware
      : [...this.#middleware, ...entryMiddleware];

    this.#middlewareCache.set(entry, resolved);
    return resolved;
  }

  #buildExecutableBus(kind: ExecutableKind) {
    const root: Record<string, unknown> = {};

    for (const entry of this.#registry.byKind[kind]) {
      assignPath(
        root,
        entry.segments,
        createExecutableBusMethod(
          entry,
          (input, meta) => this.invoke(kind, entry.key, input, meta),
          (input, meta) => this.#invokeExecutableUnsafe(entry, input, meta ?? {}),
        ),
      );
    }

    return root;
  }

  #buildEventBus() {
    const root: Record<string, unknown> = {};

    for (const entry of this.#registry.byKind.event) {
      assignPath(
        root,
        entry.segments,
        createEventBusMethod(
          entry,
          (payload, meta) => this.publish(entry.key, payload, meta),
          (payload, meta) => this.#publishUnsafe(entry.key, payload, meta),
        ),
      );
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
  invokeUnsafe: (input: unknown, meta?: HandlerInvocationMeta) => Promise<unknown>,
) {
  const method = (input: unknown, meta?: HandlerInvocationMeta) => invoke(input, meta);
  const unsafeMethod = (input: unknown, meta?: HandlerInvocationMeta) => invokeUnsafe(input, meta);

  Object.assign(unsafeMethod, {
    $key: entry.key,
    $kind: entry.kind,
    $definition: entry.declaration,
    $schema: {
      input: entry.declaration.input,
      returns: entry.declaration.returns,
    },
  });

  return Object.assign(method, {
    unsafe: unsafeMethod,
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
  publishUnsafe: (payload: unknown, meta?: HandlerInvocationMeta) => Promise<void>,
) {
  const method = (payload: unknown, meta?: HandlerInvocationMeta) => publish(payload, meta);
  const unsafeMethod = (payload: unknown, meta?: HandlerInvocationMeta) =>
    publishUnsafe(payload, meta);

  Object.assign(unsafeMethod, {
    $key: entry.key,
    $kind: entry.kind,
    $definition: entry.declaration,
    $schema: {
      payload: entry.declaration.payload,
    },
  });

  return Object.assign(method, {
    unsafe: unsafeMethod,
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
