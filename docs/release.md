# Release и публикация

Этот документ описывает publish-ready flow для `Orria Runtime` пакетов.

## Что делает сборка

Перед публикацией каждый пакет собирается в минимальный `dist`-bundle:

- `index.js` — runtime bundle в ESM;
- `index.d.ts` — декларации типов;
- `cli/main.js` — только для `@orria-labs/runtime` и CLI `orria-runtime`.

В `dist/package.json` автоматически подготавливаются publish-ready поля:

- `exports` на `./index.js` и `./index.d.ts`;
- `bin` для `orria-runtime`;
- внутренние `workspace:*` зависимости заменяются на реальные release-версии.

## Основные команды

```bash
bun run build
bun run release:check
bun run changeset
bun run release:version
bun run release:dry-run
bun run release:publish
```

## Рекомендуемый flow релиза

1. Создать changeset:

```bash
bun run changeset
```

2. Поднять версии пакетов на основе changesets:

```bash
bun run release:version
```

3. Проверить релиз локально:

```bash
bun run release:check
bun run release:dry-run
```

4. Опубликовать пакеты в `npm`:

```bash
bun run release:publish
```

## Полезные варианты

Опубликовать pre-release tag:

```bash
bun run release:publish -- --tag next
```

Передать OTP для `npm`:

```bash
bun run release:publish -- --otp 123456
```

## Порядок публикации

Пакеты публикуются в фиксированном порядке:

1. `@orria-labs/runtime`
2. `@orria-labs/runtime-elysia`
3. `@orria-labs/runtime-citty`
4. `@orria-labs/runtime-croner`

Если какая-то версия уже есть в `npm`, publish-скрипт пропускает её и продолжает дальше.
