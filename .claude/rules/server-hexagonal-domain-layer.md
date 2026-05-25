---
paths:
  - "packages/server-ingestion/src/domain/**/*"
  - "packages/server-knowledge/src/domain/**/*"
---

# Rules: Domain

- Contains: entities, value objects, aggregates, domain events, domain services, invariants.
- May depend on: @repo/server-kernel, zod, es-toolkit — nothing else.
- Must NOT contain: I/O, frameworks, SQL, env reads, wall-clock reads (Date.now()).
- Pure library with zero I/O. If it needs the outside world, it declares a port rather than reaching out.
- Files: _.aggregate.ts, _.entity.ts, _.value-object.ts, _.event.ts.
