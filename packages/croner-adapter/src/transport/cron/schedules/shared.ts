import type { CronScheduleDefinition } from "../types.ts";

const CRON_SCHEDULE_SYMBOL = Symbol.for("orria.cron.schedule");

type CronScheduleBrand = {
  readonly [CRON_SCHEDULE_SYMBOL]: true;
};

export type BrandedCronScheduleDefinition = CronScheduleBrand & {
  name: string;
  schedule: string;
  target: unknown;
};

export function brandCronSchedule<TSchedule extends object>(
  schedule: TSchedule,
): TSchedule & CronScheduleBrand {
  return Object.freeze({
    ...schedule,
    [CRON_SCHEDULE_SYMBOL]: true,
  });
}

export function isCronScheduleDefinition(value: unknown): value is CronScheduleDefinition {
  return Boolean(
    value &&
    typeof value === "object" &&
    "name" in (value as Record<PropertyKey, unknown>) &&
    "schedule" in (value as Record<PropertyKey, unknown>) &&
    "target" in (value as Record<PropertyKey, unknown>),
  );
}

export function isBrandedCronScheduleDefinition(
  value: unknown,
): value is BrandedCronScheduleDefinition {
  return Boolean(
    value &&
    typeof value === "object" &&
    CRON_SCHEDULE_SYMBOL in (value as Record<PropertyKey, unknown>),
  );
}
