import type {
  ActionDeclaration,
  ApplicationContext,
  CoreMiddleware,
  CoreDeclaration,
  EventDeclaration,
  HandlerExecutionArgs,
  QueryDeclaration,
  SchemaInput,
  SchemaLike,
  SchemaOutput,
  WorkflowDeclaration,
} from "./types.ts";

const DECLARATION_SYMBOL = Symbol.for("oap.core.declaration");

type DeclarationBrand = {
  readonly [DECLARATION_SYMBOL]: true;
};

type SchemaHandlerOutput<TSchema> = SchemaInput<TSchema> | SchemaOutput<TSchema>;

type LegacyActionOptions<Input, Output, Ctx> = Omit<
  ActionDeclaration<Input, Output, Ctx>,
  "kind" | "__types__" | "input" | "returns"
> & {
  kind?: never;
  input?: never;
  returns?: never;
};

interface ExecutableOptionsBase<Ctx> {
  description?: string;
  middleware?: Array<CoreMiddleware<Ctx>>;
}

type SchemaActionOptions<
  Ctx,
  TInputSchema extends SchemaLike,
  TReturnsSchema extends SchemaLike,
> = ExecutableOptionsBase<Ctx> & {
  input: TInputSchema;
  returns: TReturnsSchema;
  parser?: never;
  handle(
    args: HandlerExecutionArgs<Ctx, SchemaOutput<TInputSchema>>,
  ): Promise<SchemaHandlerOutput<TReturnsSchema>> | SchemaHandlerOutput<TReturnsSchema>;
};

type LegacyQueryOptions<Input, Output, Ctx> = Omit<
  QueryDeclaration<Input, Output, Ctx>,
  "kind" | "__types__" | "input" | "returns"
> & {
  kind?: never;
  input?: never;
  returns?: never;
};

type SchemaQueryOptions<
  Ctx,
  TInputSchema extends SchemaLike,
  TReturnsSchema extends SchemaLike,
> = ExecutableOptionsBase<Ctx> & {
  input: TInputSchema;
  returns: TReturnsSchema;
  parser?: never;
  handle(
    args: HandlerExecutionArgs<Ctx, SchemaOutput<TInputSchema>>,
  ): Promise<SchemaHandlerOutput<TReturnsSchema>> | SchemaHandlerOutput<TReturnsSchema>;
};

type LegacyWorkflowOptions<Input, Output, Ctx> = Omit<
  WorkflowDeclaration<Input, Output, Ctx>,
  "kind" | "__types__" | "input" | "returns"
> & {
  kind?: never;
  input?: never;
  returns?: never;
};

type SchemaWorkflowOptions<
  Ctx,
  TInputSchema extends SchemaLike,
  TReturnsSchema extends SchemaLike,
> = ExecutableOptionsBase<Ctx> & {
  input: TInputSchema;
  returns: TReturnsSchema;
  subscribesTo?: string[];
  parser?: never;
  handle(
    args: HandlerExecutionArgs<Ctx, SchemaOutput<TInputSchema>>,
  ): Promise<SchemaHandlerOutput<TReturnsSchema>> | SchemaHandlerOutput<TReturnsSchema>;
};

type LegacyEventOptions<Payload> = Omit<
  EventDeclaration<Payload>,
  "kind" | "__types__" | "payload"
> & {
  kind?: never;
  payload?: never;
};

type SchemaEventOptions<TPayloadSchema extends SchemaLike> = Omit<
  EventDeclaration<
    SchemaInput<TPayloadSchema>,
    SchemaOutput<TPayloadSchema>,
    TPayloadSchema
>,
  "kind" | "__types__" | "parser"
> & {
  payload: TPayloadSchema;
  parser?: never;
};

export type BrandedActionDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
  HandlerInput = Input,
  HandlerOutput = Output,
  TInputSchema = undefined,
  TReturnsSchema = undefined,
> = ActionDeclaration<
  Input,
  Output,
  Ctx,
  HandlerInput,
  HandlerOutput,
  TInputSchema,
  TReturnsSchema
> & DeclarationBrand;

export type BrandedQueryDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
  HandlerInput = Input,
  HandlerOutput = Output,
  TInputSchema = undefined,
  TReturnsSchema = undefined,
> = QueryDeclaration<
  Input,
  Output,
  Ctx,
  HandlerInput,
  HandlerOutput,
  TInputSchema,
  TReturnsSchema
> & DeclarationBrand;

export type BrandedWorkflowDeclaration<
  Input,
  Output,
  Ctx = ApplicationContext,
  HandlerInput = Input,
  HandlerOutput = Output,
  TInputSchema = undefined,
  TReturnsSchema = undefined,
> = WorkflowDeclaration<
  Input,
  Output,
  Ctx,
  HandlerInput,
  HandlerOutput,
  TInputSchema,
  TReturnsSchema
> & DeclarationBrand;

export type BrandedEventDeclaration<
  Payload,
  ParsedPayload = Payload,
  TPayloadSchema = undefined,
> = EventDeclaration<Payload, ParsedPayload, TPayloadSchema> & DeclarationBrand;

export type BrandedCoreDeclaration = CoreDeclaration & DeclarationBrand;

type SchemaActionBuilder<Ctx> = <
  TInputSchema extends SchemaLike,
  TReturnsSchema extends SchemaLike,
>(
  declaration: SchemaActionOptions<Ctx, TInputSchema, TReturnsSchema>,
) => BrandedActionDeclaration<
  SchemaInput<TInputSchema>,
  SchemaOutput<TReturnsSchema>,
  Ctx,
  SchemaOutput<TInputSchema>,
  SchemaHandlerOutput<TReturnsSchema>,
  TInputSchema,
  TReturnsSchema
>;

type SchemaQueryBuilder<Ctx> = <
  TInputSchema extends SchemaLike,
  TReturnsSchema extends SchemaLike,
>(
  declaration: SchemaQueryOptions<Ctx, TInputSchema, TReturnsSchema>,
) => BrandedQueryDeclaration<
  SchemaInput<TInputSchema>,
  SchemaOutput<TReturnsSchema>,
  Ctx,
  SchemaOutput<TInputSchema>,
  SchemaHandlerOutput<TReturnsSchema>,
  TInputSchema,
  TReturnsSchema
>;

type SchemaWorkflowBuilder<Ctx> = <
  TInputSchema extends SchemaLike,
  TReturnsSchema extends SchemaLike,
>(
  declaration: SchemaWorkflowOptions<Ctx, TInputSchema, TReturnsSchema>,
) => BrandedWorkflowDeclaration<
  SchemaInput<TInputSchema>,
  SchemaOutput<TReturnsSchema>,
  Ctx,
  SchemaOutput<TInputSchema>,
  SchemaHandlerOutput<TReturnsSchema>,
  TInputSchema,
  TReturnsSchema
>;

function brand<TDeclaration extends { kind: string }>(
  kind: TDeclaration["kind"],
  declaration: Omit<TDeclaration, "kind">,
): TDeclaration & DeclarationBrand {
  return Object.freeze({
    ...declaration,
    kind,
    [DECLARATION_SYMBOL]: true,
  }) as TDeclaration & DeclarationBrand;
}

export function defineAction<
  Ctx = ApplicationContext,
  TInputSchema extends SchemaLike = SchemaLike,
  TReturnsSchema extends SchemaLike = SchemaLike,
>(
  declaration: SchemaActionOptions<Ctx, TInputSchema, TReturnsSchema>,
): BrandedActionDeclaration<
  SchemaInput<TInputSchema>,
  SchemaOutput<TReturnsSchema>,
  Ctx,
  SchemaOutput<TInputSchema>,
  SchemaHandlerOutput<TReturnsSchema>,
  TInputSchema,
  TReturnsSchema
>;

export function defineAction<Ctx = ApplicationContext>(): SchemaActionBuilder<Ctx>;

export function defineAction<Input, Output, Ctx = ApplicationContext>(
  declaration: LegacyActionOptions<Input, Output, Ctx>,
): BrandedActionDeclaration<Input, Output, Ctx>;

export function defineAction(
  declaration?:
    | LegacyActionOptions<unknown, unknown, ApplicationContext>
    | SchemaActionOptions<ApplicationContext, SchemaLike, SchemaLike>,
):
  | BrandedActionDeclaration<unknown, unknown, ApplicationContext>
  | SchemaActionBuilder<ApplicationContext> {
  if (!declaration) {
    return ((nextDeclaration) =>
      brand(
        "action",
        nextDeclaration as unknown as Omit<ActionDeclaration<unknown, unknown>, "kind">,
      )) as SchemaActionBuilder<ApplicationContext>;
  }

  return brand("action", declaration as Omit<ActionDeclaration<unknown, unknown>, "kind">);
}

export function defineQuery<
  Ctx = ApplicationContext,
  TInputSchema extends SchemaLike = SchemaLike,
  TReturnsSchema extends SchemaLike = SchemaLike,
>(
  declaration: SchemaQueryOptions<Ctx, TInputSchema, TReturnsSchema>,
): BrandedQueryDeclaration<
  SchemaInput<TInputSchema>,
  SchemaOutput<TReturnsSchema>,
  Ctx,
  SchemaOutput<TInputSchema>,
  SchemaHandlerOutput<TReturnsSchema>,
  TInputSchema,
  TReturnsSchema
>;

export function defineQuery<Ctx = ApplicationContext>(): SchemaQueryBuilder<Ctx>;

export function defineQuery<Input, Output, Ctx = ApplicationContext>(
  declaration: LegacyQueryOptions<Input, Output, Ctx>,
): BrandedQueryDeclaration<Input, Output, Ctx>;

export function defineQuery(
  declaration?:
    | LegacyQueryOptions<unknown, unknown, ApplicationContext>
    | SchemaQueryOptions<ApplicationContext, SchemaLike, SchemaLike>,
):
  | BrandedQueryDeclaration<unknown, unknown, ApplicationContext>
  | SchemaQueryBuilder<ApplicationContext> {
  if (!declaration) {
    return ((nextDeclaration) =>
      brand(
        "query",
        nextDeclaration as unknown as Omit<QueryDeclaration<unknown, unknown>, "kind">,
      )) as SchemaQueryBuilder<ApplicationContext>;
  }

  return brand("query", declaration as Omit<QueryDeclaration<unknown, unknown>, "kind">);
}

export function defineWorkflow<
  Ctx = ApplicationContext,
  TInputSchema extends SchemaLike = SchemaLike,
  TReturnsSchema extends SchemaLike = SchemaLike,
>(
  declaration: SchemaWorkflowOptions<Ctx, TInputSchema, TReturnsSchema>,
): BrandedWorkflowDeclaration<
  SchemaInput<TInputSchema>,
  SchemaOutput<TReturnsSchema>,
  Ctx,
  SchemaOutput<TInputSchema>,
  SchemaHandlerOutput<TReturnsSchema>,
  TInputSchema,
  TReturnsSchema
>;

export function defineWorkflow<Ctx = ApplicationContext>(): SchemaWorkflowBuilder<Ctx>;

export function defineWorkflow<Input, Output, Ctx = ApplicationContext>(
  declaration: LegacyWorkflowOptions<Input, Output, Ctx>,
): BrandedWorkflowDeclaration<Input, Output, Ctx>;

export function defineWorkflow(
  declaration?:
    | LegacyWorkflowOptions<unknown, unknown, ApplicationContext>
    | SchemaWorkflowOptions<ApplicationContext, SchemaLike, SchemaLike>,
):
  | BrandedWorkflowDeclaration<unknown, unknown, ApplicationContext>
  | SchemaWorkflowBuilder<ApplicationContext> {
  if (!declaration) {
    return ((nextDeclaration) =>
      brand(
        "workflow",
        nextDeclaration as unknown as Omit<WorkflowDeclaration<unknown, unknown>, "kind">,
      )) as SchemaWorkflowBuilder<ApplicationContext>;
  }

  return brand("workflow", declaration as Omit<WorkflowDeclaration<unknown, unknown>, "kind">);
}

export function defineEvent<TPayloadSchema extends SchemaLike>(
  declaration: SchemaEventOptions<TPayloadSchema>,
): BrandedEventDeclaration<
  SchemaInput<TPayloadSchema>,
  SchemaOutput<TPayloadSchema>,
  TPayloadSchema
>;

export function defineEvent<Payload>(
  declaration: LegacyEventOptions<Payload>,
): BrandedEventDeclaration<Payload>;

export function defineEvent(
  declaration: LegacyEventOptions<unknown> | SchemaEventOptions<SchemaLike>,
): BrandedEventDeclaration<unknown> {
  return brand("event", declaration as Omit<EventDeclaration<unknown>, "kind">);
}

export function isCoreDeclaration(value: unknown): value is BrandedCoreDeclaration {
  return Boolean(
    value &&
    typeof value === "object" &&
    DECLARATION_SYMBOL in (value as Record<PropertyKey, unknown>),
  );
}
