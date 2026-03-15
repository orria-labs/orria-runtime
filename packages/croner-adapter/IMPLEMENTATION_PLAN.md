# `@orria-labs/runtime-croner` implementation status

Реализовано:

1. `discoverCronSchedules` и `discoverCronScheduleModules` сканируют `src/transport/cron/schedules/**/*.ts` и валидируют уникальность schedule names.
2. `workflowRef` / `workflowTarget` дают typed workflow refs поверх runtime и валидируются against registered workflows.
3. Adapter поддерживает lifecycle `start()` / `stop()` / `reload()` и хранит execution metadata в `job.lastExecution`.
4. В `defineCron` поддержаны Croner options `timezone`, `paused`, `protect`, `catch`.
5. Добавлены tests на discovery, manual trigger, workflow invocation и scheduler bootstrapping.

Следующий логичный шаг:

- добавить file-watching для hot reload schedules в dev-режиме;
- расширить observability hooks до custom reporter / logger integration;
- добавить typed helpers для cron targets поверх generated artifacts.
