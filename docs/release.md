# Release и публикация

Этот документ описывает текущий publish-ready flow workspace.

## Что делает сборка пакета

Каждый пакет собирается в отдельный `dist` через `scripts/build-package.ts`.

В `dist` попадают:

- `index.js`
- `index.d.ts`
- `README.md`
- `package.json`, переписанный под публикацию

Для `@orria-labs/runtime` дополнительно собирается:

- `cli/main.js`
- `cli/main.d.ts`

## Что переписывается в `dist/package.json`

- `exports`
- `main`
- `module`
- `types`
- `bin` для `orria-runtime`
- `workspace:*` зависимости на реальные версии workspace-пакетов

## Команды workspace

```bash
bun run build
bun run typecheck
bun run test
bun run release:check
bun run release:dry-run
bun run release:publish
```

## Рекомендуемый flow релиза

1. создать changeset

```bash
bun run changeset
```

2. обновить версии пакетов

```bash
bun run release:version
```

3. проверить релиз локально

```bash
bun run release:check
bun run release:dry-run
```

4. опубликовать

```bash
bun run release:publish
```

## Полезные флаги publish

```bash
bun run release:publish -- --tag next
bun run release:publish -- --otp 123456
```

## Порядок публикации

Сейчас publish идёт в фиксированном порядке:

1. `@orria-labs/runtime`
2. `@orria-labs/runtime-elysia`
3. `@orria-labs/runtime-citty`
4. `@orria-labs/runtime-croner`

Если конкретная версия уже опубликована в npm, publish-скрипт безопасно пропускает её. Это позволяет повторно запускать релиз после частичного сбоя.

## Что проверяет `release:check`

```bash
bun run generate:example
bun run typecheck
bun run test
bun run build
```

То есть release-контур опирается не только на сборку пакетов, но и на актуальность generated артефактов в `example`.
