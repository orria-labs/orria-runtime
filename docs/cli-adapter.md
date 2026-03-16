# CLI adapter

Документ описывает текущее состояние `@orria-labs/runtime-citty`.

## Основные API

- `createCliAdapter(...)`
- `defineCommand(...)`
- `discoverCliCommands(...)`
- `discoverCliCommandModules(...)`
- `generateCliCommandRegistryArtifacts(...)`

## Рекомендуемая структура

```txt
src/transport/cli/
├── adapter.ts
└── command/
    ├── system/
    │   └── info.ts
    └── user/
        └── create.ts
```

## Adapter

```ts
import path from "node:path";
import { createCliAdapter } from "@orria-labs/runtime-citty";

export const cliAdapter = createCliAdapter({
  rootDir: path.resolve(import.meta.dir, "../../.."),
});
```

Кроме file-based discovery, adapter умеет и программное описание root command:

- `name`
- `meta`
- `args`
- `commands`
- `setup`
- `cleanup`
- `run`

## Команда

```ts
import { defineCommand } from "@orria-labs/runtime-citty";

export default defineCommand({
  aliases: ["new"],
  args: {
    email: {
      type: "string",
      required: true,
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
- обычный `citty` context

## Как выводится путь команды

### Из файла

- `command/system/info.ts` → `system info`
- `command/user/create.ts` → `user create`
- `index.ts` отбрасывается как последний сегмент

### Явно

Путь можно задать через:

- `path: "system/info"`
- `path: ["system", "info"]`
- `name`, если в нём есть `/`

Aliases задаются через `aliases` или `meta.aliases`.

## Programmatic API

```ts
await app.adapter.cli.run(["user", "create", "--email", "demo@example.com"]);

const result = await app.adapter.cli.invoke([
  "user",
  "new",
  "--email",
  "alias@example.com",
]);

const usage = await app.adapter.cli.renderUsage();
```

## Codegen

`orria-runtime generate` создаёт `src/generated/cli/command-registry.d.ts`.

Эта декларация расширяет:

- `CliCommandRegistry`
- `CliCommandAliasRegistry`

В результате `run(...)` и `invoke(...)` получают типизацию по discovered command paths.

## Dev-flow

Adapter поддерживает:

- `reload()`
- `watch()`
- `unwatch()`

Watch отслеживает tree команд через общий polling watcher и пересобирает command tree после изменений файлов.

После рефакторинга reload/watch path теперь централизован внутри adapter, что упрощает поддержку и снижает когнитивную нагрузку при доработках.
