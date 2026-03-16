import type {
  EventBusMethod,
  ExecutableBusMethod,
  BusTypesContract,
} from "@orria-labs/runtime";
type actionUserCreate = typeof import("../../modules/user/create.action.ts").default;
type eventUserRegistered = typeof import("../../modules/user/registered.event.ts").default;
type queryUserGet = typeof import("../../modules/user/get.query.ts").default;
type workflowUserRegistration = typeof import("../../modules/user/registration.workflow.ts").default;

export interface ActionBusShape {
  user: {
    create: ExecutableBusMethod<actionUserCreate>;
  };
}

export interface QueryBusShape {
  user: {
    get: ExecutableBusMethod<queryUserGet>;
  };
}

export interface WorkflowBusShape {
  user: {
    registration: ExecutableBusMethod<workflowUserRegistration>;
  };
}

export interface EventBusShape {
  user: {
    registered: EventBusMethod<eventUserRegistered>;
  };
}


export interface GeneratedBusTypes extends BusTypesContract {
  action: ActionBusShape;
  query: QueryBusShape;
  workflow: WorkflowBusShape;
  event: EventBusShape;
}
