import {
  createPollingFileWatcher,
  defineTransportAdapter,
  isOrriaTempModulePath,
  type BusTypesContract,
  type CreateApplicationAdapterContext,
  type DatabaseAdapter,
} from "@orria-labs/runtime";
import path from "node:path";
import type { Cron, CronOptions } from "croner";

import { generateCronScheduleRegistryArtifacts } from "./codegen/generate-schedule-registry.ts";
import {
  discoverCronSchedules,
  validateCronSchedules,
} from "./discovery.ts";
import type {
  CronAdapterInstance,
  CronAdapterWatchOptions,
  CronExecutionContext,
  CronExecutionInfo,
  CronExecutionState,
  CronJobController,
  CronScheduleDefinition,
  CronTriggerSource,
  CreateCronAdapterOptions,
  WorkflowCronTargetRef,
} from "./types.ts";

const DEFAULT_SCHEDULES_DIR = path.join("src", "transport", "cron", "schedules");
const SUPPORTED_WATCH_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs"]);

type CronerRuntimeJob = Pick<
  Cron,
  "isRunning" | "nextRun" | "pause" | "resume" | "stop" | "trigger"
>;

type CronerConstructor = new (
  pattern: string,
  options: CronOptions,
  handler: () => Promise<unknown> | unknown,
) => CronerRuntimeJob;

type CronJobState = {
  lastExecution: CronExecutionState | null;
};

export function createCronAdapter<
  TBuses extends BusTypesContract = BusTypesContract,
  TDatabase extends DatabaseAdapter = DatabaseAdapter,
>(
  options: CreateCronAdapterOptions<TBuses, TDatabase> = {},
) {
  return defineTransportAdapter<CronAdapterInstance, TBuses, TDatabase>(
    async (adapterContext) => {
      let schedules = await resolveSchedules(options);
      validateResolvedSchedules(schedules, adapterContext);

      let started = false;
      let runtimeJobs: Record<string, CronerRuntimeJob> = {};
      let jobStates = createJobStates(schedules);
      let jobs = createJobControllers(
        schedules,
        adapterContext,
        () => runtimeJobs,
        () => jobStates,
      );

      const stopRuntimeJobs = () => {
        for (const runtimeJob of Object.values(runtimeJobs)) {
          runtimeJob.stop();
        }

        runtimeJobs = {};
        started = false;
      };

      const syncSchedules = async () => {
        schedules = await resolveSchedules(options);
        validateResolvedSchedules(schedules, adapterContext);
        jobStates = createJobStates(schedules);
        jobs = createJobControllers(
          schedules,
          adapterContext,
          () => runtimeJobs,
          () => jobStates,
        );
      };

      const syncArtifacts = async () => {
        if (!options.rootDir) {
          return;
        }

        await generateCronScheduleRegistryArtifacts({
          rootDir: options.rootDir,
          schedulesDir: options.schedulesDir,
        });
      };

      const reloadRuntime = async () => {
        const wasStarted = started;

        stopRuntimeJobs();
        await syncSchedules();

        if (wasStarted) {
          await startRuntimeJobs();
        }
      };

      let watcher = createCronWatcher(
        options,
        adapterContext,
        async () => {
          await reloadRuntime();
          await syncArtifacts();
        },
      );

      const startRuntimeJobs = async () => {
        const Croner = await loadCroner();

        stopRuntimeJobs();

        runtimeJobs = Object.fromEntries(
          schedules.map((schedule) => [
            schedule.name,
            new Croner(
              schedule.schedule,
              {
                name: schedule.name,
                timezone: schedule.options?.timezone,
                paused: schedule.options?.paused,
                protect: schedule.options?.protect,
                catch: schedule.options?.catch,
              },
              () => jobs[schedule.name]!.trigger("schedule"),
            ),
          ]),
        );

        started = true;
      };

      return {
        kind: "cron",
        get started() {
          return started;
        },
        get watching() {
          return watcher.active;
        },
        get jobs() {
          return jobs;
        },
        async start() {
          await syncSchedules();
          await startRuntimeJobs();
        },
        stop() {
          stopRuntimeJobs();
        },
        reload() {
          return reloadRuntime();
        },
        async watch(watchOptions) {
          watcher = createCronWatcher(
            options,
            adapterContext,
            async () => {
              await reloadRuntime();
              await syncArtifacts();
            },
            watcher,
            watchOptions,
          );
          await watcher.start();
        },
        unwatch() {
          watcher.stop();
        },
        trigger(name) {
          const job = jobs[name];

          if (!job) {
            throw new Error(`Cron job "${name}" is not registered`);
          }

          return job.trigger("manual");
        },
      };
    },
  );
}

function createCronWatcher<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  options: CreateCronAdapterOptions<TBuses, TDatabase>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  reload: () => Promise<void>,
  existingWatcher = createPollingFileWatcher({ roots: [], onChange: () => undefined }),
  watchOptions?: CronAdapterWatchOptions,
) {
  existingWatcher.stop();

  if (!options.rootDir) {
    return existingWatcher;
  }

  return createPollingFileWatcher({
    roots: [path.resolve(options.rootDir, options.schedulesDir ?? DEFAULT_SCHEDULES_DIR)],
    intervalMs: watchOptions?.intervalMs,
    includeFile: isCronSourceFile,
    onChange: reload,
    onError: (error) => {
      adapterContext.console.error("[orria:cron] watch reload failed", error);
    },
  });
}

function isCronSourceFile(filePath: string): boolean {
  const extension = path.extname(filePath);
  return (
    SUPPORTED_WATCH_EXTENSIONS.has(extension) &&
    !filePath.endsWith(".d.ts") &&
    !isOrriaTempModulePath(filePath)
  );
}

function createJobStates<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  schedules: Array<CronScheduleDefinition<TBuses, TDatabase>>,
): Record<string, CronJobState> {
  return Object.fromEntries(
    schedules.map((schedule) => [
      schedule.name,
      {
        lastExecution: null,
      },
    ]),
  );
}

function createJobControllers<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  schedules: Array<CronScheduleDefinition<TBuses, TDatabase>>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  getRuntimeJobs: () => Record<string, CronerRuntimeJob>,
  getJobStates: () => Record<string, CronJobState>,
): Record<string, CronJobController> {
  return Object.fromEntries(
    schedules.map((schedule) => [
      schedule.name,
      createJobController(schedule, adapterContext, getRuntimeJobs, getJobStates),
    ]),
  );
}

function createJobController<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  schedule: CronScheduleDefinition<TBuses, TDatabase>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  getRuntimeJobs: () => Record<string, CronerRuntimeJob>,
  getJobStates: () => Record<string, CronJobState>,
): CronJobController {
  const getRuntimeJob = () => getRuntimeJobs()[schedule.name];
  const getJobState = () => getJobStates()[schedule.name]!;

  return {
    name: schedule.name,
    schedule: schedule.schedule,
    get running() {
      return getRuntimeJob()?.isRunning() ?? false;
    },
    get nextRunAt() {
      return getRuntimeJob()?.nextRun() ?? null;
    },
    get lastExecution() {
      return getJobState().lastExecution;
    },
    stop() {
      getRuntimeJob()?.stop();
    },
    trigger(source = "manual") {
      return runSchedule(schedule, adapterContext, source, getJobState());
    },
  };
}

async function runSchedule<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  schedule: CronScheduleDefinition<TBuses, TDatabase>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
  source: CronTriggerSource,
  jobState: CronJobState,
): Promise<unknown> {
  const execution = createExecutionInfo(source);
  const executionContext: CronExecutionContext<TBuses, TDatabase> = {
    ctx: adapterContext.ctx,
    adapterContext,
    schedule,
    execution,
  };

  jobState.lastExecution = {
    ...execution,
    status: "running",
  };

  try {
    const result = await resolveScheduleTarget(schedule, executionContext);

    jobState.lastExecution = {
      ...execution,
      status: "succeeded",
      finishedAt: new Date(),
    };

    return result;
  } catch (error) {
    jobState.lastExecution = {
      ...execution,
      status: "failed",
      error,
      finishedAt: new Date(),
    };

    throw error;
  }
}

async function resolveScheduleTarget<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  schedule: CronScheduleDefinition<TBuses, TDatabase>,
  executionContext: CronExecutionContext<TBuses, TDatabase>,
): Promise<unknown> {
  if (typeof schedule.target === "function") {
    return schedule.target(executionContext);
  }

  if (typeof schedule.target === "string") {
    const input = await resolveInput(schedule.input, executionContext);

    return executionContext.adapterContext.runtime.invoke(
      "workflow",
      schedule.target,
      input,
      {
        source: `cron:${schedule.name}`,
        cronName: schedule.name,
        cronSource: executionContext.execution.source,
        cronRunId: executionContext.execution.runId,
        cronTriggeredAt: executionContext.execution.startedAt.toISOString(),
        ...schedule.meta,
      },
    );
  }

  return invokeWorkflowTargetRef(schedule.target, executionContext);
}

async function invokeWorkflowTargetRef<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  target: WorkflowCronTargetRef<TBuses, TDatabase>,
  executionContext: CronExecutionContext<TBuses, TDatabase>,
): Promise<unknown> {
  const input = await resolveInput(target.input, executionContext);

  return executionContext.adapterContext.runtime.invoke(
    "workflow",
    target.key,
    input,
    {
      source: `cron:${executionContext.schedule.name}`,
      cronName: executionContext.schedule.name,
      cronSource: executionContext.execution.source,
      cronRunId: executionContext.execution.runId,
      cronTriggeredAt: executionContext.execution.startedAt.toISOString(),
      ...executionContext.schedule.meta,
      ...target.meta,
    },
  );
}

async function resolveInput<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  input:
    | CronScheduleDefinition<TBuses, TDatabase>["input"]
    | WorkflowCronTargetRef<TBuses, TDatabase>["input"],
  executionContext: CronExecutionContext<TBuses, TDatabase>,
): Promise<unknown> {
  if (typeof input === "function") {
    return input(executionContext);
  }

  return input;
}

async function resolveSchedules<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  options: CreateCronAdapterOptions<TBuses, TDatabase>,
): Promise<Array<CronScheduleDefinition<TBuses, TDatabase>>> {
  const discovered = options.rootDir
    ? await discoverCronSchedules({
        rootDir: options.rootDir,
        schedulesDir: options.schedulesDir,
      })
    : [];

  const schedules: Array<CronScheduleDefinition<TBuses, TDatabase>> = [];

  schedules.push(
    ...(discovered as Array<CronScheduleDefinition<TBuses, TDatabase>>),
  );

  if (options.schedules) {
    schedules.push(...options.schedules);
  }

  validateCronSchedules(schedules);

  return schedules;
}

function validateResolvedSchedules<
  TBuses extends BusTypesContract,
  TDatabase extends DatabaseAdapter,
>(
  schedules: Array<CronScheduleDefinition<TBuses, TDatabase>>,
  adapterContext: CreateApplicationAdapterContext<TBuses, TDatabase>,
): void {
  for (const schedule of schedules) {
    if (typeof schedule.target === "function") {
      continue;
    }

    const workflowKey =
      typeof schedule.target === "string"
        ? schedule.target
        : schedule.target.key;
    const entry = adapterContext.registry.byKey.get(workflowKey);

    if (!entry || entry.kind !== "workflow") {
      throw new Error(
        `Cron schedule "${schedule.name}" targets unknown workflow "${workflowKey}"`,
      );
    }
  }
}

function createExecutionInfo(source: CronTriggerSource): CronExecutionInfo {
  return {
    runId: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source,
    startedAt: new Date(),
  };
}

async function loadCroner(): Promise<CronerConstructor> {
  const imported = await import("croner");
  const moduleExports = imported as Record<string, unknown>;
  const Croner = (moduleExports.Cron ?? moduleExports.default) as CronerConstructor | undefined;

  if (!Croner) {
    throw new Error("Unable to resolve Croner constructor");
  }

  return Croner;
}
