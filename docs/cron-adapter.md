# Cron adapter (`@orria-labs/runtime-croner`)

`@orria-labs/runtime-croner` — transport adapter для cron/scheduler execution поверх `croner`.

Он нужен, чтобы:

- собирать schedules из файловой структуры;
- запускать workflows по cron-правилам;
- вручную триггерить jobs в тестах и maintenance-сценариях;
- иметь lifecycle `start()` / `stop()` / `reload()` и execution metadata.

## Когда использовать

Подходит для:

- периодических reconciliation jobs;
- retries / backfills / cleanup tasks;
- scheduled workflows;
- dev/test-trigger без поднятия внешнего scheduler.

## Bootstrap

```ts
import { createApplication } from "@orria-labs/runtime";
import { createCronAdapter } from "@orria-labs/runtime-croner";

const app = await createApplication(options, {
  cron: createCronAdapter({
    rootDir: import.meta.dir,
  }),
});

await app.adapter.cron.start();
```

## Что возвращает `app.adapter.cron`

```ts
app.adapter.cron.started
app.adapter.cron.jobs
app.adapter.cron.start()
app.adapter.cron.stop()
app.adapter.cron.reload()
app.adapter.cron.trigger(name)
app.adapter.cron.watch()
app.adapter.cron.unwatch()
```

- `started` — запущен ли scheduler сейчас.
- `jobs` — registry jobs controllers.
- `start()` — discover + bootstrapping Croner jobs.
- `stop()` — остановка всех runtime jobs.
- `reload()` — повторный discovery schedules и пересборка scheduler.
- `trigger(name)` — ручной запуск job по имени, типизированный через generated schedule registry.

## `createCronAdapter(options)`

```ts
createCronAdapter({
  rootDir,
  schedulesDir,
  schedules,
})
```

### Поля `options`

- `rootDir` — корень приложения для file-based discovery.
- `schedulesDir` — кастомная директория schedules; по умолчанию `src/transport/cron/schedules`.
- `schedules` — schedules, добавленные вручную поверх discovered schedules.

## File-based discovery

По умолчанию adapter сканирует:

```txt
src/transport/cron/schedules/**/*.ts
```

Каждый файл должен экспортировать `defineCron(...)`.

Adapter валидирует:

- schedule name не пустой;
- cron expression не пустой;
- имена schedules уникальны;
- string/ref targets указывают на существующие workflows в runtime registry.

## `defineCron()`

```ts
import { defineCron, workflowTarget } from "@orria-labs/runtime-croner";

export default defineCron({
  name: "billing.retry-failed-payments",
  schedule: "*/5 * * * *",
  target: workflowTarget("workflow.billing.retryFailedPayments"),
  options: {
    timezone: "UTC",
    protect: true,
  },
});
```

### Поля schedule

- `name` — уникальное имя job.
- `schedule` — cron expression.
- `target` — что исполнять.
- `input` — input для workflow target, если target задан строкой.
- `meta` — дополнительные runtime meta при вызове workflow.
- `options` — subset опций `croner`.

### Поля `options`

Поддерживаются:

- `timezone` — timezone для расписания.
- `paused` — создать job в paused state.
- `protect` — не запускать повторно job, пока предыдущий run не завершён.
- `catch` — обработка ошибок Croner.

## Что можно передать в `target`

Есть три варианта.

### 1. Строка workflow key

```ts
defineCron({
  name: "user.sync",
  schedule: "0 * * * *",
  target: "workflow.user.sync",
  input: { full: true },
});
```

### 2. `workflowRef()` / `workflowTarget()`

```ts
defineCron({
  name: "user.sync",
  schedule: "0 * * * *",
  target: workflowTarget("workflow.user.sync", () => ({ full: true })),
});
```

Это preferred способ, если хочется явный typed bridge к workflow.

### 3. Функция

```ts
defineCron({
  name: "custom.job",
  schedule: "*/10 * * * *",
  target: async ({ ctx, adapterContext, execution, schedule }) => {
    await ctx.action.cleanup.run({ source: execution.source });
  },
});
```

## Контекст выполнения

Function target и input resolver получают:

```ts
{
  ctx,
  adapterContext,
  schedule,
  execution,
}
```

### Значение полей

- `ctx` — application context.
- `adapterContext` — `ctx`, `registry`, `runtime`, `manifest`, `console`.
- `schedule` — текущая schedule declaration.
- `execution` — информация о конкретном run.

### Поля `execution`

- `runId` — уникальный id запуска.
- `source` — `manual` или `schedule`.
- `startedAt` — время старта.

## `jobs[name]`

Каждый job controller содержит:

```ts
job.name
job.schedule
job.running
job.nextRunAt
job.lastExecution
job.stop()
job.trigger(source?)
```

### Что означает каждое поле

- `name` — имя schedule.
- `schedule` — cron expression.
- `running` — запущен ли runtime job сейчас.
- `nextRunAt` — следующая плановая дата запуска.
- `lastExecution` — metadata о последнем run.
- `stop()` — остановить конкретный job.
- `trigger(source?)` — вручную запустить job controller.

## `lastExecution`

После выполнения job adapter сохраняет execution state:

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

### Поля execution state

- `runId` — id запуска.
- `source` — `manual` или `schedule`.
- `startedAt` — когда run начался.
- `finishedAt` — когда run завершился.
- `status` — `running`, `succeeded` или `failed`.
- `error` — ошибка, если run упал.

## Какой `meta` попадает в workflow

Когда cron target вызывает workflow через runtime, adapter автоматически добавляет meta:

- `source: "cron:<schedule-name>"`
- `cronName`
- `cronSource`
- `cronRunId`
- `cronTriggeredAt`

И затем мерджит:

- `schedule.meta`
- `target.meta` для `workflowTarget(...)`

## Рекомендуемая структура

```txt
src/
└── transport/
    └── cron/
        ├── adapter.ts
        └── schedules/
            ├── billing/
            │   └── retry-failed-payments.ts
            └── user/
                └── replay-registration.ts
```

## Практический паттерн

- schedule только описывает, *когда* и *что* запускать;
- основная бизнес-логика остаётся в `workflow`;
- ручной `trigger()` полезен для тестов и maintenance;
- `reload()` удобен в dev-labs/runtime orchestration сценариях.

## Known limitations

- schedules поддерживают ручной `reload()` и file-watch auto-reload через `watch()/unwatch()`;
- `orria-runtime generate` автоматически создаёт `src/generated/cron/schedule-registry.d.ts`, поэтому `trigger(name)` типизируется для literal schedule names;
- подтверждённый backlog ведётся в `docs/TECH_DEBT.md#cron-adapter`.
