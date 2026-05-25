---
paths:
  - "packages/server-kernel/**/*"
---

# Rules: Kernel

## Scope

- The DDD building blocks every bounded context reuses — framework-free, context-free, zero I/O.
- Contains:
  - Base classes — `Entity`, `AggregateRoot`, `ValueObject`, `TenantAggregateRoot`.
  - Identity & ownership — `Id`, `Tenant`/`TenantType`, `EntityMetadata`.
  - Contracts & primitives — `DomainEvent`, `DomainError`, `Clock`, `Result`.
  - Validation helpers — `parseProps`/`parsePropsOrThrow`, `defineError`, `InvariantViolation`, `fixedClock`.
- Must NOT contain: I/O, frameworks, drivers, or context-specific types. A primitive belongs here only if it's reused across contexts and carries no context-specific meaning — `Tenant` and `Clock` qualify; an `Event` aggregate or `InvalidEvent` error does not.

## Dependencies

- May depend on `es-toolkit`, `zod` — nothing else. No `@repo/*`, no drivers.
