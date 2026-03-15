# Контракты и соглашения

## Packages

- `packages/core` — runtime, discovery, registry, codegen, cli
- `packages-labs/runtime-elysia` — HTTP transport integration surface
- `packages-labs/runtime-citty` — CLI transport integration surface
- `packages-labs/runtime-croner` — cron transport integration surface
- `example` — приложение, использующее framework

## Adapter docs

- `docs/http-adapter.md` — HTTP adapter на Elysia
- `docs/cli-adapter.md` — CLI adapter на Citty
- `docs/cron-adapter.md` — cron adapter на Croner
- `docs/ROADMAP.md` — текущая дорожная карта: completed scope + следующий план работ
- `docs/TECH_DEBT.md` — подтверждённые ограничения, техдолг и ближайший backlog

## File naming

Core discovery сканирует только `src/modules` и использует suffix-based contracts:

- `*.action.ts`
- `*.query.ts`
- `*.workflow.ts`
- `*.event.ts`

Из пути формируется bus key:

- `src/modules/user/create.action.ts` -> `action.user.create`
- `src/modules/user/get.query.ts` -> `query.user.get`
- `src/modules/user/registration.workflow.ts` -> `workflow.user.registration`
- `src/modules/user/registered.event.ts` -> `event.user.registered`

## Declaration shape

### Action

```ts
export default defineAction<Input, Output>({
  kind: "action",
  handle: async ({ ctx, input, meta }) => output,
});
```

### Query

```ts
export default defineQuery<Input, Output>({
  kind: "query",
  handle: async ({ ctx, input, meta }) => output,
});
```

### Workflow

```ts
export default defineWorkflow<Input, Output>({
  kind: "workflow",
  subscribesTo: ["event.user.registered"],
  handle: async ({ ctx, input, meta }) => output,
});
```

### Event

```ts
export default defineEvent<Payload>({
  kind: "event",
  version: 1,
});
```

## Runtime contract

Все executable handlers вызываются одинаково:

```ts
handler({ ctx, input, meta })
```

Где:

- `ctx` — application context
- `input` — уже распарсенный input
- `meta` — invocation metadata

## Generated artifacts

CLI генерирует framework-артефакты в `src/generated/core`:

- `manifest.ts` — runtime manifest с импортами declarations
- `bus.d.ts` — typed bus interfaces
- `index.ts` — re-export generated contract surface

Это позволяет держать generated-код внутри `src` и рядом хранить другие targets:

- `src/generated/prisma`
- `src/generated/database`

## Bootstrap contract

Приложение собирается так:

```ts
import { createApplication } from "@orria-labs/runtime";
import { manifest } from "./generated/core/index.ts";
import { database } from "./database";
import { httpAdapter } from "./transport/http/adapter.ts";

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

`createApplication(...)` выводит bus-типы из `manifest`, поэтому generated `GeneratedBusTypes` не нужно отдельно дублировать в bootstrap-коде.

## CLI

CLI теперь показывает help по умолчанию, а также поддерживает версию:

```bash
orria-runtime
orria-runtime --help
orria-runtime --version
orria-runtime help
orria-runtime version
orria-runtime init
orria-runtime generate --root . --out src/generated/core
```

## Database adapter contract

Рекомендуемый способ подключать БД — через `defineDatabaseAdapter` в `src/database.ts` или `src/database/adapter.ts`.

```ts
const database = defineDatabaseAdapter({
  default: "primary",
  clients: {
    primary: prisma,
    analytics: analyticsClient,
  },
  aliases: {
    default: "primary",
  },
  normalizeRegion: (region) => region.trim().toLowerCase(),
});
```

Поведение:

- `ctx.database.client()` возвращает default client с сохранённым типом
- `ctx.database.client("primary")` возвращает клиент указанного региона
- неизвестный регион вызывает `throw Error`

## Validation rules

Registry валидирует:

- duplicate bus keys
- cross-kind conflicts по logical name
- `subscribesTo` на несуществующие events

## Current scope

Подтверждённые ограничения и нереализованные части теперь ведутся в `docs/TECH_DEBT.md`.

Для core это сейчас означает:

- нет durable queue / outbox слоя;
- scheduling живёт во внешнем `@orria-labs/runtime-croner`, а не внутри core.
