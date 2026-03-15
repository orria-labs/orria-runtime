# `@orria-labs/runtime`

Пакет с runtime-ядром framework-а.

## Включает

- declaration helpers
- discovery
- registry
- runtime
- codegen
- cli
- bootstrap helpers

## CLI

```bash
orria-runtime
orria-runtime --help
orria-runtime --version
orria-runtime help
orria-runtime version
orria-runtime init
orria-runtime generate --root . --out src/generated/core
```

## Bootstrap

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
```

`createApplication(...)` выводит bus-типы из generated `manifest`, поэтому bootstrap-коду обычно не нужен явный `createApplication<...>()`.

## Known limitations

- В core по-прежнему нет durable queue / outbox слоя; текущий оставшийся backlog описан в `../../docs/TECH_DEBT.md#core`.

Общий план развития лежит в `../../docs/ROADMAP.md`.
