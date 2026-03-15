import type {
  ApplicationContext,
  BusTypesContract,
  CreateApplicationAdapterContext,
  DatabaseAdapter,
  HandlerInvocationMeta,
} from "@orria-labs/runtime";
import type { CronOptions } from "croner";

export interface CronScheduleRegistry {}

export type RegisteredCronScheduleName = Extract<keyof CronScheduleRegistry, string>;

export type CronKnownScheduleName = [RegisteredCronScheduleName] extends [never]
  ? string
  : RegisteredCronScheduleName;

type ResolveCronScheduleName<TName extends string> = string extends TName
  ? string
  : TName extends CronKnownScheduleName
    ? TName
    : never;

export interface CronAdapterWatchOptions {
  intervalMs?: number;
}

type Awaitable<T> = Promise<T> | T;

type DotPath<TValue extends string, TKey extends string> = TValue extends ""
  ? TKey
  : `${TValue}.${TKey}`;

type CallableLeafPaths<TValue, TPrefix extends string = ""> = TValue extends object
  ? {
      [TKey in keyof TValue & string]: TValue[TKey] extends (...args: never[]) => unknown
        ? DotPath<TPrefix, TKey>
        : TValue[TKey] extends object
          ? CallableLeafPaths<TValue[TKey], DotPath<TPrefix, TKey>>
          : never;
    }[keyof TValue & string]
  : never;

export type WorkflowBusKey<TBuses extends BusTypesContract = BusTypesContract> =
  [CallableLeafPaths<TBuses["workflow"]>] extends [never]
    ? string
    : `workflow.${CallableLeafPaths<TBuses["workflow"]>}`;

export type CronTriggerSource = "manual" | "schedule";

export interface CronExecutionState {
  runId: string;
  source: CronTriggerSource;
  startedAt: Date;
  finishedAt?: Date;
  status: "running" | "succeeded" | "failed";
  error?: unknown;
}

export interface CronExecutionInfo {
  runId: string;
  source: CronTriggerSource;
  startedAt: Date;
}

export interface CronExecutionContext<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  ctx: ApplicationContext<TBuses, TDatabase>;
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>;
  schedule: CronScheduleDefinition<TBuses, TDatabase>;
  execution: CronExecutionInfo;
}

export type CronScheduleInputResolver<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> =
  | unknown
  | ((context: CronExecutionContext<TBuses, TDatabase>) => Awaitable<unknown>);

export interface WorkflowCronTargetRef<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
  TKey extends WorkflowBusKey<TBuses> = WorkflowBusKey<TBuses>,
> {
  kind: "workflow";
  key: TKey;
  input?: CronScheduleInputResolver<TBuses, TDatabase>;
  meta?: HandlerInvocationMeta;
}

export type CronScheduleTarget<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> =
  | WorkflowBusKey<TBuses>
  | WorkflowCronTargetRef<TBuses, TDatabase>
  | ((
      context: CronExecutionContext<TBuses, TDatabase>,
    ) => Awaitable<unknown>);

export interface DiscoverCronSchedulesOptions {
  rootDir: string;
  schedulesDir?: string;
}

export interface ResolvedCronScheduleModule {
  filePath: string;
  schedules: CronScheduleDefinition[];
}

export interface CronScheduleDefinition<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  name: string;
  schedule: string;
  target: CronScheduleTarget<TBuses, TDatabase>;
  input?: CronScheduleInputResolver<TBuses, TDatabase>;
  meta?: HandlerInvocationMeta;
  options?: Pick<CronOptions, "timezone" | "paused" | "protect" | "catch">;
}

export interface CreateCronAdapterOptions<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
> {
  schedules?: Array<CronScheduleDefinition<TBuses, TDatabase>>;
  rootDir?: string;
  schedulesDir?: string;
}

export interface CronJobController {
  name: string;
  schedule: string;
  readonly running: boolean;
  readonly nextRunAt: Date | null;
  readonly lastExecution: CronExecutionState | null;
  stop(): void;
  trigger(source?: CronTriggerSource): Promise<unknown>;
}

export interface CronAdapterInstance {
  kind: "cron";
  readonly started: boolean;
  readonly watching: boolean;
  jobs: Record<string, CronJobController>;
  start(): Promise<void>;
  stop(): void;
  reload(): Promise<void>;
  watch(options?: CronAdapterWatchOptions): Promise<void>;
  unwatch(): void;
  trigger<const TName extends string>(name: ResolveCronScheduleName<TName>): Promise<unknown>;
}
