# `@orria-labs/runtime`

Core runtime для `Orria Runtime`: declarations, discovery, registry, runtime, codegen, bootstrap helpers и CLI `orria-runtime`.

- npm: `https://www.npmjs.com/package/@orria-labs/runtime`

## Что экспортирует пакет

- declarations: `defineAction`, `defineQuery`, `defineWorkflow`, `defineEvent`
- bootstrap: `createApplication`, `defineTransportAdapter`
- discovery/registry/runtime: `discoverManifest`, `createRegistry`, `getRegistryEntry`, `createRuntime`
- codegen: `generateCoreArtifacts`
- helpers: `createConfig`, `createDatabase`, `defineDatabaseAdapter`
- internals для adapters: `importFreshModule`, `isOrriaTempModulePath`, `createPollingFileWatcher`

## Основная модель

Пакет строит приложение вокруг typed bus:

- `ctx.action.*`
- `ctx.query.*`
- `ctx.workflow.*`
- `ctx.event.*`

Bus-тип выводится из generated `manifest`, поэтому bootstrap обычно не требует явного `createApplication<...>()`.

## Bootstrap

```ts
import { createApplication } from "@orria-labs/runtime";
import { config } from "./config.ts";
import { database } from "./database.ts";
import { manifest } from "./generated/core/index.ts";

const app = await createApplication({
  config,
  database,
  manifest,
  setGlobalCtx: true,
});
```

`createApplication(...)` создаёт:

- `app.ctx`
- `app.registry`
- `app.runtime`
- `app.adapter`

## Runtime pipeline

- input/payload schema парсится перед вызовом handler
- output schema парсится после handler
- global middleware и declaration middleware исполняются единым pipeline
- `event` публикуется в `eventTransport` и локально fan-out’ится в подписанные `workflow`

По умолчанию используется `LocalEventTransport`, но можно передать свой `eventTransport` в `createApplication(...)`.

## Bus metadata и `unsafe`

```ts
const method = app.ctx.action.user.create;

await method({ email: "safe@example.com" });
await method.unsafe({ email: "already-validated@example.com" });

method.$key;
method.$kind;
method.$definition;
method.$schema.input;
method.$schema.returns;
```

- обычный вызов использует runtime schema parsing
- `.unsafe(...)` пропускает schema parsing и работает с handler-level типами

## Discovery и codegen

`discoverManifest(...)` ищет declarations по шаблонам:

- `src/modules/**/*.action.ts`
- `src/modules/**/*.query.ts`
- `src/modules/**/*.workflow.ts`
- `src/modules/**/*.event.ts`

`generateCoreArtifacts(...)` пишет:

- `src/generated/core/manifest.ts`
- `src/generated/core/bus.d.ts`
- `src/generated/core/index.ts`

## CLI

```bash
orria-runtime
orria-runtime help
orria-runtime version
orria-runtime generate --root . --modules src/modules --out src/generated/core
orria-runtime init --dir my-app --name my-app --adapters http,cli,cron
```

`generate` после core codegen автоматически запускает codegen всех установленных `@orria-labs/*` adapters.

## Database helpers

Для минимального случая:

```ts
import { createDatabase } from "@orria-labs/runtime";

export const database = createDatabase(() => dbClient);
```

Для типизированного multi-region доступа:

```ts
import { defineDatabaseAdapter } from "@orria-labs/runtime";

export const database = defineDatabaseAdapter({
  default: "primary",
  clients: {
    primary: primaryClient,
    eu: euClient,
  },
});
```

## Когда использовать напрямую

- когда вы собираете transport adapter поверх core API
- когда нужен отдельный build-time codegen
- когда нужна runtime orchestration без HTTP/CLI/cron слоя

## Ограничение

В core по-прежнему нет durable queue / outbox слоя. Актуальный backlog описан в `../../docs/TECH_DEBT.md`.
