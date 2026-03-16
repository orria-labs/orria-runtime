# HTTP adapter

Документ описывает текущее состояние `@orria-labs/runtime-elysia`.

## Основные API

- `buildHttpApplication(...)`
- `createHttpAdapter(...)`
- `defineHttpAdapter(...)`
- `defineHandler(...)`
- `defineWs(...)`
- `definePlugin(...)`
- `discoverHttpRoutes(...)`
- `discoverHttpPlugins(...)`
- `discoverHttpWsRouteModules(...)`

## Рекомендуемая структура

```txt
src/transport/http/
├── adapter.ts
├── contract.ts
├── plugins/
└── router/
```

Рекомендованный pattern:

- в `adapter.ts` держать `httpAdapter`
- в `contract.ts` держать `defineHandler` / `defineWs`
- route modules импортируют factories из `contract.ts`

Так вы избегаете циклов между runtime adapter и generated typed app.

## Adapter

```ts
import path from "node:path";
import { defineHttpAdapter } from "@orria-labs/runtime-elysia";

export const { adapter: httpAdapter } =
  defineHttpAdapter<GeneratedBusTypes, AppDatabase>()({
    rootDir: path.resolve(import.meta.dir, "../../.."),
    plugins: ["spec"],
  });
```

Опции adapter:

- `rootDir`
- `routesDir`
- `pluginsDir`
- `createApp`
- `plugins`
- `routes`
- `extend`

## Handler

```ts
import z from "zod";
import { defineHandler } from "../contract.ts";

export default defineHandler({
  plugins: ["request-source"],
  options: {
    body: z.object({
      email: z.email(),
    }),
    detail: {
      summary: "Creates a user",
    },
  },
  handle: async ({ ctx, body, requestSource }) => {
    const created = await ctx.action.user.create(body);

    return {
      ...created,
      source: requestSource,
    };
  },
});
```

`handle(...)` получает типизированный Elysia context с уже применёнными plugin extensions.

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

Refs можно использовать:

- глобально в `defineHttpAdapter({ plugins: [...] })`
- локально в `defineHandler({ plugins: [...] })`

## Discovery

### HTTP files

- `health.get.ts` → `GET /health`
- `user/create.post.ts` → `POST /user/create`
- `index.get.ts` → `GET /`
- `v1/user/[id]/status.get.ts` → `GET /v1/user/:id/status`
- `v1/user/[...rest].get.ts` → `GET /v1/user/*`

### WebSocket files

- `chat.ws.ts` → `WS /chat`
- `index.ws.ts` → `WS /`
- `ws.ts` → `WS /ws`

WebSocket module может экспортировать либо `defineWs(...)`, либо готовый `Elysia` app.

## Runtime surface

После `createApplication(..., { http: httpAdapter })` adapter даёт:

- `app.adapter.http.app`
- `app.adapter.http.handle(request)`
- `app.adapter.http.listen(...)`
- `app.adapter.http.reload()`
- `app.adapter.http.watch()`
- `app.adapter.http.unwatch()`

## Codegen

После `orria-runtime generate` создаются:

- `src/generated/http/app.ts`
- `src/generated/http/app-registry.d.ts`
- `src/generated/http/plugin-registry.d.ts`

Это используется для:

- типизации discovered app
- типизации string plugin refs

## Dev-flow

`watch()` следит за `router` и `plugins`, пересобирает runtime app и при необходимости синхронизирует generated HTTP artifacts.

После недавнего рефакторинга adapter и watcher стали экономнее по I/O и проще по структуре: reload/artifact-sync path больше не дублируется между `reload()` и `watch()`.
