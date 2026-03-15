# HTTP adapter (`@orria-labs/runtime-elysia`)

`@orria-labs/runtime-elysia` — transport adapter для HTTP поверх `elysia`.

Он решает две задачи:

- собирает file-based routes и plugins из приложения;
- превращает HTTP request в вызов вашего runtime-кода через `ctx.action.*`, `ctx.query.*`, `ctx.workflow.*`.

## Когда использовать

Используйте adapter, если приложение должно:

- принимать HTTP-запросы;
- объявлять routes в файловой структуре, а не собирать их вручную;
- подключать Elysia plugins с доступом к `ctx` приложения;
- иметь программный доступ к HTTP app через `app.adapter.http.handle()` и `listen()`.

## Bootstrap

```ts
import { createApplication } from "@orria-labs/runtime";
import { manifest } from "./generated/core/index.ts";
import { config } from "./config.ts";
import { database } from "./database.ts";
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

app.adapter.http.listen(3000);
```

## `defineHttpAdapter()`

Это preferred high-level API для реального приложения:

- собирает `adapter` и typed `defineHandler` из одной конфигурации;
- держит typing route handlers синхронным с global plugins;
- избавляет от отдельного `shared.ts` только ради handler factory.

```ts
import {
  defineHttpAdapter,
  type RegisteredHttpPluginRef,
} from "@orria-labs/runtime-elysia";

const globalPlugins = ["openapi", "request-source"] as const satisfies readonly RegisteredHttpPluginRef[];

export const { adapter: httpAdapter, defineHandler } =
  defineHttpAdapter<GeneratedBusTypes, ExampleDatabaseAdapter>()({
    rootDir: import.meta.dir,
    plugins: globalPlugins,
  });
```

После этого route files могут импортировать `defineHandler` прямо из `src/transport/http/adapter.ts`.

## Что возвращает `app.adapter.http`

После регистрации adapter доступен объект:

```ts
app.adapter.http.app
app.adapter.http.handle(request)
app.adapter.http.listen(...args)
```

- `app` — инстанс `Elysia`.
- `handle(request)` — удобный способ прогнать запрос программно, полезно для тестов и internal integration.
- `listen(...)` — прямой запуск HTTP сервера через Elysia.

## `createHttpAdapter(options)`

Это низкоуровневый primitive, на котором построен `defineHttpAdapter()`.
Используйте его, если adapter нужен отдельно от handler factory или вы строите свой wrapper.

Adapter принимает объект настроек:

```ts
createHttpAdapter({
  rootDir,
  routesDir,
  pluginsDir,
  createApp,
  plugins,
  routes,
  extend,
})
```

### Поля `options`

- `rootDir` — корень приложения для file-based discovery.
- `routesDir` — кастомная директория routes; по умолчанию `src/transport/http/router`.
- `pluginsDir` — кастомная директория plugins; по умолчанию `src/transport/http/plugins`.
- `createApp` — factory для базового `Elysia` instance, если нужен свой preconfigured app.
- `plugins` — глобальные plugins, которые монтируются до routes.
- `routes` — routes, добавленные вручную поверх discovered routes.
- `extend` — последний hook для прямой донастройки итогового `Elysia` app.

## File-based discovery

### Plugins

По умолчанию adapter сканирует:

```txt
src/transport/http/plugins/**/*.ts
```

Каждый файл должен экспортировать `definePlugin(...)`.

Во время `orria-runtime generate` автоматически генерируется `src/generated/http/plugin-registry.d.ts`.
Он поднимает найденные plugin refs и aliases в type-system, поэтому строковые refs начинают подсказываться и типизироваться и в route `plugins: [...]`, и в global `createHttpAdapter({ plugins: [...] })`.

Пример global plugins:

```ts
import { type RegisteredHttpPluginRef } from "@orria-labs/runtime-elysia";

const globalPlugins = ["openapi", "request-source"] as const satisfies readonly RegisteredHttpPluginRef[];

export const { adapter: httpAdapter, defineHandler } =
  defineHttpAdapter<GeneratedBusTypes, ExampleDatabaseAdapter>()({
    rootDir: import.meta.dir,
    plugins: globalPlugins,
  });
```

Если нужен более низкоуровневый контроль над factory, можно по-прежнему собрать его вручную:

```ts
import { createHandlerFactory } from "@orria-labs/runtime-elysia";

export const defineAppHandler = createHandlerFactory<
  GeneratedBusTypes,
  ExampleDatabaseAdapter,
  typeof globalPlugins
>({
  plugins: globalPlugins,
});
```

### Routes

По умолчанию adapter сканирует:

```txt
src/transport/http/router/**/*.ts
```

Каждый файл должен экспортировать `defineHandler(...)`.
На практике удобнее импортировать его из `src/transport/http/adapter.ts`, а не напрямую из пакета.

## Как строится path и method из файла

Method берётся из suffix в имени файла:

- `health.get.ts` -> `GET`
- `create.post.ts` -> `POST`
- `update.patch.ts` -> `PATCH`
- `remove.delete.ts` -> `DELETE`

Path строится из относительного пути файла:

- `src/transport/http/router/health.get.ts` -> `/health`
- `src/transport/http/router/user/create.post.ts` -> `/user/create`
- `src/transport/http/router/v1/user-status.get.ts` -> `/v1/user-status`
- `src/transport/http/router/user/index.get.ts` -> `/user`

Поддерживаются dynamic segments:

- `src/transport/http/router/user/[id].get.ts` -> `/user/:id`
- `src/transport/http/router/files/[...path].get.ts` -> `/files/*`

Если в `defineHandler()` явно указать `method` или `path`, они перекрывают file-based inference.

## `definePlugin()`

Plugin описывается так:

```ts
import { definePlugin } from "@orria-labs/runtime-elysia";

export default definePlugin({
  name: "request-source",
  refs: ["source"],
  setup: ({ app, ctx, adapterContext }) => {
    return app.derive(({ request }) => ({
      requestSource: request.headers.get("x-source") ?? "http",
      appName: ctx.config.get("APP_NAME"),
    }));
  },
});
```

### Поля plugin

- `name` — canonical имя plugin.
- `refs` — дополнительные alias/ref names, которыми на него можно ссылаться из routes или global `plugins`.
- `setup` — функция монтирования plugin в `Elysia`.

### Аргументы `setup`

- `app` — текущий `Elysia` instance.
- `ctx` — application context.
- `adapterContext` — расширенный контекст adapter-а: `ctx`, `registry`, `runtime`, `manifest`, `console`.

## `defineHandler()`

Route описывается так:

```ts
import { defineHandler } from "../adapter.ts";

export default defineHandler({
  plugins: ["request-source"],
  handle: async ({ ctx, body, transportContext }) => {
    const created = await ctx.action.user.create(body as { email: string });

    return {
      ...created,
      source: (transportContext as { requestSource?: string }).requestSource,
    };
  },
  options: {
    detail: {
      summary: "Creates a user",
      description: "Creates a user in the example in-memory database",
    },
  },
});
```

`defineHandler({...})` даёт полную инференцию `body/query/params` из `options` и plugin-derived полей в handler context.
Если он экспортирован из `defineHttpAdapter(...)`, то route handlers автоматически знают про global plugins этого adapter-а.

### Поля handler

- `method` — HTTP method; обычно можно не указывать, если он уже есть в имени файла.
- `path` — route path; обычно можно не указывать, если он выводится из файла.
- `plugins` — массив plugin refs или inline plugins, которые монтируются только для этой route.
- `options` — 4-й аргумент `Elysia.route(method, path, handler, options)`, включая `body`, `query`, `params`, `headers`, `response`, `detail` и route-local hooks.
- `detail` — legacy shorthand; если указан, adapter смержит его в `options.detail`, но новый код лучше писать через `options.detail`.
- `handle` — основной handler.

### Аргументы `handle`

- `app` — route-local `Elysia` instance.
- `ctx` — application context.
- `request` — исходный `Request`.
- `params` — route params из Elysia.
- `query` — query string как object.
- `body` — распарсенное тело запроса.
- `transportContext` — raw context Elysia, включая данные из plugins/derive.

## Как парсится `body`

Adapter парсит body так:

- `GET`/`HEAD` -> `undefined`
- `application/json` -> `await request.json()`
- `application/x-www-form-urlencoded` -> `Object.fromEntries(formData.entries())`
- любой другой content-type -> `await request.text()`

## Global plugins vs route plugins

Есть два уровня plugins:

- global plugins — передаются в `createHttpAdapter({ plugins: [...] })` и применяются ко всему app;
- global plugins — обычно передаются в `defineHttpAdapter({ plugins: [...] })` и применяются ко всему app;
- route plugins — указываются в `defineHandler<...>()({ plugins: [...] })` и действуют только для конкретной route.

Plugin можно передать:

- строкой-ref: `"request-source"`;
- inline plugin object через `definePlugin(...)`.

## `extend()`

Если нужно напрямую расширить итоговый `Elysia` app, используйте `extend`:

```ts
defineHttpAdapter<GeneratedBusTypes, ExampleDatabaseAdapter>()({
  rootDir: import.meta.dir,
  extend: ({ app }) => app.get("/extended", () => ({ extended: true })),
});
```

Это хороший способ для:

- health endpoints вне file-based router;
- временных debug routes;
- интеграции с Elysia plugins, которые удобнее монтировать в одном месте.

## Рекомендуемая структура

```txt
src/
└── transport/
    └── http/
        ├── adapter.ts
        ├── plugins/
        │   └── request-source.ts
        └── router/
            ├── health.get.ts
            ├── user/
            │   └── create.post.ts
            └── v1/
                └── user-status.get.ts
```

## Known limitations

- HTTP adapter уже покрывает typed global plugins, `defineHttpAdapter(...)` и `reload()/watch()/unwatch()` для file-based routes/plugins.
- Подтверждённый remaining backlog ведётся в `docs/TECH_DEBT.md#core`.

## Когда route лучше вызывать `action`, а когда `query`

- `GET` routes обычно маппятся на `ctx.query.*`.
- `POST`/`PUT`/`PATCH`/`DELETE` routes обычно маппятся на `ctx.action.*`.
- `workflow` разумно вызывать из HTTP только если endpoint действительно запускает orchestration, а не простую CRUD-операцию.

## Практический паттерн

- route отвечает за transport-layer parsing;
- business logic живёт в `action` / `query` / `workflow`;
- plugins добавляют transport-specific контекст;
- adapter собирает всё в единый `Elysia` app.
