# `@orria-labs/runtime-croner`

Cron transport adapter для `@orria-labs/runtime` поверх `croner`.

- npm: https://www.npmjs.com/package/@orria-labs/runtime-croner

## Что поддерживается

- `createCronAdapter({ rootDir })` для file-based discovery schedules
- `discoverCronSchedules()` / `discoverCronScheduleModules()` для явного discovery
- `defineCron()` для декларации jobs
- `workflowRef()` / `workflowTarget()` для typed workflow targets
- generated typed registry для schedule names
- `app.adapter.cron.start()` / `stop()` / `reload()` / `watch()` / `unwatch()` / `trigger(name)`
- execution observability через `job.lastExecution` и `job.nextRunAt`

## Базовое использование

```ts
const app = await createApplication(options, {
  cron: createCronAdapter({
    rootDir: import.meta.dir,
  }),
});

await app.adapter.cron.start();
```

```ts
export default defineCron<GeneratedBusTypes>({
  name: "billing.retry-failed-payments",
  schedule: "*/5 * * * *",
  target: workflowTarget<GeneratedBusTypes>(
    "workflow.billing.retryFailedPayments",
    () => ({ retryAll: true }),
  ),
  options: {
    timezone: "UTC",
    protect: true,
  },
});
```

## Целевая структура

```txt
src/transport/cron/
├── adapter.ts
└── schedules/
```

## Known limitations

- Cron adapter уже покрывает generated schedule registry и file-watch auto-reload.
- Подтверждённый remaining backlog теперь описан в `../../docs/TECH_DEBT.md#core`.

Общий план развития лежит в `../../docs/ROADMAP.md`.
