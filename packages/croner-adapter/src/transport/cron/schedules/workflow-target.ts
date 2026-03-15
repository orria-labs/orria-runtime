import type {
  BusTypesContract,
  DatabaseAdapter,
  HandlerInvocationMeta,
} from "@orria-labs/runtime";

import type {
  CronScheduleInputResolver,
  WorkflowBusKey,
  WorkflowCronTargetRef,
} from "../types.ts";

export function workflowRef<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TKey extends WorkflowBusKey<TBuses> = WorkflowBusKey<TBuses>,
>(
  key: TKey,
  input?:
    | CronScheduleInputResolver<TBuses, TDatabase>,
  meta?: HandlerInvocationMeta,
): WorkflowCronTargetRef<TBuses, TDatabase, TKey> {
  return {
    kind: "workflow",
    key,
    input,
    meta,
  };
}

export const workflowTarget = workflowRef;
