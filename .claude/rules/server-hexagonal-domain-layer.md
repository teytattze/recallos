---
paths:
  - "packages/server-ingestion/src/domain/**/*"
  - "packages/server-knowledge/src/domain/**/*"
---

# Rules: Domain

- Contains: entities, value objects, aggregates, domain events, domain services, invariants.
- May depend on: @repo/server-kernel, es-toolkit, zod — nothing else.
- Must NOT contain: I/O, frameworks, SQL, env reads, wall-clock reads (Date.now()).
- Pure library with zero I/O. If it needs the outside world, it declares a port rather than reaching out.
- Files: _.aggregate.ts, _.entity.ts, _.value-object.ts, _.event.ts.
- Invariants via zod: aggregates, entities, value objects, and events declare a `zod` schema as the single source of truth for props; derive the type with `z.infer`.
- Validate through kernel helpers, never raw `schema.parse`: `parseProps` (returns `Result`) for expected failures, `parsePropsOrThrow` for impossible states.
- Private constructor takes parsed props; a `static` factory runs the schema and returns `Result` (see `Tenant`/`Id` in `@repo/server-kernel`).
- Cross-field/contextual checks zod can't express may be layered imperatively on top, returning a `Result.err` domain error.
- Name the primary factory `create` across aggregates, entities, and value objects (e.g. `Event.create`, `Tags.create`)
