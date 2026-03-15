# CLI adapter (`@orria-labs/runtime-citty`)

`@orria-labs/runtime-citty` — transport adapter для CLI поверх `citty`.

Он нужен, чтобы:

- собирать file-based CLI commands из приложения;
- вызывать runtime buses из CLI-команд;
- запускать CLI как из `process.argv`, так и программно в тестах.

## Когда использовать

Подходит для задач вроде:

- `seed`, `migrate`, `sync`, `backfill`;
- локальных admin/debug commands;
- workflow/action запусков из терминала;
- internal tooling рядом с runtime-приложением.

## Bootstrap

```ts
import { createApplication } from "@orria-labs/runtime";
import { createCliAdapter } from "@orria-labs/runtime-citty";

const app = await createApplication(options, {
  cli: createCliAdapter({
    rootDir: import.meta.dir,
  }),
});

await app.adapter.cli.run(process.argv.slice(2));
```

## Что возвращает `app.adapter.cli`

```ts
app.adapter.cli.command
app.adapter.cli.run(rawArgs?)
app.adapter.cli.invoke(rawArgs?)
app.adapter.cli.renderUsage()
```

- `command` — root `citty` command object.
- `run(rawArgs?)` — полноценный CLI execution path для реального запуска.
- `invoke(rawArgs?)` — программный вызов с возвратом результата leaf-команды.
- `renderUsage()` — генерирует help/usage как строку.

## `createCliAdapter(options)`

```ts
createCliAdapter({
  rootDir,
  commandsDir,
  meta,
  name,
  args,
  commands,
  setup,
  cleanup,
  run,
})
```

### Поля `options`

- `rootDir` — корень приложения для file-based discovery.
- `commandsDir` — кастомная директория commands; по умолчанию `src/transport/cli/command`.
- `meta` — root CLI metadata: `name`, `version`, `description`, `hidden`, `aliases`.
- `name` — shortcut для root command name.
- `args` — root-level args.
- `commands` — commands, добавленные вручную поверх discovered commands.
- `setup` — root setup hook.
- `cleanup` — root cleanup hook.
- `run` — root command handler.

Если `rootDir` задан, adapter также пытается взять `name`, `version`, `description` из `package.json`.

## File-based discovery

По умолчанию adapter сканирует:

```txt
src/transport/cli/command/**/*.ts
```

Каждый файл должен экспортировать `defineCommand(...)`.

## Как строится tree commands из файлов

Командный путь строится из относительного пути файла:

- `src/transport/cli/command/user/create.ts` -> `user create`
- `src/transport/cli/command/system/info.ts` -> `system info`
- `src/transport/cli/command/cache/index.ts` -> `cache`

Имя сегмента нормализуется в kebab-case.

### Переопределение path

Если нужно, путь можно задать явно:

```ts
defineCommand({
  path: ["user", "create"],
  run: () => {},
});
```

или

```ts
defineCommand({
  path: "user/create",
  run: () => {},
});
```

## `defineCommand()`

```ts
import { defineCommand } from "@orria-labs/runtime-citty";

export default defineCommand({
  aliases: ["new"],
  meta: {
    description: "Create user",
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

### Поля command

- `name` — имя текущего command node.
- `path` — явный путь команды.
- `aliases` — alias names для текущего node.
- `meta` — metadata для help/usage.
- `args` — args schema в формате `citty`.
- `subCommands` — вложенные commands, если вы собираете tree вручную.
- `setup` — hook перед `run`.
- `cleanup` — hook после `run`.
- `run` — основной handler.

### Поля `meta`

- `name` — имя команды в usage/help.
- `version` — версия CLI.
- `description` — описание команды.
- `hidden` — скрыть command из help.
- `aliases` — альтернативные имена.

## Контекст handler-а

Каждый `setup` / `run` / `cleanup` получает расширенный контекст:

```ts
{
  rawArgs,
  args,
  cmd,
  subCommand,
  data,
  ctx,
  adapterContext,
  command,
  commandPath,
}
```

### Что означает каждое поле

- `rawArgs` — исходные CLI args.
- `args` — распарсенные args от `citty`.
- `cmd` — текущий resolved `citty` command.
- `subCommand` — дочерний command, если он был выбран.
- `data` — произвольные данные `citty`, если используются.
- `ctx` — application context.
- `adapterContext` — `ctx`, `registry`, `runtime`, `manifest`, `console`.
- `command` — исходная `defineCommand()` декларация.
- `commandPath` — путь команды массивом сегментов, например `['user', 'create']`.

## `run()` vs `invoke()`

- `run()` используйте в реальном entrypoint приложения.
- `invoke()` используйте в тестах, automation и internal programmatic scenarios.

Пример:

```ts
const result = await app.adapter.cli.invoke([
  "user",
  "new",
  "--email",
  "dev@example.com",
]);
```

## Aliases

Alias добавляются на уровень конкретной команды:

```ts
defineCommand({
  aliases: ["new"],
  run: ({ ctx, args }) => ctx.action.user.create({ email: args.email }),
});
```

Если команда лежит в `user/create.ts`, она будет доступна и как:

- `user create`
- `user new`

## Рекомендуемая структура

```txt
src/
└── transport/
    └── cli/
        ├── adapter.ts
        └── command/
            ├── system/
            │   └── info.ts
            └── user/
                └── create.ts
```

## Практический паттерн

- command отвечает за parsing args и orchestration внешнего вызова;
- бизнес-логика остаётся в `action` / `workflow` / `query`;
- `invoke()` покрывает testability без запуска процесса;
- file-based tree делает CLI масштабируемым так же, как router в HTTP.

## Known limitations

- file-based commands поддерживают `reload()/watch()/unwatch()`;
- `orria-runtime generate` автоматически создаёт `src/generated/cli/command-registry.d.ts`, а literal-вызовы `run()/invoke()` получают compile-time safety по command paths и aliases;
- подтверждённый backlog ведётся в `docs/TECH_DEBT.md#cli-adapter`.
