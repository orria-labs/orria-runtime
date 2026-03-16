# Tech Debt

Этот файл содержит только подтверждённый техдолг, который прямо следует из текущего кода и архитектуры.

## Текущее состояние

На данный момент в кодовой базе закрыты:

- core runtime flow
- generated manifest и typed bus
- adapter codegen contract
- HTTP/CLI/cron adapters
- watch/reload flow adapters
- release pipeline
- оптимизации polling watcher, discovery и runtime-path для уменьшения лишней работы и когнитивной нагрузки

## Подтверждённый remaining debt

### Core

- Отсутствует durable queue / outbox слой. Сейчас события могут публиковаться через `eventTransport`, а локальные workflow subscriptions уже работают, но отдельной outbox-подсистемы с гарантированной доставкой и persistence нет.

## Что не считается техдолгом сейчас

- наличие polling watcher — это осознанная реализация для стабильного file-based dev-flow под Bun/Node
- наличие generated артефактов в `src/generated/*` — это часть публичного build-time контракта
- разделение `adapter.ts` и `contract.ts` в HTTP-примере — это intentional pattern, а не обходной манёвр

## Связанные документы

- `docs/ROADMAP.md` — куда проект движется дальше
- `docs/contracts.md` — какой контракт уже считается стабильным
