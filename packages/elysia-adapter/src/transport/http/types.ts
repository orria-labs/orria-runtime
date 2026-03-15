import type {
  ApplicationAdapterFactory,
  ApplicationContext,
  BusTypesContract,
  CreateApplicationAdapterContext,
  DatabaseAdapter,
} from "@orria-labs/runtime";
import type {
  DefinitionBase,
  Elysia,
  EphemeralType,
  InferContext,
  InputSchema,
  MetadataBase,
  RouteBase,
  SingletonBase,
  UnwrapRoute,
} from "elysia";

type Awaitable<T> = Promise<T> | T;
type AnyElysia = Elysia<any, any, any, any, any, any, any>;
type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type HttpRouteOptions = NonNullable<Parameters<Elysia["route"]>[3]>;
export type HttpWsRouteOptions = NonNullable<Parameters<Elysia["ws"]>[1]>;

export interface HttpRouteDetail {
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export interface DiscoverHttpTransportOptions {
  rootDir: string;
  routesDir?: string;
  pluginsDir?: string;
}

export interface ResolvedHttpPluginModule {
  filePath: string;
  name: string;
  plugin: HttpPluginDefinition;
}

export interface ResolvedHttpRouteModule {
  filePath: string;
  id: string;
  route: HttpHandlerDefinition;
}

export interface ResolvedHttpWsRouteModule {
  filePath: string;
  id: string;
  route?: HttpWsRouteDefinition;
  app?: Elysia;
}

export interface HttpAdapterWatchOptions {
  intervalMs?: number;
}

export interface HttpPluginRegistry {}

export type RegisteredHttpPluginRef = Extract<keyof HttpPluginRegistry, string>;

export type HttpBaseApp<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> = Elysia<"", {
  decorator: {
    ctx: ApplicationContext<TBuses, TDatabase>;
  };
  store: {};
  derive: {};
  resolve: {};
}>;

export type HttpPluginRef<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> = RegisteredHttpPluginRef | HttpPluginDefinition<TBuses, TDatabase>;

export interface HttpPluginDefinition<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  name?: string;
  refs?: string[];
  setup(args: {
    app: Elysia;
    ctx: ApplicationContext<TBuses, TDatabase>;
    adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>;
  }): Awaitable<AnyElysia | void>;
}

type ResolveHttpInputSchema<TOptions> = [TOptions] extends [undefined]
  ? {}
  : NonNullable<TOptions> extends InputSchema<string>
    ? NonNullable<TOptions>
    : {};

type ResolveHttpPath<TPath> = TPath extends string ? TPath : "";

type ExtractHttpPluginApps<
  TPlugins,
  TCollected extends AnyElysia[] = [],
> = [TPlugins] extends [readonly unknown[]]
  ? TPlugins extends readonly [infer THead, ...infer TTail]
    ? ResolveHttpPluginDefinition<THead> extends infer TPlugin
      ? TPlugin extends { setup: (...args: any[]) => infer TResult }
        ? Awaited<Exclude<TResult, void>> extends infer TPluginApp extends AnyElysia
          ? ExtractHttpPluginApps<TTail, [...TCollected, TPluginApp]>
          : ExtractHttpPluginApps<TTail, TCollected>
        : ExtractHttpPluginApps<TTail, TCollected>
      : ExtractHttpPluginApps<TTail, TCollected>
    : TCollected
  : TCollected;

type ResolveHttpPluginDefinition<TPluginRef> = TPluginRef extends keyof HttpPluginRegistry
  ? HttpPluginRegistry[TPluginRef]
  : TPluginRef;

type MergeHttpAppInstances<
  TInstances extends AnyElysia[] = [],
  TSingleton extends SingletonBase = {
    decorator: {};
    store: {};
    derive: {};
    resolve: {};
  },
  TDefinitions extends DefinitionBase = {
    typebox: {};
    error: {};
  },
  TMetadata extends MetadataBase = {
    schema: {};
    standaloneSchema: {};
    macro: {};
    macroFn: {};
    parser: {};
    response: {};
  },
  TEphemeral extends EphemeralType = {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
  },
  TVolatile extends EphemeralType = {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
  },
  TRoutes extends RouteBase = {},
> = TInstances extends [infer TCurrent extends AnyElysia, ...infer TRest extends AnyElysia[]]
  ? MergeHttpAppInstances<
      TRest,
      TSingleton & TCurrent["~Singleton"],
      TDefinitions & TCurrent["~Definitions"],
      TMetadata & TCurrent["~Metadata"],
      TEphemeral & TCurrent["~Ephemeral"],
      TVolatile & TCurrent["~Volatile"],
      TRoutes & TCurrent["~Routes"]
    >
  : Elysia<"", {
      decorator: TSingleton["decorator"];
      store: Prettify<TSingleton["store"]>;
      derive: TSingleton["derive"];
      resolve: TSingleton["resolve"];
    }, TDefinitions, TMetadata, TRoutes, TEphemeral, TVolatile>;

export type ResolveHttpHandlerApp<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TBaseApp extends AnyElysia = HttpBaseApp<TBuses, TDatabase>,
  TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = undefined,
> = MergeHttpAppInstances<[TBaseApp, ...ExtractHttpPluginApps<TPlugins>]>;

type ResolveHttpRouteContext<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TBaseApp extends AnyElysia = HttpBaseApp<TBuses, TDatabase>,
  TPath extends string | undefined = undefined,
  TOptions extends HttpRouteOptions | undefined = undefined,
  TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = undefined,
> = InferContext<
  ResolveHttpHandlerApp<TBuses, TDatabase, TBaseApp, TPlugins>,
  ResolveHttpPath<TPath>,
  UnwrapRoute<
    ResolveHttpInputSchema<TOptions>,
    ResolveHttpHandlerApp<TBuses, TDatabase, TBaseApp, TPlugins>["~Definitions"]["typebox"],
    ResolveHttpPath<TPath>
  >
>;

export type HttpHandlerContext<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TBaseApp extends AnyElysia = HttpBaseApp<TBuses, TDatabase>,
  TPath extends string | undefined = string,
  TOptions extends HttpRouteOptions | undefined = HttpRouteOptions,
  TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
    TBuses,
    TDatabase
  >[],
> = ResolveHttpRouteContext<TBuses, TDatabase, TBaseApp, TPath, TOptions, TPlugins> & {
  app: ResolveHttpHandlerApp<TBuses, TDatabase, TBaseApp, TPlugins>;
  transportContext: ResolveHttpRouteContext<TBuses, TDatabase, TBaseApp, TPath, TOptions, TPlugins>;
};

export type HttpHandlerArgs<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TBaseApp extends AnyElysia = HttpBaseApp<TBuses, TDatabase>,
  TPath extends string | undefined = string,
  TOptions extends HttpRouteOptions | undefined = HttpRouteOptions,
  TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
    TBuses,
    TDatabase
  >[],
> = HttpHandlerContext<TBuses, TDatabase, TBaseApp, TPath, TOptions, TPlugins>;

export interface HttpHandlerDefinition<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TBaseApp extends AnyElysia = HttpBaseApp<TBuses, TDatabase>,
  TPath extends string | undefined = string,
  TOptions extends HttpRouteOptions | undefined = HttpRouteOptions,
  TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
    TBuses,
    TDatabase
  >[],
> {
  method?: HttpMethod;
  path?: TPath;
  plugins?: TPlugins;
  options?: TOptions;
  detail?: HttpRouteDetail;
  handle(
    args: HttpHandlerContext<TBuses, TDatabase, TBaseApp, TPath, TOptions, TPlugins>,
  ): Promise<unknown> | unknown;
}

export interface HttpWsRouteDefinition<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TPath extends string | undefined = string,
  TOptions extends HttpWsRouteOptions = HttpWsRouteOptions,
  TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = readonly HttpPluginRef<
    TBuses,
    TDatabase
  >[],
> {
  path?: TPath;
  plugins?: TPlugins;
  options: TOptions;
}

export interface BuildHttpApplicationOptions<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  rootDir?: string;
  routesDir?: string;
  pluginsDir?: string;
  createApp?: (
    adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  ) => Awaitable<unknown>;
  plugins?: Array<HttpPluginRef<TBuses, TDatabase>>;
  routes?: Array<HttpHandlerDefinition<TBuses, TDatabase>>;
  extend?(args: {
    app: Elysia;
    ctx: ApplicationContext<TBuses, TDatabase>;
    adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>;
  }): Awaitable<unknown>;
}

export interface HttpAdapterInstance<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  kind: "http";
  readonly watching: boolean;
  app: Elysia;
  listen(...args: Parameters<Elysia["listen"]>): ReturnType<Elysia["listen"]>;
  handle(request: Request): Promise<Response>;
  reload(): Promise<void>;
  watch(options?: HttpAdapterWatchOptions): Promise<void>;
  unwatch(): void;
}

export interface HttpAdapterDefinition<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TPlugins extends readonly HttpPluginRef<TBuses, TDatabase>[] | undefined = undefined,
> {
  adapter: ApplicationAdapterFactory<HttpAdapterInstance<TBuses, TDatabase>, TBuses, TDatabase>;
  defineHandler: ReturnType<
    typeof import("./router/define-handler.ts").createHandlerFactory<
      TBuses,
      TDatabase,
      TPlugins
    >
  >;
  defineWs: ReturnType<
    typeof import("./router/define-ws.ts").createWsFactory<
      TBuses,
      TDatabase,
      TPlugins
    >
  >;
}
