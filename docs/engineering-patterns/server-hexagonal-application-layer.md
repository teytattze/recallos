# Application Layer Pattern

## Intent

- Orchestrate domain behavior through use cases and ports.
- Keep the core independent of concrete adapters.

## Pattern

- Lives in `packages/server-<context>-core/src/application/`.
- Owns use cases, transaction boundaries, and port interfaces.
- Depends on port interfaces, never concrete implementations.
- Inject ports such as `GraphNodeRepositoryPort`, never concrete adapters.
- Name domain capabilities, not database products.

## Boundaries

- Depends only on its own `domain/`, `@repo/server-kernel`, and explicitly declared pure-library dependencies such as `zod`.
- No concrete DBs, HTTP, framework code, platform imports, or adapter wiring.
- Ports define contracts only; they do not implement behavior.
- Inbound ports use application-owned input/output DTOs and do not expose domain objects.
- Outbound ports may expose domain objects and should use named operation input/output wrappers.
- Use cases map inbound DTOs to domain before calling outbound ports.

## Conventions

- Use cases: `*.use-case.ts`.
- Inbound ports: `application/ports/inbound/<use-case>-port.ts`, one interface per use case.
- Outbound ports: `application/ports/outbound/<capability>-port.ts`.
- Use kebab-case filenames with a `-port.ts` suffix.
- Name inbound port contracts `<UseCase>PortInput`, `<UseCase>PortOutput`, and `<UseCase>Port`.
- Use cases implement the inbound port and return successful outputs directly.
- Unit-of-work ports name their transaction context `UnitOfWorkPortContext`.
- Use file-local declarations plus final `export type { ... }` blocks for port types.
