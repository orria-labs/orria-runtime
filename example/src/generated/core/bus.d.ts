import type {
  BusTypesContract,
  DeclarationInput,
  DeclarationOutput,
  DeclarationPayload,
  HandlerInvocationMeta,
} from "@orria-labs/runtime";
type actionUserCreate = typeof import("../../modules/user/create.action.ts").default;
type eventUserRegistered = typeof import("../../modules/user/registered.event.ts").default;
type queryUserGet = typeof import("../../modules/user/get.query.ts").default;
type workflowUserRegistration = typeof import("../../modules/user/registration.workflow.ts").default;

export interface ActionBusShape {
  user: {
    create: (input: DeclarationInput<actionUserCreate>, meta?: HandlerInvocationMeta) => Promise<DeclarationOutput<actionUserCreate>>;
  };
}

export interface QueryBusShape {
  user: {
    get: (input: DeclarationInput<queryUserGet>, meta?: HandlerInvocationMeta) => Promise<DeclarationOutput<queryUserGet>>;
  };
}

export interface WorkflowBusShape {
  user: {
    registration: (input: DeclarationInput<workflowUserRegistration>, meta?: HandlerInvocationMeta) => Promise<DeclarationOutput<workflowUserRegistration>>;
  };
}

export interface EventBusShape {
  user: {
    registered: (payload: DeclarationPayload<eventUserRegistered>, meta?: HandlerInvocationMeta) => Promise<void>;
  };
}


export interface GeneratedBusTypes extends BusTypesContract {
  action: ActionBusShape;
  query: QueryBusShape;
  workflow: WorkflowBusShape;
  event: EventBusShape;
}
