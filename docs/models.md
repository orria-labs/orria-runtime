# Модель проекта

Этот документ описывает текущую модель `Orria Runtime` по состоянию кода в репозитории.

## Core-сущности

| Сущность | Назначение | Кто вызывает | Что возвращает |
| --- | --- | --- | --- |
| `Action` | write-операция | adapter, workflow, другой код приложения | результат бизнес-операции |
| `Query` | read-операция | adapter, workflow, другой код приложения | данные без побочных эффектов |
| `Event` | контракт факта | action, workflow | `Promise<void>` |
| `Workflow` | orchestration | adapter, event subscription, cron | результат orchestration-шага |

## Вспомогательные сущности

| Слой | Роль |
| --- | --- |
| `Discovery` | находит declarations по файловой структуре |
| `Manifest` | serializable описание найденных declarations |
| `Registry` | нормализует manifest и хранит lookup-структуры |
| `Runtime` | исполняет handlers и строит typed bus |
| `ApplicationContext` | единый доступ к `console`, `config`, `database` и bus |
| `Transport adapter` | переводит внешний сигнал в вызов runtime |
| `Adapter codegen` | генерирует transport-specific typed артефакты |

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

Если `database` создан через `defineDatabaseAdapter(...)`, то `ctx.database.client()` и доступ к регионам остаются типизированными.

## Runtime-модель

### Safe path

- `input` / `payload` проходят через schema parsing
- `returns` валидируется после `handle(...)`
- middleware исполняются единым pipeline
- `event` публикуется в `eventTransport`
- локальные workflow subscribers вызываются автоматически

### Unsafe path

- `.unsafe(...)` пропускает schema parsing
- типы при этом остаются привязаны к handler-level контракту
- подходит для trusted-path участков, где данные уже провалидированы заранее

## Subscription-модель

Подписка задаётся в `workflow` через `subscribesTo: ["event.some.key"]`.

Во время построения registry runtime:

- проверяет существование event keys
- строит карту `event -> workflow subscribers`
- переиспользует её во время publish без повторного поиска по registry

## Adapter-модель

Adapters не меняют core-контракт. Они получают:

- `ctx`
- `registry`
- `runtime`
- `manifest`
- `console`

и реализуют внешний интерфейс, например:

- HTTP: `handle()`, `listen()`, `reload()`, `watch()`
- CLI: `run()`, `invoke()`, `renderUsage()`
- Cron: `start()`, `trigger()`, `jobs[]`

## Codegen-модель

Codegen делится на два уровня:

### 1. Core codegen

Пишет:

- `src/generated/core/manifest.ts`
- `src/generated/core/bus.d.ts`
- `src/generated/core/index.ts`

### 2. Adapter codegen

Запускается автоматически после core codegen и зависит от установленных пакетов:

- HTTP adapter — discovered app и plugin registry
- CLI adapter — command registry и aliases
- Cron adapter — schedule registry

## Почему модель удобна

- бизнес-логика живёт в modules, а не в transport-слое
- adapters можно подключать и отключать независимо
- типы выводятся из generated manifest, а не дублируются вручную
- file-based discovery и codegen снижают объём ручной wiring-логики

## Текущее ограничение

В текущей модели нет durable queue / outbox слоя. Все остальные основные части runtime-контура уже реализованы и покрыты тестами.
