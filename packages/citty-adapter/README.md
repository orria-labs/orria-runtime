# `@orria-labs/runtime-citty`

CLI adapter для `@orria-labs/runtime` поверх `citty`.

- npm: `https://www.npmjs.com/package/@orria-labs/runtime-citty`

## Что поддерживается

- file-based discovery команд из `src/transport/cli/command`
- nested commands и aliases
- `defineCommand(...)`
- adapter-level root command через `createCliAdapter(...)`
- programmatic `run(...)` и `invoke(...)`
- `renderUsage()`, `reload()`, `watch()`, `unwatch()`
- generated типы для canonical command paths и alias paths

## Базовый adapter

```ts
import path from "node:path";
import { createCliAdapter } from "@orria-labs/runtime-citty";

export const cliAdapter = createCliAdapter({
  rootDir: path.resolve(import.meta.dir, "../../.."),
});
```

## Команда

```ts
import { defineCommand } from "@orria-labs/runtime-citty";

export default defineCommand({
  aliases: ["new"],
  meta: {
    description: "Create user through action bus",
  },
  args: {
    email: {
      type: "string",
      required: true,
      description: "User email",
    },
  },
  run: ({ ctx, args }) => ctx.action.user.create({ email: args.email }),
});
```

Контекст command получает:

- `ctx`
- `adapterContext`
- `command`
- `commandPath`
- стандартный `citty` context (`args`, `rawArgs` и т.д.)

## Как строится путь команды

По умолчанию путь выводится из файловой структуры:

- `src/transport/cli/command/system/info.ts` → `system info`
- `src/transport/cli/command/user/create.ts` → `user create`
- `index.ts` в конце пути отбрасывается

Путь можно переопределить через:

- `path: "user/create"`
- `path: ["user", "create"]`
- `name`, если он содержит `/`

Aliases задаются через `aliases` или `meta.aliases`.

## Programmatic вызов

```ts
await app.adapter.cli.run(["user", "create", "--email", "demo@example.com"]);

const result = await app.adapter.cli.invoke([
  "user",
  "new",
  "--email",
  "alias@example.com",
]);
```

После `orria-runtime generate` adapter пишет `src/generated/cli/command-registry.d.ts`, и `run(...)` / `invoke(...)` получают типизацию по discovered paths и aliases.

## Root command

`createCliAdapter(...)` умеет описывать и корневую команду:

- `name`
- `meta`
- `args`
- `setup`
- `cleanup`
- `run`
- `commands`

Это удобно, когда часть команд приходит из файловой структуры, а часть задаётся программно.

## Dev-режим

Adapter поддерживает `reload()`, `watch()` и `unwatch()`. Watch работает через общий polling watcher из core и синхронизирует command tree после изменений файлов.

Подробнее — `../../docs/cli-adapter.md`.
