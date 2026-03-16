# `@orria-labs/runtime-croner`

Cron adapter для `@orria-labs/runtime` поверх `croner`.

- npm: `https://www.npmjs.com/package/@orria-labs/runtime-croner`

## Что поддерживается

- file-based discovery schedules из `src/transport/cron/schedules`
- `defineCron(...)`
- workflow targets через string key, `workflowRef(...)` и `workflowTarget(...)`
- `start()`, `stop()`, `reload()`, `watch()`, `unwatch()`
- `trigger(name)` с типизацией discovered schedule names
- execution metadata и состояние последних запусков

## Базовый adapter

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

## Target-варианты

`target` может быть:

- функцией `(executionContext) => ...`
- string workflow key, например `"workflow.user.registration"`
- `workflowRef(...)`
- `workflowTarget(...)`

В workflow adapter автоматически прокидывает meta:

- `source: "cron:<schedule-name>"`
- `cronName`
- `cronSource`
- `cronRunId`
- `cronTriggeredAt`

## Runtime API

```ts
await app.adapter.cron.start();
await app.adapter.cron.trigger("user.replay-registration");

app.adapter.cron.jobs["user.replay-registration"].lastExecution;
```

Каждый `job controller` даёт:

- `name`
- `schedule`
- `running`
- `nextRunAt`
- `lastExecution`
- `stop()`
- `trigger(source?)`

## Codegen

После `orria-runtime generate` adapter пишет `src/generated/cron/schedule-registry.d.ts`, поэтому `trigger(name)` и связанные literal names получают типизацию.

## Dev-режим

Adapter поддерживает `reload()`, `watch()` и `unwatch()`. При reload пересобирается список schedules, валидируются workflow targets и при необходимости заново поднимаются runtime jobs.

Подробнее — `../../docs/cron-adapter.md`.
