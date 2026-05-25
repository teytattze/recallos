---
paths:
  - "packages/server-ingestion/src/application/**/*"
  - "packages/server-knowledge/src/application/**/*"
---

# Rules: Application

- Contains: use cases that orchestrate the domain; transaction boundaries; defines ports.
- May depend on: its own domain/, @repo/server-kernel, zod, es-toolkit — nothing else.
- Must NOT contain: concrete DBs/HTTP, or any knowledge of which adapter is wired.
- Use cases depend on port interfaces, never concrete implementations (e.g. inject MemoryItemRepository, not a Postgres class).
- Files: \*.use-case.ts (the application service + its inbound port).

# Rules: Inbound ports (driving) — application/ports/inbound/

- Contains: interfaces describing what the app can do — one per use case.
- Must NOT contain: implementation.

# Rules: Outbound ports (driven) — application/ports/outbound/

- Contains: interfaces the app needs — repositories, gateways, clock, event publisher.
- Must NOT contain: implementation.
- The domain sees names like MemoryItemRepository, VectorIndex, RelationshipGraph — never a database name.
- Files: _.port.ts, _.repository.ts.
