# `@orria-labs/runtime-elysia` implementation status

Реализовано:

1. `discoverHttpRoutes` и `discoverHttpPlugins` сканируют `src/transport/http/router/**/*.ts` и `src/transport/http/plugins/**/*.ts`.
2. File-based router нормализует `user-status.get.ts -> GET /user-status`, включая nested paths и `index` files.
3. `defineHandler` поддерживает file-based method/path inference, route `options` и plugin refs без потери escape hatch к `Elysia`.
4. Plugins монтируются как global и per-route refs через discovery registry с доступом к `ctx`.
5. Добавлены smoke tests на route mounting, body parsing, plugin injection и `extend`.

Следующий логичный шаг:

- добавить dev watch и reload для HTTP routes/plugins;
- расширить file-based routing для richer params/catch-all conventions;
- добавить helpers для tighter typing `transportContext` после Elysia decorators/derive.
