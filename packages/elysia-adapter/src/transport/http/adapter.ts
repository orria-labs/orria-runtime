import {
  createPollingFileWatcher,
  defineTransportAdapter,
  isOrriaTempModulePath,
  type BusTypesContract,
  type CreateApplicationAdapterContext,
  type DatabaseAdapter,
} from "@orria-labs/runtime";
import { Elysia } from "elysia";
import path from "node:path";

import { generateHttpAppRegistryArtifacts } from "./codegen/generate-app-registry.ts";
import { generateHttpPluginRegistryArtifacts } from "./codegen/generate-plugin-registry.ts";
import {
  discoverHttpPlugins,
  discoverHttpRoutes,
  discoverHttpWsRouteModules,
  validateHttpPlugins,
  validateHttpRoutes,
} from "./discovery.ts";
import { createHandlerFactory } from "./router/define-handler.ts";
import { createWsFactory } from "./router/define-ws.ts";
import type {
  BuildHttpApplicationOptions,
  HttpAdapterInstance,
  HttpAdapterDefinition,
  HttpAdapterWatchOptions,
  HttpHandlerDefinition,
  HttpPluginDefinition,
  HttpPluginRef,
  HttpWsRouteDefinition,
  ResolveHttpAdapterApp,
  ResolvedHttpWsRouteModule,
} from "./types.ts";

const DEFAULT_ROUTES_DIR = path.join("src", "transport", "http", "router");
const DEFAULT_PLUGINS_DIR = path.join("src", "transport", "http", "plugins");
const SUPPORTED_WATCH_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs"]);

export async function buildHttpApplication<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>(
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  options: BuildHttpApplicationOptions<TBuses, TDatabase> = {},
): Promise<Elysia> {
  const createdApp = options.createApp
    ? await options.createApp(adapterContext)
    : undefined;
  const discoveredPlugins = options.rootDir
    ? await discoverHttpPlugins({
        rootDir: options.rootDir,
        pluginsDir: options.pluginsDir,
        routesDir: options.routesDir,
      })
    : [];
  const discoveredRoutes = options.rootDir
    ? await discoverHttpRoutes({
        rootDir: options.rootDir,
        pluginsDir: options.pluginsDir,
        routesDir: options.routesDir,
      })
    : [];
  const discoveredWsRoutes = options.rootDir
    ? await discoverHttpWsRouteModules({
        rootDir: options.rootDir,
        pluginsDir: options.pluginsDir,
        routesDir: options.routesDir,
      })
    : [];
  const pluginRegistry = createPluginRegistry(discoveredPlugins.map((entry) => entry.plugin));
  const routes = [...discoveredRoutes, ...(options.routes ?? [])] as Array<
    HttpHandlerDefinition<any, any, any, any, any, any>
  >;

  validateHttpPlugins(discoveredPlugins);
  validateHttpRoutes(routes);

  let app = (createdApp as Elysia | undefined) ?? new Elysia();

  for (const pluginRef of options.plugins ?? []) {
    app = await applyPluginRef(app, pluginRef, pluginRegistry, adapterContext);
  }

  for (const route of routes) {
    const routeApp = await buildRouteApplication(route, pluginRegistry, adapterContext);
    app = app.use(routeApp);
  }

  for (const route of discoveredWsRoutes) {
    app = await applyWsRoute(app, route, pluginRegistry, adapterContext);
  }

  const extended = await options.extend?.({
    app,
    ctx: adapterContext.ctx,
    adapterContext,
  });

  return (extended as Elysia | undefined) ?? app;
}

export function createHttpAdapter<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  const TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = undefined,
>(
  options: BuildHttpApplicationOptions<TBuses, TDatabase> & {
    plugins?: TPlugins;
  } = {},
) {
  return defineTransportAdapter<HttpAdapterInstance<TBuses, TDatabase, ResolveHttpAdapterApp<TBuses, TDatabase, TPlugins>>, TBuses, TDatabase>(
    async (adapterContext) => {
      type AdapterApp = ResolveHttpAdapterApp<TBuses, TDatabase, TPlugins>;

      let app = await buildHttpApplication(adapterContext, options) as unknown as AdapterApp;
      let listeningApp: { stop?: () => unknown } | undefined;
      let listeningArgs: Parameters<Elysia["listen"]> | undefined;
      let watcher = createHttpWatcher(options, adapterContext, async () => {
        app = await buildHttpApplication(adapterContext, options) as unknown as AdapterApp;

        if (listeningApp && listeningArgs) {
          await Promise.resolve((listeningApp as { stop?: () => unknown }).stop?.());
          listeningApp = app.listen(...listeningArgs);
        }

        if (options.rootDir) {
          await generateHttpAppRegistryArtifacts({
            rootDir: options.rootDir,
            routesDir: options.routesDir,
            globalPlugins: options.plugins,
          });
          await generateHttpPluginRegistryArtifacts({
            rootDir: options.rootDir,
            pluginsDir: options.pluginsDir,
          });
        }
      });

      return {
        kind: "http",
        get watching() {
          return watcher.active;
        },
        get app() {
          return app;
        },
        listen: (...args) => {
          listeningArgs = args;
          const instance = app.listen(...args);
          listeningApp = instance as { stop?: () => unknown } | undefined;
          return instance as unknown as ReturnType<Elysia["listen"]>;
        },
        handle: (request) => app.handle(request),
        reload: async () => {
          app = await buildHttpApplication(adapterContext, options) as unknown as AdapterApp;

          if (listeningApp && listeningArgs) {
            await Promise.resolve((listeningApp as { stop?: () => unknown }).stop?.());
            listeningApp = app.listen(...listeningArgs);
          }
        },
        watch: async (watchOptions) => {
          watcher = createHttpWatcher(options, adapterContext, async () => {
            app = await buildHttpApplication(adapterContext, options) as unknown as AdapterApp;

            if (listeningApp && listeningArgs) {
              await Promise.resolve((listeningApp as { stop?: () => unknown }).stop?.());
              listeningApp = app.listen(...listeningArgs);
            }

            if (options.rootDir) {
              await generateHttpAppRegistryArtifacts({
                rootDir: options.rootDir,
                routesDir: options.routesDir,
                globalPlugins: options.plugins,
              });
              await generateHttpPluginRegistryArtifacts({
                rootDir: options.rootDir,
                pluginsDir: options.pluginsDir,
              });
            }
          }, watcher, watchOptions);
          await watcher.start();
        },
        unwatch: () => {
          watcher.stop();
        },
      } as HttpAdapterInstance<TBuses, TDatabase, AdapterApp>;
    },
  );
}

export function defineHttpAdapter<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>() {
  return function createDefinedHttpAdapter<
    const TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = undefined,
  >(
    options: BuildHttpApplicationOptions<TBuses, TDatabase> & {
      plugins?: TPlugins;
    },
  ): HttpAdapterDefinition<TBuses, TDatabase, TPlugins> {
    // Этот helper связывает runtime-конфиг adapter и типизацию route handlers
    // с одним и тем же списком global plugins, чтобы feature-модули импортировали
    // единый источник, а не дублировали конфигурацию в нескольких файлах.
    return {
      adapter: createHttpAdapter<TBuses, TDatabase, TPlugins>(options),
      defineHandler: createHandlerFactory<
        TBuses,
        TDatabase,
        TPlugins
      >({
        plugins: options.plugins,
      }),
      defineWs: createWsFactory<
        TBuses,
        TDatabase,
        TPlugins
      >({
        plugins: options.plugins,
      }),
    } as HttpAdapterDefinition<TBuses, TDatabase, TPlugins>;
  };
}

function createHttpWatcher<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  options: BuildHttpApplicationOptions<TBuses, TDatabase>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  reload: () => Promise<void>,
  existingWatcher = createPollingFileWatcher({ roots: [], onChange: () => undefined }),
  watchOptions?: HttpAdapterWatchOptions,
) {
  existingWatcher.stop();

  if (!options.rootDir) {
    return existingWatcher;
  }

  // Следим и за routes, и за plugins, чтобы runtime-поведение и generated
  // plugin registries оставались синхронны во время локальной разработки.
  return createPollingFileWatcher({
    roots: [
      path.resolve(options.rootDir, options.routesDir ?? DEFAULT_ROUTES_DIR),
      path.resolve(options.rootDir, options.pluginsDir ?? DEFAULT_PLUGINS_DIR),
    ],
    intervalMs: watchOptions?.intervalMs,
    includeFile: isHttpSourceFile,
    onChange: reload,
    onError: (error) => {
      adapterContext.console.error("[orria:http] watch reload failed", error);
    },
  });
}

function isHttpSourceFile(filePath: string): boolean {
  const extension = path.extname(filePath);
  return (
    SUPPORTED_WATCH_EXTENSIONS.has(extension) &&
    !filePath.endsWith(".d.ts") &&
    !isOrriaTempModulePath(filePath)
  );
}

async function buildRouteApplication<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  route: HttpHandlerDefinition<any, any, any, any, any, any>,
  pluginRegistry: Map<string, HttpPluginDefinition<any, any>>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
): Promise<Elysia> {
  if (!route.method || !route.path) {
    throw new Error("HTTP route must define method and path before mounting");
  }

  let app: Elysia = new Elysia().decorate("ctx", adapterContext.ctx) as unknown as Elysia;

  for (const pluginRef of route.plugins ?? []) {
    app = await applyPluginRef(app, pluginRef, pluginRegistry, adapterContext);
  }

  app = (app as Elysia).route(
    route.method,
    route.path,
    (async (transportContext: Record<string, unknown>) => {
      const request = transportContext.request as Request;
      if (!Object.hasOwn(transportContext, "body")) {
        transportContext.body = await readRequestBody(request);
      }

      if (!Object.hasOwn(transportContext, "params")) {
        transportContext.params = {};
      }

      if (!Object.hasOwn(transportContext, "query")) {
        transportContext.query = readRequestQuery(request);
      }

      transportContext.app = app;
      transportContext.transportContext = transportContext;

      return route.handle(transportContext as never);
    }) as never,
    normalizeHttpRouteOptions(route) as never,
  );

  return app;
}

async function applyWsRoute<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  app: Elysia,
  routeModule: ResolvedHttpWsRouteModule,
  pluginRegistry: Map<string, HttpPluginDefinition<any, any>>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
): Promise<Elysia> {
  if (routeModule.app) {
    return app.use(routeModule.app);
  }

  const route = routeModule.route;
  if (!route?.path) {
    throw new Error(`WebSocket route module "${routeModule.filePath}" must define a path`);
  }

  let wsApp: Elysia = new Elysia().decorate("ctx", adapterContext.ctx) as unknown as Elysia;

  for (const pluginRef of route.plugins ?? []) {
    wsApp = await applyPluginRef(wsApp, pluginRef, pluginRegistry, adapterContext);
  }

  wsApp = wsApp.ws(route.path, route.options as never);
  return app.use(wsApp);
}

async function applyPluginRef<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  app: Elysia,
  pluginRef: HttpPluginRef<any, any>,
  pluginRegistry: Map<string, HttpPluginDefinition<any, any>>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
): Promise<Elysia> {
  const plugin = typeof pluginRef === "string"
    ? pluginRegistry.get(pluginRef)
    : pluginRef;

  if (!plugin) {
    throw new Error(`Unknown HTTP plugin ref "${pluginRef}"`);
  }

  const nextApp = await plugin.setup({
    app,
    ctx: adapterContext.ctx,
    adapterContext,
  });

  return (nextApp as Elysia | undefined) ?? app;
}

function normalizeHttpRouteOptions<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  route: HttpHandlerDefinition<TBuses, TDatabase>,
) {
  if (!route.detail) {
    return route.options;
  }

  return {
    ...(route.options ?? {}),
    detail: {
      ...route.detail,
      ...((route.options as { detail?: Record<string, unknown> } | undefined)?.detail ?? {}),
    },
  };
}

function createPluginRegistry(
  plugins: Array<HttpPluginDefinition<any, any>>,
): Map<string, HttpPluginDefinition<any, any>> {
  const registry = new Map<string, HttpPluginDefinition<any, any>>();

  for (const plugin of plugins) {
    const refs = new Set([plugin.name, ...(plugin.refs ?? [])].filter(Boolean) as string[]);

    for (const ref of refs) {
      registry.set(ref, plugin);
    }
  }

  return registry;
}

async function readRequestBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json().catch(() => undefined);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData().catch(() => undefined);
    return formData ? Object.fromEntries(formData.entries()) : undefined;
  }

  return request.text().catch(() => undefined);
}

function readRequestQuery(request: Request): Record<string, string | undefined> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
