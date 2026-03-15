import type {
  ActionDeclaration,
  ApplicationContext,
  CoreDeclaration,
  EventDeclaration,
  QueryDeclaration,
  WorkflowDeclaration,
} from "./types.ts";

const DECLARATION_SYMBOL = Symbol.for("oap.core.declaration");

type DeclarationBrand = {
  readonly [DECLARATION_SYMBOL]: true;
};

export type BrandedActionDeclaration<Input, Output, Ctx = ApplicationContext> =
  ActionDeclaration<Input, Output, Ctx> & DeclarationBrand;

export type BrandedQueryDeclaration<Input, Output, Ctx = ApplicationContext> =
  QueryDeclaration<Input, Output, Ctx> & DeclarationBrand;

export type BrandedWorkflowDeclaration<Input, Output, Ctx = ApplicationContext> =
  WorkflowDeclaration<Input, Output, Ctx> & DeclarationBrand;

export type BrandedEventDeclaration<Payload> =
  EventDeclaration<Payload> & DeclarationBrand;

export type BrandedCoreDeclaration = CoreDeclaration & DeclarationBrand;

function brand<TDeclaration>(declaration: TDeclaration): TDeclaration & DeclarationBrand {
  return Object.freeze({
    ...declaration,
    [DECLARATION_SYMBOL]: true,
  });
}

export function defineAction<Input, Output, Ctx = ApplicationContext>(
  declaration: ActionDeclaration<Input, Output, Ctx>,
): BrandedActionDeclaration<Input, Output, Ctx> {
  return brand(declaration);
}

export function defineQuery<Input, Output, Ctx = ApplicationContext>(
  declaration: QueryDeclaration<Input, Output, Ctx>,
): BrandedQueryDeclaration<Input, Output, Ctx> {
  return brand(declaration);
}

export function defineWorkflow<Input, Output, Ctx = ApplicationContext>(
  declaration: WorkflowDeclaration<Input, Output, Ctx>,
): BrandedWorkflowDeclaration<Input, Output, Ctx> {
  return brand(declaration);
}

export function defineEvent<Payload>(
  declaration: EventDeclaration<Payload>,
): BrandedEventDeclaration<Payload> {
  return brand(declaration);
}

export function isCoreDeclaration(value: unknown): value is BrandedCoreDeclaration {
  return Boolean(
    value &&
    typeof value === "object" &&
    DECLARATION_SYMBOL in (value as Record<PropertyKey, unknown>),
  );
}
