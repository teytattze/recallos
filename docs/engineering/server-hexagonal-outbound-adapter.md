# Outbound Adapter Pattern

## Intent

- Implement outbound ports against infrastructure.

## Pattern

- Lives in `packages/server-<context>-outbound-adapter`.
- Owns persistence and gateway adapters.
- Implements ports against MongoDB and external APIs such as VoyageAI.
- Talks to other adapters only through the application layer.

## Boundaries

- Depends on `@repo/server-<context>-core` and explicitly declared drivers such as `mongodb` or SDK clients.
- No business logic.

## Conventions

- DB adapters live in `persistence/`.
- External API adapters live in a capability and technology directory, such as `embedding/voyageai/`.
- Use kebab-case filenames that mirror the exported symbol.
- Name persistence adapters `<technology>-<concept>-<kind>.ts`, e.g. `mongodb-event-repository.ts`.
- Implement application-owned port interfaces; do not define competing adapter-local ports.
- Use file-local declarations plus final `export { ... }` and `export type { ... }` blocks.
- Keep package barrels explicit and group exports by capability.
