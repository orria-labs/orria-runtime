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

    const parsedPayload = this.#parsePayload(entry, payload);
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
    const parsedInput = this.#parseInput(entry, input);
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

    return run();
  }

  #buildExecutableBus(kind: ExecutableKind) {
    const root: Record<string, unknown> = {};

    for (const entry of this.#registry.byKind[kind]) {
      assignPath(root, entry.segments, (input: unknown, meta?: HandlerInvocationMeta) =>
        this.invoke(kind, entry.key, input, meta),
      );
    }

    return root;
  }

  #buildEventBus() {
    const root: Record<string, unknown> = {};

    for (const entry of this.#registry.byKind.event) {
      assignPath(root, entry.segments, (payload: unknown, meta?: HandlerInvocationMeta) =>
        this.publish(entry.key, payload, meta),
      );
    }

    return root;
  }

  #parseInput(entry: ExecutableRegistryEntry, input: unknown): unknown {
    return entry.declaration.parser ? entry.declaration.parser(input) : input;
  }

  #parsePayload(entry: EventRegistryEntry, payload: unknown): unknown {
    return entry.declaration.parser ? entry.declaration.parser(payload) : payload;
  }
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
