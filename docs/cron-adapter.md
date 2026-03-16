# Cron adapter

Документ описывает текущее состояние `@orria-labs/runtime-croner`.

## Основные API

- `createCronAdapter(...)`
- `defineCron(...)`
- `workflowRef(...)`
- `workflowTarget(...)`
- `discoverCronSchedules(...)`
- `discoverCronScheduleModules(...)`
- `generateCronScheduleRegistryArtifacts(...)`

## Рекомендуемая структура

```txt
src/transport/cron/
├── adapter.ts
└── schedules/
    └── replay-registration.ts
```

## Adapter

```ts
import path from "node:path";
import { createCronAdapter } from "@orria-labs/runtime-croner";

export const cronAdapter = createCronAdapter({
  rootDir: path.resolve(import.meta.dir, "../../.."),
});
```

## Schedule

```ts
import { defineCron, workflowTarget } from "@orria-labs/runtime-croner";

export default defineCron<GeneratedBusTypes>({
  name: "user.replay-registration",
  schedule: "0 * * * *",
  target: workflowTarget<GeneratedBusTypes>(
    "workflow.user.registration",
    () => ({
      userId: "scheduled_user",
      email: "cron@example.com",
    }),
  ),
  options: {
    timezone: "UTC",
    paused: true,
  },
});
```

## Target-формы

`target` может быть:

- функцией `(executionContext) => ...`
- string workflow key
- `workflowRef(...)`
- `workflowTarget(...)`

Если target ссылается на workflow, adapter проверяет существование workflow key через core registry.

## Runtime API

После подключения adapter доступны:

- `app.adapter.cron.start()`
- `app.adapter.cron.stop()`
- `app.adapter.cron.reload()`
- `app.adapter.cron.watch()`
- `app.adapter.cron.unwatch()`
- `app.adapter.cron.trigger(name)`
- `app.adapter.cron.jobs`

## Job controller

Каждый `jobs[name]` содержит:

- `name`
- `schedule`
- `running`
- `nextRunAt`
- `lastExecution`
- `stop()`
- `trigger(source?)`

## Execution metadata

Во время запуска adapter хранит execution state:

```ts
{
  runId,
  source,
  startedAt,
  finishedAt,
  status,
  error,
}
```

А при вызове workflow в `meta` добавляются:

- `source: "cron:<schedule-name>"`
- `cronName`
- `cronSource`
- `cronRunId`
- `cronTriggeredAt`

## Codegen

После `orria-runtime generate` adapter пишет `src/generated/cron/schedule-registry.d.ts`, поэтому literal schedule names автоматически типизируются.

## Dev-flow

`watch()` отслеживает tree schedules и умеет безопасно пересобрать runtime jobs. После рефакторинга reload/watch path стал единым, а adapter code стал короче и понятнее для доработки.
