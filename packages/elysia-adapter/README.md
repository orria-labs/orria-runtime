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
- `chat.ws.ts` → `WS /chat`
- `ws.ts` → `WS /ws`
