# Модель framework-а

Этот документ — каноническая модель текущей реализации.

## Core procedures

| Сущность | Роль | Кто вызывает | Что может делать |
| --- | --- | --- | --- |
| `Action` | Атомарная write-операция | adapter, workflow | менять состояние, публиковать event |
| `Query` | Read-only операция | adapter, workflow | только читать данные |
| `Event` | Контракт факта | action, workflow | запускать subscriptions |
| `Workflow` | Оркестратор процесса | adapter, event subscription | вызывать action/query, публиковать event |

## Дополнительные core-сущности

| Сущность | Роль |
| --- | --- |
| `Discovery` | находит module declarations по файловой структуре |
| `Registry` | хранит manifest и валидирует связи |
| `Runtime` | исполняет handlers и строит bus |
| `Typed Bus` | даёт `ctx.action.*`, `ctx.query.*`, `ctx.workflow.*`, `ctx.event.*` |
| `Application Context` | единая runtime-точка доступа к bus, config, database, console |
| `Subscription` | связь `event -> workflow`, задаётся через `subscribesTo` |

## Application context

```ts
interface ApplicationContext<TBuses, TDatabase> {
  console: Console;
  config: ConfigStore;
  database: TDatabase;
  action: TBuses["action"];
  query: TBuses["query"];
  workflow: TBuses["workflow"];
  event: TBuses["event"];
}
```

Если `database` описан через `defineDatabaseAdapter`, то тип `ctx.database.client()` сохраняется в runtime-контексте приложения.

## Что core делает сам

- строит manifest из `src/modules`
- генерирует typed bus declaration files
- валидирует subscriptions
- исполняет handlers через middleware pipeline
- публикует локальные события и вызывает workflow subscribers

## Что core специально не делает

- не поднимает HTTP / WS server
- не управляет cron / worker execution
- не навязывает ORM
- не навязывает schema library
- не содержит бизнес-логики приложения

## Adapter layer

Adapters — это входные точки, которые переводят внешний сигнал в bus-вызов.

Примеры:

- HTTP -> `ctx.action.*` / `ctx.query.*`
- WebSocket -> `ctx.workflow.*`
- CLI -> `ctx.action.*` / `ctx.workflow.*`
- Scheduler / Worker -> будут подключены как отдельные adapter packages

## Разрешённые вызовы

| Откуда | Куда можно |
| --- | --- |
| `Action` | `event`, иногда другой `action` |
| `Query` | никуда в бизнес-смысле |
| `Workflow` | `action`, `query`, `event` |
| `Event` | никого не вызывает, только описывает факт |
| `Adapter` | `action`, `query`, `workflow` |

## Текущее правило зависимостей

```txt
Adapters -> Core
Modules -> Core
Core -X-> Adapters
Modules -X-> Adapters
```

## Status note

Сейчас `Subscription` реализован как metadata на `Workflow` через поле `subscribesTo`. Отдельный декларативный subscription-file format может появиться позже, если это даст выигрыш в DX.
