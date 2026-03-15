# Example app

Этот проект показывает минимальный рабочий сценарий поверх `@orria-labs/runtime`.

## Что в примере есть

- `user.create` action
- `user.get` query
- `user.registered` event
- `user.registration` workflow, подписанный на event
- discovery-based CLI adapter в `src/transport/cli`
- команды `user create` / alias `user new` и `system info`
- discovery-based HTTP adapter в `src/transport/http`
- HTTP routes `GET /health`, `POST /user/create`, `GET /v1/user-status`
- discovery-based cron adapter в `src/transport/cron`
- schedule `user.replay-registration`, вызывающий workflow через `app.adapter.cron`
- generated typed bus в `src/generated/core`
- `src/transport/http/adapter.ts`, который экспортирует и `httpAdapter`, и typed `defineHandler`
- `src/index.ts`, где `createApplication(...)` выводит типы из `manifest` без явной generic-аннотации

## Команды

```bash
bun run generate
bun run dev
bun run dev:watch
bun run typecheck
bun run test
```

Текущие подтверждённые ограничения framework-а и adapters перечислены в `../docs/TECH_DEBT.md`.

Приоритетный план дальнейшей реализации лежит в `../docs/ROADMAP.md`.

## Поток выполнения

```txt
action.user.create
  -> event.user.registered
  -> workflow.user.registration

app.adapter.cli.invoke(["user", "new", "--email", "cli@example.com"])
  -> action.user.create

app.adapter.http.handle(Request("/user/create"))
  -> action.user.create

app.adapter.cron.trigger("user.replay-registration")
  -> workflow.user.registration
```

`database.ts` использует in-memory client, поэтому пример остаётся полностью self-contained и удобен для тестов.

При этом adapter объявлен через `defineDatabaseAdapter`, так что `ctx.database.client()` имеет точный тип example database client.

## Как запускать

```bash
bun install
bun run generate
bun run dev
```

Для dev-режима с автоматическим перезапуском используйте:

```bash
bun run dev:watch
```
