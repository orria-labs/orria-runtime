# `@orria-labs/runtime-citty` implementation status

Реализовано:

1. `discoverCliCommands` и `discoverCliCommandModules` сканируют `src/transport/cli/command/**/*.ts` и строят file-based command tree.
2. Нормализованы command segments, aliases и root meta через `package.json` (`name`, `version`, `description`).
3. В `setup` / `run` / `cleanup` пробрасываются `ctx`, `adapterContext`, `command`, `commandPath`.
4. Добавлены `invoke()` и `renderUsage()` для тестируемого и удобного программного вызова CLI.
5. Добавлены tests на discovery, nested commands, aliases и композицию с `createApplication`.

Следующий логичный шаг:

- добавить dev watch для hot-reload CLI commands;
- добавить helpers для генерации typed CLI contracts из application modules;
- расширить alias/path rules для более сложных multi-command сценариев.
