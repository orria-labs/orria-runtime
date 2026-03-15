# Orria Runtime

Orria Runtime — это meta-framework для модульных backend-приложений. Сейчас репозиторий оформлен как Bun workspace с transport adapter packages и тестовым приложением в `example`.

## Идентичность проекта

- Brand: `Orria`
- Product: `Orria Runtime`
- npm scope: `@orria-labs`
- CLI: `orria-runtime`

### Пакеты

- `@orria-labs/runtime` — https://www.npmjs.com/package/@orria-labs/runtime
- `@orria-labs/runtime-elysia` — https://www.npmjs.com/package/@orria-labs/runtime-elysia
- `@orria-labs/runtime-citty` — https://www.npmjs.com/package/@orria-labs/runtime-citty
- `@orria-labs/runtime-croner` — https://www.npmjs.com/package/@orria-labs/runtime-croner

## Что уже реализовано

- `@orria-labs/runtime` — ядро runtime с discovery, registry, typed bus, codegen и отдельным CLI-слоем
- `@orria-labs/runtime-elysia` — HTTP transport adapter на Elysia
- `@orria-labs/runtime-citty` — CLI transport adapter на Citty
- `@orria-labs/runtime-croner` — cron transport adapter на Croner
- `example` — тестовый проект, который использует `@orria-labs/runtime`

Framework-артефакты теперь генерируются в `src/generated/core`, чтобы оставаться частью исходного кода и не смешиваться с другими генераторами вроде Prisma (`src/generated/database` и т.д.).

## Модель core

Core строится вокруг 4 процедурных сущностей:

- `Action` — write-операция
- `Query` — read-операция
- `Event` — immutable контракт факта
- `Workflow` — orchestration слой

Core не знает про HTTP, WebSocket, cron, CLI и конкретную базу данных. Он знает только:

- как обнаружить модули
- как построить registry
- как дать приложению typed bus
- как выполнить handler через единый runtime pipeline

## Основные слои

### 1. Discovery

Сканирует файловую структуру приложения и находит:

- `src/modules/**/*.action.ts`
- `src/modules/**/*.query.ts`
- `src/modules/**/*.workflow.ts`
- `src/modules/**/*.event.ts`

### 2. Registry

Нормализует manifest и валидирует контракты:

- уникальность bus key
- cross-kind конфликты имён
- корректность `subscribesTo`

### 3. Runtime

Даёт `ctx.action.*`, `ctx.query.*`, `ctx.workflow.*`, `ctx.event.*` и выполняет handlers через единый pipeline.

### 4. Build-time слой: Codegen

`core` также содержит build-time tooling, которое генерирует:

- `src/generated/core/manifest.ts`
- `src/generated/core/bus.d.ts`
- `src/generated/core/index.ts`

### 5. CLI слой

CLI вынесен в отдельный слой рядом с `codegen`, `discovery`, `registry` и `runtime`. Он зависит от `citty` и вызывает остальные слои как прикладные модули.

## Workspace структура

```txt
.
├── packages/
│   ├── core/
│   ├── elysia-adapter/
│   ├── citty-adapter/
│   └── croner-adapter/
├── example/
├── docs/
└── concept/
```

### `packages/core`

Публичная поверхность пакета:

- `defineAction`, `defineQuery`, `defineWorkflow`, `defineEvent`
- `discoverManifest`, `createRegistry`, `createRuntime`, `createApplication`
- `generateCoreArtifacts`
- `createConfig`, `createDatabase`, `defineDatabaseAdapter`

### Transport adapters

- `packages-labs/runtime-elysia` — `createHttpAdapter`, `defineHttpAdapter`, `defineHandler`, `definePlugin`
- `packages-labs/runtime-citty` — `createCliAdapter`, `defineCommand`
- `packages-labs/runtime-croner` — `createCronAdapter`, `defineCron`, `workflowTarget`

Все transport packages регистрируются через `createApplication(options, adapters)` и доступны как `app.adapter.*`.
При этом bus-типы теперь автоматически выводятся из generated `manifest`, поэтому bootstrap не требует отдельного `createApplication<...>()`.

### `example`

Пример показывает полный цикл:

- объявление модулей в `src/modules`
- генерацию typed bus через CLI
- bootstrap приложения через `createApplication`
- выполнение `action -> event -> workflow`

## Быстрый старт

```bash
bun install
bun run generate:example
bun run typecheck
bun run test
```

При желании можно держать рядом и другие generated targets внутри `src/generated`:

- `src/generated/core`
- `src/generated/prisma`
- `src/generated/database`

## Контракты модулей

Примеры bus keys:

- `src/modules/user/create.action.ts` -> `ctx.action.user.create()`
- `src/modules/user/get.query.ts` -> `ctx.query.user.get()`
- `src/modules/user/registration.workflow.ts` -> `ctx.workflow.user.registration()`
- `src/modules/user/registered.event.ts` -> `ctx.event.user.registered()`

Для базы данных рекомендуется описывать adapter в `src/database.ts` или `src/database/adapter.ts` через `defineDatabaseAdapter`, чтобы `ctx.database.client()` и `ctx.database.client("region")` были типизированы.

Workflow-подписки объявляются прямо в declaration:

```ts
export default defineWorkflow<{ userId: string }, void>({
  kind: "workflow",
  subscribesTo: ["event.user.registered"],
  handle: async ({ ctx, input }) => {
    // orchestration logic
  },
});
```

## Документация

- `docs/models.md` — каноническая модель сущностей и ограничений
- `docs/contracts.md` — файловые и runtime-контракты
- `docs/http-adapter.md` — как работает HTTP adapter и file-based router
- `docs/cli-adapter.md` — как работает CLI adapter и file-based commands
- `docs/cron-adapter.md` — как работает cron adapter и schedules
- `docs/ROADMAP.md` — что уже реализовано и что планируется дальше по приоритетам
- `docs/TECH_DEBT.md` — подтверждённый backlog по техдолгу и ещё не реализованным частям
- `example/README.md` — что именно показывает тестовый проект
- `docs/release.md` — сборка пакетов в `dist`, versioning и публикация в `npm`

## Transport bootstrap

```ts
import { createApplication } from "@orria-labs/runtime";
import { manifest } from "./src/generated/core/index.ts";
import { config } from "./src/config.ts";
import { database } from "./src/database.ts";
import { httpAdapter } from "./src/transport/http/adapter.ts";

const app = await createApplication(
  {
    config,
    database,
    manifest,
  },
  {
    http: httpAdapter,
  },
);

app.adapter.http.listen(3000);
```

Для HTTP обычно удобно собирать `adapter` и typed `defineHandler` вместе через `defineHttpAdapter(...)` в `src/transport/http/adapter.ts`.

## Release

```bash
bun run changeset
bun run release:version
bun run release:dry-run
bun run release:publish
```

Релизные скрипты собирают каждый пакет в минимальный `dist` bundle с `js` и `d.ts`, а публикация идёт из подготовленных `dist/package.json`.

## Статус

Текущая итерация уже покрывает рабочие core-labs/runtime, transport adapters и example-приложение.

Подтверждённые ограничения и ближайший backlog теперь ведутся централизованно в `docs/TECH_DEBT.md`.
