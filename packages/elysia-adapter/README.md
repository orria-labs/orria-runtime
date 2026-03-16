# `@orria-labs/runtime-elysia`

HTTP/WebSocket adapter для `@orria-labs/runtime` поверх `elysia`.

- npm: `https://www.npmjs.com/package/@orria-labs/runtime-elysia`

## Что поддерживается

- file-based discovery маршрутов из `src/transport/http/router`
- file-based discovery plugins из `src/transport/http/plugins`
- HTTP handlers через `defineHandler(...)`
- WebSocket routes через `defineWs(...)`
- plugins с доступом к `ctx` через `definePlugin(...)`
- global и per-route plugin refs
- `buildHttpApplication(...)`, `createHttpAdapter(...)`, `defineHttpAdapter(...)`
- `handle(request)`, `listen(...)`, `reload()`, `watch()`, `unwatch()`
- generated типы для discovered app и string plugin refs

## Рекомендуемый способ подключения

```ts
import path from "node:path";
import { defineHttpAdapter } from "@orria-labs/runtime-elysia";

export const { adapter: httpAdapter, defineHandler, defineWs } =
  defineHttpAdapter<GeneratedBusTypes, AppDatabase>()({
    rootDir: path.resolve(import.meta.dir, "../../.."),
    plugins: ["spec"],
  });
```

Если вы хотите держать route contracts отдельно от runtime bootstrap, используйте `createHandlerFactory(...)` и `createWsFactory(...)` в отдельном `contract.ts`, а в `adapter.ts` экспортируйте только `httpAdapter`.

## Handler

```ts
import { defineHandler } from "../contract.ts";

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

Контекст handler получает всё, что даёт Elysia, плюс:

- `ctx` — `ApplicationContext`
- `app` — Elysia app, расширенный plugin’ами
- `transportContext` — сырой transport context

## WebSocket route

```ts
import { defineWs } from "@orria-labs/runtime-elysia";

export default defineWs()({
  options: {
    message(ws, message) {
      ws.send(message);
    },
  },
});
```

## Plugins

```ts
import { definePlugin } from "@orria-labs/runtime-elysia";

export default definePlugin({
  refs: ["request-source"],
  setup: ({ app }) =>
    app.derive(({ request }) => ({
      requestSource: request.headers.get("x-source") ?? "http",
    })),
});
```

## File-based naming

- `health.get.ts` → `GET /health`
- `user/create.post.ts` → `POST /user/create`
- `v1/user-status.get.ts` → `GET /v1/user-status`
- `v1/user/[id]/status.get.ts` → `GET /v1/user/:id/status`
- `chat.ws.ts` → `WS /chat`
- `index.get.ts` → `GET /`
- `index.ws.ts` → `WS /`

Если в проекте уже используются сегменты вроде `:id`, они тоже остаются валидными после нормализации.

## Codegen

После `orria-runtime generate` adapter пишет:

- `src/generated/http/app.ts`
- `src/generated/http/app-registry.d.ts`
- `src/generated/http/plugin-registry.d.ts`

Это даёт:

- типизацию discovered app через `HttpDiscoveredAppRegistry`
- типизацию string refs в `plugins: [...]`

## Dev-режим

`watch()` использует polling watcher из core и подходит для Bun/Node сценариев с file-based discovery. После недавнего рефакторинга watcher избегает лишнего хеширования неизменившихся файлов, что уменьшает I/O в больших деревьях маршрутов.

## Полезные API

- `buildHttpApplication(...)` — собрать Elysia app без adapter wrapper
- `createHttpAdapter(...)` — готовый adapter factory
- `defineHttpAdapter(...)` — adapter + typed route factories из одного места
- `discoverHttpRoutes(...)`, `discoverHttpPlugins(...)`, `discoverHttpWsRouteModules(...)` — низкоуровневый discovery

Подробнее — `../../docs/http-adapter.md`.
