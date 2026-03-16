# `@orria-labs/runtime-elysia`

HTTP transport adapter для `@orria-labs/runtime` поверх `elysia`.

- npm: https://www.npmjs.com/package/@orria-labs/runtime-elysia

## Что поддерживается

- `createHttpAdapter({ rootDir })` для file-based discovery routes/plugins
- `defineHttpAdapter<...>()({...})` как preferred API для общего экспорта `adapter` + typed `defineHandler`
- `discoverHttpRoutes()` / `discoverHttpPlugins()` для явного discovery
- `discoverHttpWsRouteModules()` для WebSocket discovery
- `defineHandler()` для route handlers
- `defineWs()` для file-based WebSocket routes
- `createHandlerFactory()` как low-level helper для кастомных abstractions поверх handler factory
- `definePlugin()` для Elysia plugins с доступом к `ctx`
- global/per-route plugin refs
- generated `HttpPluginRegistry` для typed string refs в `plugins: [...]`
- `app.adapter.http.handle(request)`, `listen()`, `reload()`, `watch()` и `unwatch()`

String refs типизируются и в route-level `defineHandler({ plugins: [...] })`, и в adapter-level `defineHttpAdapter({ plugins: [...] })` после `orria-runtime generate`.

## Базовое использование

```ts
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

const response = await app.adapter.http.handle(
  new Request("http://localhost/health"),
);
```

```ts
export default defineHandler({
  plugins: ["request-source"],
  handle: ({ ctx }) => ({
    ok: true,
    app: ctx.config.get("APP_NAME"),
  }),
  options: {
    detail: {
      summary: "Health check",
    },
  },
});
```

```ts
export default defineWs()({
  options: {
    message(ws, message) {
      ws.send(message);
    },
  },
});
```

```ts
export const { adapter: httpAdapter, defineHandler } =
  defineHttpAdapter<GeneratedBusTypes, ExampleDatabaseAdapter>()({
    rootDir: import.meta.dir,
    plugins: ["openapi", requestSourcePlugin],
  });
```

`defineHandler<...>()({...})` — основной и единственный API для typed route handlers.
В реальном приложении его удобно экспортировать из `src/transport/http/adapter.ts` через `defineHttpAdapter(...)`.

## Known limitations

- HTTP adapter уже покрывает typed global plugins и dev watch/reload.
- Подтверждённый remaining backlog теперь описан в `../../docs/TECH_DEBT.md#core`.

Общий план развития лежит в `../../docs/ROADMAP.md`.

## Целевая структура

```txt
src/transport/http/
├── adapter.ts
├── plugins/
└── router/
```

## File-based naming

- `users.get.ts` → `GET /users`
- `users/post.ts` → `POST /users`
- `index.get.ts` → `GET /`
- `index.ws.ts` → `WS /`
- `chat.ws.ts` → `WS /chat`
- `ws.ts` → `WS /ws`

## Typed SDK for discovered routes

Если вы хотите использовать `typeof app.adapter.http.app` как SDK-тип для `edenFetch`/`edenTreaty`,
адаптер теперь генерирует `src/generated/http/app.ts` и `src/generated/http/app-registry.d.ts`.

Чтобы не получить циклическую типизацию между generated app и file-based route modules,
удобно держать typed route factories отдельно от runtime adapter, например в `src/transport/http/contract.ts`:

```ts
export const defineHandler = createHandlerFactory<...>()({ plugins: ["spec"] });
export const defineWs = createWsFactory<...>()({ plugins: ["spec"] });
```

Тогда route modules импортируют `defineHandler` / `defineWs` из `contract.ts`,
а bootstrap импортирует `httpAdapter` из `adapter.ts`.

Сейчас generated typed app полноценно учитывает:
- file-based routes
- file-based ws routes
- global plugin string refs
- local/global plugin типы, если они проходят через typed factories route modules

Inline global plugin objects в `defineHttpAdapter({ plugins: [myPlugin] })` монтируются в runtime,
но их типы не всегда можно автоматически восстановить в generated `app.ts`, если у codegen нет
стабильной import-ссылки на исходный plugin module.

Для этого есть explicit API:

```ts
import { defineCodegenPlugin, defineHttpAdapter } from "@orria-labs/runtime-elysia";
import authPlugin from "./plugins/auth.ts";

const globalPlugins = [
  defineCodegenPlugin(authPlugin, {
    baseDir: import.meta.dir,
    importPath: "./plugins/auth.ts",
  }),
] as const;

export const { adapter: httpAdapter } = defineHttpAdapter()({
  rootDir: path.resolve(import.meta.dir, "../../.."),
  plugins: globalPlugins,
});
```

`defineCodegenPlugin(...)` не добавляет лишних static imports сам по себе.
Он только прикрепляет metadata, которую codegen использует, если нужно восстановить plugin type в generated `app.ts`.
