---
"@orria-labs/runtime-elysia": minor
---

Add plugin-aware typed SDK generation for discovered HTTP/WS routes.

New features:
- support file-based route SDK typing through generated `src/generated/http/app.ts`
- include global Elysia plugin type effects in generated adapter app types
- support explicit codegen metadata for global plugin objects via `defineCodegenPlugin(...)`
- support additional file-based route naming patterns and WebSocket route discovery
