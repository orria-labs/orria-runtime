import { createRuntime, LocalEventTransport } from "./runtime/runtime.ts";
import { createRegistry } from "./registry/registry.ts";
import type {
  ApplicationAdapterFactories,
  Application,
  ApplicationContext,
  BusTypesContract,
  CreateApplicationOptions,
  DatabaseAdapter,
  ManifestBusTypes,
  ResolvedApplicationAdapters,
} from "./types.ts";

export async function createApplication<
  TManifest extends { __buses__?: BusTypesContract } & CreateApplicationOptions<any, any>["manifest"],
  TDatabase extends DatabaseAdapter,
  TAdapters extends ApplicationAdapterFactories<ManifestBusTypes<TManifest>, TDatabase>,
>(
  options: Omit<CreateApplicationOptions<ManifestBusTypes<TManifest>, TDatabase>, "manifest"> & {
    manifest: TManifest;
  },
  adapters: TAdapters,
): Promise<Application<ManifestBusTypes<TManifest>, TDatabase, ResolvedApplicationAdapters<TAdapters>>>;

export async function createApplication<
  TManifest extends { __buses__?: BusTypesContract } & CreateApplicationOptions<any, any>["manifest"],
  TDatabase extends DatabaseAdapter,
>(
  options: Omit<CreateApplicationOptions<ManifestBusTypes<TManifest>, TDatabase>, "manifest"> & {
    manifest: TManifest;
  },
): Promise<Application<ManifestBusTypes<TManifest>, TDatabase, Record<string, never>>>;

export async function createApplication<
  TManifest extends { __buses__?: BusTypesContract } & CreateApplicationOptions<any, any>["manifest"],
  TDatabase extends DatabaseAdapter,
  TAdapters extends ApplicationAdapterFactories<ManifestBusTypes<TManifest>, TDatabase> = {},
>(
  options: Omit<CreateApplicationOptions<ManifestBusTypes<TManifest>, TDatabase>, "manifest"> & {
    manifest: TManifest;
  },
  adapters?: TAdapters,
): Promise<
  Application<ManifestBusTypes<TManifest>, TDatabase, ResolvedApplicationAdapters<TAdapters>>
> {
  // Bus-типы теперь выводятся из generated manifest, поэтому вызывающему коду
  // не нужно отдельно дублировать `CreateApplicationOptions<...>` в bootstrap.
  const registry = createRegistry(options.manifest);

  let ctx!: ApplicationContext<ManifestBusTypes<TManifest>, TDatabase>;

  const runtime = createRuntime<
    ApplicationContext<ManifestBusTypes<TManifest>, TDatabase>,
    ManifestBusTypes<TManifest>
  >({
    registry,
    getContext: () => ctx,
    middleware: options.middleware,
    eventTransport: options.eventTransport ?? new LocalEventTransport(),
  });

  ctx = {
    console: options.console ?? console,
    config: options.config,
    database: options.database,
    action: runtime.buses.action,
    query: runtime.buses.query,
    workflow: runtime.buses.workflow,
    event: runtime.buses.event,
  };

  if (options.setGlobalCtx) {
    (globalThis as typeof globalThis & {
      ctx?: ApplicationContext<ManifestBusTypes<TManifest>, TDatabase>;
    }).ctx = ctx;
  }

  const registeredAdapters = {} as Partial<ResolvedApplicationAdapters<TAdapters>>;

  for (const [name, factory] of Object.entries(adapters ?? {}) as Array<
    [keyof TAdapters, TAdapters[keyof TAdapters]]
  >) {
    registeredAdapters[name] = await (
      factory as TAdapters[keyof TAdapters] & ((...args: never[]) => unknown)
    )({
      ctx,
      registry,
      runtime,
      manifest: options.manifest,
      console: ctx.console,
    }) as ResolvedApplicationAdapters<TAdapters>[typeof name];
  }

  return {
    ctx,
    registry,
    runtime,
    adapter: registeredAdapters as ResolvedApplicationAdapters<TAdapters>,
  };
}

export default createApplication;
