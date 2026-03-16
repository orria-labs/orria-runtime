# Orria Runtime

`Orria Runtime` — Bun-first runtime для модульных backend-приложений с typed bus, file-based discovery, codegen и transport adapters.

Проект собран как workspace и сейчас включает рабочее core-ядро, HTTP/CLI/cron adapters, CLI для генерации артефактов и пример приложения в `example`.

## Пакеты

- `@orria-labs/runtime` — core runtime, declarations, discovery, registry, codegen и CLI
- `@orria-labs/runtime-elysia` — HTTP/WebSocket adapter на `elysia`
- `@orria-labs/runtime-citty` — CLI adapter на `citty`
- `@orria-labs/runtime-croner` — cron adapter на `croner`

## Что уже есть

- declarations: `defineAction`, `defineQuery`, `defineWorkflow`, `defineEvent`
- discovery из `src/modules/**/*.action|query|workflow|event.ts`
- registry с проверкой duplicate keys, cross-kind конфликтов и `subscribesTo`
- runtime с typed bus: `ctx.action.*`, `ctx.query.*`, `ctx.workflow.*`, `ctx.event.*`
- schema-aware вызовы и bypass-варианты через `.unsafe(...)`
- `createApplication(...)` с выводом bus-типов напрямую из generated `manifest`
- CLI `orria-runtime` с командами `generate`, `init`, `help`, `version`
- adapter codegen, который автоматически запускается после `orria-runtime generate`
- release flow, собирающий publish-ready `dist` для каждого пакета

## Архитектура

Core строится вокруг четырёх процедурных сущностей:

- `Action` — write-операция
- `Query` — read-операция
- `Event` — immutable контракт факта
- `Workflow` — orchestration-слой

Core не знает про HTTP, CLI, cron, ORM или конкретный transport. Он отвечает за:

- поиск declaration modules
- построение manifest и registry
- исполнение handlers через единый middleware pipeline
- публикацию локальных событий и вызов workflow subscribers
- генерацию typed runtime-артефактов

Transport adapters подключаются поверх core через `createApplication(..., adapters)` и становятся доступны как `app.adapter.<name>`.

## Генерация артефактов

`orria-runtime generate` всегда генерирует core-артефакты:

- `src/generated/core/manifest.ts`
- `src/generated/core/bus.d.ts`
- `src/generated/core/index.ts`

Дальше CLI автоматически находит установленные `@orria-labs/*` adapters и запускает их codegen:

- HTTP: `src/generated/http/app.ts`, `src/generated/http/app-registry.d.ts`, `src/generated/http/plugin-registry.d.ts`
- CLI: `src/generated/cli/command-registry.d.ts`
- Cron: `src/generated/cron/schedule-registry.d.ts`

Это позволяет держать типы transport-слоя синхронными с файловой структурой приложения.

## Быстрый старт по workspace

```bash
bun install
bun run generate:example
bun run typecheck
bun run test
bun run build
```

## Быстрый старт для приложения

```bash
orria-runtime init --dir my-app --name my-app --adapters http,cli,cron
cd my-app
bun install
bun run generate
bun run typecheck
bun run start
```

`init` умеет scaffold для `http`, `cli`, `cron` или `none`.

## Базовый bootstrap

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
```

Если нужен глобальный runtime-контекст для отладки или локального bootstrap, можно передать `setGlobalCtx: true`.

## Bus API

Каждый bus-метод остаётся вызываемой функцией, но дополнительно несёт metadata:

```ts
const createUser = app.ctx.action.user.create;

await createUser({ email: "hello@orria.dev" });

createUser.$key;
createUser.$kind;
createUser.$definition;
createUser.$schema.input;
createUser.$schema.returns;

await createUser.unsafe({ email: "already-validated@example.com" });
```

- обычный вызов использует `input` / `returns` / `payload` schemas
- `.unsafe(...)` пропускает schema parsing и работает с handler-level типами

## Database adapter

Для простого случая можно использовать `createDatabase(...)`, но основной способ — `defineDatabaseAdapter(...)`:

```ts
import { defineDatabaseAdapter } from "@orria-labs/runtime";

export const database = defineDatabaseAdapter({
  default: "primary",
  clients: {
    primary: primaryClient,
    eu: euClient,
  },
  aliases: {
    default: "primary",
  },
  normalizeRegion: (region) => region.trim().toLowerCase(),
});
```

Тогда `ctx.database.client()`, `ctx.database.client("eu")`, `ctx.database.has(...)` и `ctx.database.regions()` типизируются автоматически.

## Workspace

```txt
.
├── docs/
├── example/
├── packages/
│   ├── core/
│   ├── elysia-adapter/
│   ├── citty-adapter/
│   └── croner-adapter/
└── scripts/
```

## Основные команды

```bash
bun run generate:example
bun run typecheck
bun run test
bun run build
bun run release:check
bun run release:dry-run
bun run release:publish
```

## Документация

- `docs/models.md` — текущая модель runtime и adapters
- `docs/contracts.md` — файловые, runtime и codegen-контракты
- `docs/http-adapter.md` — HTTP/WebSocket adapter
- `docs/cli-adapter.md` — CLI adapter
- `docs/cron-adapter.md` — cron adapter
- `docs/release.md` — сборка и публикация пакетов
- `docs/ROADMAP.md` — ближайший roadmap
- `docs/TECH_DEBT.md` — подтверждённый техдолг
- `example/README.md` — разбор demo-приложения

## Текущее ограничение

Подтверждённый remaining gap сейчас один: в core ещё нет durable queue / outbox слоя. Он зафиксирован в `docs/TECH_DEBT.md`.
