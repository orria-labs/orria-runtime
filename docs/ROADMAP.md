# Roadmap

Этот файл фиксирует ближайший roadmap с учётом текущего состояния кода.

## Уже реализовано

### Core

- declarations для `action`, `query`, `workflow`, `event`
- file-based discovery и manifest generation
- registry с проверкой подписок и конфликтов
- runtime с middleware pipeline, local event fan-out и `unsafe(...)`
- `createApplication(...)` с выводом bus-типов из generated manifest
- CLI `orria-runtime` с `generate`, `init`, `help`, `version`

### Adapters

- HTTP adapter с route/plugin discovery, WebSocket routes и generated app/plugin registries
- CLI adapter с nested commands, aliases и generated command registries
- Cron adapter с schedule discovery, workflow targets и generated schedule registry

### Tooling

- publish-ready `dist` build для всех пакетов
- release scripts и changesets flow
- `example` как интеграционный reference
- оптимизация polling watcher, discovery и reload-path для снижения I/O и упрощения сопровождения

## Ближайший следующий шаг

### Durable queue / outbox

Это единственный крупный подтверждённый gap, который остаётся в runtime-модели.

Что нужно определить:

- живёт ли outbox в core или отдельным integration layer
- как связать delivery semantics с `eventTransport`
- как это будет сочетаться с workflow orchestration и retry model

## Что не является priority сейчас

- переработка transport adapters с нуля
- отказ от file-based discovery
- новая CLI surface поверх уже работающего `orria-runtime`

Текущий адаптерный и build-time контур уже стабилен, покрыт тестами и достаточен для дальнейшего развития поверх него.
