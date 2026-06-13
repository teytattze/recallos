# Outbound Adapter Pattern

## Intent

- Implement outbound ports against infrastructure.

## Pattern

- Lives in `packages/server-<context>-outbound-adapter`.
- Owns persistence and gateway adapters.
- Implements ports for Postgres, pgvector, graph storage, and external APIs.
- Talks to other adapters only through the application layer.

## Boundaries

- Depends on `@repo/server-<context>-core`, `@repo/server-platform`, and drivers such as `pg` or SDK clients.
- No business logic.

## Conventions

- DB adapters live in `persistence/`.
- External API adapters live in `gateways/`.
- Use kebab-case filenames that mirror the exported symbol.
- Name persistence adapters `<role>-<technology>-<kind>.ts`, e.g. `event-log-prisma-repository.ts`.
- Name adapter-owned interfaces `<Capability>Port` in `<capability>-port.ts`.
- Use file-local declarations plus final `export { ... }` and `export type { ... }` blocks.
- Keep the package barrel explicit: persistence exports first, then gateway/relay exports.
