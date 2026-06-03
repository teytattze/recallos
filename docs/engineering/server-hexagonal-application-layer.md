# Application Layer Pattern

## Intent

- Orchestrate domain behavior behind use cases and ports.
- Keep the core independent of concrete adapters.

## Pattern

- Owns use cases, transaction boundaries, and port interfaces.
- Depends on port interfaces, never concrete implementations.
- Inject `MemoryItemRepository`, not a Postgres class.
- Names domain concepts like `VectorIndex` or `RelationshipGraph`, never database products.

## Boundaries

- Depends on its own `domain/`, `@repo/server-kernel`, `zod`, `es-toolkit`, and `date-fns`.
- Avoid concrete DBs, HTTP, framework code, and adapter wiring knowledge.
- Ports define contracts only; they do not implement behavior.

## Conventions

- Use cases: `*.use-case.ts`.
- Inbound ports: `application/ports/inbound/`, one interface per use case.
- Outbound ports: `application/ports/outbound/`.
- Outbound port files: `*.port.ts` or `*.repository.ts`.
