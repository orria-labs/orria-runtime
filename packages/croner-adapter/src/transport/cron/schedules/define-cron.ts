import type {
  BusTypesContract,
  DatabaseAdapter,
} from "@orria-labs/runtime";

import type { CronScheduleDefinition } from "../types.ts";
import { brandCronSchedule } from "./shared.ts";

export function defineCron<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>(
  schedule: CronScheduleDefinition<TBuses, TDatabase>,
): CronScheduleDefinition<TBuses, TDatabase> {
  return brandCronSchedule(schedule) as CronScheduleDefinition<TBuses, TDatabase>;
}
