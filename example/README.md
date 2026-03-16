# Example app

`example` показывает рабочую сборку приложения поверх всех текущих слоёв `Orria Runtime`.

## Что демонстрирует пример

- core declarations в `src/modules`
- generated manifest и typed bus в `src/generated/core`
- bootstrap через `createApplication(...)` без явных generic-параметров
- typed database adapter через `defineDatabaseAdapter(...)`
- file-based HTTP adapter
- file-based CLI adapter
- file-based cron adapter
- локальную цепочку `action -> event -> workflow`

## Содержимое примера

- `src/modules/user/create.action.ts` — создаёт пользователя и публикует `event.user.registered`
- `src/modules/user/get.query.ts` — читает пользователя из in-memory БД
- `src/modules/user/registered.event.ts` — event contract
- `src/modules/user/registration.workflow.ts` — подписка на `event.user.registered`
- `src/transport/http/router/*.ts` — HTTP routes
- `src/transport/cli/command/*.ts` — CLI commands
- `src/transport/cron/schedules/*.ts` — cron schedules
- `src/generated/*` — результат `orria-runtime generate`

## Команды

```bash
bun install
bun run generate
bun run dev
bun run dev:watch
bun run typecheck
bun run test
```

## Что происходит при запуске `bun run dev`

Если запускать без аргументов, `example/src/index.ts`:

- создаёт приложение через `createApplication(...)`
- вызывает `app.ctx.action.user.create(...)`
- вручную триггерит cron job `user.replay-registration`
- поднимает HTTP server на `3000`

Если передать CLI-аргументы, управление уходит в `app.adapter.cli.run(rawArgs)`.

## Поток выполнения

```txt
ctx.action.user.create(...)
  -> ctx.event.user.registered(...)
  -> workflow.user.registration

app.adapter.http.handle(Request("POST /user/create"))
  -> ctx.action.user.create(...)

app.adapter.cli.invoke(["user", "new", "--email", "cli@example.com"])
  -> ctx.action.user.create(...)

app.adapter.cron.trigger("user.replay-registration")
  -> workflow.user.registration
```

## Полезные файлы

- `example/src/index.ts` — bootstrap
- `example/src/database.ts` — typed database adapter
- `example/src/transport/http/adapter.ts` — runtime HTTP adapter
- `example/src/transport/http/contract.ts` — route contract factory
- `example/src/generated/http/app.ts` — generated typed Elysia app

## Для чего полезен пример

- как эталон file-based структуры проекта
- как smoke-test всех transport adapters
- как reference для generated артефактов
- как минимальная площадка для экспериментов с runtime API

Актуальные детали по архитектуре и ограничениям — в `../docs/*`.
