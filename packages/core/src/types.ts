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

export interface SchemaLike<TInput = unknown, TOutput = TInput> {
  parse(value: unknown): TOutput;
  parseAsync?(value: unknown): Promise<TOutput>;
}

export type SchemaInput<TSchema> =
  [TSchema] extends [undefined] ? never
  : TSchema extends { _input: infer Input } ? Input
  : TSchema extends { parse(value: infer Input): unknown } ? Input
  : unknown;

export type SchemaOutput<TSchema> =
  [TSchema] extends [undefined] ? never
  : TSchema extends { _output: infer Output } ? Output
  : TSchema extends { parse(value: unknown): infer Output } ? Output
  : unknown;

export type InputParser<T> = (value: unknown) => T | Promise<T>;

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

interface ExecutableTypeInfo<
  Input,
  Output,
  HandlerInput = Input,
  HandlerOutput = Output,
  TInputSchema = undefined,
  TReturnsSchema = undefined,
> {
  input: Input;
  output: Output;
  handlerInput: HandlerInput;
  handlerOutput: HandlerOutput;
  inputSchema: TInputSchema;
  returnsSchema: TReturnsSchema;
}

export interface ActionDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
  HandlerInput = Input,
  HandlerOutput = Output,
  TInputSchema = undefined,
  TReturnsSchema = undefined,
> extends ExecutableDeclarationCommon<Ctx> {
  readonly __types__?: ExecutableTypeInfo<
    Input,
    Output,
    HandlerInput,
    HandlerOutput,
    TInputSchema,
    TReturnsSchema
  >;
  kind: "action";
  parser?: InputParser<HandlerInput>;
  input?: TInputSchema;
  returns?: TReturnsSchema;
  handle(args: HandlerExecutionArgs<Ctx, HandlerInput>): Promise<HandlerOutput> | HandlerOutput;
}

export interface QueryDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
  HandlerInput = Input,
  HandlerOutput = Output,
  TInputSchema = undefined,
  TReturnsSchema = undefined,
> extends ExecutableDeclarationCommon<Ctx> {
  readonly __types__?: ExecutableTypeInfo<
    Input,
    Output,
    HandlerInput,
    HandlerOutput,
    TInputSchema,
    TReturnsSchema
  >;
  kind: "query";
  parser?: InputParser<HandlerInput>;
  input?: TInputSchema;
  returns?: TReturnsSchema;
  handle(args: HandlerExecutionArgs<Ctx, HandlerInput>): Promise<HandlerOutput> | HandlerOutput;
}

export interface WorkflowDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
  HandlerInput = Input,
  HandlerOutput = Output,
  TInputSchema = undefined,
  TReturnsSchema = undefined,
> extends ExecutableDeclarationCommon<Ctx> {
  readonly __types__?: ExecutableTypeInfo<
    Input,
    Output,
    HandlerInput,
    HandlerOutput,
    TInputSchema,
    TReturnsSchema
  >;
  kind: "workflow";
  parser?: InputParser<HandlerInput>;
  input?: TInputSchema;
  returns?: TReturnsSchema;
  subscribesTo?: string[];
  handle(args: HandlerExecutionArgs<Ctx, HandlerInput>): Promise<HandlerOutput> | HandlerOutput;
}

interface EventTypeInfo<Payload, ParsedPayload = Payload, TPayloadSchema = undefined> {
  payload: Payload;
  parsedPayload: ParsedPayload;
  payloadSchema: TPayloadSchema;
}

export interface EventDeclaration<
  Payload,
  ParsedPayload = Payload,
  TPayloadSchema = undefined,
> extends DeclarationCommon {
  readonly __types__?: {
    payload: EventTypeInfo<Payload, ParsedPayload, TPayloadSchema>["payload"];
    parsedPayload: EventTypeInfo<Payload, ParsedPayload, TPayloadSchema>["parsedPayload"];
    payloadSchema: EventTypeInfo<Payload, ParsedPayload, TPayloadSchema>["payloadSchema"];
  };
  kind: "event";
  version: string | number;
  parser?: InputParser<ParsedPayload>;
  payload?: TPayloadSchema;
}

export type AnyExecutableDeclaration =
  | ActionDeclaration<unknown, unknown, any, any, any, any, any>
  | QueryDeclaration<unknown, unknown, any, any, any, any, any>
  | WorkflowDeclaration<unknown, unknown, any, any, any, any, any>;

export type CoreDeclaration = AnyExecutableDeclaration | EventDeclaration<unknown, unknown, unknown>;

export type DeclarationKind<TDeclaration> =
  TDeclaration extends { kind: infer Kind } ? Kind : never;

export type DeclarationInput<TDeclaration> =
  TDeclaration extends { __types__?: { input: infer Input } } ? Input : never;

export type DeclarationOutput<TDeclaration> =
  TDeclaration extends { __types__?: { output: infer Output } } ? Output : never;

export type DeclarationHandlerInput<TDeclaration> =
  TDeclaration extends { __types__?: { handlerInput: infer Input } } ? Input : never;

export type DeclarationHandlerOutput<TDeclaration> =
  TDeclaration extends { __types__?: { handlerOutput: infer Output } } ? Output : never;

export type DeclarationPayload<TDeclaration> =
  TDeclaration extends { __types__?: { payload: infer Payload } } ? Payload : never;

export type DeclarationParsedPayload<TDeclaration> =
  TDeclaration extends { __types__?: { parsedPayload: infer Payload } } ? Payload : never;

export type DeclarationInputSchema<TDeclaration> =
  TDeclaration extends { __types__?: { inputSchema: infer Schema } } ? Schema : undefined;

export type DeclarationReturnsSchema<TDeclaration> =
  TDeclaration extends { __types__?: { returnsSchema: infer Schema } } ? Schema : undefined;

export type DeclarationPayloadSchema<TDeclaration> =
  TDeclaration extends { __types__?: { payloadSchema: infer Schema } } ? Schema : undefined;

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

export interface UnsafeExecutableBusMethod<TDeclaration> {
  (
    input: DeclarationHandlerInput<TDeclaration>,
    meta?: HandlerInvocationMeta,
  ): Promise<DeclarationHandlerOutput<TDeclaration>>;
  readonly $key: string;
  readonly $kind: DeclarationKind<TDeclaration>;
  readonly $definition: TDeclaration;
  readonly $schema: {
    input: DeclarationInputSchema<TDeclaration>;
    returns: DeclarationReturnsSchema<TDeclaration>;
  };
}

export interface ExecutableBusMethod<TDeclaration> {
  (
    input: DeclarationInput<TDeclaration>,
    meta?: HandlerInvocationMeta,
  ): Promise<DeclarationOutput<TDeclaration>>;
  readonly unsafe: UnsafeExecutableBusMethod<TDeclaration>;
  readonly $key: string;
  readonly $kind: DeclarationKind<TDeclaration>;
  readonly $definition: TDeclaration;
  readonly $schema: {
    input: DeclarationInputSchema<TDeclaration>;
    returns: DeclarationReturnsSchema<TDeclaration>;
  };
}

export interface UnsafeEventBusMethod<TDeclaration> {
  (
    payload: DeclarationParsedPayload<TDeclaration>,
    meta?: HandlerInvocationMeta,
  ): Promise<void>;
  readonly $key: string;
  readonly $kind: DeclarationKind<TDeclaration>;
  readonly $definition: TDeclaration;
  readonly $schema: {
    payload: DeclarationPayloadSchema<TDeclaration>;
  };
}

export interface EventBusMethod<TDeclaration> {
  (
    payload: DeclarationPayload<TDeclaration>,
    meta?: HandlerInvocationMeta,
  ): Promise<void>;
  readonly unsafe: UnsafeEventBusMethod<TDeclaration>;
  readonly $key: string;
  readonly $kind: DeclarationKind<TDeclaration>;
  readonly $definition: TDeclaration;
  readonly $schema: {
    payload: DeclarationPayloadSchema<TDeclaration>;
  };
}

export type BusMethodDefinition<TBusMethod> =
  TBusMethod extends { readonly $definition: infer TDeclaration } ? TDeclaration : never;

export type BusMethodInput<TBusMethod> = DeclarationInput<BusMethodDefinition<TBusMethod>>;

export type BusMethodOutput<TBusMethod> = DeclarationOutput<BusMethodDefinition<TBusMethod>>;

export type BusMethodPayload<TBusMethod> = DeclarationPayload<BusMethodDefinition<TBusMethod>>;

export type BusMethodHandlerInput<TBusMethod> =
  DeclarationHandlerInput<BusMethodDefinition<TBusMethod>>;

export type BusMethodHandlerOutput<TBusMethod> =
  DeclarationHandlerOutput<BusMethodDefinition<TBusMethod>>;

export type BusMethodParsedPayload<TBusMethod> =
  DeclarationParsedPayload<BusMethodDefinition<TBusMethod>>;

export type BusMethodInputSchema<TBusMethod> =
  DeclarationInputSchema<BusMethodDefinition<TBusMethod>>;

export type BusMethodReturnsSchema<TBusMethod> =
  DeclarationReturnsSchema<BusMethodDefinition<TBusMethod>>;

export type BusMethodPayloadSchema<TBusMethod> =
  DeclarationPayloadSchema<BusMethodDefinition<TBusMethod>>;

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
