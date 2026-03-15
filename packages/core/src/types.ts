import type { CoreRegistry, GeneratedManifest } from "./registry/types.ts";

export type HandlerKind = "action" | "query" | "workflow" | "event";
export type ExecutableKind = Exclude<HandlerKind, "event">;

export interface BusTypesContract {
  action: object;
  query: object;
  workflow: object;
  event: object;
}

export interface EmptyBusTypes extends BusTypesContract {
  action: {};
  query: {};
  workflow: {};
  event: {};
}

export interface ConfigStore {
  get(key: string): unknown;
  has(key: string): boolean;
  all(): Readonly<Record<string, unknown>>;
}

export interface DatabaseAdapter<TClient = unknown> {
  client(region?: string): TClient;
}

export interface HandlerInvocationMeta {
  source?: string;
  correlationId?: string;
  causationId?: string;
  eventKey?: string;
  [key: string]: unknown;
}

export interface PublishedEventEnvelope<Payload = unknown> {
  key: string;
  payload: Payload;
  meta: HandlerInvocationMeta;
  version: string | number;
}

export interface EventTransport {
  publish(event: PublishedEventEnvelope): Promise<void> | void;
}

export interface BaseApplicationContext<
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  console: Console;
  config: ConfigStore;
  database: TDatabase;
}

export interface ApplicationContext<
  TBuses extends BusTypesContract = EmptyBusTypes,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> extends BaseApplicationContext<TDatabase> {
  action: TBuses["action"];
  query: TBuses["query"];
  workflow: TBuses["workflow"];
  event: TBuses["event"];
}

export interface HandlerExecutionArgs<Ctx, Input> {
  ctx: Ctx;
  input: Input;
  meta: HandlerInvocationMeta;
}

export type InputParser<T> = (value: unknown) => T;

export interface CoreMiddlewareContext<Ctx, Input = unknown> {
  kind: ExecutableKind;
  key: string;
  input: Input;
  ctx: Ctx;
  meta: HandlerInvocationMeta;
}

export type CoreMiddleware<Ctx> = (
  context: CoreMiddlewareContext<Ctx>,
  next: () => Promise<unknown>,
) => Promise<unknown>;

interface DeclarationCommon {
  description?: string;
}

interface ExecutableDeclarationCommon<Ctx> extends DeclarationCommon {
  middleware?: Array<CoreMiddleware<Ctx>>;
}

interface ExecutableTypeInfo<Input, Output> {
  input: Input;
  output: Output;
}

export interface ActionDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
> extends ExecutableDeclarationCommon<Ctx> {
  readonly __types__?: ExecutableTypeInfo<Input, Output>;
  kind: "action";
  parser?: InputParser<Input>;
  handle(args: HandlerExecutionArgs<Ctx, Input>): Promise<Output> | Output;
}

export interface QueryDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
> extends ExecutableDeclarationCommon<Ctx> {
  readonly __types__?: ExecutableTypeInfo<Input, Output>;
  kind: "query";
  parser?: InputParser<Input>;
  handle(args: HandlerExecutionArgs<Ctx, Input>): Promise<Output> | Output;
}

export interface WorkflowDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
> extends ExecutableDeclarationCommon<Ctx> {
  readonly __types__?: ExecutableTypeInfo<Input, Output>;
  kind: "workflow";
  parser?: InputParser<Input>;
  subscribesTo?: string[];
  handle(args: HandlerExecutionArgs<Ctx, Input>): Promise<Output> | Output;
}

export interface EventDeclaration<Payload> extends DeclarationCommon {
  readonly __types__?: {
    payload: Payload;
  };
  kind: "event";
  version: string | number;
  parser?: InputParser<Payload>;
}

export type AnyExecutableDeclaration =
  | ActionDeclaration<unknown, unknown, any>
  | QueryDeclaration<unknown, unknown, any>
  | WorkflowDeclaration<unknown, unknown, any>;

export type CoreDeclaration = AnyExecutableDeclaration | EventDeclaration<unknown>;

export type DeclarationInput<TDeclaration> =
  TDeclaration extends { __types__?: { input: infer Input } } ? Input : never;

export type DeclarationOutput<TDeclaration> =
  TDeclaration extends { __types__?: { output: infer Output } } ? Output : never;

export type DeclarationPayload<TDeclaration> =
  TDeclaration extends { __types__?: { payload: infer Payload } } ? Payload : never;

export type ManifestBusTypes<TManifest extends GeneratedManifest> =
  TManifest extends GeneratedManifest<infer TBuses>
    ? TBuses
    : EmptyBusTypes;

export interface CreateApplicationOptions<
  TBuses extends BusTypesContract = EmptyBusTypes,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  config: ConfigStore;
  database: TDatabase;
  manifest: GeneratedManifest<TBuses>;
  console?: Console;
  middleware?: Array<CoreMiddleware<ApplicationContext<TBuses, TDatabase>>>;
  eventTransport?: EventTransport;
  setGlobalCtx?: boolean;
}

export interface CreateApplicationAdapterContext<
  TBuses extends BusTypesContract = EmptyBusTypes,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  ctx: ApplicationContext<TBuses, TDatabase>;
  registry: CoreRegistry;
  runtime: CoreRuntime<TBuses>;
  manifest: GeneratedManifest<TBuses>;
  console: Console;
}

export interface AdapterCodegenContext {
  rootDir: string;
  manifest: GeneratedManifest;
}

export interface AdapterCodegenResult {
  name: string;
  outputs: string[];
}

export interface AdapterCodegen {
  name: string;
  generate(
    context: AdapterCodegenContext,
  ): Promise<AdapterCodegenResult | void> | AdapterCodegenResult | void;
}

export type ApplicationAdapterFactory<
  TInstance = unknown,
  TBuses extends BusTypesContract = EmptyBusTypes,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> = (
  context: CreateApplicationAdapterContext<TBuses, TDatabase>,
) => Promise<TInstance> | TInstance;

export type ApplicationAdapterFactories<
  TBuses extends BusTypesContract = EmptyBusTypes,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> = Record<string, ApplicationAdapterFactory<unknown, TBuses, TDatabase>>;

export type ResolvedApplicationAdapters<TAdapters> = {
  [TKey in keyof TAdapters]: TAdapters[TKey] extends ApplicationAdapterFactory<
    infer TInstance,
    any,
    any
  >
    ? Awaited<TInstance>
    : never;
};

export interface CoreRuntime<
  TBuses extends BusTypesContract = EmptyBusTypes,
> {
  readonly registry: CoreRegistry;
  readonly buses: {
    action: TBuses["action"];
    query: TBuses["query"];
    workflow: TBuses["workflow"];
    event: TBuses["event"];
  };
  invoke(kind: ExecutableKind, key: string, input: unknown, meta?: HandlerInvocationMeta): Promise<unknown>;
  publish(key: string, payload: unknown, meta?: HandlerInvocationMeta): Promise<void>;
}

export interface Application<
  TBuses extends BusTypesContract = EmptyBusTypes,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TAdapters extends Record<string, unknown> = Record<string, never>,
> {
  ctx: ApplicationContext<TBuses, TDatabase>;
  registry: CoreRegistry;
  runtime: CoreRuntime<TBuses>;
  adapter: TAdapters;
}
