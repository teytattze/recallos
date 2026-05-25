---
paths:
  - "packages/server-platform/**/*"
---

# Rules: Platform

- Contains: cross-cutting infra primitives — pg pool, zod config, pino logger, event bus, unit-of-work.
- May depend on: drivers.
- Must NOT contain: domain types, business rules.
- It is sideways infrastructure: adapters and apps use it; the domain never does.
