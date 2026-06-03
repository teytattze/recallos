# Outbound Adapter Pattern

## Intent

- Implement outbound ports against real infrastructure.

## Pattern

- Owns persistence and gateway adapters.
- Implements ports for Postgres, pgvector, graph storage, and external APIs.
- Talks to other adapters only through the application layer.

## Boundaries

- Depends on `@repo/server-<context>`, `@repo/server-platform`, and drivers such as `pg` or SDK clients.
- Avoid business logic.

## Conventions

- Repository adapter files: `*.repository.pg.ts`.
- DB adapters live in `persistence/`.
- External API adapters live in `gateways/`.
