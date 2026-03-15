# `@orria-labs/runtime-citty`

CLI transport adapter для `@orria-labs/runtime` поверх `citty`.

## Что поддерживается

- `createCliAdapter({ rootDir })` для file-based discovery commands
- `discoverCliCommands()` / `discoverCliCommandModules()` для явного discovery
- `defineCommand()` для декларации commands
- aliases и nested command tree из файловой структуры
- generated typed registry для command paths/aliases
- `app.adapter.cli.run(rawArgs?)`, `invoke(rawArgs?)`, `renderUsage()`, `reload()`, `watch()` и `unwatch()`

## Базовое использование

```ts
const app = await createApplication(options, {
  cli: createCliAdapter({
    rootDir: import.meta.dir,
  }),
});

await app.adapter.cli.run(process.argv.slice(2));
```

```ts
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

## Целевая структура

```txt
src/transport/cli/
├── adapter.ts
└── command/
```

## Known limitations

- CLI adapter уже покрывает generated typed registry и dev watch/reload.
- Подтверждённый remaining backlog теперь описан в `../../docs/TECH_DEBT.md#core`.

Общий план развития лежит в `../../docs/ROADMAP.md`.
