# Контракты

Этот документ фиксирует текущие файловые, runtime и build-time контракты проекта.

## 1. Core module contracts

### File naming

Core discovery ищет только следующие шаблоны:

- `src/modules/**/*.action.ts`
- `src/modules/**/*.query.ts`
- `src/modules/**/*.workflow.ts`
- `src/modules/**/*.event.ts`

### Default export

Каждый файл должен экспортировать declaration по `default`.

### Suffix ↔ kind

Суффикс файла и declaration kind должны совпадать:

- `.action.ts` → `defineAction(...)`
- `.query.ts` → `defineQuery(...)`
- `.workflow.ts` → `defineWorkflow(...)`
- `.event.ts` → `defineEvent(...)`

## 2. Registry contracts

Во время `createRegistry(...)` валидируются:

- уникальность `entry.key`
- отсутствие cross-kind конфликта для одного logical name
- существование всех `subscribesTo` event keys

Registry хранит:

- `entries`
- `byKey`
- `byKind`
- `eventSubscribers`

## 3. Bus contracts

Каждый generated bus-метод:

- остаётся вызываемой функцией
- имеет `.unsafe(...)`
- несёт metadata: `$key`, `$kind`, `$definition`, `$schema`

Пример:

```ts
const method = app.ctx.query.user.get;

await method({ userId: "123" });
await method.unsafe({ userId: "123" });

method.$key;
method.$schema.input;
method.$schema.returns;
```

## 4. Schema contract

Runtime ожидает schema-объект с:

- `parse(value)`
- опционально `parseAsync(value)`

Это делает runtime совместимым с `zod` и другими schema libraries, поддерживающими такой shape.

## 5. Application contract

`createApplication(...)` принимает:

```ts
{
  config,
  database,
  manifest,
  console?,
  middleware?,
  eventTransport?,
  setGlobalCtx?,
}
```

Возвращает:

```ts
{
  ctx,
  registry,
  runtime,
  adapter,
}
```

Если передан `setGlobalCtx: true`, runtime-контекст записывается в `globalThis.ctx`.

## 6. Adapter contract

Любой transport adapter создаётся через `defineTransportAdapter(...)` и получает `CreateApplicationAdapterContext`:

```ts
{
  ctx,
  registry,
  runtime,
  manifest,
  console,
}
```

Это единая точка интеграции для HTTP, CLI, cron и будущих transport-слоёв.

## 7. Codegen contract

### Core CLI

```bash
orria-runtime generate --root . --modules src/modules --out src/generated/core
```

Эта команда:

1. строит manifest
2. пишет core generated files
3. находит установленные `@orria-labs/*` adapters в `package.json`
4. запускает их `orriaAdapterCodegen`

### Adapter outputs

- HTTP: `src/generated/http/app.ts`, `src/generated/http/app-registry.d.ts`, `src/generated/http/plugin-registry.d.ts`
- CLI: `src/generated/cli/command-registry.d.ts`
- Cron: `src/generated/cron/schedule-registry.d.ts`

## 8. CLI contract

`orria-runtime` сейчас поддерживает:

- `generate`
- `init`
- `help`
- `version`

`init` умеет scaffold для `http`, `cli`, `cron` или `none`.

## 9. Database contract

Для простого случая доступен `createDatabase(...)`.

Для полноценного typed adapter используется:

```ts
defineDatabaseAdapter({
  clients,
  default,
  aliases?,
  normalizeRegion?,
})
```

## 10. Watch contract

Все текущие adapters используют polling watcher из core. Он:

- рекурсивно следит за файлами
- фильтрует только поддерживаемые source files
- игнорирует временные `orria`-модули
- оптимизирует повторные проходы за счёт кеша fingerprint’ов файлов

Это часть общей гарантии стабильного dev-flow для file-based discovery под Bun/Node.
